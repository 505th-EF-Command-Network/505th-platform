/**
 * OWNER ONLY: tells the person in CORTANA_OWNER_DISCORD_ID when a staff member comes online —
 *   🟢 on Discord (bot_status/staff_presence, needs PRESENCE_INTENT) · 🖥 opens the Hub · 🌐 signs in to the website Terminal.
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
let prev: Record<"discord" | "hub" | "web", Set<string>> | null = null;
const lastSent = new Map<string, number>();

async function tick() {
  const ownerId = env.CORTANA_OWNER_DISCORD_ID;
  if (!ownerId) return;
  const now = Date.now();
  const users = (await TerminalDoc.find({ parent: "users" }, { docId: 1, "data.discordId": 1, "data.role": 1, "data.callsign": 1, "data.name": 1, "data.displayName": 1, "data.suspended": 1 }).lean()) as U[];
  const owner = users.find((u) => String(u.data?.discordId ?? "") === ownerId);
  if (!owner) return;
  const staff = new Map<string, string>();
  for (const u of users) if (hasTerminal(String(u.data?.role ?? "")) && u.data?.suspended !== true && u.docId !== owner.docId) staff.set(String(u.docId), String(u.data?.callsign || u.data?.name || u.data?.displayName || "Staff").slice(0, 60));

  const [sp, hubs, pres] = await Promise.all([
    TerminalDoc.findById("bot_status/staff_presence", { data: 1 }).lean() as Promise<U | null>,
    HubSession.find({ revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(now - ONLINE_MS) } }, { member: 1 }).lean(),
    TerminalDoc.find({ parent: "presence_sessions" }, { data: 1 }).lean() as Promise<U[]>,
  ]);
  const discord = new Set<string>(sp?.data?.enabled ? ((sp.data.staff ?? []) as U[]).filter((x) => x.status && x.status !== "offline").map((x) => String(x.uid)) : []);
  const mem = hubs.length ? await Member.find({ _id: { $in: hubs.map((h) => h.member) } }, { legacyId: 1 }).lean() : [];
  const hub = new Set<string>(mem.map((m) => String((m as U).legacyId || m._id)));
  const web = new Set<string>(pres.filter((p) => now - Date.parse(p.data?.updatedAt || 0) < ONLINE_MS).map((p) => String(p.data?.uid)));
  const cur = { discord, hub, web };

  if (prev) {
    const what = { discord: ["🟢", "is online on Discord"], hub: ["🖥", "opened the Hub"], web: ["🌐", "signed in to the website"] } as const;
    for (const k of ["discord", "hub", "web"] as const) {
      for (const uid of cur[k]) {
        if (prev[k].has(uid) || !staff.has(uid)) continue;
        const key = `${k}:${uid}`;
        if (now - (lastSent.get(key) ?? 0) < QUIET_MS) continue;
        lastSent.set(key, now);
        const id = autoId(), t = new Date();
        await TerminalDoc.create({ _id: `notifications/${owner.docId}/items/${id}`, parent: `notifications/${owner.docId}/items`, docId: id, createTime: t, updateTime: t,
          data: { type: "staff_online", read: false, title: `${what[k][0]} ${staff.get(uid)} ${what[k][1]}`, body: "Staff online — only you get these.", createdAt: t } }).catch(() => {});
      }
    }
  }
  prev = cur;
}

export function startStaffWatch() {
  if (!env.CORTANA_OWNER_DISCORD_ID) { log.info("Staff watch: off (set CORTANA_OWNER_DISCORD_ID in .env.local)."); return; }
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await tick(); } catch (e) { log.warn(`Staff watch: ${(e as Error).message}`); } finally { busy = false; } };
  void run();
  setInterval(() => void run(), 60_000);
}
