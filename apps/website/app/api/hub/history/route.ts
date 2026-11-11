import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { historySources, snapshotMonth, ukMonth } from "@/lib/hub/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type U = Record<string, any>;

/** GET /api/hub/history → monthly Attendance History records + past months with locked events but no record. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "att")) return hubJson({ error: "You don't have Attendance access." }, 403);
  const [docs, ev] = await Promise.all([TerminalDoc.find({ parent: "attendance_history" }, { docId: 1, data: 1 }).lean(), TerminalDoc.find({ parent: "attendance_events", "data.locked": true }, { data: 1 }).lean()]);
  const months = docs.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U).sort((x, y) => String(y.id).localeCompare(String(x.id)))
    .map((m) => ({ id: m.id, totalOps: m.totalOps || 0, memberCount: m.memberCount || 0, snapshotAt: m.snapshotAt || "", savedBy: m.savedBy || "", rebuiltAt: m.rebuiltAt || "", lateUpdate: m.lateUpdate || null,
      members: (m.members || []).map((x: U) => ({ uid: x.uid, name: x.name, rank: x.rank, platoon: x.platoon, attended: x.attended || 0, eligible: x.eligible || 0, missed: x.missed || 0, rate: x.rate || 0 })) }));
  const have = new Set(months.map((m) => m.id)), cur = ukMonth();
  const missing = [...new Set(ev.map((d) => String(((d.data ?? {}) as U).date || "").slice(0, 7)))].filter((m) => /^\d{4}-\d{2}$/.test(m) && m < cur && !have.has(m)).sort();
  return hubJson({ months, missing, current: cur });
}

/** POST /api/hub/history { action: rebuild | snapshot | backfill, month? } — same tools as the Terminal's ⋯ MORE / ↻ REBUILD. */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "att")) return hubJson({ error: "You don't have Attendance access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const src = await historySources();
  if (b.action === "rebuild") {
    const m = String(b.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(m)) return hubJson({ error: "Pick a month." }, 400);
    await snapshotMonth(m, { rebuiltAt: new Date().toISOString() }, src);
    await hubAudit(who, "ATTENDANCE HISTORY REBUILT", `${m} — via app`);
    return hubJson({ ok: true, msg: `${m} rebuilt from its locked events` });
  }
  if (b.action === "snapshot") {
    const m = ukMonth();
    await snapshotMonth(m, {}, src);
    await hubAudit(who, "ATTENDANCE SNAPSHOT", `${m} — via app`);
    return hubJson({ ok: true, msg: `Attendance snapshot saved for ${m}` });
  }
  if (b.action === "backfill") {
    const have = new Set((await TerminalDoc.find({ parent: "attendance_history" }, { docId: 1 }).lean()).map((d) => d.docId));
    const missing = [...new Set(src.events.filter((e) => e.date).map((e) => String(e.date).slice(0, 7)))].filter((m) => /^\d{4}-\d{2}$/.test(m) && !have.has(m)).sort();
    if (!missing.length) return hubJson({ ok: true, msg: "All months already have records — nothing to backfill" });
    for (const m of missing) await snapshotMonth(m, { rebuiltAt: new Date().toISOString() }, src);
    await hubAudit(who, "ATTENDANCE HISTORY BACKFILLED", `${missing.join(", ")} — via app`);
    return hubJson({ ok: true, msg: `Built ${missing.length} month${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}` });
  }
  return hubJson({ error: "Unknown action." }, 400);
}
