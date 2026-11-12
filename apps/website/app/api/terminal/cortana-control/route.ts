import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { CtlError, act, setPassword, status, type CtlWho } from "@/lib/cortana/control";

export const dynamic = "force-dynamic";
/**
 * Cortana Control (website terminal).
 *   GET  → status (online, version vs GitHub, live steps, shut down reason) + what I'm allowed to do
 *   POST {action:"password", password}                          → server owner only
 *   POST {action:"update"|"restart", password}                  → Commander / Developer
 *   POST {action:"shutdown", password, reason, details, confirm:"SHUTDOWN"}
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(req: NextRequest): Promise<CtlWho | Response> {
  if (req.method !== "GET") { const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403); }
  try { const a = await getActor(); return { uid: a.uid, role: a.role, discordId: a.discordId, name: a.displayName || "Staff" }; }
  catch (e) { const c = e instanceof FsError ? e.code : "unavailable"; return json({ error: c }, c === "unauthenticated" ? 401 : c === "unavailable" ? 503 : 403); }
}
const fail = (e: unknown) => (e instanceof CtlError ? json({ error: e.message }, e.status) : (console.error("[cortana-control]", (e as Error)?.message), json({ error: "Something went wrong." }, 500)));
export async function GET(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  try { return json(await status(w)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const w = await who(req);
  if (w instanceof Response) return w;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request." }, 400);
  try { return json(b.action === "password" ? await setPassword(w, b.password) : await act(w, b)); } catch (e) { return fail(e); }
}
