import "server-only";

/**
 * Data API for the ORIGINAL Command Terminal (admin.html). Runs Firestore-style
 * operations against MongoDB `terminal_fs`. Edits to `users/*` are mirrored
 * into `members`, which is what Discord sign-in and the rest of the site use.
 */
import { randomBytes } from "node:crypto";
import { connectDb, Member, Session, TerminalDoc, transformMember } from "@505th/db";
import { getViewer } from "@/lib/auth/session";
import {
  FsError, buildQuery, checkRead, checkWrite, collPath, decode, decodeFieldPaths, docPath, encode, fieldUpdate, mergeUpdate, resolveSentinels,
  touchedFields, type Actor, type MongoUpdate, type UserTarget,
} from "./fs-core";
import { checkConvQuery, checkConvRead, checkConvWrite, checkNotif } from "./conv-core";

export { FsError };

export type Op =
  | { op: "whoami" }
  | { op: "get"; path: string }
  | { op: "query"; coll: string; where?: [string, string, unknown][]; orderBy?: [string, "asc" | "desc"][]; limit?: number }
  | { op: "set"; path: string; data: Record<string, unknown>; merge?: boolean }
  | { op: "update"; path: string; data: Record<string, unknown> }
  | { op: "add"; coll: string; data: Record<string, unknown> }
  | { op: "delete"; path: string };

export type Who = Actor & { discordId: string; displayName: string; email: string | null; memberId: string };

/** Signed-in viewer with Terminal access, mapped to their original terminal uid. */
export async function getActor(): Promise<Who> {
  const viewer = await getViewer();
  if (!viewer) throw new FsError("unauthenticated", "Not signed in");
  if (viewer.terminal.result !== "GRANTED" || !viewer.member) throw new FsError("permission-denied", "No Command Terminal clearance");
  await connectDb();
  const m = await Member.findById(viewer.member.id, { legacyId: 1, role: 1, email: 1 }).lean();
  if (!m) throw new FsError("permission-denied", "Member record not found");
  const uid = m.legacyId || String(m._id);
  const td = await TerminalDoc.findById(`users/${uid}`, { "data.access": 1 }).lean();
  return {
    uid,
    role: m.role,
    access: (td?.data as Record<string, unknown> | undefined)?.access ?? {},
    discordId: viewer.discordId,
    displayName: viewer.member.displayName,
    email: m.email ?? null,
    memberId: String(m._id),
  };
}

const autoId = () => {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(20), (b) => abc[b % 62]).join("");
};

const snap = (d: { _id: string; docId: string; data?: unknown } | null, path: string) =>
  d ? { exists: true, id: d.docId, path: d._id, data: encode(d.data ?? {}) } : { exists: false, id: path.split("/").pop(), path, data: null };

/** Private messages + alerts: per-document checks that need the stored data. */
async function guardRead(actor: Actor, segs: string[], where?: unknown) {
  if (segs[0] === "notifications" && segs.length >= 2) checkNotif(actor.uid, "read", segs[1]);
  if (segs[0] !== "conversations") return;
  if (segs.length === 1) return checkConvQuery(actor.uid, where);
  const c = await TerminalDoc.findById(`conversations/${segs[1]}`, { data: 1 }).lean();
  checkConvRead(actor.uid, (c?.data as Record<string, any>) ?? null);
  if (!c && segs.length > 2) throw new FsError("permission-denied", "Not your conversation");
}
async function guardWrite(actor: Actor, op: "set" | "update" | "delete" | "add", path: string, data: Record<string, unknown>) {
  const segs = path.split("/");
  if (segs[0] === "notifications" && segs.length >= 2) checkNotif(actor.uid, op, segs[1]);
  if (segs[0] !== "conversations") return;
  const conv = op === "add" && segs.length === 2 ? null : ((await TerminalDoc.findById(`conversations/${segs[1]}`, { data: 1 }).lean())?.data as Record<string, any>) ?? null;
  const msg = segs.length === 4 && op === "update" ? ((await TerminalDoc.findById(path, { data: 1 }).lean())?.data as Record<string, any>) ?? null : null;
  checkConvWrite(actor.uid, op, segs, conv, msg, data);
}

const asObject = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new FsError("invalid-argument", "Data must be an object");
  return v as Record<string, unknown>;
};

async function loadUser(uid: string): Promise<UserTarget> {
  const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
  if (!d) return null;
  const data = (d.data ?? {}) as Record<string, any>;
  return { uid, role: data.role || "enlistee", discordId: data.discordId ?? null };
}

/** Mirror a terminal `users` doc into `members` (Discord sign-in reads members). */
export async function syncMember(uid: string, deleted: boolean) {
  const existing = await Member.findOne({ legacyId: uid });
  if (deleted) {
    if (existing) {
      existing.set({ status: "LEFT_UNIT", leftAt: new Date() });
      await existing.save();
      await Session.deleteMany({ member: existing._id });
    }
    return;
  }
  const d = await TerminalDoc.findById(`users/${uid}`).lean();
  if (!d) return;
  const raw = (d.data ?? {}) as Record<string, any>;
  const { doc } = transformMember(
    { id: uid, path: d._id, data: encode(raw) as Record<string, any>, createTime: d.createTime?.toISOString(), updateTime: d.updateTime?.toISOString() },
    () => false,
  );
  delete doc.createdAt;
  // Members who left keep LEFT_UNIT; that status is managed outside the old terminal.
  if (existing?.status === "LEFT_UNIT") doc.status = "LEFT_UNIT";
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined) {
      if (k === "discordId" && "discordId" in raw && !raw.discordId) unset.discordId = 1;
      continue;
    }
    set[k] = v;
  }
  if (existing) {
    await Member.updateOne({ _id: existing._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    // Unlinked, suspended or no longer allowed in: sign them out everywhere.
    const blocked = set.status === "SUSPENDED" || set.status === "LEFT_UNIT";
    if (unset.discordId || (set.discordId && set.discordId !== existing.discordId) || (blocked && existing.status !== set.status)) {
      await Session.deleteMany({ member: existing._id });
    }
  } else {
    await Member.create(set);
  }
}

async function ensureDiscordFree(discordId: unknown, uid: string) {
  if (!discordId) return;
  const other = await Member.findOne({ discordId: String(discordId), legacyId: { $ne: uid } }, { _id: 1 }).lean();
  if (other) throw new FsError("invalid-argument", "That Discord ID is already linked to another member");
}

async function applyUpdate(path: string, parent: string, docId: string, u: MongoUpdate, upsert: boolean, now: Date) {
  const res = await TerminalDoc.updateOne(
    { _id: path },
    {
      $set: { ...u.$set, updateTime: now },
      ...(u.$inc ? { $inc: u.$inc } : {}),
      ...(upsert ? { $setOnInsert: { parent, docId, createTime: now } } : {}),
    },
    { upsert },
  );
  if (!upsert && res.matchedCount === 0) throw new FsError("not-found", `No document to update: ${path}`);
}

export async function runOp(actor: Who, raw: Op): Promise<unknown> {
  const now = new Date();
  switch (raw?.op) {
    case "whoami":
      return { uid: actor.uid, email: actor.email, displayName: actor.displayName, discordId: actor.discordId };

    case "get": {
      const t = docPath(raw.path);
      checkRead(actor, t.top);
      await guardRead(actor, t.path.split("/"));
      return snap(await TerminalDoc.findById(t.path).lean(), t.path);
    }

    case "query": {
      const parent = collPath(raw.coll);
      checkRead(actor, parent.split("/")[0]);
      await guardRead(actor, parent.split("/"), raw.where);
      const q = buildQuery(parent, raw.where, raw.orderBy, raw.limit);
      const docs = await TerminalDoc.find(q.filter).sort(q.sort).limit(q.limit).lean();
      return docs.map((d) => snap(d, d._id));
    }

    case "set":
    case "update":
    case "add": {
      let t: ReturnType<typeof docPath>;
      if (raw.op === "add") {
        const coll = collPath(raw.coll);
        t = docPath(`${coll}/${autoId()}`);
      } else t = docPath(raw.path);
      const isUpdate = raw.op === "update";
      const data = isUpdate ? decodeFieldPaths(asObject(raw.data)) : asObject(decode(asObject(raw.data)));
      const fields = touchedFields(data, isUpdate);
      const isUserDoc = t.top === "users" && t.path.split("/").length === 2;
      const user = isUserDoc ? await loadUser(t.docId) : null;
      checkWrite(actor, raw.op, t, fields, data, user);
      await guardWrite(actor, raw.op, t.path, data);
      if (isUserDoc && fields.has("discordId")) await ensureDiscordFree(data.discordId, t.docId);

      if (raw.op === "update") {
        await applyUpdate(t.path, t.parent, t.docId, fieldUpdate(data, now), false, now);
      } else if (raw.op === "set" && raw.merge) {
        await applyUpdate(t.path, t.parent, t.docId, mergeUpdate(data, now), true, now);
      } else {
        await TerminalDoc.updateOne(
          { _id: t.path },
          { $set: { data: resolveSentinels(data, now), parent: t.parent, docId: t.docId, updateTime: now }, $setOnInsert: { createTime: now } },
          { upsert: true },
        );
      }
      if (isUserDoc) await syncMember(t.docId, false);
      return { id: t.docId, path: t.path };
    }

    case "delete": {
      const t = docPath(raw.path);
      const isUserDoc = t.top === "users" && t.path.split("/").length === 2;
      const user = isUserDoc ? await loadUser(t.docId) : null;
      checkWrite(actor, "delete", t, new Set(), {}, user);
      await guardWrite(actor, "delete", t.path, {});
      await TerminalDoc.deleteOne({ _id: t.path });
      if (isUserDoc) await syncMember(t.docId, true);
      return null;
    }

    default:
      throw new FsError("invalid-argument", "Unknown operation");
  }
}
