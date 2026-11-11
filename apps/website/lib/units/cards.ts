import "server-only";
import { TerminalDoc, connectDb } from "@505th/db";
import UNITS from "@/lib/unit-cards.json";

/**
 * Public unit cards (career pages) + battalion stats. Same data as the old site:
 * settings/unit_cards (written by Terminal → Order of Battle) and the users list for live rank + name.
 * Key format is unchanged from the old site: `${unit}__${section}__${squad}__${slot}` (squad part left out
 * when empty), spaces → underscores. Hidden section: `__SECTION_HIDDEN__${unit}__${section}` = true.
 */
export type UnitCfg = { id: string; page: string; label: string; unit: string; accent: string; sections: Record<string, string[]>; stats?: boolean; bcStyle?: boolean };
export type Slot = { slot: string; status: "open" | "filled" | "closed"; name: string; rank: string; rankFull: string };
export type CardSection = { title: string; hidden: boolean; staff: Slot[]; squads: { name: string; slots: Slot[] }[]; filled: number; total: number };
export type UnitCards = { cfg: UnitCfg; sections: CardSection[]; filled: number; total: number };

export const UNIT_CFG = UNITS as unknown as UnitCfg[];
export const unitKey = (unit: string, sec: string, squad: string, slot: string) => (unit + "__" + sec + "__" + (squad ? squad + "__" + slot : slot)).split(" ").join("_");
const hiddenKey = (unit: string, sec: string) => ("__SECTION_HIDDEN__" + unit + "__" + sec).split(" ").join("_");

const RANK: Record<string, string> = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen", "O6 / Colonel": "Col", "O5 / Lieutenant Colonel": "LtCol",
  "O4 / Major": "Maj", "O3 / Captain": "Capt", "O2 / First Lieutenant": "1stLt", "O1 / Second Lieutenant": "2ndLt", "E9 / Sergeant Major": "SgtMaj",
  "E9 / Master Gunnery Sergeant": "MGySgt", "E9 / First Sergeant": "1stSgt", "E8 / Master Sergeant": "MSgt", "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt",
  "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl", "E3 / Lance Corporal": "LCpl", "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO", "E7 / Chief Corpsman": "CPO", "E6 / Corpsman First Class": "HM1",
  "E5 / Corpsman Second Class": "HM2", "E4 / Corpsman Third Class": "HM3", "E3 / Hospitalman": "HM", "E2 / Hospitalman Apprentice": "HA",
  "E6 / Technical Sergeant": "TSgt", "E4 / Senior Airman": "SrA", "E3 / Airman First Class": "A1C", "E2 / Airman": "Amn", "E1 / Airman Basic": "AB", Reservist: "Res",
};
type U = { rank?: string; firstName?: string; lastName?: string; callsign?: string; status?: string; platoon?: string; joinedAt?: string };
function shortName(u: U) {
  const first = (u.firstName || "").trim(), last = (u.lastName || "").trim(), cs = (u.callsign || "").trim();
  const init = first ? first[0].toUpperCase() + "." : "";
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  return [init, hasCs ? `"${cs}"` : last || (cs ? `"${cs}"` : "")].filter(Boolean).join(" ");
}

async function loadAll() {
  await connectDb();
  const [cards, users] = await Promise.all([
    TerminalDoc.findById("settings/unit_cards", { data: 1 }).lean(),
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
  ]);
  const uc = ((cards?.data ?? {}) as Record<string, any>);
  const byId = new Map(users.map((d) => [String(d.docId), (d.data ?? {}) as U]));
  return { uc, byId, users: [...byId.values()] };
}

export async function getUnitCards(id: string): Promise<UnitCards | null> {
  const cfg = UNIT_CFG.find((u) => u.id === id);
  if (!cfg) return null;
  const { uc, byId } = await loadAll();
  const read = (sec: string, sq: string, slot: string): Slot => {
    const v = (uc[unitKey(cfg.unit, sec, sq, slot)] ?? {}) as { status?: string; userId?: string; name?: string };
    const status = v.status === "filled" || v.status === "closed" ? v.status : "open";
    const u = v.userId ? byId.get(v.userId) : undefined;
    const rankFull = u?.rank || "";
    const rank = RANK[rankFull] || (rankFull ? rankFull.split("/").pop()!.trim() : "");
    // Linked member → live rank + name (follows promotions). Typed name only (old cards) → shown as typed.
    const name = u ? shortName(u) : String(v.name || "");
    return { slot, status, name: status === "filled" ? name : "", rank: status === "filled" && u ? rank : "", rankFull: u ? rankFull : "" };
  };
  const sections: CardSection[] = Object.entries(cfg.sections).map(([title, slots]) => {
    const staff: Slot[] = [];
    const squads: { name: string; slots: Slot[] }[] = [];
    let cur: { name: string; slots: Slot[] } | null = null;
    for (const s of slots) {
      if (/SQL$/.test(s)) { cur = { name: s.replace(/ SQL$/, "").trim(), slots: [] }; squads.push(cur); cur.slots.push(read(title, cur.name, s)); }
      else if (cur) cur.slots.push(read(title, cur.name, s));
      else staff.push(read(title, "", s));
    }
    const all = [...staff, ...squads.flatMap((q) => q.slots)];
    return { title, hidden: uc[hiddenKey(cfg.unit, title)] === true, staff, squads, filled: all.filter((x) => x.status === "filled").length, total: all.filter((x) => x.status !== "closed").length };
  });
  const vis = sections.filter((s) => !s.hidden);
  return { cfg, sections, filled: vis.reduce((a, s) => a + s.filled, 0), total: vis.reduce((a, s) => a + s.total, 0) };
}

/** About 505th stats strip (same rules as the old page). */
export async function getBattalionStats() {
  const { users } = await loadAll();
  let active = 0, reserves = 0, earliest = Infinity;
  const platoons = new Set<string>();
  for (const u of users) {
    if (u.status === "pending" || u.status === "denied") continue;
    if (u.platoon === "Reserves") reserves++;
    else { active++; if (u.platoon) platoons.add(u.platoon); }
    const t = u.joinedAt ? Date.parse(u.joinedAt) : NaN;
    if (Number.isFinite(t) && t < earliest) earliest = t;
  }
  const days = Number.isFinite(earliest) ? Math.floor((Date.now() - earliest) / 86400000) : 0;
  return { days, active, reserves, detachments: platoons.size };
}
