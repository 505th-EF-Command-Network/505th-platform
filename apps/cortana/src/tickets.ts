/**
 * Tickets (approved mock 2026-11-10). Each ticket TYPE has its own panel channel (e.g. Recruitment in #join-505th,
 * Tech Support in #tech-support) — types are set on the website (ticket_types/<id>).
 * A member presses the panel button → a private channel opens (member + that type's staff roles + Cortana).
 * Everything said is copied to tickets/<id>.transcript so staff can answer from the website too.
 *
 * Jobs (website): ticket.panel {typeId} · ticket.panelRemove {channelId,messageId} · ticket.reply {ticketId,text,note?}
 *                 ticket.claim {ticketId} · ticket.close {ticketId} · ticket.move {ticketId,typeId}
 * Buttons: tko:<typeId> (open) · tkc:claim:<ticketId> · tkc:close:<ticketId>
 * v2 (approved mock 2026-11-11, like RCD Guardian):
 *  Close asks first (Close / Close with reason) → member loses access, channel renamed closed-0001,
 *  staff get 📑 Transcript · 🔓 Reopen · ⛔ Delete. HTML transcript → transcript channel. Ticket log channel.
 *  Limits (open per member, new per hour — staff skip), auto-close, delete-after. Settings: Cortana Setup → Tickets
 *  (settings/cortana.tickets). Extra jobs: ticket.reopen · ticket.transcript · ticket.delete · ticket.add · ticket.remove
 *  Buttons tkc:closeask|closeok|closewhy|cancel|transcript|reopen|delete:<id> · modal tkm:close:<id> · /ticket add|remove|close
 */
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, OverwriteType, PermissionFlagsBits,
  TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type Client, type GuildMember, type Message, type ModalSubmitInteraction, type TextChannel,
} from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { allowed, uidAllowed } from "./access.ts";
import { RANK_ABBR } from "./monthly-reset.ts";
import { LOGO, auditLog, autoId, cortanaSettings, mentionsIn, nextNumber, nowISO } from "./util.ts";

type TType = { name: string; emoji?: string; channelId: string; categoryId?: string; purpose?: string; staffRoleIds?: string[]; question?: string; color?: number; btnLabel?: string; btnEmoji?: string; btnStyle?: string; panel?: { channelId?: string; messageId?: string } };
type Line = { who: string; whoId: string; staff: boolean; text: string; images?: string[]; note?: boolean; atISO: string };
type Ticket = { number: number; typeId: string; typeName: string; channelId: string; openerId: string; openerName: string; status: "open" | "closed";
  claimedByName?: string; openedAtISO: string; closedAtISO?: string; closedByName?: string; closeReason?: string; channelDeleted?: boolean; deleteAtISO?: string; lastActivityISO: string; waiting: "staff" | "member"; firstReplyMs?: number; transcriptAtISO?: string; transcript: Line[] };

const MEMBER_PERMS = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
const pad = (n: number) => String(n).padStart(4, "0");
const openChannels = new Map<string, string>(); // channelId → ticketId (open tickets)

const getType = async (id: string) => ((await TerminalDoc.findById(`ticket_types/${id}`, { data: 1 }).lean())?.data as TType | undefined) ?? null;
const getTicket = async (id: string) => ((await TerminalDoc.findById(`tickets/${id}`, { data: 1 }).lean())?.data as Ticket | undefined) ?? null;
const patch = (id: string, set: Record<string, unknown>, push?: Line) =>
  TerminalDoc.updateOne({ _id: `tickets/${id}` }, { $set: { ...Object.fromEntries(Object.entries(set).map(([k, v]) => [`data.${k}`, v])), updateTime: new Date() }, ...(push ? { $push: { "data.transcript": { $each: [push], $slice: -500 } } } : {}) });

async function isStaff(m: GuildMember, t: TType | null) {
  if (t?.staffRoleIds?.some((r) => m.roles.cache.has(r))) return true;
  return allowed(m, "tk");
}
/** Staff check for a ticket by its id (for /ticket). */
export async function isTicketStaff(m: GuildMember, ticketId: string) {
  const tk = await getTicket(ticketId);
  return tk ? isStaff(m, await getType(tk.typeId)) : false;
}
/** Ticket id for a ticket channel (open or closed, channel still there). */
export async function ticketIdForChannel(channelId: string): Promise<string | null> {
  const d = await TerminalDoc.findOne({ parent: "tickets", "data.channelId": channelId, "data.channelDeleted": { $ne: true } }, { docId: 1 }).lean();
  return d ? String(d.docId) : null;
}

/* ───────── settings (Cortana Setup → Tickets) ───────── */
type TSet = { open: boolean; logChannelId: string; transcriptChannelId: string; maxOpen: number; maxPerHour: number; autoCloseDays: number; deleteAfterH: number };
async function tset(): Promise<TSet> {
  const c = ((await cortanaSettings()).tickets ?? {}) as Record<string, unknown>;
  const n = (v: unknown, d: number, min = 0) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Math.max(min, Number(v)) : d);
  return { open: c.open !== false, logChannelId: String(c.logChannelId || ""), transcriptChannelId: String(c.transcriptChannelId || ""),
    maxOpen: n(c.maxOpen, 1, 1), maxPerHour: n(c.maxPerHour, 3, 1), autoCloseDays: n(c.autoCloseDays, 0), deleteAfterH: n(c.deleteAfterH, 0) };
}
async function tlog(client: Client<true>, e: EmbedBuilder) {
  const { logChannelId } = await tset();
  if (!logChannelId) return;
  const ch = await client.channels.fetch(logChannelId).catch(() => null);
  if (ch && "send" in ch) await ch.send({ embeds: [e.setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}
const openRow = (id: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId(`tkc:claim:${id}`).setLabel("Claim").setEmoji("✋").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`tkc:close:${id}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger),
);
const closedRow = (id: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId(`tkc:transcript:${id}`).setLabel("Transcript").setEmoji("📑").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`tkc:reopen:${id}`).setLabel("Reopen").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(`tkc:delete:${id}`).setLabel("Delete").setEmoji("⛔").setStyle(ButtonStyle.Danger),
);
const textChan = async (client: Client<true>, id: string) => { const ch = await client.channels.fetch(id).catch(() => null); return ch && ch.type === ChannelType.GuildText ? ch : null; };

/* ───────── panel ───────── */
function panelBody(id: string, t: TType) {
  const e = new EmbedBuilder().setColor(t.color ?? 0x22e07a).setTitle(`${t.emoji ? t.emoji + " " : ""}${t.name}`.slice(0, 256))
    .setDescription(`${t.purpose || "Need help?"}\n\nPress the button — a private channel opens just for you and our staff.`.slice(0, 4000))
    .setFooter({ text: `505th Expeditionary Force · ${t.name}`.slice(0, 2048), iconURL: LOGO });
  const style = ({ green: ButtonStyle.Success, blue: ButtonStyle.Primary, grey: ButtonStyle.Secondary, red: ButtonStyle.Danger } as Record<string, ButtonStyle>)[t.btnStyle || "green"] ?? ButtonStyle.Success;
  const b = new ButtonBuilder().setCustomId(`tko:${id}`).setLabel((t.btnLabel?.trim() || `Open ${t.name} ticket`).slice(0, 80)).setStyle(style);
  const emo = t.btnEmoji?.trim() || t.emoji;
  if (emo) b.setEmoji(emo);
  return { embeds: [e], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(b)], allowedMentions: { parse: [] as const } };
}
async function postPanel(client: Client<true>, id: string) {
  const t = await getType(id);
  if (!t) throw new PermanentJobError("Ticket type not found");
  const ch = await client.channels.fetch(t.channelId).catch(() => null);
  if (!ch || !("guildId" in ch) || ch.guildId !== env.AUTHORISED_GUILD_ID || ch.type !== ChannelType.GuildText) throw new PermanentJobError("Panel channel not found (must be a text channel)");
  if (t.panel?.messageId && t.panel.channelId && t.panel.channelId !== ch.id) {
    const oc = await client.channels.fetch(t.panel.channelId).catch(() => null);
    if (oc && "messages" in oc) await (await oc.messages.fetch(t.panel.messageId).catch(() => null))?.delete().catch(() => {});
  }
  const old = t.panel?.messageId && t.panel.channelId === ch.id ? await ch.messages.fetch(t.panel.messageId).catch(() => null) : null;
  const msg = old ? await old.edit(panelBody(id, t)) : await ch.send(panelBody(id, t));
  await TerminalDoc.updateOne({ _id: `ticket_types/${id}` }, { $set: { "data.panel": { channelId: ch.id, messageId: msg.id, postedAtISO: nowISO() }, updateTime: new Date() } });
  return { messageId: msg.id };
}

/* ───────── open (from a panel or an Info Post button) ───────── */
export async function openTicket(i: ButtonInteraction, typeId: string) {
  if (!i.inCachedGuild()) return;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const t = await getType(typeId);
  if (!t) return void (await i.editReply("This ticket type is no longer set up."));
  const S = await tset();
  if (!(await isStaff(i.member, t))) { // staff skip the limits (testing, opening for someone)
    if (!S.open) return void (await i.editReply("Tickets are closed right now. Please try again later."));
    const mine = await TerminalDoc.find({ parent: "tickets", "data.openerId": i.user.id, "data.status": "open" }, { "data.channelId": 1 }).lean();
    if (mine.length >= S.maxOpen) return void (await i.editReply(`You already have an open ticket: <#${(mine[0] as any).data.channelId}>. Please use that one.`));
    const hour = await TerminalDoc.countDocuments({ parent: "tickets", "data.openerId": i.user.id, "data.openedAtISO": { $gt: new Date(Date.now() - 3600_000).toISOString() } });
    if (hour >= S.maxPerHour) return void (await i.editReply("You've opened several tickets recently. Please try again later."));
  }
  const g = i.guild;
  const parent = t.categoryId && g.channels.cache.get(t.categoryId)?.type === ChannelType.GuildCategory ? t.categoryId : null;
  const num = await nextNumber("ticket");
  const staffRoles = (t.staffRoleIds ?? []).filter((r) => g.roles.cache.has(r));
  let ch: TextChannel;
  try {
    ch = await g.channels.create({
      name: `ticket-${pad(num)}`, type: ChannelType.GuildText, parent, topic: `${t.name} ticket #${pad(num)} — ${i.user.username}`,
      permissionOverwrites: [
        { id: g.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
        { id: i.user.id, allow: MEMBER_PERMS, type: OverwriteType.Member },
        ...staffRoles.map((r) => ({ id: r, allow: [...MEMBER_PERMS, PermissionFlagsBits.ManageMessages], type: OverwriteType.Role })),
        { id: g.members.me!.id, allow: [...MEMBER_PERMS, PermissionFlagsBits.ManageChannels], type: OverwriteType.Member },
      ],
    });
  } catch (e) {
    log.error("Ticket channel create failed", e);
    return void (await i.editReply("⚠️ Cortana couldn't create the ticket channel (needs Manage Channels). Tell a staff member."));
  }
  const id = autoId();
  const now = new Date();
  const name = i.member.displayName;
  const first: Line = { who: name, whoId: i.user.id, staff: false, text: `Opened a ${t.name} ticket.`, atISO: now.toISOString() };
  await TerminalDoc.create({ _id: `tickets/${id}`, parent: "tickets", docId: id, createTime: now, updateTime: now,
    data: { number: num, typeId, typeName: t.name, typeEmoji: t.emoji ?? "", channelId: ch.id, openerId: i.user.id, openerName: name, status: "open", openedAtISO: now.toISOString(), lastActivityISO: now.toISOString(), waiting: "staff", transcript: [first] } as Ticket });
  openChannels.set(ch.id, id);
  const e = new EmbedBuilder().setColor(t.color ?? 0x22e07a).setTitle(`Ticket #${pad(num)} · ${t.name}`)
    .setDescription(`<@${i.user.id}> — thanks! ${t.question ? `\n\n**${t.question}**` : "Tell us how we can help."}\n\n${staffRoles.length ? staffRoles.map((r) => `<@&${r}>`).join(" ") + " will reply soon." : "Staff will reply soon."}`)
    .setFooter({ text: "505th Expeditionary Force · Tickets", iconURL: LOGO });
  await ch.send({ content: `<@${i.user.id}> ${staffRoles.map((r) => `<@&${r}>`).join(" ")}`.trim(), embeds: [e], components: [openRow(id)], allowedMentions: { users: [i.user.id], roles: staffRoles } });
  await tlog(i.client, new EmbedBuilder().setColor(0x22e07a).setTitle(`🎫 New ticket #${pad(num)}`).setDescription(`${t.emoji ?? ""} ${t.name} · <@${i.user.id}> · <#${ch.id}>`.trim()));
  await i.editReply(`✅ Your ticket is open: <#${ch.id}>`);
  log.info(`Ticket #${pad(num)} (${t.name}) opened by ${name}.`);
}

/* ───────── claim / close ───────── */
async function claim(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk || tk.status !== "open") throw new PermanentJobError("Ticket is not open");
  await patch(id, { claimedByName: by }, { who: "Cortana", whoId: "", staff: true, text: `✋ ${by} claimed this ticket.`, atISO: nowISO() });
  const ch = await client.channels.fetch(tk.channelId).catch(() => null);
  if (ch && "send" in ch) await ch.send({ content: `✋ **${by}** has claimed this ticket and will help you.`, allowedMentions: { parse: [] } }).catch(() => {});
}
export async function close(client: Client<true>, id: string, by: string, reason = "") {
  const tk = await getTicket(id);
  if (!tk || tk.status !== "open") return;
  const S = await tset();
  const why = reason.trim().slice(0, 500) || "No reason given.";
  const set: Record<string, unknown> = { status: "closed", closedAtISO: nowISO(), closedByName: by, closeReason: why, deleteAtISO: S.deleteAfterH ? new Date(Date.now() + S.deleteAfterH * 3600_000).toISOString() : null };
  await patch(id, set, { who: "Cortana", whoId: "", staff: true, text: `🔒 Closed by ${by} — ${why}`, atISO: nowISO() });
  openChannels.delete(tk.channelId);
  const ch = await textChan(client, tk.channelId);
  if (ch) {
    // Every member overwrite (the opener + anyone added) loses access. Staff roles and Cortana keep it.
    for (const ow of ch.permissionOverwrites.cache.values()) {
      if (ow.type === OverwriteType.Member && ow.id !== client.user.id) await ch.permissionOverwrites.edit(ow.id, { ViewChannel: false }).catch(() => {});
    }
    await ch.setName(`closed-${pad(tk.number)}`).catch(() => {});
    await ch.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setDescription(`🔒 Ticket closed by **${by}**.\n**Reason:** ${why}`)], allowedMentions: { parse: [] } }).catch(() => {});
    await ch.send({ embeds: [new EmbedBuilder().setColor(0x4e5058).setDescription("```Support team ticket controls```")], components: [closedRow(id)], allowedMentions: { parse: [] } }).catch(() => {});
  }
  await sendTranscript(client, id, by).catch((e) => log.warn(`Transcript on close failed: ${(e as Error).message}`));
  await tlog(client, new EmbedBuilder().setColor(0xef4444).setTitle(`🔒 Ticket #${pad(tk.number)} closed`).setDescription(`${tk.typeName} · ${tk.openerName}\nBy **${by}** · ${why}`));
  await auditLog("TICKET CLOSED", `#${pad(tk.number)} ${tk.typeName} — ${tk.openerName} — ${why}`, by);
}

async function reopen(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk) throw new PermanentJobError("Ticket not found");
  if (tk.status === "open") throw new PermanentJobError("This ticket is already open");
  if (tk.channelDeleted) throw new PermanentJobError("The channel was deleted — open a new ticket");
  const ch = await textChan(client, tk.channelId);
  if (!ch) throw new PermanentJobError("The ticket channel no longer exists");
  await patch(id, { status: "open", closedAtISO: null, closedByName: null, closeReason: null, deleteAtISO: null, lastActivityISO: nowISO(), waiting: "member" }, { who: "Cortana", whoId: "", staff: true, text: `🔓 Reopened by ${by}.`, atISO: nowISO() });
  openChannels.set(ch.id, id);
  await ch.permissionOverwrites.edit(tk.openerId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
  await ch.setName(`ticket-${pad(tk.number)}`).catch(() => {});
  await ch.send({ content: `<@${tk.openerId}>`, embeds: [new EmbedBuilder().setColor(0x22e07a).setDescription(`🔓 Ticket reopened by **${by}**.`)], components: [openRow(id)], allowedMentions: { users: [tk.openerId] } });
  await tlog(client, new EmbedBuilder().setColor(0x22e07a).setTitle(`🔓 Ticket #${pad(tk.number)} reopened`).setDescription(`By **${by}** · <#${ch.id}>`));
  await auditLog("TICKET REOPENED", `#${pad(tk.number)} ${tk.typeName} — ${tk.openerName}`, by);
}

const h = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dur = (ms: number) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`; };
const ukT = (iso?: string, o: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...o }) : "—");

/** Discord id → `Sgt. S. "Raven"` for everyone in the ticket who is on the website. */
async function rankNames(tk: Ticket) {
  const ids = [...new Set([tk.openerId, ...(tk.transcript ?? []).map((l) => l.whoId)].filter((x) => /^\d{17,20}$/.test(x)))];
  const us = await TerminalDoc.find({ parent: "users", "data.discordId": { $in: ids } }, { data: 1 }).lean();
  const out = new Map<string, string>();
  for (const u of us) { const d = (u as any).data ?? {}; out.set(String(d.discordId), await signName(String((u as any).docId ?? ""), "", d)); }
  return out;
}
type Who = { key: string; name: string; staff: boolean; bot: boolean; n: number };
function stats(tk: Ticket, names: Map<string, string>) {
  const lines = (tk.transcript ?? []).filter((l) => !l.note);
  const by = new Map<string, Who>();
  for (const l of lines) {
    const bot = l.who === "Cortana" && !l.whoId;
    const key = l.whoId || `n:${l.who}`;
    const w = by.get(key) ?? { key, name: (l.whoId && names.get(l.whoId)) || l.who, staff: l.staff, bot, n: 0 };
    w.n++; by.set(key, w);
  }
  const people = [...by.values()].sort((a, b) => b.n - a.n);
  return { people, msgs: lines.length, images: lines.reduce((s, l) => s + (l.images?.length ?? 0), 0), notes: (tk.transcript ?? []).filter((l) => l.note).length };
}
const ini = (n: string) => (n.replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();

/** Approved mock 2026-11-11: details sidebar, people, timeline, search + filters, day dividers, inline images. Staff copy (has notes). */
function transcriptHtml(tk: Ticket, names: Map<string, string>) {
  const s = stats(tk, names);
  const nm = (l: Line) => (l.whoId && names.get(l.whoId)) || l.who;
  let day = "";
  const rows = (tk.transcript ?? []).map((l) => {
    const dd = ukT(l.atISO, { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
    const div = dd !== day ? `<div class="day">${h((day = dd))}</div>` : "";
    const sys = l.who === "Cortana" && !l.whoId && /^(🔒|🔓|➕|➖|✋)/.test(l.text);
    if (sys) return `${div}<div class="sys" data-k="staff">${h(l.text)}</div>`;
    const bot = l.who === "Cortana" && !l.whoId;
    const k = l.note ? "note" : l.staff ? "staff" : "member";
    return `${div}<div class="m ${l.staff ? "s" : ""} ${l.note ? "note" : ""}" data-k="${k}"${l.images?.length ? ' data-img="1"' : ""}><div class="a">${h(bot ? "CO" : ini(nm(l)))}</div><div><b>${h(nm(l))}</b>${bot ? '<span class="tag b">BOT</span>' : l.note ? '<span class="tag n">STAFF NOTE</span>' : l.staff ? '<span class="tag">STAFF</span>' : ""}<small>${h(ukT(l.atISO, { hour: "2-digit", minute: "2-digit" }))}</small>
<div class="t">${h(l.text).replace(/\n/g, "<br>")}</div>${(l.images ?? []).map((u) => `<a href="${h(u)}" target="_blank" rel="noopener"><img src="${h(u)}" alt="Attached image" loading="lazy"></a>`).join("")}</div></div>`;
  }).join("");
  const open = Date.parse(tk.openedAtISO), closed = tk.closedAtISO ? Date.parse(tk.closedAtISO) : Date.now();
  const tl = (tk.transcript ?? []).filter((l) => l.who === "Cortana" && !l.whoId && /^(🔒|🔓|➕|➖|✋)/.test(l.text)).map((l) => `<div>${h(ukT(l.atISO))} · ${h(l.text.replace(/^\S+\s/, ""))}</div>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket #${pad(tk.number)} · ${h(tk.typeName)}</title><style>
body{margin:0;background:#06090d;color:#dbe7ee;font:14px/1.5 "Segoe UI",Arial,sans-serif}.tp{max-width:1150px;margin:20px auto;border:1px solid #00d9ff33;background:#0a0e12}
.tph{display:flex;gap:16px;align-items:center;padding:20px 24px;border-bottom:1px solid #00d9ff22;background:linear-gradient(90deg,#00d9ff12,transparent)}.tph img{width:58px;height:58px}
.tph h1{margin:0;font-size:21px;letter-spacing:3px;color:#fff}.tph p{margin:2px 0 0;color:#7d8a99;font-size:12px;letter-spacing:1.5px}.pill{border:1px solid;padding:2px 8px;font-size:10px;letter-spacing:1.5px;margin-left:auto}
.body{display:grid;grid-template-columns:260px 1fr}.side{border-right:1px solid #00d9ff1a;padding:18px;font-size:12.5px}.side h4{margin:16px 0 8px;font-size:10px;letter-spacing:2px;color:#7d8a99;font-weight:400}.side h4:first-child{margin-top:0}
.kv{display:flex;justify-content:space-between;gap:8px;padding:3px 0}.kv span{color:#7d8a99}.kv b{font-weight:400;color:#fff;text-align:right}
.p2{display:flex;align-items:center;gap:8px;padding:4px 0}.p2 i{width:26px;height:26px;display:grid;place-items:center;font-style:normal;font-size:10px;background:#ffffff0d;color:#aeb9c4;flex-shrink:0}.p2 i.s{background:#00d9ff22;color:#00d9ff}.p2 small{margin-left:auto;color:#7d8a99}
.tl div{border-left:2px solid #00d9ff33;padding:0 0 10px 10px;position:relative;font-size:11.5px;color:#aeb9c4}.tl div:before{content:"";position:absolute;left:-5px;top:4px;width:8px;height:8px;background:#00d9ff;border-radius:50%}
.main{padding:14px 22px;min-width:0}.tools{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;position:sticky;top:0;background:#0a0e12;padding:6px 0;z-index:2}
.tools input{flex:1;min-width:180px;background:#070a0f;border:1px solid #00d9ff33;color:#fff;padding:6px 10px;font:inherit;font-size:12.5px}
.chip{border:1px solid #00d9ff33;color:#7d8a99;padding:5px 10px;font-size:10.5px;letter-spacing:1.5px;background:none;cursor:pointer;font-family:inherit}.chip.on{border-color:#00d9ff;color:#00d9ff}
.day{text-align:center;color:#4b5765;font-size:10.5px;letter-spacing:2px;margin:14px 0 8px;display:flex;align-items:center;gap:10px}.day:before,.day:after{content:"";flex:1;height:1px;background:#00d9ff1a}
.m{display:flex;gap:10px;padding:7px 8px}.m:hover{background:#00d9ff08}.m .a{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;font-size:11px;background:#ffffff0d;color:#aeb9c4}.m.s .a{background:#00d9ff1f;color:#00d9ff}
.m b{color:#fff;font-weight:600}.m.s b{color:#00d9ff}.tag{font-size:9px;letter-spacing:1px;border:1px solid #00d9ff;color:#00d9ff;padding:0 5px;margin-left:6px;vertical-align:2px}.tag.n{border-color:#f59e0b;color:#f59e0b}.tag.b{border-color:#5865f2;color:#8b93f8}
.m small{color:#4b5765;font-size:11px;margin-left:6px}.m .t{color:#d6dde6;font-size:13.5px;word-wrap:break-word}.m.note{background:#f59e0b0d;border-left:2px solid #f59e0b}.m img{display:block;margin-top:6px;max-width:320px;max-height:240px;border:1px solid #00d9ff22}
.sys{text-align:center;font-size:11.5px;color:#7d8a99;padding:6px}mark{background:#f59e0b55;color:#fff}.hide{display:none}
.foot{border-top:1px solid #00d9ff1a;padding:12px 24px;font-size:11px;color:#4b5765;display:flex;justify-content:space-between}a{color:#00a8fc}
@media(max-width:820px){.body{grid-template-columns:1fr}.side{border-right:0;border-bottom:1px solid #00d9ff1a}}
</style></head><body><div class="tp">
<div class="tph"><img src="${h(LOGO)}" alt="505th"><div><h1>TICKET #${pad(tk.number)} · ${h(tk.typeName.toUpperCase())}</h1><p>505TH EXPEDITIONARY FORCE · TRANSCRIPT SAVED ${h(ukT(nowISO(), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).toUpperCase())} UK</p></div>
<span class="pill" style="color:${tk.status === "closed" ? "#ef4444" : "#22e07a"}">${tk.status === "closed" ? "CLOSED" : "OPEN"}</span></div>
<div class="body"><div class="side"><h4>DETAILS</h4>
<div class="kv"><span>Opened by</span><b>${h(names.get(tk.openerId) || tk.openerName)}</b></div><div class="kv"><span>Panel</span><b>${h(tk.typeName)}</b></div>
<div class="kv"><span>Claimed by</span><b>${h(tk.claimedByName || "—")}</b></div><div class="kv"><span>Opened</span><b>${h(ukT(tk.openedAtISO))}</b></div>
<div class="kv"><span>Closed</span><b>${h(ukT(tk.closedAtISO))}</b></div><div class="kv"><span>Open for</span><b>${dur(closed - open)}</b></div>
<div class="kv"><span>First reply</span><b>${tk.firstReplyMs != null ? dur(tk.firstReplyMs) : "—"}</b></div>${tk.closeReason ? `<div class="kv"><span>Reason</span><b>${h(tk.closeReason)}</b></div>` : ""}
<h4>PEOPLE</h4>${s.people.map((p) => `<div class="p2"><i class="${p.staff ? "s" : ""}">${h(p.bot ? "CO" : ini(p.name))}</i>${h(p.name)}<small>${p.n}</small></div>`).join("")}
${tl ? `<h4>TIMELINE</h4><div class="tl"><div>${h(ukT(tk.openedAtISO))} · Ticket opened</div>${tl}</div>` : ""}</div>
<div class="main"><div class="tools"><input id="q" placeholder="🔍 Search this transcript…" aria-label="Search this transcript">
${[["all", "ALL"], ["staff", "STAFF"], ["member", "MEMBER"], ["img", "📎 IMAGES"], ["note", "🔒 NOTES"]].map(([k, l], i) => `<button class="chip${i ? "" : " on"}" data-f="${k}">${l}</button>`).join("")}</div>
<div id="log">${rows || '<p style="color:#4b5765;text-align:center">No messages.</p>'}</div></div></div>
<div class="foot"><span>505th Expeditionary Force · Command Network</span><span>${s.msgs} messages · ${s.images} images · ${s.notes} staff notes</span></div></div>
<script>(function(){var f="all",q=document.getElementById("q"),ms=[].slice.call(document.querySelectorAll("#log .m,#log .sys"));
ms.forEach(function(m){var t=m.querySelector(".t")||m;t.dataset.raw=t.innerHTML;});
function run(){var s=q.value.trim().toLowerCase();ms.forEach(function(m){var t=m.querySelector(".t")||m,k=m.dataset.k;
var okF=f==="all"||(f==="img"?m.dataset.img:k===f);var txt=t.textContent.toLowerCase();var okQ=!s||txt.indexOf(s)>-1||(m.querySelector("b")||{textContent:""}).textContent.toLowerCase().indexOf(s)>-1;
m.classList.toggle("hide",!(okF&&okQ));t.innerHTML=t.dataset.raw;if(s&&okQ&&m.querySelector(".t")){var e=s.replace(/[.*+?^\${}()|[\\]\\\\]/g,"\\\\$&");t.innerHTML=t.dataset.raw.replace(new RegExp("(?![^<]*>)("+e+")","gi"),"<mark>$1</mark>");}});}
q.addEventListener("input",run);[].forEach.call(document.querySelectorAll("[data-f]"),function(b){b.onclick=function(){f=b.dataset.f;[].forEach.call(document.querySelectorAll("[data-f]"),function(x){x.classList.toggle("on",x===b);});run();};});})();</script>
</body></html>`;
}

/** Transcript channel: Cortana Setup → Tickets, else a channel called #transcripts, else the log channel. */
async function transcriptChannel(client: Client<true>) {
  const S = await tset();
  for (const id of [S.transcriptChannelId]) if (id) { const c = await textChan(client, id); if (c) return c; }
  const byName = client.guilds.cache.get(env.AUTHORISED_GUILD_ID)?.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === "transcripts");
  if (byName && byName.type === ChannelType.GuildText) return byName;
  return S.logChannelId ? textChan(client, S.logChannelId) : null;
}

async function sendTranscript(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk) throw new PermanentJobError("Ticket not found");
  const ch = await transcriptChannel(client);
  if (!ch) throw new PermanentJobError("No #transcripts channel — make one, or pick it in Cortana Setup → Tickets");
  const names = await rankNames(tk);
  const s = stats(tk, names);
  const total = Math.max(1, s.msgs);
  const COL = ["🟦", "🟩", "🟪", "🟧", "⬜"];
  const bar = s.people.map((p, i) => COL[Math.min(i, 4)]!.repeat(Math.max(1, Math.round((p.n / total) * 12)))).join("").slice(0, 60);
  const ment = (discordId: string, fallback: string) => (discordId ? `<@${discordId}>` : `**${fallback}**`);
  const closer = tk.closedByName ? `Closed by **${tk.closedByName}**${tk.closeReason ? ` — “${tk.closeReason}”` : ""}` : `Saved by **${by}** (still open)`;
  const end = tk.closedAtISO ? Date.parse(tk.closedAtISO) : Date.now();
  const e = new EmbedBuilder().setColor(0x00d9ff).setTitle(`📑 Transcript · Ticket #${pad(tk.number)} · ${tk.typeName}`.slice(0, 256)).setThumbnail(LOGO).setDescription(closer.slice(0, 500))
    .addFields(
      { name: "Opened by", value: ment(tk.openerId, tk.openerName), inline: true },
      { name: "Claimed by", value: tk.claimedByName || "—", inline: true },
      { name: "Panel", value: tk.typeName || "—", inline: true },
      { name: "Opened", value: `<t:${Math.floor(Date.parse(tk.openedAtISO) / 1000)}:f>`, inline: true },
      { name: "Closed", value: tk.closedAtISO ? `<t:${Math.floor(end / 1000)}:f>` : "—", inline: true },
      { name: "Open for", value: dur(end - Date.parse(tk.openedAtISO)), inline: true },
      { name: "First staff reply", value: tk.firstReplyMs != null ? dur(tk.firstReplyMs) : "—", inline: true },
      { name: "Messages", value: `${s.msgs}${s.images ? ` · 📎 ${s.images} image${s.images === 1 ? "" : "s"}` : ""}`, inline: true },
      { name: "Staff notes", value: `${s.notes}`, inline: true },
      { name: "Who talked", value: `${bar}\n${s.people.slice(0, 6).map((p, i) => `${COL[Math.min(i, 4)]} ${p.n} · ${/^\d{17,20}$/.test(p.key) ? `<@${p.key}>` : `**${p.name}**`}`).join("\n")}`.slice(0, 1024) },
    ).setFooter({ text: "505th Expeditionary Force · Ticket System" }).setTimestamp();
  const slug = (names.get(tk.openerId) || tk.openerName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "member";
  const file = new AttachmentBuilder(Buffer.from(transcriptHtml(tk, names), "utf8"), { name: `transcript-${pad(tk.number)}-${slug}.html` });
  const rows = env.SITE_URL ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("View on website").setEmoji("📑").setURL(`${env.SITE_URL.replace(/\/$/, "")}/terminal`))] : [];
  await ch.send({ embeds: [e], files: [file], components: rows, allowedMentions: { parse: [] } });
  await patch(id, { transcriptAtISO: nowISO() });
}

async function removeChannel(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk) throw new PermanentJobError("Ticket not found");
  const wasOpen = tk.status === "open";
  if (wasOpen) await close(client, id, by, "Deleted");
  if (!wasOpen && !tk.transcriptAtISO) await sendTranscript(client, id, by).catch((e) => log.warn(`Transcript before delete failed: ${(e as Error).message}`));
  await patch(id, { channelDeleted: true, deleteAtISO: null });
  openChannels.delete(tk.channelId);
  const ch = await textChan(client, tk.channelId);
  if (ch) {
    await ch.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setDescription("⛔ This ticket will be deleted in a few seconds.")] }).catch(() => {});
    setTimeout(() => void ch.delete(`Ticket deleted by ${by}`).catch((e) => log.warn(`Ticket channel delete failed: ${(e as Error).message}`)), 5000);
  }
  await tlog(client, new EmbedBuilder().setColor(0x6f8a96).setTitle(`⛔ Ticket #${pad(tk.number)} deleted`).setDescription(`By **${by}** · transcript saved`));
  await auditLog("TICKET DELETED", `#${pad(tk.number)} ${tk.typeName} — ${tk.openerName}`, by);
}

export async function addPerson(client: Client<true>, id: string, userId: string, by: string, add: boolean) {
  const tk = await getTicket(id);
  if (!tk || tk.channelDeleted) throw new PermanentJobError("Ticket not found");
  if (!/^\d{17,20}$/.test(userId)) throw new PermanentJobError("Pick a member");
  const ch = await textChan(client, tk.channelId);
  if (!ch) throw new PermanentJobError("The ticket channel no longer exists");
  if (add) await ch.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
  else await ch.permissionOverwrites.delete(userId).catch(() => {});
  await ch.send({ embeds: [new EmbedBuilder().setColor(add ? 0x22e07a : 0x6f8a96).setDescription(`${add ? "➕" : "➖"} <@${userId}> was ${add ? "added" : "removed"} by **${by}**.`)], allowedMentions: { parse: [] } });
  await patch(id, {}, { who: "Cortana", whoId: "", staff: true, text: `${add ? "➕ Added" : "➖ Removed"} <@${userId}> — by ${by}.`, atISO: nowISO() });
}

export async function handleTicketButton(i: ButtonInteraction): Promise<boolean> {
  if (i.customId.startsWith("tko:")) { await openTicket(i, i.customId.slice(4)); return true; }
  const [p, action, id] = i.customId.split(":");
  if (p !== "tkc" || !id || !i.inCachedGuild()) return false;
  const tk = await getTicket(id);
  if (!tk) return void (await i.reply({ content: "Ticket not found.", flags: MessageFlags.Ephemeral })), true;
  const staff = await isStaff(i.member, await getType(tk.typeId));
  if (action === "claim") {
    if (!staff) return void (await i.reply({ content: "Only staff can claim tickets.", flags: MessageFlags.Ephemeral })), true;
    await i.deferUpdate();
    await claim(i.client, id, i.member.displayName).catch(() => {});
    return true;
  }
  const canClose = staff || i.user.id === tk.openerId;
  if (action === "close") {
    if (!canClose) return void (await i.reply({ content: "Only staff or the person who opened it can close this.", flags: MessageFlags.Ephemeral })), true;
    if (tk.status !== "open") return void (await i.reply({ content: "This ticket is already closed.", flags: MessageFlags.Ephemeral })), true;
    await i.reply({ content: "Are you sure you want to close this ticket?", flags: MessageFlags.Ephemeral, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`tkc:closeok:${id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`tkc:closewhy:${id}`).setLabel("Close with reason").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`tkc:cancel:${id}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary))] });
    return true;
  }
  if (action === "cancel") return void (await i.update({ content: "Cancelled — the ticket stays open.", components: [] })), true;
  if (action === "closeok") {
    if (!canClose) return true;
    await i.update({ content: "🔒 Closing…", components: [] });
    await close(i.client, id, i.member.displayName);
    return true;
  }
  if (action === "closewhy") {
    if (!canClose) return true;
    await i.showModal(new ModalBuilder().setCustomId(`tkm:close:${id}`).setTitle(`Close ticket #${pad(tk.number)}`).addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500))));
    return true;
  }
  if (action === "transcript" || action === "reopen" || action === "delete") {
    if (!staff) return void (await i.reply({ content: "Only staff can use these.", flags: MessageFlags.Ephemeral })), true;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      if (action === "transcript") { await sendTranscript(i.client, id, i.member.displayName); await i.editReply("📑 Transcript saved."); }
      if (action === "reopen") { await reopen(i.client, id, i.member.displayName); await i.editReply("🔓 Reopened."); }
      if (action === "delete") { await i.editReply("⛔ Saving the transcript, then deleting…"); await removeChannel(i.client, id, i.member.displayName); }
    } catch (e) { await i.editReply(`⚠️ ${(e as Error).message}`).catch(() => {}); }
    return true;
  }
  return false;
}

/** Close-with-reason form. */
export async function handleTicketModal(i: ModalSubmitInteraction): Promise<boolean> {
  const [p, action, id] = i.customId.split(":");
  if (p !== "tkm" || action !== "close" || !id || !i.inCachedGuild()) return false;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  await close(i.client, id, i.member.displayName, i.fields.getTextInputValue("reason"));
  await i.editReply("🔒 Closed.");
  return true;
}

/* ───────── Discord chat → transcript ───────── */
export async function onTicketMessage(m: Message) {
  if (!m.inGuild() || m.author.bot) return;
  let id = openChannels.get(m.channelId);
  if (!id) return;
  const tk = await getTicket(id);
  if (!tk || tk.status !== "open") return void openChannels.delete(m.channelId);
  const staff = m.author.id !== tk.openerId && (await isStaff(m.member ?? (await m.guild.members.fetch(m.author.id).catch(() => null))!, await getType(tk.typeId)).catch(() => false));
  const line: Line = { who: m.member?.displayName ?? m.author.username, whoId: m.author.id, staff, text: m.content.slice(0, 4000), images: [...m.attachments.values()].filter((a) => a.contentType?.startsWith("image/")).map((a) => a.url).slice(0, 5), atISO: m.createdAt.toISOString() };
  const set: Record<string, unknown> = { lastActivityISO: line.atISO, waiting: staff ? "member" : "staff" };
  if (staff && tk.firstReplyMs == null) set.firstReplyMs = Date.now() - Date.parse(tk.openedAtISO);
  await patch(id, set, line);
}

/* ───────── website jobs ───────── */
/** Plain-text reply signature, like /say: `Sgt. S. "Raven"` or `Cpl. J. Harper`. */
async function signName(uid: unknown, fallback: string, pre?: Record<string, any>) {
  const u = pre ?? (typeof uid === "string" && uid ? ((await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as Record<string, any> | undefined) : undefined);
  if (!u) return fallback;
  const first = String(u.firstName || "").trim(), last = String(u.lastName || "").trim(), cs = String(u.callsign || "").trim();
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : last}`.trim();
  const r = String(u.rank || ""), ab = RANK_ABBR[r] || (r ? r.split("/").pop()!.trim() : "");
  return [ab ? `${ab}.` : "", name].filter(Boolean).join(" ") || fallback;
}

async function who(job: { data: { requestedBy?: string } }, key: string) {
  const a = await uidAllowed(job.data.requestedBy, key);
  if (!a.ok) throw new PermanentJobError("You don't have access to do that");
  return a.name;
}

/** Hourly: delete closed channels that are due (Cortana Setup → delete after) and auto-close quiet tickets. */
async function cleanup(client: Client<true>) {
  const now = nowISO();
  const due = await TerminalDoc.find({ parent: "tickets", "data.status": "closed", "data.channelDeleted": { $ne: true }, "data.deleteAtISO": { $ne: null, $lt: now } }, { docId: 1 }).limit(20).lean();
  for (const d of due) await removeChannel(client, String(d.docId), "Cortana (auto)").catch((e) => log.warn(`Ticket auto-delete failed: ${(e as Error).message}`));
  const S = await tset();
  if (S.autoCloseDays > 0) {
    const cut = new Date(Date.now() - S.autoCloseDays * 86400_000).toISOString();
    const quiet = await TerminalDoc.find({ parent: "tickets", "data.status": "open", "data.lastActivityISO": { $lt: cut } }, { docId: 1 }).limit(20).lean();
    for (const d of quiet) await close(client, String(d.docId), "Cortana", `No activity for ${S.autoCloseDays} days.`).catch((e) => log.warn(`Ticket auto-close failed: ${(e as Error).message}`));
  }
}

export function startTickets(client: Client<true>) {
  void TerminalDoc.find({ parent: "tickets", "data.status": "open" }, { docId: 1, "data.channelId": 1 }).lean()
    .then((docs) => docs.forEach((d) => openChannels.set((d as any).data.channelId, String(d.docId))));

  registerJob("ticket.panel", async (job, c) => (await who(job, "tkrep"), postPanel(c, String(job.data.payload?.typeId ?? ""))));
  registerJob("ticket.panelRemove", async (job, c) => {
    await who(job, "tkrep");
    const { channelId, messageId } = (job.data.payload ?? {}) as Record<string, string>;
    const ch = channelId ? await c.channels.fetch(channelId).catch(() => null) : null;
    if (ch && "messages" in ch && messageId) await (await ch.messages.fetch(messageId).catch(() => null))?.delete().catch(() => {});
    return { ok: true };
  });
  registerJob("ticket.reply", async (job, c) => {
    const by = await who(job, "tk");
    const { ticketId, text, note } = (job.data.payload ?? {}) as { ticketId: string; text: string; note?: boolean };
    const body = String(text || "").trim().slice(0, 1900);
    if (!body) throw new PermanentJobError("Empty reply");
    const tk = await getTicket(String(ticketId));
    if (!tk) throw new PermanentJobError("Ticket not found");
    if (note) { await patch(String(ticketId), {}, { who: by, whoId: "", staff: true, note: true, text: body, atISO: nowISO() }); return { ok: true }; }
    if (tk.status !== "open") throw new PermanentJobError("Ticket is closed");
    const ch = await c.channels.fetch(tk.channelId).catch(() => null);
    if (!ch || !("send" in ch)) throw new PermanentJobError("Ticket channel is gone");
    const m = mentionsIn(body);
    await ch.send({ content: `**${await signName(job.data.requestedBy, by)}**\n${body}`.slice(0, 2000), allowedMentions: { users: m.users, roles: m.roles } });
    const set: Record<string, unknown> = { lastActivityISO: nowISO(), waiting: "member" };
    if (tk.firstReplyMs == null) set.firstReplyMs = Date.now() - Date.parse(tk.openedAtISO);
    await patch(String(ticketId), set, { who: by, whoId: "", staff: true, text: body, atISO: nowISO() });
    return { ok: true };
  });
  registerJob("ticket.claim", async (job, c) => (await claim(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk")), { ok: true }));
  registerJob("ticket.close", async (job, c) => (await close(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk"), String(job.data.payload?.reason ?? "")), { ok: true }));
  registerJob("ticket.reopen", async (job, c) => (await reopen(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk")), { ok: true }));
  registerJob("ticket.transcript", async (job, c) => (await sendTranscript(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk")), { ok: true }));
  registerJob("ticket.delete", async (job, c) => (await removeChannel(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk")), { ok: true }));
  registerJob("ticket.add", async (job, c) => (await addPerson(c, String(job.data.payload?.ticketId ?? ""), String(job.data.payload?.userId ?? ""), await who(job, "tk"), true), { ok: true }));
  registerJob("ticket.remove", async (job, c) => (await addPerson(c, String(job.data.payload?.ticketId ?? ""), String(job.data.payload?.userId ?? ""), await who(job, "tk"), false), { ok: true }));
  registerJob("ticket.move", async (job, c) => {
    const by = await who(job, "tk");
    const { ticketId, typeId } = (job.data.payload ?? {}) as Record<string, string>;
    const [tk, t] = [await getTicket(ticketId), await getType(typeId)];
    if (!tk || !t) throw new PermanentJobError("Ticket or type not found");
    const ch = await c.channels.fetch(tk.channelId).catch(() => null);
    if (ch && ch.type === ChannelType.GuildText) {
      const g = ch.guild;
      if (t.categoryId && g.channels.cache.has(t.categoryId)) await ch.setParent(t.categoryId, { lockPermissions: false }).catch(() => {});
      for (const r of t.staffRoleIds ?? []) if (g.roles.cache.has(r)) await ch.permissionOverwrites.edit(r, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }).catch(() => {});
      await ch.send({ content: `⇄ Moved to **${t.name}** by ${by}.`, allowedMentions: { parse: [] } }).catch(() => {});
    }
    await patch(ticketId, { typeId, typeName: t.name, typeEmoji: t.emoji ?? "" }, { who: "Cortana", whoId: "", staff: true, text: `⇄ Moved to ${t.name} by ${by}.`, atISO: nowISO() });
    return { ok: true };
  });

  void cleanup(client).catch(() => {});
  const timer = setInterval(() => void cleanup(client).catch((e) => log.warn(`Ticket clean-up failed: ${(e as Error).message}`)), 3600_000);
  return () => clearInterval(timer);
}
