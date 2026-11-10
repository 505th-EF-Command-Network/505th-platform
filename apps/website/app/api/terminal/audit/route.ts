import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { AUDIT_DELETE_ROLES, can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const COLLS = ["audit_logs", "audit_log"]; // new format + the original Command Panel's format
const DAY = 86400000;
const LOCKED_KEEP_DAYS = 365;

async function actorOr(): Promise<Awaited<ReturnType<typeof getActor>> | Response> {
  try {
    return await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
};

/** Both audit formats → one shape. */
function normalise(d: { _id: string; data?: unknown; createTime?: Date | null }) {
  const x = (d.data ?? {}) as Record<string, any>;
  return {
    id: d._id,
    at: iso(x.createdAt) || x.createdAtISO || iso(x.timestamp) || iso(d.createTime) || null,
    section: String(x.section || x.category || "other").toLowerCase(),
    action: String(x.action || "—"),
    details: String(x.details ?? x.detail ?? ""),
    by: String(x.by || x.operatorName || "—"),
    role: String(x.role || ""),
    locked: x.locked === true,
    source: x.source === "discord" ? "discord" : "terminal",
  };
}

/** Delete entries older than the retention setting, at most once a day. */
async function purge() {
  const s = await TerminalDoc.findById("settings/audit", { data: 1 }).lean();
  const cfg = (s?.data ?? {}) as Record<string, any>;
  const days = Number.isFinite(cfg.retentionDays) ? Number(cfg.retentionDays) : 90;
  if (cfg.lastPurgeISO && Date.now() - Date.parse(cfg.lastPurgeISO) < DAY) return;
  const now = new Date();
  if (days > 0) {
    const cut = new Date(Date.now() - days * DAY);
    const lockedCut = new Date(Date.now() - LOCKED_KEEP_DAYS * DAY);
    await TerminalDoc.deleteMany({
      parent: { $in: COLLS },
      $or: [
        { "data.locked": { $ne: true }, createTime: { $lt: cut } },
        { "data.locked": true, createTime: { $lt: lockedCut } },
      ],
    });
  }
  await TerminalDoc.updateOne(
    { _id: "settings/audit" },
    { $set: { "data.lastPurgeISO": now.toISOString(), updateTime: now }, $setOnInsert: { parent: "settings", docId: "audit", createTime: now } },
    { upsert: true },
  );
}

/** GET → { entries, canDelete, retentionDays } (newest first, max 3000). */
export async function GET() {
  const actor = await actorOr();
  if (actor instanceof Response) return actor;
  if (!can(actor.role, actor.access, "audit")) return json({ error: "permission-denied" }, 403);
  await purge();
  const docs = await TerminalDoc.find({ parent: { $in: COLLS } }, { parent: 1, docId: 1, data: 1, createTime: 1 }).sort({ createTime: -1 }).limit(3000).lean();
  const ms = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  const entries = docs.map(normalise).sort((a, b) => ms(b.at) - ms(a.at));
  const s = await TerminalDoc.findById("settings/audit", { data: 1 }).lean();
  const retentionDays = Number((s?.data as any)?.retentionDays ?? 90);
  return json({ entries, canDelete: AUDIT_DELETE_ROLES.has(actor.role), canRetention: can(actor.role, actor.access, "set"), retentionDays });
}

/** POST { ids, reason } → deletes them and adds ONE locked "ENTRIES DELETED" record. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const actor = await actorOr();
  if (actor instanceof Response) return actor;
  if (!can(actor.role, actor.access, "audit") || !AUDIT_DELETE_ROLES.has(actor.role)) return json({ error: "Only Commander, Officer or Developer can delete audit entries" }, 403);

  let ids: string[], reason: string;
  try {
    const b = await req.json();
    ids = b?.ids;
    reason = String(b?.reason ?? "").trim().slice(0, 300);
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || reason.length < 3) throw new Error();
    if (!ids.every((i) => typeof i === "string" && /^(audit_logs|audit_log)\/[A-Za-z0-9_\-]{1,200}$/.test(i))) throw new Error();
  } catch {
    return json({ error: "Pick entries and give a reason (3+ characters)" }, 400);
  }
  const docs = await TerminalDoc.find({ _id: { $in: ids } }, { data: 1, createTime: 1 }).lean();
  if (docs.some((d) => (d.data as any)?.locked === true)) return json({ error: "Deletion records are locked and can't be deleted" }, 403);
  if (!docs.length) return json({ error: "Nothing to delete" }, 404);

  const dates = docs.map((d) => normalise(d).at).filter(Boolean).sort() as string[];
  const f = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  await TerminalDoc.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  const now = new Date();
  const id = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await TerminalDoc.create({
    _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: {
      section: "security", action: "ENTRIES DELETED", locked: true,
      details: `${docs.length} audit entr${docs.length === 1 ? "y" : "ies"} deleted${dates.length ? ` (${f(dates[0]!)}${dates.length > 1 ? ` – ${f(dates.at(-1)!)}` : ""})` : ""} — "${reason}"`,
      uid: actor.uid, by: actor.displayName, role: actor.role, createdAt: now, createdAtISO: now.toISOString(),
    },
  });
  return json({ ok: true, deleted: docs.length });
}
