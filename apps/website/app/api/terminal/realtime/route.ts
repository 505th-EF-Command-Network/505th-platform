import { NextResponse } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";

/**
 * GET /api/terminal/realtime — a 1-hour Ably token that can ONLY LISTEN on "505th-live" (same idea as RCD).
 * The Root key (ABLY_API_KEY) never leaves the server. No key → 503 and the terminal keeps polling.
 */
export const dynamic = "force-dynamic";
const CHANNEL = "505th-live";
const hits = new Map<string, number[]>();

export async function GET() {
  let uid: string;
  try {
    uid = (await getActor()).uid;
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return NextResponse.json({ error: code }, { status: code === "unauthenticated" ? 401 : 403 });
  }
  const key = process.env.ABLY_API_KEY || "";
  const keyName = key.split(":")[0];
  if (!key.includes(":")) return NextResponse.json({ error: "Instant updates not set up (ABLY_API_KEY missing)" }, { status: 503 });
  const now = Date.now();
  const mine = (hits.get(uid) || []).filter((t) => now - t < 3_600_000);
  if (mine.length >= 30) return NextResponse.json({ error: "Too many token requests" }, { status: 429 });
  hits.set(uid, [...mine, now]);
  try {
    const r = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(key).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ keyName, clientId: uid, ttl: 3_600_000, timestamp: now, capability: JSON.stringify({ [CHANNEL]: ["subscribe"] }) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) throw new Error(`Ably ${r.status}`);
    const t = (await r.json()) as { token: string; expires: number };
    return NextResponse.json({ token: t.token, expires: t.expires, channel: CHANNEL }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[realtime] token failed:", (e as Error).message);
    return NextResponse.json({ error: "Could not get an instant-updates token" }, { status: 502 });
  }
}
