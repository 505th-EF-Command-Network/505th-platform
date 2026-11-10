/**
 * Staff + fun slash commands (approved mock 2026-11-10).
 *  /warn /timeout /purge (modw) · /kick /ban (modk, confirm button) · /announce /say (send) · /poll (ev)
 *  /auxmod /restart (bot — Developer / Command) · /modlist (everyone views; posting a new one = Settings) · /coinflip (everyone)
 * Staff answers are private. Moderation uses the same cases as the website.
 */
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type ChatInputCommandInteraction, type GuildMember, type ModalSubmitInteraction, type SendableChannels,
} from "discord.js";
import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { allowed, websiteAccess } from "../access.ts";
import { doAction, type ModBy } from "../moderation.ts";
import { parsePreset, postModlist, type Mod } from "../modlist.ts";
import { markOffline } from "../health.ts";
import { log } from "../log.ts";
import { LOGO, auditLog, cortanaSettings } from "../util.ts";

type Cmd = { data: Pick<SlashCommandBuilder, "name" | "toJSON">; key: string | null; run: (i: ChatInputCommandInteraction) => Promise<void> };
const eph = { flags: MessageFlags.Ephemeral } as const;
const COLORS: Record<string, number> = { blue: 0x194a77, cyan: 0x00d9ff, green: 0x22e07a, amber: 0xf59e0b, red: 0xff4d4d };
const pending = new Map<string, { kind: string; userId: string; data: any; at: number }>();
const token = () => randomBytes(6).toString("hex");
const keep = (data: any, kind: string, userId: string) => { const t = token(); pending.set(t, { kind, userId, data, at: Date.now() }); for (const [k, v] of pending) if (Date.now() - v.at > 600_000) pending.delete(k); return t; };

async function modBy(m: GuildMember): Promise<ModBy> {
  const w = await websiteAccess(m.id);
  return { name: m.displayName, uid: "", role: w?.role || "officer", discordId: m.id };
}
const confirmRow = (t: string, label: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId(`cmdok:${t}`).setLabel(label).setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId(`cmdno:${t}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
);
const caseReply = (r: { caseNumber: number; dmSent: boolean }, label: string, who: string, reason: string) =>
  new EmbedBuilder().setColor(0x00d9ff).setTitle(`Case #${r.caseNumber} · ${label}`).setDescription(`<@${who}> · ${reason}`).setFooter({ text: `${r.dmSent ? "DM sent ✓" : "DM not sent"} · logged to the mod log` });

/* ───────── moderation ───────── */
const LENGTHS: [string, number][] = [["10 minutes", 10], ["1 hour", 60], ["6 hours", 360], ["1 day", 1440], ["1 week", 10080], ["28 days", 40320]];
const warn: Cmd = {
  key: "modw",
  data: new SlashCommandBuilder().setName("warn").setDescription("Warn a member (case + DM + mod log).")
    .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("They see this").setRequired(true).setMaxLength(500)),
  async run(i) {
    await i.deferReply(eph);
    const u = i.options.getUser("member", true), reason = i.options.getString("reason", true);
    const r = await doAction(i.client, await modBy(i.member as GuildMember), { discordId: u.id, action: "warn", reason });
    await i.editReply({ embeds: [caseReply(r, "Warning", u.id, reason)] });
  },
};
const timeout: Cmd = {
  key: "modw",
  data: new SlashCommandBuilder().setName("timeout").setDescription("Time a member out.")
    .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true))
    .addIntegerOption((o) => o.setName("length").setDescription("How long").setRequired(true).addChoices(...LENGTHS.map(([n, v]) => ({ name: n, value: v }))))
    .addStringOption((o) => o.setName("reason").setDescription("They see this").setRequired(true).setMaxLength(500)),
  async run(i) {
    await i.deferReply(eph);
    const u = i.options.getUser("member", true), reason = i.options.getString("reason", true), minutes = i.options.getInteger("length", true);
    const r = await doAction(i.client, await modBy(i.member as GuildMember), { discordId: u.id, action: "timeout", reason, minutes });
    await i.editReply({ embeds: [caseReply(r, `Timeout ${LENGTHS.find(([, v]) => v === minutes)?.[0]}`, u.id, reason)] });
  },
};
const kickOrBan = (action: "kick" | "ban"): Cmd => {
  const b = new SlashCommandBuilder().setName(action).setDescription(action === "kick" ? "Kick a member (confirm first)." : "Ban someone (confirm first).")
    .addUserOption((o) => o.setName("member").setDescription("Who").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("They see this").setRequired(true).setMaxLength(500));
  if (action === "ban") b.addIntegerOption((o) => o.setName("delete_messages").setDescription("Delete their recent messages").addChoices({ name: "Don't delete", value: 0 }, { name: "Last 24 hours", value: 1 }, { name: "Last 7 days", value: 7 }));
  return {
    key: "modk", data: b,
    async run(i) {
      const u = i.options.getUser("member", true), reason = i.options.getString("reason", true);
      const t = keep({ discordId: u.id, action, reason, deleteDays: i.options.getInteger("delete_messages") ?? 0 }, "mod", i.user.id);
      await i.reply({ content: `${action === "ban" ? "⛔" : "👢"} **${action === "ban" ? "Ban" : "Kick"} ${u.username}?** Reason: ${reason}`, components: [confirmRow(t, action === "ban" ? "Yes, ban" : "Yes, kick")], ...eph });
    },
  };
};
const purge: Cmd = {
  key: "modw",
  data: new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages in this channel.")
    .addIntegerOption((o) => o.setName("amount").setDescription("1–100").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName("from").setDescription("Only messages from this member")),
  async run(i) {
    await i.deferReply(eph);
    const ch = i.channel;
    if (!ch || !("bulkDelete" in ch)) return void (await i.editReply("This channel can't be purged."));
    const n = i.options.getInteger("amount", true), from = i.options.getUser("from");
    const fetched = await ch.messages.fetch({ limit: 100 });
    const cut = Date.now() - 14 * 864e5 + 60_000;
    const list = [...fetched.values()].filter((m) => !m.pinned && m.createdTimestamp > cut && (!from || m.author.id === from.id)).slice(0, n);
    const done = list.length ? await ch.bulkDelete(list, true) : new Map();
    await auditLog("PURGE", `${done.size} message(s) in #${"name" in ch ? ch.name : "channel"}${from ? " from " + from.username : ""}`, (i.member as GuildMember).displayName, "security");
    await i.editReply(`🧹 Deleted **${done.size}** message${done.size === 1 ? "" : "s"}${from ? ` from ${from.username}` : ""}.${done.size < n ? " (Messages older than 14 days or pinned can't be bulk-deleted.)" : ""}`);
  },
};

/* ───────── posting ───────── */
const announce: Cmd = {
  key: "send",
  data: new SlashCommandBuilder().setName("announce").setDescription("Post a 505th announcement (a form opens).")
    .addStringOption((o) => o.setName("ping").setDescription("Who to ping").addChoices({ name: "@everyone", value: "everyone" }, { name: "@here", value: "here" }, { name: "A role", value: "role" }, { name: "No ping", value: "none" }))
    .addRoleOption((o) => o.setName("role").setDescription("Role to ping (if ping = A role)"))
    .addStringOption((o) => o.setName("colour").setDescription("Embed colour").addChoices(...Object.keys(COLORS).map((c) => ({ name: c, value: c }))))
    .addChannelOption((o) => o.setName("channel").setDescription("Default: the announcement channel from Cortana Setup").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  async run(i) {
    const s = await cortanaSettings();
    const t = keep({ ping: i.options.getString("ping") ?? s.announce?.ping ?? "none", role: i.options.getRole("role")?.id ?? null, colour: i.options.getString("colour") ?? "blue", channelId: i.options.getChannel("channel")?.id ?? s.announce?.channelId ?? i.channelId }, "announce", i.user.id);
    await i.showModal(new ModalBuilder().setCustomId(`cmdm:${t}`).setTitle("505th Announcement").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Title").setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("body").setLabel("Message").setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)),
    ));
  },
};
const say: Cmd = {
  key: "send",
  data: new SlashCommandBuilder().setName("say").setDescription("Cortana says something (no pings).")
    .addStringOption((o) => o.setName("message").setDescription("What to say").setRequired(true).setMaxLength(1900))
    .addChannelOption((o) => o.setName("channel").setDescription("Default: this channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  async run(i) {
    const ch = (i.options.getChannel("channel") ?? i.channel) as SendableChannels | null;
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Can't post there.", ...eph }));
    const text = i.options.getString("message", true);
    await ch.send({ content: text, allowedMentions: { parse: [] } });
    await auditLog("SAY", `#${"name" in ch ? ch.name : "?"} · ${text.slice(0, 120)}`, (i.member as GuildMember).displayName);
    await i.reply({ content: "✅ Sent.", ...eph });
  },
};
const poll: Cmd = {
  key: "ev",
  data: new SlashCommandBuilder().setName("poll").setDescription("Start a Discord poll.")
    .addStringOption((o) => o.setName("question").setDescription("The question").setRequired(true).setMaxLength(300))
    .addStringOption((o) => o.setName("answers").setDescription("2–10 answers split with ;  e.g.  Altis; Tanoa; Takistan").setRequired(true).setMaxLength(1000))
    .addIntegerOption((o) => o.setName("hours").setDescription("How long (default 24)").addChoices({ name: "1 hour", value: 1 }, { name: "4 hours", value: 4 }, { name: "1 day", value: 24 }, { name: "3 days", value: 72 }, { name: "1 week", value: 168 }))
    .addBooleanOption((o) => o.setName("multi").setDescription("Allow more than one answer")),
  async run(i) {
    const answers = i.options.getString("answers", true).split(";").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (answers.length < 2) return void (await i.reply({ content: "Give at least 2 answers, split with ;", ...eph }));
    if (answers.some((a) => a.length > 55)) return void (await i.reply({ content: "Each answer can be 55 characters at most.", ...eph }));
    const ch = i.channel as SendableChannels | null;
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Can't post here.", ...eph }));
    await ch.send({ poll: { question: { text: i.options.getString("question", true) }, answers: answers.map((text) => ({ text })), duration: i.options.getInteger("hours") ?? 24, allowMultiselect: i.options.getBoolean("multi") ?? false } });
    await i.reply({ content: "📊 Poll posted.", ...eph });
  },
};
const auxmod: Cmd = {
  key: "bot",
  data: new SlashCommandBuilder().setName("auxmod").setDescription("Post an Aux Mod update (a form opens for the changes).")
    .addStringOption((o) => o.setName("version").setDescription("e.g. v2.4.0").setRequired(true).setMaxLength(40))
    .addStringOption((o) => o.setName("link").setDescription("Download / Workshop link (https://…)").setMaxLength(500)),
  async run(i) {
    const link = i.options.getString("link") ?? "";
    if (link && !/^https:\/\/\S+$/.test(link)) return void (await i.reply({ content: "The link must start with https://", ...eph }));
    const t = keep({ version: i.options.getString("version", true), link }, "auxmod", i.user.id);
    await i.showModal(new ModalBuilder().setCustomId(`cmdm:${t}`).setTitle("Aux Mod update").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("changes").setLabel("What changed (one per line)").setStyle(TextInputStyle.Paragraph).setMaxLength(3500).setRequired(true)),
    ));
  },
};
const restart: Cmd = {
  key: "bot",
  data: new SlashCommandBuilder().setName("restart").setDescription("Restart Cortana (confirm first)."),
  async run(i) {
    const t = keep({}, "restart", i.user.id);
    await i.reply({ content: "↻ **Restart Cortana?** She'll be back in about 10 seconds (only works when Cortana runs under PM2).", components: [confirmRow(t, "Yes, restart")], ...eph });
  },
};
const modlist: Cmd = {
  key: null,
  data: new SlashCommandBuilder().setName("modlist").setDescription("Show the 505th modlist — staff: attach a new Arma 3 Launcher preset to post it.")
    .addAttachmentOption((o) => o.setName("preset").setDescription("Arma 3 Launcher preset .html (Developers / Command)"))
    .addStringOption((o) => o.setName("note").setDescription("Extra message, e.g. what was added or removed").setMaxLength(1500)),
  async run(i) {
    const file = i.options.getAttachment("preset");
    if (!file) {
      const d = (await TerminalDoc.findById("bot_state/modlist", { data: 1 }).lean())?.data as { mods?: Mod[]; presetName?: string; updatedAtISO?: string; jumpUrl?: string } | undefined;
      if (!d?.mods?.length) return void (await i.reply({ content: "No modlist has been posted yet.", ...eph }));
      const e = new EmbedBuilder().setColor(0x22e07a).setTitle(`📦 ${d.presetName ?? "505th Modlist"} · ${d.mods.length} mods`).setThumbnail(LOGO)
        .setDescription(`Last updated ${d.updatedAtISO ? `<t:${Math.floor(Date.parse(d.updatedAtISO) / 1000)}:R>` : "—"}.${d.jumpUrl ? ` [Full list + preset](${d.jumpUrl})` : ""}`);
      return void (await i.reply({ embeds: [e], ...eph }));
    }
    if (!(await allowed(i.member as GuildMember, "set"))) return void (await i.reply({ content: "⛔ Only Developers / Command can post a new modlist.", ...eph }));
    if (!/\.html?$/i.test(file.name) || file.size > 2_000_000) return void (await i.reply({ content: "Attach the Arma 3 Launcher preset (.html, under 2 MB).", ...eph }));
    await i.deferReply(eph);
    const html = await fetch(file.url, { signal: AbortSignal.timeout(10_000) }).then((r) => r.text()).catch(() => "");
    const { mods, presetName } = parsePreset(html);
    if (!mods.length) return void (await i.editReply("That file isn't an Arma 3 Launcher preset (no mods found)."));
    const ch = i.channel as SendableChannels;
    const r = await postModlist(i.client, { mods, presetName, note: i.options.getString("note") ?? "" }, (i.member as GuildMember).displayName, ch);
    await i.editReply(`✅ Posted **${mods.length} mods**${r.first ? "" : ` (+${r.added} / −${r.removed})`}.`);
  },
};
const coinflip: Cmd = {
  key: null,
  data: new SlashCommandBuilder().setName("coinflip").setDescription("Heads or tails 🪙"),
  async run(i) {
    await i.reply(`🪙 **${randomBytes(1)[0] & 1 ? "Heads" : "Tails"}!**`);
  },
};

export const staffCommands: Cmd[] = [warn, timeout, kickOrBan("kick"), kickOrBan("ban"), purge, announce, say, poll, auxmod, modlist, coinflip, restart];

/* ───────── follow-ups: confirm buttons + forms ───────── */
export async function handleCommandButton(i: ButtonInteraction): Promise<boolean> {
  const [p, t] = i.customId.split(":");
  if (p !== "cmdok" && p !== "cmdno") return false;
  const job = pending.get(t);
  if (!job || job.userId !== i.user.id) return void (await i.update({ content: "This has expired — run the command again.", components: [] })), true;
  pending.delete(t);
  if (p === "cmdno") return void (await i.update({ content: "Cancelled — nothing happened.", components: [] })), true;
  const m = i.member as GuildMember;
  if (job.kind === "mod") {
    if (!(await allowed(m, "modk"))) return void (await i.update({ content: "⛔ No access.", components: [] })), true;
    await i.update({ content: "Working…", components: [] });
    try {
      const r = await doAction(i.client, await modBy(m), job.data);
      await i.editReply({ content: "", embeds: [caseReply(r, job.data.action === "ban" ? "Ban" : "Kick", job.data.discordId, job.data.reason)] });
    } catch (e) { await i.editReply(`⚠️ ${(e as Error).message}`); }
    return true;
  }
  if (job.kind === "restart") {
    if (!(await allowed(m, "bot"))) return void (await i.update({ content: "⛔ No access.", components: [] })), true;
    await i.update({ content: "↻ Restarting…", components: [] });
    await auditLog("CORTANA RESTART", "from Discord /restart", m.displayName, "security");
    log.warn(`Restart asked by ${m.displayName}.`);
    await markOffline("restart").catch(() => {});
    setTimeout(() => process.exit(1), 500); // non-zero → PM2 starts Cortana again
    return true;
  }
  return false;
}

export async function handleCommandModal(i: ModalSubmitInteraction): Promise<boolean> {
  const [p, t] = i.customId.split(":");
  if (p !== "cmdm") return false;
  const job = pending.get(t);
  if (!job || job.userId !== i.user.id) return void (await i.reply({ content: "This form expired — run the command again.", ...eph })), true;
  pending.delete(t);
  const m = i.member as GuildMember;
  const s = await cortanaSettings();
  if (job.kind === "announce") {
    if (!(await allowed(m, "send"))) return void (await i.reply({ content: "⛔ No access.", ...eph })), true;
    const ch = await i.client.channels.fetch(job.data.channelId).catch(() => null);
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Announcement channel not found — set it in Cortana Setup.", ...eph })), true;
    const d = job.data;
    const ping = d.ping === "everyone" ? "@everyone" : d.ping === "here" ? "@here" : d.ping === "role" && d.role ? `<@&${d.role}>` : "";
    const e = new EmbedBuilder().setColor(COLORS[d.colour] ?? COLORS.blue).setTitle(`📣 ${i.fields.getTextInputValue("title")}`.slice(0, 256)).setDescription(i.fields.getTextInputValue("body"))
      .setFooter({ text: `505th Expeditionary Force · ${m.displayName}`, iconURL: LOGO }).setTimestamp();
    await ch.send({ content: ping || undefined, embeds: [e], allowedMentions: { parse: d.ping === "everyone" || d.ping === "here" ? ["everyone"] : [], roles: d.ping === "role" && d.role ? [d.role] : [] } });
    await auditLog("ANNOUNCEMENT", `#${"name" in ch ? ch.name : "?"} · ${i.fields.getTextInputValue("title").slice(0, 100)}`, m.displayName);
    await i.reply({ content: "📣 Announcement posted.", ...eph });
    return true;
  }
  if (job.kind === "auxmod") {
    if (!(await allowed(m, "bot"))) return void (await i.reply({ content: "⛔ No access.", ...eph })), true;
    const ch = s.aux?.channelId ? await i.client.channels.fetch(s.aux.channelId).catch(() => null) : i.channel;
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Aux Mod channel not found — set it in Cortana Setup.", ...eph })), true;
    const changes = i.fields.getTextInputValue("changes").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (/^[•\-*]/.test(l) ? l.replace(/^[-*]\s*/, "• ") : "• " + l)).join("\n");
    const tpl: string = s.aux?.template || "📦 Aux Mod {version} is out!\n{changes}\nUpdate via the launcher: {link}";
    const text = tpl.replace(/\{version\}/g, job.data.version).replace(/\{changes\}/g, changes).replace(/\{link\}/g, job.data.link || "the launcher");
    const [title, ...rest] = text.split("\n");
    const e = new EmbedBuilder().setColor(0x22e07a).setTitle(title.slice(0, 256)).setDescription(rest.join("\n").slice(0, 4000) || null).setFooter({ text: "505th Expeditionary Force · Developers", iconURL: LOGO }).setTimestamp();
    const row = job.data.link ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setEmoji("⬇").setURL(job.data.link))] : [];
    const role = s.aux?.pingRoleId;
    await ch.send({ content: role ? `<@&${role}>` : undefined, embeds: [e], components: row, allowedMentions: { roles: role ? [role] : [] } });
    await auditLog("AUX MOD UPDATE", job.data.version, m.displayName);
    await i.reply({ content: "📦 Aux Mod update posted.", ...eph });
    return true;
  }
  return false;
}
