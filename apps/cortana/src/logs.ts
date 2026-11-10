/**
 * Logs + welcome (replaces the old Cortana's member / message loggers).
 * Cortana Setup → Logs:    joinLeaveId (member joined / left) · messageLogId (message deleted / edited)
 * Cortana Setup → Welcome: welcome { on, channelId, roleId, dm, text }  ({user} {server})
 * Needs the Server Members + Message Content intents (already on).
 */
import { EmbedBuilder, type Client, type GuildMember, type Message, type PartialGuildMember, type PartialMessage } from "discord.js";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { LOGO, cortanaSettings, safeRole } from "./util.ts";

const ts = (ms: number | null | undefined) => (ms ? `<t:${Math.floor(ms / 1000)}:R>` : "Unknown");
async function send(client: Client, channelId: string | undefined, e: EmbedBuilder) {
  if (!channelId) return;
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (ch && "send" in ch) await ch.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}
const cut = (s: string, n = 1000) => (s.length > n ? s.slice(0, n - 1) + "…" : s) || "*No text*";

export async function onJoin(client: Client, m: GuildMember) {
  if (m.guild.id !== env.AUTHORISED_GUILD_ID) return;
  const s = await cortanaSettings();
  await send(client, s.logs?.joinLeaveId, new EmbedBuilder().setColor(0x57f287).setAuthor({ name: `Member Joined: ${m.user.tag}`, iconURL: LOGO })
    .setThumbnail(m.user.displayAvatarURL()).addFields(
      { name: "Display Name", value: m.displayName, inline: true },
      { name: "Account Created", value: ts(m.user.createdTimestamp), inline: true },
      { name: "Joined", value: ts(m.joinedTimestamp), inline: true },
    ).setFooter({ text: `505th Expeditionary Force • Member Joined · ID ${m.id}`, iconURL: LOGO }).setTimestamp());

  const w = s.welcome;
  if (!w?.on) return;
  const text = String(w.text || "Welcome to the 505th, {user}!").replace(/\{user\}/g, `<@${m.id}>`).replace(/\{server\}/g, m.guild.name).slice(0, 1900);
  const e = new EmbedBuilder().setColor(0x194a77).setDescription(text).setThumbnail(LOGO).setFooter({ text: "505th Expeditionary Force", iconURL: LOGO });
  if (w.channelId) {
    const ch = await client.channels.fetch(w.channelId).catch(() => null);
    if (ch && "send" in ch) await ch.send({ content: `<@${m.id}>`, embeds: [e], allowedMentions: { users: [m.id] } }).catch(() => {});
  }
  if (w.dm) await m.send({ embeds: [new EmbedBuilder().setColor(0x194a77).setDescription(text.replace(`<@${m.id}>`, m.displayName))] }).catch(() => {});
  if (w.roleId) {
    const { role, why } = safeRole(m.guild, w.roleId);
    if (role) await m.roles.add(role, "Welcome role").catch(() => {});
    else log.warn(`Welcome role not given: ${why}`);
  }
}

export async function onLeave(client: Client, m: GuildMember | PartialGuildMember) {
  if (m.guild.id !== env.AUTHORISED_GUILD_ID) return;
  const s = await cortanaSettings();
  await send(client, s.logs?.joinLeaveId, new EmbedBuilder().setColor(0xed4245).setAuthor({ name: `Member Left: ${m.user?.tag ?? m.id}`, iconURL: LOGO })
    .setThumbnail(m.user?.displayAvatarURL() ?? null).addFields(
      { name: "Display Name", value: m.displayName || "Unknown", inline: true },
      { name: "User ID", value: m.id, inline: true },
      { name: "Joined", value: ts(m.joinedTimestamp), inline: true },
    ).setFooter({ text: "505th Expeditionary Force • Member Left", iconURL: LOGO }).setTimestamp());
}

export async function onMessageDelete(client: Client, msg: Message | PartialMessage) {
  if (!msg.guildId || msg.guildId !== env.AUTHORISED_GUILD_ID || msg.partial || msg.author?.bot) return;
  const s = await cortanaSettings();
  const files = [...msg.attachments.values()].map((a) => a.name).join(", ");
  await send(client, s.logs?.messageLogId, new EmbedBuilder().setColor(0xed4245).setTitle("🗑️ Message Deleted")
    .setDescription(`**Author:** <@${msg.author?.id}> (${msg.member?.displayName ?? msg.author?.username})\n**Channel:** <#${msg.channelId}>\n**Content:**\n${cut(msg.content ?? "")}${files ? `\n**Files:** ${files}` : ""}`)
    .setFooter({ text: "505th Expeditionary Force • Message Log", iconURL: LOGO }).setTimestamp());
}

export async function onMessageEdit(client: Client, before: Message | PartialMessage, after: Message | PartialMessage) {
  if (!after.guildId || after.guildId !== env.AUTHORISED_GUILD_ID || after.author?.bot) return;
  if (before.partial || before.content === after.content) return; // embeds loading etc.
  const s = await cortanaSettings();
  await send(client, s.logs?.messageLogId, new EmbedBuilder().setColor(0xf59e0b).setTitle("✏️ Message Edited")
    .setDescription(`**Author:** <@${after.author?.id}> (${after.member?.displayName ?? after.author?.username})\n**Channel:** <#${after.channelId}> · [Jump](${after.url})`)
    .addFields({ name: "Before", value: cut(before.content ?? "") }, { name: "After", value: cut(after.content ?? "") })
    .setFooter({ text: "505th Expeditionary Force • Message Log", iconURL: LOGO }).setTimestamp());
}
