/**
 * Monthly attendance reset — runs at 00:00 on the 1st (UK time). Checked every minute, so
 * if Cortana was offline at midnight it runs as soon as it is back.
 *
 * Same rules as the website (public/terminal-panels/attendance-core.js — keep the two in step):
 *  1. Save last month to attendance_history/<YYYY-MM> (MISSED counts Main Ops only — per Drake, 2026-07-24).
 *  2. +1 PT for everyone who reached 3/3 last month.
 *  3. ATT this month = events already locked this month (normally 0).
 * settings/roster_meta.lastAttendanceReset = "YYYY-MM" stops it running twice (website backup uses the same lock).
 */
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { auditLog } from "./util.ts";

const META = "settings/roster_meta";
const STALE_MS = 15 * 60_000;
export const RANK_ABBR: Record<string, string> = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen", "O6 / Colonel": "Col", "O5 / Lieutenant Colonel": "LtCol",
  "O4 / Major": "Maj", "O3 / Captain": "Capt", "O2 / First Lieutenant": "1stLt", "O1 / Second Lieutenant": "2ndLt", "E9 / Sergeant Major": "SgtMaj",
  "E9 / Master Gunnery Sergeant": "MGySgt", "E9 / First Sergeant": "1stSgt", "E8 / Master Sergeant": "MSgt", "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt",
  "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl", "E3 / Lance Corporal": "LCpl", "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO", "E7 / Chief Corpsman": "CPO", "E6 / Corpsman First Class": "HM1",
  "E5 / Corpsman Second Class": "HM2", "E4 / Corpsman Third Class": "HM3", "E3 / Hospitalman": "HM", "E2 / Hospitalman Apprentice": "HA",
  "E6 / Technical Sergeant": "TSgt", "E5 / Staff Sergeant": "SSgt", "E4 / Senior Airman": "SrA", "E3 / Airman First Class": "A1C", "E2 / Airman": "Amn", "E1 / Airman Basic": "AB", Reservist: "Res",
};
type U = Record<string, any> & { id: string };
type Ev = Record<string, any> & { id: string };

const ukMonth = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}
function memberName(u: U) {
  const first = String(u.firstName || "").trim(), last = String(u.lastName || "").trim(), cs = String(u.callsign || "").trim();
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : last || (cs ? `"${cs}"` : "")}`.trim();
  const r = String(u.rank || "");
  return [RANK_ABBR[r] || (r ? r.split("/").pop()!.trim() : ""), name].filter(Boolean).join(" ") || "Unknown";
}
const counted = (u: U) => u.status !== "pending" && u.status !== "denied";
const present = (e: Ev, uid: string) => Array.isArray(e.attendees) && e.attendees.includes(uid);

export async function snapshotMonth(month: string, users: U[], events: Ev[], extra: Record<string, unknown> = {}) {
  const ev = events.filter((e) => String(e.date || "").startsWith(month));
  const ops = ev.filter((e) => e.type === "main_op");
  const members = users
    .filter((u) => counted(u) && u.platoon !== "Reserves")
    .map((u) => {
      const attended = ev.filter((e) => present(e, u.id)).length;
      return { uid: u.id, name: memberName(u), rank: u.rank || "—", platoon: u.platoon || "—", role: u.role || "—", attended, eligible: ev.length,
        missed: ops.length - ops.filter((e) => present(e, u.id)).length, rate: ev.length ? Math.round((attended / ev.length) * 100) : 0, pip: u.attendance || 0 };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const now = new Date();
  await TerminalDoc.updateOne(
    { _id: `attendance_history/${month}` },
    { $set: { parent: "attendance_history", docId: month, updateTime: now, "data.month": month, "data.totalOps": ev.length, "data.memberCount": members.length, "data.snapshotAt": now.toISOString(), "data.members": members, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`data.${k}`, v])) }, $setOnInsert: { createTime: now } },
    { upsert: true },
  );
}

/** Runs the reset for `month` (the new month). Returns null if another run holds the lock or it is already done. */
export async function runMonthlyReset(month: string, by: string) {
  const now = Date.now();
  const claim = await TerminalDoc.findOneAndUpdate(
    { _id: META, "data.lastAttendanceReset": { $ne: month }, $or: [{ "data.resetRunning": null }, { "data.resetRunning.startedAt": { $lt: new Date(now - STALE_MS).toISOString() } }] },
    { $set: { parent: "settings", docId: "roster_meta", updateTime: new Date(), "data.resetRunning": { month, by, startedAt: new Date(now).toISOString(), done: 0, total: 0 } } },
    { upsert: false, new: true },
  ).lean().catch(() => null);
  if (!claim) {
    // First ever run: create the doc, then try once more.
    if (!(await TerminalDoc.exists({ _id: META }))) {
      await TerminalDoc.create({ _id: META, parent: "settings", docId: "roster_meta", createTime: new Date(), updateTime: new Date(), data: {} }).catch(() => {});
      return runMonthlyReset(month, by);
    }
    return null;
  }
  try {
    const prev = prevMonth(month);
    const users = (await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean()).map((d) => ({ ...(d.data as object), id: d.docId as string }) as U);
    const events = (await TerminalDoc.find({ parent: "attendance_events", "data.locked": true }, { docId: 1, data: 1 }).lean()).map((d) => ({ ...(d.data as object), id: d.docId as string }) as Ev);
    await snapshotMonth(prev, users, events, { savedBy: by, savedReason: "monthly reset" });
    const prevEv = events.filter((e) => String(e.date || "").startsWith(prev));
    const curEv = events.filter((e) => String(e.date || "").startsWith(month));
    const list = users.filter(counted);
    let promoted = 0, done = 0;
    for (const u of list) {
      const prevCount = Math.min(3, prevEv.filter((e) => present(e, u.id)).length);
      // Manual pips only count when nothing is locked in the new month yet (otherwise the pip already holds new-month counts).
      const reached = curEv.length ? prevCount : Math.max(prevCount, Number(u.attendance || 0));
      const newAtt = Math.min(3, curEv.filter((e) => present(e, u.id)).length);
      const $set: Record<string, unknown> = { "data.attendance": newAtt, "data.updatedAt": new Date().toISOString(), updateTime: new Date() };
      if (reached >= 3) { $set["data.promotionTracker"] = Number(u.promotionTracker || 0) + 1; promoted++; }
      if (reached >= 3 || Number(u.attendance || 0) !== newAtt) await TerminalDoc.updateOne({ _id: `users/${u.id}` }, { $set });
      if (++done % 5 === 0) await TerminalDoc.updateOne({ _id: META }, { $set: { "data.resetRunning.done": done, "data.resetRunning.total": list.length } });
    }
    await TerminalDoc.updateOne({ _id: META }, {
      $set: { updateTime: new Date(), "data.lastAttendanceReset": month, "data.lastResetAt": new Date().toISOString(), "data.lastResetBy": by, "data.lastResetPromoted": promoted, "data.lastResetSaved": prev },
      $unset: { "data.resetRunning": "" },
    });
    await auditLog("MONTHLY RESET", `Reset for ${month} — ${promoted} given +1 PT, ${prev} saved to Attendance History`, by, "battalion_ops");
    log.info(`Monthly reset ${month}: ${promoted} promoted`);
    return { promoted, saved: prev };
  } catch (e) {
    await TerminalDoc.updateOne({ _id: META }, { $unset: { "data.resetRunning": "" } }).catch(() => {});
    throw e;
  }
}

export function startMonthlyReset() {
  const tick = async () => {
    const m = ukMonth();
    const meta = (await TerminalDoc.findById(META, { data: 1 }).lean().catch(() => null))?.data as Record<string, any> | undefined;
    if (meta?.lastAttendanceReset && meta.lastAttendanceReset >= m) return;
    await runMonthlyReset(m, "Cortana").catch((e) => log.error("Monthly reset failed", e));
  };
  setTimeout(() => void tick(), 30_000);
  const t = setInterval(() => void tick(), 60_000);
  return () => clearInterval(t);
}
