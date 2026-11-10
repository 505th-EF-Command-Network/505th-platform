/**
 * Discord Role Sync (approved 2026-11-10) — BOTH WAYS for 4 groups:
 *   🎖 rank (users.rank, e.g. "E7 / Gunnery Sergeant") · 🪖 unit (users.platoon) · 👥 squad (users.squad)
 *   📋 status (active / inactive → users.status · retired → users.role "retired_veteran", only for non-staff)
 * Settings: settings/discord_sync  { enabled, ranks:{rank:roleId}, units:{platoon:roleId}, squads:{name:roleId},
 *   status:{active,inactive,retired: roleId}, keepRankOnRemove (rank + unit kept when the role is just removed), retiredRemovesSquad, inactiveRemovesSquad, logChannelId }
 *
 * Discord → website: a member's roles change → their personnel file follows (one role per group; highest rank wins).
 * Website → website: personnel file changes (change stream) → Cortana swaps the Discord roles.
 * Loops: Cortana marks its own writes (data.syncSource) and ignores role updates it made itself.
 * NEVER touches website ACCESS (recruiter / nco / staff_nco / officer / developer / commander).
 * Every change → sync_log (feed), audit log, optional #personnel-log embed.
 */
import { AuditLogEvent, EmbedBuilder, type Client, type GuildMember, type PartialGuildMember } from "discord.js";
import { Member, TerminalDoc } from "@505th/db";
import { roleLevel } from "../../website/lib/terminal/access.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { LOGO, auditLog, autoId, nowISO, safeRole } from "./util.ts";

type Cfg = {
  enabled?: boolean; ranks?: Record<string, string>; units?: Record<string, string>; squads?: Record<string, string>;
  status?: Record<string, string>; keepRankOnRemove?: boolean; retiredRemovesSquad?: boolean; inactiveRemovesSquad?: boolean; logChannelId?: string;
};
type User = { rank?: string; platoon?: string; squad?: string; status?: string; role?: string; discordId?: string; firstName?: string; lastName?: string; callsign?: string };
const GROUPS = ["rank", "unit", "squad", "status"] as const;
type Group = (typeof GROUPS)[number];

let cache: { at: number; cfg: Cfg } = { at: 0, cfg: {} };
async function cfg(): Promise<Cfg> {
  if (Date.now() - cache.at < 10_000) return cache.cfg;
  cache = { at: Date.now(), cfg: (((await TerminalDoc.findById("settings/discord_sync", { data: 1 }).lean())?.data ?? {}) as Cfg) };
  return cache.cfg;
}
const mapOf = (c: Cfg, g: Group): Record<string, string> => ({ rank: c.ranks, unit: c.units, squad: c.squads, status: c.status })[g] ?? {};
const rankOrder = (r: string) => { const m = String(r).match(/^([OE])(\d+)/); return !m ? -1 : (m[1] === "O" ? 100 : 0) + Number(m[2]) * 10 + (/Sergeant Major|Master Chief|Chief Master/.test(r) ? 1 : 0); };
const name = (u: User) => (u.callsign ? `"${u.callsign}"` : [u.firstName, u.lastName].filter(Boolean).join(" ")) || "member";
const statusOf = (u: User) => (u.role === "retired_veteran" ? "retired" : u.status === "inactive" ? "inactive" : "active");
const valueOf = (u: User, g: Group) => (g === "rank" ? u.rank ?? "" : g === "unit" ? u.platoon ?? "" : g === "squad" ? u.squad ?? "" : statusOf(u));
const LABEL: Record<Group, string> = { rank: "Rank", unit: "Unit", squad: "Squad", status: "Status" };

/** Roles Cortana is changing right now → ignore the GuildMemberUpdate echo. */
const quiet = new Map<string, number>();
const hush = (id: string) => quiet.set(id, Date.now() + 15_000);
const hushed = (id: string) => (quiet.get(id) ?? 0) > Date.now();

async function linked(discordId: string) {
  const m = await Member.findOne({ discordId }, { legacyId: 1 }).lean();
  if (!m) return null;
  const uid = m.legacyId || String(m._id);
  const d = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as User | undefined;
  return d ? { uid, user: d } : null;
}

async function feed(client: Client<true>, e: { uid?: string; who: string; group: Group | "error"; from: string; to: string; source: "discord" | "website"; by: string; note?: string }) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `sync_log/${id}`, parent: "sync_log", docId: id, createTime: now, updateTime: now, data: { ...e, atISO: now.toISOString() } }).catch(() => {});
  if (e.group === "error") return;
  await auditLog(`${LABEL[e.group].toUpperCase()} CHANGED (${e.source.toUpperCase()})`, `${e.who}: ${e.from || "—"} → ${e.to || "—"}`, e.by, "personnel");
  const c = await cfg();
  const ch = c.logChannelId ? await client.channels.fetch(c.logChannelId).catch(() => null) : null;
  if (ch && "send" in ch) {
    const up = e.group === "rank" && rankOrder(e.to) > rankOrder(e.from);
    const title = e.group === "rank" ? (up ? "🎖 Promotion" : "▼ Rank change") : e.group === "unit" ? "🪖 Unit transfer" : e.group === "squad" ? "👥 Squad move" : "📋 Status change";
    const discordId = e.uid ? ((await TerminalDoc.findById(`users/${e.uid}`, { "data.discordId": 1 }).lean())?.data as any)?.discordId : null;
    await ch.send({ embeds: [new EmbedBuilder().setColor(up ? 0x22e07a : 0x00d9ff).setTitle(title).setDescription(`${discordId ? `<@${discordId}>` : e.who} · ${e.from || "—"} → **${e.to || "—"}**`).setFooter({ text: `By ${e.by} · website + Hub updated`, iconURL: LOGO }).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
  }
}

/* ───────── Discord → website ───────── */
async function whoChanged(m: GuildMember) {
  const logs = await m.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 }).catch(() => null);
  const e = logs?.entries.find((x) => x.targetId === m.id && Date.now() - x.createdTimestamp < 30_000);
  if (!e?.executor) return "Discord";
  const ex = await m.guild.members.fetch(e.executor.id).catch(() => null);
  return ex?.displayName ?? e.executor.username ?? "Discord";
}

export async function onMemberUpdate(client: Client<true>, before: GuildMember | PartialGuildMember, after: GuildMember) {
  if (after.guild.id !== env.AUTHORISED_GUILD_ID || hushed(after.id)) return;
  if (!before.partial && before.roles.cache.size === after.roles.cache.size && before.roles.cache.every((r) => after.roles.cache.has(r.id))) return;
  const c = await cfg();
  if (!c.enabled) return void log.info(`Role change for ${after.displayName} ignored — Role Sync is OFF (COMMAND → Discord Role Sync).`);
  const l = await linked(after.id);
  if (!l) return void log.info(`Role change for ${after.displayName} ignored — not linked to a website account.`);
  const set: Record<string, unknown> = {};
  const changes: { g: Group; from: string; to: string }[] = [];
  const fixRoles: { remove: string[]; add: string[] } = { remove: [], add: [] };
  for (const g of GROUPS) {
    const map = mapOf(c, g);
    const has = Object.entries(map).filter(([, rid]) => rid && after.roles.cache.has(rid)).map(([v]) => v);
    const had = before.partial ? null : Object.entries(map).filter(([, rid]) => rid && before.roles.cache.has(rid)).map(([v]) => v);
    const cur = valueOf(l.user, g);
    let next: string | null = null;
    if (has.length) {
      // Newly given role wins; else the highest rank / first listed.
      const fresh = had ? has.filter((v) => !had.includes(v)) : [];
      next = (fresh.length ? fresh : has).sort((a, b) => (g === "rank" ? rankOrder(b) - rankOrder(a) : 0))[0];
      for (const v of has) if (v !== next) fixRoles.remove.push(map[v]); // one role per group
    } else if (had?.length && (g === "squad" || g === "status")) {
      next = g === "status" ? "active" : ""; // squad role removed → no squad · status role removed → active
    } else if (had?.length && c.keepRankOnRemove === false) {
      next = ""; // optional: rank / unit role removed with no new one → cleared (default: kept)
    }
    if (next === null || next === cur) continue;
    if (g === "status" && next === "retired" && roleLevel(l.user.role) > 0) {
      await feed(client, { uid: l.uid, who: name(l.user), group: "error", from: cur, to: next, source: "discord", by: "Cortana", note: "Staff can't be set to Retired from Discord — change their access on the website first" });
      continue;
    }
    changes.push({ g, from: cur, to: next as string });
    if (g === "rank") set["data.rank"] = next;
    if (g === "unit") set["data.platoon"] = next;
    if (g === "squad") set["data.squad"] = next;
    if (g === "status") {
      set["data.status"] = next === "inactive" ? "inactive" : "active";
      if (next === "retired") set["data.role"] = "retired_veteran";
      else if (l.user.role === "retired_veteran") set["data.role"] = "member";
      if ((next === "retired" && c.retiredRemovesSquad !== false) || (next === "inactive" && c.inactiveRemovesSquad)) {
        set["data.squad"] = "";
        for (const rid of Object.values(c.squads ?? {})) if (rid && after.roles.cache.has(rid)) fixRoles.remove.push(rid);
      }
    }
  }
  if (fixRoles.remove.length) { hush(after.id); await after.roles.remove([...new Set(fixRoles.remove)], "Role sync: one role per group").catch(() => {}); }
  if (!changes.length) return void log.info(`Role change for ${after.displayName}: no mapped rank / unit / squad / status role changed.`);
  set["data.syncSource"] = "discord";
  set["data.syncAtISO"] = nowISO();
  set.updateTime = new Date();
  const by = await whoChanged(after);
  // Same history entries the personnel file makes (Service Record → Promotion / Platoon history).
  const day = nowISO().slice(0, 10), push: Record<string, unknown> = {};
  for (const x of changes) {
    if (x.g === "rank") push["data.promotionHistory"] = { date: day, fromRank: x.from || "—", toRank: x.to || "—", note: "Changed in Discord (role sync)", addedBy: by, addedAt: nowISO(), auto: true };
    if (x.g === "unit") { push["data.platoonHistory"] = { date: day, from: x.from || "—", to: x.to || "—", note: "Changed in Discord (role sync)", addedBy: by, addedAt: nowISO(), auto: true }; set["data.joinedPlatoon"] = day; }
  }
  await TerminalDoc.updateOne({ _id: `users/${l.uid}` }, { $set: set, ...(Object.keys(push).length ? { $push: push } : {}) });
  const promo = changes.find((x) => x.g === "rank" && rankOrder(x.to) > rankOrder(x.from));
  if (promo) {
    const nid = autoId(), now = new Date();
    await TerminalDoc.create({ _id: `notifications/${l.uid}/items/${nid}`, parent: `notifications/${l.uid}/items`, docId: nid, createTime: now, updateTime: now,
      data: { type: "promotion", read: false, title: "You have been promoted!", body: "New rank: " + promo.to, createdAt: now } }).catch(() => {});
  }
  for (const x of changes) await feed(client, { uid: l.uid, who: name(l.user), group: x.g, from: x.from, to: x.to, source: "discord", by });
  log.info(`Role sync (Discord → website): ${name(l.user)} ${changes.map((x) => `${x.g} ${x.from || "—"}→${x.to || "—"}`).join(", ")}`);
}

/* ───────── website → Discord ───────── */
export async function applyToDiscord(client: Client<true>, uid: string, by = "Website") {
  const c = await cfg();
  if (!c.enabled) return { skipped: "off" };
  const u = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as User | undefined;
  if (!u?.discordId) return void log.info(`Role sync: ${u ? name(u) : uid} changed on the website — no Discord ID on the personnel file.`), { skipped: "not linked" };
  const g = client.guilds.cache.get(env.AUTHORISED_GUILD_ID)!;
  const m = await g.members.fetch(u.discordId).catch(() => null);
  if (!m) return void log.info(`Role sync: ${name(u)} isn't in the Discord server.`), { skipped: "not in server" };
  const add: string[] = [], remove: string[] = [], changes: { grp: Group; from: string; to: string }[] = [];
  const st = statusOf(u);
  for (const grp of GROUPS) {
    const map = mapOf(c, grp);
    let want = valueOf(u, grp);
    if (grp === "squad" && ((st === "retired" && c.retiredRemovesSquad !== false) || (st === "inactive" && c.inactiveRemovesSquad))) want = "";
    const wantRole = want ? map[want] : "";
    const before = Object.entries(map).find(([, rid]) => rid && m.roles.cache.has(rid))?.[0] ?? "";
    for (const [v, rid] of Object.entries(map)) {
      if (!rid) continue;
      if (rid === wantRole && !m.roles.cache.has(rid)) add.push(rid);
      if (rid !== wantRole && m.roles.cache.has(rid) && v !== want) remove.push(rid);
    }
    if (wantRole && before !== want) changes.push({ grp, from: before, to: want });
  }
  const ok = (rid: string) => safeRole(g, rid).role !== null;
  const bad = [...add, ...remove].filter((r) => !ok(r));
  if (!add.length && !remove.length) return { ok: true, changed: 0 };
  log.info(`Role sync (website → Discord): ${name(u)} +${add.length} / −${remove.length} role(s).`);
  hush(m.id);
  try {
    if (remove.filter(ok).length) await m.roles.remove(remove.filter(ok), `Role sync from website (${by})`);
    if (add.filter(ok).length) await m.roles.add(add.filter(ok), `Role sync from website (${by})`);
  } catch (e) {
    await feed(client, { uid, who: name(u), group: "error", from: "", to: "", source: "website", by: "Cortana", note: `Couldn't change Discord roles: ${(e as Error).message}` });
    return { ok: false };
  }
  if (bad.length) await feed(client, { uid, who: name(u), group: "error", from: "", to: "", source: "website", by: "Cortana", note: `${bad.length} role(s) Cortana can't manage (role above Cortana or has staff powers)` });
  for (const x of changes) await feed(client, { uid, who: name(u), group: x.grp, from: x.from, to: x.to, source: "website", by });
  return { ok: true, changed: add.length + remove.length };
}

/** Called from the change stream for users/* updates. */
export async function onUserDocChange(client: Client<true>, change: any) {
  if (change.operationType !== "update" && change.operationType !== "replace") return;
  const uid = String(change.documentKey?._id ?? "").split("/")[1];
  if (!uid || String(change.documentKey._id).split("/").length !== 2) return;
  const f = change.updateDescription?.updatedFields ?? {};
  const keys = Object.keys(f);
  if (change.operationType === "update" && !keys.some((k) => k === "data" || /^data\.(rank|platoon|squad|status|role|discordId)$/.test(k))) return;
  // Our own write from Discord comes back here too — skip it (only within 5 s; the website copies old fields when it saves).
  const d = (await TerminalDoc.findById(`users/${uid}`, { "data.syncSource": 1, "data.syncAtISO": 1, "data.updatedByName": 1 }).lean())?.data as any;
  if (d?.syncSource === "discord" && Date.now() - Date.parse(d.syncAtISO || 0) < 5000) return;
  await applyToDiscord(client, uid, d?.updatedByName || "Website").catch((e) => log.warn(`Role sync to Discord failed: ${(e as Error).message}`));
}

export function startRoleSync(client: Client<true>) {
  registerJob("rolesync.all", async (job) => {
    const who = await uidAllowed(job.data.requestedBy, "set");
    if (!who.ok) throw new PermanentJobError("Only Developers / Command can do that");
    const users = await TerminalDoc.find({ parent: "users", "data.discordId": { $exists: true, $ne: "" } }, { docId: 1 }).lean();
    let changed = 0;
    for (const u of users) { const r = await applyToDiscord(client, String(u.docId), who.name).catch(() => null); changed += (r as any)?.changed ?? 0; }
    return { members: users.length, changed };
  });
  void client;
}
