/**
 * Staff Discord status for Dashboard → Staff Online (approved mock 2026-11-11, same idea as RCD Guardian).
 * Copies the Discord status (online / idle / dnd / offline) of STAFF ONLY — linked members with Command Terminal
 * access (Recruiter and above, not suspended). Nobody else's status is ever stored.
 * Writes one record: bot_status/staff_presence { staff: [{ discordId, uid, name, status, sinceISO, lastOnlineISO }], atISO, enabled }.
 *
 * Needs Presence Intent ON in the Developer Portal → Bot AND PRESENCE_INTENT=true in .env.local.
 * Without it the record says enabled:false and the Dashboard shows "Discord status off".
 */
import { Events, type Client, type Presence } from "discord.js";
import { Member, TerminalDoc } from "@505th/db";
import { hasTerminal } from "../../website/lib/terminal/access.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { patchDoc } from "./store.ts";

type Status = "online" | "idle" | "dnd" | "offline";
type Row = { discordId: string; uid: string; name: string; status: Status; sinceISO: string; lastOnlineISO: string | null };
const toStatus = (s: string | undefined): Status => (s === "online" || s === "idle" || s === "dnd" ? s : "offline");

let staff = new Map<string, { uid: string; name: string }>();
const rows = new Map<string, Row>();
let timer: NodeJS.Timeout | undefined;

async function refreshStaff() {
  const docs = await TerminalDoc.find({ parent: "users", "data.discordId": { $regex: "^\\d{17,20}$" }, "data.suspended": { $ne: true } }, { docId: 1, data: 1 }).lean();
  const left = new Set((await Member.find({ status: { $in: ["SUSPENDED", "LEFT_UNIT"] } }, { discordId: 1 }).lean()).map((m) => String(m.discordId)));
  const next = new Map<string, { uid: string; name: string }>();
  for (const d of docs) {
    const x = (d.data ?? {}) as Record<string, unknown>;
    const id = String(x.discordId);
    if (!hasTerminal(String(x.role ?? "")) || left.has(id)) continue;
    next.set(id, { uid: String(d.docId), name: String(x.callsign || x.name || x.displayName || "Staff").slice(0, 60) });
  }
  staff = next;
  for (const id of [...rows.keys()]) if (!staff.has(id)) rows.delete(id);
}

function set(id: string, status: Status) {
  const s = staff.get(id);
  if (!s) return;
  const prev = rows.get(id), now = new Date().toISOString();
  const changed = !prev || prev.status !== status;
  rows.set(id, {
    discordId: id, uid: s.uid, name: s.name, status,
    sinceISO: changed ? now : prev!.sinceISO,
    lastOnlineISO: status !== "offline" ? now : prev?.status && prev.status !== "offline" ? now : prev?.lastOnlineISO ?? null,
  });
  if (changed) save();
}

/** Batched write (many changes at once → one write after 3 s). */
function save() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void patchDoc("bot_status", "staff_presence", { enabled: true, staff: [...rows.values()], atISO: new Date().toISOString() }).catch(() => {});
  }, 3000);
}

export async function startStaffPresence(client: Client<true>) {
  if (!env.PRESENCE_INTENT) {
    await patchDoc("bot_status", "staff_presence", { enabled: false, staff: [], atISO: new Date().toISOString() }).catch(() => {});
    log.info("Staff presence: off (set PRESENCE_INTENT=true after switching Presence Intent ON in the Developer Portal).");
    return () => {};
  }
  try {
    await refreshStaff();
    // last-online times survive a restart
    const old = ((await TerminalDoc.findById("bot_status/staff_presence", { data: 1 }).lean())?.data as { staff?: Row[] } | undefined)?.staff ?? [];
    for (const r of old) if (staff.has(r.discordId)) rows.set(r.discordId, r);
    const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
    for (const id of staff.keys()) set(id, toStatus(g?.presences.cache.get(id)?.status));
    save();
    log.ok(`Staff presence: tracking ${staff.size} staff member(s).`);
  } catch (e) {
    log.warn(`Staff presence start failed: ${(e as Error).message}`);
  }
  const onUpdate = (_o: Presence | null, p: Presence) => {
    if (p.guild?.id !== env.AUTHORISED_GUILD_ID || !p.userId) return;
    set(p.userId, toStatus(p.status));
  };
  client.on(Events.PresenceUpdate, onUpdate);
  // Staff list changes (promotions, new links) every 2 minutes.
  const t = setInterval(() => void refreshStaff().then(() => {
    const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
    for (const id of staff.keys()) if (!rows.has(id)) set(id, toStatus(g?.presences.cache.get(id)?.status));
    save();
  }).catch(() => {}), 120_000);
  return () => { clearInterval(t); client.off(Events.PresenceUpdate, onUpdate); };
}
