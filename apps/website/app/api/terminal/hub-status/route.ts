import { NextResponse } from "next/server";
import { HubSession } from "@505th/db";
import { FsError, getActor } from "@/lib/terminal/fs";
import { latestRelease } from "@/lib/hub/release";

export const dynamic = "force-dynamic";
/**
 * GET /api/terminal/hub-status → { released, version, dateISO, usingNow, signedIn } for the Terminal's System Status tiles.
 * usingNow = Hub sign-ins that called the website in the last 5 minutes (the app checks in every minute).
 */
export async function GET() {
  try { await getActor(); } catch (e) { const c = e instanceof FsError ? e.code : "internal"; return NextResponse.json({ error: c }, { status: c === "unauthenticated" ? 401 : 403 }); }
  const now = Date.now();
  const [rel, using, signedIn] = await Promise.all([
    latestRelease(),
    HubSession.countDocuments({ revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(now - 5 * 60_000) } }),
    HubSession.countDocuments({ revokedAt: { $exists: false }, expiresAt: { $gt: new Date(now) } }),
  ]);
  return NextResponse.json({ released: !!rel, version: rel?.version ?? null, dateISO: rel?.dateISO ?? null, usingNow: using, signedIn }, { headers: { "Cache-Control": "private, no-store" } });
}
