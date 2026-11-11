import { getHubActor, hubJson } from "@/lib/hub/auth";
import { ProjError, deleteProject, listProjects, projectAction, type Who } from "@/lib/projects/core";

export const dynamic = "force-dynamic";
/** Project Tracker v2 for the app. GET → list · POST {action,…} (action "delete" deletes). Same rules as /api/terminal/projects. */
async function who(req: Request): Promise<Who | null> {
  const a = await getHubActor(req);
  return a ? { uid: a.uid, name: a.displayName, role: a.role, access: a.access, source: "hub" } : null;
}
const fail = (e: unknown) => (e instanceof ProjError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));

export async function GET(req: Request) {
  const w = await who(req);
  if (!w) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await listProjects(w)); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const w = await who(req);
  if (!w) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(b.action === "delete" ? await deleteProject(w, String(b.id ?? "")) : await projectAction(w, b)); } catch (e) { return fail(e); }
}
