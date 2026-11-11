import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { ProjError, deleteProject, listProjects, projectAction, type Who } from "@/lib/projects/core";

export const dynamic = "force-dynamic";
/** Project Tracker v2 for the website Terminal. Same rules as /api/hub/projects (lib/projects/core.ts). */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(req: NextRequest): Promise<Who | Response> {
  if (req.method !== "GET") { const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403); }
  try {
    const a = await getActor();
    return { uid: a.uid, name: a.displayName || "Staff", role: a.role, access: a.access, source: "terminal" };
  } catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : 403); }
}
const fail = (e: unknown) => (e instanceof ProjError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong." }, 500));

export async function GET(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  try { return json(await listProjects(w)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request." }, 400);
  try { return json(b.action === "delete" ? await deleteProject(w, String(b.id ?? "")) : await projectAction(w, b)); } catch (e) { return fail(e); }
}
