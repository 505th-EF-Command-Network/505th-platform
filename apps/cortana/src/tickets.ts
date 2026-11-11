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
import { LOGO, auditLog, autoId, cortanaSettings, mentionsIn, nextNumber, nowISO } from "./util.ts";

type TType = { name: string; emoji?: string; channelId: string; categoryId?: string; purpose?: string; staffRoleIds?: string[]; question?: string; color?: number; btnLabel?: string; btnEmoji?: string; btnStyle?: string; panel?: { channelId?: string; messageId?: string } };
type Line = { who: string; whoId: string; staff: boolean; text: string; images?: string[]; note?: boolean; atISO: string };
type Ticket = { number: number; typeId: string; typeName: string; channelId: string; openerId: string; openerName: string; status: "open" | "closed";
  claimedByName?: string; openedAtISO: string; closedAtISO?: string; closedByName?: string; closeReason?: string; channelDeleted?: boolean; deleteAtISO?: string; lastActivityISO: string; waiting: "staff" | "member"; firstReplyMs?: number; transcript: Line[] };

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
function transcriptHtml(tk: Ticket) {
  const d = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const rows = (tk.transcript ?? []).map((l) => `<div class="m${l.note ? " n" : ""}"><div class="w"><b>${h(l.who)}</b>${l.staff ? '<em>STAFF</em>' : ""}${l.note ? '<em class="nt">STAFF NOTE</em>' : ""}<small>${h(d(l.atISO))}</small></div><div class="t">${h(l.text).replace(/\n/g, "<br>")}${(l.images ?? []).map((u) => `<br><a href="${h(u)}">📎 image</a>`).join("")}</div></div>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Ticket #${pad(tk.number)} · ${h(tk.typeName)}</title><style>
body{margin:0;background:#0a0e12;color:#dbe7ee;font:14px/1.5 "Segoe UI",Arial,sans-serif}.w0{max-width:860px;margin:0 auto;padding:24px}
h1{color:#00d9ff;font-size:20px;margin:0}.meta{color:#8aa0ab;font-size:13px;margin:6px 0 18px}.m{border-top:1px solid #1d2a31;padding:10px 0}.m.n{background:#1a1505}
.w b{color:#fff}.w em{font-style:normal;font-size:10px;letter-spacing:1px;padding:1px 6px;margin-left:6px;border:1px solid #00d9ff;color:#00d9ff}.w em.nt{border-color:#f59e0b;color:#f59e0b}
.w small{color:#6f8a96;margin-left:8px;font-size:11px}.t{margin-top:2px;white-space:normal;word-wrap:break-word}a{color:#00a8fc}</style></head><body><div class="w0">
<h1>505th · Ticket #${pad(tk.number)} · ${h(tk.typeName)}</h1>
<div class="meta">Opened by <b>${h(tk.openerName)}</b> (${h(tk.openerId)}) · ${h(d(tk.openedAtISO))}${tk.claimedByName ? ` · claimed by ${h(tk.claimedByName)}` : ""}${tk.closedAtISO ? ` · closed ${h(d(tk.closedAtISO))} by ${h(tk.closedByName)} — “${h(tk.closeReason)}”` : ""} · ${(tk.transcript ?? []).length} messages</div>
${rows}</div></body></html>`;
}

async function sendTranscript(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk) throw new PermanentJobError("Ticket not found");
  const S = await tset();
  const target = S.transcriptChannelId || S.logChannelId;
  if (!target) throw new PermanentJobError("Pick a transcript channel in Cortana Setup → Tickets first");
  const ch = await client.channels.fetch(target).catch(() => null);
  if (!ch || !("send" in ch)) throw new PermanentJobError("The transcript channel is missing");
  const file = new AttachmentBuilder(Buffer.from(transcriptHtml(tk), "utf8"), { name: `transcript-ticket-${pad(tk.number)}.html` });
  await ch.send({ embeds: [new EmbedBuilder().setColor(0x00d9ff).setTitle(`📑 Transcript · Ticket #${pad(tk.number)}`)
    .setDescription(`${tk.typeName} · opened by <@${tk.openerId}> · ${(tk.transcript ?? []).length} messages\nSaved by **${by}**. Open the file in a web browser.`).setTimestamp()], files: [file], allowedMentions: { parse: [] } });
  await patch(id, { transcriptAtISO: nowISO() });
}

async function removeChannel(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk) throw new PermanentJobError("Ticket not found");
  if (tk.status === "open") await close(client, id, by, "Deleted");
  await sendTranscript(client, id, by).catch((e) => log.warn(`Transcript before delete failed: ${(e as Error).message}`));
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
    await ch.send({ content: m.text || undefined, embeds: [new EmbedBuilder().setColor(0x00d9ff).setAuthor({ name: `${by} · staff (via website)` }).setDescription(body)], allowedMentions: { users: m.users, roles: m.roles } });
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
