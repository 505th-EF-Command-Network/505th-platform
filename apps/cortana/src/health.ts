/**
 * Heartbeat → `bot_status/cortana` every 10 s. The website dashboard reads it:
 * online (fresh within 90 s), ping, CPU, memory, jobs queued, 24 h ping chart,
 * 30-day uptime (minutes online per UK day).
 */
import os from "node:os";
import { GatewayIntentBits, PermissionFlagsBits, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { patchDoc } from "./store.ts";

const BEAT_MS = 10_000; // every 10 s (Network Status is live)
const startedAt = new Date();
const version = "2.0.0";
let lastCpu = process.cpuUsage();
let lastAt = Date.now();
let errors24h: number[] = [];

export const noteError = () => errors24h.push(Date.now());

function cpuPercent() {
  const now = Date.now();
  const u = process.cpuUsage(lastCpu);
  const pct = ((u.user + u.system) / 1000 / Math.max(1, now - lastAt)) * 100 / os.cpus().length;
  lastCpu = process.cpuUsage();
  lastAt = now;
  return Math.round(pct * 10) / 10;
}
const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
const hourKey = (d = new Date()) => d.toISOString().slice(0, 13); // UTC hour

async function beat(client: Client<true>) {
  const guild = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  const ping = Math.max(0, Math.round(client.ws.ping));
  const [queued, cur] = await Promise.all([
    TerminalDoc.countDocuments({ parent: "bot_jobs", "data.status": "pending" }),
    TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean(),
  ]);
  const d = (cur?.data ?? {}) as Record<string, any>;

  // 24 h ping chart: one value per hour (highest seen that hour).
  const hours: Record<string, number> = { ...(d.pingByHour ?? {}) };
  const hk = hourKey();
  hours[hk] = Math.max(hours[hk] ?? 0, ping);
  const keepH = new Set(Array.from({ length: 24 }, (_, i) => hourKey(new Date(Date.now() - i * 3600_000))));
  for (const k of Object.keys(hours)) if (!keepH.has(k)) delete hours[k];

  // 30-day uptime: minutes online per UK day.
  const days: Record<string, number> = { ...(d.uptimeMinutes ?? {}) };
  const dk = ukDay();
  days[dk] = Math.min(1440, (days[dk] ?? 0) + BEAT_MS / 60_000);
  const keepD = new Set(Array.from({ length: 30 }, (_, i) => ukDay(new Date(Date.now() - i * 864e5))));
  for (const k of Object.keys(days)) if (!keepD.has(k)) delete days[k];

  errors24h = errors24h.filter((t) => Date.now() - t < 864e5);
  const mem = process.memoryUsage();
  const me = guild?.members.me;
  const NEED: [bigint, string][] = [
    [PermissionFlagsBits.ViewChannel, "View Channels"], [PermissionFlagsBits.SendMessages, "Send Messages"], [PermissionFlagsBits.EmbedLinks, "Embed Links"],
    [PermissionFlagsBits.AttachFiles, "Attach Files"], [PermissionFlagsBits.ManageMessages, "Manage Messages"], [PermissionFlagsBits.ManageChannels, "Manage Channels"],
    [PermissionFlagsBits.ManageRoles, "Manage Roles"], [PermissionFlagsBits.ManageEvents, "Manage Events"], [PermissionFlagsBits.ModerateMembers, "Timeout Members"],
    [PermissionFlagsBits.KickMembers, "Kick Members"], [PermissionFlagsBits.BanMembers, "Ban Members"], [PermissionFlagsBits.MentionEveryone, "Mention @everyone"],
  ];
  const missingPerms = me ? NEED.filter(([p]) => !me.permissions.has(p)).map(([, n]) => n) : [];
  await patchDoc("bot_status", "cortana", {
    online: true,
    startedAtISO: startedAt.toISOString(),
    lastHeartbeatISO: new Date().toISOString(),
    pingMs: ping,
    cpuPercent: cpuPercent(),
    memoryMb: Math.round(mem.rss / 1048576),
    jobsQueued: queued,
    errors24h: errors24h.length,
    guildId: guild?.id ?? null,
    guildName: guild?.name ?? null,
    memberCount: guild?.memberCount ?? null,
    missingPerms,
    intents: { members: client.options.intents.has(GatewayIntentBits.GuildMembers), messageContent: client.options.intents.has(GatewayIntentBits.MessageContent) },
    heartbeatSec: BEAT_MS / 1000,
    botTag: client.user.tag,
    avatarUrl: client.user.displayAvatarURL({ size: 256 }),
    supervised: process.env.pm_id !== undefined,
    version,
    pingByHour: hours,
    uptimeMinutes: days,
  });
}

export function startHeartbeat(client: Client<true>) {
  const run = () => beat(client).catch((e) => log.error("Heartbeat failed", e));
  void run();
  return setInterval(run, BEAT_MS);
}

/** Clean shutdown → offline straight away (a crash shows as a stale heartbeat). */
export async function markOffline(reason: string) {
  await patchDoc("bot_status", "cortana", { online: false, stoppedAtISO: new Date().toISOString(), stopReason: reason }).catch(() => {});
}
