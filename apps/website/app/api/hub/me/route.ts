import { Member } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { effectiveAccess } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";

/** GET /api/hub/me → who the app is signed in as, and their Terminal access. 401 = signed out. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const m = await Member.findById(a.memberId, { discordUsername: 1, rankKey: 1, rankRaw: 1, platoon: 1 }).lean();
  return hubJson({
    uid: a.uid, name: a.displayName, role: a.role, deviceName: a.deviceName,
    discordUsername: m?.discordUsername ?? "", platoon: m?.platoon ?? "",
    access: effectiveAccess(a.role, a.access),
  });
}
