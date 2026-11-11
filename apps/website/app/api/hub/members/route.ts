import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { isInactive, photoOf } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;

/** GET /api/hub/members → Personnel Files grid (needs Personnel Files access, same as the Terminal). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "pers")) return hubJson({ error: "You don't have Personnel Files access." }, 403);
  const docs = await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean();
  const members = docs
    .map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U)
    .filter((u) => u.status !== "pending" && u.status !== "denied")
    .map((u) => ({
      id: u.id, firstName: u.firstName || "", lastName: u.lastName || "", callsign: u.callsign || "", rank: u.rank || "",
      role: u.role || "enlistee", platoon: u.platoon || "", joinedAt: String(u.joinedAt || "").slice(0, 10),
      opsAttended: Number(u.opsAttended) || 0, opsEligible: Number(u.opsEligible) || 0,
      inactive: isInactive(u), retired: u.role === "retired_veteran", photo: photoOf(u), discordUsername: u.discordUsername || "",
    }));
  return hubJson({ members, canEdit: ["commander", "officer", "developer", "staff_nco"].includes(a.role) });
}
