/**
 * Officer Management v2: TIME-LIMITED ACCESS. Every 5 minutes, access given "until a date" (users.data.accessUntil)
 * that has passed is removed (back to the role default), written to the Change Log, and the member gets a 🔔 alert.
 */
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { autoId } from "./util.ts";

type U = Record<string, any>;
const LABEL: Record<string, string> = { bct: "BCT Approvals", pers: "Personnel Files", roster: "Roster", oob: "Order of Battle", rstat: "Recruit Stats", promote: "Promote", att: "Attendance",
  lock: "Lock Attendance", aar: "AAR", media: "Gallery / Videos", tk: "Tickets", tkrep: "Report Tickets", ev: "Events", send: "Send Message", qu: "Quick Upload", info: "Info Posts",
  modw: "Warn / Timeout", modk: "Kick / Ban", proj: "Projects", notes: "Notes", web: "Website", om: "Officer Management", net: "Network + Restart", audit: "Audit Log" };

async function tick() {
  const now = new Date();
  const docs = (await TerminalDoc.find({ parent: "users", "data.accessUntil": { $exists: true, $ne: {} } }, { docId: 1, "data.accessUntil": 1, "data.access": 1, "data.callsign": 1, "data.lastName": 1 }).lean()) as U[];
  for (const d of docs) {
    const until = (d.data?.accessUntil ?? {}) as Record<string, string>;
    const gone = Object.entries(until).filter(([, iso]) => Date.parse(iso) <= now.getTime()).map(([k]) => k);
    if (!gone.length) continue;
    const unset: Record<string, 1> = {};
    for (const k of gone) { unset[`data.access.${k}`] = 1; unset[`data.accessUntil.${k}`] = 1; }
    await TerminalDoc.updateOne({ _id: d._id }, { $unset: unset, $set: { updateTime: now } });
    const labels = gone.map((k) => `−${LABEL[k] ?? k}`);
    const lid = autoId();
    await TerminalDoc.create({ _id: `access_log/${lid}`, parent: "access_log", docId: lid, createTime: now, updateTime: now,
      data: { atISO: now.toISOString(), byUid: "cortana", byName: "Cortana", targetUid: String(d.docId), targetName: String(d.data?.callsign || d.data?.lastName || d.docId), changes: labels,
        reason: "Time-limited access ended", prev: d.data?.access ?? {}, prevUntil: until, undone: false } }).catch(() => {});
    const nid = autoId();
    await TerminalDoc.create({ _id: `notifications/${d.docId}/items/${nid}`, parent: `notifications/${d.docId}/items`, docId: nid, createTime: now, updateTime: now,
      data: { type: "access", read: false, title: "🔑 Your access changed", body: `${labels.join(", ")} — time-limited access ended`, createdAt: now } }).catch(() => {});
    log.info(`Access ended for ${d.docId}: ${gone.join(", ")}`);
  }
}

export function startAccessExpiry() {
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await tick(); } catch (e) { log.warn(`Access expiry: ${(e as Error).message}`); } finally { busy = false; } };
  void run();
  setInterval(() => void run(), 5 * 60_000);
}
