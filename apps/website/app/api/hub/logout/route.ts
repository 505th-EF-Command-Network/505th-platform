import { HubSession } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";

/** POST /api/hub/logout → ends this app sign-in (the token stops working at once). */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ ok: true });
  await HubSession.updateOne({ _id: a.sessionId }, { $set: { revokedAt: new Date(), revokedReason: "signed out" } });
  await hubAudit({ uid: a.uid, name: a.displayName, role: a.role }, "APP SIGNED OUT", `Command Network app on "${a.deviceName}"`);
  return hubJson({ ok: true });
}
