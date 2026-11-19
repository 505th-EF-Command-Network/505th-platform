import { getHubActor, hubJson } from "@/lib/hub/auth";
import { CcError, infoGet, infoPost, modGet, modPost, quickGet, quickPost } from "@/lib/hub/cortana-cmd";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** CORTANA COMMAND in the app. GET ?part=quick|info|mod · POST { part, action, … }. */
const who = async (req: Request) => { const a = await getHubActor(req); return a ? { uid: a.uid, role: a.role, access: a.access, displayName: a.displayName } : null; };
const fail = (e: unknown) => (e instanceof CcError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const part = new URL(req.url).searchParams.get("part");
  try { return hubJson(part === "quick" ? await quickGet(a) : part === "info" ? await infoGet(a) : part === "mod" ? await modGet(a) : { error: "Bad request." }); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(b.part === "quick" ? await quickPost(a, b) : b.part === "info" ? await infoPost(a, b) : b.part === "mod" ? await modPost(a, b) : { error: "Bad request." }); } catch (e) { return fail(e); }
}
