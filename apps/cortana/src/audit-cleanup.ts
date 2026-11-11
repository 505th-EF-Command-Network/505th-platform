/**
 * AUDIT LOG v3 — clean-up, clear and archives.
 *  - Monthly: 1st of the month, 00:10 UK (when settings/audit.auto is on). Removes entries older than keepMonths,
 *    and pictures/clips older than mediaMonths.
 *  - Jobs from the website: "audit.cleanup" (run now) and "audit.clear" (everything / source / type / dates).
 *  - Before deleting: .txt copy → audit_archives/{id} (saveTxt), optionally posted to a Discord channel (postTxt).
 *  - Locked records ("ENTRIES DELETED", "AUDIT CLEAN-UP", "LOG CLEARED") are never removed.
 */
import { AttachmentBuilder, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { autoId } from "./util.ts";
import { destroyMedia } from "./audit-discord.ts";
import { PermanentJobError, registerJob } from "./worker.ts";

const COLLS = ["audit_logs", "audit_log"];
const DAY = 864e5;
const CLEAN_ROLES = new Set(["commander", "officer", "developer"]);
const CLEAR_ROLES = new Set(["commander", "developer"]);
const ukMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);
const ukParts = () => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));

type Cfg = { auto: boolean; keepMonths: number; mediaMonths: number; saveTxt: boolean; postTxt: boolean; postChannelId: string | null; lastCleanupMonth?: string };
async function settings(): Promise<Cfg> {
  const d = ((await TerminalDoc.findById("settings/audit", { data: 1 }).lean().catch(() => null))?.data ?? {}) as Record<string, any>;
  return {
    auto: d.auto !== false, keepMonths: [1, 3, 6, 12].includes(Number(d.keepMonths)) ? Number(d.keepMonths) : 3,
    mediaMonths: [1, 3].includes(Number(d.mediaMonths)) ? Number(d.mediaMonths) : d.mediaMonths === "same" ? 0 : 1,
    saveTxt: d.saveTxt !== false, postTxt: d.postTxt === true, postChannelId: typeof d.postChannelId === "string" ? d.postChannelId : null, lastCleanupMonth: d.lastCleanupMonth,
  };
}
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
const at = (x: Record<string, any>, ct?: Date | null) => String(x.createdAtISO || (x.createdAt instanceof Date ? x.createdAt.toISOString() : x.createdAt) || x.timestamp || ct?.toISOString() || "");
const src = (x: Record<string, any>) => (x.source === "discord" ? "DC " : x.source === "hub" ? "HUB" : "WEB");

function line(d: { data?: unknown; createTime?: Date | null }) {
  const x = (d.data ?? {}) as Record<string, any>;
  const t = at(x, d.createTime).replace("T", " ").slice(0, 16);
  const cat = String(x.cat || x.section || x.category || "other").toUpperCase().padEnd(11).slice(0, 11);
  let s = `${t}  ${src(x)}  ${cat}  ${String(x.action || "—").padEnd(16).slice(0, 16)}  ${String(x.by || x.operatorName || "—").padEnd(18).slice(0, 18)}  ${String(x.details ?? x.detail ?? "").replace(/\s+/g, " ")}`;
  if (x.before != null || x.after != null) s += `\n${" ".repeat(20)}BEFORE: ${String(x.before ?? "").replace(/\s+/g, " ")}\n${" ".repeat(20)}AFTER:  ${String(x.after ?? "").replace(/\s+/g, " ")}`;
  if (x.content) s += `\n${" ".repeat(20)}TEXT: ${String(x.content).replace(/\s+/g, " ")}`;
  if (Array.isArray(x.media)) for (const m of x.media) s += `\n${" ".repeat(20)}${String(m.kind || "file").toUpperCase()}: ${m.name} ${m.url}`;
  if (Array.isArray(x.bulk)) for (const b of x.bulk) s += `\n${" ".repeat(20)}${String(b.at).slice(11, 16)} ${b.author}: ${String(b.content || "").replace(/\s+/g, " ")}${(b.media || []).map((m: any) => ` [${m.kind} ${m.url}]`).join("")}`;
  return s;
}

type Scope = { source?: string; cat?: string; from?: string; to?: string; before?: Date };
function filter(s: Scope) {
  const q: Record<string, any> = { parent: { $in: COLLS }, "data.locked": { $ne: true } };
  if (s.source === "discord") q["data.source"] = "discord";
  else if (s.source === "hub") q["data.source"] = "hub";
  else if (s.source === "website") q["data.source"] = { $nin: ["discord", "hub"] };
  if (s.cat) q["data.cat"] = s.cat;
  const ct: Record<string, Date> = {};
  if (s.from) ct.$gte = new Date(s.from);
  if (s.to) ct.$lt = new Date(new Date(s.to).getTime() + DAY);
  if (s.before) ct.$lt = s.before;
  if (Object.keys(ct).length) q.createTime = ct;
  return q;
}

async function run(client: Client, o: { kind: "cleanup" | "clear"; by: string; reason?: string; scope: Scope; saveTxt: boolean; name: string; label: string }) {
  const cfg = await settings();
  const docs = await TerminalDoc.find(filter(o.scope), { data: 1, createTime: 1 }).sort({ createTime: 1 }).lean();
  let archiveId: string | null = null;
  if (docs.length && o.saveTxt) {
    const times = docs.map((d) => at(d.data as Record<string, any>, d.createTime)).filter(Boolean).sort();
    const counts = { web: 0, dc: 0, hub: 0 };
    docs.forEach((d) => { const s = src(d.data as Record<string, any>); s === "DC " ? counts.dc++ : s === "HUB" ? counts.hub++ : counts.web++; });
    const head = [
      "505th EXPEDITIONARY FORCE — AUDIT LOG ARCHIVE",
      `${o.label} · ${docs.length} entries · ${times[0]?.slice(0, 10) ?? "—"} to ${times.at(-1)?.slice(0, 10) ?? "—"}`,
      `Saved ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })} UK by ${o.by}${o.reason ? ` · reason: ${o.reason}` : ""}`,
      `Sources: Website ${counts.web} · Discord ${counts.dc} · Hub ${counts.hub}`,
      "-".repeat(100),
    ].join("\n");
    const text = head + "\n" + docs.map(line).join("\n") + "\n";
    archiveId = autoId();
    const now = new Date();
    await TerminalDoc.create({ _id: `audit_archives/${archiveId}`, parent: "audit_archives", docId: archiveId, createTime: now, updateTime: now,
      data: { name: o.name, kind: o.kind, label: o.label, reason: o.reason ?? null, count: docs.length, from: times[0] ?? null, to: times.at(-1) ?? null, by: o.by, bytes: Buffer.byteLength(text), text, createdAtISO: now.toISOString() } });
    if (cfg.postTxt && cfg.postChannelId) {
      const ch = await client.channels.fetch(cfg.postChannelId).catch(() => null);
      if (ch && "send" in ch) await ch.send({ content: `📁 **Audit Log archive** — ${o.label} · ${docs.length} entries`, files: [new AttachmentBuilder(Buffer.from(text), { name: o.name })], allowedMentions: { parse: [] } }).catch((e) => log.warn(`Archive post failed: ${(e as Error).message}`));
    }
  }
  // pictures / clips belonging to the removed entries
  const media = docs.flatMap((d) => { const x = d.data as Record<string, any>; return [...(x.media ?? []), ...((x.bulk ?? []) as any[]).flatMap((b) => b.media ?? [])]; });
  let gone = await destroyMedia(media);
  if (docs.length) await TerminalDoc.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  // older picture copies (kept shorter than entries)
  const mCut = o.kind === "cleanup" && cfg.mediaMonths ? monthsAgo(cfg.mediaMonths) : o.kind === "cleanup" ? o.scope.before : null;
  if (mCut) {
    const old = await TerminalDoc.find({ parent: "audit_media", createTime: { $lt: mCut } }, { data: 1 }).lean();
    gone += await destroyMedia(old.flatMap((d) => ((d.data as any)?.items ?? []) as any[]));
    if (old.length) await TerminalDoc.deleteMany({ _id: { $in: old.map((d) => d._id) } });
    await TerminalDoc.updateMany({ parent: "audit_logs", createTime: { $lt: mCut }, "data.media": { $ne: null } }, { $set: { "data.mediaRemoved": true, "data.media": null } });
  }
  const now = new Date();
  const id = autoId();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { source: "terminal", cat: "security", section: "security", action: o.kind === "clear" ? "LOG CLEARED" : "AUDIT CLEAN-UP", locked: true, by: o.by, role: "cortana", uid: null,
      details: `${docs.length} entries removed — ${o.label}${gone ? ` · ${gone} pictures/clips removed` : ""}${archiveId ? ` · saved to ${o.name}` : " · not saved"}${o.reason ? ` — "${o.reason}"` : ""}`, createdAt: now, createdAtISO: now.toISOString() } });
  await TerminalDoc.updateOne({ _id: "settings/audit" }, { $set: { updateTime: now, "data.lastCleanup": { at: now.toISOString(), by: o.by, kind: o.kind, count: docs.length, media: gone, archiveId, name: archiveId ? o.name : null } }, $setOnInsert: { parent: "settings", docId: "audit", createTime: now } }, { upsert: true });
  log.info(`Audit ${o.kind}: ${docs.length} removed`);
  return { removed: docs.length, media: gone, archiveId };
}

async function staff(uid: unknown, roles: Set<string>) {
  if (typeof uid !== "string" || !uid) return null;
  const d = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
  if (!d || d.suspended === true || !roles.has(String(d.role))) return null;
  return String(d.callsign || d.name || "Staff");
}

export function startAuditCleanup(client: Client<true>) {
  registerJob("audit.cleanup", async (job) => {
    const by = await staff(job.data.requestedBy, CLEAN_ROLES);
    if (!by) throw new PermanentJobError("Only Commander, Officer or Developer can run the clean-up");
    const cfg = await settings();
    const before = monthsAgo(cfg.keepMonths);
    return run(client, { kind: "cleanup", by, scope: { before }, saveTxt: cfg.saveTxt, name: `audit-manual-${new Date().toISOString().slice(0, 10)}.txt`, label: `Clean-up (run now) — older than ${cfg.keepMonths} month(s)` });
  });
  registerJob("audit.clear", async (job) => {
    const by = await staff(job.data.requestedBy, CLEAR_ROLES);
    if (!by) throw new PermanentJobError("Only Commander or Developer can clear the log");
    const p = (job.data.payload ?? {}) as Record<string, any>;
    const reason = String(p.reason ?? "").trim().slice(0, 300);
    if (reason.length < 3) throw new PermanentJobError("A reason is needed");
    const scope: Scope = {
      source: ["website", "discord", "hub"].includes(p.source) ? p.source : undefined,
      cat: /^[a-z]{2,20}$/.test(String(p.cat ?? "")) ? String(p.cat) : undefined,
      from: /^\d{4}-\d{2}-\d{2}$/.test(String(p.from ?? "")) ? String(p.from) : undefined,
      to: /^\d{4}-\d{2}-\d{2}$/.test(String(p.to ?? "")) ? String(p.to) : undefined,
    };
    const what = [scope.source && `source ${scope.source}`, scope.cat && `type ${scope.cat}`, scope.from && `from ${scope.from}`, scope.to && `to ${scope.to}`].filter(Boolean).join(", ") || "everything";
    return run(client, { kind: "clear", by, reason, scope, saveTxt: p.saveTxt !== false, name: `audit-cleared-${new Date().toISOString().slice(0, 10)}.txt`, label: `Cleared — ${what}` });
  });

  const tick = async () => {
    const p = ukParts();
    if (p.day !== "01" || Number(p.hour) * 60 + Number(p.minute) < 10) return;
    const cfg = await settings();
    const m = ukMonth();
    if (!cfg.auto || cfg.lastCleanupMonth === m) return;
    await TerminalDoc.updateOne({ _id: "settings/audit" }, { $set: { "data.lastCleanupMonth": m, updateTime: new Date() }, $setOnInsert: { parent: "settings", docId: "audit", createTime: new Date() } }, { upsert: true });
    const before = monthsAgo(cfg.keepMonths);
    await run(client, { kind: "cleanup", by: "Cortana", scope: { before }, saveTxt: cfg.saveTxt, name: `audit-${before.toISOString().slice(0, 7)}.txt`, label: `Monthly clean-up — older than ${cfg.keepMonths} month(s)` });
  };
  const t = setInterval(() => void tick().catch((e) => log.error("Audit clean-up failed", e)), 60_000);
  return () => clearInterval(t);
}
