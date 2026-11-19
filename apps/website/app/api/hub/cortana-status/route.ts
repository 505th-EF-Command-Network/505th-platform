import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
/**
 * COMMAND CENTRE → SETTINGS → CORTANA STATUS in the app (approved mock 18 Nov). Access "set".
 * GET → health (bot_status/cortana), Discord status line (settings/cortana), last 15 jobs.
 * POST { activityType, activityText } → settings/cortana (Cortana updates its Discord status within seconds).
 */
type U = Record<string, any>;
const TYPES = ["watching", "playing", "listening", "competing"];
const data = async (id: string) => ((await TerminalDoc.findById(id, { data: 1 }).lean())?.data ?? {}) as U;

export async function GET(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "set")) return hubJson({ error: "You don't have access to this page." }, 403);
  const [b, c, jobs] = await Promise.all([data("bot_status/cortana"), data("settings/cortana"),
    TerminalDoc.find({ parent: "bot_jobs" }, { docId: 1, "data.type": 1, "data.status": 1, "data.error": 1, "data.createdAtISO": 1 }).sort({ "data.createdAtISO": -1 }).limit(15).lean()]);
  const seen = Date.parse(String(b.lastHeartbeatISO ?? "")) || 0;
  return hubJson({
    online: b.online !== false && !b.shutdown && Date.now() - seen < 90_000, lastHeartbeatISO: b.lastHeartbeatISO ?? "", startedAtISO: b.startedAtISO ?? "",
    pingMs: b.pingMs ?? null, jobsQueued: b.jobsQueued ?? 0, errors24h: b.errors24h ?? 0, missingPerms: Array.isArray(b.missingPerms) ? b.missingPerms : [],
    intents: b.intents ?? {}, botTag: b.botTag ?? "Cortana", avatarUrl: b.avatarUrl ?? "", guildName: b.guildName ?? "", memberCount: b.memberCount ?? null, version: b.version ?? "",
    activityType: TYPES.includes(c.activityType) ? c.activityType : "watching", activityText: String(c.activityText || "the 505th Deployment"),
    jobs: (jobs as U[]).map((j) => { const d = (j.data ?? {}) as U; return { id: String(j.docId), type: String(d.type ?? ""), status: String(d.status ?? ""), error: String(d.error ?? "").slice(0, 200), atISO: String(d.createdAtISO ?? "") }; }),
  });
}

export async function POST(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "set")) return hubJson({ error: "You don't have access to this page." }, 403);
  const b = (await req.json().catch(() => null)) as U | null;
  const type = String(b?.activityType ?? ""), text = String(b?.activityText ?? "").trim().slice(0, 128);
  if (!TYPES.includes(type)) return hubJson({ error: "Pick Watching, Playing, Listening to or Competing in." }, 400);
  if (!text) return hubJson({ error: "Write the status text." }, 400);
  const now = new Date();
  await TerminalDoc.updateOne({ _id: "settings/cortana" }, { $set: { "data.activityType": type, "data.activityText": text, updateTime: now }, $setOnInsert: { parent: "settings", docId: "cortana", createTime: now } }, { upsert: true });
  const id = Array.from(randomBytes(20), (x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[x % 62]).join("");
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "discord", action: "CORTANA STATUS LINE CHANGED", details: `${type} ${text}`, uid: a.uid, by: a.displayName, role: a.role, source: "hub", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
  return hubJson({ ok: true });
}
