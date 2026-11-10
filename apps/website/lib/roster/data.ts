import "server-only";
import { connectDb, TerminalDoc } from "@505th/db";

/** Only what the roster table shows — no emails, Discord IDs or private notes. */
export type RosterRow = {
  id: string;
  firstName: string;
  lastName: string;
  callsign: string;
  rank: string;
  platoon: string;
  joinedPlatoon: string | null;
  graduation: string | null;
  attendance: number;
  promotionTracker: number;
  ribbons: number;
};

/** Roles the original roster page allowed in (retired veterans excluded). */
export const ROSTER_ROLES = new Set(["enlistee", "marine", "recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);

/**
 * Same people as the original page: everyone except pending/denied applicants
 * and retired veterans. Read from `terminal_fs` users, which the original
 * Command Terminal edits (members is a mirror of it).
 */
export async function getRoster(): Promise<RosterRow[]> {
  await connectDb();
  const docs = await TerminalDoc.find({ parent: "users" }, { data: 1 }).lean();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return docs
    .map((d) => ({ id: String(d._id), u: (d.data ?? {}) as Record<string, any> }))
    .filter(({ u }) => u.status !== "pending" && u.status !== "denied" && u.role !== "retired_veteran")
    .map(({ id, u }) => ({
      id,
      firstName: str(u.firstName),
      lastName: str(u.lastName),
      callsign: str(u.callsign),
      rank: str(u.rank),
      platoon: str(u.platoon),
      joinedPlatoon: str(u.joinedPlatoon) || null,
      graduation: str(u.graduation) || null,
      attendance: Number(u.attendance) || 0,
      promotionTracker: Number(u.promotionTracker) || 0,
      ribbons: Array.isArray(u.ribbonHistory) ? u.ribbonHistory.length : 0,
    }))
    .sort((a, b) => a.callsign.localeCompare(b.callsign));
}
