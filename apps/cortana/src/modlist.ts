/**
 * Modlist (Arma 3 Launcher preset). From Discord (/modlist with the exported .html) or the website (Modlist page).
 * Cortana reads mod names + Steam Workshop IDs, compares with the last list (bot_state/modlist) and posts:
 * 📦 505th Modlist · N mods · 🆕 Added · 🗑 Removed · note · full list (Workshop links) · the preset file to download.
 * The preset file is rebuilt from the list (clean, no extra content from the uploaded file).
 */
import { AttachmentBuilder, ChannelType, EmbedBuilder, type Client, type SendableChannels } from "discord.js";
import { z } from "zod";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, auditLog, cortanaSettings } from "./util.ts";

export type Mod = { name: string; id: string };
const ModZ = z.object({ name: z.string().trim().min(1).max(200), id: z.string().regex(/^\d{1,20}$/) });
const Payload = z.object({ mods: z.array(ModZ).min(1).max(500), note: z.string().max(1500).default(""), presetName: z.string().max(100).default("505th Modlist") });

const decode = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
/** Read an Arma 3 Launcher preset export. Returns [] if it isn't one. */
export function parsePreset(html: string): { mods: Mod[]; presetName: string } {
  const presetName = decode((html.match(/<meta\s+name="arma:PresetName"\s+content="([^"]*)"/i) || [])[1] || "") || "505th Modlist";
  const mods: Mod[] = [];
  const seen = new Set<string>();
  const rows = html.split(/<tr\b[^>]*data-type="ModContainer"[^>]*>/i).slice(1);
  for (const row of rows) {
    const name = decode((row.match(/data-type="DisplayName"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || "");
    const id = (row.match(/filedetails\/\?id=(\d+)/i) || [])[1];
    if (name && id && !seen.has(id)) { seen.add(id); mods.push({ name: name.slice(0, 200), id }); }
  }
  return { mods, presetName: presetName.slice(0, 100) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A clean Arma 3 Launcher preset file built from the list. */
function buildPreset(name: string, mods: Mod[]) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html>
  <!--Created by Cortana v2 for the 505th Expeditionary Force-->
  <head>
    <meta name="arma:Type" content="preset" />
    <meta name="arma:PresetName" content="${esc(name)}" />
    <meta name="generator" content="Cortana v2" />
    <title>Arma 3</title>
  </head>
  <body>
    <h1>Arma 3  - Preset <strong>${esc(name)}</strong></h1>
    <div class="mod-list">
      <table>
${mods.map((m) => `        <tr data-type="ModContainer">
          <td data-type="DisplayName">${esc(m.name)}</td>
          <td><span class="from-steam">Steam</span></td>
          <td><a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${m.id}" data-type="Link">https://steamcommunity.com/sharedfiles/filedetails/?id=${m.id}</a></td>
        </tr>`).join("\n")}
      </table>
    </div>
  </body>
</html>
`;
}

const link = (m: Mod) => `[${m.name.replace(/[[\]]/g, "")}](https://steamcommunity.com/sharedfiles/filedetails/?id=${m.id})`;
function listChunks(lines: string[], max = 3900) {
  const out: string[] = [];
  let cur = "";
  for (const l of lines) { if (cur.length + l.length + 1 > max) { out.push(cur); cur = ""; } cur += (cur ? "\n" : "") + l; }
  if (cur) out.push(cur);
  return out;
}
const short = (ms: Mod[], n = 15) => (ms.length ? ms.slice(0, n).map((m) => `• ${m.name}`).join("\n").slice(0, 1000) + (ms.length > n ? `\n…and ${ms.length - n} more` : "") : "—");

/** Post the modlist. channel = where to post (slash command) or Cortana Setup → Aux Mod channel. */
export async function postModlist(client: Client<true>, input: { mods: Mod[]; note?: string; presetName?: string }, byName: string, channel?: SendableChannels) {
  const p = Payload.parse(input);
  const prev = ((await TerminalDoc.findById("bot_state/modlist", { data: 1 }).lean())?.data as { mods?: Mod[] } | undefined)?.mods ?? null;
  const prevIds = new Set((prev ?? []).map((m) => m.id)), nowIds = new Set(p.mods.map((m) => m.id));
  const added = prev ? p.mods.filter((m) => !prevIds.has(m.id)) : [];
  const removed = prev ? prev.filter((m) => !nowIds.has(m.id)) : [];
  let ch = channel ?? null;
  if (!ch) {
    const s = await cortanaSettings();
    const id = s.modlistChannelId || s.aux?.channelId;
    const c = id ? await client.channels.fetch(id).catch(() => null) : null;
    if (!c || !("guildId" in c) || c.guildId !== env.AUTHORISED_GUILD_ID || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type) || !("send" in c)) {
      throw new PermanentJobError("No Aux Mod channel — set it in Cortana Setup → Aux Mod Updates");
    }
    ch = c as SendableChannels;
  }
  const date = new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
  const head = new EmbedBuilder().setColor(0x22e07a).setTitle(`📦 ${p.presetName} · ${p.mods.length} mods`).setThumbnail(LOGO)
    .setDescription(`${p.note ? p.note + "\n\n" : ""}Updated **${date}**. Download the preset below, then in the **Arma 3 Launcher → Mods → Preset → Import**.`.slice(0, 4000))
    .setFooter({ text: `505th Expeditionary Force · ${byName}`, iconURL: LOGO });
  if (prev) head.addFields({ name: `🆕 Added (${added.length})`, value: short(added), inline: true }, { name: `🗑 Removed (${removed.length})`, value: short(removed), inline: true });
  const chunks = listChunks(p.mods.map((m, n) => `\`${String(n + 1).padStart(2, "0")}\` ${link(m)}`));
  const listEmbeds = chunks.map((c, n) => new EmbedBuilder().setColor(0x194a77).setTitle(n === 0 ? "📋 Full mod list" : null).setDescription(c));
  const file = new AttachmentBuilder(Buffer.from(buildPreset(p.presetName, p.mods), "utf8"), { name: `${p.presetName.replace(/[^\w-]+/g, "_").slice(0, 60) || "505th_Modlist"}.html` });
  // Discord: max 10 embeds / 6000 characters per message → head + file first, then the list in batches.
  const first = await ch.send({ embeds: [head], files: [file], allowedMentions: { parse: [] } });
  for (let i = 0; i < listEmbeds.length; ) {
    let size = 0, batch: EmbedBuilder[] = [];
    while (i < listEmbeds.length && batch.length < 10 && size + (listEmbeds[i].data.description?.length ?? 0) < 5800) { size += listEmbeds[i].data.description?.length ?? 0; batch.push(listEmbeds[i++]); }
    await ch.send({ embeds: batch, allowedMentions: { parse: [] } });
  }
  const now = new Date();
  await TerminalDoc.updateOne({ _id: "bot_state/modlist" }, { $set: { parent: "bot_state", docId: "modlist", updateTime: now, data: { mods: p.mods, presetName: p.presetName, note: p.note, updatedAtISO: now.toISOString(), byName, jumpUrl: first.url, added: added.length, removed: removed.length } }, $setOnInsert: { createTime: now } }, { upsert: true });
  await auditLog("MODLIST POSTED", `${p.mods.length} mods · +${added.length} / −${removed.length}`, byName);
  log.info(`Modlist posted (${p.mods.length} mods) by ${byName}.`);
  return { jumpUrl: first.url, added: added.length, removed: removed.length, first: !prev };
}

export function startModlist() {
  registerJob("modlist.post", async (job, c) => {
    const who = await uidAllowed(job.data.requestedBy, "set");
    if (!who.ok) throw new PermanentJobError("Only Developers / Command can post the modlist");
    const r = Payload.safeParse(job.data.payload);
    if (!r.success) throw new PermanentJobError(`Invalid modlist: ${r.error.issues[0]?.message}`);
    return postModlist(c, r.data, who.name);
  });
}
