import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
/**
 * STATUS → UNIT STATUS in the app (same as the website COMMAND → Unit Status). Access "cmd_status".
 * GET → unit_config/status (+ last 25 changes). POST { opStatus, statusMessage, recruitmentOpen, alert, discord }.
 */
const OPS = ["Active", "Stand Down", "On Op", "Training Cycle", "Maintenance"];
const STAFF = ["commander", "officer", "developer", "staff_nco", "nco", "recruiter"];
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
type U = Record<string, any>;
const mk = (parent: string, data: U) => { const id = id20(), now = new Date(); return { _id: `${parent}/${id}`, parent, docId: id, createTime: now, updateTime: now, data }; };

export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "cmd_status")) return hubJson({ error: "You don't have access to this page." }, 403);
  const s = ((await TerminalDoc.findById("unit_config/status", { data: 1 }).lean())?.data ?? {}) as U;
  return hubJson({ opStatus: s.opStatus || "Active", statusMessage: String(s.statusMessage ?? ""), recruitmentOpen: s.recruitmentOpen !== false, updatedByName: s.updatedByName ?? "", updatedAtISO: s.updatedAtISO ?? null,
    history: (Array.isArray(s.history) ? s.history : []).slice(-25).reverse().map((h: U) => ({ opStatus: String(h.opStatus ?? ""), statusMessage: String(h.statusMessage ?? ""), recruitmentOpen: h.recruitmentOpen !== false, by: String(h.by ?? h.updatedByName ?? ""), at: String(h.at ?? h.updatedAtISO ?? "") })) });
}

export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "cmd_status")) return hubJson({ error: "You don't have access to this page." }, 403);
  const b = (await req.json().catch(() => null)) as U | null;
  if (!b || !OPS.includes(b.opStatus)) return hubJson({ error: "Pick a status." }, 400);
  const msg = String(b.statusMessage ?? "").trim().slice(0, 300), now = new Date().toISOString();
  const rec = { opStatus: b.opStatus, statusMessage: msg, recruitmentOpen: b.recruitmentOpen !== false, updatedBy: a.uid, updatedByName: a.displayName, updatedAtISO: now };
  const old = ((await TerminalDoc.findById("unit_config/status", { data: 1 }).lean())?.data ?? {}) as U;
  const history = [...(Array.isArray(old.history) ? old.history : []), { ...rec, by: rec.updatedByName, at: now }].slice(-25);
  const set: U = { updateTime: new Date(), "data.history": history };
  for (const [k, v] of Object.entries(rec)) set[`data.${k}`] = v;
  await TerminalDoc.updateOne({ _id: "unit_config/status" }, { $set: set, $setOnInsert: { parent: "unit_config", docId: "status", createTime: new Date() } }, { upsert: true });
  const line = `${rec.opStatus}${msg ? " — " + msg : ""}`;
  await TerminalDoc.create(mk("audit_logs", { section: "command", action: "UNIT STATUS UPDATED", details: `${line} · recruitment ${rec.recruitmentOpen ? "open" : "closed"}`, uid: a.uid, by: a.displayName, role: a.role, source: "hub", createdAt: new Date(), createdAtISO: now })).catch(() => {});
  if (b.alert) {
    const staff = await TerminalDoc.find({ parent: "users", "data.role": { $in: STAFF } }, { docId: 1 }).lean();
    const docs = staff.map((u) => { const n = mk(`notifications/${u.docId}/items`, { type: "warning", title: "COMMAND STATUS UPDATE", body: `${line} · ${a.displayName}`, read: false, createdAt: new Date() }); return n; });
    if (docs.length) await TerminalDoc.insertMany(docs, { ordered: false }).catch(() => {});
  }
  if (b.discord) await TerminalDoc.create(mk("bot_jobs", { type: "message.send", payload: { channel: "announcements", content: `**Unit status: ${rec.opStatus}**${msg ? "\n" + msg : ""}` }, status: "pending", attempts: 0, requestedBy: a.uid, createdAtISO: now }));
  return hubJson({ ok: true });
}
