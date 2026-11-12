import { NextResponse } from "next/server";
import { TerminalDoc, connectDb } from "@505th/db";

export const dynamic = "force-dynamic";
/**
 * GET /api/public/health → { ok, ms } — can the website (on Vercel) read the database right now?
 * For Cortana's "Website API (database)" monitor. Never cached. Returns no data, only ok + timing.
 * 503 when the database can't be reached (that is what broke sign-in, the terminal and the Hub on 2026-11-12).
 */
export async function GET() {
  const t0 = Date.now();
  try {
    await connectDb();
    await TerminalDoc.findById("unit_config/status", { _id: 1 }).lean().maxTimeMS(5000);
    return NextResponse.json({ ok: true, ms: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, ms: Date.now() - t0 }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
