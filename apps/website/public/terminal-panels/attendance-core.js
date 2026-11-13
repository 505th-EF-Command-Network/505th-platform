/**
 * Shared monthly attendance rules:
 *  - addPip: +1 ATT this month (max 3) · promotePT: +1 PT and ATT back to 0 (at 3/3)
 *  - snapshotMonth: saves a month to attendance_history (MISSED counts Operations only — per Drake, 2026-07-24)
 *  - Monthly reset: Cortana runs it at 00:00 on the 1st (apps/cortana/src/monthly-reset.ts).
 *    runReset here is the website backup (missed / early) — same rules and the same lock.
 *  - rebuildMonth / snapshotCurrentMonth / backfillHistory: Attendance History
 */
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "/terminal-shim/firestore.js";
import { ask, audit, db, memberName, notify } from "./_common.js";

const ym = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7); // UK month
const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); };
const nowISO = () => new Date().toISOString();
const counted = (u) => u.status !== "pending" && u.status !== "denied";
const present = (e, uid) => (e.attendees || []).includes(uid);
const META = () => doc(db, "settings", "roster_meta");
export { ym as ukMonth, shiftMonth };

async function lockedEvents() {
  const s = await getDocs(query(collection(db, "attendance_events"), where("locked", "==", true)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function allUsers() {
  return (await getDocs(collection(db, "users"))).docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPip(u) {
  const att = Math.min((u.attendance || 0) + 1, 3);
  await updateDoc(doc(db, "users", u.id), { attendance: att, updatedAt: nowISO() });
  u.attendance = att;
  await audit("battalion_ops", "ATTENDANCE PIP", `Manual +1 pip for ${memberName(u)} (now ${att}/3)`);
  notify(att >= 3 ? `${memberName(u)} — 3/3 ATTENDANCE — READY FOR PT` : `${memberName(u)} — ATTENDANCE: ${att}/3`);
}

export async function promotePT(u) {
  const pt = (u.promotionTracker || 0) + 1;
  await updateDoc(doc(db, "users", u.id), { promotionTracker: pt, attendance: 0, updatedAt: nowISO() });
  u.promotionTracker = pt;
  u.attendance = 0;
  await audit("battalion_ops", "PT AWARDED", `+1 PT for ${memberName(u)} (now ${pt} PT), attendance reset`);
  notify(`${memberName(u)} — PT +1 (NOW ${pt}) — ATTENDANCE RESET`);
}

export async function snapshotMonth(month, users, events, extra = {}) {
  const ev = events.filter((e) => e.locked && String(e.date || "").startsWith(month));
  const ops = ev.filter((e) => e.type === "main_op");
  const members = users
    .filter((u) => counted(u) && u.platoon !== "Reserves")
    .map((u) => {
      const attended = ev.filter((e) => (e.attendees || []).includes(u.id)).length;
      const eligible = ev.length;
      return {
        uid: u.id, name: memberName(u) || u.callsign || "Unknown", rank: u.rank || "—", platoon: u.platoon || "—", role: u.role || "—",
        attended, eligible, missed: ops.length - ops.filter((e) => (e.attendees || []).includes(u.id)).length,
        rate: eligible ? Math.round((attended / eligible) * 100) : 0, pip: u.attendance || 0,
      };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  await setDoc(doc(db, "attendance_history", month), { month, totalOps: ev.length, memberCount: members.length, snapshotAt: nowISO(), members, ...extra }, { merge: true });
}

/** Reset status for the Roster banner. */
export async function resetStatus() {
  const m = await getDoc(META());
  return { month: ym(), ...(m.exists() ? m.data() : {}) };
}

/**
 * Backup for Cortana's 00:00 reset — same rules as apps/cortana/src/monthly-reset.ts (keep in step).
 * month = the month being started (normally this month; "early" = next month).
 * Last month is saved → +1 PT for 3/3 → ATT = events already locked in the new month.
 */
export async function runReset(month, by, onProgress) {
  const meta = await resetStatus();
  if (meta.lastAttendanceReset && meta.lastAttendanceReset >= month) return notify("RESET ALREADY DONE FOR " + month, 1);
  if (meta.resetRunning && Date.now() - Date.parse(meta.resetRunning.startedAt) < 15 * 60000) return notify("A RESET IS ALREADY RUNNING (" + (meta.resetRunning.by || "?") + ")", 1);
  await setDoc(META(), { resetRunning: { month, by, startedAt: nowISO(), done: 0, total: 0 } }, { merge: true });
  try {
    const prev = shiftMonth(month, -1);
    const users = await allUsers(), events = await lockedEvents();
    await snapshotMonth(prev, users, events, { savedBy: by, savedReason: "monthly reset" });
    const prevEv = events.filter((e) => String(e.date || "").startsWith(prev));
    const curEv = events.filter((e) => String(e.date || "").startsWith(month));
    const list = users.filter(counted);
    let promoted = 0, done = 0;
    for (const u of list) {
      const prevCount = Math.min(3, prevEv.filter((e) => present(e, u.id)).length);
      const reached = curEv.length ? prevCount : Math.max(prevCount, u.attendance || 0);
      const att = Math.min(3, curEv.filter((e) => present(e, u.id)).length);
      const patch = { attendance: att, updatedAt: nowISO() };
      if (reached >= 3) { patch.promotionTracker = (u.promotionTracker || 0) + 1; promoted++; }
      if (reached >= 3 || (u.attendance || 0) !== att) await updateDoc(doc(db, "users", u.id), patch);
      if (++done % 5 === 0) { onProgress?.(done, list.length); await setDoc(META(), { resetRunning: { month, by, startedAt: nowISO(), done, total: list.length } }, { merge: true }); }
    }
    await setDoc(META(), { lastAttendanceReset: month, lastResetAt: nowISO(), lastResetBy: by, lastResetPromoted: promoted, lastResetSaved: prev, resetRunning: null }, { merge: true });
    await audit("battalion_ops", "MONTHLY RESET", `Reset for ${month} (backup, website) — ${promoted} given +1 PT, ${prev} saved to Attendance History`);
    notify(`RESET DONE — ${promoted} MEMBER(S) GOT +1 PT · ${prev} SAVED`);
    return { promoted, saved: prev };
  } catch (e) {
    await setDoc(META(), { resetRunning: null }, { merge: true }).catch(() => {});
    notify("RESET FAILED: " + e.message, 1);
  }
}

/** Re-save one month's history (after a late lock, or REBUILD). */
export async function rebuildMonth(month, why) {
  await snapshotMonth(month, await allUsers(), await lockedEvents(), why ? { lateUpdate: { at: nowISO(), ...why } } : { rebuiltAt: nowISO() });
}

export async function snapshotCurrentMonth() {
  try {
    await snapshotMonth(ym(), await allUsers(), await lockedEvents());
    notify("ATTENDANCE SNAPSHOT SAVED FOR " + ym());
  } catch (e) {
    notify("SNAPSHOT FAILED: " + e.message, 1);
  }
}

export async function backfillHistory() {
  if (!(await ask({ kind: "warn", title: "BACKFILL MISSING MONTHS?", body: "Builds a history record for every month that has locked events but no snapshot yet. Existing months are not changed.", go: "BACKFILL" }))) return;
  try {
    const events = await lockedEvents();
    if (!events.length) return notify("NO LOCKED EVENTS FOUND TO BACKFILL", 1);
    const have = new Set((await getDocs(collection(db, "attendance_history"))).docs.map((d) => d.id));
    const missing = [...new Set(events.filter((e) => e.date).map((e) => String(e.date).slice(0, 7)))].filter((m) => !have.has(m)).sort();
    if (!missing.length) return notify("ALL MONTHS ALREADY HAVE SNAPSHOTS — NOTHING TO BACKFILL");
    const users = await allUsers();
    for (const m of missing) await snapshotMonth(m, users, events);
    notify(`BACKFILL COMPLETE — ${missing.length} MONTH(S) SAVED`);
  } catch (e) {
    notify("BACKFILL FAILED: " + e.message, 1);
  }
}
