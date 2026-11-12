import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { can, roleLevel } from "@/lib/terminal/access";

/**
 * NETWORK STATUS v2 (approved mock 2026-11-12) — read side for the website page, the Hub page and both dashboard widgets.
 * Data is written by Cortana every 60 s (apps/cortana/src/monitors.ts): net_monitors · net_status · net_days · net_events.
 * View: access "net". Add / edit / pause / mute / delete: Developer + Commander.
 */
type U = Record<string, any>;
export type Who = { uid: string; name: string; role: string; access: unknown; source: "hub" | "terminal" };
export class NetError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const STALE_MS = 3 * 60_000; // no check for 3 min = Cortana isn't checking
const ukDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const canEdit = (w: Who) => roleLevel(w.role) >= 4.5;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
type Beat = [number, number, number]; // [epochMinute, ms | -1, 0 up · 1 slow · 2 down]

/** Day records → beats with real epoch minutes (minuteOfDay is UK time). */
function dayBeats(day: string, b: [number, number, number][]): Beat[] {
  const noonUTC = Date.parse(`${day}T12:00:00Z`);
  const ukNoon = new Date(noonUTC).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" });
  const off = Number(ukNoon) - 12; // 0 in winter, 1 in summer
  const start = Date.parse(`${day}T00:00:00Z`) / 60000 - off * 60;
  return (b ?? []).map(([m, ms, s]) => [start + m, ms, s]);
}
const pct = (bs: Beat[]) => (bs.length ? Math.round((bs.filter((x) => x[2] !== 2).length / bs.length) * 10000) / 100 : null);
const avg = (bs: Beat[]) => { const v = bs.filter((x) => x[1] >= 0).map((x) => x[1]); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

async function days(mon: string | null, n: number) {
  const since = ukDay(new Date(Date.now() - n * 864e5));
  const q: U = { parent: "net_days", "data.day": { $gte: since } };
  if (mon) q["data.mon"] = mon;
  const docs = await TerminalDoc.find(q, { data: 1 }).lean();
  const by = new Map<string, Beat[]>();
  for (const d of docs) { const x = (d.data ?? {}) as U; const arr = by.get(x.mon) ?? []; arr.push(...dayBeats(x.day, x.b)); by.set(x.mon, arr); }
  for (const a of by.values()) a.sort((p, q2) => p[0] - q2[0]);
  return by;
}

/** List: every monitor with its live status, last 90 beats and 24 h / 30 d uptime. */
export async function overview(w: Who) {
  if (!can(w.role, w.access, "net")) throw new NetError("You don't have Network Status access.", 403);
  const [mons, sts, hist] = await Promise.all([
    TerminalDoc.find({ parent: "net_monitors" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "net_status" }, { docId: 1, data: 1 }).lean(),
    days(null, 30),
  ]);
  const st = new Map(sts.map((s) => [String(s.docId), (s.data ?? {}) as U]));
  const now = Date.now(), nowMin = Math.floor(now / 60000);
  const list = mons.map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((m) => {
    const s = st.get(m.id) ?? {};
    const h = hist.get(m.id) ?? [];
    const stale = !m.paused && (!s.checkedAtISO || now - Date.parse(s.checkedAtISO) > STALE_MS);
    const status = m.paused ? "paused" : stale ? "stale" : s.status || "pending";
    return { id: m.id, name: m.name, group: m.group || "OTHER", type: m.type, target: m.type === "http" || m.type === "game" ? m.target || "" : "", builtin: !!m.builtin, third: !!m.third,
      paused: !!m.paused, muted: !!m.muted, slowMs: m.slowMs ?? null, status, ms: s.ms ?? null, info: s.info || "", error: s.error || "", checkedAtISO: s.checkedAtISO || "",
      downSinceISO: s.downSinceISO || "", certValidToISO: s.certValidToISO || "", last: (Array.isArray(s.last) ? s.last : []) as Beat[],
      up24: pct(h.filter((x) => x[0] > nowMin - 1440)), up30: pct(h), avg24: avg(h.filter((x) => x[0] > nowMin - 1440)) };
  });
  const lastCheck = list.reduce((a, m) => (m.checkedAtISO > a ? m.checkedAtISO : a), "");
  return { canEdit: canEdit(w), cortanaChecking: !!lastCheck && now - Date.parse(lastCheck) < STALE_MS, lastCheckISO: lastCheck, monitors: list };
}

const RANGES: Record<string, number> = { "1H": 60, "24H": 1440, "7D": 10080, "30D": 43200, "90D": 129600 };
/** One monitor: chart points for a range (down-sampled to ≤ 360 points) + incidents. */
export async function detail(w: Who, id: string, range: string) {
  if (!can(w.role, w.access, "net")) throw new NetError("You don't have Network Status access.", 403);
  if (!ID.test(id)) throw new NetError("Bad request.");
  const mins = RANGES[range] ?? 1440, nowMin = Math.floor(Date.now() / 60000);
  const h = ((await days(id, Math.ceil(mins / 1440) + 1)).get(id) ?? []).filter((x) => x[0] > nowMin - mins);
  const step = Math.max(1, Math.ceil(mins / 360));
  const pts: Beat[] = [];
  if (step === 1) pts.push(...h);
  else {
    const buckets = new Map<number, Beat[]>();
    for (const b of h) { const k = Math.floor(b[0] / step) * step; (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(b); }
    for (const [k, bs] of [...buckets].sort((a, b) => a[0] - b[0])) pts.push([k, avg(bs) ?? -1, bs.some((x) => x[2] === 2) ? 2 : bs.some((x) => x[2] === 1) ? 1 : 0]);
  }
  const ev = await TerminalDoc.find({ parent: "net_events", "data.mon": id }, { docId: 1, data: 1 }).sort({ "data.startedAtISO": -1 }).limit(30).lean();
  return { range, step, points: pts, uptime: pct(h), avg: avg(h),
    incidents: ev.map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U).map((e) => ({ id: e.id, startedAtISO: e.startedAtISO, endedAtISO: e.endedAtISO, error: e.error || "", note: e.note || "" })) };
}

async function audit(w: Who, action: string, details: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "security", action, details, uid: w.uid, by: w.name, role: w.role, source: w.source, createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}

/** Actions: check · pause · mute · edit · add · delete · note. */
export async function act(w: Who, b: U) {
  if (!can(w.role, w.access, "net")) throw new NetError("You don't have Network Status access.", 403);
  const now = new Date();
  if (b.action === "check") {
    const id = autoId();
    await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type: "net.check", payload: {}, status: "pending", attempts: 0, requestedBy: w.uid, createdAtISO: now.toISOString() } });
    return { ok: true, msg: "Checking now — results in a few seconds" };
  }
  if (b.action === "note") {
    const id = String(b.incidentId ?? "");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new NetError("Bad request.");
    await TerminalDoc.updateOne({ _id: `net_events/${id}` }, { $set: { "data.note": String(b.note ?? "").trim().slice(0, 300), "data.noteBy": w.name, updateTime: now } });
    return { ok: true, msg: "Note saved" };
  }
  if (!canEdit(w)) throw new NetError("Only the Developer or Commander can change monitors.", 403);
  if (b.action === "add") {
    const type = b.type === "game" ? "game" : "http";
    const name = String(b.name ?? "").trim().slice(0, 50), target = String(b.target ?? "").trim().slice(0, 200);
    if (!name) throw new NetError("Give it a name.");
    if (type === "http" && !/^https:\/\/\S+$/.test(target)) throw new NetError("Address must start with https://");
    if (type === "game" && !/^[\w.-]+:\d{2,5}$/.test(target)) throw new NetError("Game server address: host:queryPort (game port + 1).");
    const id = `m${autoId().slice(0, 10)}`;
    await TerminalDoc.create({ _id: `net_monitors/${id}`, parent: "net_monitors", docId: id, createTime: now, updateTime: now,
      data: { name, group: type === "game" ? "GAME" : "CUSTOM", type, target, order: 50, slowMs: Number(b.slowMs) > 0 ? Math.min(30000, Number(b.slowMs)) : 2500 } });
    await audit(w, "MONITOR ADDED", `${name} (${target}) — via ${w.source}`);
    return { ok: true, id, msg: "Monitor added — first check within a minute" };
  }
  const id = String(b.id ?? "");
  if (!ID.test(id)) throw new NetError("Bad request.");
  const m = (await TerminalDoc.findById(`net_monitors/${id}`, { data: 1 }).lean())?.data as U | undefined;
  if (!m) throw new NetError("Monitor not found.", 404);
  const set = (x: U) => TerminalDoc.updateOne({ _id: `net_monitors/${id}` }, { $set: { ...Object.fromEntries(Object.entries(x).map(([k, v]) => [`data.${k}`, v])), updateTime: now } });
  switch (b.action) {
    case "pause": await set({ paused: !!b.on }); await audit(w, b.on ? "MONITOR PAUSED" : "MONITOR RESUMED", `${m.name} — via ${w.source}`); return { ok: true, msg: b.on ? "Paused" : "Resumed" };
    case "mute": await set({ muted: !!b.on }); await audit(w, b.on ? "MONITOR ALERTS MUTED" : "MONITOR ALERTS ON", `${m.name} — via ${w.source}`); return { ok: true, msg: b.on ? "Alerts muted" : "Alerts on" };
    case "edit": {
      const x: U = {};
      if (typeof b.name === "string" && b.name.trim()) x.name = b.name.trim().slice(0, 50);
      if (Number(b.slowMs) > 0) x.slowMs = Math.min(30000, Number(b.slowMs));
      if (typeof b.target === "string" && (m.type === "http" || m.type === "game")) {
        const t = b.target.trim();
        if (m.type === "http" && !/^https:\/\/\S+$/.test(t)) throw new NetError("Address must start with https://");
        if (m.type === "game" && t && !/^[\w.-]+:\d{2,5}$/.test(t)) throw new NetError("Game server address: host:queryPort (game port + 1).");
        x.target = t;
      }
      await set(x); await audit(w, "MONITOR EDITED", `${m.name} — via ${w.source}`);
      return { ok: true, msg: "Saved" };
    }
    case "delete": {
      if (m.builtin) throw new NetError("Built-in monitors can be paused, not deleted.");
      await TerminalDoc.deleteOne({ _id: `net_monitors/${id}` });
      await TerminalDoc.deleteMany({ $or: [{ _id: `net_status/${id}` }, { parent: "net_days", "data.mon": id }, { parent: "net_events", "data.mon": id }] });
      await audit(w, "MONITOR DELETED", `${m.name} — via ${w.source}`);
      return { ok: true, msg: "Monitor deleted" };
    }
    default: throw new NetError("Unknown action.");
  }
}
