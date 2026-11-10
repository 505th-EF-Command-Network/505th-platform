/**
 * Info Posts (approved mock 2026-11-10). Permanent posts made on the website (info_posts/<id>, access "info").
 * Cortana EDITS the same Discord message every time; it only posts a new one if the old one is gone.
 *
 * Jobs:  info.publish { postId }  ·  info.delete { channelId, messageId }
 * Buttons (custom id ip:<postId>:<n>): accept (give role once) · toggle (add/remove role) · reply (private message)
 *   · ticket (open a ticket of a type) · link (Discord handles it). Role menu: ipm:<postId>.
 * Hourly: posts whose message was deleted in Discord are marked "missing" (website shows RE-POST).
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
  type ButtonInteraction, type Client, type StringSelectMenuInteraction,
} from "discord.js";
import { z } from "zod";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, safeRole } from "./util.ts";
import { openTicket } from "./tickets.ts";

const STYLE: Record<string, ButtonStyle> = { green: ButtonStyle.Success, blue: ButtonStyle.Primary, red: ButtonStyle.Danger, grey: ButtonStyle.Secondary };
const Field = z.object({ name: z.string().trim().min(1).max(256), value: z.string().trim().min(1).max(1024), inline: z.boolean().optional() });
const Embed = z.object({
  title: z.string().trim().max(256).default(""), description: z.string().max(4000).default(""), color: z.number().int().min(0).max(0xffffff).default(0x194a77),
  fields: z.array(Field).max(25).default([]), image: z.string().max(1000).default(""), thumbnail: z.enum(["logo", "none"]).or(z.string().max(1000)).default("logo"),
  footer: z.string().max(2048).default(""),
});
const Btn = z.object({
  type: z.enum(["accept", "toggle", "link", "ticket", "reply"]), label: z.string().trim().min(1).max(80), emoji: z.string().max(64).default(""),
  style: z.enum(["green", "blue", "red", "grey"]).default("grey"), roleId: z.string().default(""), url: z.string().max(1000).default(""),
  ticketType: z.string().default(""), reply: z.string().max(1900).default(""),
});
const Post = z.object({
  name: z.string().max(100).default(""), channelId: z.string().regex(/^\d{5,25}$/), content: z.string().max(1900).default(""),
  embeds: z.array(Embed).max(10).default([]), buttons: z.array(Btn).max(25).default([]),
  menu: z.object({ placeholder: z.string().max(150).default("Pick…"), roleIds: z.array(z.string()).max(25).default([]), max: z.number().int().min(1).max(25).default(1) }).nullable().default(null),
  pin: z.boolean().default(false), clearReactions: z.boolean().default(false), discord: z.any().optional(),
});
type PostT = z.infer<typeof Post>;

const fmtDate = () => new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });
const https = (u: string) => /^https:\/\/\S+$/.test(u);

function build(id: string, p: PostT) {
  const embeds = p.embeds.filter((e) => e.title || e.description || e.fields.length || e.image).map((e) => {
    const b = new EmbedBuilder().setColor(e.color).setTitle(e.title || null).setDescription(e.description || null);
    if (e.fields.length) b.addFields(e.fields.map((f) => ({ name: f.name, value: f.value, inline: !!f.inline })));
    if (https(e.image)) b.setImage(e.image);
    if (e.thumbnail === "logo") b.setThumbnail(LOGO);
    else if (https(e.thumbnail)) b.setThumbnail(e.thumbnail);
    if (e.footer) b.setFooter({ text: e.footer.replace(/\{date\}/g, fmtDate()), iconURL: LOGO });
    return b;
  });
  const rows: ActionRowBuilder<any>[] = [];
  const btns = p.buttons.map((b, n) => {
    const x = new ButtonBuilder().setLabel(b.label);
    if (b.emoji) x.setEmoji(b.emoji);
    if (b.type === "link") return https(b.url) ? x.setStyle(ButtonStyle.Link).setURL(b.url) : null;
    return x.setStyle(STYLE[b.style]).setCustomId(`ip:${id}:${n}`);
  }).filter((x): x is ButtonBuilder => !!x);
  for (let i = 0; i < btns.length && rows.length < (p.menu?.roleIds.length ? 4 : 5); i += 5) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(btns.slice(i, i + 5)));
  if (p.menu?.roleIds.length) {
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`ipm:${id}`).setPlaceholder(p.menu.placeholder)
      .setMinValues(0).setMaxValues(Math.min(p.menu.max, p.menu.roleIds.length)).addOptions(p.menu.roleIds.slice(0, 25).map((r) => ({ label: `@${r}`, value: r })))));
  }
  if (!embeds.length && !p.content.trim()) throw new PermanentJobError("The post is empty");
  return { content: p.content.trim() || null, embeds, components: rows, allowedMentions: { parse: [] as const } };
}

async function setDiscord(id: string, patch: Record<string, unknown>) {
  await TerminalDoc.updateOne({ _id: `info_posts/${id}` }, { $set: { ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`data.discord.${k}`, v])), updateTime: new Date() } });
}

async function publish(client: Client<true>, id: string) {
  const raw = (await TerminalDoc.findById(`info_posts/${id}`, { data: 1 }).lean())?.data;
  if (!raw) throw new PermanentJobError("Info post not found");
  const r = Post.safeParse(raw);
  if (!r.success) throw new PermanentJobError(`Invalid post: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
  const p = r.data;
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID)!;
  // Role menu labels: show role names.
  const body = build(id, p);
  if (p.menu?.roleIds.length) {
    const menu = body.components[body.components.length - 1].components[0] as StringSelectMenuBuilder;
    menu.setOptions(p.menu.roleIds.map((rid) => ({ label: (g.roles.cache.get(rid)?.name ?? "deleted role").slice(0, 100), value: rid })));
  }
  const ch = await client.channels.fetch(p.channelId).catch(() => null);
  if (!ch || !("guildId" in ch) || ch.guildId !== g.id || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type) || !("send" in ch)) throw new PermanentJobError("Channel not found or can't take messages");
  const old = p.discord?.messageId && p.discord.channelId === ch.id ? await ch.messages.fetch(p.discord.messageId).catch(() => null) : null;
  // Moved to another channel: remove the old message.
  if (p.discord?.messageId && p.discord.channelId && p.discord.channelId !== ch.id) {
    const oc = await client.channels.fetch(p.discord.channelId).catch(() => null);
    if (oc && "messages" in oc) await (await oc.messages.fetch(p.discord.messageId).catch(() => null))?.delete().catch(() => {});
  }
  const msg = old ? await old.edit(body) : await ch.send({ ...body, content: body.content ?? undefined });
  if (p.clearReactions) { // imported from the old reaction-role message → buttons now
    await msg.reactions.removeAll().catch(() => {});
    await TerminalDoc.updateOne({ _id: `info_posts/${id}` }, { $set: { "data.clearReactions": false } });
  }
  if (p.pin && !msg.pinned) await msg.pin().catch(() => {});
  if (!p.pin && msg.pinned) await msg.unpin().catch(() => {});
  await setDiscord(id, { channelId: ch.id, messageId: msg.id, jumpUrl: msg.url, postedAtISO: new Date().toISOString(), missing: false, error: null });
  log.info(`Info post "${p.name}" ${old ? "updated" : "posted"} in #${ch.name}.`);
  return { messageId: msg.id, reposted: !old };
}

/** Button clicks on info posts. Returns true if handled. */
export async function handleInfoButton(i: ButtonInteraction): Promise<boolean> {
  const [p, id, n] = i.customId.split(":");
  if (p !== "ip" || !id) return false;
  const raw = (await TerminalDoc.findById(`info_posts/${id}`, { data: 1 }).lean())?.data as any;
  const b = raw?.buttons?.[Number(n)];
  if (!b || !i.inCachedGuild()) return void (await i.reply({ content: "This button is no longer set up.", flags: MessageFlags.Ephemeral })), true;
  if (b.type === "reply") return void (await i.reply({ content: String(b.reply || "—").slice(0, 1900), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } })), true;
  if (b.type === "ticket") { await openTicket(i, String(b.ticketType || "")); return true; }
  const { role, why } = safeRole(i.guild, b.roleId);
  if (!role) return void (await i.reply({ content: `⚠️ ${why} Tell a staff member.`, flags: MessageFlags.Ephemeral })), true;
  const has = i.member.roles.cache.has(role.id);
  try {
    if (b.type === "accept") {
      if (!has) await i.member.roles.add(role, "Info post: accepted");
      await i.reply({ content: has ? `You already have **@${role.name}**.` : `✅ Thanks! You now have **@${role.name}**.`, flags: MessageFlags.Ephemeral });
    } else {
      if (has) await i.member.roles.remove(role, "Info post: role toggle");
      else await i.member.roles.add(role, "Info post: role toggle");
      await i.reply({ content: has ? `Removed **@${role.name}**. Click again to get it back.` : `✅ Added **@${role.name}**. Click again to remove it.`, flags: MessageFlags.Ephemeral });
    }
  } catch {
    await i.reply({ content: "⚠️ Cortana couldn't change your roles (missing Manage Roles?). Tell a staff member.", flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return true;
}

/** Role drop-down on info posts: the picked roles (from this menu) are set, the others from this menu removed. */
export async function handleInfoMenu(i: StringSelectMenuInteraction): Promise<boolean> {
  const [p, id] = i.customId.split(":");
  if (p !== "ipm" || !id || !i.inCachedGuild()) return false;
  const raw = (await TerminalDoc.findById(`info_posts/${id}`, { data: 1 }).lean())?.data as any;
  const allowedIds: string[] = raw?.menu?.roleIds ?? [];
  const add: string[] = [], remove: string[] = [], skipped: string[] = [];
  for (const rid of allowedIds) {
    const { role } = safeRole(i.guild, rid);
    if (!role) { skipped.push(rid); continue; }
    const want = i.values.includes(rid), has = i.member.roles.cache.has(rid);
    if (want && !has) add.push(rid);
    if (!want && has) remove.push(rid);
  }
  try {
    if (add.length) await i.member.roles.add(add, "Info post: role menu");
    if (remove.length) await i.member.roles.remove(remove, "Info post: role menu");
    const names = (ids: string[]) => ids.map((r) => "@" + (i.guild.roles.cache.get(r)?.name ?? "role")).join(", ");
    await i.reply({ content: [add.length ? `✅ Added ${names(add)}` : "", remove.length ? `Removed ${names(remove)}` : "", !add.length && !remove.length ? "No change." : ""].filter(Boolean).join("\n"), flags: MessageFlags.Ephemeral });
  } catch {
    await i.reply({ content: "⚠️ Cortana couldn't change your roles. Tell a staff member.", flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return true;
}

async function checkMissing(client: Client<true>) {
  const docs = await TerminalDoc.find({ parent: "info_posts", "data.discord.messageId": { $exists: true } }, { docId: 1, "data.discord": 1 }).lean();
  for (const d of docs) {
    const dc = (d as any).data.discord;
    const ch = await client.channels.fetch(dc.channelId).catch(() => null);
    const ok = ch && "messages" in ch ? !!(await ch.messages.fetch(dc.messageId).catch(() => null)) : false;
    if (ok === !!dc.missing) await setDiscord(String(d.docId), { missing: !ok });
  }
}

export function startInfoPosts(client: Client<true>) {
  registerJob("info.publish", async (job, c) => {
    if (!(await uidAllowed(job.data.requestedBy, "info")).ok) throw new PermanentJobError("You don't have Info Posts access");
    const id = String(job.data.payload?.postId ?? "");
    try {
      return await publish(c, id);
    } catch (e) {
      await setDiscord(id, { error: (e as Error).message }).catch(() => {});
      throw e;
    }
  });
  registerJob("info.delete", async (job, c) => {
    if (!(await uidAllowed(job.data.requestedBy, "info")).ok) throw new PermanentJobError("You don't have Info Posts access");
    const { channelId, messageId } = (job.data.payload ?? {}) as Record<string, string>;
    const ch = channelId ? await c.channels.fetch(channelId).catch(() => null) : null;
    if (ch && "messages" in ch && messageId) await (await ch.messages.fetch(messageId).catch(() => null))?.delete().catch(() => {});
    return { ok: true };
  });
  const t = setInterval(() => void checkMissing(client).catch((e) => log.warn(`Info post check failed: ${(e as Error).message}`)), 3600_000);
  setTimeout(() => void checkMissing(client).catch(() => {}), 20_000);
  return () => clearInterval(t);
}
