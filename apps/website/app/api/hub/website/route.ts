import { getHubActor, hubJson } from "@/lib/hub/auth";
import { WebError, wGet, wPost } from "@/lib/hub/website-core";

export const dynamic = "force-dynamic";
/** Website editor in the app. GET → pages + content + photo library · POST { action: "publish", changes } | { action: "addLib", url, name }. */
const who = async (req: Request) => { const a = await getHubActor(req); return a ? { uid: a.uid, role: a.role, access: a.access, displayName: a.displayName } : null; };
const fail = (e: unknown) => (e instanceof WebError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await wGet(a)); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await wPost(a, (await req.json().catch(() => null)) as Record<string, unknown> | null)); } catch (e) { return fail(e); }
}
