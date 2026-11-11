import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { AccessError, changeAccess, listAccess, myAccess, requestAccess, type Who } from "@/lib/hub/access-list";

export const dynamic = "force-dynamic";
/**
 * Website Terminal side of Hub Access.
 *   GET            → my status + the release (download card)      GET ?list=1 → the Hub Access page (Commander / Developer)
 *   POST {action:"request", note}  → ask the Commander           POST {action: give|approve|deny|revoke|restore|bulk} → Commander only
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(req: NextRequest): Promise<Who | Response> {
  if (req.method !== "GET") { const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403); }
  try { const a = await getActor(); return { uid: a.uid, name: a.displayName || "Staff", role: a.role, source: "terminal" }; }
  catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : 403); }
}
const fail = (e: unknown) => (e instanceof AccessError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong." }, 500));
export async function GET(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  try { return json(req.nextUrl.searchParams.get("list") ? await listAccess(w) : await myAccess(w.uid, w.role)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request." }, 400);
  try { return json(b.action === "request" ? await requestAccess(w, b.note) : await changeAccess(w, b)); } catch (e) { return fail(e); }
}
