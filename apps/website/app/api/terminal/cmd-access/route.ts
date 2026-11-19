import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { CaError, caList, caSave, type CaActor } from "@/lib/terminal/cmd-access-core";

/**
 * HIGH COMMAND MANAGEMENT (was Command Access) on the website Terminal. Rules in lib/terminal/cmd-access-core.ts (same as the Hub).
 * GET  → { grants, always, members, grantable }
 * POST { uid, keys: [...] | "full", untilISO?, reason, notify? } → give / change · POST { uid, remove: true } → take away
 */
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(): Promise<CaActor | Response> {
  try { const a = await getActor(); return { uid: a.uid, role: a.role, displayName: a.displayName, source: "terminal" }; }
  catch (e) { const code = e instanceof FsError ? e.code : "internal"; return json({ error: code }, code === "unauthenticated" ? 401 : 403); }
}
const fail = (e: unknown) => (e instanceof CaError ? json({ error: e.message }, e.status) : json({ error: "Something went wrong." }, 500));

export async function GET() {
  const a = await who(); if (a instanceof Response) return a;
  try { return json(await caList(a)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const a = await who(); if (a instanceof Response) return a;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Bad request" }, 400);
  try { return json(await caSave(a, b)); } catch (e) { return fail(e); }
}
