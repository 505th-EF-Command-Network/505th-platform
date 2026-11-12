/**
 * Notes v2 reminders: every minute, find personal reminders that are due (notes/*.data.mine.<uid>.rem) and send a
 * 🔔 alert (+ Hub pop-up) to that person. Repeats move to the next day / week; one-off reminders are marked sent.
 */
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { autoId } from "./util.ts";

type Rem = { atISO: string; repeat?: string; sentISO?: string };

async function tick() {
  const now = Date.now();
  const docs = await TerminalDoc.find({ parent: "notes", "data.mine": { $exists: true } }, { docId: 1, "data.title": 1, "data.mine": 1 }).lean();
  for (const d of docs) {
    const data = ((d as { data?: unknown }).data ?? {}) as { title?: string; mine?: Record<string, { rem?: Rem }> };
    for (const [uid, m] of Object.entries(data.mine ?? {})) {
      const r = m?.rem;
      if (!r?.atISO || r.sentISO) continue;
      const at = Date.parse(r.atISO);
      if (!at || at > now) continue;
      // Too old (Cortana was off for days): one-off → mark sent without alerting; repeats catch up to the next future time.
      const stale = now - at > 6 * 3600_000;
      if (!stale) {
        const id = autoId(), t = new Date();
        await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: t, updateTime: t,
          data: { type: "note", read: false, title: `⏰ Reminder: ${String(data.title || "Untitled note").slice(0, 80)}`, body: "Open Notes to see it.", noteId: String(d.docId), createdAt: t } }).catch(() => {});
      }
      const step = r.repeat === "daily" ? 864e5 : r.repeat === "weekly" ? 7 * 864e5 : 0;
      const set: Record<string, unknown> = {};
      if (step) { let next = at; while (next <= now) next += step; set[`data.mine.${uid}.rem.atISO`] = new Date(next).toISOString(); }
      else set[`data.mine.${uid}.rem.sentISO`] = new Date().toISOString();
      // Only update if the reminder wasn't changed meanwhile.
      await TerminalDoc.updateOne({ _id: d._id, [`data.mine.${uid}.rem.atISO`]: r.atISO }, { $set: set }).catch(() => {});
      log.info(`Note reminder → ${uid}${stale ? " (late, skipped alert)" : ""}`);
    }
  }
}

export function startNoteReminders() {
  let busy = false;
  const run = () => { if (busy) return; busy = true; tick().catch((e) => log.warn(`Note reminders: ${(e as Error).message}`)).finally(() => (busy = false)); };
  setTimeout(run, 20_000);
  const t = setInterval(run, 60_000);
  return () => clearInterval(t);
}
