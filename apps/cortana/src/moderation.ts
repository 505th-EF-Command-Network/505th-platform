/**
 * Moderation (approved mock 2026-11-10). Website → bot_jobs → Cortana acts in Discord.
 * Every action is a numbered CASE (mod_cases/<id>, written by Cortana only), posted to the Mod Log channel
 * (Cortana Setup → Logs) and the website audit log. Optional DM to the member with the reason.
 *
 * Jobs: mod.action { discordId, action: warn|timeout|kick|ban, reason, note?, minutes?, deleteDays?, dm? }
 *       mod.lift   { caseId }   — lifts a timeout / unbans / clears a warning
 * Access: warn + timeout = "modw" · kick + ban = "modk". Nobody can act on someone of their own website rank or higher.
 * 3 active warnings (30 days) → automatic 24 h timeout (its own case).
 */
import { EmbedBuilder, type Client, type Guild } from "discord.js";
import { z } from "zod";
import { Member, TerminalDoc } from "@505th/db";
import { roleLevel } from "../../website/lib/terminal/access.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, auditLog, autoId, cortanaSettings, nextNumber, nowISO } from "./util.ts";

const A = z.object({
  discordId: z.string().regex(/^\d{5,25}$/),
  action: z.enum(["warn", "timeout", "kick", "ban"]),
  reason: z.string().trim().min(3, "Give a reason").max(500),
  note: z.string().trim().max(500).default(""),
  minutes: z.number().int().min(1).max(40320).default(60), // Discord max 28 days
  deleteDays: z.number().int().min(0).max(7).default(0),
  dm: z.boolean().default(true),
});
const COLOR = { warn: 0xf59e0b, timeout: 0x00d9ff, kick: 0xff8a3d, ban: 0xff4d4d, lift: 0x22e07a } as const;
const ICON = { warn: "⚠", timeout: "⏱", kick: "👢", ban: "⛔", lift: "✅" } as const;
const WARN_DAYS = 30, WARN_LIMIT = 3;
const human = (m: number) => (m % 1440 === 0 ? `${m / 1440} day${m / 1440 > 1 ? "s" : ""}` : m % 60 === 0 ? `${m / 60} h` : `${m} min`);

async function websiteRole(discordId: string) {
  const m = await Member.findOne({ discordId }, { legacyId: 1, role: 1 }).lean();
  if (!m) return "";
  const d = (await TerminalDoc.findById(`users/${m.legacyId || String(m._id)}`, { "data.role": 1 }).lean())?.data as any;
  return String(d?.role ?? m.role ?? "");
}
async function requester(job: { data: { requestedBy?: string } }, key: string) {
  const a = await uidAllowed(job.data.requestedBy, key);
  if (!a.ok) throw new PermanentJobError("You don't have access to do that");
  const d = (await TerminalDoc.findById(`users/${job.data.requestedBy}`, { "data.role": 1, "data.discordId": 1 }).lean())?.data as any;
  return { name: a.name, uid: String(job.data.requestedBy), role: String(d?.role ?? ""), discordId: String(d?.discordId ?? "") };
}

async function modLog(client: Client<true>, e: EmbedBuilder) {
  const s = await cortanaSettings();
  const id = s.logs?.modLogId;
  const ch = id ? await client.channels.fetch(id).catch(() => null) : null;
  if (ch && "send" in ch) await ch.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}

async function makeCase(client: Client<true>, data: Record<string, any>) {
  const number = await nextNumber("modCase");
  const id = autoId();
  const now = new Date();
  await TerminalDoc.create({ _id: `mod_cases/${id}`, parent: "mod_cases", docId: id, createTime: now, updateTime: now, data: { number, ...data, atISO: now.toISOString(), active: data.action !== "kick" } });
  const a = data.action as keyof typeof COLOR;
  const e = new EmbedBuilder().setColor(COLOR[a]).setTitle(`${ICON[a]} Case #${number} · ${a === "timeout" ? `Timeout ${human(data.minutes)}` : a[0].toUpperCase() + a.slice(1)}${data.auto ? " (automatic)" : ""}`)
    .setDescription(`**Member:** <@${data.discordId}> (${data.targetName})\n**By:** ${data.byName}\n**Reason:** ${data.reason}`)
    .setFooter({ text: `${data.warnCount ? `Warning ${data.warnCount} of ${WARN_LIMIT} · ` : ""}505th Moderation`, iconURL: LOGO }).setTimestamp();
  await modLog(client, e);
  await auditLog(`MOD ${a.toUpperCase()}`, `Case #${number} · ${data.targetName} · ${data.reason}`, data.byName, "security");
  return { id, number };
}

async function dmMember(g: Guild, discordId: string, action: string, reason: string, extra = "") {
  const u = await g.client.users.fetch(discordId).catch(() => null);
  if (!u) return false;
  const e = new EmbedBuilder().setColor(COLOR[action as keyof typeof COLOR] ?? 0x194a77).setTitle(`${ICON[action as keyof typeof ICON] ?? ""} 505th Expeditionary Force — ${action === "timeout" ? "Timeout" : action[0].toUpperCase() + action.slice(1)}`)
    .setDescription(`**Reason:** ${reason}${extra ? `\n${extra}` : ""}\n\nQuestions? Open a ticket in the server.`).setFooter({ text: "505th Moderation", iconURL: LOGO });
  return u.send({ embeds: [e] }).then(() => true, () => false);
}

export type ModBy = { name: string; uid: string; role: string; discordId: string };
export type ModInput = z.input<typeof A>;
async function act(client: Client<true>, job: { data: { requestedBy?: string; payload?: unknown } }) {
  const r = A.safeParse(job.data.payload);
  if (!r.success) throw new PermanentJobError(r.error.issues[0]?.message ?? "Bad input");
  const by = await requester(job, r.data.action === "kick" || r.data.action === "ban" ? "modk" : "modw");
  return doAction(client, by, r.data);
}
/** Shared by the website (jobs) and the slash commands. */
export async function doAction(client: Client<true>, by: ModBy, input: ModInput) {
  const r = A.safeParse(input);
  if (!r.success) throw new PermanentJobError(r.error.issues[0]?.message ?? "Bad input");
  const p = r.data;
  if (p.discordId === by.discordId) throw new PermanentJobError("You can't moderate yourself");
  if (p.discordId === client.user.id) throw new PermanentJobError("You can't moderate Cortana");
  const targetRole = await websiteRole(p.discordId);
  if (targetRole && roleLevel(targetRole) >= roleLevel(by.role)) throw new PermanentJobError("That member is your rank or higher on the website");
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID)!;
  const member = await g.members.fetch(p.discordId).catch(() => null);
  const user = member?.user ?? (await client.users.fetch(p.discordId).catch(() => null));
  if (!user) throw new PermanentJobError("Discord user not found");
  if (p.action !== "ban" && !member) throw new PermanentJobError("That person isn't in the server");
  const targetName = member?.displayName ?? user.username;
  const base = { discordId: p.discordId, targetName, action: p.action, reason: p.reason, note: p.note, byName: by.name, byUid: by.uid };

  // DM first (after a kick/ban Cortana can't reach them).
  const dmed = p.dm ? await dmMember(g, p.discordId, p.action, p.reason, p.action === "timeout" ? `**Length:** ${human(p.minutes)}` : "") : false;
  try {
    if (p.action === "timeout") {
      if (!member!.moderatable) throw new Error("Cortana's role is below theirs");
      await member!.timeout(p.minutes * 60_000, `${p.reason} — by ${by.name}`);
    } else if (p.action === "kick") {
      if (!member!.kickable) throw new Error("Cortana's role is below theirs");
      await member!.kick(`${p.reason} — by ${by.name}`);
    } else if (p.action === "ban") {
      if (member && !member.bannable) throw new Error("Cortana's role is below theirs");
      await g.members.ban(p.discordId, { reason: `${p.reason} — by ${by.name}`, deleteMessageSeconds: p.deleteDays * 86400 });
    }
  } catch (e) {
    throw new PermanentJobError(`Discord refused: ${(e as Error).message}`);
  }

  let warnCount = 0;
  if (p.action === "warn") {
    const since = new Date(Date.now() - WARN_DAYS * 864e5).toISOString();
    warnCount = 1 + (await TerminalDoc.countDocuments({ parent: "mod_cases", "data.discordId": p.discordId, "data.action": "warn", "data.active": true, "data.atISO": { $gt: since } }));
  }
  const c = await makeCase(client, { ...base, minutes: p.action === "timeout" ? p.minutes : null, dmSent: dmed, warnCount: p.action === "warn" ? warnCount : null,
    expiresAtISO: p.action === "timeout" ? new Date(Date.now() + p.minutes * 60_000).toISOString() : p.action === "warn" ? new Date(Date.now() + WARN_DAYS * 864e5).toISOString() : null });

  if (p.action === "warn" && warnCount >= WARN_LIMIT && member?.moderatable) {
    await member.timeout(24 * 3600_000, `${WARN_LIMIT} warnings in ${WARN_DAYS} days`).catch(() => {});
    if (p.dm) await dmMember(g, p.discordId, "timeout", `${WARN_LIMIT} warnings in ${WARN_DAYS} days`, "**Length:** 1 day");
    await makeCase(client, { ...base, action: "timeout", minutes: 1440, reason: `${WARN_LIMIT} warnings in ${WARN_DAYS} days (automatic)`, auto: true, byName: "Cortana", expiresAtISO: new Date(Date.now() + 864e5).toISOString() });
  }
  log.info(`Mod: ${p.action} ${targetName} by ${by.name} (case #${c.number}).`);
  return { caseNumber: c.number, dmSent: dmed };
}

/** Delete a case for good (test data / mistakes). Developers / Command only; active timeouts and bans must be lifted first. */
async function removeCase(client: Client<true>, job: { data: { requestedBy?: string; payload?: unknown } }) {
  const caseId = String((job.data.payload as any)?.caseId ?? "");
  const cs = (await TerminalDoc.findById(`mod_cases/${caseId}`, { data: 1 }).lean())?.data as any;
  if (!cs) return { ok: true };
  const by = await requester(job, "set");
  if (cs.active && (cs.action === "timeout" || cs.action === "ban")) throw new PermanentJobError(`Lift the ${cs.action} first, then delete the case`);
  await TerminalDoc.deleteOne({ _id: `mod_cases/${caseId}` });
  await modLog(client, new EmbedBuilder().setColor(COLOR.lift).setTitle(`🗑 Case #${cs.number} deleted`).setDescription(`**Member:** <@${cs.discordId}> (${cs.targetName})\n**Was:** ${cs.action} — ${String(cs.reason || "").slice(0, 300)}\n**By:** ${by.name}`).setFooter({ text: "505th Moderation", iconURL: LOGO }).setTimestamp());
  await auditLog("MOD CASE DELETED", `Case #${cs.number} · ${cs.action} · ${cs.targetName}`, by.name, "security");
  return { ok: true };
}
async function lift(client: Client<true>, job: { data: { requestedBy?: string; payload?: unknown } }) {
  const caseId = String((job.data.payload as any)?.caseId ?? "");
  const cs = (await TerminalDoc.findById(`mod_cases/${caseId}`, { data: 1 }).lean())?.data as any;
  if (!cs) throw new PermanentJobError("Case not found");
  if (!cs.active) return { ok: true };
  const by = await requester(job, cs.action === "ban" ? "modk" : "modw");
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID)!;
  if (cs.action === "timeout") await (await g.members.fetch(cs.discordId).catch(() => null))?.timeout(null, `Lifted by ${by.name}`).catch(() => {});
  if (cs.action === "ban") await g.members.unban(cs.discordId, `Unbanned by ${by.name}`).catch((e: Error) => { if (!/Unknown Ban/i.test(e.message)) throw new PermanentJobError(e.message); });
  await TerminalDoc.updateOne({ _id: `mod_cases/${caseId}` }, { $set: { "data.active": false, "data.liftedByName": by.name, "data.liftedAtISO": nowISO(), updateTime: new Date() } });
  const word = cs.action === "ban" ? "Unbanned" : cs.action === "timeout" ? "Timeout lifted" : "Warning cleared";
  await modLog(client, new EmbedBuilder().setColor(COLOR.lift).setTitle(`✅ Case #${cs.number} · ${word}`).setDescription(`**Member:** <@${cs.discordId}> (${cs.targetName})\n**By:** ${by.name}`).setFooter({ text: "505th Moderation", iconURL: LOGO }).setTimestamp());
  await auditLog(`MOD ${word.toUpperCase()}`, `Case #${cs.number} · ${cs.targetName}`, by.name, "security");
  return { ok: true };
}

/** Timeouts / warnings that ran out are marked inactive (hourly). */
async function expire() {
  await TerminalDoc.updateMany({ parent: "mod_cases", "data.active": true, "data.action": { $in: ["timeout", "warn"] }, "data.expiresAtISO": { $lt: nowISO() } }, { $set: { "data.active": false, "data.expired": true, updateTime: new Date() } });
}

export function startModeration() {
  registerJob("mod.action", (job, c) => act(c, job));
  registerJob("mod.lift", (job, c) => lift(c, job));
  registerJob("mod.delete", (job, c) => removeCase(c, job));
  void expire().catch(() => {});
  const t = setInterval(() => void expire().catch(() => {}), 3600_000);
  return () => clearInterval(t);
}
