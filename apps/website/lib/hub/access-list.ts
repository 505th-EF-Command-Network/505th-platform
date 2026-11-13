import { randomBytes } from "node:crypto";
import { HubSession, Member, TerminalDoc } from "@505th/db";
import { roleLevel } from "@/lib/terminal/access";
import { memberName, photoOf } from "@/lib/hub/members";
import { latestRelease } from "@/lib/hub/release";

/**
 * HUB ACCESS (release v0.1, approved mock 2026-11-11) — who may download and sign in to the Command Network app.
 * hub_access/{uid}: { status: "granted" | "revoked" | "requested" | "denied", by, byName, atISO, reason, note, requestAtISO }
 * Commander and Developer always have access. The Commander gives / revokes; the Developer can see the list.
 * Revoke = instant: every Hub sign-in for that member is ended (getHubActor checks this on every call) and they can't sign in again.
 * Every change → Audit Log + a 🔔 alert to the member. New requests → 🔔 alert to the Commander(s).
 */
type U = Record<string, any>;
export type Who = { uid: string; name: string; role: string; source: "hub" | "terminal" };
export class AccessError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const ALWAYS = (role: string | null | undefined) => roleLevel(role) >= 4.5;
const canManage = (w: Who) => w.role === "commander";
const canView = (w: Who) => ALWAYS(w.role);
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Used by getHubActor / the token swap: may this member use the Hub? */
export async function hubAllowed(uid: string, role: string) {
  if (ALWAYS(role)) return true;
  const d = (await TerminalDoc.findById(`hub_access/${uid}`, { "data.status": 1 }).lean())?.data as U | undefined;
  return d?.status === "granted";
}

async function alert(uid: string, title: string, body: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
    data: { type: "hubaccess", read: false, title, body, createdAt: now } }).catch(() => {});
}
async function audit(w: Who, action: string, details: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "security", action, details, uid: w.uid, by: w.name, role: w.role, source: w.source, createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}
async function setRec(uid: string, data: U) {
  const now = new Date();
  await TerminalDoc.updateOne({ _id: `hub_access/${uid}` }, { $set: { parent: "hub_access", docId: uid, updateTime: now, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data.${k}`, v])) }, $setOnInsert: { createTime: now } }, { upsert: true });
}
/** End every Hub sign-in of a member (their app signs out on its next call — seconds with the 505th Net). */
async function endSessions(uid: string, why: string) {
  const m = await Member.findOne({ $or: [{ legacyId: uid }, ...(/^[a-f0-9]{24}$/.test(uid) ? [{ _id: uid }] : [])] }, { _id: 1 }).lean();
  if (!m) return 0;
  const r = await HubSession.updateMany({ member: m._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedReason: why } });
  return r.modifiedCount;
}

/** The list for the Hub Access page (Commander / Developer). */
export async function listAccess(w: Who) {
  if (!canView(w)) throw new AccessError("Only the Commander can see Hub Access.", 403);
  const F = ["firstName", "lastName", "callsign", "rank", "role", "status", "platoon", "photoUrl", "photoURL", "discordAvatarUrl", "suspended"];
  const [us, recs, sessions] = await Promise.all([
    TerminalDoc.find({ parent: "users" }, { docId: 1, ...Object.fromEntries(F.map((f) => [`data.${f}`, 1])) }).lean(),
    TerminalDoc.find({ parent: "hub_access" }, { docId: 1, data: 1 }).lean(),
    HubSession.find({ revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { member: 1, lastUsedAt: 1 }).lean(),
  ]);
  const rec = new Map(recs.map((r) => [String(r.docId), (r.data ?? {}) as U]));
  const mem = await Member.find({ _id: { $in: [...new Set(sessions.map((s) => String(s.member)))] } }, { legacyId: 1 }).lean();
  const uidOf = new Map(mem.map((m) => [String(m._id), m.legacyId || String(m._id)]));
  const dev = new Map<string, { n: number; last: number }>();
  for (const s of sessions) { const u = uidOf.get(String(s.member)); if (!u) continue; const x = dev.get(u) ?? { n: 0, last: 0 }; x.n++; x.last = Math.max(x.last, s.lastUsedAt ? +new Date(s.lastUsedAt) : 0); dev.set(u, x); }
  const people = us.map((d) => ({ id: String(d.docId), ...(((d as U).data ?? {}) as U) }) as U)
    .filter((u) => u.status !== "pending" && u.status !== "denied" && roleLevel(u.role) >= 2)
    .map((u) => { const r = rec.get(u.id) ?? {}, dv = dev.get(u.id);
      return { uid: u.id, name: memberName(u), role: u.role || "", photo: photoOf(u), always: ALWAYS(u.role), status: ALWAYS(u.role) ? "always" : r.status || "none",
        byName: r.byName || "", atISO: r.atISO || "", reason: r.reason || "", note: r.note || "", requestAtISO: r.requestAtISO || "",
        suspended: u.suspended === true, devices: dv?.n ?? 0, lastUsedISO: dv?.last ? new Date(dv.last).toISOString() : "" }; })
    .sort((a, b) => Number(b.always) - Number(a.always) || roleLevel(b.role) - roleLevel(a.role) || a.name.localeCompare(b.name));
  const now = Date.now();
  return { canManage: canManage(w), people, stats: {
    access: people.filter((p) => p.status === "always" || p.status === "granted").length, requests: people.filter((p) => p.status === "requested").length,
    online: people.filter((p) => p.lastUsedISO && now - Date.parse(p.lastUsedISO) < 5 * 60_000).length, revoked: people.filter((p) => p.status === "revoked").length } };
}

/** Commander actions: give · approve · deny · revoke · restore · bulk (all officers / staff NCOs). */
export async function changeAccess(w: Who, b: U) {
  if (!canManage(w)) throw new AccessError("Only the Commander can change Hub Access.", 403);
  const now = new Date().toISOString();
  const users = async (uids: string[]) => (await TerminalDoc.find({ _id: { $in: uids.map((u) => `users/${u}`) } }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U);
  if (b.action === "bulk") {
    const role = String(b.role ?? "");
    if (!["officer", "staff_nco", "nco", "recruiter"].includes(role)) throw new AccessError("Pick a role.");
    const list = (await TerminalDoc.find({ parent: "users", "data.role": role, "data.suspended": { $ne: true } }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U);
    let n = 0;
    for (const u of list) {
      const cur = (await TerminalDoc.findById(`hub_access/${u.id}`, { "data.status": 1 }).lean())?.data as U | undefined;
      if (cur?.status === "granted" || cur?.status === "revoked") continue; // never undo a revoke in bulk
      await setRec(u.id, { status: "granted", by: w.uid, byName: w.name, atISO: now, reason: "" });
      await alert(u.id, "🔑 You have Hub access", `${w.name} gave you access to the 505th Command Network app. Download it from the Terminal dashboard.`);
      n++;
    }
    await audit(w, "HUB ACCESS GIVEN", `${n} × ${role.replace("_", " ")} — via ${w.source}`);
    return { ok: true, msg: n ? `Access given to ${n}` : "Everyone with that role already has access (or was revoked)" };
  }
  const uid = String(b.uid ?? "");
  if (!ID.test(uid)) throw new AccessError("Bad request.");
  const [u] = await users([uid]);
  if (!u) throw new AccessError("Member not found.", 404);
  if (ALWAYS(u.role)) throw new AccessError("Commander and Developer always have access.");
  const nm = memberName(u);
  switch (b.action) {
    case "give": case "approve": case "restore":
      await setRec(uid, { status: "granted", by: w.uid, byName: w.name, atISO: now, reason: "" });
      await alert(uid, "🔑 You have Hub access", `${w.name} gave you access to the 505th Command Network app. Download it from the Terminal dashboard.`);
      await audit(w, b.action === "restore" ? "HUB ACCESS RESTORED" : "HUB ACCESS GIVEN", `${nm} — via ${w.source}`);
      return { ok: true, msg: `Access given to ${nm}` };
    case "deny": {
      const reason = String(b.reason ?? "").trim().slice(0, 300);
      await setRec(uid, { status: "denied", by: w.uid, byName: w.name, atISO: now, reason });
      await alert(uid, "✕ Hub access request declined", reason ? `Reason: ${reason}` : "Ask the Commander if you have questions.");
      await audit(w, "HUB ACCESS DENIED", `${nm}${reason ? ` — ${reason}` : ""} — via ${w.source}`);
      return { ok: true, msg: "Request declined" };
    }
    case "revoke": {
      const reason = String(b.reason ?? "").trim().slice(0, 300);
      if (reason.length < 3) throw new AccessError("Give a reason (it goes in the Audit Log).");
      await setRec(uid, { status: "revoked", by: w.uid, byName: w.name, atISO: now, reason });
      const n = await endSessions(uid, `hub access revoked: ${reason}`);
      await alert(uid, "⛔ Hub access revoked", `Reason: ${reason}`);
      await audit(w, "HUB ACCESS REVOKED", `${nm} — ${reason} — ${n} device(s) signed out — via ${w.source}`);
      return { ok: true, msg: `Access revoked · ${n} device${n === 1 ? "" : "s"} signed out` };
    }
    default: throw new AccessError("Unknown action.");
  }
}

/** Everyone in the Terminal: my download / request status. */
export async function myAccess(uid: string, role: string) {
  const r = (await TerminalDoc.findById(`hub_access/${uid}`, { data: 1 }).lean())?.data as U | undefined;
  const allowed = await hubAllowed(uid, role);
  // Release details only for people who may download it.
  const rel = allowed ? await latestRelease() : null;
  return { allowed, status: ALWAYS(role) ? "always" : r?.status || "none", requestAtISO: r?.requestAtISO || "", reason: r?.status === "denied" ? r.reason || "" : "",
    release: rel ? { version: rel.version, sizeMB: rel.sizeMB, sha256: rel.sha256, dateISO: rel.dateISO, notes: rel.notes, file: rel.file } : null };
}

export async function requestAccess(w: Who, note: unknown) {
  if (roleLevel(w.role) < 2) throw new AccessError("Hub access is for staff only.", 403);
  if (await hubAllowed(w.uid, w.role)) throw new AccessError("You already have access.");
  const cur = (await TerminalDoc.findById(`hub_access/${w.uid}`, { "data.status": 1 }).lean())?.data as U | undefined;
  if (cur?.status === "revoked") throw new AccessError("Your access was revoked. Speak to the Commander.", 403);
  if (cur?.status === "requested") throw new AccessError("Your request is already waiting.");
  const n = String(note ?? "").trim().slice(0, 300);
  await setRec(w.uid, { status: "requested", note: n, requestAtISO: new Date().toISOString() });
  const cmd = await TerminalDoc.find({ parent: "users", "data.role": "commander" }, { docId: 1 }).lean();
  for (const c of cmd) await alert(String(c.docId), "✋ Hub access request", `${w.name} asked for the Command Network app.${n ? ` “${n}”` : ""} Open Security → Hub Access.`);
  await audit(w, "HUB ACCESS REQUESTED", `${n || "no reason given"} — via ${w.source}`);
  return { ok: true, msg: "Request sent to the Commander" };
}
