/**
 * Slash commands. Each has an access key (website grid) — the Cortana Cred role also allows it.
 * Registered for the authorised server only (instant updates, not global).
 */
import { EmbedBuilder, MessageFlags, REST, Routes, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "../env.ts";
import { log } from "../log.ts";
import { staffCommands } from "./staff.ts";

type Cmd = { data: Pick<SlashCommandBuilder, "name" | "toJSON">; key: string | null; run: (i: ChatInputCommandInteraction) => Promise<void> };

const ping: Cmd = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check Cortana is awake."),
  key: null,
  async run(i) {
    await i.reply({ content: `🟢 Online · gateway ping ${Math.round(i.client.ws.ping)} ms`, flags: MessageFlags.Ephemeral });
  },
};

const status: Cmd = {
  data: new SlashCommandBuilder().setName("status").setDescription("Cortana health: ping, memory, jobs, uptime."),
  key: null,
  async run(i) {
    const d = ((await TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
    const up = d.startedAtISO ? Math.floor((Date.now() - Date.parse(d.startedAtISO)) / 60000) : 0;
    const e = new EmbedBuilder()
      .setColor(0x00d9ff)
      .setTitle("◈ CORTANA v2 — STATUS")
      .addFields(
        { name: "Ping", value: `${Math.round(i.client.ws.ping)} ms`, inline: true },
        { name: "Memory", value: `${d.memoryMb ?? "—"} MB`, inline: true },
        { name: "CPU", value: `${d.cpuPercent ?? "—"} %`, inline: true },
        { name: "Jobs queued", value: String(d.jobsQueued ?? 0), inline: true },
        { name: "Errors (24h)", value: String(d.errors24h ?? 0), inline: true },
        { name: "Up", value: `${Math.floor(up / 1440)}d ${Math.floor((up % 1440) / 60)}h ${up % 60}m`, inline: true },
      )
      .setFooter({ text: `v${d.version ?? "2"}${d.supervised ? " · PM2" : ""}` })
      .setTimestamp();
    await i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};

export const commands: Cmd[] = [ping, status, ...(staffCommands as Cmd[])];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));

export async function registerCommands() {
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.AUTHORISED_GUILD_ID), { body: commands.map((c) => c.data.toJSON()) });
  log.ok(`Registered ${commands.length} slash command(s): ${commands.map((c) => "/" + c.data.name).join(" ")}`);
}
