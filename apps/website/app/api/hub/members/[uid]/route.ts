import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { EDIT_ROLES, MEDALS, PLATOONS, RANKS, isInactive, photoOf } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 500) : []);

/** GET /api/hub/members/{uid} → one personnel file (details, service record, attendance). */
export async function GET(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "pers")) return hubJson({ error: "You don't have Personnel Files access." }, 403);
  const { uid } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) return hubJson({ error: "Invalid member." }, 400);
  const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
  if (!d) return hubJson({ error: "Member not found." }, 404);
  const u = (d.data ?? {}) as U;
  const evs = await TerminalDoc.find({ parent: "attendance_events", "data.locked": true }, { data: 1 }).lean();
  const joined = String(u.joinedAt || "").slice(0, 10);
  const lastOps = evs
    .map((e) => (e.data ?? {}) as U)
    .filter((e) => String(e.date || "") >= joined)
    .sort((x, y) => String(y.date).localeCompare(String(x.date)))
    .slice(0, 8)
    .map((e) => ({ date: String(e.date || "").slice(0, 10), title: String(e.title || "Op"), result: (e.attendees || []).includes(uid) ? "present" : (e.excused || []).includes(uid) ? "excused" : "absent" }));
  return hubJson({
    id: uid, firstName: u.firstName || "", lastName: u.lastName || "", callsign: u.callsign || "", rank: u.rank || "", role: u.role || "enlistee",
    platoon: u.platoon || "", squad: u.squad || "", joinedAt: String(u.joinedAt || "").slice(0, 10), graduation: String(u.graduation || "").slice(0, 10),
    joinedPlatoon: String(u.joinedPlatoon || "").slice(0, 10), recruitSource: u.recruitSource || "", discordUsername: u.discordUsername || "",
    discordLinked: /^\d{17,20}$/.test(String(u.discordId || "")), photo: photoOf(u), inactive: isInactive(u), retired: u.role === "retired_veteran",
    attendance: Number(u.attendance) || 0, promotionTracker: Number(u.promotionTracker) || 0, opsAttended: Number(u.opsAttended) || 0,
    opsEligible: Number(u.opsEligible) || 0, lastAttendedDate: u.lastAttendedDate || "",
    promotionHistory: list(u.promotionHistory), platoonHistory: list(u.platoonHistory), warningHistory: list(u.warningHistory),
    commendationHistory: list(u.commendationHistory), ribbonHistory: list(u.ribbonHistory),
    lastOps,
    // Editing (same rules as the Terminal): Staff NCO+, Commander's file only by the Commander, retired = frozen.
    canEdit: EDIT_ROLES.has(a.role) && !(u.role === "commander" && a.role !== "commander") && u.role !== "retired_veteran",
    lists: { ranks: RANKS, platoons: PLATOONS, medals: MEDALS },
  });
}
