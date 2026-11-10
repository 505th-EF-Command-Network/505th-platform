/**
 * Tickets (approved mock 2026-11-10). Each ticket TYPE has its own panel channel (e.g. Recruitment in #join-505th,
 * Tech Support in #tech-support) — types are set on the website (ticket_types/<id>).
 * A member presses the panel button → a private channel opens (member + that type's staff roles + Cortana).
 * Everything said is copied to tickets/<id>.transcript so staff can answer from the website too.
 *
 * Jobs (website): ticket.panel {typeId} · ticket.panelRemove {channelId,messageId} · ticket.reply {ticketId,text,note?}
 *                 ticket.claim {ticketId} · ticket.close {ticketId} · ticket.move {ticketId,typeId}
 * Buttons: tko:<typeId> (open) · tkc:claim:<ticketId> · tkc:close:<ticketId>
 * Closed tickets: channel locked, deleted after 24 h. Transcript kept on the website.
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, OverwriteType, PermissionFlagsBits,
  type ButtonInteraction, type Client, type GuildMember, type Message, type TextChannel,
} from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { allowed, uidAllowed } from "./access.ts";
import { LOGO, auditLog, autoId, mentionsIn, nextNumber, nowISO } from "./util.ts";

type TType = { name: string; emoji?: string; channelId: string; categoryId?: string; purpose?: string; staffRoleIds?: string[]; question?: string; color?: number; btnLabel?: string; btnEmoji?: string; btnStyle?: string; panel?: { channelId?: string; messageId?: string } };
type Line = { who: string; whoId: string; staff: boolean; text: string; images?: string[]; note?: boolean; atISO: string };
type Ticket = { number: number; typeId: string; typeName: string; channelId: string; openerId: string; openerName: string; status: "open" | "closed";
  claimedByName?: string; openedAtISO: string; closedAtISO?: string; lastActivityISO: string; waiting: "staff" | "member"; firstReplyMs?: number; transcript: Line[] };

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
  const mine = await TerminalDoc.findOne({ parent: "tickets", "data.typeId": typeId, "data.openerId": i.user.id, "data.status": "open" }, { "data.channelId": 1 }).lean();
  if (mine) return void (await i.editReply(`You already have an open ${t.name} ticket: <#${(mine as any).data.channelId}>`));
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
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tkc:claim:${id}`).setLabel("Claim").setEmoji("✋").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tkc:close:${id}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger),
  );
  await ch.send({ content: `<@${i.user.id}> ${staffRoles.map((r) => `<@&${r}>`).join(" ")}`.trim(), embeds: [e], components: [row], allowedMentions: { users: [i.user.id], roles: staffRoles } });
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
async function close(client: Client<true>, id: string, by: string) {
  const tk = await getTicket(id);
  if (!tk || tk.status !== "open") return;
  await patch(id, { status: "closed", closedAtISO: nowISO(), closedByName: by }, { who: "Cortana", whoId: "", staff: true, text: `🔒 Closed by ${by}.`, atISO: nowISO() });
  openChannels.delete(tk.channelId);
  const ch = await client.channels.fetch(tk.channelId).catch(() => null);
  if (ch && ch.type === ChannelType.GuildText) {
    await ch.permissionOverwrites.edit(tk.openerId, { SendMessages: false }).catch(() => {});
    await ch.send({ content: `🔒 **Ticket closed** by ${by}. This channel is deleted in 24 hours. Need more help? Open a new ticket.`, allowedMentions: { parse: [] } }).catch(() => {});
    await ch.setName(`closed-${pad(tk.number)}`).catch(() => {});
  }
  await auditLog("TICKET CLOSED", `#${pad(tk.number)} ${tk.typeName} — ${tk.openerName}`, by);
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
  if (action === "close") {
    if (!staff && i.user.id !== tk.openerId) return void (await i.reply({ content: "Only staff or the person who opened it can close this.", flags: MessageFlags.Ephemeral })), true;
    await i.deferUpdate();
    await close(i.client, id, i.member.displayName);
    return true;
  }
  return false;
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

async function cleanup(client: Client<true>) {
  const cut = new Date(Date.now() - 24 * 3600_000).toISOString();
  const docs = await TerminalDoc.find({ parent: "tickets", "data.status": "closed", "data.closedAtISO": { $lt: cut }, "data.channelDeleted": { $ne: true } }, { docId: 1, "data.channelId": 1 }).lean();
  for (const d of docs) {
    const ch = await client.channels.fetch((d as any).data.channelId).catch(() => null);
    if (ch && "delete" in ch) await ch.delete("Ticket closed 24 h ago").catch(() => {});
    await patch(String(d.docId), { channelDeleted: true });
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
  registerJob("ticket.close", async (job, c) => (await close(c, String(job.data.payload?.ticketId ?? ""), await who(job, "tk")), { ok: true }));
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

  const timer = setInterval(() => void cleanup(client).catch((e) => log.warn(`Ticket clean-up failed: ${(e as Error).message}`)), 3600_000);
  return () => clearInterval(timer);
}
