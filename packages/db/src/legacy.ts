/**
 * Firebase record → MongoDB member, shared by the migration tool and the
 * original Command Terminal (which still edits Firebase-shaped "users" docs).
 * Pure functions only.
 */
import { parseRank } from "./ranks.ts";
import { ROLES, type Role, type MemberStatus } from "./roles.ts";

export type FsDoc = { id: string; path: string; data: Record<string, any>; createTime?: string; updateTime?: string };

/** Firestore timestamp ({__type:"timestamp", seconds, nanoseconds}) or ISO string → Date. */
export function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (typeof v === "object" && v !== null && "seconds" in v) {
    const t = v as { seconds: number; nanoseconds?: number };
    return new Date(t.seconds * 1000 + Math.floor((t.nanoseconds ?? 0) / 1e6));
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

const STATUS_MAP: Record<string, MemberStatus> = {
  active: "ACTIVE",
  approved: "ACTIVE", // decided 2026-11-08: "approved" = active member
  pending: "PENDING",
  denied: "SUSPENDED", // denied applicant: cannot sign in, can be re-approved
  loa: "LOA",
  reserve: "RESERVE",
  suspended: "SUSPENDED",
  left: "LEFT_UNIT",
  left_unit: "LEFT_UNIT",
  discharged: "LEFT_UNIT",
};

export type LeaverMatcher = (d: FsDoc) => boolean;

/** Build a matcher from a list of Firebase uids and/or "First Last" names. */
export function leaverMatcher(list: string[]): LeaverMatcher {
  const keys = new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean));
  return (d) => {
    const name = `${d.data.firstName ?? ""} ${d.data.lastName ?? ""}`.trim().toLowerCase();
    return keys.has(d.id.toLowerCase()) || keys.has(name);
  };
}

const hist = (arr: unknown) =>
  Array.isArray(arr)
    ? arr.map((h: any) => ({ ...h, addedAt: toDate(h.addedAt), editedAt: toDate(h.editedAt) }))
    : [];

export type MemberResult = { doc: Record<string, any>; warnings: string[] };

export function transformMember(d: FsDoc, isLeaver: LeaverMatcher): MemberResult {
  const u = d.data;
  const warnings: string[] = [];
  const rank = parseRank(u.rank);
  if (u.rank && !rank) warnings.push(`unknown rank text kept as rankRaw`);
  const role: Role = (ROLES as readonly string[]).includes(u.role) ? u.role : "enlistee";
  if (u.role && role !== u.role) warnings.push(`unknown role "${u.role}" → enlistee`);
  let status: MemberStatus = STATUS_MAP[String(u.status ?? "").toLowerCase()] ?? "PENDING";
  if (u.status && !STATUS_MAP[String(u.status).toLowerCase()]) warnings.push(`unknown status "${u.status}" → PENDING`);
  // Command → Suspensions sets suspended:true (optionally until a date). Suspended = cannot sign in.
  if (u.suspended === true && !(u.suspendedUntil && Date.parse(String(u.suspendedUntil)) <= Date.now())) status = "SUSPENDED";
  if (isLeaver(d)) status = "LEFT_UNIT";
  if (!u.discordId) warnings.push("no Discord ID — will need manual linking");
  if (!u.firstName || !u.lastName) warnings.push("missing first or last name");

  return {
    warnings,
    doc: {
      legacyId: d.id,
      discordId: u.discordId || undefined,
      discordUsername: u.discordUsername || undefined,
      email: u.email || undefined,
      firstName: u.firstName || "UNKNOWN",
      middleName: u.middleName || "",
      lastName: u.lastName || "UNKNOWN",
      callsign: u.callsign || "",
      rankKey: rank?.key,
      rankRaw: rank ? undefined : u.rank || undefined,
      role,
      status,
      platoon: u.platoon || "",
      joinedPlatoon: u.joinedPlatoon || undefined,
      recruitSource: u.recruitSource || undefined,
      graduation: u.graduation || undefined,
      joinedAt: toDate(u.joinedAt),
      registeredAt: toDate(u.registeredAt),
      approvedAt: toDate(u.approvedAt),
      approvedBy: u.approvedBy || undefined,
      attendance: {
        percent: u.attendance ?? 0,
        opsAttended: u.opsAttended ?? 0,
        opsEligible: u.opsEligible ?? 0,
        lastAttendedDate: u.lastAttendedDate || undefined,
      },
      promotionTracker: u.promotionTracker ?? 0,
      promotionHistory: hist(u.promotionHistory),
      platoonHistory: hist(u.platoonHistory),
      commendationHistory: hist(u.commendationHistory),
      ribbonHistory: hist(u.ribbonHistory),
      warningHistory: hist(u.warningHistory),
      displayPrefs: u.displayPrefs,
      createdAt: toDate(d.createTime),
      updatedAt: toDate(u.updatedAt) ?? toDate(d.updateTime),
    },
  };
}

