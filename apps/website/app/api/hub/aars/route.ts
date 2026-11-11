import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Same lists and fields as the Terminal's aar.js. */
const UNITS: Record<string, string> = { alpha: "Alpha Company", forcerecon: "JTF-23 Force Recon", corpsman: "Hospital Corpsman", airwing: "54th Air Wing", combined: "Combined Arms" };
const RES: Record<string, string> = { success: "MISSION SUCCESS", partial: "PARTIAL SUCCESS", failure: "MISSION FAILURE" };
const OPS: Record<string, string> = { main_op: "Main Op", patrol: "Patrol", deployment: "Deployment", fun_op: "Fun Op" };
const CLS = ["CL-5", "CL-4", "CL-3", "CL-2", "CL-1"];
const TEXT = ["title", "commander", "filedBy", "author", "location", "mainObjective", "commanderIntent", "objectiveStandards", "plannedExecution", "unitsInvolved", "enemyFaction", "enemyCasualties", "enemyTactics", "enemyDisposition",
  "successfulManeuvers", "mistakes", "unexpected", "objectiveOutcome", "lessonsLearned", "recommended", "miscComments", "result", "unit"];
const REQUIRED: Record<string, string> = { title: "Operation name", date: "Date", opType: "Op type", unit: "Unit", commander: "Commander", actualExecution: "Actual execution", result: "Result" };
const filled = (v: unknown) => v != null && String(v).trim() !== "";
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const iso = (v: unknown) => { if (!v) return ""; const d = v instanceof Date ? v : new Date(String(v)); return isNaN(+d) ? "" : d.toISOString(); };

/** GET /api/hub/aars → all reports (drafts included, like the Terminal) + recent Attendance events for "fill from event". */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "aar")) return hubJson({ error: "You don't have AAR access." }, 403);
  const [docs, att] = await Promise.all([TerminalDoc.find({ parent: "aars" }, { docId: 1, data: 1 }).lean(), TerminalDoc.find({ parent: "attendance_events" }, { docId: 1, data: 1 }).lean()]);
  const reports = docs.map((d) => {
    const x = (d.data ?? {}) as U;
    return { id: d.docId, ...Object.fromEntries(TEXT.map((k) => [k, x[k] == null ? "" : String(x[k])])), operationType: x.operationType || "", classification: x.classification || "CL-5",
      summary: x.summary || x.actualExecution || "", personnel: x.personnel ?? null, casualties: x.casualties ?? 0, objectives: Array.isArray(x.objectives) ? x.objectives : [], attachments: Array.isArray(x.attachments) ? x.attachments : [],
      date: iso(x.date) || iso(x.submittedAt), status: x.status || "published", submittedByName: x.submittedByName || "", submittedAt: iso(x.submittedAt), updatedAt: x.updatedAt || "", updatedByName: x.updatedByName || "" };
  }).sort((p, q) => q.date.localeCompare(p.date));
  const events = att.map((d) => { const x = (d.data ?? {}) as U; return { id: d.docId, title: x.title || "Untitled", date: String(x.date || "").slice(0, 10), type: x.type || "", attendees: (x.attendees || []).length }; })
    .sort((p, q) => q.date.localeCompare(p.date)).slice(0, 25);
  return hubJson({ reports, events });
}

/**
 * POST /api/hub/aars — save (draft / changes), publish (needs every required field; Cortana posts it in Discord) or delete.
 * Same fields, statuses and Audit Log entries as the Terminal.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "aar")) return hubJson({ error: "You don't have AAR access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const now = new Date(), nowISO = now.toISOString();
  const id = b.id ? String(b.id) : null;
  if (id && !ID.test(id)) return hubJson({ error: "Invalid report." }, 400);
  const old = id ? ((await TerminalDoc.findById(`aars/${id}`, { data: 1 }).lean())?.data as U | undefined) : undefined;
  if (id && !old) return hubJson({ error: "Report not found." }, 404);

  if (b.action === "delete") {
    if (!id) return hubJson({ error: "Invalid report." }, 400);
    await TerminalDoc.deleteOne({ _id: `aars/${id}` });
    await hubAudit(who, "AAR DELETED", `${old!.title || id} — via app`);
    return hubJson({ ok: true, msg: "AAR deleted" });
  }
  if (b.action !== "save" && b.action !== "publish") return hubJson({ error: "Unknown action." }, 400);

  const v = (b.v ?? {}) as U;
  const publish = b.action === "publish";
  if (publish) {
    const miss = Object.entries(REQUIRED).filter(([k]) => !filled(v[k])).map(([, l]) => l);
    if (miss.length) return hubJson({ error: "Not ready to publish. Fill: " + miss.join(", ") }, 400);
  } else if (!filled(v.title)) return hubJson({ error: "Add an operation name first." }, 400);
  if (filled(v.unit) && !UNITS[v.unit]) return hubJson({ error: "Pick a unit." }, 400);
  if (filled(v.result) && !RES[v.result]) return hubJson({ error: "Pick a result." }, 400);
  if (filled(v.opType) && !OPS[v.opType]) return hubJson({ error: "Pick an op type." }, 400);
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(v.date ?? "")) ? String(v.date) : nowISO.slice(0, 10);
  const files = (Array.isArray(b.files) ? b.files : []).map(String).filter((u: string) => /^https:\/\/res\.cloudinary\.com\//.test(u)).slice(0, 10);
  const objectives = (Array.isArray(b.objectives) ? b.objectives : []).slice(0, 20).map((o: U) => ({ text: String(o.text ?? "").slice(0, 120), done: !!o.done })).filter((o: U) => o.text);
  const p: U = {
    ...Object.fromEntries(TEXT.map((k) => [k, String(v[k] ?? "").trim().slice(0, 4000)])),
    operationType: String(v.opType ?? ""), summary: String(v.actualExecution ?? "").trim().slice(0, 8000),
    personnel: v.personnel === "" || v.personnel == null ? null : Math.max(0, Math.min(500, parseInt(v.personnel, 10) || 0)), casualties: Math.max(0, Math.min(500, parseInt(v.casualties, 10) || 0)),
    classification: CLS.includes(v.classification) ? v.classification : "CL-5", objectives, attachments: files, date: new Date(dateStr + "T12:00:00"), updatedAt: nowISO, updatedByName: a.displayName,
  };
  const wasDraft = !old || old.status === "draft";
  p.status = publish || (old && old.status !== "draft") ? "published" : "draft";
  if (publish && wasDraft) Object.assign(p, { submittedBy: a.uid, submittedByName: a.displayName, submittedAt: nowISO });
  let rid = id;
  if (!rid) {
    rid = autoId();
    if (!publish) Object.assign(p, { submittedBy: a.uid, submittedByName: a.displayName });
    await TerminalDoc.create({ _id: `aars/${rid}`, parent: "aars", docId: rid, createTime: now, updateTime: now, data: p });
  } else {
    await TerminalDoc.updateOne({ _id: `aars/${rid}` }, { $set: { ...Object.fromEntries(Object.entries(p).map(([k, x]) => [`data.${k}`, x])), updateTime: now } });
  }
  if (publish && wasDraft) {
    await hubAudit(who, "AAR PUBLISHED", `${p.title} (${OPS[p.operationType] || p.operationType}) — ${UNITS[p.unit] || p.unit} — ${RES[p.result] || p.result} — via app`);
    const j = autoId();
    await TerminalDoc.create({ _id: `bot_jobs/${j}`, parent: "bot_jobs", docId: j, createTime: now, updateTime: now, data: { type: "aar.post", payload: { aarId: rid }, createdAtISO: nowISO } }).catch(() => {});
    return hubJson({ ok: true, id: rid, status: "published", msg: "AAR published" });
  }
  if (!b.quiet && p.status !== "draft") await hubAudit(who, "AAR EDITED", `${p.title} — via app`);
  return hubJson({ ok: true, id: rid, status: p.status, savedAt: nowISO, msg: p.status === "draft" ? "Draft saved" : "Changes saved" });
}
