import { getHubActor, hubJson } from "@/lib/hub/auth";
import { SuError, suAct, suList } from "@/lib/terminal/suspend-core";

export const dynamic = "force-dynamic";
/** COMMAND CENTRE → SUSPENSIONS in the app. GET list · POST { action: suspend | restore | extend, uid, … }. Rules: lib/terminal/suspend-core.ts. */
const who = async (req: Request) => { const a = await getHubActor(req); return a ? { uid: a.uid, role: a.role, access: a.access, displayName: a.displayName, source: "hub" as const } : null; };
const fail = (e: unknown) => (e instanceof SuError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await suList(a)); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(await suAct(a, b)); } catch (e) { return fail(e); }
}
