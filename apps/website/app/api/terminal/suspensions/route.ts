import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { SuError, suAct, suList, type SuActor } from "@/lib/terminal/suspend-core";

export const dynamic = "force-dynamic";
/** COMMAND CENTRE → SUSPENSIONS on the website Terminal — same rules as the Hub (lib/terminal/suspend-core.ts). */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(): Promise<SuActor | Response> {
  try { const a = await getActor(); return { uid: a.uid, role: a.role, access: a.access, displayName: a.displayName || "Staff", source: "terminal" }; }
  catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : 403); }
}
const fail = (e: unknown) => (e instanceof SuError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong." }, 500));
export async function GET() {
  const a = await who(); if (a instanceof Response) return a;
  try { return json(await suList(a)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const a = await who(); if (a instanceof Response) return a;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request." }, 400);
  try { return json(await suAct(a, b)); } catch (e) { return fail(e); }
}
