import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { AUDIT_DELETE_ROLES, can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";
import { AUDIT_COLLS, CLEAR_ROLES, auditDelete, AuditError, hidePrivate, normalise } from "@/lib/terminal/audit-core";

/**
 * AUDIT LOG v3
 * GET                   → { entries, settings, lastCleanup, canClean, canClear, canSettings }   (newest first, max 5000)
 * GET ?archives=1       → { archives: [{ id, name, label, count, from, to, by, bytes, createdAtISO }] }
 * GET ?archive={id}     → the .txt file (download)
 * Clean-up and Clear are done by Cortana (jobs "audit.cleanup" / "audit.clear") — they also remove picture copies.
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const COLLS = AUDIT_COLLS;

async function actorOr(): Promise<Awaited<ReturnType<typeof getActor>> | Response> {
  try {
    return await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

export async function GET(req: NextRequest) {
  const actor = await actorOr();
  if (actor instanceof Response) return actor;
  if (!can(actor.role, actor.access, "audit")) return json({ error: "permission-denied" }, 403);
  const sp = req.nextUrl.searchParams;

  const archive = sp.get("archive");
  if (archive) {
    if (!/^[A-Za-z0-9_\-]{1,60}$/.test(archive)) return json({ error: "Bad id" }, 400);
    const a = (await TerminalDoc.findById(`audit_archives/${archive}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
    if (!a) return json({ error: "Not found" }, 404);
    const name = String(a.name || "audit.txt").replace(/[^\w.\-]/g, "_");
    return new NextResponse(String(a.text ?? ""), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
  }
  if (sp.get("archives")) {
    const docs = (await TerminalDoc.find({ parent: "audit_archives" }, { docId: 1, "data.name": 1, "data.label": 1, "data.kind": 1, "data.reason": 1, "data.count": 1, "data.from": 1, "data.to": 1, "data.by": 1, "data.bytes": 1, "data.createdAtISO": 1 }).sort({ createTime: -1 }).limit(500).lean()) as { docId: string; data?: Record<string, unknown> }[];
    return json({ archives: docs.map((d) => ({ id: d.docId, ...(d.data ?? {}) })) });
  }

  // ?days=1|7|30 → only those days, filtered in the database (was always 5000 rows). No ?days / 9999 = everything (old pages).
  const dd = Number(sp.get("days") ?? 9999);
  const since = dd > 0 && dd < 9999 ? { createTime: { $gte: new Date(Date.now() - Math.min(dd, 366) * 864e5) } } : {};
  const docs = await TerminalDoc.find({ parent: { $in: COLLS }, ...since }, { parent: 1, docId: 1, data: 1, createTime: 1 }).sort({ createTime: -1 }).limit(5000).lean();
  const ms = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  // Discord message text, pictures and edits are private: Officer and above only.
  const entries = docs.map(normalise).sort((a, b) => ms(b.at) - ms(a.at)).map((e) => hidePrivate(e, actor.role));
  const s = ((await TerminalDoc.findById("settings/audit", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
  const { lastCleanup, lastPurgeISO: _old, retentionDays: _r, ...settings } = s;
  return json({
    entries, settings, lastCleanup: lastCleanup ?? null,
    canClean: AUDIT_DELETE_ROLES.has(actor.role), canClear: CLEAR_ROLES.has(actor.role), canSettings: can(actor.role, actor.access, "set") && AUDIT_DELETE_ROLES.has(actor.role),
  });
}

/** POST { action: "delete", ids, reason } — "Delete selected" (Commander / Developer). Archive first, locked record left. */
export async function POST(req: NextRequest) {
  const actor = await actorOr();
  if (actor instanceof Response) return actor;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || b.action !== "delete") return json({ error: "Bad request" }, 400);
  try {
    return json(await auditDelete({ uid: actor.uid, role: actor.role, access: (actor.access ?? {}) as Record<string, unknown>, displayName: actor.displayName }, b.ids, b.reason));
  } catch (e) {
    return e instanceof AuditError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong" }, 500);
  }
}
