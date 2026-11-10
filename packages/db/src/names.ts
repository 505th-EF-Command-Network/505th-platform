/**
 * Member display name — the 505th rule (decided 2026-11-09):
 *
 *   With a callsign:     [RANK] [F]. "[CALLSIGN]"      → SSgt S. "Davy"
 *   Without a callsign:  [RANK] [F]. [M]. [LASTNAME]   → SSgt S. M. Jones
 *                        (middle initial only when the member has one)
 *                                                      → SSgt S. Jones
 */
export type NameParts = {
  rankAbbrev?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  callsign?: string | null;
};

const initial = (s?: string | null) => {
  const t = (s ?? "").trim();
  return t ? `${t[0].toUpperCase()}.` : "";
};

export function displayName(p: NameParts): string {
  const rank = (p.rankAbbrev ?? "").trim();
  const first = initial(p.firstName);
  const callsign = (p.callsign ?? "").trim();
  const parts = callsign
    ? [rank, first, `"${callsign}"`]
    : [rank, first, initial(p.middleName), (p.lastName ?? "").trim()];
  return parts.filter(Boolean).join(" ");
}

/** Short operator id used in the terminal boot line: callsign, else f.lastname. */
export function operatorId(p: NameParts): string {
  const callsign = (p.callsign ?? "").trim();
  if (callsign) return callsign.toLowerCase().replace(/\s+/g, "_");
  const f = (p.firstName ?? "").trim()[0] ?? "";
  return `${f}.${(p.lastName ?? "").trim()}`.toLowerCase().replace(/\s+/g, "_");
}
