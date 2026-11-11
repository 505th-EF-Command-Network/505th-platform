/**
 * Pure helpers for the original Command Terminal's data API (no I/O, so they
 * are unit-tested). The terminal page speaks the Firestore API through
 * /public/terminal-shim/firestore.js; these functions turn those calls into
 * MongoDB filters and updates on the `terminal_fs` collection.
 *
 * Wire format (JSON): dates are {"__type":"timestamp",seconds,nanoseconds};
 * write sentinels are {"__sv":"serverTimestamp"} and {"__sv":"increment","n":1}.
 */

import { can, readNeeds, writeNeeds } from "./access";

export class FsError extends Error {
  constructor(
    public code: "invalid-argument" | "permission-denied" | "not-found" | "unauthenticated" | "internal",
    message: string,
  ) {
    super(message);
  }
}

// ───────────── Paths ─────────────

/** Top-level collections the original terminal uses, plus allowed subcollections. */
export const TOP_COLLECTIONS = new Set([
  "aars", "admin_notifications", "attendance_events", "attendance_history", "audit_log", "audit_logs",
  "comms_media", "conversations", "discord_tracking", "fragos", "media", "notifications",
  "presence_sessions", "roster", "settings", "unit_config", "users",
  // v2 terminal pages
  "projects", "notes", "community_events", "bot_jobs",
  // written by Cortana v2 only (read-only here)
  "bot_status", "bot_state", "discord_channels", "discord_roles", "discord_messages",
  "info_posts", "ticket_types", "tickets", "mod_cases", "mod_purges", "net_incidents", "sync_log",
]);
const BOT_ONLY = new Set(["bot_status", "bot_state", "discord_channels", "discord_roles", "discord_messages", "tickets", "mod_cases", "mod_purges", "net_incidents", "sync_log"]);
const SUB_COLLECTIONS: Record<string, string> = { conversations: "messages", notifications: "items" };
const SEGMENT = /^[A-Za-z0-9_\-]{1,200}$/;

function segments(path: unknown): string[] {
  if (typeof path !== "string" || path.length > 600) throw new FsError("invalid-argument", "Bad path");
  const segs = path.split("/");
  if (!segs.every((s) => SEGMENT.test(s))) throw new FsError("invalid-argument", "Bad path");
  if (!TOP_COLLECTIONS.has(segs[0])) throw new FsError("permission-denied", `Collection not allowed: ${segs[0]}`);
  if (segs.length > 4) throw new FsError("invalid-argument", "Path too deep");
  if (segs.length >= 3 && SUB_COLLECTIONS[segs[0]] !== segs[2]) throw new FsError("permission-denied", "Subcollection not allowed");
  return segs;
}

export function docPath(path: unknown): { path: string; parent: string; docId: string; top: string } {
  const segs = segments(path);
  if (segs.length % 2 !== 0) throw new FsError("invalid-argument", "Not a document path");
  return { path: segs.join("/"), parent: segs.slice(0, -1).join("/"), docId: segs[segs.length - 1], top: segs[0] };
}

export function collPath(path: unknown): string {
  const segs = segments(path);
  if (segs.length % 2 !== 1) throw new FsError("invalid-argument", "Not a collection path");
  return segs.join("/");
}

// ───────────── Values ─────────────

export type Sentinel = { __sv: "serverTimestamp" } | { __sv: "increment"; n: number };
const isPlain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
export const isSentinel = (v: unknown): v is Sentinel => isPlain(v) && typeof v.__sv === "string";

function checkKey(k: string) {
  if (!k || k.startsWith("$") || k.includes(".") || k.length > 300) throw new FsError("invalid-argument", `Bad field name: ${k.slice(0, 40)}`);
}

/** Wire → native. Sentinels are kept for the write step. Rejects unsafe keys. */
export function decode(v: unknown, depth = 0): unknown {
  if (depth > 40) throw new FsError("invalid-argument", "Value nested too deep");
  if (Array.isArray(v)) return v.map((x) => decode(x, depth + 1));
  if (isPlain(v)) {
    if (v.__type === "timestamp") {
      const s = Number(v.seconds), n = Number(v.nanoseconds ?? 0);
      if (!Number.isFinite(s) || !Number.isFinite(n)) throw new FsError("invalid-argument", "Bad timestamp");
      return new Date(s * 1000 + Math.floor(n / 1e6));
    }
    if (v.__sv === "serverTimestamp") return { __sv: "serverTimestamp" };
    if (v.__sv === "increment") {
      const n = Number(v.n);
      if (!Number.isFinite(n)) throw new FsError("invalid-argument", "Bad increment");
      return { __sv: "increment", n };
    }
    if ("__type" in v || "__sv" in v) throw new FsError("invalid-argument", "Unknown special value");
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      checkKey(k);
      out[k] = decode(x, depth + 1);
    }
    return out;
  }
  return v;
}

/** updateDoc data: top-level keys are field paths ("a.b"), so dots are allowed there. */
export function decodeFieldPaths(v: unknown): Record<string, unknown> {
  if (!isPlain(v)) throw new FsError("invalid-argument", "Data must be an object");
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    k.split(".").forEach(checkKey);
    out[k] = decode(x, 1);
  }
  return out;
}

/** Native → wire. */
export function encode(v: unknown): unknown {
  if (v instanceof Date) {
    const ms = v.getTime();
    return { __type: "timestamp", seconds: Math.floor(ms / 1000), nanoseconds: (((ms % 1000) + 1000) % 1000) * 1e6 };
  }
  if (Array.isArray(v)) return v.map(encode);
  if (isPlain(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = encode(x);
    return out;
  }
  return v;
}

/** Replace sentinels with plain values (used when a whole doc is replaced). */
export function resolveSentinels(v: unknown, now: Date): unknown {
  if (isSentinel(v)) return v.__sv === "serverTimestamp" ? now : v.n;
  if (Array.isArray(v)) return v.map((x) => resolveSentinels(x, now));
  if (isPlain(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveSentinels(x, now);
    return out;
  }
  return v;
}

// ───────────── Writes → Mongo update ─────────────

export type MongoUpdate = { $set: Record<string, unknown>; $inc?: Record<string, number> };

function put(u: MongoUpdate, path: string, v: unknown, now: Date) {
  if (isSentinel(v)) {
    if (v.__sv === "serverTimestamp") u.$set[path] = now;
    else (u.$inc ??= {})[path] = v.n;
  } else u.$set[path] = resolveSentinels(v, now);
}

/** setDoc(ref, data, { merge: true }) — deep-merges maps, replaces arrays. */
export function mergeUpdate(data: Record<string, unknown>, now: Date): MongoUpdate {
  const u: MongoUpdate = { $set: {} };
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = `${prefix}.${k}`;
      if (isPlain(v) && !isSentinel(v)) {
        if (Object.keys(v).length) walk(v, p);
        else u.$set[p] = {};
      } else put(u, p, v, now);
    }
  };
  walk(data, "data");
  return u;
}

/** updateDoc(ref, data) — keys are field paths ("a.b"); values replace that field. */
export function fieldUpdate(data: Record<string, unknown>, now: Date): MongoUpdate {
  const u: MongoUpdate = { $set: {} };
  for (const [fieldPath, v] of Object.entries(data)) {
    const parts = fieldPath.split(".");
    parts.forEach(checkKey);
    put(u, `data.${parts.join(".")}`, v, now);
  }
  return u;
}

/** Top-level field names a write touches (for permission checks). */
export function touchedFields(data: Record<string, unknown>, isFieldPaths: boolean): Set<string> {
  return new Set(Object.keys(data).map((k) => (isFieldPaths ? k.split(".")[0] : k)));
}

// ───────────── Queries → Mongo filter ─────────────

export type WhereClause = [string, string, unknown];
export type OrderClause = [string, "asc" | "desc"];

function fieldKey(f: unknown): string {
  if (typeof f !== "string") throw new FsError("invalid-argument", "Bad field");
  const parts = f.split(".");
  parts.forEach(checkKey);
  return `data.${parts.join(".")}`;
}

export function buildQuery(
  parent: string,
  where: WhereClause[] = [],
  orderBy: OrderClause[] = [],
  limit?: number,
): { filter: Record<string, any>; sort: Record<string, 1 | -1>; limit: number } {
  if (!Array.isArray(where) || !Array.isArray(orderBy) || where.length > 10 || orderBy.length > 4) {
    throw new FsError("invalid-argument", "Bad query");
  }
  const and: Record<string, any>[] = [{ parent }];
  for (const clause of where) {
    if (!Array.isArray(clause) || clause.length !== 3) throw new FsError("invalid-argument", "Bad where clause");
    const [f, op, raw] = clause;
    const k = fieldKey(f);
    const v = decode(raw);
    switch (op) {
      case "==": and.push({ [k]: v }); break;
      case "!=": and.push({ [k]: { $exists: true, $ne: v } }); break;
      case "<": and.push({ [k]: { $lt: v } }); break;
      case "<=": and.push({ [k]: { $lte: v } }); break;
      case ">": and.push({ [k]: { $gt: v } }); break;
      case ">=": and.push({ [k]: { $gte: v } }); break;
      case "array-contains": and.push({ [k]: { $elemMatch: { $eq: v } } }); break;
      case "array-contains-any":
        if (!Array.isArray(v)) throw new FsError("invalid-argument", "Expected array");
        and.push({ [k]: { $elemMatch: { $in: v } } });
        break;
      case "in":
        if (!Array.isArray(v)) throw new FsError("invalid-argument", "Expected array");
        and.push({ [k]: { $in: v } });
        break;
      case "not-in":
        if (!Array.isArray(v)) throw new FsError("invalid-argument", "Expected array");
        and.push({ [k]: { $exists: true, $nin: v } });
        break;
      default:
        throw new FsError("invalid-argument", `Unsupported operator ${String(op)}`);
    }
  }
  const sort: Record<string, 1 | -1> = {};
  for (const clause of orderBy) {
    if (!Array.isArray(clause)) throw new FsError("invalid-argument", "Bad orderBy");
    const k = fieldKey(clause[0]);
    sort[k] = clause[1] === "desc" ? -1 : 1;
    // Firestore leaves out documents that do not have the ordered field.
    and.push({ [k]: { $exists: true } });
  }
  sort.docId = 1;
  const n = limit == null ? 5000 : Number(limit);
  if (!Number.isInteger(n) || n < 1) throw new FsError("invalid-argument", "Bad limit");
  return { filter: and.length === 1 ? and[0] : { $and: and }, sort, limit: Math.min(n, 5000) };
}

// ───────────── Permissions (mirrors admin.html's own role rules) ─────────────

const ALL_ASSIGNABLE = ["enlistee", "marine", "recruiter", "nco", "staff_nco", "officer", "developer", "commander", "retired_veteran"];

/** Same table as getAssignableRoles() in admin.html. */
export function assignableRoles(actorRole: string): string[] {
  switch (actorRole) {
    case "commander": return ALL_ASSIGNABLE;
    case "officer":
    case "developer": return ["enlistee", "marine", "recruiter", "nco", "staff_nco", "retired_veteran"];
    case "staff_nco": return ["enlistee", "marine", "recruiter", "nco", "retired_veteran"];
    case "nco": return ["enlistee", "marine", "recruiter"];
    default: return [];
  }
}

/** Any of these lets you write to another member's file (each panel has its own field rules). */
const USER_EDIT_KEYS = ["pers", "bct", "roster", "promote", "att", "lock"];
const DELETE_USER_ROLES = new Set(["commander", "officer", "developer", "staff_nco"]);
const LINK_ROLES = new Set(["commander", "developer"]);

export type Actor = { uid: string; role: string; access?: unknown };
export type UserTarget = { uid: string; role: string; discordId?: string | null } | null;

/**
 * Server-side checks for writes. The original page checks these in the browser
 * only; here they are enforced so nobody can escalate their own access.
 */
/** Reads of private collections (audit log, notes, projects). */
export function checkRead(actor: Actor, top: string) {
  // Notes have per-note sharing: only /api/terminal/notes can read them.
  if (top === "notes") throw new FsError("permission-denied", "Notes are opened through the Notes page");
  const k = readNeeds(top);
  if (k && !can(actor.role, actor.access, k)) throw new FsError("permission-denied", "You don't have access to this");
}

export function checkWrite(
  actor: Actor,
  op: "set" | "update" | "delete" | "add",
  target: { top: string; path: string; docId: string },
  fields: Set<string>,
  newValues: Record<string, unknown>,
  user: UserTarget,
) {
  const deny = (m: string) => {
    throw new FsError("permission-denied", m);
  };

  if (target.top === "notes") deny("Notes are saved through the Notes page");
  if (BOT_ONLY.has(target.top)) deny("Only Cortana writes this");
  const needs = writeNeeds(target.top, target.docId, fields, newValues);
  if (needs && !needs.some((k) => can(actor.role, actor.access, k))) deny("You don't have access to change this");

  // Audit entries can only be ADDED here. Removing them is Cortana's clean-up / clear (Audit Log v3, leaves a locked record).
  if ((target.top === "audit_log" || target.top === "audit_logs") && op !== "add") deny("Audit entries can only be removed from Security → Audit Log");
  // Suspending is a Command action (Commander / Developer by default).
  if (target.top === "users" && ["suspended", "suspendedUntil", "suspendReason"].some((f) => fields.has(f)) && !can(actor.role, actor.access, "set") && !can(actor.role, actor.access, "cmd_suspend")) {
    deny("Only Command can suspend or restore members");
  }
  if (target.top === "users" && target.docId !== actor.uid && !USER_EDIT_KEYS.some((k) => can(actor.role, actor.access, k))) {
    deny("You don't have access to change other members");
  }

  // Profile pictures / alert settings only change through /api/me/profile (checks the picture link).
  if (target.top === "users" && ["photo", "photoUrl", "discordAvatarUrl", "notifyPrefs"].some((f) => fields.has(f))) deny("Pictures and alert settings are changed on the profile page");

  // Access overrides are only changed through Officer Management (/api/terminal/access).
  if (target.top === "users" && fields.has("access")) deny("Access is changed in Officer Management only");
  if (target.top === "users" && fields.has("cmdGrant")) deny("Command Access is changed in Command → Command Access only");

  if (target.top !== "users" || target.path.split("/").length !== 2) return;

  if (op === "delete") {
    if (!DELETE_USER_ROLES.has(actor.role)) deny("Your role cannot delete personnel files");
    if (target.docId === actor.uid) deny("You cannot delete your own file");
    if (user && !assignableRoles(actor.role).includes(user.role || "enlistee")) deny("Target outranks your authority");
    return;
  }

  if (fields.has("role")) {
    const next = String(newValues.role ?? "");
    const current = user?.role || "enlistee";
    if (next !== current) {
      if (target.docId === actor.uid) deny("You cannot change your own role");
      const can = assignableRoles(actor.role);
      if (!can.includes(next)) deny(`Your role cannot assign ${next || "that role"}`);
      if (user && !can.includes(current)) deny("Target outranks your authority");
    }
  }

  if (fields.has("discordId")) {
    const next = (newValues.discordId as string | null | undefined) || null;
    const current = user?.discordId || null;
    if (next !== current) {
      if (!LINK_ROLES.has(actor.role)) deny("Only Commander or Developer can change a Discord link");
      if (user?.role === "commander" && actor.role !== "commander") deny("Only a Commander can relink a Commander");
      if (next !== null && !/^\d{15,22}$/.test(next)) deny("Discord ID must be numbers only");
    }
  }
}
