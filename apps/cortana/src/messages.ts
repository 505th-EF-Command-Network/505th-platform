/**
 * Send Message (approved mock 2026-11-10). Website → bot_jobs → Cortana posts / edits / deletes as Cortana.
 * Every message Cortana sends from the website is recorded in `discord_messages/<id>` so it can be edited later.
 *
 * Jobs:
 *   message.send   { channelId, content?, embed?, buttons?, ping? }          → new message
 *   message.edit   { recordId, content?, embed?, buttons? }                  → edits the same message (never re-pings)
 *   message.delete { recordId }
 * Only people with "send" access (checked on the server-stamped requestedBy). @everyone only when asked.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, type Client, type MessageCreateOptions } from "discord.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";

const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
const https = z.string().trim().url().max(1000).refine((u) => u.startsWith("https://"), "Links must start with https://");
const Embed = z.object({
  title: z.string().trim().max(256).optional().default(""),
  description: z.string().max(4000).optional().default(""),
  color: z.number().int().min(0).max(0xffffff).optional(),
  image: https.optional().or(z.literal("")),
  thumbnail: z.boolean().optional(),
});
const Body = z.object({
  content: z.string().max(1900).optional().default(""),
  embed: Embed.nullable().optional(),
  buttons: z.array(z.object({ label: z.string().trim().min(1).max(80), url: https })).max(5).optional().default([]),
});
const SendP = Body.extend({
  channelId: z.string().regex(/^\d{5,25}$/),
  ping: z.object({ everyone: z.boolean().optional(), roles: z.array(z.string().regex(/^\d{5,25}$/)).max(10).optional() }).optional(),
});
const EditP = Body.extend({ recordId: z.string().regex(/^[A-Za-z0-9]{10,40}$/) });
const DelP = z.object({ recordId: z.string().regex(/^[A-Za-z0-9]{10,40}$/) });

const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const nowISO = () => new Date().toISOString();

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new PermanentJobError(`Invalid message: ${r.error.issues[0]?.message ?? "bad input"}`);
  return r.data;
}
async function mustAllow(job: { data: { requestedBy?: string } }) {
  const a = await uidAllowed(job.data.requestedBy, "send");
  if (!a.ok) throw new PermanentJobError("You don't have Send Message access");
  return a.name;
}
function build(b: z.infer<typeof Body>, by: string, pingText = "") {
  const e = b.embed;
  const hasEmbed = !!e && !!(e.title || e.description || e.image);
  if (!hasEmbed && !b.content.trim()) throw new PermanentJobError("The message is empty");
  const embeds = hasEmbed
    ? [new EmbedBuilder()
        .setColor(e!.color ?? 0x194a77)
        .setTitle(e!.title || null)
        .setDescription(e!.description || null)
        .setImage(e!.image || null)
        .setThumbnail(e!.thumbnail ? LOGO : null)
        .setFooter({ text: `505th Expeditionary Force · sent by ${by}`.slice(0, 2048), iconURL: LOGO })]
    : [];
  const components = b.buttons.length
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(b.buttons.map((x) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(x.label).setURL(x.url)))]
    : [];
  const content = [pingText, b.content.trim()].filter(Boolean).join("\n") || undefined;
  return { content, embeds, components };
}
async function textChannel(client: Client<true>, id: string) {
  const ch = await client.channels.fetch(id).catch(() => null);
  if (!ch || !("guildId" in ch) || ch.guildId !== env.AUTHORISED_GUILD_ID) throw new PermanentJobError("Channel not found in the 505th server");
  if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type) || !("send" in ch)) throw new PermanentJobError("That channel can't take messages");
  return ch;
}

export function startMessages() {
  // Cortana's own delayed deletes (e.g. the 24 h Aux Mod announcement). Website jobs always carry requestedBy → refused.
  registerJob("message.deleteLater", async (job, client) => {
    if (job.data.requestedBy) throw new PermanentJobError("Not allowed");
    const { channelId, messageId } = (job.data.payload ?? {}) as Record<string, string>;
    const ch = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
    if (ch && "messages" in ch && messageId) await (await ch.messages.fetch(messageId).catch(() => null))?.delete().catch(() => {});
    return { ok: true };
  });
  registerJob("message.send", async (job, client) => {
    const by = await mustAllow(job);
    const p = parse(SendP, job.data.payload);
    const ch = await textChannel(client, p.channelId);
    const roles = (p.ping?.roles ?? []).filter((r) => r !== env.AUTHORISED_GUILD_ID);
    const pingText = [p.ping?.everyone ? "@everyone" : "", ...roles.map((r) => `<@&${r}>`)].filter(Boolean).join(" ");
    const msg = await ch.send({ ...build(p, by, pingText), allowedMentions: { parse: p.ping?.everyone ? ["everyone"] : [], roles } } as MessageCreateOptions)
      .catch((e: Error) => { throw new PermanentJobError(`Discord refused: ${e.message}`); });
    const id = autoId();
    const now = new Date();
    await TerminalDoc.create({ _id: `discord_messages/${id}`, parent: "discord_messages", docId: id, createTime: now, updateTime: now,
      data: { channelId: ch.id, channelName: ch.name, messageId: msg.id, jumpUrl: msg.url, content: p.content, embed: p.embed ?? null, buttons: p.buttons,
        ping: pingText ? pingText.replace(/<@&(\d+)>/g, (_m, r) => `@${ch.guild.roles.cache.get(r)?.name ?? "role"}`) : "", sentBy: job.data.requestedBy, sentByName: by, sentAtISO: nowISO() } });
    log.info(`Message sent to #${ch.name} by ${by}.`);
    return { recordId: id, messageId: msg.id, jumpUrl: msg.url };
  });

  registerJob("message.edit", async (job, client) => {
    const by = await mustAllow(job);
    const p = parse(EditP, job.data.payload);
    const rec = (await TerminalDoc.findById(`discord_messages/${p.recordId}`, { data: 1 }).lean())?.data as any;
    if (!rec) throw new PermanentJobError("Message record not found");
    if (rec.kind === "upload") throw new PermanentJobError("Image posts can't be edited — delete and post again");
    const ch = await textChannel(client, rec.channelId);
    const msg = await ch.messages.fetch(rec.messageId).catch(() => null);
    if (!msg) throw new PermanentJobError("The message was deleted in Discord");
    const built = build(p, by);
    // Keep the original ping line (no new ping on edit).
    await msg.edit({ ...built, content: [rec.ping ? msg.content.split("\n")[0] : "", p.content.trim()].filter(Boolean).join("\n") || null, allowedMentions: { parse: [] } });
    await TerminalDoc.updateOne({ _id: `discord_messages/${p.recordId}` }, { $set: { "data.content": p.content, "data.embed": p.embed ?? null, "data.buttons": p.buttons, "data.editedByName": by, "data.editedAtISO": nowISO(), updateTime: new Date() } });
    return { ok: true };
  });

  registerJob("message.delete", async (job, client) => {
    await mustAllow(job);
    const p = parse(DelP, job.data.payload);
    const rec = (await TerminalDoc.findById(`discord_messages/${p.recordId}`, { data: 1 }).lean())?.data as any;
    if (rec) {
      const ch = await client.channels.fetch(rec.channelId).catch(() => null);
      if (ch && "messages" in ch) await (await ch.messages.fetch(rec.messageId).catch(() => null))?.delete().catch(() => {});
      await TerminalDoc.deleteOne({ _id: `discord_messages/${p.recordId}` });
    }
    return { ok: true };
  });
}
