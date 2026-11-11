"use client";

/**
 * Live roster table — the original resources-roster.html script, ported as-is
 * (same grouping, filters, columns and markup). Data comes from the server
 * page instead of Firebase. It writes into the page's existing elements
 * (#rosterGroups, #searchInput, #platoonFilter, #rankSort, stat counters).
 */
import { useEffect } from "react";
import type { RosterRow } from "@/lib/roster/data";

const PLATOON_ORDER = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Reserves"];

const RANK_ABBR: Record<string, string> = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen",
  "O6 / Colonel": "Col", "O5 / Lieutenant Colonel": "LtCol", "O4 / Major": "Maj",
  "O3 / Captain": "Capt", "O2 / First Lieutenant": "1stLt", "O1 / Second Lieutenant": "2ndLt",
  "E9 / Sergeant Major": "SgtMaj", "E9 / Master Gunnery Sergeant": "MGySgt", "E9 / First Sergeant": "1stSgt",
  "E8 / Master Sergeant": "MSgt", "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt",
  "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl", "E3 / Lance Corporal": "LCpl",
  "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO",
  "E7 / Chief Corpsman": "CPO", "E6 / Corpsman First Class": "HM1", "E5 / Corpsman Second Class": "HM2",
  "E4 / Corpsman Third Class": "HM3", "E3 / Hospitalman": "HM", "E2 / Hospitalman Apprentice": "HA",
  "E6 / Technical Sergeant": "TSgt", "E5 / Staff Sergeant": "SSgt",
  "E4 / Senior Airman": "SrA", "E3 / Airman First Class": "A1C", "E2 / Airman": "Amn", "E1 / Airman Basic": "AB",
  Reservist: "Res",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function calcPeriod(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr), now = new Date();
  const m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (Number.isNaN(m)) return "—";
  const y = Math.floor(m / 12), r = m % 12;
  return (y > 0 ? y + "y " : "") + r + "m";
}

function attPips(att: number) {
  let html = '<div class="att-bar">';
  for (let i = 1; i <= 3; i++) html += `<div class="att-pip ${att >= i ? `filled-${att}` : ""}"></div>`;
  return html + `<span style="font-size:9px;color:#aaa;margin-left:4px">${att}/3</span></div>`;
}

const getRankAbbr = (rank: string) => RANK_ABBR[rank] || (rank ? rank.split("/").pop()!.trim() : "");

function formatMemberName(u: RosterRow) {
  const rankAbbr = getRankAbbr(u.rank);
  const first = u.firstName.trim(), last = u.lastName.trim(), callsign = u.callsign.trim();
  const firstInit = first ? first.charAt(0).toUpperCase() + "." : "";
  const hasCallsign = callsign && callsign !== first && callsign !== `${first} ${last}`;
  let name = "";
  if (firstInit) name += firstInit + " ";
  if (hasCallsign) name += `"${callsign}"`;
  else if (last) name += last;
  else if (callsign) name += `"${callsign}"`;
  return [rankAbbr, name.trim()].filter(Boolean).join(" ");
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US") : "—");

function getRankSortOrder(rank: string) {
  if (!rank) return 999;
  const m = rank.match(/^([OE])(\d+)/);
  if (!m) return 998;
  return (m[1] === "O" ? 0 : 100) + (99 - parseInt(m[2], 10));
}

/** Coloured paygrade badge (O = orange officer, E = cyan enlisted, RES = grey) + the rank name. */
function paygrade(rank: string) {
  const m = String(rank || "").match(/^([OE]\d+)\s*\/\s*(.*)$/);
  const pg = m ? m[1] : rank === "Reservist" ? "RES" : "";
  const name = m ? m[2] : rank || "—";
  const c = pg[0] === "O" ? "#f59e0b" : pg[0] === "E" ? "#00D9FF" : "#8a9aa6";
  return `${pg ? `<span style="display:inline-block;min-width:36px;text-align:center;font:700 11px 'Share Tech Mono',monospace;padding:2px 6px;margin-right:8px;color:${c};border:1px solid ${c}80;background:${c}10">${esc(pg)}</span>` : ""}<span style="color:#cfd8dd">${esc(name)}</span>`;
}

function renderRoster(data: RosterRow[]) {
  const groups: Record<string, RosterRow[]> = {};
  data.forEach((r) => (groups[r.platoon || "Other"] ??= []).push(r));
  const set = (id: string, v: number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };
  set("statTotal", data.length);
  set("statActive", data.filter((r) => r.platoon !== "Reserves").length);
  set("statReserves", data.filter((r) => r.platoon === "Reserves").length);
  set("statPlatoons", Object.keys(groups).filter((k) => k !== "Reserves").length);

  const keys = Object.keys(groups).sort((a, b) => {
    const ai = PLATOON_ORDER.indexOf(a), bi = PLATOON_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const html = !keys.length
    ? '<div class="no-data">NO PERSONNEL ON RECORD</div>'
    : keys
        .map((platoon) => {
          const members = groups[platoon];
          return `
      <div class="platoon-section" data-platoon="${esc(platoon)}">
        <div class="platoon-label"><span>${esc(platoon)}</span><span class="platoon-count">${members.length} PERSONNEL</span></div>
        <div class="roster-table-wrap"><table class="roster-table">
          <thead><tr><th>NAME</th><th>PAYGRADE / RANK</th><th>JOINED PLATOON</th><th>PLATOON SERVICE</th><th>GRADUATION</th><th>TIME IN UNIT</th><th>ATT.</th><th>PT</th><th>RIBBONS</th></tr></thead>
          <tbody>${members
            .map(
              (r) => `<tr>
            <td class="name-cell">${esc(formatMemberName(r))}</td>
            <td>${paygrade(r.rank)}</td>
            <td>${fmtDate(r.joinedPlatoon)}</td>
            <td class="time-val">${calcPeriod(r.joinedPlatoon)}</td>
            <td>${fmtDate(r.graduation)}</td>
            <td class="time-val">${calcPeriod(r.graduation)}</td>
            <td>${attPips(r.attendance)}</td>
            <td><span class="pt-val">${r.promotionTracker}</span></td>
            <td><span class="ribbon-val" style="color:${r.ribbons ? "#2DD4BF" : "#555"}">${r.ribbons}</span></td>
          </tr>`,
            )
            .join("")}</tbody>
        </table></div>
      </div>`;
        })
        .join("");
  const target = document.getElementById("rosterGroups");
  if (target) target.innerHTML = html;
}

export default function RosterLive({ rows }: { rows: RosterRow[] }) {
  useEffect(() => {
    const search = document.getElementById("searchInput") as HTMLInputElement | null;
    const platoon = document.getElementById("platoonFilter") as HTMLSelectElement | null;
    const sort = document.getElementById("rankSort") as HTMLSelectElement | null;

    const apply = () => {
      const q = (search?.value || "").toLowerCase().trim();
      const p = platoon?.value || "";
      let list = rows;
      if (q)
        list = list.filter(
          (r) =>
            r.callsign.toLowerCase().includes(q) ||
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            formatMemberName(r).toLowerCase().includes(q),
        );
      if (p) list = list.filter((r) => r.platoon === p);
      const byName = (a: RosterRow, b: RosterRow) => formatMemberName(a).replace(/^\S+\s/, "").localeCompare(formatMemberName(b).replace(/^\S+\s/, ""));
      if (sort?.value === "rank-asc") list = [...list].sort((a, b) => getRankSortOrder(a.rank) - getRankSortOrder(b.rank) || byName(a, b));
      if (sort?.value === "rank-desc") list = [...list].sort((a, b) => getRankSortOrder(b.rank) - getRankSortOrder(a.rank) || byName(a, b));
      if (sort?.value === "name") list = [...list].sort(byName);
      renderRoster(list);
    };

    // ?platoon=Reserves deep link, as on the old page
    const urlPlatoon = new URLSearchParams(window.location.search).get("platoon");
    if (urlPlatoon && platoon) platoon.value = urlPlatoon;
    apply();

    search?.addEventListener("input", apply);
    platoon?.addEventListener("change", apply);
    sort?.addEventListener("change", apply);
    return () => {
      search?.removeEventListener("input", apply);
      platoon?.removeEventListener("change", apply);
      sort?.removeEventListener("change", apply);
    };
  }, [rows]);
  return null;
}
