/**
 * Quick Upload (approved mock 2026-11-10). Website uploads images to Cloudinary, then queues
 * `quick.upload` — Cortana posts them in ONE message. Access: "qu" (server-stamped requestedBy).
 *   payload { channelId, images: [https url], style: "embed" | "grid" | "plain", caption?, credit?, op? }
 * embed = 505th embed (title, caption, credit) + the rest as a gallery · grid = images only, grouped (up to 4 show as a grid)
 * plain = image links only (Discord shows them full size). Recorded in discord_messages so it can be deleted from Send Message.
 */
import { ChannelType, EmbedBuilder, type Client } from "discord.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { mentionsIn } from "./util.ts";

const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
const img = z.string().url().max(1000).refine((u) => /^https:\/\/res\.cloudinary\.com\//.test(u), "Images must be uploaded through the website");
const P = z.object({
  channelId: z.string().regex(/^\d{5,25}$/),
  images: z.array(img).min(1).max(10),
  style: z.enum(["embed", "grid", "plain"]).default("embed"),
  caption: z.string().trim().max(1000).optional().default(""),
  credit: z.string().trim().max(200).optional().default(""),
  op: z.string().trim().max(150).optional().default(""),
});
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

export function startQuickUpload() {
  registerJob("quick.upload", async (job, client) => {
    const who = await uidAllowed(job.data.requestedBy, "qu");
    if (!who.ok) throw new PermanentJobError("You don't have Quick Upload access");
    const r = P.safeParse(job.data.payload);
    if (!r.success) throw new PermanentJobError(`Invalid upload: ${r.error.issues[0]?.message ?? "bad input"}`);
    const p = r.data;
    const ch = await client.channels.fetch(p.channelId).catch(() => null);
    if (!ch || !("guildId" in ch) || ch.guildId !== env.AUTHORISED_GUILD_ID || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type) || !("send" in ch)) {
      throw new PermanentJobError("Channel not found or can't take messages");
    }
    const groupUrl = `https://www.505expeditionaryforce.com/#g-${autoId().slice(0, 8)}`; // same url = Discord groups images into one gallery
    let msg;
    if (p.style === "plain") {
      msg = await ch.send({ content: [p.caption, ...p.images].filter(Boolean).join("\n").slice(0, 2000), allowedMentions: { users: mentionsIn(p.caption).users, roles: mentionsIn(p.caption).roles } });
    } else {
      const embeds = p.images.map((u, i) => {
        const e = new EmbedBuilder().setURL(groupUrl).setImage(u).setColor(0x00d9ff);
        if (i === 0 && p.style === "embed") {
          e.setTitle(`📸 ${p.op || "505th Expeditionary Force"}`.slice(0, 256));
          if (p.caption) e.setDescription(p.caption);
          e.setFooter({ text: [p.credit, `${p.images.length} image${p.images.length > 1 ? "s" : ""}`, "505th Expeditionary Force"].filter(Boolean).join(" · ").slice(0, 2048), iconURL: LOGO });
        }
        return e;
      });
      msg = await ch.send({ content: p.style === "grid" && p.caption ? p.caption : undefined, embeds, allowedMentions: { parse: [] } });
    }
    const id = autoId();
    const now = new Date();
    await TerminalDoc.create({ _id: `discord_messages/${id}`, parent: "discord_messages", docId: id, createTime: now, updateTime: now,
      data: { kind: "upload", channelId: ch.id, channelName: ch.name, messageId: msg.id, jumpUrl: msg.url, content: p.caption,
        embed: { title: `📸 ${p.op || "Images"} (${p.images.length})`, description: p.caption }, images: p.images, buttons: [], ping: "",
        sentBy: job.data.requestedBy, sentByName: who.name, sentAtISO: now.toISOString() } });
    log.info(`Quick Upload: ${p.images.length} image(s) to #${ch.name} by ${who.name}.`);
    return { recordId: id, jumpUrl: msg.url };
  });
}
