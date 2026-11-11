/**
 * Website + database uptime, checked by Cortana every minute (it runs 24/7 on the home server).
 * Saved to bot_status/monitors → { web, db }: { days: { "YYYY-MM-DD": { ok, n } }, lastMs, up, downSinceISO }
 * The Dashboard uptime bars use ok / n per UK day (30 days kept).
 * Alerts: after 3 failed checks in a row → "🔴 DOWN" in the Discord log channel; on recovery → "🟢 back up after X min".
 * Log channel: Cortana Setup → Logs → website audit channel, else the moderation log.
 */
import { EmbedBuilder, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { patchDoc } from "./store.ts";
import { LOGO, cortanaSettings } from "./util.ts";

const EVERY_MS = 60_000;
const FAILS_FOR_ALERT = 3;
const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
type Mon = { days: Record<string, { ok: number; n: number }>; lastMs: number | null; up: boolean; fails: number; downSinceISO: string | null; alerted: boolean };
const blank = (): Mon => ({ days: {}, lastMs: null, up: true, fails: 0, downSinceISO: null, alerted: false });

async function timed(fn: () => Promise<unknown>): Promise<number | null> {
  const t = Date.now();
  try { await fn(); return Date.now() - t; } catch { return null; }
}
async function checkWeb(): Promise<number | null> {
  const url = `${(env.SITE_URL || "https://www.505expeditionaryforce.com").replace(/\/$/, "")}/api/public/ops`;
  return timed(async () => {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store", headers: { "user-agent": "Cortana-uptime" } });
    if (r.status >= 500) throw new Error(String(r.status));
  });
}
const checkDb = () => timed(async () => { await TerminalDoc.db.db!.command({ ping: 1 }); });

async function alert(client: Client<true>, title: string, text: string, color: number) {
  const s = await cortanaSettings().catch(() => ({} as Record<string, any>));
  const id = s.logs?.auditId || s.logs?.modLogId;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (ch && "send" in ch) await ch.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(text).setFooter({ text: "505th Network Status", iconURL: LOGO }).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}

function step(m: Mon, ms: number | null) {
  const k = ukDay();
  const d = (m.days[k] ??= { ok: 0, n: 0 });
  d.n++;
  if (ms != null) d.ok++;
  const keep = new Set(Array.from({ length: 30 }, (_, i) => ukDay(new Date(Date.now() - i * 864e5))));
  for (const x of Object.keys(m.days)) if (!keep.has(x)) delete m.days[x];
  m.lastMs = ms;
  if (ms == null) { m.fails++; m.up = false; m.downSinceISO ??= new Date().toISOString(); }
  else { m.fails = 0; m.up = true; }
}

/** Discord "who's online" for the Dashboard: online count (from Discord's own counts — no presence intent needed)
 *  and who is in each voice channel. Saved to bot_status/discord_live every minute. */
async function discordLive(client: Client<true>) {
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  if (!g) return;
  const counts = await client.guilds.fetch({ guild: g.id, withCounts: true, force: true }).catch(() => null);
  const byCh = new Map<string, { channelId: string; name: string; members: { id: string; name: string }[] }>();
  for (const vs of g.voiceStates.cache.values()) {
    if (!vs.channelId || !vs.member || vs.member.user.bot) continue;
    const ch = byCh.get(vs.channelId) ?? { channelId: vs.channelId, name: vs.channel?.name ?? "voice", members: [] };
    ch.members.push({ id: vs.member.id, name: vs.member.displayName.slice(0, 60) });
    byCh.set(vs.channelId, ch);
  }
  await patchDoc("bot_status", "discord_live", { online: counts?.approximatePresenceCount ?? null, members: counts?.approximateMemberCount ?? g.memberCount, voice: [...byCh.values()], atISO: new Date().toISOString() });
}

export function startMonitors(client: Client<true>) {
  const run = async () => {
    const cur = ((await TerminalDoc.findById("bot_status/monitors", { data: 1 }).lean())?.data ?? {}) as Record<string, Mon>;
    const state: Record<"web" | "db", Mon> = { web: { ...blank(), ...cur.web }, db: { ...blank(), ...cur.db } };
    const [w, d] = await Promise.all([checkWeb(), checkDb()]);
    for (const [key, ms, name] of [["web", w, "Website"], ["db", d, "Database"]] as const) {
      const m = state[key];
      step(m, ms);
      if (!m.up && m.fails >= FAILS_FOR_ALERT && !m.alerted) {
        m.alerted = true;
        log.warn(`${name} down (${m.fails} failed checks).`);
        await alert(client, `🔴 ${name} DOWN`, `No answer for ${m.fails} checks in a row (since <t:${Math.floor(Date.parse(m.downSinceISO!) / 1000)}:t>).`, 0xef4444);
      }
      if (m.up && m.downSinceISO) {
        const mins = Math.max(1, Math.round((Date.now() - Date.parse(m.downSinceISO)) / 60000));
        if (m.alerted) await alert(client, `🟢 ${name} back up`, `It was down for about ${mins} min.`, 0x22e07a);
        m.downSinceISO = null;
        m.alerted = false;
      }
    }
    await patchDoc("bot_status", "monitors", { ...state, checkedAtISO: new Date().toISOString() });
    await discordLive(client).catch((e) => log.warn(`Discord online count failed: ${(e as Error).message}`));
  };
  const go = () => void run().catch((e) => log.warn(`Uptime check failed: ${(e as Error).message}`));
  go();
  const t = setInterval(go, EVERY_MS);
  return () => clearInterval(t);
}
