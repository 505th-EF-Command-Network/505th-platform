import { NextResponse, type NextRequest } from "next/server";
import { resetDbIfBroken } from "@505th/db";
import { FsError, getActor, runOp, type Op } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";

const MAX_BODY = 2 * 1024 * 1024;
const MAX_OPS = 60;
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * POST { ops: Op[] } → { results: ({ ok: true, value } | { ok: false, code, message })[] }
 * Used only by /terminal-shim/firestore.js inside the original Command Terminal.
 */
export async function POST(req: NextRequest) {
  // Same-origin only: blocks other sites from posting with the visitor's cookie.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  if (!req.headers.get("content-type")?.includes("application/json")) return json({ error: "JSON only" }, 415);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "Request too large" }, 413);

  let ops: Op[];
  try {
    const body = JSON.parse(text);
    ops = body?.ops;
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPS) throw new Error();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  let actor;
  try {
    actor = await getActor();
  } catch (e) {
    // Database down / busy → 503 (the page retries). Only a real "no clearance" is 403 (→ /boot).
    if (!(e instanceof FsError)) { resetDbIfBroken(e); console.error("[terminal-fs] actor:", (e as Error)?.message); return json({ error: "unavailable" }, 503); }
    return json({ error: e.code }, e.code === "unauthenticated" ? 401 : 403);
  }

  const results = [];
  for (const op of ops) {
    try {
      results.push({ ok: true, value: await runOp(actor, op) });
    } catch (e) {
      if (e instanceof FsError) results.push({ ok: false, code: e.code, message: e.message });
      else {
        resetDbIfBroken(e);
        console.error("[terminal-fs]", (e as Error)?.message);
        results.push({ ok: false, code: "internal", message: "Server error" });
      }
    }
  }
  return json({ results });
}
