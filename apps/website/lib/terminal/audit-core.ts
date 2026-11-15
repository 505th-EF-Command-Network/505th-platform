import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { AUDIT_DELETE_ROLES, can } from "./access";

/**
 * AUDIT LOG — shared by the website (/api/terminal/audit) and the Hub (/api/hub/audit).
 * auditList: entries for the last N days (filtered IN the database, so the Hub never downloads thousands of rows).
 * auditDelete: "Delete selected" (approved Hub mock 2026-11-15) — Commander / Developer only, reason required.
 *   1. a .txt copy goes to Archives (audit_archives) first, 2. the rows are removed,
 *   3. a LOCKED record is left (who, how many, why). Locked rows can never be selected or removed.
 */
export const AUDIT_COLLS = ["audit_logs", "audit_log"]; // new format + the original Command Panel's format
export const CLEAR_ROLES = new Set(["commander", "developer"]);
type Actor = { uid: string; role: string; access: Record<string, unknown>; displayName: string };

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);
const WEB_CAT: Record<string, string> = {
  manpower: "manpower", battalion_ops: "operations", operations: "operations", intel: "operations", public_comms: "workspace", workspace: "workspace",
  discord: "discord", discord_network: "command", commander: "command", command: "command", security: "security",
};

/** Both audit formats → one shape. */
export function normalise(d: { _id: string; data?: unknown; createTime?: Date | null }) {
  const x = (d.data ?? {}) as Record<string, any>;
  const source = x.source === "discord" ? "discord" : x.source === "hub" ? "hub" : x.role === "cortana" || x.source === "cortana" ? "cortana" : "website";
  const section = String(x.section || x.category || "other").toLowerCase();
  return {
    id: d._id,
    at: iso(x.createdAt) || x.createdAtISO || iso(x.timestamp) || iso(d.createTime) || null,
    source,
    cat: String(x.cat || (source === "discord" ? "server" : source === "hub" ? "hub" : WEB_CAT[section] || "command")),
    section,
    action: String(x.action || "—"),
    details: String(x.details ?? x.detail ?? ""),
    by: String(x.by || x.operatorName || "—"),
    role: String(x.role || ""),
    locked: x.locked === true,
    target: x.target ?? null, channel: x.channel ?? null, before: x.before ?? null, after: x.after ?? null, content: x.content ?? null,
    media: Array.isArray(x.media) ? x.media.map((m: any) => ({ url: String(m.url ?? ""), name: String(m.name ?? ""), kind: String(m.kind ?? "file") })) : null,
    mediaRemoved: x.mediaRemoved === true,
    bulk: Array.isArray(x.bulk) ? x.bulk.map((b: any) => ({ at: b.at, author: b.author, content: b.content, media: (b.media ?? []).map((m: any) => ({ url: m.url, name: m.name, kind: m.kind })) })) : null,
    extra: { reason: x.reason ?? null, count: x.count ?? null, added: x.added ?? null, removed: x.removed ?? null, invite: x.invite ?? null, accountAgeDays: x.accountAgeDays ?? null, roles: x.roles ?? null, oldAvatar: x.oldAvatar ?? null, newAvatar: x.newAvatar ?? null, until: x.until ?? null, messageUrl: x.messageUrl ?? null },
  };
}
export type AuditEntry = ReturnType<typeof normalise> & { private?: boolean };

/** Discord message text, pictures and edits are private: Officer and above only. */
export function hidePrivate(e: AuditEntry, role: string): AuditEntry {
  if (AUDIT_DELETE_ROLES.has(role) || e.source !== "discord" || e.cat !== "messages") return e;
  return { ...e, details: e.action === "BULK DELETE" ? e.details.replace(/ · from .*/, "") : `${e.target ?? "Member"} — ${e.channel ?? ""} (text hidden: Officer and above)`, content: null, before: null, after: null, media: null, bulk: null, private: true };
}

export class AuditError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/** Hub: last N days (1–30), newest first, max 2000. */
export async function auditList(a: Actor, days: number) {
  if (!can(a.role, a.access, "audit")) throw new AuditError("You don't have Audit Log access.", 403);
  const d = Math.min(30, Math.max(1, Math.round(days) || 7));
  const since = new Date(Date.now() - d * 864e5);
  const docs = await TerminalDoc.find({ parent: { $in: AUDIT_COLLS }, createTime: { $gte: since } }, { parent: 1, docId: 1, data: 1, createTime: 1 }).sort({ createTime: -1 }).limit(2000).lean();
  const ms = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  const entries = docs.map(normalise).sort((x, y) => ms(y.at) - ms(x.at)).map((e) => hidePrivate(e, a.role));
  return { days: d, entries, canDelete: CLEAR_ROLES.has(a.role), canSeeText: AUDIT_DELETE_ROLES.has(a.role) };
}

const ID = /^audit_logs?\/[A-Za-z0-9_\-]{1,60}$/;
function line(x: Record<string, any>, t: string) {
  const src = x.source === "discord" ? "DC " : x.source === "hub" ? "HUB" : "WEB";
  let s = `${t.slice(0, 16).replace("T", " ")}  ${src}  ${String(x.action || "—").padEnd(16).slice(0, 16)}  ${String(x.by || x.operatorName || "—").padEnd(18).slice(0, 18)}  ${String(x.details ?? x.detail ?? "").replace(/\s+/g, " ")}`;
  if (x.before != null || x.after != null) s += `\n${" ".repeat(20)}BEFORE: ${String(x.before ?? "").replace(/\s+/g, " ")}\n${" ".repeat(20)}AFTER:  ${String(x.after ?? "").replace(/\s+/g, " ")}`;
  if (x.content) s += `\n${" ".repeat(20)}TEXT: ${String(x.content).replace(/\s+/g, " ")}`;
  if (Array.isArray(x.media)) for (const m of x.media) s += `\n${" ".repeat(20)}${String(m.kind || "file").toUpperCase()}: ${m.name} ${m.url}`;
  return s;
}
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/** Delete selected rows: archive → remove → locked record. */
export async function auditDelete(a: Actor, ids: unknown, reasonIn: unknown) {
  if (!CLEAR_ROLES.has(a.role)) throw new AuditError("Only the Commander or a Developer can delete audit entries.", 403);
  const reason = String(reasonIn ?? "").trim().slice(0, 300);
  if (reason.length < 3) throw new AuditError("A reason is needed.");
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => typeof x === "string" && ID.test(x))) throw new AuditError("Bad selection.");
  const docs = await TerminalDoc.find({ _id: { $in: ids }, parent: { $in: AUDIT_COLLS }, "data.locked": { $ne: true } }, { data: 1, createTime: 1 }).sort({ createTime: 1 }).lean();
  if (!docs.length) throw new AuditError("Nothing to delete (locked records can't be deleted).");
  const now = new Date(), when = (d: (typeof docs)[number]) => normalise(d as any).at ?? "";
  const times = docs.map(when).filter(Boolean).sort();
  const name = `audit-deleted-${now.toISOString().slice(0, 10)}-${autoId().slice(0, 4)}.txt`;
  const text = [
    "505th EXPEDITIONARY FORCE — AUDIT LOG ARCHIVE",
    `Deleted selection · ${docs.length} entries · ${times[0]?.slice(0, 10) ?? "—"} to ${times.at(-1)?.slice(0, 10) ?? "—"}`,
    `Saved ${now.toLocaleString("en-GB", { timeZone: "Europe/London" })} UK by ${a.displayName} · reason: ${reason}`,
    "-".repeat(100),
    ...docs.map((d) => line((d.data ?? {}) as Record<string, any>, when(d))),
  ].join("\n") + "\n";
  const archiveId = autoId();
  await TerminalDoc.create({ _id: `audit_archives/${archiveId}`, parent: "audit_archives", docId: archiveId, createTime: now, updateTime: now,
    data: { name, kind: "delete", label: "Deleted selection", reason, count: docs.length, from: times[0] ?? null, to: times.at(-1) ?? null, by: a.displayName, bytes: Buffer.byteLength(text), text, createdAtISO: now.toISOString() } });
  await TerminalDoc.deleteMany({ _id: { $in: docs.map((d) => d._id) }, "data.locked": { $ne: true } });
  const id = autoId();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { source: "terminal", cat: "security", section: "security", action: "ENTRIES DELETED", locked: true, by: a.displayName, role: a.role, uid: a.uid,
      details: `${docs.length} entries deleted · saved to ${name} — "${reason}"`, reason, count: docs.length, createdAt: now, createdAtISO: now.toISOString() } });
  return { ok: true, removed: docs.length, archive: name };
}
