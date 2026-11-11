import "server-only";

type U = Record<string, any>;

export const photoOf = (u: U) => [u.photoUrl, u.photoURL, u.discordAvatarUrl].find((p) => typeof p === "string" && p.startsWith("https://")) ?? null;
/** Same rule as the Terminal's Personnel Files (isInactive). */
export function isInactive(u: U): boolean {
  if (u.platoon === "Reserves" || u.platoon === "Awaiting BCT") return false;
  if (u.status === "inactive") return true;
  const cut = new Date();
  cut.setMonth(cut.getMonth() - 3);
  if (u.lastAttendedDate) return u.lastAttendedDate < cut.toISOString().slice(0, 10);
  return (u.opsAttended || 0) === 0 && (u.opsEligible || 0) > 0;
}


export const RANKS = [
  "O9 / Lieutenant General", "O8 / Major General", "O7 / Brigadier General", "O6 / Colonel", "O5 / Lieutenant Colonel", "O4 / Major", "O3 / Captain",
  "O2 / First Lieutenant", "O1 / Second Lieutenant", "E9 / Sergeant Major", "E9 / Master Gunnery Sergeant", "E9 / First Sergeant", "E8 / Master Sergeant",
  "E7 / Gunnery Sergeant", "E6 / Staff Sergeant", "E5 / Sergeant", "E4 / Corporal", "E3 / Lance Corporal", "E2 / Private First Class", "E1 / Private",
  "E9 / Master Chief Hospital Corpsman", "E8 / Senior Chief Corpsman", "E7 / Chief Corpsman", "E6 / Corpsman First Class", "E5 / Corpsman Second Class",
  "E4 / Corpsman Third Class", "E3 / Hospitalman", "E2 / Hospitalman Apprentice", "E6 / Technical Sergeant", "E5 / Staff Sergeant", "E4 / Senior Airman",
  "E3 / Airman First Class", "E2 / Airman", "E1 / Airman Basic", "Reservist",
];
export const PLATOONS = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", "Reserves"];
export const MEDALS = [
  ["Medal of Honor Medal.png", "Medal of Honor"], ["Navy Cross Medal.png", "Navy Cross"], ["Air Force Cross Medal.png", "Air Force Cross"],
  ["Silver Medal.png", "Silver Star"], ["Bronze Star Medal.png", "Bronze Star"], ["Navy Achievement Medal.png", "Navy Achievement Medal"],
  ["Air Force Achivement Medal.png", "Air Force Achievement Medal"], ["POW Medal.png", "POW Medal"],
];
/** Same as the Terminal's personnel-file edit roles (member-actions.js). */
export const EDIT_ROLES = new Set(["commander", "officer", "developer", "staff_nco"]);
export const memberName = (u: U) => {
  const abbr = String(u.rank || "").split("/").pop()?.trim() ?? "";
  const f = String(u.firstName || "").trim(), l = String(u.lastName || "").trim(), cs = String(u.callsign || "").trim();
  return [abbr, `${f ? f[0]!.toUpperCase() + ". " : ""}${cs && cs !== f ? `"${cs}"` : l}`.trim()].filter(Boolean).join(" ") || "—";
};
