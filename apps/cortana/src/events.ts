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
import { allowed, uidAllowed } from "./access.ts";
import { auditLog } from "./util.ts";

type Btn = { key: string; emoji: string; label: string; style: string; limit: number; attending: boolean };
type Signup = { uid?: string | null; discordId: string; name: string; choice: string; atISO: string; waiting?: boolean };
type Ev = {
  opType?: string;
  title: string; description?: string; where: "voice" | "stage" | "else"; voiceChannel?: string; location?: string;
  date: string; startTime: string; endTime: string; startAtISO: string; endAtISO: string; repeat?: string; banner?: string;
  channel?: string; buttons: Btn[]; signups?: Signup[]; status?: string; source?: string;
  discord?: { status?: string; scheduledEventId?: string; channelId?: string; messageId?: string; jumpUrl?: string; error?: string;
    reminderSentISO?: string; reminderMessageId?: string; startSentISO?: string; startMessageId?: string; closedAtISO?: string;
    postedAtISO?: string; missing?: boolean; refreshedAtISO?: string };
};

const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
const FOOTER = "Cortana Main Operation System";
const ATT_LABEL: Record<string, string> = { main_op: "MAIN OP", patrol: "PATROL", training: "TRAINING", fun_op: "FUN OP" };
const TZ: [string, string][] = [["🇬🇧 UK", "Europe/London"], ["🇪🇺 EU", "Europe/Paris"], ["🇺🇸 EST", "America/New_York"], ["🇺🇸 CST", "America/Chicago"], ["🇺🇸 PST", "America/Los_Angeles"]];
const tzLine = (iso: string) => TZ.map(([l, z]) => `\`${l} ${new Date(iso).toLocaleTimeString("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}\``).join(" ");
const active = (ev: Ev) => (ev.signups ?? []).filter((x) => !x.waiting);
/** Who is pinged on a new sign-up post: Cortana Setup ping list ("everyone" = @everyone).
 *  A channel with its own auto-ping role (squad channels) pings ONLY that role instead.
 *  Not set up yet → @everyone (the unit doesn't use an @Events role). */
const pingRoles = async (channelId?: string): Promise<{ everyone: boolean; roles: string[] }> => {
  const s = await settings();
  const base: string[] = Array.isArray(s.eventPingRoleIds) ? s.eventPingRoleIds : ["everyone"];
  const extra = channelId && s.channelPings && typeof s.channelPings === "object" ? s.channelPings[channelId] : null;
  // Squad channel (e.g. #killjoy-1-1) with its own role → ping ONLY that role, not @everyone.
  const all = typeof extra === "string" && extra ? [extra] : base;
  const roles = [...new Set(all.filter((r): r is string => typeof r === "string" && /^\d{5,25}$/.test(r) && r !== env.AUTHORISED_GUILD_ID))];
  return { everyone: all.includes("everyone"), roles };
};
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
/** Cortana settings: website "Cortana Setup" page (settings/cortana) wins over the older bot_settings/cortana. */
const settings = async () => {
  const [a, b] = await Promise.all([TerminalDoc.findById("bot_settings/cortana", { data: 1 }).lean(), TerminalDoc.findById("settings/cortana", { data: 1 }).lean()]);
  return { ...((a?.data ?? {}) as Record<string, any>), ...((b?.data ?? {}) as Record<string, any>) } as Record<string, any>;
};

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
/** Default sign-up channel: settings → .env → the channel the last sign-up went to → a channel called events / operations. */
async function defaultChannel(g: Guild): Promise<GuildBasedChannel | null> {
  const s = await settings();
  const fromSettings = findChannel(g, s.eventChannelId || env.EVENT_CHANNEL_ID, TEXT);
  if (fromSettings) return fromSettings;
  const last = await TerminalDoc.findOne({ parent: "community_events", "data.discord.channelId": { $exists: true, $ne: null } }, { "data.discord.channelId": 1 }).sort({ updateTime: -1 }).lean();
  const lastCh = findChannel(g, (last as any)?.data?.discord?.channelId, TEXT);
  if (lastCh) return lastCh;
  return g.channels.cache.find((c) => TEXT.includes(c.type) && /^(events?|operations?|ops|event-announcements?|announcements?)$/i.test(c.name)) ?? null;
}
async function postChannel(g: Guild, ev: Ev): Promise<TextBasedChannel> {
  const c = findChannel(g, ev.channel, TEXT) ?? (await defaultChannel(g));
  if (!c || !c.isTextBased()) throw new PermanentJobError(ev.channel ? `Sign-up channel "${ev.channel}" not found in the server — check the event's channel` : "No sign-up channel set — add EVENT_CHANNEL_ID to apps/cortana/.env.local");
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
/** Staff buttons under the sign-up post. Once the event has started, "End Operation" is added. */
function staffRow(id: string, started: boolean) {
  const staff = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`evx:cancel:${id}`).setLabel("Cancel Operation").setStyle(ButtonStyle.Danger),
  );
  if (started) staff.addComponents(new ButtonBuilder().setCustomId(`evx:end:${id}`).setLabel("End Operation").setEmoji("✅").setStyle(ButtonStyle.Success));
  staff.addComponents(new ButtonBuilder().setCustomId(`evx:refresh:${id}`).setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary));
  if (env.SITE_URL) staff.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open on website").setEmoji("🔗").setURL(`${env.SITE_URL.replace(/\/$/, "")}/terminal`));
  return staff;
}
export function signupRows(id: string, ev: Ev, state: State) {
  if (state) return [];
  const su = active(ev);
  if (ev.discord?.startSentISO) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ev.buttons.slice(0, 4).map((b, n) => {
        const btn = new ButtonBuilder().setCustomId(`evl:${id}:${n}`).setLabel(b.label.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(true);
        if (b.emoji) btn.setEmoji(b.emoji);
        return btn;
      }),
    );
    row.addComponents(new ButtonBuilder().setCustomId(`evl:${id}:lock`).setLabel("Locked").setEmoji("🔒").setStyle(ButtonStyle.Secondary).setDisabled(true));
    return [row, staffRow(id, true)];
  }
  const pick = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ev.buttons.slice(0, 5).map((b) => {
      const full = b.limit > 0 && su.filter((x) => x.choice === b.key).length >= b.limit;
      const btn = new ButtonBuilder().setCustomId(`ev:${id}:${b.key}`).setLabel(`${b.label}${full ? " (FULL)" : ""}`.slice(0, 80)).setStyle(STYLE[b.style] ?? ButtonStyle.Secondary);
      if (b.emoji) btn.setEmoji(b.emoji);
      return btn;
    }),
  );
  return [pick, staffRow(id, false)];
}
async function attKind(ev: Ev): Promise<string | null> {
  if ((ev as any).opType && ATT_LABEL[(ev as any).opType]) return ATT_LABEL[(ev as any).opType];
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
const headline = async (ev: Ev, state: State, by?: string, ping: { everyone: boolean; roles: string[] } = { everyone: false, roles: [] }) =>
  state === "cancelled" ? `🚫 **Operation cancelled:** ${ev.title}${by ? ` — cancelled by <@${by}>` : ""}`
  : state === "closed" ? `🚪 **Sign-ups closed:** ${ev.title}`
  : `${[ping.everyone ? "@everyone" : "", ...ping.roles.map((r) => `<@&${r}>`)].filter(Boolean).join(" ")}${ping.everyone || ping.roles.length ? " " : ""}📣 **Signup Open** for **${ev.title}**`;

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
async function publish(client: Client<true>, id: string, opts: { ping?: boolean } = {}) {
  const doPing = opts.ping !== false;
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
      const ping = doPing ? await pingRoles(ch.id) : { everyone: false, roles: [] };
      msg = await ch.send({ ...post, content: await headline(ev, "", undefined, ping), allowedMentions: { roles: ping.roles, parse: ping.everyone ? ["everyone"] : [] } });
    }
    await setDiscord(id, { status: "posted", scheduledEventId: sid, channelId: ch.id, messageId: msg.id, jumpUrl: msg.url, error: null, missing: false, ...(ev.discord?.postedAtISO ? {} : { postedAtISO: nowISO() }), ...(opts.ping === false ? { refreshedAtISO: nowISO() } : {}) });
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
  if (!(await claimCancel(id))) return { cancelled: true, already: true };
  const g = guildOf(client);
  const sid = r.ev.discord?.scheduledEventId;
  if (sid) {
    const se = await g.scheduledEvents.fetch(sid).catch(() => null);
    if (se && se.status === GuildScheduledEventStatus.Scheduled) await se.setStatus(GuildScheduledEventStatus.Canceled).catch(() => se.delete().catch(() => {}));
  }
  await refreshPost(client, id, "cancelled", by);
  await setDiscord(id, { status: "cancelled", closedAtISO: nowISO() });
  await missionLog(client, { ...r.ev, ...(by ? { cancelledBy: by } : {}) } as Ev, "cancelled");
  deleteSoon(client, r.ev);
  void refreshList(client);
  return { cancelled: true };
}

/** Website "Delete": remove the Discord event + sign-up post (+ reminder messages). Same as RCD.
 *  Works from the payload IDs, so it still works if the record is already gone. */
async function removeEvent(client: Client<true>, p: Record<string, any>) {
  const g = guildOf(client);
  const r = p.eventId ? await getEv(String(p.eventId)) : null;
  const d = { ...(r?.ev.discord ?? {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)) } as Record<string, any>;
  let removedPost = false, removedEvent = false;
  if (d.scheduledEventId) {
    const se = await g.scheduledEvents.fetch(String(d.scheduledEventId)).catch(() => null);
    if (se) removedEvent = await se.delete().then(() => true).catch(() => false);
  }
  if (d.channelId) {
    const ch = await client.channels.fetch(String(d.channelId)).catch(() => null);
    if (ch?.isTextBased()) {
      for (const mid of [d.messageId, d.reminderMessageId, d.startMessageId, ...(Array.isArray(p.extraMessageIds) ? p.extraMessageIds : [])].filter(Boolean)) {
        const m = await ch.messages.fetch(String(mid)).catch(() => null);
        if (m && (await m.delete().then(() => true).catch(() => false)) && mid === d.messageId) removedPost = true;
      }
    }
  }
  // The record is deleted right after this job — rebuild the list once it's gone.
  setTimeout(() => refreshList(client), 5000);
  log.info(`Removed "${p.title || p.eventId}" from Discord.`);
  return { removedPost, removedEvent };
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
    if (!r || r.ev.status === "cancelled" || r.ev.discord?.closedAtISO || r.ev.discord?.startSentISO) {
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
  if (action === "end") {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`evx:endok:${id}`).setLabel("Yes, end the operation").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`evx:keep:${id}`).setLabel("Not yet").setStyle(ButtonStyle.Secondary),
    );
    await i.reply({ content: `**End ${r.ev.title} now?** Sign-ups are logged to the mission log, this post is removed and the Discord event ends.`, components: [row], flags: MessageFlags.Ephemeral });
    return true;
  }
  if (action === "endok") {
    await i.update({ content: "Ending…", components: [] });
    await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "completed", "data.completedAtISO": nowISO(), "data.endAtISO": nowISO(), updateTime: new Date() } });
    await completeEvent(i.client, id);
    await TerminalDoc.create({ _id: `audit_logs/${autoId()}`, parent: "audit_logs", docId: autoId(), createTime: new Date(), updateTime: new Date(),
      data: { section: "discord", action: "EVENT ENDED", details: `${r.ev.title} — from Discord`, by: member?.displayName ?? i.user.username, role: "discord", uid: null, createdAtISO: nowISO() } }).catch(() => {});
    await i.editReply("✅ Operation ended and logged.");
    return true;
  }
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
/** Discord-made events: guess the type from the name (change it on the website if wrong). */
const guessType = (t: string) => /patrol/i.test(t) ? "patrol" : /train|\bbct\b|course|class|\bute\b/i.test(t) ? "training" : /fun|game|social|movie|chill/i.test(t) ? "fun_op" : "main_op";
export async function onDiscordEventCreate(client: Client<true>, se: GuildScheduledEvent) {
  if (se.guildId !== env.AUTHORISED_GUILD_ID || se.creatorId === client.user.id) return;
  if ((await settings()).discordEventsSignups === false) return; // Cortana Setup: "Discord-made events get sign-ups" off
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
    channel: (await defaultChannel(se.guild!))?.id ?? "", buttons: DEFAULT_BUTTONS, signups: [], status: "scheduled", source: "discord",
    opType: guessType(`${se.name} ${se.description ?? ""}`),
    discord: { status: "queued", scheduledEventId: se.id },
  };
  await TerminalDoc.create({ _id: `community_events/${id}`, parent: "community_events", docId: id, data: { ...ev, createdByName: "Discord", createdAtISO: now.toISOString(), updatedAtISO: now.toISOString() }, createTime: now, updateTime: now });
  log.info(`Discord event "${se.name}" → sign-up post.`);
  await publish(client, id).catch((e) => log.error("Sign-up post for Discord event failed", e));
}
/** On start: Discord events made while Cortana was offline get picked up and synced too. */
async function catchUpDiscordEvents(client: Client<true>) {
  const g = guildOf(client);
  const list = await g.scheduledEvents.fetch();
  let added = 0;
  for (const se of list.values()) {
    if (se.creatorId === client.user.id || !se.scheduledStartAt || se.scheduledStartAt.getTime() < Date.now()) continue;
    if (se.status === GuildScheduledEventStatus.Canceled || se.status === GuildScheduledEventStatus.Completed) continue;
    if (await TerminalDoc.exists({ parent: "community_events", "data.discord.scheduledEventId": se.id })) continue;
    await onDiscordEventCreate(client, se);
    added++;
  }
  if (added) log.info(`Caught up ${added} Discord event(s) made while offline.`);
}
export async function onDiscordEventUpdate(client: Client<true>, se: GuildScheduledEvent) {
  if (se.guildId !== env.AUTHORISED_GUILD_ID) return;
  if (se.status === GuildScheduledEventStatus.Completed) {
    // "End Event" pressed in Discord (any event, website- or Discord-made) → same as website END EVENT.
    const c = await TerminalDoc.findOne({ parent: "community_events", "data.discord.scheduledEventId": se.id, "data.status": { $ne: "cancelled" } }, { docId: 1, "data.discord.closedAtISO": 1 }).lean();
    if (c && !(c as any).data?.discord?.closedAtISO) {
      await TerminalDoc.updateOne({ _id: c._id }, { $set: { "data.status": "completed", "data.completedAtISO": nowISO(), "data.endAtISO": nowISO(), updateTime: new Date() } });
      await completeEvent(client, String(c.docId));
    }
    return;
  }
  const d = await TerminalDoc.findOne({ parent: "community_events", "data.discord.scheduledEventId": se.id, "data.source": "discord" }, { docId: 1 }).lean();
  if (!d) return;
  if (se.status === GuildScheduledEventStatus.Canceled) return void (await markCancelled(client, String(d.docId)));
  if (se.status === GuildScheduledEventStatus.Active) return;
  const start = se.scheduledStartAt!, end = se.scheduledEndAt ?? new Date(start.getTime() + 2 * 3600_000);
  const a = ukParts(start), b = ukParts(end);
  await TerminalDoc.updateOne({ _id: d._id }, { $set: { "data.title": se.name, "data.description": se.description ?? "", "data.date": a.date, "data.startTime": a.time, "data.endTime": b.time, "data.startAtISO": start.toISOString(), "data.endAtISO": end.toISOString(), updateTime: new Date() } });
  await refreshPost(client, String(d.docId));
}
export async function onDiscordEventDelete(client: Client<true>, se: GuildScheduledEvent | PartialGuildScheduledEvent) {
  // Deleted by Cortana itself for a website "Delete" — nothing to mark.
  if (await TerminalDoc.exists({ parent: "bot_jobs", "data.type": "event.remove", "data.payload.scheduledEventId": se.id })) return;
  const d = await TerminalDoc.findOne({ parent: "community_events", "data.discord.scheduledEventId": se.id, "data.status": { $ne: "cancelled" } }, { docId: 1, "data.discord.closedAtISO": 1 }).lean();
  if (d && !((d as any).data)?.discord?.closedAtISO) await markCancelled(client, String(d.docId));
}
async function markCancelled(client: Client<true>, id: string) {
  if (!(await claimCancel(id))) return; // already handled (e.g. Discord echoing our own cancel)
  await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "cancelled", "data.cancelledAtISO": nowISO(), updateTime: new Date() } });
  await refreshPost(client, id, "cancelled");
  await setDiscord(id, { status: "cancelled", closedAtISO: nowISO() });
  const r = await getEv(id);
  if (r) {
    await missionLog(client, r.ev, "cancelled");
    deleteSoon(client, r.ev);
  }
  void refreshList(client);
}

/** True only the FIRST time an event's cancel is handled — stops double logs when Discord echoes our own cancel back. */
async function claimCancel(id: string): Promise<boolean> {
  const r = await TerminalDoc.updateOne({ _id: `community_events/${id}`, "data.discord.cancelHandledISO": { $exists: false } }, { $set: { "data.discord.cancelHandledISO": nowISO(), updateTime: new Date() } });
  return r.modifiedCount === 1;
}

/** Cancelled posts stay visible for 30 s (so people see it's off), then are deleted. */
function deleteSoon(client: Client<true>, ev: Ev) {
  const d = ev.discord;
  if (!d?.channelId) return;
  setTimeout(async () => {
    const ch = await client.channels.fetch(d.channelId!).catch(() => null);
    if (!ch?.isTextBased()) return;
    for (const mid of [d.messageId, d.reminderMessageId, d.startMessageId]) if (mid) await (await ch.messages.fetch(mid).catch(() => null))?.delete().catch(() => {});
  }, 30_000);
}

/* ───────── mission log ───────── */
async function missionLog(client: Client<true>, ev: Ev, kind: "archived" | "cancelled") {
  const s = await settings();
  const ref = s.missionLogChannelId || env.MISSION_LOG_CHANNEL_ID;
  if (!ref) return;
  const ch = findChannel(guildOf(client), ref, TEXT);
  if (!ch?.isTextBased() || !("send" in ch)) return;
  const su = active(ev);
  const att = su.filter((x) => ev.buttons.find((b) => b.key === x.choice)?.attending).length;
  const e = new EmbedBuilder()
    .setColor(kind === "cancelled" ? 0xff4d4d : 0x22e07a)
    .setAuthor({ name: "505TH EXPEDITIONARY FORCE · MISSION LOG", iconURL: LOGO })
    .setTitle(`[EVENT] | "${ev.title}" | ${kind === "cancelled" ? "Cancelled" : "Sign-ups closed"}`.slice(0, 256))
    .setThumbnail(LOGO)
    .addFields({ name: "Scheduled start", value: `${ts(ev.startAtISO)} · ${ev.startTime}–${ev.endTime} UK` });
  for (const b of ev.buttons) {
    const list = su.filter((x) => x.choice === b.key);
    e.addFields({ name: `${b.emoji} ${b.label} (${list.length})`.slice(0, 256), value: (list.map((x) => `<@${x.discordId}> ${x.name ? `(${x.name})` : ""}`.trim()).join("\n") || "—").slice(0, 1024) });
  }
  const waiting = (ev.signups ?? []).filter((x) => x.waiting);
  if (waiting.length) e.addFields({ name: `⏳ Waiting list (${waiting.length})`, value: waiting.map((x) => `<@${x.discordId}>`).join(", ").slice(0, 1024) });
  if ((ev as any).attendanceEventId && kind === "archived") e.addFields({ name: "Attendance", value: "Linked — staff confirm who really turned up in the terminal's Attendance Check." });
  if (kind === "cancelled" && (ev as any).cancelledBy) e.addFields({ name: "Cancelled by", value: `<@${(ev as any).cancelledBy}>` });
  e.setFooter({ text: `${att} signed up to attend · ${FOOTER}`, iconURL: LOGO }).setTimestamp();
  await ch.send({ content: kind === "cancelled" ? `🚫 Cancelled: **${ev.title}**` : `📦 Archived: **${ev.title}**`, embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}

/* ───────── scheduler: reminders, start, close, repeat ───────── */
/** Website "END EVENT": close now — log, delete the posts, mark the Discord event Completed. Safe to run twice. */
async function completeEvent(client: Client<true>, id: string) {
  const r = await getEv(id);
  if (!r) return;
  const ev = r.ev;
  if (!ev.discord?.closedAtISO && ev.discord?.status === "posted") {
    const ch = ev.discord.channelId ? await client.channels.fetch(ev.discord.channelId).catch(() => null) : null;
    await setDiscord(id, { closedAtISO: nowISO(), postDeletedISO: nowISO() }); // first, so Discord echoes are ignored
    await missionLog(client, ev, "archived");
    if (ch?.isTextBased()) for (const mid of [ev.discord.messageId, ev.discord.reminderMessageId, ev.discord.startMessageId]) if (mid) await (await ch.messages.fetch(mid).catch(() => null))?.delete().catch(() => {});
    if (ev.repeat === "weekly" || ev.repeat === "fortnightly") await nextOccurrence(client, id, ev);
  }
  const se = ev.discord?.scheduledEventId ? await guildOf(client).scheduledEvents.fetch(ev.discord.scheduledEventId).catch(() => null) : null;
  if (se?.status === GuildScheduledEventStatus.Active) await se.setStatus(GuildScheduledEventStatus.Completed).catch(() => {});
  else if (se?.status === GuildScheduledEventStatus.Scheduled) await se.delete().catch(() => {}); // Discord can't complete an event it never started
  void refreshList(client);
  log.info(`Event "${ev.title}" ended from the website.`);
}

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
      if (!ev.discord?.startSentISO && now >= start && now < start + 30 * 60_000) {
        const where = ev.where === "else" ? `📍 ${ev.location || ""}` : (() => { const vc = findChannel(guildOf(client), ev.voiceChannel, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]); return vc ? `🔊 <#${vc.id}>` : `🔊 ${ev.voiceChannel || ""}`; })();
        // Ping ONLY the people who chose an attending option (Going / BLUFOR …) — nobody else.
        const m = await ch.send({ content: `${going.length ? going.map((x) => `<@${x}>`).join(" ") + "\n" : ""}🚨 **${ev.title}** has started! Join ${where}`.slice(0, 2000), allowedMentions: { users: going.slice(0, 100) } });
        await setDiscord(id, { startSentISO: nowISO(), startMessageId: m.id });
        ev.discord = { ...ev.discord, startSentISO: nowISO() };
      }
      if (ev.discord?.startSentISO && !(ev.discord as any).lockedISO && now < Math.min(start + 30 * 60_000, end)) {
        // Event started: lock the sign-up post (buttons greyed out + 🔒 Locked).
        const post = ev.discord?.messageId ? await ch.messages.fetch(ev.discord.messageId).catch(() => null) : null;
        if (post) await post.edit({ components: signupRows(id, ev, "") });
        await setDiscord(id, { lockedISO: nowISO() } as any);
      }
      if (now >= Math.min(start + 30 * 60_000, end)) {
        // Sign-ups closed: log who chose what, then delete the sign-up post and the "started" message.
        await missionLog(client, ev, "archived");
        for (const mid of [ev.discord?.messageId, ev.discord?.reminderMessageId, ev.discord?.startMessageId]) if (mid) await (await ch.messages.fetch(mid).catch(() => null))?.delete().catch(() => {});
        await setDiscord(id, { status: "posted", closedAtISO: nowISO(), postDeletedISO: nowISO() });
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
  // Old Cortana layout (renderEventListEmbed.js) + type, sign-up link. No counts.
  const hm = (iso: string, z: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const e = new EmbedBuilder().setColor(0x194a77).setTitle("📅 Upcoming Events").setThumbnail(LOGO)
    .setFooter({ text: "505th Event List • PDT as Base Time ⏳", iconURL: LOGO });
  if (!evs.length) e.setDescription("There are currently no scheduled events.");
  const gid = g.id;
  for (const { ev } of evs) {
    const kind = await attKind(ev);
    const pdt = new Date(ev.startAtISO).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const t = ev.startAtISO;
    const links = [ev.discord?.scheduledEventId ? `[🔗 View Event](https://discord.com/events/${gid}/${ev.discord.scheduledEventId})` : "", ev.discord?.jumpUrl ? `[📝 Sign up](${ev.discord.jumpUrl})` : ""].filter(Boolean).join(" · ");
    const value = [kind ? `> **${kind}**` : "",
      `> 🇬🇧 **BST/GMT**: \`${hm(t, "Europe/London")}\`  🇪🇺 **CEST/CET**: \`${hm(t, "Europe/Paris")}\``,
      `> 🇺🇸 **CDT**: \`${hm(t, "America/Chicago")}\`  🇺🇸 **EST**: \`${hm(t, "America/New_York")}\``,
      `> 🇺🇸 **PDT**: \`${hm(t, "America/Los_Angeles")}\`  ${ts(t, "R")}`,
      links ? `> ${links}` : ""].filter(Boolean).join("\n");
    e.addFields({ name: `📌 ${pdt} PDT – ${ev.title}`.slice(0, 256), value: value.slice(0, 1024) });
  }
  const st = (await TerminalDoc.findById("bot_state/cortana", { data: 1 }).lean())?.data as any;
  const old = st?.eventListMessageId && st.eventListChannelId === ch.id ? await ch.messages.fetch(st.eventListMessageId).catch(() => null) : null;
  if (old) await old.edit({ content: "Current scheduled events:", embeds: [e], allowedMentions: { parse: [] } });
  else {
    const m = await ch.send({ content: "Current scheduled events:", embeds: [e], allowedMentions: { parse: [] } });
    await TerminalDoc.updateOne({ _id: "bot_state/cortana" }, { $set: { parent: "bot_state", docId: "cortana", "data.eventListChannelId": ch.id, "data.eventListMessageId": m.id, updateTime: new Date() } }, { upsert: true });
  }
}

/** Discord-made events that never got a post (no channel at the time, Cortana restarted …) are retried. */
async function retryUnposted(client: Client<true>) {
  const docs = await TerminalDoc.find({ parent: "community_events", "data.source": "discord", "data.status": { $ne: "cancelled" }, "data.discord.status": { $in: ["queued", "failed"] }, "data.startAtISO": { $gt: nowISO() } }, { docId: 1, "data.channel": 1 }).lean();
  const g = guildOf(client);
  for (const d of docs) {
    if (!(d as any).data?.channel) {
      const c = await defaultChannel(g);
      if (!c) continue;
      await TerminalDoc.updateOne({ _id: d._id }, { $set: { "data.channel": c.id } });
    }
    await publish(client, String(d.docId)).catch((e) => log.warn(`Retry sign-up post failed: ${(e as Error).message}`));
  }
}


/* ───────── refresh (approved mock 2026-11-11) ─────────
 * ↻ REFRESH POST: post still there → edit it (counts, names, lock) · gone → post again in the same channel (no ping
 * unless asked) · Discord calendar event missing → made again. Finished / cancelled events are left alone.
 * Also runs by itself when Cortana starts (e.g. after the home server was down) and checks posts every 10 minutes.
 */
const openEv = (ev: Ev) => ev.status !== "cancelled" && ev.status !== "completed" && !ev.discord?.closedAtISO && Date.parse(ev.endAtISO) > Date.now();

async function postExists(client: Client<true>, ev: Ev) {
  if (!ev.discord?.channelId || !ev.discord.messageId) return false;
  const ch = await client.channels.fetch(ev.discord.channelId).catch(() => null);
  if (!ch?.isTextBased()) return false;
  return !!(await ch.messages.fetch(ev.discord.messageId).catch(() => null));
}

async function refreshOne(client: Client<true>, id: string, ping = false) {
  const r = await getEv(id);
  if (!r) throw new PermanentJobError("Event not found");
  if (!openEv(r.ev)) return { skipped: "finished" };
  const had = r.ev.discord?.status === "posted" && (await postExists(client, r.ev));
  await publish(client, id, { ping });
  return { fixed: !had };
}

/** Upcoming / running events whose post is missing, failed or still waiting. `all` = every open event. */
async function refreshAll(client: Client<true>, all: boolean) {
  const docs = await TerminalDoc.find({ parent: "community_events", "data.status": { $nin: ["cancelled", "completed"] }, "data.discord.closedAtISO": { $exists: false }, "data.endAtISO": { $gt: nowISO() } }, { docId: 1, data: 1 }).lean();
  let fixed = 0, updated = 0, failed = 0;
  for (const d of docs) {
    const ev = d.data as Ev;
    const ok = ev.discord?.status === "posted" && (await postExists(client, ev));
    if (ok && !all) continue;
    try {
      await publish(client, String(d.docId), { ping: false });
      ok ? updated++ : fixed++;
    } catch (e) {
      failed++;
      log.warn(`Refresh "${ev.title}" failed: ${(e as Error).message}`);
    }
  }
  return { fixed, updated, failed };
}

/** Every 10 minutes: mark posts that were deleted in Discord (Events page shows ⚠ POST MISSING). */
async function checkPosts(client: Client<true>) {
  const docs = await TerminalDoc.find({ parent: "community_events", "data.status": { $nin: ["cancelled", "completed"] }, "data.discord.status": "posted", "data.discord.closedAtISO": { $exists: false }, "data.endAtISO": { $gt: nowISO() } }, { docId: 1, data: 1 }).lean();
  for (const d of docs) {
    const ev = d.data as Ev;
    const missing = !(await postExists(client, ev));
    if (missing !== !!ev.discord?.missing) await setDiscord(String(d.docId), { missing });
  }
}

/* ───────── monthly clean-up ─────────
 * On the 1st of each month (UK), events from earlier months that are finished or cancelled
 * are removed from the Events page. Their sign-up details are copied onto the linked
 * attendance record first (Attendance Tracker keeps everything), and any leftover Discord
 * sign-up post is deleted. The #mission-log archive posts stay.
 */
async function monthlyCleanup(client: Client<true>) {
  const ukMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7); // YYYY-MM
  const st = ((await TerminalDoc.findById("bot_state/cortana", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
  if (st.lastEventCleanup === ukMonth) return;
  const monthStart = new Date(`${ukMonth}-01T00:00:00Z`).toISOString();
  const docs = await TerminalDoc.find({ parent: "community_events", "data.endAtISO": { $lt: monthStart } }, { docId: 1, data: 1 }).lean();
  let removed = 0;
  for (const d of docs) {
    const ev = d.data as Ev & { attendanceEventId?: string };
    const finished = ev.status === "cancelled" || Date.parse(ev.endAtISO) < Date.now();
    if (!finished) continue;
    if (ev.attendanceEventId) {
      await TerminalDoc.updateOne({ _id: `attendance_events/${ev.attendanceEventId}` }, {
        $set: {
          "data.linkedEventId": null,
          "data.eventArchive": {
            title: ev.title, startAtISO: ev.startAtISO, endAtISO: ev.endAtISO, status: ev.status ?? "scheduled",
            buttons: ev.buttons.map((b) => ({ key: b.key, emoji: b.emoji, label: b.label, attending: b.attending })),
            signups: (ev.signups ?? []).map((x) => ({ uid: x.uid ?? null, name: x.name, choice: x.choice, waiting: !!x.waiting })),
            archivedAtISO: nowISO(),
          },
          updateTime: new Date(),
        },
      }).catch(() => {});
    }
    if (ev.discord?.channelId && ev.discord.messageId) {
      const ch = await client.channels.fetch(ev.discord.channelId).catch(() => null);
      if (ch?.isTextBased()) await (await ch.messages.fetch(ev.discord.messageId).catch(() => null))?.delete().catch(() => {});
    }
    await TerminalDoc.deleteOne({ _id: d._id });
    removed++;
  }
  await TerminalDoc.updateOne({ _id: "bot_state/cortana" }, { $set: { parent: "bot_state", docId: "cortana", "data.lastEventCleanup": ukMonth, updateTime: new Date() } }, { upsert: true });
  if (removed) {
    const now = new Date();
    const aid = autoId();
    await TerminalDoc.create({ _id: `audit_logs/${aid}`, parent: "audit_logs", docId: aid, createTime: now, updateTime: now,
      data: { section: "discord", action: "EVENTS CLEANED UP", details: `${removed} finished / cancelled event(s) from before ${ukMonth} removed — details kept in Attendance Tracker`, by: "Cortana", role: "system", uid: null, createdAtISO: now.toISOString() } }).catch(() => {});
    refreshList(client);
  }
  log.info(`Monthly event clean-up (${ukMonth}): ${removed} removed.`);
}

/* ───────── wiring ───────── */
export function startEvents(client: Client<true>) {
  registerJob("event.publish", (job, c) => publish(c, String(job.data.payload?.eventId ?? "")));
  registerJob("event.cancel", (job, c) => cancel(c, String(job.data.payload?.eventId ?? "")));
  registerJob("event.complete", async (job, c) => (await completeEvent(c, String(job.data.payload?.eventId ?? "")), {}));
  registerJob("event.remove", (job, c) => removeEvent(c, (job.data.payload ?? {}) as Record<string, any>));
  registerJob("event.refresh", async (job, c) => {
    if (!(await uidAllowed(String(job.data.requestedBy ?? ""), "ev")).ok) throw new PermanentJobError("No Events access");
    return refreshOne(c, String(job.data.payload?.eventId ?? ""), job.data.payload?.ping === true);
  });
  registerJob("event.refreshAll", async (job, c) => {
    if (!(await uidAllowed(String(job.data.requestedBy ?? ""), "ev")).ok) throw new PermanentJobError("No Events access");
    return refreshAll(c, job.data.payload?.all === true);
  });
  // Back online (e.g. after the home server was down): fix every missing / waiting / failed post, no pings.
  setTimeout(() => void refreshAll(client, false).then(async (r) => {
    if (r.fixed || r.failed) {
      log.info(`Events: back online — ${r.fixed} sign-up post(s) fixed${r.failed ? `, ${r.failed} failed` : ""}.`);
      await auditLog("EVENTS CHECKED ON START", `Cortana back online — ${r.fixed} sign-up post${r.fixed === 1 ? "" : "s"} fixed${r.failed ? ` · ${r.failed} failed` : ""}`, "Cortana", "discord").catch(() => {});
    }
  }).catch((e) => log.error("Events start-up refresh failed", e)), 15_000);
  let n = 0;
  const run = () => {
    tick(client).catch((e) => log.error("Event scheduler failed", e));
    if (n % 60 === 0) retryUnposted(client).catch((e) => log.error("Retry failed", e));
    if (n % 10 === 5) checkPosts(client).catch((e) => log.warn(`Post check failed: ${(e as Error).message}`));
    if (n++ % 60 === 0) monthlyCleanup(client).catch((e) => log.error("Monthly clean-up failed", e)); // checks hourly, runs once a month
  };
  void run();
  void catchUpDiscordEvents(client).catch((e) => log.error("Discord event catch-up failed", e));
  refreshList(client);
  const t = setInterval(run, 60_000);
  return () => clearInterval(t);
}
