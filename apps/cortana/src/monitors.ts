/**
 * NETWORK STATUS v2 (approved mock 2026-11-12) — Cortana checks every 505th service every 60 s, 24/7.
 *   net_monitors/{id}  config  { name, group, type, target, paused, muted, third, builtin, order, slowMs }
 *   net_status/{id}    live    { status: up|slow|down|paused, ms, checkedAtISO, fails, downSinceISO, alerted, info, certValidToISO, last: [[epochMin, ms|-1, s]] (90) }
 *   net_days/{id}_{YYYY-MM-DD}  { mon, day, b: [[minuteOfDay, ms|-1, s]] }  — kept 90 days (s: 0 up · 1 slow · 2 down)
 *   net_events/{id}    incidents { mon, name, startedAtISO, endedAtISO, error, note }
 * Every save is pushed through the 505th Net (topics net_status / net_events), so the website + Hub pages update within a second.
 * Down for 3 checks in a row (not muted) → Discord alert (log channel) + 🔔 alert to Commander / Developer. Back up → "recovered after X min".
 * Still writes bot_status/monitors { web, db } (old Dashboard uptime bars) and bot_status/discord_live (who's online).
 * Types: http (any URL) · website · db · bot · discord · cloudinary · ably · hub · game (Arma 3 Steam query, target "host:queryPort").
 */
import { createSocket } from "node:dgram";
import { randomBytes } from "node:crypto";
import { connect as tlsConnect } from "node:tls";
import { EmbedBuilder, type Client } from "discord.js";
import { HubSession, TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { patchDoc } from "./store.ts";
import { LOGO, cortanaSettings } from "./util.ts";

const EVERY_MS = 60_000;
const FAILS_FOR_ALERT = 3;
const KEEP_DAYS = 90;
type U = Record<string, any>;
type Mon = { id: string; name: string; group: string; type: string; target: string; paused?: boolean; muted?: boolean; third?: boolean; builtin?: boolean; order: number; slowMs?: number };
type Res = { ms: number | null; info?: string; error?: string };
const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const minuteOfDay = (d = new Date()) => { const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).split(":").map(Number); return h! * 60 + m!; };
const site = () => (env.SITE_URL || "https://www.505expeditionaryforce.com").replace(/\/$/, "");
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/** The services the 505th runs on. Created once; staff can pause / mute / edit them (not delete). */
const BUILTIN: Mon[] = [
  { id: "website", name: "Website", group: "CORE", type: "website", target: "", order: 1, builtin: true, slowMs: 2500 },
  { id: "db", name: "Database (MongoDB Atlas)", group: "CORE", type: "db", target: "", order: 2, builtin: true, slowMs: 800 },
  { id: "cortana", name: "Cortana v2", group: "CORE", type: "bot", target: "", order: 3, builtin: true, slowMs: 1000 },
  { id: "hub", name: "505th Hub", group: "CORE", type: "hub", target: "", order: 4, builtin: true },
  { id: "discord", name: "Discord API", group: "SERVICES", type: "discord", target: "", order: 5, builtin: true, third: true, slowMs: 1000 },
  { id: "cloudinary", name: "Cloudinary (images)", group: "SERVICES", type: "cloudinary", target: "https://res.cloudinary.com/", order: 6, builtin: true, third: true, slowMs: 2000 },
  { id: "ably", name: "505th Net (Ably)", group: "SERVICES", type: "ably", target: "https://rest.ably.io/time", order: 7, builtin: true, third: true, slowMs: 1500 },
  { id: "arma", name: "Arma 3 Server", group: "GAME", type: "game", target: "", order: 8, builtin: true, paused: true, slowMs: 1500 },
];

async function timed(fn: () => Promise<string | void>): Promise<Res> {
  const t = Date.now();
  try { const info = await fn(); return { ms: Date.now() - t, info: info || undefined }; }
  catch (e) { return { ms: null, error: String((e as Error).message || e).slice(0, 200) }; }
}
const httpOk = (url: string, ua = "Cortana-uptime") => timed(async () => {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "follow", headers: { "user-agent": ua } });
  if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
});

/** Arma 3 / Steam A2S_INFO query → "map · players/max". Target "host:queryPort" (game port + 1). */
function a2s(target: string): Promise<Res> {
  const [host, p] = target.split(":");
  const port = Number(p);
  if (!host || !port) return Promise.resolve({ ms: null, error: "Set the server address (host:queryPort) in Edit" });
  return new Promise((res) => {
    const s = createSocket("udp4");
    const t0 = Date.now();
    const q = Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]), Buffer.from("Source Engine Query\0")]);
    const done = (r: Res) => { clearTimeout(to); try { s.close(); } catch { /* closed */ } res(r); };
    const to = setTimeout(() => done({ ms: null, error: "No answer from the game server (5 s)" }), 5000);
    s.on("error", (e) => done({ ms: null, error: e.message }));
    s.on("message", (m) => {
      if (m[4] === 0x41) { s.send(Buffer.concat([q, m.subarray(5, 9)]), port, host); return; } // challenge → resend with it
      if (m[4] !== 0x49) return done({ ms: null, error: "Unexpected reply" });
      let i = 6;
      const str = () => { const e = m.indexOf(0, i); const v = m.subarray(i, e).toString("utf8"); i = e + 1; return v; };
      str(); const map = str(); str(); str(); i += 2;
      const players = m[i] ?? 0, max = m[i + 1] ?? 0;
      done({ ms: Date.now() - t0, info: `${map || "no mission"} · ${players} / ${max} players` });
    });
    s.send(q, port, host);
  });
}

/** Website TLS certificate expiry (checked once an hour). */
function certExpiry(): Promise<string | null> {
  return new Promise((res) => {
    try {
      const host = new URL(site()).hostname;
      const sock = tlsConnect({ host, port: 443, servername: host, timeout: 8000 }, () => { const c = sock.getPeerCertificate(); sock.end(); res(c?.valid_to ? new Date(c.valid_to).toISOString() : null); });
      sock.on("error", () => res(null));
      sock.on("timeout", () => { sock.destroy(); res(null); });
    } catch { res(null); }
  });
}

async function check(m: Mon, client: Client<true>): Promise<Res> {
  switch (m.type) {
    case "website": return httpOk(`${site()}/api/public/ops`);
    case "db": return timed(async () => { await TerminalDoc.db.db!.command({ ping: 1 }); });
    case "bot": { const p = client.ws.ping; return { ms: p >= 0 ? p : 1, info: `uptime ${Math.round(process.uptime() / 3600)} h` }; }
    case "discord": { const p = client.ws.ping; return p >= 0 && client.isReady() ? { ms: p, info: "gateway ping" } : { ms: null, error: "Not connected to Discord" }; }
    case "hub": {
      const now = Date.now();
      const [using, signedIn] = await Promise.all([
        HubSession.countDocuments({ revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(now - 5 * 60_000) } }),
        HubSession.countDocuments({ revokedAt: { $exists: false }, expiresAt: { $gt: new Date(now) } }),
      ]);
      return { ms: 0, info: `${using} using now · ${signedIn} signed in` };
    }
    case "game": return a2s(m.target);
    default: return /^https:\/\//.test(m.target) ? httpOk(m.target) : { ms: null, error: "No https:// address set" };
  }
}

async function alertDiscord(client: Client<true>, title: string, text: string, color: number) {
  const s = await cortanaSettings().catch(() => ({} as U));
  const id = s.logs?.auditId || s.logs?.modLogId;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (ch && "send" in ch) await ch.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(text).setFooter({ text: "505th Network Status", iconURL: LOGO }).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}
/** 🔔 alert (+ Hub pop-up) to the Commander and Developer(s). */
async function alertStaff(title: string, body: string) {
  const who = await TerminalDoc.find({ parent: "users", "data.role": { $in: ["commander", "developer"] } }, { docId: 1 }).lean();
  const now = new Date();
  for (const u of who) {
    const id = autoId();
    await TerminalDoc.create({ _id: `notifications/${u.docId}/items/${id}`, parent: `notifications/${u.docId}/items`, docId: id, createTime: now, updateTime: now,
      data: { type: "network", read: false, title, body, createdAt: now } }).catch(() => {});
  }
}

async function seed() {
  for (const m of BUILTIN) {
    const now = new Date();
    const { id, ...data } = m;
    await TerminalDoc.updateOne({ _id: `net_monitors/${id}` }, { $setOnInsert: { parent: "net_monitors", docId: id, createTime: now, updateTime: now, data } }, { upsert: true });
  }
}

let lastCert = 0, certISO: string | null = null;
async function run(client: Client<true>) {
  const mons = (await TerminalDoc.find({ parent: "net_monitors" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as Mon)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const now = new Date(), nowISO = now.toISOString(), day = ukDay(now), min = minuteOfDay(now), epochMin = Math.floor(now.getTime() / 60000);
  if (Date.now() - lastCert > 3600_000) { lastCert = Date.now(); certISO = await certExpiry(); }
  const results = await Promise.all(mons.map(async (m) => [m, m.paused ? null : await check(m, client).catch((e) => ({ ms: null, error: (e as Error).message }) as Res)] as const));
  const old: U = {};
  for (const [m, r] of results) {
    const prev = ((await TerminalDoc.findById(`net_status/${m.id}`, { data: 1 }).lean())?.data ?? {}) as U;
    if (!r) { await patchDoc("net_status", m.id, { status: "paused", checkedAtISO: nowISO }); continue; }
    const s = r.ms == null ? 2 : m.slowMs && r.ms > m.slowMs ? 1 : 0;
    const status = ["up", "slow", "down"][s]!;
    const fails = s === 2 ? (prev.fails ?? 0) + 1 : 0;
    let downSinceISO: string | null = prev.downSinceISO ?? null, alerted = !!prev.alerted;
    if (s === 2) downSinceISO ??= nowISO;
    // Incidents + alerts
    if (s === 2 && fails === FAILS_FOR_ALERT) {
      const iid = `${m.id}-${Date.parse(downSinceISO!)}`;
      await TerminalDoc.updateOne({ _id: `net_events/${iid}` }, { $setOnInsert: { parent: "net_events", docId: iid, createTime: now, updateTime: now,
        data: { mon: m.id, name: m.name, startedAtISO: downSinceISO, endedAtISO: null, error: r.error ?? "No answer", note: "" } } }, { upsert: true });
      if (!m.muted) {
        alerted = true;
        log.warn(`${m.name} down (${fails} failed checks).`);
        await alertDiscord(client, `🔴 ${m.name} DOWN`, `No answer for ${fails} checks in a row (since <t:${Math.floor(Date.parse(downSinceISO!) / 1000)}:t>).\n${r.error ? `\`${r.error}\`` : ""}`, 0xef4444);
        await alertStaff(`🔴 ${m.name} is down`, `${r.error ?? "No answer"} — open Network Status.`);
      }
    }
    if (s !== 2 && downSinceISO) {
      const mins = Math.max(1, Math.round((Date.now() - Date.parse(downSinceISO)) / 60000));
      await TerminalDoc.updateOne({ parent: "net_events", "data.mon": m.id, "data.endedAtISO": null }, { $set: { "data.endedAtISO": nowISO, updateTime: now } });
      if (alerted) {
        await alertDiscord(client, `🟢 ${m.name} back up`, `Recovered after about ${mins} min.`, 0x22e07a);
        await alertStaff(`🟢 ${m.name} is back up`, `Recovered after about ${mins} min.`);
      }
      downSinceISO = null; alerted = false;
    }
    const last = [...(Array.isArray(prev.last) ? prev.last : []), [epochMin, r.ms ?? -1, s]].slice(-90);
    await patchDoc("net_status", m.id, { status, ms: r.ms, checkedAtISO: nowISO, fails, downSinceISO, alerted, info: r.info ?? "", error: s === 2 ? r.error ?? "No answer" : "", last,
      ...(m.type === "website" ? { certValidToISO: certISO } : {}) });
    await TerminalDoc.updateOne({ _id: `net_days/${m.id}_${day}` }, { $push: { "data.b": [min, r.ms ?? -1, s] }, $set: { "data.mon": m.id, "data.day": day, updateTime: now },
      $setOnInsert: { parent: "net_days", docId: `${m.id}_${day}`, createTime: now } }, { upsert: true });
    if (m.id === "website" || m.id === "db") old[m.id === "website" ? "web" : "db"] = r.ms;
  }
  await oldDashboard(old);
}

/** Keep the old Dashboard uptime bars (bot_status/monitors { web, db }) working. */
async function oldDashboard(v: U) {
  const cur = ((await TerminalDoc.findById("bot_status/monitors", { data: 1 }).lean())?.data ?? {}) as U;
  const k = ukDay();
  const keep = new Set(Array.from({ length: 30 }, (_, i) => ukDay(new Date(Date.now() - i * 864e5))));
  const out: U = {};
  for (const key of ["web", "db"]) {
    if (!(key in v)) continue;
    const m = { days: {}, lastMs: null, up: true, ...(cur[key] ?? {}) } as U;
    const d = (m.days[k] ??= { ok: 0, n: 0 });
    d.n++; if (v[key] != null) d.ok++;
    for (const x of Object.keys(m.days)) if (!keep.has(x)) delete m.days[x];
    m.lastMs = v[key]; m.up = v[key] != null;
    out[key] = m;
  }
  await patchDoc("bot_status", "monitors", { ...out, checkedAtISO: new Date().toISOString() });
}

/** Delete day records older than 90 days (once a day). */
async function prune() {
  const cut = ukDay(new Date(Date.now() - KEEP_DAYS * 864e5));
  await TerminalDoc.deleteMany({ parent: "net_days", "data.day": { $lt: cut } });
  await TerminalDoc.deleteMany({ parent: "net_events", "data.endedAtISO": { $ne: null, $lt: new Date(Date.now() - KEEP_DAYS * 864e5).toISOString() } });
}

/** Discord "who's online" for the Dashboard (unchanged). */
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

/** "↻ CHECK NOW" from the website / Hub: a bot_jobs { type: "net.check" } job runs one round straight away. */
export function checkNow(client: Client<true>) { return run(client); }

export function startMonitors(client: Client<true>) {
  let busy = false;
  const go = () => {
    if (busy) return;
    busy = true;
    void run(client).catch((e) => log.warn(`Network check failed: ${(e as Error).message}`)).finally(() => { busy = false; });
    void discordLive(client).catch((e) => log.warn(`Discord online count failed: ${(e as Error).message}`));
  };
  void seed().then(go).catch((e) => log.warn(`Network monitors seed failed: ${(e as Error).message}`));
  void prune().catch(() => {});
  const t = setInterval(go, EVERY_MS);
  const p = setInterval(() => void prune().catch(() => {}), 24 * 3600_000);
  return () => { clearInterval(t); clearInterval(p); };
}
