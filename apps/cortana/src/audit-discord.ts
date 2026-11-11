/**
 * AUDIT LOG v3 — records the Discord server into the website Audit Log (Security → Audit Log).
 * Messages (deleted / edited / bulk deleted, with pictures, GIFs and clips) · members (joined, left,
 * renamed, profile picture, roles, timeout) · moderation (kick, ban, unban) · voice · server
 * (channels, roles, invites).
 *
 * Entries: audit_logs/{id} with data.source = "discord" and data.cat = messages|members|moderation|roles|voice|server.
 * Settings: settings/audit → record { messages, members, … } (true unless switched off) and ignoreChannels [ids].
 * Pictures: copied to Cloudinary when posted (audit_media/{messageId}) — only when CLOUDINARY_* are set in .env.local.
 * Needs: Server Members + Message Content intents (on), "View Audit Log" permission for "who did it".
 */
import { createHash } from "node:crypto";
import {
  AuditLogEvent, Events, type Client, type Collection, type Guild, type GuildBan, type GuildMember, type Invite, type Message,
  type PartialGuildMember, type PartialMessage, type PartialUser, type ReadonlyCollection, type Snowflake, type User, type VoiceState,
} from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { autoId } from "./util.ts";

type Cat = "messages" | "members" | "moderation" | "roles" | "voice" | "server";
type Media = { url: string; name: string; kind: string; publicId?: string; rtype?: string };
type Entry = {
  cat: Cat; action: string; details: string; by?: string; byId?: string | null; target?: string; targetId?: string | null;
  channel?: string; channelId?: string | null; before?: string; after?: string; content?: string; media?: Media[];
  bulk?: { at: string; author: string; content: string; media?: Media[] }[]; extra?: Record<string, unknown>;
};

// ───────── settings (cached 30 s) ─────────
let cfg: { record: Record<string, boolean>; ignore: Set<string>; at: number } = { record: {}, ignore: new Set(), at: 0 };
async function settings() {
  if (Date.now() - cfg.at < 30_000) return cfg;
  const d = ((await TerminalDoc.findById("settings/audit", { data: 1 }).lean().catch(() => null))?.data ?? {}) as Record<string, any>;
  cfg = { record: d.record ?? {}, ignore: new Set(Array.isArray(d.ignoreChannels) ? d.ignoreChannels.map(String) : []), at: Date.now() };
  return cfg;
}
const on = (c: typeof cfg, cat: Cat) => c.record[cat] !== false;

const cut = (s: unknown, n = 1500) => { const t = String(s ?? ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const kindOf = (name: string, type?: string | null) =>
  /gif$/i.test(name) || /gif/.test(type ?? "") ? "gif" : /^video\//.test(type ?? "") || /\.(mp4|mov|webm|mkv)$/i.test(name) ? "clip" : /^image\//.test(type ?? "") || /\.(png|jpe?g|webp|bmp)$/i.test(name) ? "picture" : "file";

async function write(e: Entry) {
  const c = await settings();
  if (!on(c, e.cat)) return;
  if (e.channelId && c.ignore.has(e.channelId)) return;
  const id = autoId();
  const now = new Date();
  await TerminalDoc.create({
    _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: {
      source: "discord", cat: e.cat, section: "server", action: e.action, details: cut(e.details, 500), by: e.by ?? "—", byId: e.byId ?? null,
      target: e.target ?? null, targetId: e.targetId ?? null, channel: e.channel ?? null, channelId: e.channelId ?? null,
      before: e.before != null ? cut(e.before) : null, after: e.after != null ? cut(e.after) : null, content: e.content != null ? cut(e.content, 2000) : null,
      media: e.media?.length ? e.media : null, bulk: e.bulk?.length ? e.bulk : null, ...(e.extra ?? {}),
      role: "discord", uid: null, createdAt: now, createdAtISO: now.toISOString(),
    },
  }).catch((x) => log.warn(`Audit write failed: ${(x as Error).message}`));
}

/** Who did it, from Discord's own audit log (best effort — needs "View Audit Log"). */
async function executor(g: Guild, type: AuditLogEvent, targetId?: string | null, withinMs = 8000) {
  try {
    const logs = await g.fetchAuditLogs({ type, limit: 5 });
    const hit = logs.entries.find((x) => (!targetId || (x.target as { id?: string } | null)?.id === targetId) && Date.now() - x.createdTimestamp < withinMs);
    return hit ? { name: hit.executor?.tag ?? "Unknown", id: hit.executor?.id ?? null, reason: hit.reason ?? null } : null;
  } catch {
    return null;
  }
}
const tag = (u: User | PartialUser | null | undefined) => (u && "tag" in u && u.tag ? u.tag : u?.id ? `User ${u.id}` : "Unknown");
const nameOf = (m: GuildMember | PartialGuildMember) => (m.displayName && m.user?.tag && m.displayName !== m.user.username ? `${m.displayName} (${m.user.tag})` : tag(m.user));
const chName = (c: unknown) => { const x = c as { name?: string } | null; return x?.name ? `#${x.name}` : "#unknown"; };

// ───────── media copies (Cloudinary) ─────────
const CLOUD = env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET ? { name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET } : null;
const sign = (params: Record<string, string>) =>
  createHash("sha1").update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + CLOUD!.secret).digest("hex");

async function upload(url: string): Promise<{ url: string; publicId: string; rtype: string } | null> {
  if (!CLOUD) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const p = { folder: "505th_audit", timestamp };
  const body = new URLSearchParams({ ...p, file: url, api_key: CLOUD.key, signature: sign(p) });
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD.name}/auto/upload`, { method: "POST", body }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json()) as { secure_url?: string; public_id?: string; resource_type?: string };
  return j.secure_url && j.public_id ? { url: j.secure_url, publicId: j.public_id, rtype: j.resource_type ?? "image" } : null;
}
export async function destroyMedia(items: { publicId?: string; rtype?: string }[]) {
  if (!CLOUD) return 0;
  let n = 0;
  for (const m of items) {
    if (!m.publicId) continue;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const p = { public_id: m.publicId, timestamp };
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD.name}/${m.rtype || "image"}/destroy`, { method: "POST", body: new URLSearchParams({ ...p, api_key: CLOUD.key, signature: sign(p) }) }).catch(() => null);
    if (r?.ok) n++;
  }
  return n;
}

const MAX_BYTES = 50 * 1024 * 1024;
async function copyMedia(m: Message) {
  if (!m.guild || m.author?.bot) return;
  const c = await settings();
  if (!on(c, "messages") || c.ignore.has(m.channelId)) return;
  const files = [...m.attachments.values()].filter((a) => a.size <= MAX_BYTES).map((a) => ({ src: a.url, name: a.name ?? "file", kind: kindOf(a.name ?? "", a.contentType) }));
  // GIFs from the GIF picker arrive as embeds (Tenor / Giphy).
  for (const e of m.embeds) {
    const v = e.video?.url || e.thumbnail?.url;
    if ((e.provider?.name === "Tenor" || e.provider?.name === "GIPHY" || (e.data as { type?: string }).type === "gifv") && v) files.push({ src: v, name: "gif", kind: "gif" });
  }
  if (!files.length) return;
  const items: Media[] = [];
  for (const f of files.slice(0, 10)) {
    const up = await upload(f.src);
    items.push(up ? { url: up.url, publicId: up.publicId, rtype: up.rtype, name: f.name, kind: f.kind } : { url: f.src, name: f.name, kind: f.kind });
  }
  const now = new Date();
  await TerminalDoc.create({ _id: `audit_media/${m.id}`, parent: "audit_media", docId: m.id, createTime: now, updateTime: now, data: { channelId: m.channelId, authorId: m.author?.id ?? null, items, createdAtISO: now.toISOString() } }).catch(() => {});
}
async function mediaFor(m: Message | PartialMessage): Promise<Media[]> {
  const saved = ((await TerminalDoc.findById(`audit_media/${m.id}`, { data: 1 }).lean().catch(() => null))?.data as { items?: Media[] } | undefined)?.items;
  if (saved?.length) return saved;
  return [...(m.attachments?.values() ?? [])].map((a) => ({ url: a.url, name: a.name ?? "file", kind: kindOf(a.name ?? "", a.contentType) }));
}
const describe = (media: Media[]) => (media.length ? ` [${media.map((x) => `${x.kind.toUpperCase()} ${x.name}`).join(", ")}]` : "");

// ───────── messages ─────────
async function onDelete(m: Message | PartialMessage) {
  if (!m.guild || m.author?.bot) return;
  const media = await mediaFor(m);
  const ex = m.author ? await executor(m.guild, AuditLogEvent.MessageDelete, m.author.id, 5000) : null;
  const who = m.author ? tag(m.author) : "Unknown (message was sent before Cortana started)";
  await write({
    cat: "messages", action: "MESSAGE DELETED", channel: chName(m.channel), channelId: m.channelId,
    by: ex?.name ?? (m.author ? tag(m.author) : "Unknown"), byId: ex?.id ?? m.author?.id ?? null, target: who, targetId: m.author?.id ?? null,
    content: m.content ?? undefined, media,
    details: `${who}'s message in ${chName(m.channel)} deleted by ${ex ? ex.name : "themself"} — "${cut(m.content || "", 140)}"${describe(media)}`,
  });
}

async function onBulk(msgs: ReadonlyCollection<Snowflake, Message | PartialMessage>, ch: unknown) {
  const first = msgs.first();
  const g = first?.guild;
  if (!g) return;
  const ex = await executor(g, AuditLogEvent.MessageBulkDelete, (ch as { id?: string })?.id, 10_000);
  const purge = ((await TerminalDoc.findOne({ parent: "mod_purges", "data.channelId": first?.channelId }, { data: 1 }).sort({ createTime: -1 }).lean().catch(() => null))?.data ?? null) as Record<string, any> | null;
  const recent = purge && Date.now() - Date.parse(purge.createdAtISO ?? purge.atISO ?? 0) < 60_000 ? purge : null;
  const sorted = [...msgs.values()].sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
  const bulk = [];
  for (const m of sorted) bulk.push({ at: new Date(m.createdTimestamp ?? Date.now()).toISOString(), author: m.author ? tag(m.author) : "Unknown (not cached)", content: cut(m.content ?? "", 500), media: await mediaFor(m) });
  const authors = new Map<string, number>();
  bulk.forEach((b) => authors.set(b.author, (authors.get(b.author) ?? 0) + 1));
  const by = recent?.byName ?? ex?.name ?? "Unknown";
  await write({
    cat: "messages", action: "BULK DELETE", channel: chName(ch), channelId: first?.channelId ?? null, by, byId: ex?.id ?? null,
    bulk, extra: { reason: recent?.reason ?? ex?.reason ?? null, count: msgs.size },
    details: `${by} deleted ${msgs.size} messages in ${chName(ch)}${recent?.reason || ex?.reason ? ` — "${recent?.reason ?? ex?.reason}"` : ""} · from ${[...authors].map(([a, n]) => `${a} (${n})`).join(", ")}`,
  });
}

async function onEdit(a: Message | PartialMessage, b: Message | PartialMessage) {
  if (!b.guild || b.author?.bot) return;
  if (a.content == null || a.content === b.content) return; // embeds loading, pins, or not cached
  await write({
    cat: "messages", action: "MESSAGE EDITED", channel: chName(b.channel), channelId: b.channelId, by: tag(b.author), byId: b.author?.id ?? null,
    target: tag(b.author), targetId: b.author?.id ?? null, before: a.content, after: b.content ?? "", extra: { messageUrl: b.url },
    details: `${tag(b.author)} in ${chName(b.channel)}: "${cut(a.content, 120)}" → "${cut(b.content ?? "", 120)}"`,
  });
}

// ───────── members ─────────
const invites = new Map<string, number>();
async function loadInvites(g: Guild) {
  const list = await g.invites.fetch().catch(() => null);
  if (list) { invites.clear(); list.forEach((i) => invites.set(i.code, i.uses ?? 0)); }
}
async function onJoin(m: GuildMember) {
  const before = new Map(invites);
  await loadInvites(m.guild);
  let used: Invite | null = null;
  const list = await m.guild.invites.fetch().catch(() => null);
  list?.forEach((i) => { if ((i.uses ?? 0) > (before.get(i.code) ?? 0)) used = i; });
  const inv = used as Invite | null;
  const days = Math.floor((Date.now() - m.user.createdTimestamp) / 864e5);
  const age = days > 365 ? `${Math.floor(days / 365)} year(s)` : `${days} day(s)`;
  await write({
    cat: "members", action: "JOINED", by: tag(m.user), byId: m.id, target: tag(m.user), targetId: m.id,
    extra: { avatar: m.user.displayAvatarURL({ size: 128 }), accountAgeDays: days, invite: inv ? { code: inv.code, by: inv.inviter?.tag ?? null } : null, memberCount: m.guild.memberCount },
    details: `${tag(m.user)} joined · account age ${age}${days < 7 ? " ⚠ NEW ACCOUNT" : ""}${inv ? ` · invite ${inv.code}${inv.inviter ? ` (by ${inv.inviter.tag})` : ""}` : ""} · member #${m.guild.memberCount}`,
  });
}
async function onLeave(m: GuildMember | PartialGuildMember) {
  await new Promise((r) => setTimeout(r, 1500)); // give Discord time to write the kick / ban record
  if (await executor(m.guild, AuditLogEvent.MemberBanAdd, m.id, 10_000)) return; // the ban entry covers it
  const kick = await executor(m.guild, AuditLogEvent.MemberKick, m.id, 10_000);
  const roles = m.roles?.cache.filter((r) => r.id !== m.guild.id).map((r) => r.name) ?? [];
  const months = m.joinedTimestamp ? Math.floor((Date.now() - m.joinedTimestamp) / (30 * 864e5)) : null;
  if (kick)
    return write({ cat: "moderation", action: "KICKED", by: kick.name, byId: kick.id, target: nameOf(m), targetId: m.id, extra: { reason: kick.reason },
      details: `${nameOf(m)} kicked by ${kick.name}${kick.reason ? ` — "${kick.reason}"` : ""}` });
  await write({
    cat: "members", action: "LEFT", by: nameOf(m), byId: m.id, target: nameOf(m), targetId: m.id, extra: { roles },
    details: `${nameOf(m)} left${months != null ? ` · was here ${months < 1 ? "under a month" : months + " month(s)"}` : ""}${roles.length ? ` · roles: ${roles.slice(0, 8).join(", ")}` : ""}`,
  });
}
async function onMemberUpdate(a: GuildMember | PartialGuildMember, b: GuildMember) {
  if (b.user.bot) return;
  if (a.nickname !== undefined && a.nickname !== b.nickname) {
    const ex = await executor(b.guild, AuditLogEvent.MemberUpdate, b.id, 5000);
    await write({ cat: "members", action: "RENAMED", by: ex?.name ?? tag(b.user), byId: ex?.id ?? b.id, target: tag(b.user), targetId: b.id, before: a.nickname ?? b.user.username, after: b.nickname ?? b.user.username,
      details: `${tag(b.user)} nickname: "${a.nickname ?? b.user.username}" → "${b.nickname ?? b.user.username}"${ex && ex.id !== b.id ? ` (by ${ex.name})` : ""}` });
  }
  if (a.avatar !== undefined && a.avatar !== b.avatar) {
    await write({ cat: "members", action: "AVATAR CHANGED", by: tag(b.user), byId: b.id, target: tag(b.user), targetId: b.id, extra: { scope: "server", oldAvatar: a.avatarURL?.({ size: 128 }) ?? null, newAvatar: b.displayAvatarURL({ size: 128 }) },
      details: `${tag(b.user)} changed their server profile picture` });
  }
  if (!a.partial) {
    const added = b.roles.cache.filter((r) => !a.roles.cache.has(r.id)).map((r) => r.name);
    const removed = a.roles.cache.filter((r) => !b.roles.cache.has(r.id)).map((r) => r.name);
    if (added.length || removed.length) {
      const ex = await executor(b.guild, AuditLogEvent.MemberRoleUpdate, b.id, 5000);
      await write({ cat: "roles", action: "ROLES CHANGED", by: ex?.name ?? "Unknown", byId: ex?.id ?? null, target: nameOf(b), targetId: b.id, extra: { added, removed },
        details: `${nameOf(b)}${added.length ? ` + ${added.join(", ")}` : ""}${removed.length ? ` − ${removed.join(", ")}` : ""}${ex ? ` · by ${ex.name}` : ""}` });
    }
  }
  const t0 = a.communicationDisabledUntilTimestamp ?? null, t1 = b.communicationDisabledUntilTimestamp ?? null;
  if (a.communicationDisabledUntilTimestamp !== undefined && t0 !== t1) {
    const ex = await executor(b.guild, AuditLogEvent.MemberUpdate, b.id, 5000);
    const active = t1 && t1 > Date.now();
    await write({ cat: "moderation", action: active ? "TIMEOUT" : "TIMEOUT REMOVED", by: ex?.name ?? "Unknown", byId: ex?.id ?? null, target: nameOf(b), targetId: b.id, extra: { until: active ? new Date(t1).toISOString() : null, reason: ex?.reason ?? null },
      details: active ? `${nameOf(b)} timed out until ${new Date(t1).toLocaleString("en-GB", { timeZone: "Europe/London" })}${ex ? ` by ${ex.name}` : ""}${ex?.reason ? ` — "${ex.reason}"` : ""}` : `${nameOf(b)} timeout removed${ex ? ` by ${ex.name}` : ""}` });
  }
}
async function onUserUpdate(a: User | PartialUser, b: User) {
  if (b.bot || a.partial) return;
  if (a.username !== b.username || a.globalName !== b.globalName)
    await write({ cat: "members", action: "RENAMED", by: b.tag, byId: b.id, target: b.tag, targetId: b.id, before: a.globalName ?? a.username, after: b.globalName ?? b.username,
      details: `${b.tag} Discord name: "${a.globalName ?? a.username}" → "${b.globalName ?? b.username}"` });
  if (a.avatar !== b.avatar)
    await write({ cat: "members", action: "AVATAR CHANGED", by: b.tag, byId: b.id, target: b.tag, targetId: b.id, extra: { scope: "global", oldAvatar: a.displayAvatarURL({ size: 128 }), newAvatar: b.displayAvatarURL({ size: 128 }) },
      details: `${b.tag} changed their profile picture` });
}
async function onBan(ban: GuildBan, added: boolean) {
  await new Promise((r) => setTimeout(r, 1000));
  const ex = await executor(ban.guild, added ? AuditLogEvent.MemberBanAdd : AuditLogEvent.MemberBanRemove, ban.user.id, 10_000);
  await write({ cat: "moderation", action: added ? "BANNED" : "UNBANNED", by: ex?.name ?? "Unknown", byId: ex?.id ?? null, target: ban.user.tag, targetId: ban.user.id, extra: { reason: ex?.reason ?? ban.reason ?? null },
    details: `${ban.user.tag} ${added ? "banned" : "unbanned"}${ex ? ` by ${ex.name}` : ""}${ex?.reason || ban.reason ? ` — "${ex?.reason ?? ban.reason}"` : ""}` });
}

// ───────── voice ─────────
async function onVoice(a: VoiceState, b: VoiceState) {
  const m = b.member;
  if (!m || m.user.bot || a.channelId === b.channelId) return;
  const who = nameOf(m);
  const [action, details] = !a.channelId ? ["VOICE JOIN", `${who} joined ${b.channel?.name ?? "voice"}`]
    : !b.channelId ? ["VOICE LEAVE", `${who} left ${a.channel?.name ?? "voice"}`]
    : ["VOICE MOVE", `${who} ${a.channel?.name ?? "?"} → ${b.channel?.name ?? "?"}`];
  await write({ cat: "voice", action, details, by: who, byId: m.id, target: who, targetId: m.id, channel: b.channel?.name ?? a.channel?.name, channelId: b.channelId ?? a.channelId });
}

// ───────── server ─────────
async function server(g: Guild | null | undefined, type: AuditLogEvent, action: string, what: string, targetId?: string) {
  if (!g) return;
  const ex = await executor(g, type, targetId, 8000);
  await write({ cat: "server", action, by: ex?.name ?? "Unknown", byId: ex?.id ?? null, target: what, targetId: targetId ?? null, details: `${what}${ex ? ` · by ${ex.name}` : ""}` });
}

export function startDiscordAudit(client: Client<true>) {
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  if (g) void loadInvites(g);
  if (!CLOUD) log.info("Audit: CLOUDINARY_* not set — deleted pictures/clips will not be kept");
  const mine = (x: { guild?: Guild | null; id?: string } | null | undefined) => x?.guild?.id === env.AUTHORISED_GUILD_ID || x?.id === env.AUTHORISED_GUILD_ID;
  const safe = (f: () => Promise<unknown>) => void f().catch((e) => log.warn(`Audit event failed: ${(e as Error).message}`));
  client.on(Events.MessageCreate, (m) => mine(m) && safe(() => copyMedia(m)));
  client.on(Events.MessageDelete, (m) => mine(m) && safe(() => onDelete(m)));
  client.on(Events.MessageBulkDelete, (msgs, ch) => mine(msgs.first()) && safe(() => onBulk(msgs as Collection<Snowflake, Message | PartialMessage>, ch)));
  client.on(Events.MessageUpdate, (a, b) => mine(b) && safe(() => onEdit(a, b)));
  client.on(Events.GuildMemberAdd, (m) => mine(m) && safe(() => onJoin(m)));
  client.on(Events.GuildMemberRemove, (m) => mine(m) && safe(() => onLeave(m)));
  client.on(Events.GuildMemberUpdate, (a, b) => mine(b) && safe(() => onMemberUpdate(a, b)));
  client.on(Events.UserUpdate, (a, b) => safe(() => onUserUpdate(a, b)));
  client.on(Events.GuildBanAdd, (b) => mine(b) && safe(() => onBan(b, true)));
  client.on(Events.GuildBanRemove, (b) => mine(b) && safe(() => onBan(b, false)));
  client.on(Events.VoiceStateUpdate, (a, b) => b.guild.id === env.AUTHORISED_GUILD_ID && safe(() => onVoice(a, b)));
  client.on(Events.ChannelCreate, (c) => "guild" in c && mine(c) && safe(() => server(c.guild, AuditLogEvent.ChannelCreate, "CHANNEL CREATED", `#${c.name}`, c.id)));
  client.on(Events.ChannelDelete, (c) => "guild" in c && mine(c) && safe(() => server(c.guild, AuditLogEvent.ChannelDelete, "CHANNEL DELETED", `#${c.name}`, c.id)));
  client.on(Events.ChannelUpdate, (a, b) => "guild" in b && mine(b) && "name" in a && a.name !== b.name && safe(() => server(b.guild, AuditLogEvent.ChannelUpdate, "CHANNEL RENAMED", `#${a.name} → #${b.name}`, b.id)));
  client.on(Events.GuildRoleCreate, (r) => mine(r) && safe(() => server(r.guild, AuditLogEvent.RoleCreate, "ROLE CREATED", `@${r.name}`, r.id)));
  client.on(Events.GuildRoleDelete, (r) => mine(r) && safe(() => server(r.guild, AuditLogEvent.RoleDelete, "ROLE DELETED", `@${r.name}`, r.id)));
  client.on(Events.GuildRoleUpdate, (a, b) => mine(b) && (a.name !== b.name || !a.permissions.equals(b.permissions)) && safe(() => server(b.guild, AuditLogEvent.RoleUpdate, "ROLE CHANGED", a.name !== b.name ? `@${a.name} → @${b.name}` : `@${b.name} permissions changed`, b.id)));
  client.on(Events.InviteCreate, (i) => { if (i.guild?.id !== env.AUTHORISED_GUILD_ID) return; invites.set(i.code, i.uses ?? 0); safe(() => write({ cat: "server", action: "INVITE CREATED", by: i.inviter?.tag ?? "Unknown", byId: i.inviter?.id ?? null, target: i.code, details: `Invite ${i.code} created by ${i.inviter?.tag ?? "Unknown"}${i.maxUses ? ` · max ${i.maxUses} uses` : ""}` })); });
  client.on(Events.InviteDelete, (i) => { if (i.guild?.id !== env.AUTHORISED_GUILD_ID) return; invites.delete(i.code); safe(() => write({ cat: "server", action: "INVITE DELETED", by: "—", target: i.code, details: `Invite ${i.code} deleted` })); });
}
