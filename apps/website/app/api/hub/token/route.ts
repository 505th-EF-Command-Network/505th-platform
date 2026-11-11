import { randomBytes } from "node:crypto";
import { HubAuthCode, HubSession, Member, TerminalDoc, connectDb } from "@505th/db";
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
    return hubJson({ error: "ACCESS PENDING — the Commander hasn't given you Hub access yet. Ask for it on the website Terminal dashboard." }, 403);
  }
  const m = await Member.findById(actor.memberId, { discordUsername: 1 }).lean();
  // "Tell me when a new device signs in" (My Notifications, on by default) — only if another device is already signed in.
  const others = await HubSession.countDocuments({ member: c.member, revokedAt: { $exists: false }, tokenHash: { $ne: sha256Hex(token) } });
  const pref = ((await TerminalDoc.findById(`users/${actor.uid}`, { "data.hubPrefs.settings.notify.newDevice": 1 }).lean())?.data as { hubPrefs?: { settings?: { notify?: { newDevice?: boolean } } } } | undefined)?.hubPrefs?.settings?.notify?.newDevice;
  if (others && pref !== false) {
    const nid = Array.from(randomBytes(20), (x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[x % 62]).join("");
    await TerminalDoc.create({ _id: `notifications/${actor.uid}/items/${nid}`, parent: `notifications/${actor.uid}/items`, docId: nid, createTime: now, updateTime: now,
      data: { type: "device", read: false, title: "🖥 New device signed in", body: `"${actor.deviceName}" signed in to the Hub. Not you? Sign it out in My Devices.`, createdAt: now } }).catch(() => {});
  }
  await hubAudit({ uid: actor.uid, name: actor.displayName, role: actor.role }, "APP SIGNED IN", `Command Network app on "${actor.deviceName}"`);
  return hubJson({ token, user: { uid: actor.uid, name: actor.displayName, role: actor.role, discordUsername: m?.discordUsername ?? "", deviceName: actor.deviceName } });
}
