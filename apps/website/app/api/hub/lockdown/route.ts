import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
/**
 * COMMAND CENTRE → MODERATION → DISCORD LOCKDOWN in the app (approved mock 19 Nov). Commander / Developer or Kick-Ban access ("modk").
 * GET → current lockdown (lockdown/current, without the saved permission snapshot) + public channels + history.
 * POST { action: start | lift | extend | upgrade, … } → Cortana job (Cortana re-checks access and does the Discord work).
 */
type U = Record<string, any>;
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const ok = (a: { role: string; access: unknown }) => a.role === "commander" || a.role === "developer" || can(a.role, a.access, "modk");
async function job(uid: string, type: string, payload: U, ms = 12000) {
  const id = id20(), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type, payload, status: "pending", attempts: 0, requestedBy: uid, createdAtISO: now.toISOString() } });
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1000));
    const d = (await TerminalDoc.findById(`bot_jobs/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (d?.status === "failed") return { error: String(d.error || "Cortana could not do it") };
    if (d?.status === "done") return { done: true, result: d.result ?? {} };
  }
  return { queued: true };
}

export async function GET(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!ok(a)) return hubJson({ error: "You don't have access to Discord Lockdown." }, 403);
  const [cur, chans, hist, bot] = await Promise.all([
    TerminalDoc.findById("lockdown/current", { data: 1 }).lean(),
    TerminalDoc.find({ parent: "discord_channels" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "lockdown_history" }, { docId: 1, data: 1 }).sort({ "data.startedAtISO": -1 }).limit(15).lean(),
    TerminalDoc.findById("bot_status/cortana", { "data.lastHeartbeatISO": 1, "data.online": 1 }).lean(),
  ]);
  const c = ((cur?.data ?? {}) as U), b = ((bot?.data ?? {}) as U);
  const { saved, ...rest } = c;
  return hubJson({
    current: c.active ? { ...rest, channels: Array.isArray(saved) ? saved.length : 0, channelNames: Array.isArray(saved) ? saved.map((s: U) => s.name).slice(0, 60) : [] } : null,
    channels: (chans as U[]).map((x): U => ({ id: String(x.docId), ...((x.data ?? {}) as U) })).filter((x) => ["text", "announcement", "voice", "stage", "forum"].includes(String(x.type)) && x.isPublic !== false)
      .map((x) => ({ id: x.id, name: String(x.name ?? ""), type: String(x.type), parentName: String(x.parentName ?? "") })).sort((p, q) => (p.parentName + p.name).localeCompare(q.parentName + q.name)),
    history: (hist as U[]).map((h) => ({ id: String(h.docId), ...((h.data ?? {}) as U) })),
    cortanaOnline: b.online !== false && Date.now() - (Date.parse(String(b.lastHeartbeatISO ?? "")) || 0) < 90_000,
  });
}

export async function POST(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!ok(a)) return hubJson({ error: "You don't have access to Discord Lockdown." }, 403);
  const b = (await req.json().catch(() => null)) as U | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  let r: U;
  if (b.action === "start") {
    const level = ["slow", "lock", "full"].includes(b.level) ? b.level : "";
    if (!level) return hubJson({ error: "Pick a level." }, 400);
    const reason = String(b.reason ?? "").trim().slice(0, 300);
    if (reason.length < 3) return hubJson({ error: "A reason is required." }, 400);
    if (level === "full" && String(b.confirm ?? "").toUpperCase() !== "LOCKDOWN") return hubJson({ error: "Type LOCKDOWN to confirm." }, 400);
    const channelIds = Array.isArray(b.channelIds) ? b.channelIds.map(String).filter((x: string) => /^\d{17,20}$/.test(x)).slice(0, 200) : [];
    r = await job(a.uid, "lockdown.start", { level, slowSec: Number(b.slowSec) || 30, invites: !!b.invites, minutes: Math.max(0, Math.min(1440, Number(b.minutes) || 0)), reason, channelIds,
      announce: !!b.announce, notice: String(b.notice ?? "").slice(0, 500), alertStaff: b.alertStaff !== false }, 25000);
  } else if (b.action === "lift") r = await job(a.uid, "lockdown.lift", {}, 25000);
  else if (b.action === "extend") r = await job(a.uid, "lockdown.extend", { minutes: Number(b.minutes) || 15 });
  else if (b.action === "upgrade") r = await job(a.uid, "lockdown.upgrade", {}, 25000);
  else return hubJson({ error: "Bad request." }, 400);
  if (r.error) return hubJson({ error: r.error }, 400);
  return hubJson({ ok: true, queued: !!r.queued, result: r.result ?? null });
}
