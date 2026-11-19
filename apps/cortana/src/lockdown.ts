import { ChannelType, EmbedBuilder, PermissionFlagsBits, type Client, type Guild, type GuildChannel } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, autoId, cortanaSettings } from "./util.ts";
import { PermanentJobError, registerJob } from "./worker.ts";

/**
 * COMMAND CENTRE → MODERATION → DISCORD LOCKDOWN (approved mock 19 Nov).
 * Levels: slow (slow mode 30 / 60 / 300 s) · lock (members read-only) · full (public channels hidden + voice blocked, invites paused).
 * Pause invites can be added to slow / lock.
 * SAFE RESTORE: before touching a channel Cortana saves ALL its permission overwrites + slow mode in lockdown/current.
 * Lifting writes that exact snapshot back (overwrites added by the lockdown disappear, changed ones go back).
 * Locking denies posting for @everyone AND every other non-staff role overwrite on the channel (so a member role that
 * normally allows posting cannot get round it).
 * Public channel = @everyone can see it. Private (staff) channels are never touched. Staff Discord roles (Discord Role Map:
 * recruiter → commander) get an allow overwrite so staff can still post / see.
 * Jobs (Commander / Developer or Kick-Ban access "modk"): lockdown.start · lockdown.lift · lockdown.extend · lockdown.upgrade.
 * Ends by itself when the time runs out (checked every 30 s). One lockdown at a time.
 */
type U = Record<string, any>;
/** Full snapshot of a channel before the lockdown: every overwrite [id, type, allow, deny] + slow mode. */
type Saved = { id: string; name: string; ows: [string, number, string, string][]; slow: number | null };
const DOC = "lockdown/current";
const SEND = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.AddReactions];
const VOICE = [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
const STAFF_ROLES = ["recruiter", "nco", "staff_nco", "officer", "developer", "commander"];
const LABEL: Record<string, string> = { slow: "🐢 SLOW MODE", lock: "🔒 LOCKED", full: "⛔ FULL LOCKDOWN" };
let busy = false;

const state = async () => ((await TerminalDoc.findById(DOC, { data: 1 }).lean())?.data ?? {}) as U;
const setState = (data: U) => TerminalDoc.updateOne({ _id: DOC }, { $set: { parent: "lockdown", docId: "current", data, updateTime: new Date() }, $setOnInsert: { createTime: new Date() } }, { upsert: true });
async function who(job: { data: { requestedBy?: string } }) {
  const d = typeof job.data.requestedBy === "string" ? ((await TerminalDoc.findById(`users/${job.data.requestedBy}`, { data: 1 }).lean())?.data as U | undefined) : undefined;
  if (d && d.suspended !== true && ["commander", "developer"].includes(String(d.role))) return String(d.callsign || d.firstName || "Command");
  const a = await uidAllowed(job.data.requestedBy, "modk");
  if (!a.ok) throw new PermanentJobError("You don't have access to Discord Lockdown");
  return a.name;
}
async function staffRoleIds(g: Guild): Promise<string[]> {
  const map = (((await TerminalDoc.findById("settings/discord_role_map", { data: 1 }).lean())?.data as U | undefined)?.map ?? {}) as Record<string, string[]>;
  return [...new Set(STAFF_ROLES.flatMap((r) => map[r] ?? []))].filter((id) => g.roles.cache.has(id));
}
const isPublic = (g: Guild, ch: GuildChannel) => ch.permissionsFor(g.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) ?? false;
async function modLog(client: Client<true>, e: EmbedBuilder) {
  const id = (await cortanaSettings()).logs?.modLogId;
  const ch = id ? await client.channels.fetch(id).catch(() => null) : null;
  if (ch && "send" in ch) await ch.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}
async function announce(client: Client<true>, text: string) {
  const g = await client.guilds.fetch(env.AUTHORISED_GUILD_ID);
  const ch = g.channels.cache.find((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type) && /(^|[^a-z])announcements?$/i.test(c.name));
  if (ch && "send" in ch && text) await ch.send({ content: text.slice(0, 1900), allowedMentions: { parse: [] } }).catch(() => {});
}
async function alertStaff(title: string, body: string) {
  const now = new Date();
  const staff = await TerminalDoc.find({ parent: "users", "data.role": { $in: STAFF_ROLES }, "data.suspended": { $ne: true } }, { docId: 1 }).lean();
  for (const s of staff) { const id = autoId(); await TerminalDoc.create({ _id: `notifications/${s.docId}/items/${id}`, parent: `notifications/${s.docId}/items`, docId: id, createTime: now, updateTime: now, data: { type: "warning", read: false, title, body, createdAt: now } }).catch(() => {}); }
}
async function audit(action: string, details: string, by: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now, data: { section: "discord", action, details, by, source: "cortana", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}

/** Apply a level to the saved channels (from their ORIGINAL state). */
async function apply(g: Guild, level: string, slowSec: number, saved: Saved[], staff: string[]) {
  let done = 0, failed = 0;
  for (const s of saved) {
    const ch = g.channels.cache.get(s.id) as GuildChannel | undefined;
    if (!ch) continue;
    try {
      const text = "rateLimitPerUser" in ch, voice = ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice;
      if (level === "slow") { if (text) await (ch as any).setRateLimitPerUser(slowSec, "Lockdown: slow mode"); done++; continue; }
      const deny: Record<string, boolean> = {};
      for (const p of [...SEND, ...(voice ? VOICE : [])]) deny[flagName(p)] = false;
      if (level === "full") deny.ViewChannel = false;
      await ch.permissionOverwrites.edit(g.roles.everyone, deny, { reason: "Lockdown" });
      for (const o of s.ows) if (o[1] === 0 && o[0] !== g.roles.everyone.id && !staff.includes(o[0])) await ch.permissionOverwrites.edit(o[0], deny, { reason: "Lockdown" });
      const allow: Record<string, boolean> = {};
      for (const p of [...SEND, ...(voice ? VOICE : [])]) allow[flagName(p)] = true;
      if (level === "full") allow.ViewChannel = true;
      for (const r of staff) await ch.permissionOverwrites.edit(r, allow, { reason: "Lockdown: staff stay open" });
      done++;
    } catch (e) { failed++; log.warn(`Lockdown: #${s.name}: ${(e as Error).message}`); }
  }
  return { done, failed };
}
const flagName = (bit: bigint) => Object.entries(PermissionFlagsBits).find(([, v]) => v === bit)![0];

/** Put every channel back exactly as saved. */
async function restore(g: Guild, saved: Saved[]) {
  let failed = 0;
  for (const s of saved) {
    const ch = g.channels.cache.get(s.id) as GuildChannel | undefined;
    if (!ch) continue;
    try {
      await ch.permissionOverwrites.set(s.ows.map(([id, type, allow, deny]) => ({ id, type, allow: BigInt(allow), deny: BigInt(deny) })), "Lockdown lifted");
      if (s.slow != null && "rateLimitPerUser" in ch) await (ch as any).setRateLimitPerUser(s.slow, "Lockdown lifted");
    } catch (e) { failed++; log.warn(`Lockdown restore #${s.name}: ${(e as Error).message}`); }
  }
  return failed;
}

async function start(client: Client<true>, job: { data: { requestedBy?: string; payload?: unknown } }) {
  const by = await who(job);
  if (busy) throw new PermanentJobError("A lockdown change is already running");
  const cur = await state();
  if (cur.active) throw new PermanentJobError("A lockdown is already on — lift or change it");
  const p = (job.data.payload ?? {}) as U;
  const level = ["slow", "lock", "full"].includes(p.level) ? p.level : "lock";
  const reason = String(p.reason ?? "").trim().slice(0, 300);
  if (reason.length < 3) throw new PermanentJobError("A reason is required");
  busy = true;
  try {
    const g = await client.guilds.fetch(env.AUTHORISED_GUILD_ID);
    await g.channels.fetch();
    const staff = await staffRoleIds(g);
    const kinds = level === "slow" ? [ChannelType.GuildText, ChannelType.GuildAnnouncement] : [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildForum];
    const pick = Array.isArray(p.channelIds) && p.channelIds.length ? new Set(p.channelIds.map(String)) : null;
    const chans = ([...g.channels.cache.values()] as unknown as GuildChannel[]).filter((c) => !c.isThread() && kinds.includes(c.type) && isPublic(g, c as GuildChannel) && (!pick || pick.has(c.id)));
    if (!chans.length) throw new PermanentJobError("No public channels to lock");
    const saved: Saved[] = chans.map((ch) => ({ id: ch.id, name: ch.name, ows: ch.permissionOverwrites.cache.map((o) => [o.id, o.type, o.allow.bitfield.toString(), o.deny.bitfield.toString()] as [string, number, string, string]), slow: "rateLimitPerUser" in ch ? Number((ch as any).rateLimitPerUser ?? 0) : null }));
    const minutes = Math.max(0, Math.min(24 * 60, Number(p.minutes) || 0));
    const slowSec = [30, 60, 300].includes(Number(p.slowSec)) ? Number(p.slowSec) : 30;
    const invites = level === "full" || !!p.invites;
    const now = new Date();
    // Save FIRST so a crash part-way can still be undone.
    await setState({ active: true, level, slowSec, invites, announce: !!(p.announce && p.notice), reason, by, byUid: job.data.requestedBy, startedAtISO: now.toISOString(), untilISO: minutes ? new Date(now.getTime() + minutes * 60_000).toISOString() : null,
      saved, staffRoles: staff, invitesWereDisabled: g.features.includes("INVITES_DISABLED" as never), steps: ["Saved permissions for " + saved.length + " channels"] });
    const r = await apply(g, level, slowSec, saved, staff);
    const steps = [`Saved permissions for ${saved.length} channels`, level === "slow" ? `Slow mode ${slowSec} s on ${r.done} channels` : `${level === "full" ? "Hid + locked" : "Locked"} ${r.done} channels (members ${level === "full" ? "can't see them" : "read-only"})`];
    if (r.failed) steps.push(`⚠ ${r.failed} channel(s) failed — check Cortana's permissions`);
    if (invites) { await g.disableInvites(true).then(() => steps.push("Paused invites"), () => steps.push("⚠ Could not pause invites")); }
    if (p.announce && p.notice) { await announce(client, String(p.notice)); steps.push("Posted notice in #announcements"); }
    if (p.alertStaff !== false) { await alertStaff("⛔ DISCORD LOCKDOWN", `${LABEL[level]} · ${reason} · by ${by}`); steps.push("Alerted staff"); }
    await TerminalDoc.updateOne({ _id: DOC }, { $set: { "data.steps": steps } });
    await modLog(client, new EmbedBuilder().setColor(0xff4d4d).setTitle(`${LABEL[level]} · ${r.done} channels`).setDescription(`**Reason:** ${reason}\n**By:** ${by}\n**Ends:** ${minutes ? `<t:${Math.floor((now.getTime() + minutes * 60_000) / 1000)}:R>` : "when lifted"}${invites ? "\nInvites paused" : ""}`).setThumbnail(LOGO));
    await audit("DISCORD LOCKDOWN STARTED", `${LABEL[level]} · ${r.done} channels · ${minutes ? minutes + " min" : "until lifted"} · ${reason}`, by);
    log.info(`Lockdown started (${level}) by ${by}: ${r.done} channels`);
    return { channels: r.done, failed: r.failed };
  } finally { busy = false; }
}

async function lift(client: Client<true>, by: string, how: string) {
  if (busy) throw new PermanentJobError("A lockdown change is already running");
  const cur = await state();
  if (!cur.active) return { lifted: false };
  busy = true;
  try {
    const g = await client.guilds.fetch(env.AUTHORISED_GUILD_ID);
    await g.channels.fetch();
    const failed = await restore(g, (cur.saved ?? []) as Saved[]);
    if (cur.invites && !cur.invitesWereDisabled) await g.disableInvites(false).catch(() => {});
    const now = new Date(), mins = Math.round((now.getTime() - Date.parse(cur.startedAtISO)) / 60000);
    const hid = autoId();
    await TerminalDoc.create({ _id: `lockdown_history/${hid}`, parent: "lockdown_history", docId: hid, createTime: now, updateTime: now,
      data: { level: cur.level, slowSec: cur.slowSec, invites: !!cur.invites, channels: (cur.saved ?? []).length, reason: cur.reason, by: cur.by, startedAtISO: cur.startedAtISO, endedAtISO: now.toISOString(), minutes: mins, endedBy: by, how } });
    await setState({ active: false, lastEndedAtISO: now.toISOString() });
    if (cur.announce) await announce(client, "✅ Server unlocked — thanks for your patience.").catch(() => {});
    await modLog(client, new EmbedBuilder().setColor(0x22e07a).setTitle("✅ Lockdown lifted").setDescription(`${LABEL[cur.level]} lasted ${mins} min · ${how}${failed ? `\n⚠ ${failed} channel(s) could not be restored — check them by hand` : ""}`));
    await audit("DISCORD LOCKDOWN LIFTED", `${LABEL[cur.level]} · lasted ${mins} min · ${how}`, by);
    log.info(`Lockdown lifted (${how})`);
    return { lifted: true, failed };
  } finally { busy = false; }
}

export function startLockdown(client: Client<true>) {
  registerJob("lockdown.start", (job, c) => start(c, job));
  registerJob("lockdown.lift", async (job, c) => { const by = await who(job); return lift(c, by, `lifted by ${by}`); });
  registerJob("lockdown.extend", async (job) => {
    const by = await who(job), cur = await state();
    if (!cur.active) throw new PermanentJobError("No lockdown is on");
    const add = Math.max(5, Math.min(240, Number((job.data.payload as U | undefined)?.minutes) || 15));
    const from = cur.untilISO ? Math.max(Date.parse(cur.untilISO), Date.now()) : Date.now();
    await TerminalDoc.updateOne({ _id: DOC }, { $set: { "data.untilISO": new Date(from + add * 60_000).toISOString() } });
    await audit("DISCORD LOCKDOWN EXTENDED", `+${add} min`, by);
    return { minutes: add };
  });
  registerJob("lockdown.upgrade", async (job, c) => {
    // Make it FULL: re-apply from the saved originals (nothing is lost), pause invites.
    const by = await who(job), cur = await state();
    if (!cur.active) throw new PermanentJobError("No lockdown is on");
    const g = await c.guilds.fetch(env.AUTHORISED_GUILD_ID);
    await g.channels.fetch();
    if (cur.level === "slow") await restore(g, cur.saved ?? []);
    const r = await apply(g, "full", 0, cur.saved ?? [], cur.staffRoles ?? []);
    await g.disableInvites(true).catch(() => {});
    await TerminalDoc.updateOne({ _id: DOC }, { $set: { "data.level": "full", "data.invites": true }, $push: { "data.steps": `Made FULL lockdown (${r.done} channels) by ${by}` } });
    await audit("DISCORD LOCKDOWN UPGRADED", "→ FULL LOCKDOWN", by);
    return { channels: r.done };
  });
  const t = setInterval(() => void (async () => {
    const cur = await state();
    if (cur.active && cur.untilISO && Date.parse(cur.untilISO) <= Date.now() && !busy) await lift(client, "Cortana", "time ran out");
  })().catch((e) => log.warn(`Lockdown timer: ${(e as Error).message}`)), 30_000);
  t.unref?.();
}
