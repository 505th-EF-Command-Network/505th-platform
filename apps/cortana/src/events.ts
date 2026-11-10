/**
 * EVENTS + SIGN-UPS (Cortana v2, session 2).
 *
 * Source of truth: `community_events/<id>` (the website's Events page writes it).
 *   Website → job `event.publish {eventId}` → Discord scheduled event + sign-up post (buttons).
 *   Website → job `event.cancel {eventId}`  → post marked cancelled, Discord event cancelled.
 *   Discord → a scheduled event made directly in Discord also gets a sign-up post
 *             (a community_events record is created for it, source "discord").
 * Sign-ups are saved on the event record: signups[{ uid, discordId, name, choice, atISO }].
 * Scheduler (every minute): 30-min reminder, "starting now", close + archive after the end,
 * next date for repeating events.
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus, MessageFlags,
  type ButtonInteraction, type Client, type Guild, type GuildBasedChannel, type GuildScheduledEvent, type PartialGuildScheduledEvent, type TextBasedChannel,
} from "discord.js";
import { randomBytes } from "node:crypto";
import { Member, TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { noteError } from "./health.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { allowed } from "./access.ts";

type Btn = { key: string; emoji: string; label: string; style: string; limit: number; attending: boolean };
type Signup = { uid?: string | null; discordId: string; name: string; choice: string; atISO: string; waiting?: boolean };
type Ev = {
  title: string; description?: string; where: "voice" | "stage" | "else"; voiceChannel?: string; location?: string;
  date: string; startTime: string; endTime: string; startAtISO: string; endAtISO: string; repeat?: string; banner?: string;
  channel?: string; buttons: Btn[]; signups?: Signup[]; status?: string; source?: string;
  discord?: { status?: string; scheduledEventId?: string; channelId?: string; messageId?: string; jumpUrl?: string; error?: string;
    reminderSentISO?: string; reminderMessageId?: string; startSentISO?: string; startMessageId?: string; closedAtISO?: string };
};

const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
const FOOTER = "Cortana Main Operation System";
const ATT_LABEL: Record<string, string> = { main_op: "MAIN OP", patrol: "PATROL", training: "TRAINING", fun_op: "FUN OP" };
const TZ: [string, string][] = [["🇬🇧 UK", "Europe/London"], ["🇪🇺 EU", "Europe/Paris"], ["🇺🇸 EST", "America/New_York"], ["🇺🇸 CST", "America/Chicago"], ["🇺🇸 PST", "America/Los_Angeles"]];
const tzLine = (iso: string) => TZ.map(([l, z]) => `\`${l} ${new Date(iso).toLocaleTimeString("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}\``).join(" ");
const active = (ev: Ev) => (ev.signups ?? []).filter((x) => !x.waiting);
const eventsRole = async () => (await settings()).eventsRoleId || env.EVENTS_ROLE_ID || null;
const STYLE: Record<string, ButtonStyle> = { green: ButtonStyle.Success, grey: ButtonStyle.Secondary, blue: ButtonStyle.Primary, red: ButtonStyle.Danger };
const DEFAULT_BUTTONS: Btn[] = [
  { key: "b1", emoji: "✅", label: "Going", style: "green", limit: 0, attending: true },
  { key: "b2", emoji: "❌", label: "Can't go", style: "grey", limit: 0, attending: false },
];
const nowISO = () => new Date().toISOString();
const ts = (iso: string, f = "F") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${f}>`;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/* ───────── data ───────── */
async function getEv(id: string): Promise<{ ev: Ev; updateTime: Date | null } | null> {
  const d = await TerminalDoc.findById(`community_events/${id}`, { data: 1, updateTime: 1 }).lean();
  return d ? { ev: d.data as Ev, updateTime: (d.updateTime as Date) ?? null } : null;
}
async function setDiscord(id: string, patch: Record<string, unknown>) {
  const $set: Record<string, unknown> = { updateTime: new Date() };
  for (const [k, v] of Object.entries(patch)) $set[`data.discord.${k}`] = v;
  await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set });
}
const settings = async () => ((await TerminalDoc.findById("bot_settings/cortana", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;

/* ───────── Discord lookups ───────── */
const guildOf = (c: Client<true>): Guild => {
  const g = c.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  if (!g) throw new PermanentJobError("Cortana is not in the authorised server");
  return g;
};
/** Channel by ID, or by name (#operations / operations), case-insensitive. */
function findChannel(g: Guild, ref: string | undefined, kinds: ChannelType[]): GuildBasedChannel | null {
  const r = String(ref || "").trim().replace(/^#/, "");
  if (!r) return null;
  const byId = g.channels.cache.get(r);
  if (byId && kinds.includes(byId.type)) return byId;
  return g.channels.cache.find((c) => kinds.includes(c.type) && c.name.toLowerCase() === r.toLowerCase()) ?? null;
}
const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
async function postChannel(g: Guild, ev: Ev): Promise<TextBasedChannel> {
  const s = await settings();
  const c = findChannel(g, ev.channel, TEXT) ?? findChannel(g, s.eventChannelId || env.EVENT_CHANNEL_ID, TEXT);
  if (!c || !c.isTextBased()) throw new PermanentJobError(`Sign-up channel "${ev.channel || "(none)"}" not found — check the event's channel`);
  return c;
}

/* ───────── sign-up post (approved mock 2026-11-10: 505th style, improved) ───────── */
type State = "" | "closed" | "cancelled";
export function signupEmbed(id: string, ev: Ev, state: State, kind: string | null, voiceId: string | null) {
  const su = active(ev);
  const wait = (ev.signups ?? []).filter((x) => x.waiting);
  const where = ev.where === "else" ? `📍 ${ev.location || "TBC"}` : voiceId ? `<#${voiceId}>` : `🔊 ${ev.voiceChannel || "Voice"}`;
  const going = su.filter((x) => ev.buttons.find((b) => b.key === x.choice)?.attending).length;
  const e = new EmbedBuilder()
    .setColor(state === "cancelled" ? 0xff4d4d : state ? 0x7d8a99 : 0x00d9ff)
    .setAuthor({ name: `505TH EXPEDITIONARY FORCE${kind ? ` · ${kind}` : ""}`, iconURL: LOGO })
    .setTitle(`${state === "cancelled" ? "🚫 CANCELLED — " : state ? "🚪 CLOSED — " : "📌 "}${ev.title}`.slice(0, 256))
    .setDescription((ev.description || "*No description provided.*").slice(0, 3000))
    .setThumbnail(LOGO)
    .addFields(
      { name: "🗓 When", value: `${ts(ev.startAtISO)} · ${ts(ev.startAtISO, "R")}\n-# Shown in your own time. Unit time:\n${tzLine(ev.startAtISO)}` },
      { name: "⏱ Length", value: `${ev.startTime}–${ev.endTime} UK`, inline: true },
      { name: ev.where === "else" ? "📍 Where" : "🔊 Where", value: where.slice(0, 1024), inline: true },
      { name: "👥 Signed up", value: `${going} going`, inline: true },
    )
    .setFooter({ text: `${FOOTER} · ${state === "cancelled" ? "Cancelled" : state ? `Closed · ${going} signed up` : "Tap a button to sign up · tap again to remove"}`, iconURL: LOGO });
  for (const b of ev.buttons) {
    const list = su.filter((x) => x.choice === b.key);
    const full = b.limit > 0 && list.length >= b.limit;
    e.addFields({ name: `${b.emoji} ${b.label} (${list.length}${b.limit ? `/${b.limit}` : ""})${full && !state ? " — FULL" : ""}`.slice(0, 256), value: (list.map((x) => `<@${x.discordId}>`).join(", ") || "—").slice(0, 1024) });
  }
  if (wait.length && !state) e.addFields({ name: `⏳ Waiting list (${wait.length})`, value: wait.map((x) => `<@${x.discordId}> (${ev.buttons.find((b) => b.key === x.choice)?.label ?? "?"})`).join(", ").slice(0, 1024) + "\n-# Moves up automatically when a slot frees." });
  if (!state && ev.banner && /^https:\/\//.test(ev.banner)) e.setImage(ev.banner);
  return e;
}
export function signupRows(id: string, ev: Ev, state: State) {
  if (state) return [];
  const su = active(ev);
  const pick = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ev.buttons.slice(0, 5).map((b) => {
      const full = b.limit > 0 && su.filter((x) => x.choice === b.key).length >= b.limit;
      const btn = new ButtonBuilder().setCustomId(`ev:${id}:${b.key}`).setLabel(`${b.label}${full ? " (FULL)" : ""}`.slice(0, 80)).setStyle(STYLE[b.style] ?? ButtonStyle.Secondary);
      if (b.emoji) btn.setEmoji(b.emoji);
      return btn;
    }),
  );
  const staff = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`evx:cancel:${id}`).setLabel("Cancel Operation").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`evx:refresh:${id}`).setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
  );
  if (env.SITE_URL) staff.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open on website").setEmoji("🔗").setURL(`${env.SITE_URL.replace(/\/$/, "")}/terminal`));
  return [pick, staff];
}
async function attKind(ev: Ev): Promise<string | null> {
  const aid = (ev as any).attendanceEventId;
  if (!aid) return null;
  const t = ((await TerminalDoc.findById(`attendance_events/${aid}`, { "data.type": 1 }).lean())?.data as any)?.type;
  return ATT_LABEL[t] ?? null;
}
async function signupPost(client: Client<true>, id: string, ev: Ev, state: State = "") {
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  const vc = g && ev.where !== "else" ? findChannel(g, ev.voiceChannel, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]) : null;
  return { embeds: [signupEmbed(id, ev, state, await attKind(ev), vc?.id ?? null)], components: signupRows(id, ev, state), allowedMentions: { parse: [] as const } };
}
const headline = async (ev: Ev, state: State, by?: string) =>
  state === "cancelled" ? `🚫 **Operation cancelled:** ${ev.title}${by ? ` — cancelled by <@${by}>` : ""}`
  : state === "closed" ? `🚪 **Sign-ups closed:** ${ev.title}`
  : `${(await eventsRole()) ? `<@&${await eventsRole()}> ` : ""}📣 **Signup Open** for **${ev.title}**`;

async function refreshPost(client: Client<true>, id: string, state: State = "", by?: string) {
  const r = await getEv(id);
  if (!r?.ev.discord?.channelId || !r.ev.discord.messageId) return;
  const ch = await client.channels.fetch(r.ev.discord.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const msg = await ch.messages.fetch(r.ev.discord.messageId).catch(() => null);
  if (!msg) return;
  const post = await signupPost(client, id, r.ev, state);
  await msg.edit(state ? { ...post, content: await headline(r.ev, state, by) } : post); // edits never ping
}

/* ───────── scheduled event ───────── */
async function upsertScheduled(g: Guild, ev: Ev): Promise<string | null> {
  const start = new Date(ev.startAtISO), end = new Date(ev.endAtISO);
  if (start.getTime() < Date.now() + 60_000) return ev.discord?.scheduledEventId ?? null; // Discord refuses past start times
  const base = { name: ev.title.slice(0, 100), description: (ev.description || "").slice(0, 1000), scheduledStartTime: start, scheduledEndTime: end, privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly };
  let opts: any;
  if (ev.where === "else") opts = { ...base, entityType: GuildScheduledEventEntityType.External, entityMetadata: { location: (ev.location || "TBC").slice(0, 100) } };
  else {
    const kind = ev.where === "stage" ? ChannelType.GuildStageVoice : ChannelType.GuildVoice;
    const vc = findChannel(g, ev.voiceChannel, [kind]);
    opts = vc
      ? { ...base, entityType: ev.where === "stage" ? GuildScheduledEventEntityType.StageInstance : GuildScheduledEventEntityType.Voice, channel: vc.id }
      : { ...base, entityType: GuildScheduledEventEntityType.External, entityMetadata: { location: ev.voiceChannel || "Voice" } };
  }
  const existing = ev.discord?.scheduledEventId ? await g.scheduledEvents.fetch(ev.discord.scheduledEventId).catch(() => null) : null;
  if (existing) return (await existing.edit(opts)).id;
  return (await g.scheduledEvents.create(opts)).id;
}

/* ───────── jobs ───────── */
async function publish(client: Client<true>, id: string) {
  const r = await getEv(id);
  if (!r) throw new PermanentJobError("Event not found");
  const ev = r.ev;
  if (ev.status === "cancelled") return { skipped: "cancelled" };
  const g = guildOf(client);
  try {
    const ch = await postChannel(g, ev);
    let sid: string | null = ev.discord?.scheduledEventId ?? null;
    if (ev.source !== "discord") {
      sid = await upsertScheduled(g, ev).catch((e) => {
        log.warn(`Discord event for "${ev.title}" not made: ${(e as Error).message}`);
        return sid;
      });
    }
    let msg = ev.discord?.messageId && ev.discord.channelId === ch.id ? await ch.messages.fetch(ev.discord.messageId).catch(() => null) : null;
    const post = await signupPost(client, id, ev);
    if (msg) await msg.edit(post);
    else {
      // channel changed or message gone: remove the old post, send a new one
      if (ev.discord?.messageId && ev.discord.channelId) {
        const old = await client.channels.fetch(ev.discord.channelId).catch(() => null);
        if (old?.isTextBased()) await (await old.messages.fetch(ev.discord.messageId).catch(() => null))?.delete().catch(() => {});
      }
      if (!("send" in ch)) throw new PermanentJobError("Can't post in that channel");
      const role = await eventsRole();
      msg = await ch.send({ ...post, content: await headline(ev, ""), allowedMentions: { roles: role ? [role] : [] } });
    }
    await setDiscord(id, { status: "posted", scheduledEventId: sid, channelId: ch.id, messageId: msg.id, jumpUrl: msg.url, error: null, postedAtISO: nowISO() });
    void refreshList(client);
    return { messageId: msg.id, scheduledEventId: sid };
  } catch (e) {
    await setDiscord(id, { status: "failed", error: String((e as Error).message).slice(0, 300) });
    throw e;
  }
}

async function cancel(client: Client<true>, id: string, by?: string) {
  const r = await getEv(id);
  if (!r) throw new PermanentJobError("Event not found");
  const g = guildOf(client);
  const sid = r.ev.discord?.scheduledEventId;
  if (sid) {
    const se = await g.scheduledEvents.fetch(sid).catch(() => null);
    if (se && se.status === GuildScheduledEventStatus.Scheduled) await se.setStatus(GuildScheduledEventStatus.Canceled).catch(() => se.delete().catch(() => {}));
  }
  await refreshPost(client, id, "cancelled", by);
  await setDiscord(id, { status: "cancelled", closedAtISO: nowISO() });
  await missionLog(client, r.ev, "cancelled");
  void refreshList(client);
  return { cancelled: true };
}

/* ───────── buttons ───────── */
/** Sign-up buttons `ev:<id>:<key>` and staff buttons `evx:<action>:<id>`. */
export async function handleEventButton(i: ButtonInteraction): Promise<boolean> {
  const parts = i.customId.split(":");
  if (parts[0] === "evx") return staffButton(i, parts[1], parts[2]);
  const [p, id, key] = parts;
  if (p !== "ev" || !id || !key) return false;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  for (let tries = 0; tries < 4; tries++) {
    const r = await getEv(id);
    if (!r || r.ev.status === "cancelled" || r.ev.discord?.closedAtISO) {
      await i.editReply("This sign-up is closed.");
      return true;
    }
    const ev = r.ev;
    const btn = ev.buttons.find((b) => b.key === key);
    if (!btn) {
      await i.editReply("That option no longer exists.");
      return true;
    }
    let su = [...(ev.signups ?? [])];
    const mine = su.find((x) => x.discordId === i.user.id);
    let reply: string;
    if (mine && mine.choice === key) {
      su = su.filter((x) => x.discordId !== i.user.id);
      reply = mine.waiting ? `Removed you from the **${btn.label}** waiting list.` : `Removed you from **${btn.label}**. Tap again to sign back up.`;
    } else {
      const taken = su.filter((x) => x.choice === key && !x.waiting && x.discordId !== i.user.id).length;
      const waiting = btn.limit > 0 && taken >= btn.limit;
      const m = await Member.findOne({ discordId: i.user.id }, { legacyId: 1, displayName: 1 }).lean();
      const name = (m as any)?.displayName || (i.member && "displayName" in i.member ? i.member.displayName : i.user.username);
      su = su.filter((x) => x.discordId !== i.user.id);
      su.push({ uid: (m as any)?.legacyId ?? null, discordId: i.user.id, name, choice: key, atISO: nowISO(), ...(waiting ? { waiting: true } : {}) });
      reply = waiting
        ? `⏳ **${btn.label}** is full — you're on the waiting list (#${su.filter((x) => x.waiting && x.choice === key).length}). You'll move up automatically.`
        : `${btn.emoji} You're down as **${btn.label}**. Tap it again to remove yourself.`;
    }
    // Promote from the waiting list if slots freed up.
    for (const b of ev.buttons) {
      if (!b.limit) continue;
      let free = b.limit - su.filter((x) => x.choice === b.key && !x.waiting).length;
      for (const w of su.filter((x) => x.choice === b.key && x.waiting)) if (free-- > 0) delete w.waiting;
    }
    // Only save if nobody else changed the event meanwhile (no lost sign-ups).
    const res = await TerminalDoc.updateOne({ _id: `community_events/${id}`, updateTime: r.updateTime }, { $set: { "data.signups": su, updateTime: new Date() } });
    if (res.modifiedCount === 1) {
      await i.editReply(reply);
      await refreshPost(i.client, id).catch((e) => log.error("Sign-up post refresh failed", e));
      void refreshList(i.client);
      return true;
    }
  }
  await i.editReply("Busy — please tap again.");
  return true;
}

async function staffButton(i: ButtonInteraction, action: string, id: string): Promise<boolean> {
  if (!id) return false;
  if (action === "refresh") {
    await i.deferUpdate();
    await refreshPost(i.client, id).catch(() => {});
    return true;
  }
  const member = i.inCachedGuild() ? i.member : null;
  if (!(await allowed(member, "ev"))) {
    await i.reply({ content: "⛔ Only staff with Events access can do that.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const r = await getEv(id);
  if (!r) return void (await i.reply({ content: "Event not found.", flags: MessageFlags.Ephemeral })), true;
  if (action === "cancel") {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`evx:cancelok:${id}`).setLabel("Yes, cancel the operation").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`evx:keep:${id}`).setLabel("Keep it").setStyle(ButtonStyle.Secondary),
    );
    await i.reply({ content: `**Cancel ${r.ev.title}?** The Discord event is cancelled and everyone signed up sees it's off.`, components: [row], flags: MessageFlags.Ephemeral });
    return true;
  }
  if (action === "keep") return void (await i.update({ content: "Kept — nothing changed.", components: [] })), true;
  if (action === "cancelok") {
    await i.update({ content: "Cancelling…", components: [] });
    await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "cancelled", "data.cancelledAtISO": nowISO(), "data.cancelledBy": i.user.id, updateTime: new Date() } });
    await cancel(i.client, id, i.user.id);
    await TerminalDoc.create({ _id: `audit_logs/${autoId()}`, parent: "audit_logs", docId: autoId(), createTime: new Date(), updateTime: new Date(),
      data: { section: "discord", action: "EVENT CANCELLED", details: `${r.ev.title} — from Discord`, by: member?.displayName ?? i.user.username, role: "discord", uid: null, createdAtISO: nowISO() } }).catch(() => {});
    await i.editReply("🚫 Operation cancelled.");
    return true;
  }
  return false;
}

/* ───────── events made directly in Discord ───────── */
const ukParts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
export async function onDiscordEventCreate(client: Client<true>, se: GuildScheduledEvent) {
  if (se.guildId !== env.AUTHORISED_GUILD_ID || se.creatorId === client.user.id) return;
  if (await TerminalDoc.exists({ parent: "community_events", "data.discord.scheduledEventId": se.id })) return;
  const s = await settings();
  const start = se.scheduledStartAt ?? new Date();
  const end = se.scheduledEndAt ?? new Date(start.getTime() + 2 * 3600_000);
  const a = ukParts(start), b = ukParts(end);
  const id = autoId();
  const now = new Date();
  const ev: Ev = {
    title: se.name, description: se.description ?? "", where: se.channel ? (se.channel.type === ChannelType.GuildStageVoice ? "stage" : "voice") : "else",
    voiceChannel: se.channel?.name ?? "", location: se.entityMetadata?.location ?? "", date: a.date, startTime: a.time, endTime: b.time,
    startAtISO: start.toISOString(), endAtISO: end.toISOString(), repeat: "none", banner: se.coverImageURL({ size: 1024 }) ?? "",
    channel: s.eventChannelId || env.EVENT_CHANNEL_ID || "", buttons: DEFAULT_BUTTONS, signups: [], status: "scheduled", source: "discord",
    discord: { status: "queued", scheduledEventId: se.id },
  };
  await TerminalDoc.create({ _id: `community_events/${id}`, parent: "community_events", docId: id, data: { ...ev, createdByName: "Discord", createdAtISO: now.toISOString(), updatedAtISO: now.toISOString() }, createTime: now, updateTime: now });
  log.info(`Discord event "${se.name}" → sign-up post.`);
  await publish(client, id).catch((e) => log.error("Sign-up post for Discord event failed", e));
}
export async function onDiscordEventUpdate(client: Client<true>, se: GuildScheduledEvent) {
  if (se.guildId !== env.AUTHORISED_GUILD_ID) return;
  const d = await TerminalDoc.findOne({ parent: "community_events", "data.discord.scheduledEventId": se.id, "data.source": "discord" }, { docId: 1 }).lean();
  if (!d) return;
  if (se.status === GuildScheduledEventStatus.Canceled) return void (await markCancelled(client, String(d.docId)));
  const start = se.scheduledStartAt!, end = se.scheduledEndAt ?? new Date(start.getTime() + 2 * 3600_000);
  const a = ukParts(start), b = ukParts(end);
  await TerminalDoc.updateOne({ _id: d._id }, { $set: { "data.title": se.name, "data.description": se.description ?? "", "data.date": a.date, "data.startTime": a.time, "data.endTime": b.time, "data.startAtISO": start.toISOString(), "data.endAtISO": end.toISOString(), updateTime: new Date() } });
  await refreshPost(client, String(d.docId));
}
export async function onDiscordEventDelete(client: Client<true>, se: GuildScheduledEvent | PartialGuildScheduledEvent) {
  const d = await TerminalDoc.findOne({ parent: "community_events", "data.discord.scheduledEventId": se.id, "data.status": { $ne: "cancelled" } }, { docId: 1, "data.discord.closedAtISO": 1 }).lean();
  if (d && !((d as any).data)?.discord?.closedAtISO) await markCancelled(client, String(d.docId));
}
async function markCancelled(client: Client<true>, id: string) {
  await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "cancelled", "data.cancelledAtISO": nowISO(), updateTime: new Date() } });
  await refreshPost(client, id, "cancelled");
  await setDiscord(id, { status: "cancelled", closedAtISO: nowISO() });
}

/* ───────── mission log ───────── */
async function missionLog(client: Client<true>, ev: Ev, kind: "archived" | "cancelled") {
  const s = await settings();
  const ref = s.missionLogChannelId || env.MISSION_LOG_CHANNEL_ID;
  if (!ref) return;
  const ch = findChannel(guildOf(client), ref, TEXT);
  if (!ch?.isTextBased() || !("send" in ch)) return;
  const att = (ev.signups ?? []).filter((x) => ev.buttons.find((b) => b.key === x.choice)?.attending).length;
  const e = new EmbedBuilder()
    .setColor(kind === "cancelled" ? 0xff4d4d : 0x22e07a)
    .setTitle(`[EVENT] | "${ev.title}" | ${kind === "cancelled" ? "Cancelled" : "Archived"}`.slice(0, 256))
    .setThumbnail(LOGO)
    .addFields({ name: "Scheduled start", value: ts(ev.startAtISO) }, ...((ev as any).attendanceEventId && kind === "archived" ? [{ name: "Attendance", value: "Linked — staff confirm who turned up in the terminal's Attendance Check." }] : []), { name: "Sign-ups", value: ev.buttons.map((b) => `${b.emoji} ${b.label}: ${(ev.signups ?? []).filter((x) => x.choice === b.key).length}`).join("\n") || "—" })
    .setFooter({ text: `${att} signed up to attend · Sign-up ${kind === "cancelled" ? "cancelled" : "archived"} by Cortana`, iconURL: LOGO })
    .setTimestamp();
  await ch.send({ content: kind === "cancelled" ? `🚫 Cancelled: **${ev.title}**` : `📦 Archived: **${ev.title}**`, embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}

/* ───────── scheduler: reminders, start, close, repeat ───────── */
async function tick(client: Client<true>) {
  const now = Date.now();
  const docs = await TerminalDoc.find({ parent: "community_events", "data.status": { $ne: "cancelled" }, "data.discord.status": "posted", "data.discord.closedAtISO": { $exists: false } }, { docId: 1, data: 1 }).lean();
  for (const d of docs) {
    const id = String(d.docId);
    const ev = d.data as Ev;
    const start = Date.parse(ev.startAtISO), end = Date.parse(ev.endAtISO);
    const ch = ev.discord?.channelId ? await client.channels.fetch(ev.discord.channelId).catch(() => null) : null;
    if (!ch?.isTextBased() || !("send" in ch)) continue;
    const going = [...new Set((ev.signups ?? []).filter((s) => ev.buttons.find((b) => b.key === s.choice)?.attending).map((s) => s.discordId))];
    try {
      if (!ev.discord?.reminderSentISO && now >= start - 30 * 60_000 && now < start) {
        const role = await eventsRole();
        const m = await ch.send({ content: `${role ? `<@&${role}> ` : ""}⚠️ **30 minutes** until **${ev.title}** starts! ${ts(ev.startAtISO, "R")}\n📝 Last chance to sign up.`.slice(0, 2000), allowedMentions: { roles: role ? [role] : [], users: going.slice(0, 100) } });
        await setDiscord(id, { reminderSentISO: nowISO(), reminderMessageId: m.id });
      }
      if (!ev.discord?.startSentISO && now >= start && now < start + 30 * 60_000) {
        const where = ev.where === "else" ? `📍 ${ev.location || ""}` : (() => { const vc = findChannel(guildOf(client), ev.voiceChannel, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]); return vc ? `🔊 <#${vc.id}>` : `🔊 ${ev.voiceChannel || ""}`; })();
        const role = await eventsRole();
        const m = await ch.send({ content: `${role ? `<@&${role}> ` : ""}🚨 **${ev.title}** has started! Join ${where}\n🕒 Sign-ups close in 30 minutes.`.slice(0, 2000), allowedMentions: { roles: role ? [role] : [] } });
        await setDiscord(id, { startSentISO: nowISO(), startMessageId: m.id });
      }
      if (now >= Math.min(start + 30 * 60_000, end)) {
        await refreshPost(client, id, "closed");
        for (const mid of [ev.discord?.reminderMessageId, ev.discord?.startMessageId]) if (mid) await (await ch.messages.fetch(mid).catch(() => null))?.delete().catch(() => {});
        await setDiscord(id, { status: "posted", closedAtISO: nowISO() });
        await missionLog(client, ev, "archived");
        void refreshList(client);
        if (ev.repeat === "weekly" || ev.repeat === "fortnightly") await nextOccurrence(client, id, ev);
        log.info(`Closed sign-ups for "${ev.title}".`);
      }
    } catch (e) {
      noteError();
      log.error(`Event scheduler: "${ev.title}"`, e);
    }
  }
}

async function nextOccurrence(client: Client<true>, id: string, ev: Ev) {
  const step = (ev.repeat === "fortnightly" ? 14 : 7) * 864e5;
  const s = new Date(Date.parse(ev.startAtISO) + step), e = new Date(Date.parse(ev.endAtISO) + step);
  const a = ukParts(s), b = ukParts(e);
  const nid = autoId();
  const now = new Date();
  const { discord, signups, ...rest } = ev as any;
  await TerminalDoc.create({
    _id: `community_events/${nid}`, parent: "community_events", docId: nid, createTime: now, updateTime: now,
    data: { ...rest, date: a.date, startTime: a.time, endTime: b.time, startAtISO: s.toISOString(), endAtISO: e.toISOString(), signups: [], status: "scheduled", attendanceEventId: null, repeatOf: id, discord: { status: "queued" }, createdByName: "Cortana (repeat)", createdAtISO: now.toISOString(), updatedAtISO: now.toISOString() },
  });
  await publish(client, nid).catch((err) => log.error("Repeat event post failed", err));
}

/* ───────── pinned event list ("Upcoming Operations") ───────── */
let listTimer: NodeJS.Timeout | undefined;
/** Debounced: rebuilds the list message a few seconds after changes. */
export function refreshList(client: Client) {
  clearTimeout(listTimer);
  listTimer = setTimeout(() => client.isReady() && void buildList(client).catch((e) => log.error("Event list failed", e)), 4000);
}
async function buildList(client: Client<true>) {
  const g = guildOf(client);
  const s = await settings();
  const ch = findChannel(g, s.eventListChannelId || s.eventChannelId || env.EVENT_CHANNEL_ID, TEXT);
  if (!ch?.isTextBased() || !("send" in ch)) return;
  const docs = await TerminalDoc.find({ parent: "community_events", "data.status": { $ne: "cancelled" }, "data.startAtISO": { $gt: new Date(Date.now() - 3600_000).toISOString() } }, { docId: 1, data: 1 }).lean();
  const evs = docs.map((d) => ({ id: String(d.docId), ev: d.data as Ev })).filter((x) => !x.ev.discord?.closedAtISO).sort((a, b) => a.ev.startAtISO.localeCompare(b.ev.startAtISO)).slice(0, 15);
  const e = new EmbedBuilder().setColor(0x00d9ff).setTitle("📅 UPCOMING OPERATIONS").setThumbnail(LOGO).setDescription(evs.length ? "Always up to date — times are shown in your own time." : "No operations scheduled right now.")
    .setFooter({ text: `${FOOTER} · updated`, iconURL: LOGO }).setTimestamp();
  for (const { ev } of evs) {
    const going = active(ev).filter((x) => ev.buttons.find((b) => b.key === x.choice)?.attending).length;
    const kind = await attKind(ev);
    e.addFields({ name: `📌 ${ev.title}${kind ? ` · ${kind}` : ""}`.slice(0, 256), value: `${ts(ev.startAtISO, "f")} · ${ts(ev.startAtISO, "R")} · ${going} going${ev.discord?.jumpUrl ? ` · [jump to sign-up](${ev.discord.jumpUrl})` : ""}`.slice(0, 1024) });
  }
  const st = (await TerminalDoc.findById("bot_state/cortana", { data: 1 }).lean())?.data as any;
  const old = st?.eventListMessageId && st.eventListChannelId === ch.id ? await ch.messages.fetch(st.eventListMessageId).catch(() => null) : null;
  if (old) await old.edit({ embeds: [e], allowedMentions: { parse: [] } });
  else {
    const m = await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
    await TerminalDoc.updateOne({ _id: "bot_state/cortana" }, { $set: { parent: "bot_state", docId: "cortana", "data.eventListChannelId": ch.id, "data.eventListMessageId": m.id, updateTime: new Date() } }, { upsert: true });
  }
}

/* ───────── wiring ───────── */
export function startEvents(client: Client<true>) {
  registerJob("event.publish", (job, c) => publish(c, String(job.data.payload?.eventId ?? "")));
  registerJob("event.cancel", (job, c) => cancel(c, String(job.data.payload?.eventId ?? "")));
  const run = () => tick(client).catch((e) => log.error("Event scheduler failed", e));
  void run();
  refreshList(client);
  const t = setInterval(run, 60_000);
  return () => clearInterval(t);
}
