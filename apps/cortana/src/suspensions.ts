import { EmbedBuilder, type Client } from "discord.js";
import { Member, TerminalDoc, transformMember } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, autoId, cortanaSettings } from "./util.ts";
import { PermanentJobError, registerJob } from "./worker.ts";

/**
 * COMMAND CENTRE → SUSPENSIONS (approved mock 19 Nov).
 *  - Job suspend.discord { action: "timeout" | "lift", discordId, minutes, reason, days, dm } — the person who queued it needs Suspensions access.
 *    timeout: Discord timeout (max 28 days; 0 minutes = DM only) + DM + Mod Log. lift: ends the timeout.
 *  - Every 5 minutes: timed suspensions that have ended are restored (website + Hub sign-in back, Discord timeout lifted,
 *    history record closed, member alerted, Audit Log). Was done only when someone opened the page.
 */
type U = Record<string, any>;
async function modLog(client: Client<true>, e: EmbedBuilder) {
  const id = (await cortanaSettings()).logs?.modLogId;
  const ch = id ? await client.channels.fetch(id).catch(() => null) : null;
  if (ch && "send" in ch) await ch.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}
const allowedToSuspend = async (uid: unknown) => {
  const d = typeof uid === "string" ? ((await TerminalDoc.findById(`users/${uid}`, { "data.role": 1 }).lean())?.data as U | undefined) : undefined;
  if (d && ["commander", "developer"].includes(String(d.role))) return { ok: true, name: "" };
  return uidAllowed(uid, "cmd_suspend");
};

async function discordJob(client: Client<true>, job: { data: { requestedBy?: string; payload?: unknown } }) {
  const a = await allowedToSuspend(job.data.requestedBy);
  if (!a.ok) throw new PermanentJobError("You don't have access to Suspensions");
  const p = (job.data.payload ?? {}) as U;
  if (!/^\d{17,20}$/.test(String(p.discordId ?? ""))) throw new PermanentJobError("Not linked to Discord");
  const g = await client.guilds.fetch(env.AUTHORISED_GUILD_ID);
  const m = await g.members.fetch(String(p.discordId)).catch(() => null);
  if (p.action === "lift") { if (m?.communicationDisabledUntil) await m.timeout(null, "Suspension ended").catch(() => {}); return { lifted: true }; }
  const mins = Math.max(0, Math.min(28 * 1440, Number(p.minutes) || 0));
  let timedOut = false;
  if (m && mins) timedOut = await m.timeout(mins * 60_000, `Suspended: ${String(p.reason ?? "")}`.slice(0, 500)).then(() => true, () => false);
  let dmed = false;
  if (p.dm) {
    const e = new EmbedBuilder().setColor(0xff4d4d).setTitle("⏸ 505th Expeditionary Force — account suspended")
      .setDescription(`**Reason:** ${String(p.reason ?? "")}\n**Length:** ${p.days ? `${p.days} day${p.days === 1 ? "" : "s"}` : "until restored"}\n\nYou can't sign in to the website or the Hub while suspended. Questions? Open a ticket.`).setFooter({ text: "505th Command", iconURL: LOGO });
    dmed = await (await client.users.fetch(String(p.discordId)).catch(() => null))?.send({ embeds: [e] }).then(() => true, () => false) ?? false;
  }
  if (m) await modLog(client, new EmbedBuilder().setColor(0xff4d4d).setTitle("⏸ Suspended").setDescription(`<@${p.discordId}> · ${String(p.reason ?? "")}\n${timedOut ? `Discord timeout ${Math.round(mins / 1440)} day(s)` : "No Discord timeout"} · DM ${dmed ? "sent" : "not sent"}`));
  return { timedOut, dmed };
}

async function expireTick(client: Client<true>) {
  const now = new Date();
  const docs = (await TerminalDoc.find({ parent: "users", "data.suspended": true, "data.suspendedUntil": { $type: "string", $lte: now.toISOString() } }, { docId: 1, data: 1 }).lean()) as U[];
  for (const d of docs) {
    const uid = String(d.docId), u = (d.data ?? {}) as U, nowISO = now.toISOString();
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.suspended": false, "data.restoredAtISO": nowISO, "data.restoredBy": "auto (time served)", updateTime: now } });
    try { // website + Hub sign-in back (same status the website would work out)
      const fresh = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as U;
      const st = transformMember({ id: uid, path: `users/${uid}`, data: fresh } as never, () => false).doc.status;
      await Member.updateOne({ legacyId: uid, status: "SUSPENDED" }, { $set: { status: st } });
    } catch (e) { log.warn(`Suspension restore (member status) ${uid}: ${(e as Error).message}`); }
    const rec = await TerminalDoc.findOne({ parent: "suspensions", "data.uid": uid, "data.endedAtISO": { $exists: false } }, { data: 1 }).sort({ "data.atISO": -1 }).lean();
    if (rec) await TerminalDoc.updateOne({ _id: rec._id }, { $set: { "data.endedAtISO": nowISO, "data.endedBy": "Cortana", "data.how": "time served", updateTime: now } });
    const nm = String(u.callsign || [u.firstName, u.lastName].filter(Boolean).join(" ") || uid);
    const aid = autoId(), nid = autoId();
    await TerminalDoc.create({ _id: `audit_logs/${aid}`, parent: "audit_logs", docId: aid, createTime: now, updateTime: now, data: { section: "command", action: "ACCOUNT REINSTATE", details: `${nm} — suspension ended (time served)`, by: "Cortana", source: "cortana", createdAt: now, createdAtISO: nowISO } }).catch(() => {});
    await TerminalDoc.create({ _id: `notifications/${uid}/items/${nid}`, parent: `notifications/${uid}/items`, docId: nid, createTime: now, updateTime: now, data: { type: "info", read: false, title: "Your suspension has ended", body: "You can sign in again.", createdAt: now } }).catch(() => {});
    if ((rec?.data as U | undefined)?.discord && /^\d{17,20}$/.test(String(u.discordId ?? ""))) {
      const g = await client.guilds.fetch(env.AUTHORISED_GUILD_ID).catch(() => null);
      const m = await g?.members.fetch(String(u.discordId)).catch(() => null);
      if (m?.communicationDisabledUntil) await m.timeout(null, "Suspension ended").catch(() => {});
    }
    log.info(`Suspension ended for ${nm}`);
  }
}

export function startSuspensions(client: Client<true>) {
  registerJob("suspend.discord", (job, c) => discordJob(c, job));
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await expireTick(client); } catch (e) { log.warn(`Suspensions: ${(e as Error).message}`); } finally { busy = false; } };
  void run();
  setInterval(() => void run(), 5 * 60_000).unref?.();
}
