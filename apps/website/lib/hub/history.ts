import "server-only";
import { TerminalDoc } from "@505th/db";
import { memberName } from "@/lib/hub/members";

type U = Record<string, any>;
export const ukMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);
const counted = (u: U) => u.status !== "pending" && u.status !== "denied";

/** Locked attendance events + all users (fresh). */
export async function historySources() {
  const [ev, us] = await Promise.all([
    TerminalDoc.find({ parent: "attendance_events", "data.locked": true }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
  ]);
  return { events: ev.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U), users: us.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U) };
}

/** Same as attendance-core.js snapshotMonth: save one month's record to attendance_history/{YYYY-MM} (merged). */
export async function snapshotMonth(month: string, extra: U = {}, src?: { events: U[]; users: U[] }) {
  const { events, users } = src ?? (await historySources());
  const ev = events.filter((e) => e.locked && String(e.date || "").startsWith(month));
  const ops = ev.filter((e) => e.type === "main_op");
  const members = users
    .filter((u) => counted(u) && u.platoon !== "Reserves")
    .map((u) => {
      const attended = ev.filter((e) => (e.attendees || []).includes(u.id)).length;
      return { uid: u.id, name: memberName(u) || u.callsign || "Unknown", rank: u.rank || "—", platoon: u.platoon || "—", role: u.role || "—", attended, eligible: ev.length,
        missed: ops.length - ops.filter((e) => (e.attendees || []).includes(u.id)).length, rate: ev.length ? Math.round((attended / ev.length) * 100) : 0, pip: u.attendance || 0 };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const now = new Date();
  const old = await TerminalDoc.findById(`attendance_history/${month}`, { data: 1 }).lean();
  const data = { ...((old?.data ?? {}) as U), month, totalOps: ev.length, memberCount: members.length, snapshotAt: now.toISOString(), members, ...extra };
  await TerminalDoc.updateOne({ _id: `attendance_history/${month}` }, { $set: { parent: "attendance_history", docId: month, updateTime: now, data }, $setOnInsert: { createTime: now } }, { upsert: true });
}
