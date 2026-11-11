"use client";

/**
 * After Action Reports grid + report window — the original resources-aar.html script, ported.
 * The 1:1 page conversion kept the markup but lost this script, so the page sat on
 * "RETRIEVING OPERATIONAL DATA…" forever. Data now comes from the server page (no Firebase).
 * Writes into the page's existing elements (#aarGrid, #aarModal, filters, stat counters).
 * All report text is escaped (the old script inserted it raw).
 */
import { useEffect } from "react";
import type { PublicAar } from "@/lib/aar/public";

const UNIT_LOGOS: Record<string, string> = {
  alpha: "/images/logos/Alpha Company.png",
  forcerecon: "/images/logos/Stalker_Patch.png",
  corpsman: "/images/logos/Hospital_Corpsman.png",
  airwing: "/images/logos/54th Air Wing.png",
  combined: "/images/logo.png",
};
const UNIT_LABELS: Record<string, string> = {
  alpha: "Alpha Company", forcerecon: "JTF-23 Force Recon", corpsman: "Hospital Corpsman", airwing: "54th Air Wing", combined: "Combined Arms",
};
const TYPE_LABELS: Record<string, string> = { main_op: "Main Op", patrol: "Patrol", deployment: "Deployment", fun_op: "Fun Op" };
const RESULT_LABELS: Record<string, string> = { success: "Mission Success", partial: "Partial Success", failure: "Mission Failure" };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const txt = (s: unknown) => esc(s).replace(/\n/g, "<br>");
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "—");

export default function AarLive({ aars }: { aars: PublicAar[] }) {
  useEffect(() => {
    const $ = (id: string) => document.getElementById(id);
    const set = (id: string, v: number) => { const el = $(id); if (el) el.textContent = String(v); };
    set("statTotal", aars.length);
    set("statMajor", aars.filter((a) => a.operationType === "main_op").length);
    set("statRegular", aars.filter((a) => a.operationType === "deployment").length);
    set("statPatrol", aars.filter((a) => a.operationType === "patrol").length);

    const grid = $("aarGrid");
    const modal = $("aarModal");
    const content = $("aarModalContent");
    if (!grid) return;

    const renderGrid = (list: PublicAar[]) => {
      grid.innerHTML = list.length
        ? list.map((a) => `
          <button type="button" class="aar-card" data-id="${esc(a.id)}" style="text-align:left;font:inherit;color:inherit;width:100%">
            <div class="aar-card-header">
              <img class="aar-unit-logo" src="${esc(UNIT_LOGOS[String(a.unit)] || "/images/logo.png")}" alt="${esc(UNIT_LABELS[String(a.unit)] || "")}">
              <div class="aar-card-meta"><div class="aar-op-name">${esc(a.title || "Unnamed Operation")}</div><div class="aar-date">📅 ${fmt(a.dateISO)}</div></div>
            </div>
            <div class="aar-badges">
              <span class="aar-badge badge-${esc(a.operationType || "regular")}">${esc(TYPE_LABELS[String(a.operationType)] || "Deployment")}</span>
              <span class="aar-badge badge-${esc(a.result || "success")}">${esc(RESULT_LABELS[String(a.result)] || "Success")}</span>
            </div>
            <p class="aar-summary">${esc(a.summary || "No summary provided.")}</p>
            <div class="aar-card-footer"><span>CO: ${esc(a.commander || "Unknown")}</span><span class="aar-read-more">READ REPORT →</span></div>
          </button>`).join("")
        : '<div class="aar-empty"><div class="aar-empty-icon">📋</div><p>No reports found.</p></div>';
    };

    const sec = (title: string, v: unknown) => (v ? `<div class="aar-modal-section"><div class="aar-modal-section-title">${title}</div><p class="aar-modal-text">${txt(v)}</p></div>` : "");
    const line = (label: string, v: unknown) => (v ? `<p class="aar-modal-text"><strong style="color:rgba(255,255,255,0.6);">${label}:</strong> ${txt(v)}</p>` : "");
    const info = (label: string, v: unknown) => `<div class="aar-modal-info-item"><span class="aar-modal-info-label">${label}</span><span class="aar-modal-info-value">${v}</span></div>`;

    const open = (id: string) => {
      const a = aars.find((x) => x.id === id);
      if (!a || !modal || !content) return;
      const att = ((a.attachments as string[]) || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener" style="display:block;margin-bottom:0.5rem;"><img src="${esc(u)}" alt="Attachment" style="max-width:100%;max-height:300px;object-fit:contain;border:1px solid rgba(0,217,255,0.2);"></a>`).join("");
      const group = (title: string, rows: string) => (rows ? `<div class="aar-modal-section"><div class="aar-modal-section-title">${title}</div>${rows}</div>` : "");
      content.innerHTML = `
        <button class="aar-modal-close" type="button" data-close aria-label="Close report">✕</button>
        <div style="text-align:center;padding:0.6rem;background:rgba(0,0,0,0.4);border:1px solid rgba(0,217,255,0.15);margin-bottom:1.2rem;line-height:1.8;">
          <div style="font-size:0.65rem;letter-spacing:0.2em;color:var(--accent);">CLASSIFICATION: ${esc(a.classification || "CL-5")}</div>
          <div style="font-size:0.8rem;letter-spacing:0.12em;color:rgba(255,255,255,0.5);">BATTALION AFTER ACTION REPORT // 505TH EXPEDITIONARY FORCE</div>
          <div style="font-size:0.75rem;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">DISTRIBUTION OUTSIDE 505TH CLASSIFIED DOCUMENT AUTHORITY IS STRICTLY PROHIBITED</div>
        </div>
        <div class="aar-modal-title">${esc(a.title || "Unnamed Operation")}</div>
        <div class="aar-modal-date">📅 ${fmt(a.dateISO)}</div>
        <div class="aar-modal-header-row">
          <img class="aar-modal-logo" src="${esc(UNIT_LOGOS[String(a.unit)] || "/images/logo.png")}" alt="">
          <div class="aar-modal-info"><div class="aar-modal-info-row">
            ${info("Unit", esc(UNIT_LABELS[String(a.unit)] || "—"))}
            ${info("Operation Type", esc(TYPE_LABELS[String(a.operationType)] || "—"))}
            ${info("Commanding Officer", esc(a.commander || "—"))}
            ${info("Filed By", esc(a.filedBy || a.submittedByName || "—"))}
            ${info("Location", esc(a.location || "—"))}
            ${info("Personnel", esc(a.personnel ?? "—"))}
            ${info("Casualties", `<span class="aar-cascount">${esc(a.casualties ?? "—")}</span>`)}
            ${info("Result", `<span class="aar-badge badge-${esc(a.result)}">${esc(RESULT_LABELS[String(a.result)] || "—")}</span>`)}
          </div></div>
        </div>
        ${sec("Main Objective", a.mainObjective)}${sec("Commander's Intent", a.commanderIntent)}${sec("Objective Standards", a.objectiveStandards)}
        ${sec("Planned Execution", a.plannedExecution)}${sec("Actual Execution", a.summary)}${sec("Units Involved", a.unitsInvolved)}
        ${group("Enemy Forces", line("Faction", a.enemyFaction) + line("Est. Enemy Casualties", a.enemyCasualties) + line("Disposition", a.enemyDisposition) + line("Tactics Observed", a.enemyTactics))}
        ${group("Tactical Notes &amp; Events", line("Key Moments", a.keyMoments) + line("Successful Maneuvers", a.successfulManeuvers) + line("Mistakes / Failures", a.mistakes) + line("Unexpected Occurrences", a.unexpected))}
        ${group("Conclusion", line("Objective Outcome", a.objectiveOutcome) + line("Operational Followup / Recommendations", a.recommended) + line("Lessons Learned", a.lessonsLearned) + line("Misc. Comments", a.miscComments))}
        ${att ? `<div class="aar-modal-section"><div class="aar-modal-section-title">Attachments</div>${att}</div>` : ""}
        <div style="font-size:0.7rem;color:rgba(255,255,255,0.25);letter-spacing:0.08em;margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.07);">
          SUBMITTED BY: ${esc(a.submittedByName || "UNKNOWN")} // CLASSIFICATION: ${esc(a.classification || "CL-5")} // 505TH EXPEDITIONARY FORCE
        </div>`;
      modal.classList.add("active");
      (content.querySelector("[data-close]") as HTMLElement | null)?.focus();
    };
    const close = () => modal?.classList.remove("active");

    const apply = () => {
      const v = (id: string) => ((($(id) as HTMLInputElement | HTMLSelectElement | null)?.value) || "");
      const unit = v("filterUnit"), type = v("filterType"), result = v("filterResult"), q = v("aarSearch").toLowerCase();
      renderGrid(aars.filter((a) => (!unit || a.unit === unit) && (!type || a.operationType === type) && (!result || a.result === result)
        && (!q || String(a.title || "").toLowerCase().includes(q) || String(a.summary || "").toLowerCase().includes(q))));
    };

    const onGrid = (e: Event) => { const c = (e.target as HTMLElement).closest("[data-id]") as HTMLElement | null; if (c) open(c.dataset.id!); };
    const onModal = (e: Event) => { if (e.target === modal || (e.target as HTMLElement).closest("[data-close], #aarModalClose")) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    grid.addEventListener("click", onGrid);
    modal?.addEventListener("click", onModal);
    document.addEventListener("keydown", onKey);
    const filters = ["filterUnit", "filterType", "filterResult"].map($).filter(Boolean) as HTMLElement[];
    filters.forEach((el) => el.addEventListener("change", apply));
    $("aarSearch")?.addEventListener("input", apply);
    renderGrid(aars);
    return () => {
      grid.removeEventListener("click", onGrid);
      modal?.removeEventListener("click", onModal);
      document.removeEventListener("keydown", onKey);
      filters.forEach((el) => el.removeEventListener("change", apply));
      $("aarSearch")?.removeEventListener("input", apply);
    };
  }, [aars]);
  return null;
}
