import { HubSession, connectDb } from "@505th/db";
import { cleanDevice, getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const ID = /^[a-f0-9]{24}$/;

/**
 * My Devices (H3). GET → this person's Hub sign-ins (active + the last few signed out).
 * POST { action: "rename", id, name } · { action: "signout", id } · { action: "signout-others" }.
 * Only ever your own sessions. Signing out = revokedAt (the token stops working at once).
 */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  await connectDb();
  const all = (await HubSession.find({ member: a.memberId }, { tokenHash: 0 }).sort({ createdAt: -1 }).limit(30).lean()) as U[];
  const now = Date.now();
  const out = (s: U) => ({ id: String(s._id), name: s.deviceName || "Windows PC", appVersion: s.appVersion || "", os: s.os || "", current: String(s._id) === a.sessionId,
    signedInAt: s.createdAt ? new Date(s.createdAt).toISOString() : "", lastUsedAt: s.lastUsedAt ? new Date(s.lastUsedAt).toISOString() : "",
    expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : "", revokedAt: s.revokedAt ? new Date(s.revokedAt).toISOString() : "", revokedReason: s.revokedReason || "" });
  const active = all.filter((s) => !s.revokedAt && (!s.expiresAt || +new Date(s.expiresAt) > now));
  return hubJson({ devices: active.map(out), recent: all.slice(0, 10).map(out) });
}

export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const mine = { member: a.memberId, revokedAt: { $exists: false } };
  if (b.action === "signout-others") {
    const r = await HubSession.updateMany({ ...mine, _id: { $ne: a.sessionId } }, { $set: { revokedAt: new Date(), revokedReason: "signed out from My Devices" } });
    await hubAudit(who, "APP SIGNED OUT OTHER DEVICES", `${r.modifiedCount} device(s) — via app`);
    return hubJson({ ok: true, msg: r.modifiedCount ? `${r.modifiedCount} device${r.modifiedCount === 1 ? "" : "s"} signed out` : "No other devices" });
  }
  const id = String(b.id ?? "");
  if (!ID.test(id)) return hubJson({ error: "Bad request." }, 400);
  const s = await HubSession.findOne({ _id: id, ...mine }, { deviceName: 1 }).lean();
  if (!s) return hubJson({ error: "Device not found." }, 404);
  if (b.action === "rename") {
    const name = cleanDevice(b.name);
    await HubSession.updateOne({ _id: id }, { $set: { deviceName: name } });
    return hubJson({ ok: true, msg: "Device renamed" });
  }
  if (b.action === "signout") {
    if (id === a.sessionId) return hubJson({ error: "Use Sign out in the menu for this PC." }, 400);
    await HubSession.updateOne({ _id: id }, { $set: { revokedAt: new Date(), revokedReason: "signed out from My Devices" } });
    await hubAudit(who, "APP DEVICE SIGNED OUT", `"${s.deviceName}" — via app`);
    return hubJson({ ok: true, msg: "Device signed out" });
  }
  return hubJson({ error: "Unknown action." }, 400);
}
