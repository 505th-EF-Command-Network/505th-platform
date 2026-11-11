import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { AUDIT_DELETE_ROLES, can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";

/**
 * AUDIT LOG v3
 * GET                   → { entries, settings, lastCleanup, canClean, canClear, canSettings }   (newest first, max 5000)
 * GET ?archives=1       → { archives: [{ id, name, label, count, from, to, by, bytes, createdAtISO }] }
 * GET ?archive={id}     → the .txt file (download)
 * Clean-up and Clear are done by Cortana (jobs "audit.cleanup" / "audit.clear") — they also remove picture copies.
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const COLLS = ["audit_logs", "audit_log"]; // new format + the original Command Panel's format
const CLEAR_ROLES = new Set(["commander", "developer"]);

async function actorOr(): Promise<Awaited<ReturnType<typeof getActor>> | Response> {
  try {
    return await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);
const WEB_CAT: Record<string, string> = {
  manpower: "manpower", battalion_ops: "operations", operations: "operations", intel: "operations", public_comms: "workspace", workspace: "workspace",
  discord: "discord", discord_network: "command", commander: "command", command: "command", security: "security",
};

/** Both audit formats → one shape. */
function normalise(d: { _id: string; data?: unknown; createTime?: Date | null }) {
  const x = (d.data ?? {}) as Record<string, any>;
  const source = x.source === "discord" ? "discord" : x.source === "hub" ? "hub" : x.role === "cortana" || x.source === "cortana" ? "cortana" : "website";
  const section = String(x.section || x.category || "other").toLowerCase();
  return {
    id: d._id,
    at: iso(x.createdAt) || x.createdAtISO || iso(x.timestamp) || iso(d.createTime) || null,
    source,
    cat: String(x.cat || (source === "discord" ? "server" : source === "hub" ? "hub" : WEB_CAT[section] || "command")),
    section,
    action: String(x.action || "—"),
    details: String(x.details ?? x.detail ?? ""),
    by: String(x.by || x.operatorName || "—"),
    role: String(x.role || ""),
    locked: x.locked === true,
    target: x.target ?? null, channel: x.channel ?? null, before: x.before ?? null, after: x.after ?? null, content: x.content ?? null,
    media: Array.isArray(x.media) ? x.media.map((m: any) => ({ url: String(m.url ?? ""), name: String(m.name ?? ""), kind: String(m.kind ?? "file") })) : null,
    mediaRemoved: x.mediaRemoved === true,
    bulk: Array.isArray(x.bulk) ? x.bulk.map((b: any) => ({ at: b.at, author: b.author, content: b.content, media: (b.media ?? []).map((m: any) => ({ url: m.url, name: m.name, kind: m.kind })) })) : null,
    extra: { reason: x.reason ?? null, count: x.count ?? null, added: x.added ?? null, removed: x.removed ?? null, invite: x.invite ?? null, accountAgeDays: x.accountAgeDays ?? null, roles: x.roles ?? null, oldAvatar: x.oldAvatar ?? null, newAvatar: x.newAvatar ?? null, until: x.until ?? null, messageUrl: x.messageUrl ?? null },
  };
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

  const docs = await TerminalDoc.find({ parent: { $in: COLLS } }, { parent: 1, docId: 1, data: 1, createTime: 1 }).sort({ createTime: -1 }).limit(5000).lean();
  const ms = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  // Discord message text, pictures and edits are private: Officer and above only.
  const seeText = AUDIT_DELETE_ROLES.has(actor.role);
  const entries = docs.map(normalise).sort((a, b) => ms(b.at) - ms(a.at)).map((e) =>
    seeText || e.source !== "discord" || e.cat !== "messages" ? e : { ...e, details: e.action === "BULK DELETE" ? e.details.replace(/ · from .*/, "") : `${e.target ?? "Member"} — ${e.channel ?? ""} (text hidden: Officer and above)`, content: null, before: null, after: null, media: null, bulk: null, private: true },
  );
  const s = ((await TerminalDoc.findById("settings/audit", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
  const { lastCleanup, lastPurgeISO: _old, retentionDays: _r, ...settings } = s;
  return json({
    entries, settings, lastCleanup: lastCleanup ?? null,
    canClean: AUDIT_DELETE_ROLES.has(actor.role), canClear: CLEAR_ROLES.has(actor.role), canSettings: can(actor.role, actor.access, "set") && AUDIT_DELETE_ROLES.has(actor.role),
  });
}
