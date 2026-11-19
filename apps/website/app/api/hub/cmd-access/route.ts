import { getHubActor, hubJson } from "@/lib/hub/auth";
import { CaError, caList, caSave } from "@/lib/terminal/cmd-access-core";

export const dynamic = "force-dynamic";
/** HIGH COMMAND MANAGEMENT in the app — same rules as the website (lib/terminal/cmd-access-core.ts). */
const fail = (e: unknown) => (e instanceof CaError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await caList({ uid: a.uid, role: a.role, displayName: a.displayName, source: "hub" })); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await getHubActor(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request" }, 400);
  try { return hubJson(await caSave({ uid: a.uid, role: a.role, displayName: a.displayName, source: "hub" }, b)); } catch (e) { return fail(e); }
}
