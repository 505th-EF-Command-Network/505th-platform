import { HubAuthCode, HubSession, Member, connectDb } from "@505th/db";
import { TOKEN_PREFIX, cleanDevice, clientIp, getHubActor, hubAudit, hubJson, idleExpiry, limited, pkceMatches, randomToken, sha256Hex } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/token { code, verifier } → { token, user }
 * Swaps the one-time code from /hub/connect for an app token (PKCE). The code works once.
 */
export async function POST(req: Request) {
  if (limited(`hub-token:${clientIp(req)}`, 20, 15 * 60 * 1000)) return hubJson({ error: "Too many attempts. Wait and try again." }, 429);
  const b = (await req.json().catch(() => null)) as { code?: unknown; verifier?: unknown } | null;
  const code = String(b?.code ?? ""), verifier = String(b?.verifier ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return hubJson({ error: "Invalid request." }, 400);

  await connectDb();
  // findOneAndDelete = the code can only ever be used once.
  const c = await HubAuthCode.findOneAndDelete({ codeHash: sha256Hex(code), expiresAt: { $gt: new Date() } }).lean();
  if (!c || !c.challenge || !pkceMatches(verifier, c.challenge)) return hubJson({ error: "This sign-in has expired. Please try again." }, 400);

  const token = TOKEN_PREFIX + randomToken();
  const now = new Date();
  await HubSession.create({
    tokenHash: sha256Hex(token), member: c.member, discordId: c.discordId, deviceName: cleanDevice(c.deviceName),
    inGuild: c.inGuild, lastUsedAt: now, expiresAt: idleExpiry(now),
  });
  // Check the new token straight away (same checks as every later call).
  const actor = await getHubActor(new Request(req.url, { headers: { authorization: `Bearer ${token}` } }));
  if (!actor) {
    await HubSession.updateOne({ tokenHash: sha256Hex(token) }, { $set: { revokedAt: now, revokedReason: "no access" } });
    return hubJson({ error: "You don't have Command Terminal access." }, 403);
  }
  const m = await Member.findById(actor.memberId, { discordUsername: 1 }).lean();
  await hubAudit({ uid: actor.uid, name: actor.displayName, role: actor.role }, "APP SIGNED IN", `Command Network app on "${actor.deviceName}"`);
  return hubJson({ token, user: { uid: actor.uid, name: actor.displayName, role: actor.role, discordUsername: m?.discordUsername ?? "", deviceName: actor.deviceName } });
}
