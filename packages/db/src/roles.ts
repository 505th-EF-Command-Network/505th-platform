/**
 * Roles and clearance levels.
 *
 * Role names are the ones already used in the Firebase records (the original
 * Command Terminal also assigns "officer" and "recruiter"). The Command
 * Terminal requires clearance level 3 (staff NCO and above).
 */
export const ROLES = [
  "enlistee", "marine", "retired_veteran", "recruiter", "nco", "staff_nco", "officer", "developer", "commander",
] as const;
export type Role = (typeof ROLES)[number];

export const CLEARANCE: Record<Role, number> = {
  enlistee: 1,
  marine: 1,
  retired_veteran: 1,
  recruiter: 2,
  nco: 2,
  staff_nco: 3,
  officer: 4,
  developer: 4,
  commander: 5,
};

export const ROLE_LABEL: Record<Role, string> = {
  enlistee: "Enlistee",
  marine: "Marine",
  retired_veteran: "Retired Veteran",
  recruiter: "Recruiter",
  nco: "NCO",
  staff_nco: "Staff NCO",
  officer: "Officer",
  developer: "Developer",
  commander: "Commander",
};

/** Recruiter and above reach the Command Terminal; Marines and below get their profile. */
export const TERMINAL_CLEARANCE = 2;

export function clearanceOf(role: string | undefined | null): number {
  return role && role in CLEARANCE ? CLEARANCE[role as Role] : 0;
}

export const MEMBER_STATUSES = ["PENDING", "ACTIVE", "LOA", "RESERVE", "SUSPENDED", "LEFT_UNIT"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Statuses that may sign in to member areas. */
export const SIGN_IN_STATUSES: MemberStatus[] = ["ACTIVE", "LOA", "RESERVE"];
