import { getHubActor, hubJson } from "@/lib/hub/auth";
import { NetError, act, detail, overview, type Who } from "@/lib/net/core";

export const dynamic = "force-dynamic";
/** Network Status in the app. GET → list · GET ?mon=id&range=24H → chart + incidents · POST {action} */
const fail = (e: unknown) => (e instanceof NetError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
async function who(req: Request): Promise<Who | null> { const a = await getHubActor(req); return a ? { uid: a.uid, name: a.displayName, role: a.role, access: a.access, source: "hub" } : null; }
export async function GET(req: Request) {
  const w = await who(req); if (!w) return hubJson({ error: "unauthenticated" }, 401);
  const q = new URL(req.url).searchParams;
  try { return hubJson(q.get("mon") ? await detail(w, q.get("mon")!, q.get("range") ?? "24H") : await overview(w)); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const w = await who(req); if (!w) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(await act(w, b)); } catch (e) { return fail(e); }
}
