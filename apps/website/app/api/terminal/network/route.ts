import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { NetError, act, detail, overview, type Who } from "@/lib/net/core";

export const dynamic = "force-dynamic";
/** Network Status on the website Terminal. Same rules as /api/hub/network (lib/net/core.ts). */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(req: NextRequest): Promise<Who | Response> {
  if (req.method !== "GET") { const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403); }
  try { const a = await getActor(); return { uid: a.uid, name: a.displayName || "Staff", role: a.role, access: a.access, source: "terminal" }; }
  catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : 403); }
}
const fail = (e: unknown) => (e instanceof NetError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong." }, 500));
export async function GET(req: NextRequest) {
  const w = await who(req); if (w instanceof Response) return w;
  const q = req.nextUrl.searchParams;
  try { return json(q.get("mon") ? await detail(w, q.get("mon")!, q.get("range") ?? "24H") : await overview(w)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const w = await who(req); if (w instanceof Response) return w;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request." }, 400);
  try { return json(await act(w, b)); } catch (e) { return fail(e); }
}
