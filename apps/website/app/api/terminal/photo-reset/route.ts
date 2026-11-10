import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } });

/** POST { uid, reason } — staff remove a picture that breaks the rules (back to the Discord picture). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  let actor;
  try {
    actor = await getActor();
  } catch (e) {
    return json({ error: e instanceof FsError ? e.code : "internal" }, 403);
  }
  if (!can(actor.role, actor.access, "pers")) return json({ error: "Personnel Files access needed" }, 403);
  const { uid, reason } = await req.json().catch(() => ({}));
  if (typeof uid !== "string" || !/^[A-Za-z0-9_\-]{1,200}$/.test(uid)) return json({ error: "Bad member" }, 400);
  const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
  if (!d) return json({ error: "Not found" }, 404);
  const data = (d.data ?? {}) as Record<string, any>;
  const now = new Date();
  await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.photo": { source: "discord", url: null, zoom: 100, x: 50, y: 50, updatedAt: now.toISOString(), removedBy: actor.displayName }, "data.photoUrl": data.discordAvatarUrl ?? null, updateTime: now } });
  const id = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "manpower", action: "PROFILE PICTURE REMOVED", details: `${data.callsign || uid}${reason ? ` — ${String(reason).slice(0, 200)}` : ""}`, uid: actor.uid, by: actor.displayName, role: actor.role, createdAt: now, createdAtISO: now.toISOString() } });
  return json({ ok: true });
}
