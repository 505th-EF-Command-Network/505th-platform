import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { syncMember } from "@/lib/terminal/fs";
import { memberName } from "@/lib/hub/members";

/**
 * COMMAND CENTRE → SUSPENSIONS (approved mock 19 Nov) — shared by the Hub (/api/hub/suspensions) and the website (/api/terminal/suspensions).
 * Suspended = users.suspended true (optionally suspendedUntil) → Member status SUSPENDED → signed out of the website, Hub refused.
 * Every suspension is also a record in suspensions/<id> (history). Cortana ends timed ones by itself (suspensions.ts) and
 * does the optional Discord timeout + DM (job suspend.discord, re-checks access).
 * Access: Commander / Developer, or the "Suspensions" grant (cmd_suspend). Nobody can suspend the Commander, themselves,
 * or someone at their own role level or higher (Commander excepted).
 */
type U = Record<string, any>;
export type SuActor = { uid: string; role: string; access: unknown; displayName: string; source: "hub" | "terminal" };
export class SuError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const LEVEL: Record<string, number> = { enlistee: 0, marine: 1, recruiter: 2, nco: 3, staff_nco: 4, officer: 5, developer: 6, commander: 7, retired_veteran: 0 };
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const STAFF = ["commander", "officer", "developer", "staff_nco", "nco"];
const mk = (parent: string, data: U) => { const id = id20(), now = new Date(); return { _id: `${parent}/${id}`, parent, docId: id, createTime: now, updateTime: now, data }; };
const need = (a: SuActor) => { if (!(a.role === "commander" || a.role === "developer" || can(a.role, a.access, "cmd_suspend"))) throw new SuError("You don't have access to Suspensions.", 403); };
const canTarget = (a: SuActor, t: U) => t.role !== "commander" && (a.role === "commander" || (LEVEL[a.role] ?? 0) > (LEVEL[t.role] ?? 0));
async function audit(a: SuActor, action: string, details: string) {
  await TerminalDoc.create(mk("audit_logs", { section: "command", action, details, uid: a.uid, by: a.displayName, role: a.role, source: a.source, createdAt: new Date(), createdAtISO: new Date().toISOString() })).catch(() => {});
}
const note = (uid: string, type: string, title: string, body: string) => TerminalDoc.create(mk(`notifications/${uid}/items`, { type, read: false, title, body, createdAt: new Date() })).catch(() => {});
async function job(a: SuActor, payload: U) {
  const now = new Date();
  await TerminalDoc.create(mk("bot_jobs", { type: "suspend.discord", payload, status: "pending", attempts: 0, requestedBy: a.uid, createdAtISO: now.toISOString() }));
}

export async function suList(a: SuActor) {
  need(a);
  const [users, hist] = await Promise.all([
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "suspensions" }, { docId: 1, data: 1 }).sort({ "data.atISO": -1 }).limit(200).lean(),
  ]);
  const all = (users as U[]).map((u) => ({ id: String(u.docId), d: (u.data ?? {}) as U }));
  const recs = (hist as U[]).map((h): U => ({ id: String(h.docId), ...((h.data ?? {}) as U) }));
  const open = new Map(recs.filter((r) => !r.endedAtISO).map((r) => [String(r.uid), r]));
  const active = all.filter((x) => x.d.suspended === true).map((x) => {
    const r = open.get(x.id);
    return { uid: x.id, name: memberName(x.d), role: String(x.d.role ?? ""), platoon: String(x.d.platoon ?? ""), reason: String(x.d.suspendReason ?? r?.reason ?? ""),
      by: String(x.d.suspendedByName ?? r?.by ?? ""), atISO: String(x.d.suspendedAtISO ?? r?.atISO ?? ""), untilISO: x.d.suspendedUntil ?? null, discord: r?.discord ?? false };
  }).sort((p, q) => String(p.untilISO ?? "9").localeCompare(String(q.untilISO ?? "9")));
  const since = Date.now() - 90 * 864e5;
  const past = recs.filter((r) => r.endedAtISO && Date.parse(r.endedAtISO) > since).slice(0, 30)
    .map((r) => ({ id: r.id, name: String(r.name ?? ""), reason: String(r.reason ?? ""), days: r.days ?? null, atISO: r.atISO, endedAtISO: r.endedAtISO, endedBy: String(r.endedBy ?? ""), how: String(r.how ?? "") }));
  const members = all.filter((x) => x.d.suspended !== true && !["pending", "denied"].includes(x.d.status) && x.id !== a.uid && canTarget(a, x.d) && x.d.role !== "retired_veteran")
    .map((x) => ({ uid: x.id, name: memberName(x.d), role: String(x.d.role ?? ""), linked: /^\d{17,20}$/.test(String(x.d.discordId ?? "")) })).sort((p, q) => p.name.localeCompare(q.name));
  return { active, past, members, pastCount: past.length };
}

export async function suAct(a: SuActor, b: U) {
  need(a);
  const uid = String(b.uid ?? "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) throw new SuError("Pick a member.");
  const t = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as U | undefined;
  if (!t) throw new SuError("Member not found.", 404);
  const name = memberName(t), nowISO = new Date().toISOString();
  const discordId = /^\d{17,20}$/.test(String(t.discordId ?? "")) ? String(t.discordId) : "";

  if (b.action === "suspend") {
    if (uid === a.uid) throw new SuError("You can't suspend yourself.", 403);
    if (!canTarget(a, t)) throw new SuError("You can't suspend someone at your level or higher.", 403);
    if (t.suspended === true) throw new SuError("They are already suspended.");
    const reason = String(b.reason ?? "").trim().slice(0, 400);
    if (reason.length < 3) throw new SuError("A reason is required — they see it.");
    const days = [1, 3, 7, 30].includes(Number(b.days)) ? Number(b.days) : 0;
    const untilISO = days ? new Date(Date.now() + days * 864e5).toISOString() : null;
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.suspended": true, "data.suspendReason": reason, "data.suspendedUntil": untilISO, "data.suspendedAtISO": nowISO, "data.suspendedBy": a.uid, "data.suspendedByName": a.displayName, updateTime: new Date() } });
    await syncMember(uid, false).catch(() => {});
    const discord = !!b.discord && !!discordId;
    await TerminalDoc.create(mk("suspensions", { uid, name, reason, days: days || null, untilISO, by: a.displayName, byUid: a.uid, atISO: nowISO, discord }));
    await audit(a, "ACCOUNT SUSPEND", `${name} — ${days ? `${days} day${days === 1 ? "" : "s"}` : "until restored"} — ${reason}`);
    await note(uid, "warning", "Your account has been suspended", reason);
    if (discordId && (discord || b.dm !== false)) await job(a, { action: "timeout", discordId, minutes: discord ? Math.min(days || 28, 28) * 1440 : 0, reason, days, dm: b.dm !== false });
    const staff = await TerminalDoc.find({ parent: "users", "data.role": { $in: STAFF }, "data.suspended": { $ne: true } }, { docId: 1 }).lean();
    await Promise.all(staff.filter((s) => s.docId !== a.uid).map((s) => note(String(s.docId), "warning", "ACCOUNT SUSPENDED", `${name} has been suspended by ${a.displayName}.`)));
    return { ok: true, msg: `${name} suspended — signed out everywhere` };
  }

  if (b.action === "restore" || b.action === "extend") {
    if (t.suspended !== true) throw new SuError("They are not suspended.");
    const rec = await TerminalDoc.findOne({ parent: "suspensions", "data.uid": uid, "data.endedAtISO": { $exists: false } }, { docId: 1, data: 1 }).sort({ "data.atISO": -1 }).lean();
    if (b.action === "extend") {
      const add = [1, 3, 7, 30].includes(Number(b.days)) ? Number(b.days) : 0;
      const from = t.suspendedUntil && Date.parse(t.suspendedUntil) > Date.now() ? Date.parse(t.suspendedUntil) : Date.now();
      const untilISO = add ? new Date(from + add * 864e5).toISOString() : null;
      await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.suspendedUntil": untilISO, updateTime: new Date() } });
      if (rec) await TerminalDoc.updateOne({ _id: rec._id }, { $set: { "data.untilISO": untilISO, "data.extendedBy": a.displayName, updateTime: new Date() } });
      await audit(a, "SUSPENSION EXTENDED", `${name} — ${untilISO ? `now ends ${untilISO.slice(0, 10)}` : "now until restored"}`);
      if ((rec?.data as U | undefined)?.discord && discordId) await job(a, { action: "timeout", discordId, minutes: Math.min(Math.ceil(((untilISO ? Date.parse(untilISO) : Date.now() + 28 * 864e5) - Date.now()) / 60000), 28 * 1440), reason: String(t.suspendReason ?? ""), dm: false });
      return { ok: true, msg: untilISO ? "Suspension extended" : "Now suspended until restored" };
    }
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.suspended": false, "data.restoredAtISO": nowISO, "data.restoredBy": a.displayName, updateTime: new Date() } });
    await syncMember(uid, false).catch(() => {});
    if (rec) await TerminalDoc.updateOne({ _id: rec._id }, { $set: { "data.endedAtISO": nowISO, "data.endedBy": a.displayName, "data.how": "restored early", updateTime: new Date() } });
    await audit(a, "ACCOUNT REINSTATE", name);
    await note(uid, "info", "Your account has been restored", "You can sign in again.");
    if ((rec?.data as U | undefined)?.discord && discordId) await job(a, { action: "lift", discordId, reason: "Suspension ended" });
    return { ok: true, msg: `${name} restored` };
  }
  throw new SuError("Bad request.");
}
