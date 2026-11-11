import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";
import { syncMember } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const TYPES = new Set(["main_op", "patrol", "training", "fun_op"]);
const ONLINE_MS = 3 * 60_000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const ukMonth = () => ukToday().slice(0, 7);
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const counted = (u: U) => u.status !== "pending" && u.status !== "denied";
const goingKeys = (c: U) => new Set<string>((c?.buttons || []).filter((b: U) => b.attending).map((b: U) => b.key));
const goingUids = (c: U) => (c?.signups || []).filter((s: U) => s.uid && !s.waiting && goingKeys(c).has(s.choice)).map((s: U) => String(s.uid));

async function users() {
  return (await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U);
}
async function events() {
  return (await TerminalDoc.find({ parent: "attendance_events" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U);
}

/** Same as the Terminal's recalcAllStats: recount every member from all locked events. */
async function recalcAllStats() {
  const locked = (await events()).filter((e) => e.locked === true);
  const month = locked.filter((e) => String(e.date || "").startsWith(ukMonth()));
  const now = new Date(), nowISO = now.toISOString();
  for (const u of (await users()).filter((x) => counted(x) && x.platoon !== "Reserves")) {
    let opsAttended = 0, lastAttendedDate: string | null = null;
    for (const e of locked) if ((e.attendees || []).includes(u.id)) { opsAttended++; if (!lastAttendedDate || e.date > lastAttendedDate) lastAttendedDate = e.date; }
    const attendance = Math.min(month.filter((e) => (e.attendees || []).includes(u.id)).length, 3);
    if (u.opsAttended === opsAttended && u.opsEligible === locked.length && u.attendance === attendance && (u.lastAttendedDate ?? null) === lastAttendedDate) continue;
    await TerminalDoc.updateOne({ _id: `users/${u.id}` }, { $set: { "data.opsAttended": opsAttended, "data.opsEligible": locked.length, "data.attendance": attendance, "data.lastAttendedDate": lastAttendedDate, "data.updatedAt": nowISO, updateTime: now } });
    await syncMember(u.id, false).catch(() => {});
  }
}

/** Same as attendance-core.js snapshotMonth / rebuildMonth: an earlier month changed → re-save its History record. */
async function historyCatchUp(e: U, by: string, action: string) {
  const m = String(e?.date || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m) || m >= ukMonth()) return;
  const ev = (await events()).filter((x) => x.locked && String(x.date || "").startsWith(m));
  const ops = ev.filter((x) => x.type === "main_op");
  const members = (await users())
    .filter((u) => counted(u) && u.platoon !== "Reserves")
    .map((u) => {
      const attended = ev.filter((x) => (x.attendees || []).includes(u.id)).length;
      return { uid: u.id, name: memberName(u) || u.callsign || "Unknown", rank: u.rank || "—", platoon: u.platoon || "—", role: u.role || "—", attended, eligible: ev.length,
        missed: ops.length - ops.filter((x) => (x.attendees || []).includes(u.id)).length, rate: ev.length ? Math.round((attended / ev.length) * 100) : 0, pip: u.attendance || 0 };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const now = new Date();
  const data = { month: m, totalOps: ev.length, memberCount: members.length, snapshotAt: now.toISOString(), members, lateUpdate: { at: now.toISOString(), by, title: e.title || "—", action } };
  const old = await TerminalDoc.findById(`attendance_history/${m}`, { data: 1 }).lean();
  await TerminalDoc.updateOne({ _id: `attendance_history/${m}` }, { $set: { parent: "attendance_history", docId: m, updateTime: now, data: { ...((old?.data ?? {}) as U), ...data } }, $setOnInsert: { createTime: now } }, { upsert: true });
}

/** GET /api/hub/attendance → Attendance Tracker (events, roll, linked Discord sign-ups, online now). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "att")) return hubJson({ error: "You don't have Attendance access." }, 403);
  const [us, evs, comm, pres] = await Promise.all([users(), events(), TerminalDoc.find({ parent: "community_events" }, { docId: 1, data: 1 }).lean(), TerminalDoc.find({ parent: "presence_sessions" }, { data: 1 }).lean()]);
  const now = Date.now();
  const online = [...new Set(pres.map((p) => (p.data ?? {}) as U).filter((d) => now - Date.parse(d.updatedAt || 0) < ONLINE_MS).map((d) => String(d.uid)))];
  const roll = us.filter((u) => counted(u) && u.platoon !== "Reserves" && u.role !== "retired_veteran").map((u) => ({
    id: u.id, firstName: u.firstName || "", lastName: u.lastName || "", callsign: u.callsign || "", rank: u.rank || "", platoon: u.platoon || "", squad: u.squad || "",
    opsAttended: Number(u.opsAttended) || 0, opsEligible: Number(u.opsEligible) || 0, attendance: Number(u.attendance) || 0,
  }));
  const cs = comm.map((c) => ({ id: c.docId, ...((c.data ?? {}) as U) }) as U);
  const linkOf = (id: string) => cs.find((c) => c.attendanceEventId === id);
  const list = evs.map((e) => {
    const c = linkOf(e.id);
    const keys = c ? goingKeys(c) : new Set<string>();
    return {
      id: e.id, title: e.title || "Untitled", date: String(e.date || "").slice(0, 10), type: e.type || "main_op", locked: e.locked === true, lockedBy: e.lockedBy || "", createdBy: e.createdBy || "",
      attendees: (e.attendees || []).map(String), excused: (e.excused || []).map(String), excusedReasons: e.excusedReasons || {},
      linked: c ? { signups: (c.signups || []).filter((s: U) => s.uid).map((s: U) => { const b = (c.buttons || []).find((x: U) => x.key === s.choice); return { uid: String(s.uid), label: `${b?.emoji || ""} ${b?.label || s.choice}`.trim(), going: keys.has(s.choice) && !s.waiting, waiting: !!s.waiting }; }) } : null,
    };
  }).sort((x, y) => y.date.localeCompare(x.date));
  const avail = cs.filter((c) => c.status !== "cancelled" && !evs.some((e) => e.id === c.attendanceEventId) && Date.parse(c.startAtISO) > now - 7 * 864e5)
    .sort((x, y) => String(x.startAtISO).localeCompare(String(y.startAtISO)))
    .map((c) => ({ id: c.id, title: c.title || "Untitled", startAtISO: c.startAtISO || "", date: String(c.date || String(c.startAtISO || "").slice(0, 10)), type: c.attType || c.opType || "main_op", going: goingUids(c).length }));
  return hubJson({ events: list, roll, online, discord: avail, canEdit: true, canLock: can(a.role, a.access, "lock") });
}

/**
 * POST /api/hub/attendance — same actions and rules as the Terminal tracker:
 * set (✓ / E / – while unlocked) · reason · tickgoing · clear · edit (title/date/type) · create · lock / unlock (Lock access) · delete (unlocked only).
 * Lock and delete recount everyone's stats; a change to an earlier month updates Attendance History.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "att")) return hubJson({ error: "You don't have Attendance access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const by = a.displayName;
  const now = new Date(), nowISO = now.toISOString();

  if (b.action === "create") {
    const title = String(b.title ?? "").trim().slice(0, 120), date = String(b.date ?? ""), type = String(b.type ?? "main_op");
    if (!title) return hubJson({ error: "Enter an operation / event name." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return hubJson({ error: "Date required." }, 400);
    if (!TYPES.has(type)) return hubJson({ error: "Pick a type." }, 400);
    if ((await events()).some((e) => e.title === title && e.date === date)) return hubJson({ error: "An event with this name and date already exists." }, 400);
    let attendees: string[] = [], ce: U | null = null;
    if (b.ce) {
      if (!ID.test(String(b.ce))) return hubJson({ error: "Invalid Discord event." }, 400);
      const d = await TerminalDoc.findById(`community_events/${b.ce}`, { data: 1 }).lean();
      ce = d ? ((d.data ?? {}) as U) : null;
      if (!ce) return hubJson({ error: "Discord event not found." }, 404);
      if (ce.attendanceEventId) return hubJson({ error: "That Discord event already has an attendance sheet." }, 409);
      if (b.tickGoing !== false) { const ids = new Set((await users()).map((u) => u.id)); attendees = goingUids(ce).filter((u: string) => ids.has(u)); }
    }
    const id = autoId();
    await TerminalDoc.create({ _id: `attendance_events/${id}`, parent: "attendance_events", docId: id, createTime: now, updateTime: now,
      data: { title, date, type, attendees, excused: [], excusedReasons: {}, locked: false, createdBy: by, createdAt: nowISO, updatedBy: by, updatedAt: nowISO } });
    if (ce) await TerminalDoc.updateOne({ _id: `community_events/${b.ce}` }, { $set: { "data.attendanceEventId": id, updateTime: now } });
    await hubAudit(who, "EVENT CREATED", `${title} (${date}) — Type: ${type}${ce ? " — from Discord event, " + attendees.length + " pre-ticked" : ""} — via app`);
    return hubJson({ ok: true, id, msg: "Event created — " + title });
  }

  const eid = String(b.id ?? "");
  if (!ID.test(eid)) return hubJson({ error: "Invalid event." }, 400);
  const doc = await TerminalDoc.findById(`attendance_events/${eid}`, { data: 1 }).lean();
  if (!doc) return hubJson({ error: "Event not found." }, 404);
  const e = { id: eid, ...((doc.data ?? {}) as U) } as U;
  const save = (patch: U) => TerminalDoc.updateOne({ _id: `attendance_events/${eid}` }, { $set: { ...Object.fromEntries(Object.entries({ ...patch, updatedBy: by, updatedAt: nowISO }).map(([k, v]) => [`data.${k}`, v])), updateTime: now } });

  if (b.action === "lock" || b.action === "unlock") {
    if (!can(a.role, a.access, "lock")) return hubJson({ error: "Lock / unlock: Staff NCO and above." }, 403);
    if (b.action === "lock") {
      if (e.locked) return hubJson({ error: "Already locked." }, 400);
      await save({ locked: true, lockedBy: by, lockedAt: nowISO });
      await recalcAllStats();
      const p = (e.attendees || []).length;
      await hubAudit(who, "EVENT LOCKED", `${e.title} (${e.date}) — ${p} present, ${(e.excused || []).length} excused, stats recalculated — via app`);
      await historyCatchUp(e, by, "locked late");
      return hubJson({ ok: true, msg: `Event locked — ${p} present — stats recalculated` });
    }
    if (!e.locked) return hubJson({ error: "Not locked." }, 400);
    await save({ locked: false, unlockedBy: by, unlockedAt: nowISO });
    await hubAudit(who, "EVENT UNLOCKED", `${e.title || "—"} (${e.date || "—"}) unlocked for corrections — via app`);
    await historyCatchUp(e, by, "unlocked");
    return hubJson({ ok: true, msg: "Event unlocked — make corrections then lock again" });
  }
  if (e.locked) return hubJson({ error: "Event is locked — unlock to correct." }, 409);

  switch (b.action) {
    case "set": {
      const uid = String(b.uid ?? ""), st = String(b.state ?? "");
      if (!ID.test(uid) || !["p", "e", "a"].includes(st)) return hubJson({ error: "Invalid." }, 400);
      const att = new Set<string>(e.attendees || []), exc = new Set<string>(e.excused || []);
      att.delete(uid); exc.delete(uid);
      if (st === "p") att.add(uid); else if (st === "e") exc.add(uid);
      const reasons = { ...(e.excusedReasons || {}) };
      if (st !== "e") delete reasons[uid];
      await save({ attendees: [...att], excused: [...exc], excusedReasons: reasons });
      return hubJson({ ok: true });
    }
    case "reason": {
      const uid = String(b.uid ?? "");
      if (!ID.test(uid) || !(e.excused || []).includes(uid)) return hubJson({ error: "Invalid." }, 400);
      await save({ excusedReasons: { ...(e.excusedReasons || {}), [uid]: String(b.reason ?? "").trim().slice(0, 60) } });
      return hubJson({ ok: true });
    }
    case "tickgoing": {
      const c = (await TerminalDoc.find({ parent: "community_events", "data.attendanceEventId": eid }, { data: 1 }).lean())[0];
      if (!c) return hubJson({ error: "Not linked to a Discord event." }, 400);
      const ids = new Set((await users()).map((u) => u.id));
      const g = goingUids((c.data ?? {}) as U).filter((u: string) => ids.has(u));
      const exc = (e.excused || []).filter((u: string) => !g.includes(u));
      await save({ attendees: [...new Set([...(e.attendees || []), ...g])], excused: exc });
      return hubJson({ ok: true, msg: `${g.length} signed up ticked present` });
    }
    case "clear":
      await save({ attendees: [], excused: [], excusedReasons: {} });
      return hubJson({ ok: true, msg: "Cleared" });
    case "edit": {
      const title = String(b.title ?? "").trim().slice(0, 120), date = String(b.date ?? ""), type = String(b.type ?? "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !TYPES.has(type)) return hubJson({ error: "Title, date and type are required." }, 400);
      await save({ title, date, type });
      await hubAudit(who, "EVENT EDITED", `${e.title} → ${title} (${date}) — Type: ${type} — via app`);
      return hubJson({ ok: true, msg: "Event saved" });
    }
    case "delete": {
      await TerminalDoc.deleteOne({ _id: `attendance_events/${eid}` });
      await TerminalDoc.updateMany({ parent: "community_events", "data.attendanceEventId": eid }, { $set: { "data.attendanceEventId": null, updateTime: now } });
      await recalcAllStats();
      await hubAudit(who, "EVENT DELETED", `${e.title || "—"} (${e.date || "—"}) — via app`);
      return hubJson({ ok: true, msg: "Event deleted — stats recalculated" });
    }
  }
  return hubJson({ error: "Unknown action." }, 400);
}
