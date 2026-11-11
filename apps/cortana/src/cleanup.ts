/**
 * Switch-over prep: remove TEST data before the real 505th server goes live.
 * Job `cleanup.testdata` (Developers / Command — key "set"). Started from Cortana Setup → Server Check → 🧹 CLEAN TEST DATA.
 *
 * payload {
 *   eventIds: string[]   only the events you ticked (community_events/<id>) — never "all"
 *   tickets: boolean     every ticket record (tickets/*)
 *   ticketChannels: boolean  also delete those tickets' channels in Discord (ticket-0001 / closed-0001)
 *   cases: boolean       every moderation case (mod_cases/*)
 *   messages: boolean    the "Recently sent" list (discord_messages/*) — the Discord messages stay
 *   counters: boolean    ticket # and case # start again at 1
 * }
 * Database records — plus, only when ticketChannels is ticked, the test ticket channels in Discord. Members, ranks, settings, info posts and ticket types are never touched.
 */
import type { Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { auditLog } from "./util.ts";

type P = { eventIds?: unknown; ticketChannels?: unknown; tickets?: unknown; cases?: unknown; messages?: unknown; counters?: unknown };

async function wipe(top: string): Promise<number> {
  const r = await TerminalDoc.deleteMany({ _id: { $regex: `^${top}/[^/]+$` } });
  return r.deletedCount ?? 0;
}

export function startCleanup(_client: Client<true>) { // client comes per job
  registerJob("cleanup.testdata", async (job, client) => {
    const who = await uidAllowed(job.data.requestedBy, "set");
    if (!who.ok) throw new PermanentJobError("Only Developers / Command can clean test data");
    const p = (job.data.payload ?? {}) as P;
    const ids = (Array.isArray(p.eventIds) ? p.eventIds : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 500);
    const done: Record<string, number> = {};
    if (ids.length) {
      // Sub-records of each event (if any) go with it.
      const r = await TerminalDoc.deleteMany({ _id: { $in: ids.map((id) => `community_events/${id}`) } });
      await TerminalDoc.deleteMany({ _id: { $regex: `^community_events/(${ids.join("|")})/` } });
      done.events = r.deletedCount ?? 0;
    }
    if (p.ticketChannels === true) {
      // Before the records go: delete each ticket's channel (only channels this server's tickets made).
      const docs = await TerminalDoc.find({ parent: "tickets", "data.channelDeleted": { $ne: true } }, { "data.channelId": 1 }).lean();
      let n = 0;
      for (const d of docs) {
        const ch = await client.channels.fetch(String((d as any).data?.channelId ?? "")).catch(() => null);
        if (ch && "delete" in ch && /^(ticket|closed)-\d{4}$/.test((ch as { name?: string }).name ?? "")) { await ch.delete(`Test data cleaned by ${who.name}`).catch(() => {}); n++; }
      }
      done.channels = n;
    }
    if (p.tickets === true) done.tickets = await wipe("tickets");
    if (p.cases === true) done.cases = await wipe("mod_cases");
    if (p.messages === true) done.messages = await wipe("discord_messages");
    if (p.counters === true) {
      await TerminalDoc.updateOne({ _id: "bot_state/counters" }, { $unset: { "data.ticket": "", "data.modCase": "" }, $set: { updateTime: new Date() } });
      done.counters = 1;
    }
    const summary = Object.entries(done).map(([k, n]) => (k === "counters" ? "numbers reset" : `${n} ${k}`)).join(" · ") || "nothing";
    await auditLog("TEST DATA CLEANED", summary, who.name, "command");
    log.info(`Test data cleaned by ${who.name}: ${summary}`);
    return { ok: true, done };
  });
}
