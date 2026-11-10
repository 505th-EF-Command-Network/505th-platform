/**
 * Rank table — every rank used by the 505th, with its grade and the short
 * abbreviation used in display names (e.g. "SSgt S. Jones").
 *
 * The old Firebase records store ranks as "E6 / Staff Sergeant". `parseRank`
 * turns that into a Rank entry. Unknown ranks are kept as-is (abbrev = title)
 * so nothing is lost; add them to this table when they appear.
 */
export type RankBranch = "marine" | "corpsman" | "air" | "officer" | "reserve";

export type Rank = {
  /** Stable key stored in MongoDB, e.g. "E6-SSGT". */
  key: string;
  /** Pay grade, e.g. "E6". Empty for Reservist. */
  grade: string;
  title: string;
  abbrev: string;
  branch: RankBranch;
  /** Sort order: higher = more senior. */
  order: number;
};

const R = (grade: string, title: string, abbrev: string, branch: RankBranch, order: number): Rank => ({
  key: `${grade || "RES"}-${abbrev.toUpperCase().replace(/[^A-Z0-9]/g, "")}`,
  grade,
  title,
  abbrev,
  branch,
  order,
});

export const RANKS: Rank[] = [
  R("", "Reservist", "Res", "reserve", 0),
  // Marines (enlisted)
  R("E1", "Private", "Pvt", "marine", 10),
  R("E2", "Private First Class", "PFC", "marine", 20),
  R("E3", "Lance Corporal", "LCpl", "marine", 30),
  R("E4", "Corporal", "Cpl", "marine", 40),
  R("E5", "Sergeant", "Sgt", "marine", 50),
  R("E6", "Staff Sergeant", "SSgt", "marine", 60),
  R("E7", "Gunnery Sergeant", "GySgt", "marine", 70),
  R("E8", "Master Sergeant", "MSgt", "marine", 80),
  R("E8", "First Sergeant", "1stSgt", "marine", 81),
  R("E9", "Master Gunnery Sergeant", "MGySgt", "marine", 90),
  R("E9", "Sergeant Major", "SgtMaj", "marine", 91),
  // Hospital Corpsmen (Navy)
  R("E1", "Hospital Recruit", "HR", "corpsman", 11),
  R("E2", "Hospital Apprentice", "HA", "corpsman", 21),
  R("E3", "Hospitalman", "HN", "corpsman", 31),
  R("E4", "Corpsman Third Class", "HM3", "corpsman", 41),
  R("E5", "Corpsman Second Class", "HM2", "corpsman", 51),
  R("E6", "Corpsman First Class", "HM1", "corpsman", 61),
  R("E7", "Chief Corpsman", "HMC", "corpsman", 71),
  R("E8", "Senior Chief Corpsman", "HMCS", "corpsman", 82),
  R("E9", "Master Chief Corpsman", "HMCM", "corpsman", 92),
  // 54th Air Wing (Air Force)
  R("E1", "Airman Basic", "AB", "air", 12),
  R("E2", "Airman", "Amn", "air", 22),
  R("E3", "Airman First Class", "A1C", "air", 32),
  R("E4", "Senior Airman", "SrA", "air", 42),
  R("E5", "Staff Sergeant", "SSgt", "air", 52),
  R("E6", "Technical Sergeant", "TSgt", "air", 62),
  R("E7", "Master Sergeant", "MSgt", "air", 72),
  R("E8", "Senior Master Sergeant", "SMSgt", "air", 83),
  R("E9", "Chief Master Sergeant", "CMSgt", "air", 93),
  // Officers
  R("O1", "Second Lieutenant", "2ndLt", "officer", 100),
  R("O2", "First Lieutenant", "1stLt", "officer", 110),
  R("O3", "Captain", "Capt", "officer", 120),
  R("O4", "Major", "Maj", "officer", 130),
  R("O5", "Lieutenant Colonel", "LtCol", "officer", 140),
  R("O6", "Colonel", "Col", "officer", 150),
  R("O7", "Brigadier General", "BGen", "officer", 160),
  R("O8", "Major General", "MajGen", "officer", 170),
  R("O9", "Lieutenant General", "LtGen", "officer", 180),
  R("O10", "General", "Gen", "officer", 190),
];

const byKey = new Map(RANKS.map((r) => [r.key, r]));

export function rankByKey(key: string | undefined | null): Rank | undefined {
  return key ? byKey.get(key) : undefined;
}

/**
 * Parse the old "E6 / Staff Sergeant" format (or just "Reservist").
 * Grade + title together pick the right branch (E5 Staff Sergeant = Air Force,
 * E6 Staff Sergeant = Marines).
 */
export function parseRank(raw: string | undefined | null): Rank | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  const m = s.match(/^([EO]\d{1,2})\s*\/\s*(.+)$/i);
  const grade = m ? m[1].toUpperCase() : "";
  const title = (m ? m[2] : s).trim().toLowerCase();
  return (
    RANKS.find((r) => r.grade === grade && r.title.toLowerCase() === title) ??
    RANKS.find((r) => !grade && r.title.toLowerCase() === title)
  );
}

/** The original label, as the old site showed it: "E6 / Staff Sergeant". */
export function rankLabel(r: Rank): string {
  return r.grade ? `${r.grade} / ${r.title}` : r.title;
}
