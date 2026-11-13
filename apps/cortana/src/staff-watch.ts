/**
 * OWNER ONLY: tells the person in CORTANA_OWNER_DISCORD_ID when a staff member comes online —
 *   🖥 opens the Hub · 🌐 signs in to the website Terminal. (Discord online is NOT alerted — owner asked 2026-11-13.)
 * Nobody else gets these. Checks every minute; the first check after start only learns who is on (no alerts).
 * Same person again within 30 min on the same place = no repeat alert.
 */
import { HubSession, Member, TerminalDoc } from "@505th/db";
import { hasTerminal } from "../../website/lib/terminal/access.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { autoId } from "./util.ts";

type U = Record<string, any>;
const ONLINE_MS = 3 * 60_000, QUIET_MS = 30 * 60_000;
let prev: Record<"hub" | "web", Set<string>> | null = null;
const lastSent = new Map<string, number>();

const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Usage log for Staff Online v2: staff_usage/<uid>_<UK day> { uid, day, mins, hub, web, opens: { hub, web }, lastISO }. One minute per tick. */
async function logUsage(uid: string, inHub: boolean, inWeb: boolean, opened: { hub: boolean; web: boolean }) {
  const day = ukDay(), id = `${uid}_${day}`, now = new Date();
  const inc: Record<string, number> = { "data.mins": 1 };
  if (inHub) inc["data.hub"] = 1;
  if (inWeb) inc["data.web"] = 1;
  if (opened.hub) inc["data.opens.hub"] = 1;
  if (opened.web) inc["data.opens.web"] = 1;
  await TerminalDoc.updateOne({ _id: `staff_usage/${id}` },
    { $inc: inc, $set: { "data.uid": uid, "data.day": day, "data.lastISO": now.toISOString(), updateTime: now }, $setOnInsert: { parent: "staff_usage", docId: id, createTime: now } }, { upsert: true });
}

/** "3rd time this week" / "first time in 9 days" for the owner's alert. */
async function extraLine(uid: string, k: "hub" | "web") {
  const days = (await TerminalDoc.find({ parent: "staff_usage", "data.uid": uid }, { "data.day": 1, "data.opens": 1 }).sort({ "data.day": -1 }).limit(8).lean()) as U[];
  const today = ukDay(), weekAgo = ukDay(new Date(Date.now() - 6 * 864e5));
  const prevDay = days.find((d) => d.data?.day < today)?.data?.day as string | undefined;
  if (!prevDay) return "first time we've seen them";
  const gap = Math.round((Date.parse(today) - Date.parse(prevDay)) / 864e5);
  if (gap >= 7) return `first time in ${gap} days`;
  const n = days.filter((d) => d.data?.day >= weekAgo).reduce((s, d) => s + Number(d.data?.opens?.[k] ?? 0), 0);
  return `${ordinal(Math.max(1, n))} time this week`;
}

async function tick() {
  const ownerId = env.CORTANA_OWNER_DISCORD_ID;
  const now = Date.now();
  const users = (await TerminalDoc.find({ parent: "users" }, { docId: 1, "data.discordId": 1, "data.role": 1, "data.callsign": 1, "data.name": 1, "data.displayName": 1, "data.suspended": 1 }).lean()) as U[];
  const owner = ownerId ? users.find((u) => String(u.data?.discordId ?? "") === ownerId) : undefined;
  const staff = new Map<string, string>();
  for (const u of users) if (hasTerminal(String(u.data?.role ?? "")) && u.data?.suspended !== true) staff.set(String(u.docId), String(u.data?.callsign || u.data?.name || u.data?.displayName || "Staff").slice(0, 60));

  const [hubs, pres] = await Promise.all([
    HubSession.find({ revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(now - ONLINE_MS) } }, { member: 1 }).lean(),
    TerminalDoc.find({ parent: "presence_sessions" }, { data: 1 }).lean() as Promise<U[]>,
  ]);
  const mem = hubs.length ? await Member.find({ _id: { $in: hubs.map((h) => h.member) } }, { legacyId: 1 }).lean() : [];
  const hub = new Set<string>(mem.map((m) => String((m as U).legacyId || m._id)));
  const web = new Set<string>(pres.filter((p) => now - Date.parse(p.data?.updatedAt || 0) < ONLINE_MS).map((p) => String(p.data?.uid)));
  const cur = { hub, web };

  // Usage log (everyone with Terminal access, the owner too).
  for (const uid of new Set([...hub, ...web])) {
    if (!staff.has(uid)) continue;
    const opened = { hub: !!prev && hub.has(uid) && !prev.hub.has(uid), web: !!prev && web.has(uid) && !prev.web.has(uid) };
    await logUsage(uid, hub.has(uid), web.has(uid), opened).catch(() => {});
  }

  // Owner-only alerts: someone opened the Hub / signed in to the website (never Discord).
  if (prev && owner) {
    const what = { hub: ["🖥", "opened the Hub"], web: ["🌐", "signed in to the website"] } as const;
    for (const k of ["hub", "web"] as const) {
      for (const uid of cur[k]) {
        if (prev[k].has(uid) || !staff.has(uid) || uid === owner.docId) continue;
        const key = `${k}:${uid}`;
        if (now - (lastSent.get(key) ?? 0) < QUIET_MS) continue;
        lastSent.set(key, now);
        const id = autoId(), t = new Date();
        const extra = await extraLine(uid, k).catch(() => "");
        await TerminalDoc.create({ _id: `notifications/${owner.docId}/items/${id}`, parent: `notifications/${owner.docId}/items`, docId: id, createTime: t, updateTime: t,
          data: { type: "staff_online", read: false, title: `${what[k][0]} ${staff.get(uid)} ${what[k][1]}`, body: extra || "Staff online — only you get these.", staffUid: uid, where: k, createdAt: t } }).catch(() => {});
      }
    }
  }
  prev = cur;
}

export function startStaffWatch() {
  if (!env.CORTANA_OWNER_DISCORD_ID) log.info("Staff watch: usage log on · owner alerts off (set CORTANA_OWNER_DISCORD_ID in .env.local).");
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await tick(); } catch (e) { log.warn(`Staff watch: ${(e as Error).message}`); } finally { busy = false; } };
  void run();
  setInterval(() => void run(), 60_000);
}
