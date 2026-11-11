import { getHubActor, hubJson, limited } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
const CHANNEL = "505th-live";

/**
 * GET /api/hub/realtime → 1-hour Ably token that can ONLY LISTEN on "505th-live" (the 505th Net).
 * Same channel the website Terminal and Cortana use. The root key never leaves the server.
 * Returns an Ably TokenDetails-style object the app passes straight to Ably's authCallback.
 */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const key = process.env.ABLY_API_KEY || "";
  if (!key.includes(":")) return hubJson({ error: "Instant updates not set up (ABLY_API_KEY missing)" }, 503);
  if (limited(`hub-rt:${a.sessionId}`, 30, 3_600_000)) return hubJson({ error: "Too many token requests" }, 429);
  const keyName = key.split(":")[0];
  try {
    const r = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(key).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ keyName, clientId: `hub:${a.uid}`, ttl: 3_600_000, timestamp: Date.now(), capability: JSON.stringify({ [CHANNEL]: ["subscribe"] }) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) throw new Error(`Ably ${r.status}`);
    const t = await r.json();
    return hubJson({ ...t, channel: CHANNEL });
  } catch (e) {
    console.error("[hub realtime] token failed:", (e as Error).message);
    return hubJson({ error: "Could not get an instant-updates token" }, 502);
  }
}
