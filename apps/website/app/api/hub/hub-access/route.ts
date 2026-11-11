import { getHubActor, hubJson } from "@/lib/hub/auth";
import { AccessError, changeAccess, listAccess } from "@/lib/hub/access-list";

export const dynamic = "force-dynamic";
/** Hub Access page in the app (Commander changes · Developer views). Same rules as /api/terminal/hub-access. */
const fail = (e: unknown) => (e instanceof AccessError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await listAccess({ uid: a.uid, name: a.displayName, role: a.role, source: "hub" })); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(await changeAccess({ uid: a.uid, name: a.displayName, role: a.role, source: "hub" }, b)); } catch (e) { return fail(e); }
}
