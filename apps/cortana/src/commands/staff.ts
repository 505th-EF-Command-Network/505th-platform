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
import { doAction, doPurge, type ModBy } from "../moderation.ts";
import { parsePreset, postModlist, type Mod } from "../modlist.ts";
import { markOffline } from "../health.ts";
import { addPerson, close as closeTicket, isTicketStaff, ticketIdForChannel } from "../tickets.ts";
import { log } from "../log.ts";
import { LOGO, auditLog, cortanaSettings } from "../util.ts";

type Cmd = { data: Pick<SlashCommandBuilder, "name" | "toJSON">; key: string | null; run: (i: ChatInputCommandInteraction) => Promise<void> };
const eph = { flags: MessageFlags.Ephemeral } as const;
const COLORS: Record<string, number> = { blue: 0x194a77, cyan: 0x00d9ff, green: 0x22e07a, amber: 0xf59e0b, red: 0xff4d4d };
const pending = new Map<string, { kind: string; userId: string; data: any; at: number }>();
const token = () => randomBytes(6).toString("hex");
/** Cortana-only delayed delete (job without requestedBy — the website can't make these). */
async function queueDelete(channelId: string, messageId: string, inMs: number) {
  const id = randomBytes(10).toString("hex"), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now,
    data: { type: "message.deleteLater", status: "pending", attempts: 0, createdAtISO: now.toISOString(), runAtISO: new Date(Date.now() + inMs).toISOString(), payload: { channelId, messageId } } }).catch(() => {});
}
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
  data: new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages in this channel (under 14 days old).")
    .addIntegerOption((o) => o.setName("amount").setDescription("1–100").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName("from").setDescription("Only messages from this member"))
    .addBooleanOption((o) => o.setName("bots").setDescription("Only messages from bots"))
    .addStringOption((o) => o.setName("reason").setDescription("Shown in the mod log").setMaxLength(300)),
  async run(i) {
    await i.deferReply(eph);
    const from = i.options.getUser("from"), bots = i.options.getBoolean("bots") === true;
    try {
      const r = await doPurge(i.client, (i.member as GuildMember).displayName, {
        channelId: i.channelId, amount: i.options.getInteger("amount", true), mode: from ? "member" : bots ? "bots" : "all",
        memberId: from?.id, keepPinned: true, reason: i.options.getString("reason") ?? "",
      });
      await i.editReply(`🧹 Deleted **${r.deleted}** message${r.deleted === 1 ? "" : "s"}${from ? ` from ${from.username}` : bots ? " from bots" : ""}.${r.tooOld ? ` ${r.tooOld} skipped (older than 14 days).` : ""} Logged to the mod log.`);
    } catch (e) {
      await i.editReply(`⛔ ${(e as Error).message}`);
    }
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
    const field = (id: string, label: string) => new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false).setPlaceholder("One per line (or split with commas)"));
    await i.showModal(new ModalBuilder().setCustomId(`cmdm:${t}`).setTitle(`Aux Mod Update ${i.options.getString("version", true)}`.slice(0, 45)).addComponents(
      field("added", "Added"), field("changed", "Changed"), field("fixed", "Fixed"), field("removed", "Removed"),
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
  data: new SlashCommandBuilder().setName("modlist").setDescription("Show the 505th modlist — staff: post a new preset, or list mods added / removed.")
    .addAttachmentOption((o) => o.setName("preset").setDescription("Arma 3 Launcher preset .html (Developers / Command)"))
    .addStringOption((o) => o.setName("add").setDescription("Mods added (split with commas)").setMaxLength(1000))
    .addStringOption((o) => o.setName("remove").setDescription("Mods removed (split with commas)").setMaxLength(1000))
    .addStringOption((o) => o.setName("version").setDescription("Version label, e.g. Modlist v3.6").setMaxLength(60))
    .addStringOption((o) => o.setName("note").setDescription("Extra message").setMaxLength(1500)),
  async run(i) {
    const file = i.options.getAttachment("preset"), add = i.options.getString("add"), remove = i.options.getString("remove");
    if (!file && !add && !remove) {
      const d = (await TerminalDoc.findById("bot_state/modlist", { data: 1 }).lean())?.data as { mods?: Mod[]; presetName?: string; updatedAtISO?: string; jumpUrl?: string } | undefined;
      if (!d?.mods?.length) return void (await i.reply({ content: "No modlist has been posted yet.", ...eph }));
      const e = new EmbedBuilder().setColor(0x22e07a).setTitle(`📦 ${d.presetName ?? "505th Modlist"} · ${d.mods.length} mods`).setThumbnail(LOGO)
        .setDescription(`Last updated ${d.updatedAtISO ? `<t:${Math.floor(Date.parse(d.updatedAtISO) / 1000)}:R>` : "—"}.${d.jumpUrl ? ` [Full list + preset](${d.jumpUrl})` : ""}`);
      return void (await i.reply({ embeds: [e], ...eph }));
    }
    if (!(await allowed(i.member as GuildMember, "set"))) return void (await i.reply({ content: "⛔ Only Developers / Command can post the modlist.", ...eph }));
    const s = await cortanaSettings();
    const ch = ((s.modlistChannelId || s.aux?.channelId) ? await i.client.channels.fetch(s.modlistChannelId || s.aux.channelId).catch(() => null) : null) ?? i.channel;
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Modlist channel not found — set the Aux Mod channel in Cortana Setup.", ...eph }));
    const note = i.options.getString("note") ?? "";
    if (file) {
      if (!/\.html?$/i.test(file.name) || file.size > 2_000_000) return void (await i.reply({ content: "Attach the Arma 3 Launcher preset (.html, under 2 MB).", ...eph }));
      await i.deferReply(eph);
      const html = await fetch(file.url, { signal: AbortSignal.timeout(10_000) }).then((r) => r.text()).catch(() => "");
      const { mods, presetName } = parsePreset(html);
      if (!mods.length) return void (await i.editReply("That file isn't an Arma 3 Launcher preset (no mods found)."));
      const extra = [add ? `➕ **Added:** ${add}` : "", remove ? `➖ **Removed:** ${remove}` : "", note].filter(Boolean).join("\n");
      const r = await postModlist(i.client, { mods, presetName: i.options.getString("version") || presetName, note: extra }, (i.member as GuildMember).displayName, ch as SendableChannels);
      return void (await i.editReply(`✅ Posted **${mods.length} mods**${r.first ? "" : ` (+${r.added} / −${r.removed})`}.`));
    }
    // Text only (like the old Cortana): ➕ added / ➖ removed.
    const list = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
    const a = list(add), rm = list(remove);
    const e = new EmbedBuilder().setColor(0x22e07a).setTitle(`📦 ${i.options.getString("version") || "Modlist Update"}`).setThumbnail(LOGO)
      .setDescription([note, a.length ? `➕ **Added Mods:**\n${a.map((x) => `• ${x}`).join("\n")}` : "", rm.length ? `➖ **Removed Mods:**\n${rm.map((x) => `• ${x}`).join("\n")}` : ""].filter(Boolean).join("\n\n").slice(0, 4000))
      .setFooter({ text: `505th Expeditionary Force · ${(i.member as GuildMember).displayName}`, iconURL: LOGO }).setTimestamp();
    await (ch as SendableChannels).send({ embeds: [e], allowedMentions: { parse: [] } });
    await auditLog("MODLIST UPDATE", `+${a.length} / −${rm.length}`, (i.member as GuildMember).displayName);
    await i.reply({ content: `✅ Modlist update posted in <#${ch.id}>.`, ...eph });
  },
};
const help: Cmd = {
  key: null,
  data: new SlashCommandBuilder().setName("help").setDescription("What Cortana can do (only shows what you can use)."),
  async run(i) {
    const m = i.member as GuildMember;
    const [mw, mk, sd, ev, bt, st] = await Promise.all(["modw", "modk", "send", "ev", "bot", "set"].map((k) => allowed(m, k)));
    const site = "https://www.505expeditionaryforce.com";
    const fields = [
      { name: "🌐 Everyone", value: "`/modlist` current modlist + preset file\n`/coinflip` heads or tails\n`/help` this list" },
      { name: "🎫 Tickets", value: "`/ticket close` close your ticket" + (mw || sd || bt || st ? "\n`/ticket add` `/ticket remove` give / take access (staff)" : "") },
      mw || mk ? { name: "🛡 Moderation", value: [mw ? "`/warn` warn a member (case + DM)\n`/timeout` time someone out\n`/purge` delete recent messages" : "", mk ? "`/kick` `/ban` (asks you to confirm)" : ""].filter(Boolean).join("\n") } : null,
      sd || ev ? { name: "📣 Posting", value: [sd ? "`/announce` 505th announcement (a form opens)\n`/say` Cortana says something" : "", ev ? "`/poll` start a Discord poll" : ""].filter(Boolean).join("\n") } : null,
      bt || st ? { name: "⚙ Developers / Command", value: [bt ? "`/auxmod` Aux Mod update (Added / Changed / Fixed / Removed)\n`/restart` restart Cortana (confirm first)" : "", st ? "`/modlist` with a preset, or add / remove mods" : ""].filter(Boolean).join("\n") } : null,
      { name: "🤖 Automatic", value: "Event sign-ups + Upcoming Events · tickets · role buttons · rank / unit / squad sync with the website" },
      { name: "🖥 Website & Hub", value: mw || sd || ev || bt || st ? "Events, tickets, messages, info posts, moderation and personnel files are in the **Command Terminal** — press **?** on any page for help and a guided tour." : "Rules, handbook, roster and your profile are on the 505th website." },
    ].filter((f): f is { name: string; value: string } => !!f);
    const e = new EmbedBuilder().setColor(0x00d9ff).setTitle("◈ Cortana — Help").setThumbnail(LOGO).setDescription("Commands you can use:").addFields(fields)
      .setFooter({ text: "505th Expeditionary Force · Cortana v2", iconURL: LOGO });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Website").setEmoji("🌐").setStyle(ButtonStyle.Link).setURL(site),
      new ButtonBuilder().setLabel("Handbook").setEmoji("📘").setStyle(ButtonStyle.Link).setURL(`${site}/resources-handbook.html`),
      ...(mw || sd || ev || bt || st ? [new ButtonBuilder().setLabel("Command Terminal").setEmoji("🖥").setStyle(ButtonStyle.Link).setURL(`${site}/terminal`)] : []),
    );
    await i.reply({ embeds: [e], components: [row], ...eph });
  },
};
const ticket: Cmd = {
  key: null, // checked per sub-command: staff of that ticket, or the opener for close
  data: new SlashCommandBuilder().setName("ticket").setDescription("Manage this ticket (use it inside a ticket channel).")
    .addSubcommand((c) => c.setName("add").setDescription("Give someone access to this ticket (staff)").addUserOption((o) => o.setName("user").setDescription("Who to add").setRequired(true)))
    .addSubcommand((c) => c.setName("remove").setDescription("Take someone's access away (staff)").addUserOption((o) => o.setName("user").setDescription("Who to remove").setRequired(true)))
    .addSubcommand((c) => c.setName("close").setDescription("Close this ticket").addStringOption((o) => o.setName("reason").setDescription("Why it's being closed").setMaxLength(500))),
  async run(i) {
    const id = await ticketIdForChannel(i.channelId);
    if (!id) return void (await i.reply({ content: "Use this inside a ticket channel.", ...eph }));
    const m = i.member as GuildMember;
    const staff = await isTicketStaff(m, id);
    const sub = i.options.getSubcommand();
    if (sub === "close") {
      const tk = (await TerminalDoc.findById(`tickets/${id}`, { "data.openerId": 1, "data.status": 1 }).lean())?.data as { openerId?: string; status?: string } | undefined;
      if (!staff && tk?.openerId !== i.user.id) return void (await i.reply({ content: "⛔ Only staff or the person who opened it can close this.", ...eph }));
      if (tk?.status !== "open") return void (await i.reply({ content: "This ticket is already closed.", ...eph }));
      await i.reply({ content: "🔒 Closing…", ...eph });
      await closeTicket(i.client, id, m.displayName, i.options.getString("reason") ?? "");
      return;
    }
    if (!staff) return void (await i.reply({ content: "⛔ Only staff can add or remove people.", ...eph }));
    const u = i.options.getUser("user", true);
    if (u.bot) return void (await i.reply({ content: "Pick a person, not a bot.", ...eph }));
    await i.deferReply(eph);
    try { await addPerson(i.client, id, u.id, m.displayName, sub === "add"); await i.editReply(`✅ ${sub === "add" ? "Added" : "Removed"} <@${u.id}>.`); }
    catch (e) { await i.editReply(`⚠️ ${(e as Error).message}`); }
  },
};
const coinflip: Cmd = {
  key: null,
  data: new SlashCommandBuilder().setName("coinflip").setDescription("Heads or tails 🪙"),
  async run(i) {
    await i.reply(`🪙 **${randomBytes(1)[0] & 1 ? "Heads" : "Tails"}!**`);
  },
};

export const staffCommands: Cmd[] = [warn, timeout, kickOrBan("kick"), kickOrBan("ban"), purge, announce, say, poll, auxmod, modlist, ticket, help, coinflip, restart];

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
    // Same layout as the old Cortana: Version + Added / Changed / Fixed / Removed, posted in the Aux Mod channel,
    // plus a short announcement pinging the Mod Updates role that deletes itself after 24 h.
    const ch = s.aux?.channelId ? await i.client.channels.fetch(s.aux.channelId).catch(() => null) : i.channel;
    if (!ch || !("send" in ch)) return void (await i.reply({ content: "Aux Mod channel not found — set it in Cortana Setup.", ...eph })), true;
    const section = (label: string, raw: string) => {
      const lines = raw.split(/\r?\n|,/).map((l) => l.trim().replace(/^[•\-*]\s*/, "")).filter(Boolean);
      return `**${label}:**\n${lines.length ? lines.map((l) => `• ${l}`).join("\n") : "• N/A"}`;
    };
    const v = job.data.version;
    const desc = [`**Version:** ${v}`, section("Added", i.fields.getTextInputValue("added")), section("Changed", i.fields.getTextInputValue("changed")), section("Fixed", i.fields.getTextInputValue("fixed")), section("Removed", i.fields.getTextInputValue("removed"))].join("\n\n");
    const e = new EmbedBuilder().setColor(0x0099ff).setTitle(`Aux Mod Update V ${v}`.slice(0, 256)).setDescription(desc.slice(0, 4000)).setThumbnail(LOGO).setFooter({ text: "505th Mod Team • Aux Mod Update", iconURL: LOGO }).setTimestamp();
    const row = job.data.link ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setEmoji("⬇").setURL(job.data.link))] : [];
    const post = await ch.send({ embeds: [e], components: row, allowedMentions: { parse: [] } });
    const role = s.aux?.pingRoleId;
    const ann = s.announce?.channelId ? await i.client.channels.fetch(s.announce.channelId).catch(() => null) : null;
    if (ann && "send" in ann) {
      const a = await ann.send({ content: `# 📦 Aux Mod Update V ${v}\n\n${role ? `<@&${role}> — ` : ""}check ${post.url} for full details.`, allowedMentions: { roles: role ? [role] : [] } }).catch(() => null);
      if (a) await queueDelete(a.channelId, a.id, 24 * 3600_000);
    }
    await auditLog("AUX MOD UPDATE", `V ${v}`, m.displayName);
    await i.reply({ content: `✅ Aux Mod update **V ${v}** posted${ann ? " and announced (the announcement deletes itself in 24 h)" : ""}.`, ...eph });
    return true;
  }
  return false;
}
