import { createHttpClient } from "@ably/pubsub-server";
import { getHubActor, hubJson, limited } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
const CHANNEL = "505th-live";

/**
 * GET /api/hub/realtime — a signed Ably "token request" (valid 1 hour) that can ONLY LISTEN on "505th-live"
 * (the 505th Net). Same method as the RCD Hub: the app exchanges it with Ably itself. The root key never leaves the server.
 * Ably's server package (@ably/pubsub-server): this account is on MAU pricing, which refuses the old "ably" package (error 40168).
 */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const key = process.env.ABLY_API_KEY || "";
  if (!key.includes(":")) return hubJson({ error: "Instant updates are not set up on the website (ABLY_API_KEY missing in Vercel)." }, 503);
  if (limited(`hub-rt:${a.sessionId}`, 30, 3_600_000)) return hubJson({ error: "Too many token requests." }, 429);
  try {
    const tokenRequest = await createHttpClient({ key }).auth.createTokenRequest({
      clientId: `hub:${a.uid}`,
      capability: { [CHANNEL]: ["subscribe"] },
      ttl: 60 * 60 * 1000,
    });
    return hubJson(tokenRequest);
  } catch (e) {
    console.error("[hub realtime] token request failed:", (e as Error).message);
    return hubJson({ error: "Could not create an instant-updates token." }, 502);
  }
}
