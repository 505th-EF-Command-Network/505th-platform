/**
 * 505th Command Terminal — PERSONNEL FILES v2 (approved mock 2026-11-09).
 *
 * New: tile grid with soldier photo, rank badge, status, role/platoon tags and
 * attendance bar, plus search and sort. Clicking a tile opens the file window.
 *
 * The file window IS the original Edit Operative modal (#editUserModal),
 * restyled into the approved layout (photo + summary on the left, tabs on the
 * right). All its original logic is kept untouched: Details save, Service
 * Record (promotions, transfers, commendations, ribbons, warnings), retired
 * freeze, callsign lock, role limits, webhooks, notifications and audit log.
 * This module only adds the left panel, a close button and an Attendance tab.
 */
import { getAuth } from "/terminal-shim/auth.js";
import { getFirestore, collection, doc, getDoc, getDocs } from "/terminal-shim/firestore.js";
import { hexAvatar, photoUrlOf } from "./_common.js";
import { ask, tell, audit } from "./_common.js";

const db = getFirestore();
const auth = getAuth();
const ROOT_ID = "pf2";

// Same tabs and order as the original panel.
const TABS = [
  ["ALL", "ALL"], ["Command", "COMMAND"], ["1st Platoon", "1ST PLT"], ["2nd Platoon", "2ND PLT"], ["3rd Platoon", "3RD PLT"],
  ["Force Recon", "FORCE RECON"], ["Corpsmen", "CORPSMEN"], ["Pilot", "PILOT"], ["Awaiting BCT", "AWAITING BCT"],
  ["Reserves", "RESERVES"], ["Inactive", "INACTIVE"], ["Retired", "RETIRED VETERAN"],
];
// From ROLE_PERMISSIONS in the original page.
const CAN_EDIT = new Set(["commander", "officer", "developer", "staff_nco"]);

const ROLE = {
  commander: ["COMMANDER", "#f59e0b"], officer: ["OFFICER", "#f59e0b"], developer: ["DEVELOPER", "#a78bfa"],
  staff_nco: ["STAFF NCO", "#00D9FF"], nco: ["NCO", "#38bdf8"], recruiter: ["RECRUITER", "#2dd4bf"],
  marine: ["MARINE", "#22e07a"], enlistee: ["ENLISTEE", "#94a3b8"], retired_veteran: ["RETIRED VET", "#c084fc"],
};
const STATUS = {
  active: ["ACTIVE", "#22e07a"], reserve: ["RESERVE", "#f59e0b"], inactive: ["INACTIVE", "#ff4d4d"],
  retired: ["RETIRED", "#c084fc"], bct: ["AWAITING BCT", "#38bdf8"],
};
const RANK_ABBR = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen", "O6 / Colonel": "Col",
  "O5 / Lieutenant Colonel": "LtCol", "O4 / Major": "Maj", "O3 / Captain": "Capt", "O2 / First Lieutenant": "1stLt",
  "O1 / Second Lieutenant": "2ndLt", "E9 / Sergeant Major": "SgtMaj", "E9 / Master Gunnery Sergeant": "MGySgt",
  "E9 / First Sergeant": "1stSgt", "E8 / Master Sergeant": "MSgt", "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt",
  "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl", "E3 / Lance Corporal": "LCpl", "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO", "E7 / Chief Corpsman": "CPO",
  "E6 / Corpsman First Class": "HM1", "E5 / Corpsman Second Class": "HM2", "E4 / Corpsman Third Class": "HM3",
  "E3 / Hospitalman": "HM", "E2 / Hospitalman Apprentice": "HA", "E6 / Technical Sergeant": "TSgt", "E5 / Staff Sergeant": "SSgt",
  "E4 / Senior Airman": "SrA", "E3 / Airman First Class": "A1C", "E2 / Airman": "Amn", "E1 / Airman Basic": "AB", Reservist: "Res",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rankAbbr = (r) => RANK_ABBR[r] || (r ? String(r).split("/").pop().trim() : "");
function memberName(u) {
  const first = (u.firstName || "").trim(), last = (u.lastName || "").trim(), cs = (u.callsign || "").trim();
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : last || (cs ? `"${cs}"` : "")}`.trim();
  return [rankAbbr(u.rank || ""), name].filter(Boolean).join(" ") || "—";
}
/** Rank order, highest first (O9 … E1, then Reservist / none). */
function rankOrder(r) {
  const m = String(r || "").match(/^([OE])(\d+)/);
  if (!m) return r === "Reservist" ? 900 : 999;
  return (m[1] === "O" ? 0 : 100) + (99 - parseInt(m[2], 10));
}
// Same rule as isInactive() in the original renderUsers().
function isInactive(u) {
  if (u.platoon === "Reserves" || u.platoon === "Awaiting BCT") return false;
  if (u.status === "inactive") return true;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  if (u.lastAttendedDate) return u.lastAttendedDate < cutoff.toISOString().slice(0, 10);
  return (u.opsAttended || 0) === 0 && (u.opsEligible || 0) > 0;
}
function statusOf(u) {
  if (u.role === "retired_veteran") return "retired";
  if (u.platoon === "Reserves") return "reserve";
  if (u.platoon === "Awaiting BCT") return "bct";
  if (isInactive(u)) return "inactive";
  return "active";
}
const attPct = (u) => (u.opsEligible ? Math.round(((u.opsAttended || 0) / u.opsEligible) * 100) : null);
const attColor = (a) => (a == null ? "#4b5765" : a >= 75 ? "#22e07a" : a >= 50 ? "#f59e0b" : "#ff4d4d");
/** Soldier photo the member sets on their profile page (field names accepted for the upcoming upload). */
const photoOf = (u) => photoUrlOf(u);
// No silhouette: an empty hex until the marine has a picture (Discord linked or own upload).
const HEX_EMPTY = `<span class="pf-hexwrap"><span class="hx hx-xl pf-hexempty" role="img" aria-label="No picture yet"></span></span>`;
const photoHtml = (u, big) => {
  const p = photoOf(u);
  // Same hex picture as the profile page (upload, else Discord picture).
  return p ? `<span class="pf-hexwrap">${hexAvatar(u, "xl")}</span>` : `${HEX_EMPTY}${big ? "" : '<div class="nophoto">NO PICTURE YET</div>'}`;
};

// ───────── state ─────────
let users = [];
let me = null;
let tab = "ALL";
let query = "";
let sort = "rank";
let openUid = null;

async function loadMe() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? { uid, ...s.data() } : null;
}
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  users = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.status !== "pending" && u.status !== "denied");
}

function inTab(u, t) {
  if (t === "ALL") return true;
  if (t === "Inactive") return isInactive(u);
  if (t === "Retired") return u.role === "retired_veteran";
  return u.platoon === t;
}
function filtered() {
  const q = query.trim().toLowerCase();
  const list = users
    .filter((u) => inTab(u, tab))
    .filter((u) => !q || [u.firstName, u.lastName, u.callsign, u.discordUsername, u.rank, memberName(u)].join(" ").toLowerCase().includes(q));
  const by = {
    rank: (a, b) => rankOrder(a.rank) - rankOrder(b.rank) || String(a.lastName).localeCompare(String(b.lastName)),
    name: (a, b) => String(a.lastName).localeCompare(String(b.lastName)),
    joined: (a, b) => String(b.joinedAt || "").localeCompare(String(a.joinedAt || "")),
    att: (a, b) => (attPct(a) ?? 101) - (attPct(b) ?? 101),
  }[sort];
  return list.sort(by);
}

// ───────── render grid ─────────
function render() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const canEdit = CAN_EDIT.has(me?.role);
  const list = filtered();
  const count = (t) => users.filter((u) => inTab(u, t)).length;
  root.querySelector(".tabs").innerHTML = TABS.map(
    ([k, l]) =>
      `<button class="tab ${k === tab ? "on" : ""} ${k === "Inactive" ? "warn" : ""}" role="tab" aria-selected="${k === tab}" data-tab="${esc(k)}">${l}<span class="n">${count(k)}</span></button>`,
  ).join("");
  root.querySelector(".count").textContent = `${list.length} MEMBER${list.length === 1 ? "" : "S"}`;
  root.querySelector(".grid").innerHTML = list.length
    ? list
        .map((u) => {
          const [rl, rc] = ROLE[u.role] || [String(u.role || "—").toUpperCase(), "#94a3b8"];
          const [sl, sc] = STATUS[statusOf(u)];
          const a = attPct(u);
          const lockedCmd = u.role === "commander" && me?.role !== "commander";
          const retired = u.role === "retired_veteran";
          const actions = !canEdit
            ? ""
            : lockedCmd
              ? `<div class="actions"><span class="lock">🔒 COMMANDER</span><button data-act="discord" data-id="${esc(u.id)}">DISCORD</button></div>`
              : `<div class="actions"><button data-act="edit" data-id="${esc(u.id)}">✎ EDIT</button><button data-act="record" data-id="${esc(u.id)}">☰ RECORD</button></div>`;
          return `<article class="card" tabindex="0" style="--rc:${rc}" data-id="${esc(u.id)}" data-open="${canEdit && !lockedCmd ? 1 : 0}" aria-label="${esc(memberName(u))}">
            <div class="pfp">${photoHtml(u)}<span class="badge-rank">${esc(rankAbbr(u.rank) || "—")}</span><span class="status"><i class="dot" style="background:${sc};box-shadow:0 0 6px ${sc}"></i>${sl}</span></div>
            <div class="body"><div class="name">${esc(memberName(u))}</div><div class="rankfull">${esc(u.rank || "No rank")}${retired ? " (Ret.)" : ""}</div>
              <div class="chips"><span class="chip" style="color:${rc};border-color:${rc}66">${esc(rl)}</span>${u.platoon ? `<span class="chip" style="color:#9fb3c4;border-color:#3b4a5a">${esc(u.platoon.toUpperCase())}</span>` : ""}</div>
              <div class="att">ATT<div class="bar"><i style="width:${a ?? 0}%;background:${attColor(a)}"></i></div>${a == null ? "—" : a + "%"}</div></div>
            ${actions}</article>`;
        })
        .join("")
    : '<div class="empty">NO PERSONNEL MATCH THIS FILTER</div>';
}

async function refresh() {
  try {
    if (!me) me = await loadMe();
    await loadUsers();
    render();
  } catch (e) {
    const g = document.querySelector(`#${ROOT_ID} .grid`);
    if (g) g.innerHTML = `<div class="empty" style="color:#ff4d4d">ERROR: ${esc(e.message)}</div>`;
  }
}

// ───────── file window (restyled original modal) ─────────
function restyleModal() {
  const modal = document.getElementById("editUserModal");
  const content = modal?.querySelector(".edit-modal-content");
  if (!content || content.classList.contains("pf2-win")) return;
  content.classList.add("pf2-win");
  modal.classList.add("pf2-modal");
  const main = document.createElement("section");
  main.className = "pf2-main";
  while (content.firstChild) main.appendChild(content.firstChild);
  const aside = document.createElement("aside");
  aside.className = "pf2-aside";
  aside.id = "pf2Aside";
  const close = document.createElement("button");
  close.className = "pf2-x";
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", () => window.closeEditModal());
  content.append(aside, main, close);
  pf3Setup(main);

  // Attendance tab (read-only) next to the original two tabs.
  const tabs = main.querySelector(".edit-tabs");
  const attTab = document.createElement("button");
  attTab.type = "button";
  attTab.className = "edit-tab pf2-att-tab";
  attTab.textContent = "▣ ATTENDANCE";
  tabs?.appendChild(attTab);
  const attPane = document.createElement("div");
  attPane.className = "edit-tab-pane";
  attPane.id = "editPane-att";
  document.getElementById("editPane-history")?.after(attPane);
  attTab.addEventListener("click", () => {
    document.querySelectorAll("#editUserModal .edit-tab").forEach((t) => t.classList.toggle("active", t === attTab));
    document.querySelectorAll("#editUserModal .edit-tab-pane").forEach((p) => p.classList.toggle("active", p === attPane));
  });
  // The original switcher maps tabs by position; keep the extra tab switched off.
  const orig = window.switchEditTab;
  window.switchEditTab = function (t) {
    orig(t);
    attTab.classList.remove("active");
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) window.closeEditModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) window.closeEditModal();
  });
  // When the window closes (save, cancel or ✕), refresh the tiles.
  new MutationObserver(() => {
    if (!modal.classList.contains("active") && openUid) {
      openUid = null;
      refresh();
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
}

function fillAside(u) {
  const aside = document.getElementById("pf2Aside");
  if (!aside) return;
  const [rl, rc] = ROLE[u.role] || [String(u.role || "—").toUpperCase(), "#94a3b8"];
  const [sl, sc] = STATUS[statusOf(u)];
  const a = attPct(u);
  const canRemove = typeof window.canDeleteTarget === "function" && window.canDeleteTarget(u) && !(u.role === "commander" && me?.role !== "commander");
  aside.innerHTML = `
    <div class="pfp big">${photoHtml(u, true)}<span class="badge-rank">${esc(rankAbbr(u.rank) || "—")}</span></div>
    <div class="upnote">${u.photo?.source === "upload" ? `◉ OWN PICTURE (PROFILE PAGE) <button type="button" id="pf2PicRm" class="pf2-picrm">REMOVE</button>` : photoOf(u) ? "◉ DISCORD PICTURE" : "○ NO PICTURE — USES DISCORD PICTURE AFTER SIGN-IN"}</div>
    <div class="name">${esc(memberName(u))}</div><div class="rankfull">${esc(u.rank || "No rank")}${u.platoon ? " · " + esc(u.platoon) : ""}</div>
    <div class="pf3-chips"><span style="color:${rc}">${esc(rl)}</span><span style="color:${sc}">● ${sl}</span></div>
    <div class="pf3-qs"><div><b style="color:${attColor(a)}">${a == null ? "—" : a + "%"}</b><span>ATTENDANCE</span></div><div><b>${u.attendance ?? 0}/3</b><span>THIS MONTH</span></div><div><b>${(u.promotionHistory || []).length}</b><span>PROMOTIONS</span></div><div><b>${(u.commendationHistory || []).length}</b><span>MEDALS</span></div></div>
    <dl class="kv"><dt>ROLE</dt><dd style="color:${rc}">${esc(rl)}</dd><dt>STATUS</dt><dd style="color:${sc}">${sl}</dd>
      <dt>PLATOON</dt><dd>${esc(u.platoon || "—")}</dd><dt>JOINED</dt><dd>${esc((u.joinedAt || "").slice(0, 10) || "—")}</dd>
      <dt>ATTENDANCE</dt><dd style="color:${attColor(a)}">${a == null ? "—" : a + "%"}</dd>
      ${u.discordUsername ? `<dt>DISCORD</dt><dd>@${esc(u.discordUsername)}</dd>` : ""}</dl>
    ${canRemove ? `<div class="danger"><button type="button" id="pf2Remove">⚠ REMOVE FROM UNIT</button></div>` : ""}`;
  aside.querySelector("#pf2PicRm")?.addEventListener("click", async () => {
    const reason = await ask({ kind: "reason", title: "REMOVE PROFILE PICTURE?", body: "It goes back to their Discord picture. The reason is saved in the Audit Log.", item: memberName(u), go: "REMOVE PICTURE" });
    if (reason == null) return;
    const r = await fetch("/api/terminal/photo-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: u.id, reason }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return tell("COULD NOT REMOVE", String(j.error || r.status), "error");
    window.closeEditModal();
    setTimeout(refresh, 300);
  });
  aside.querySelector("#pf2Remove")?.addEventListener("click", async () => {
    window.closeEditModal();
    await window.removeUser(u.id, u.callsign || "");
    setTimeout(refresh, 400);
  });

  const pane = document.getElementById("editPane-att");
  if (pane)
    pane.innerHTML = `<div class="pf2-kpis">
      <div><b style="color:${attColor(a)}">${a == null ? "—" : a + "%"}</b><span>OVERALL</span></div>
      <div><b>${u.opsAttended || 0}</b><span>OPS ATTENDED</span></div>
      <div><b>${u.opsEligible || 0}</b><span>OPS ELIGIBLE</span></div>
      <div><b>${u.attendance ?? 0}/3</b><span>THIS CYCLE</span></div></div>
      <div class="pf2-last">LAST ATTENDED: <b>${esc(u.lastAttendedDate || "never")}</b></div>
      <p class="pf2-note">Attendance is logged in Battalion Ops → Attendance Tracker.</p>`;
}

function openFile(id, pane) {
  const u = users.find((x) => x.id === id);
  if (!u || typeof window.openEditUser !== "function") return;
  restyleModal();
  openUid = id;
  window.openEditUser(id);
  if (!document.getElementById("editUserModal")?.classList.contains("active")) {
    // Original list not loaded yet — load it, then try again.
    openUid = null;
    window.loadAllUsers?.();
    return setTimeout(() => openFile(id, pane), 600);
  }
  const title = document.getElementById("editModalTitle");
  if (title) title.textContent = "PERSONNEL FILE — " + memberName(u).toUpperCase();
  fillAside(u);
  window.switchEditTab(pane === "record" ? "history" : "details");
  pf3Open(u);
}


/* ═══════════ PERSONNEL FILE v3 (approved mock 2026-11-11) ═══════════
 * Details grouped into 4 boxes · role changed through a small window (what they gain / lose, reason → Audit Log)
 * · Service Record as one filtered timeline · Attendance with this-month pips and last ops · unsaved-changes bar.
 * The original form fields, add rows and save logic are reused as they are (moved, not rebuilt).
 */
const ROLE_ORDER = ["enlistee", "marine", "recruiter", "nco", "staff_nco", "officer", "developer", "commander", "retired_veteran"];
const DETAIL_FIELDS = { editRankSelect: "RANK", editFirstName: "FIRST NAME", editLastName: "LAST NAME", editCallsign: "CALLSIGN", editJoinedAt: "JOINED", editGraduation: "BCT", editDiscordId: "DISCORD ID", editDiscordUsername: "DISCORD USERNAME", editPlatoon: "PLATOON", editSquad: "SQUAD", editRoleSelect: "ROLE", editRecruitSource: "RECRUITED VIA" };
let pf3 = { u: null, init: {}, role: null, filter: "all", add: "promo", ra: null };
const $id = (i) => document.getElementById(i);
const fieldOf = (id) => $id(id)?.closest(".edit-field");

function pf3Setup(main) {
  // ── Details: 4 boxes ──
  const grid = $id("editPane-details")?.firstElementChild;
  if (grid && !grid.dataset.pf3) {
    grid.dataset.pf3 = "1";
    const box = (title, ids, extra = "") => {
      const sec = document.createElement("div");
      sec.className = "pf3-sec";
      sec.innerHTML = `<h4>${title}${extra}</h4><div class="pf3-fg"></div>`;
      const fg = sec.querySelector(".pf3-fg");
      for (const id of ids) { const el = id === "ROLEBOX" ? roleBox() : fieldOf(id); if (el) fg.appendChild(el); }
      return sec;
    };
    const wrap = document.createElement("div");
    wrap.className = "pf3-groups";
    wrap.append(
      box("IDENTITY", ["editFirstName", "editLastName", "editCallsign", "editRecruitSource"]),
      box("UNIT &amp; ROLE", ["editRankSelect", "ROLEBOX", "editPlatoon", "editSquad"]),
      box("DATES", ["editJoinedAt", "editGraduation"]),
      box("DISCORD", ["editDiscordId", "editDiscordUsername"], '<small id="pf3Linked"></small>'),
    );
    const roleField = fieldOf("editRoleSelect");
    if (roleField) { roleField.hidden = true; wrap.appendChild(roleField); }
    grid.replaceWith(wrap);
    wrap.addEventListener("input", pf3Dirty);
    wrap.addEventListener("change", pf3Dirty);
  }
  // ── Service record: timeline + one add box ──
  const hist = $id("editPane-history");
  if (hist && !$id("pf3Tl")) {
    const sections = [...hist.querySelectorAll(":scope > .history-section")];
    const typeOf = (sec) => (sec.querySelector("#histPlatoonList") ? "platoon" : sec.querySelector("#histPromoList") ? "promo" : sec.querySelector("#histWarnList") ? "warn" : sec.querySelector("#histCommendList") ? "commend" : sec.querySelector("#histRibbonList") ? "ribbon" : "");
    sections.forEach((sec) => { sec.dataset.pf3 = typeOf(sec); sec.classList.add("pf3-addsec"); });
    const top = document.createElement("div");
    top.innerHTML = `<div class="pf3-filt" id="pf3Filt" role="group" aria-label="Show"></div><ul class="pf3-tl" id="pf3Tl"></ul>
      <div class="pf3-add"><span class="pf3-k">+ ADD TO RECORD</span><div class="pf3-filt" id="pf3AddT" role="group" aria-label="Add">${[["promo", "▲ PROMOTION"], ["platoon", "⇄ TRANSFER"], ["warn", "⚠ WARNING"], ["commend", "★ MEDAL"], ["ribbon", "— RIBBON"]].map(([k, l]) => `<button type="button" data-addt="${k}">${l}</button>`).join("")}</div></div>`;
    hist.prepend(top);
    const addBox = top.querySelector(".pf3-add");
    sections.forEach((sec) => addBox.appendChild(sec));
    top.addEventListener("click", (e) => {
      const f = e.target.closest("[data-f]"); if (f) { pf3.filter = f.dataset.f; return pf3Timeline(); }
      const t = e.target.closest("[data-addt]"); if (t) { pf3.add = t.dataset.addt; return pf3AddShow(); }
      const d = e.target.closest("[data-del]"); if (d) { const [ty, i] = d.dataset.del.split(":"); return ty === "ribbon" ? window.deleteRibbonEntry?.(+i) : window.deleteHistoryEntry?.(ty, +i); }
      const ed = e.target.closest("[data-edm]"); if (ed) { pf3.add = "commend"; pf3AddShow(); window.editCommendEntry?.(+ed.dataset.edm); addBox.scrollIntoView({ block: "nearest" }); }
      const rg = e.target.closest("[data-rg]"); if (rg) rg.parentElement.classList.toggle("open");
    });
    // The original code re-draws its (hidden) lists after every add / remove → redraw the timeline from the saved record.
    const mo = new MutationObserver(() => { clearTimeout(pf3.t); pf3.t = setTimeout(pf3Reload, 250); });
    ["histPlatoonList", "histPromoList", "histWarnList", "histCommendList", "histRibbonList"].forEach((i) => $id(i) && mo.observe($id(i), { childList: true }));
  }
  // ── unsaved bar ──
  const act = main.querySelector(".edit-modal-actions");
  if (act && !$id("pf3Unsaved")) {
    const u = document.createElement("span");
    u.id = "pf3Unsaved";
    u.setAttribute("role", "status");
    act.prepend(u);
  }
  // ── save: role change reason → Audit Log ──
  if (!window.__pf3Save && typeof window.saveUserEdit === "function") {
    window.__pf3Save = window.saveUserEdit;
    window.saveUserEdit = async function () {
      const pending = pf3.role;
      await window.__pf3Save();
      if (!pending) return;
      const d = (await getDoc(doc(db, "users", pending.uid)).catch(() => null))?.data?.();
      if (d?.role === pending.to) {
        await audit("manpower", "ROLE CHANGED", `${pending.name}: ${roleLabel(pending.from)} → ${roleLabel(pending.to)} · Reason: ${pending.reason}`).catch(() => {});
        pf3.role = null;
      }
    };
  }
}

const roleLabel = (r) => (ROLE[r] || [String(r || "—").toUpperCase()])[0];
function roleBox() {
  const el = document.createElement("div");
  el.className = "edit-field";
  el.innerHTML = `<label>TERMINAL ROLE</label><div class="pf3-role"><span id="pf3RoleTxt">—</span><button type="button" id="pf3RoleBtn">CHANGE ROLE</button></div>`;
  el.querySelector("#pf3RoleBtn").addEventListener("click", pf3RoleWindow);
  return el;
}
function pf3RoleShow() {
  const u = pf3.u, sel = $id("editRoleSelect");
  if (!u || !sel) return;
  const cur = sel.value || "enlistee", was = u.role || "enlistee";
  const [, c] = ROLE[cur] || ["", "#94a3b8"];
  $id("pf3RoleTxt").innerHTML = cur !== was ? `<s style="opacity:.6">${esc(roleLabel(was))}</s> → <b style="color:#ffd166">${esc(roleLabel(cur))}</b> <small>(SAVE TO APPLY)</small>` : `<b style="color:${c}">${esc(roleLabel(cur))}</b>`;
  const canGive = [...sel.options].filter((o) => !o.hidden && !o.disabled).map((o) => o.value);
  const btn = $id("pf3RoleBtn");
  // Above your limit (or retired file frozen for others) → no CHANGE button, same rule as the original.
  btn.hidden = !canGive.includes(was);
}
async function roleAccess() {
  if (pf3.ra) return pf3.ra;
  const r = await fetch("/api/terminal/role-access", { cache: "no-store" }).catch(() => null);
  pf3.ra = r?.ok ? await r.json() : null;
  return pf3.ra;
}
async function pf3RoleWindow() {
  const u = pf3.u, sel = $id("editRoleSelect");
  if (!u || !sel) return;
  const was = u.role || "enlistee";
  const canGive = new Set([...sel.options].filter((o) => !o.hidden && !o.disabled).map((o) => o.value));
  const ra = await roleAccess();
  const has = (role, key) => { if (!ra) return false; if (role === "commander") return true; const o = ra.current?.[role]; return o && key in o ? o[key] === 1 : !!ra.builtIn?.[role]?.[key]; };
  let pick = sel.value || was;
  const ov = document.createElement("div");
  ov.className = "pf3-ov";
  const draw = () => {
    const gain = [], lose = [];
    if (ra && pick !== was) for (const it of ra.items) { const a = has(was, it.key), b = has(pick, it.key); if (!a && b) gain.push(it.label); if (a && !b) lose.push(it.label); }
    const up = ROLE_ORDER.indexOf(pick) > ROLE_ORDER.indexOf(was) && pick !== "retired_veteran";
    ov.innerHTML = `<div class="pf3-win" role="dialog" aria-modal="true" aria-label="Change role"><div class="pf3-wh">CHANGE ROLE — ${esc(memberName(u).toUpperCase())}</div><div class="pf3-wb">
      <div class="pf3-roles">${ROLE_ORDER.map((r) => { const ok = canGive.has(r) || r === was; return `<button type="button" class="pf3-ro ${r === was ? "cur" : ""} ${r === pick && r !== was ? "on" : ""}" ${ok && r !== was ? `data-pick="${r}"` : "disabled"}>${ok ? "" : "🔒 "}${esc(roleLabel(r))}${r === was ? " · NOW" : ""}</button>`; }).join("")}</div>
      ${pick === was ? '<p class="pf3-hint">Pick the new role.</p>' : `<div class="pf3-eff"><b>${esc(roleLabel(was))} → ${esc(roleLabel(pick))}</b> ${up ? "▲" : "▼"}
        ${gain.length ? `<div class="up">+ ${gain.map(esc).join(" · ")}</div>` : ""}${lose.length ? `<div class="dn">− ${lose.map(esc).join(" · ")}</div>` : ""}${!gain.length && !lose.length ? '<div class="pf3-hint">No Terminal pages change.</div>' : ""}
        ${pick === "retired_veteran" ? '<div class="dn">⚠ Retired: loses the Terminal, hidden from the roster and attendance, personnel file frozen.</div>' : ""}
        <div class="pf3-hint">From Officer Management → Role Access. Personal access changes still apply. Discord roles follow through Role Sync.</div></div>
        <label for="pf3Why">REASON (SAVED IN THE AUDIT LOG)</label><input id="pf3Why" maxlength="200" value="${esc(pf3.role?.reason || "")}" autocomplete="off">`}
      </div><div class="pf3-wf"><button type="button" class="pf3-b" data-x="no">CANCEL</button><button type="button" class="pf3-b gold" data-x="ok" ${pick === was ? "disabled" : ""}>SET ROLE</button></div></div>`;
    ov.querySelector("#pf3Why")?.focus();
  };
  draw();
  ov.addEventListener("click", (e) => {
    const p = e.target.closest("[data-pick]"); if (p) { const w = $id("pf3Why")?.value; pick = p.dataset.pick; draw(); if (w && $id("pf3Why")) $id("pf3Why").value = w; return; }
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "no" || e.target === ov) return ov.remove();
    if (x === "ok") {
      const why = ($id("pf3Why")?.value || "").trim();
      if (why.length < 3) { $id("pf3Why")?.focus(); $id("pf3Why")?.classList.add("bad"); return; }
      sel.value = pick;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      pf3.role = { uid: u.id, name: memberName(u), from: was, to: pick, reason: why };
      ov.remove();
      pf3RoleShow();
      pf3Dirty();
    }
  });
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); ov.remove(); } });
  $id("editUserModal").appendChild(ov);
}

function pf3Open(u) {
  pf3.u = u;
  pf3.role = null;
  pf3.init = Object.fromEntries(Object.keys(DETAIL_FIELDS).map((k) => [k, $id(k)?.value ?? ""]));
  const l = $id("pf3Linked");
  if (l) l.textContent = /^\d{17,20}$/.test(u.discordId || "") ? "✓ LINKED" : "NOT LINKED";
  pf3RoleShow();
  pf3Dirty();
  pf3.filter = "all";
  pf3AddShow();
  pf3Reload();
  pf3Attendance(u);
}
function pf3Dirty() {
  const changed = Object.keys(DETAIL_FIELDS).filter((k) => $id(k) && ($id(k).value ?? "") !== pf3.init[k]);
  Object.keys(DETAIL_FIELDS).forEach((k) => fieldOf(k)?.classList.toggle("pf3-chg", changed.includes(k)));
  const r = $id("pf3RoleBtn")?.closest(".edit-field"); r?.classList.toggle("pf3-chg", changed.includes("editRoleSelect"));
  const el = $id("pf3Unsaved");
  if (el) el.textContent = changed.length ? `● ${changed.length} UNSAVED CHANGE${changed.length === 1 ? "" : "S"} — ${changed.map((k) => DETAIL_FIELDS[k]).join(", ")}` : "";
  if (changed.includes("editRoleSelect") || !changed.length) pf3RoleShow();
}

/* ── service record timeline ── */
const KIND = { promo: ["PROMOTED", "#22e07a"], platoon: ["TRANSFER", "#00D9FF"], warn: ["WARNING", "#f59e0b"], commend: ["MEDAL", "#a78bfa"], ribbon: ["RIBBON", "#2dd4bf"] };
async function pf3Reload() {
  const u = pf3.u;
  if (!u) return;
  const d = (await getDoc(doc(db, "users", u.id)).catch(() => null))?.data?.();
  if (d) Object.assign(u, { promotionHistory: d.promotionHistory || [], platoonHistory: d.platoonHistory || [], warningHistory: d.warningHistory || [], commendationHistory: d.commendationHistory || [], ribbonHistory: d.ribbonHistory || [] });
  pf3Timeline();
}
function pf3Timeline() {
  const u = pf3.u, tl = $id("pf3Tl"), fl = $id("pf3Filt");
  if (!u || !tl || !fl) return;
  const L = { promo: u.promotionHistory || [], platoon: u.platoonHistory || [], warn: u.warningHistory || [], commend: u.commendationHistory || [], ribbon: u.ribbonHistory || [] };
  const total = Object.values(L).reduce((a, x) => a + x.length, 0);
  fl.innerHTML = [["all", "ALL", total], ["promo", "▲ PROMOTIONS", L.promo.length], ["platoon", "⇄ TRANSFERS", L.platoon.length], ["warn", "⚠ WARNINGS", L.warn.length], ["commend", "★ MEDALS", L.commend.length], ["ribbon", "— RIBBONS", L.ribbon.length]]
    .map(([k, l, n]) => `<button type="button" data-f="${k}" class="${pf3.filter === k ? "on" : ""}" aria-pressed="${pf3.filter === k}">${l} <span>${n}</span></button>`).join("");
  const frozen = u.role === "retired_veteran";
  const rows = [];
  for (const [ty, list] of Object.entries(L)) {
    if (ty === "ribbon" || (pf3.filter !== "all" && pf3.filter !== ty)) continue;
    list.forEach((e, i) => rows.push({ ty, i, e, date: String(e.date || "") }));
  }
  if (pf3.filter === "all" || pf3.filter === "ribbon") {
    const g = new Map();
    L.ribbon.forEach((e, i) => { const k = e.title || e.name || "Ribbon"; g.set(k, [...(g.get(k) || []), { e, i }]); });
    for (const [name, list] of g) rows.push({ ty: "ribbon", name, list, date: list.map((x) => String(x.e.date || "")).sort().pop() || "" });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const by = (e) => (e.addedBy ? `<div class="by">${e.auto ? "AUTO · " : ""}BY ${esc(e.addedBy)}</div>` : e.auto ? '<div class="by">AUTO</div>' : "");
  const del = (ty, i) => (frozen ? "" : `<button type="button" class="x" data-del="${ty}:${i}" aria-label="Remove entry" title="Remove">✕</button>`);
  tl.innerHTML = rows.map((r) => {
    const [tag, col] = KIND[r.ty];
    if (r.ty === "ribbon") return `<li style="--k:${col}" class="rg"><button type="button" class="rgh" data-rg>${'<span class="t">' + tag + "</span>"}<b>${esc(r.name)} ×${r.list.length}</b> <span class="by">▾</span></button>
      <div class="rgl">${r.list.slice().reverse().map(({ e, i }) => `<div class="rgi"><span class="d">${esc(e.date || "—")}</span> ${esc(e.note || "No citation provided.")}${e.addedBy ? ` <span class="by">· BY ${esc(e.addedBy)}</span>` : ""}${del("ribbon", i)}</div>`).join("")}</div></li>`;
    const e = r.e;
    const body = r.ty === "promo" ? `<b>${esc(e.fromRank || "—")} → ${esc(e.toRank || "—")}</b>${e.note ? `<div>${esc(e.note)}</div>` : ""}`
      : r.ty === "platoon" ? `<b>${esc(e.from || "—")} → ${esc(e.to || "—")}</b>${e.note ? `<div>${esc(e.note)}</div>` : ""}`
      : r.ty === "warn" ? `<b>${esc(e.severity || "MINOR")}</b><div>${esc(e.note || "—")}</div>`
      : `<b>${e.medalImg ? `<img src="/images/medal_emojis/${encodeURIComponent(e.medalImg)}" alt="" class="mi">` : ""}★ ${esc(e.title || "Commendation")}</b>${e.note ? `<div>${esc(e.note)}</div>` : ""}`;
    return `<li style="--k:${col}"><span class="acts">${r.ty === "commend" && !frozen ? `<button type="button" class="x" data-edm="${r.i}" aria-label="Edit medal" title="Edit">✎</button>` : ""}${del(r.ty, r.i)}</span><div class="d">${esc(e.date || "—")}</div><span class="t">${tag}</span>${body}${by(e)}</li>`;
  }).join("") || '<li class="none">NOTHING ON RECORD YET.</li>';
}
function pf3AddShow() {
  document.querySelectorAll("#editPane-history .pf3-addsec").forEach((sec) => (sec.hidden = sec.dataset.pf3 !== pf3.add));
  document.querySelectorAll("#pf3AddT [data-addt]").forEach((b) => { b.classList.toggle("on", b.dataset.addt === pf3.add); b.setAttribute("aria-pressed", String(b.dataset.addt === pf3.add)); });
}

/* ── attendance: this-month pips + last ops ── */
async function pf3Attendance(u) {
  const pane = $id("editPane-att");
  if (!pane) return;
  const n = Math.max(0, Math.min(3, Number(u.attendance) || 0));
  pane.insertAdjacentHTML("beforeend", `<div class="pf3-sec"><h4>THIS MONTH <small>3/3 = +1 PT AT THE MONTHLY RESET</small></h4><div class="pf3-pips" role="img" aria-label="${n} of 3">${[1, 2, 3].map((k) => `<i class="${n >= k ? "f" : ""}"></i>`).join("")}</div></div>
    <div class="pf3-sec"><h4>LAST OPS <small>FROM THE ATTENDANCE TRACKER</small></h4><div id="pf3Ops" class="pf3-ops">LOADING…</div></div>`);
  const snap = await getDocs(collection(db, "attendance_events")).catch(() => null);
  const box = $id("pf3Ops");
  if (!box || pf3.u !== u) return;
  const joined = String(u.joinedAt || "").slice(0, 10);
  const evs = (snap?.docs || []).map((d) => d.data()).filter((e) => e.locked && String(e.date || "") >= joined).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  box.innerHTML = evs.length ? `<table><thead><tr><th>DATE</th><th>OP</th><th>RESULT</th></tr></thead><tbody>${evs.map((e) => {
    const r = (e.attendees || []).includes(u.id) ? ["✓ Present", "#22e07a"] : (e.excused || []).includes(u.id) ? ["◐ Excused", "#f59e0b"] : ["✕ Absent", "#ff4d4d"];
    return `<tr><td>${esc(String(e.date || "").slice(0, 10))}</td><td>${esc(e.title || "Op")}</td><td style="color:${r[1]}">${r[0]}</td></tr>`;
  }).join("")}</tbody></table>` : '<p class="pf2-note">No locked ops since they joined.</p>';
}

// ───────── styles ─────────
const CSS = `
/* ── v3 (approved mock 2026-11-11) ── */
#editUserModal .pf3-chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}#editUserModal .pf3-chips span{padding:2px 8px;border:1px solid currentColor;font:10px "Share Tech Mono",monospace;letter-spacing:1.5px}
#editUserModal .pf3-qs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 10px}#editUserModal .pf3-qs>div{border:1px solid rgba(0,217,255,.18);padding:8px;text-align:center}#editUserModal .pf3-qs b{display:block;color:#fff;font:700 17px "Share Tech Mono",monospace}#editUserModal .pf3-qs span{font:9px "Share Tech Mono",monospace;letter-spacing:1.5px;color:#7d8a99}
#editUserModal .pf3-groups{display:flex;flex-direction:column;gap:12px}
#editUserModal .pf3-sec{border:1px solid rgba(0,217,255,.18);background:#0e151a;margin-bottom:12px}#editUserModal .pf3-groups .pf3-sec{margin:0}
#editUserModal .pf3-sec>h4{margin:0;padding:9px 12px;border-bottom:1px solid rgba(0,217,255,.18);font:10.5px "Share Tech Mono",monospace;letter-spacing:2.5px;color:#00D9FF;display:flex;justify-content:space-between}#editUserModal .pf3-sec>h4 small{color:#7d8a99;letter-spacing:1px}
#editUserModal .pf3-fg{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;padding:12px}#editUserModal .pf3-fg .edit-field{margin:0}
#editUserModal .edit-field.pf3-chg input,#editUserModal .edit-field.pf3-chg select,#editUserModal .edit-field.pf3-chg .pf3-role{border-color:#ffd166!important;box-shadow:0 0 0 1px rgba(255,209,102,.35)}
#editUserModal .pf3-role{display:flex;align-items:center;gap:10px;min-height:38px;border:1px solid rgba(0,217,255,.3);background:rgba(0,0,0,.45);padding:0 10px;font:12px "Share Tech Mono",monospace}#editUserModal .pf3-role span{flex:1;min-width:0}#editUserModal .pf3-role small{color:#7d8a99}
#editUserModal .pf3-role button,#editUserModal .pf3-b{all:unset;cursor:pointer;font:10px "Share Tech Mono",monospace;letter-spacing:1.5px;padding:4px 10px;border:1px solid #00D9FF;color:#00D9FF}#editUserModal .pf3-role button:focus-visible,#editUserModal .pf3-b:focus-visible,#editUserModal .pf3-ro:focus-visible,#editUserModal .pf3-filt button:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
#editUserModal .pf3-ov{position:absolute;inset:0;z-index:50;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
#editUserModal .pf3-win{width:min(560px,100%);background:#0b0f15;border:1px solid #00D9FF;box-shadow:0 10px 30px rgba(0,0,0,.6)}#editUserModal .pf3-wh{padding:12px 14px;border-bottom:1px solid rgba(0,217,255,.18);color:#fff;font:700 16px Rajdhani,sans-serif;letter-spacing:2px}#editUserModal .pf3-wb{padding:14px;font:12px "Share Tech Mono",monospace}#editUserModal .pf3-wf{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid rgba(0,217,255,.18)}
#editUserModal .pf3-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}#editUserModal .pf3-ro{all:unset;cursor:pointer;text-align:center;padding:9px 6px;border:1px solid rgba(0,217,255,.18);font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#cfe9f2}#editUserModal .pf3-ro.cur{color:#7d8a99;border-color:#7d8a99}#editUserModal .pf3-ro.on{border-color:#ffd166;background:rgba(255,209,102,.12);color:#ffd166}#editUserModal .pf3-ro:disabled{opacity:.35;cursor:not-allowed}#editUserModal .pf3-ro.cur:disabled{opacity:1}
#editUserModal .pf3-eff{border:1px solid rgba(0,217,255,.18);padding:10px 12px;margin-bottom:12px;line-height:1.7}#editUserModal .pf3-eff b{color:#fff}#editUserModal .pf3-eff .up{color:#22e07a}#editUserModal .pf3-eff .dn{color:#ff4d4d}#editUserModal .pf3-hint{color:#7d8a99;font-size:11px;margin:0}
#editUserModal .pf3-wb label{display:block;font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin-bottom:4px}#editUserModal .pf3-wb input{width:100%;height:34px;background:#060a0e;border:1px solid rgba(0,217,255,.35);color:#fff;padding:0 10px;font:inherit}#editUserModal .pf3-wb input.bad{border-color:#ff4d4d}
#editUserModal .pf3-b.gold{background:#ffd166;border-color:#ffd166;color:#041014}#editUserModal .pf3-b:disabled{opacity:.4;cursor:not-allowed}
#editUserModal .pf3-filt{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}#editUserModal .pf3-filt button{all:unset;cursor:pointer;padding:5px 10px;border:1px solid rgba(0,217,255,.18);font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}#editUserModal .pf3-filt button.on{color:#fff;border-color:#00D9FF;background:rgba(0,217,255,.1)}#editUserModal .pf3-filt button span{opacity:.7}
#editUserModal .pf3-tl{list-style:none;margin:0 0 16px 8px;padding:0;border-left:2px solid #1c2a30}
#editUserModal .pf3-tl>li{position:relative;padding:8px 0 12px 18px;font:12px "Share Tech Mono",monospace;color:#cfe9f2}#editUserModal .pf3-tl>li:before{content:"";position:absolute;left:-7px;top:12px;width:12px;height:12px;border-radius:50%;background:var(--k);box-shadow:0 0 8px var(--k)}#editUserModal .pf3-tl>li.none{color:#7d8a99}#editUserModal .pf3-tl>li.none:before{display:none}
#editUserModal .pf3-tl .d{font-size:10.5px;color:#7d8a99}#editUserModal .pf3-tl b{color:#fff}#editUserModal .pf3-tl .t{font-size:9.5px;letter-spacing:1.5px;color:var(--k);border:1px solid var(--k);padding:1px 6px;margin-right:6px}#editUserModal .pf3-tl .by{font-size:10px;color:#4b6470}#editUserModal .pf3-tl .mi{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:4px}
#editUserModal .pf3-tl .acts{float:right;display:flex;gap:4px}#editUserModal .pf3-tl .x{all:unset;cursor:pointer;color:#7d8a99;padding:0 6px}#editUserModal .pf3-tl .x:hover{color:#fff}#editUserModal .pf3-tl .x:focus-visible{outline:2px solid #00D9FF}
#editUserModal .pf3-tl .rgh{all:unset;cursor:pointer;display:block}#editUserModal .pf3-tl .rgl{display:none;margin-top:6px}#editUserModal .pf3-tl .rg.open .rgl{display:block}#editUserModal .pf3-tl .rgi{padding:4px 0;border-top:1px solid rgba(255,255,255,.05);font-size:11px}#editUserModal .pf3-tl .rgi .x{float:right}
#editUserModal .pf3-add{border:1px dashed rgba(0,217,255,.35);padding:12px}#editUserModal .pf3-k{display:block;font:9.5px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;margin-bottom:6px}
#editUserModal .pf3-add .history-section{border:0;background:none;margin:0;padding:0}#editUserModal .pf3-add .history-section-hd,#editUserModal .pf3-add #histPlatoonList,#editUserModal .pf3-add #histPromoList,#editUserModal .pf3-add #histWarnList,#editUserModal .pf3-add #histCommendList,#editUserModal .pf3-add #histRibbonList{display:none!important}
#editUserModal .pf3-pips{display:flex;gap:6px;padding:12px}#editUserModal .pf3-pips i{width:46px;height:10px;border:1px solid #00D9FF}#editUserModal .pf3-pips i.f{background:#00D9FF;box-shadow:0 0 8px rgba(0,217,255,.5)}
#editUserModal .pf3-ops{padding:4px 12px 10px;font:12px "Share Tech Mono",monospace}#editUserModal .pf3-ops table{width:100%;border-collapse:collapse}#editUserModal .pf3-ops td,#editUserModal .pf3-ops th{padding:6px 8px;border-bottom:1px solid rgba(0,217,255,.07);text-align:left}#editUserModal .pf3-ops th{font-weight:400;font-size:9.5px;letter-spacing:2px;color:#7d8a99}
#editUserModal .edit-modal-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#pf3Unsaved{flex:1;color:#ffd166;font:11px "Share Tech Mono",monospace;letter-spacing:1.5px;align-self:center}
@media (max-width:760px){#editUserModal .pf3-fg{grid-template-columns:1fr}#editUserModal .pf3-roles{grid-template-columns:repeat(2,1fr)}}

#panel-active > :not(#${ROOT_ID}){display:none!important}
#${ROOT_ID}{--a:#00D9FF;--l:rgba(0,217,255,.18);--l2:rgba(0,217,255,.35);--p:#0b0f15;--p2:#0e131b;--d:#7d8a99;--dd:#4b5765;font-family:'Share Tech Mono',monospace;color:#d6dde6}
#${ROOT_ID} .h1{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;color:var(--a);font-size:20px;padding-bottom:10px;border-bottom:1px solid var(--l)}
#${ROOT_ID} .sub{font-size:10px;letter-spacing:3px;color:var(--d);margin:10px 0 16px}
#${ROOT_ID} .tabs{display:flex;gap:2px;border:1px solid var(--l);background:var(--p);padding:6px;overflow-x:auto}
#${ROOT_ID} .tab{background:none;border:0;border-bottom:2px solid transparent;padding:7px 12px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:11px;letter-spacing:2.5px;color:var(--dd);cursor:pointer;white-space:nowrap}
#${ROOT_ID} .tab:hover{color:#9fb3c4}#${ROOT_ID} .tab.on{color:var(--a);border-bottom-color:var(--a)}
#${ROOT_ID} .tab.warn{color:rgba(255,77,77,.6)}#${ROOT_ID} .tab.warn.on{color:#ff4d4d;border-bottom-color:#ff4d4d}
#${ROOT_ID} .tab .n{opacity:.6;margin-left:5px}
#${ROOT_ID} .toolbar{display:flex;gap:10px;align-items:center;margin:14px 0;flex-wrap:wrap}
#${ROOT_ID} .search{flex:1;min-width:220px;display:flex;align-items:center;border:1px solid var(--l);background:var(--p)}
#${ROOT_ID} .search span{padding:0 10px;color:var(--d)}
#${ROOT_ID} .search input{flex:1;background:none;border:0;outline:0;padding:9px 0;font:inherit;font-size:12px;letter-spacing:1px;color:#d6dde6}
#${ROOT_ID} select{background:var(--p);border:1px solid var(--l);padding:8px 10px;font:inherit;font-size:11px;letter-spacing:1px;color:#d6dde6;outline:0}
#${ROOT_ID} .count{font-size:10px;letter-spacing:3px;color:var(--a);opacity:.7}
#${ROOT_ID} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:14px}
#${ROOT_ID} .card{position:relative;background:linear-gradient(180deg,var(--p2),var(--p));border:1px solid var(--l);display:flex;flex-direction:column;outline:0;transition:border-color .15s,transform .15s}
#${ROOT_ID} .card[data-open="1"]{cursor:pointer}
#${ROOT_ID} .card[data-open="1"]:hover,#${ROOT_ID} .card:focus-visible{border-color:var(--l2);transform:translateY(-2px)}
#${ROOT_ID} .card:focus-visible{box-shadow:0 0 0 2px var(--a)}
#${ROOT_ID} .card::before{content:"";position:absolute;inset:0 auto 0 0;width:2px;background:var(--rc);opacity:.8;z-index:1}
.pf2-pfp-base,#${ROOT_ID} .pfp,#editUserModal .pfp{position:relative;aspect-ratio:4/4.2;overflow:hidden;background:#0a1018}
#${ROOT_ID} .pfp{border-bottom:1px solid var(--l)}
.pf2-picrm{background:none;border:1px solid rgba(255,77,77,.5);color:#ff4d4d;font:inherit;font-size:9px;letter-spacing:1px;padding:1px 6px;cursor:pointer;margin-left:6px}
.pf-hexwrap{position:absolute;inset:0;display:grid;place-items:center}.pf-hexwrap .hx{width:72%;height:auto;aspect-ratio:1.155/1}
#${ROOT_ID} .pfp svg,#${ROOT_ID} .pfp img,#editUserModal .pfp svg,#editUserModal .pfp img{width:100%;height:100%;display:block;object-fit:cover}
#${ROOT_ID} .pfp::after,#editUserModal .pfp::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,217,255,.035) 0 1px,transparent 1px 3px);pointer-events:none}
#${ROOT_ID} .badge-rank,#editUserModal .badge-rank{position:absolute;top:8px;left:8px;background:rgba(5,8,12,.85);border:1px solid rgba(0,217,255,.35);padding:3px 7px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;letter-spacing:1.5px;color:#fff;z-index:1}
#${ROOT_ID} .status{position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:5px;background:rgba(5,8,12,.85);border:1px solid var(--l);padding:3px 7px;font-size:9px;letter-spacing:2px;z-index:1}
#${ROOT_ID} .dot{width:7px;height:7px;border-radius:50%}
#${ROOT_ID} .nophoto{position:absolute;bottom:8px;left:8px;right:8px;text-align:center;font-size:8.5px;letter-spacing:2px;color:var(--d);background:rgba(5,8,12,.8);border:1px dashed rgba(125,138,153,.35);padding:3px;z-index:1}
#${ROOT_ID} .body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}
#${ROOT_ID} .name{font-size:15px;color:#fff;letter-spacing:.5px}
#${ROOT_ID} .rankfull{font-size:10.5px;color:var(--d);letter-spacing:1px}
#${ROOT_ID} .chips{display:flex;gap:5px;flex-wrap:wrap}
#${ROOT_ID} .chip{font-family:Rajdhani,sans-serif;font-weight:700;font-size:9.5px;letter-spacing:1.8px;padding:2px 6px;border:1px solid}
#${ROOT_ID} .att{display:flex;align-items:center;gap:7px;font-size:9.5px;letter-spacing:1px;color:var(--d);margin-top:auto}
#${ROOT_ID} .bar{flex:1;height:3px;background:#1a2330}#${ROOT_ID} .bar i{display:block;height:100%}
#${ROOT_ID} .actions{display:flex;border-top:1px solid var(--l);align-items:stretch}
#${ROOT_ID} .actions button{flex:1;background:none;border:0;border-right:1px solid var(--l);padding:8px 0;font-family:Rajdhani,sans-serif;font-weight:700;font-size:10.5px;letter-spacing:2px;color:#22e07a;cursor:pointer}
#${ROOT_ID} .actions button:last-child{border-right:0;color:var(--a)}
#${ROOT_ID} .actions button:hover{background:rgba(0,217,255,.06)}
#${ROOT_ID} .actions .lock{flex:1;display:grid;place-items:center;font-family:Rajdhani,sans-serif;font-size:9.5px;letter-spacing:2px;color:#f59e0b;border-right:1px solid var(--l)}
#${ROOT_ID} .empty{grid-column:1/-1;text-align:center;padding:50px;color:var(--d);letter-spacing:4px;font-size:11px;border:1px dashed var(--l)}
@media(max-width:600px){#${ROOT_ID} .grid{grid-template-columns:repeat(2,1fr);gap:10px}#${ROOT_ID} .name{font-size:13px}}

/* File window: the original Edit modal in the approved layout */
#editUserModal.pf2-modal{backdrop-filter:blur(3px)}
#editUserModal .edit-modal-content.pf2-win{position:relative;max-width:1040px;width:96%;max-height:calc(100vh - 40px);padding:0;display:grid;grid-template-columns:260px 1fr;grid-template-rows:minmax(0,1fr);overflow:hidden;border-color:rgba(0,217,255,.35);background:#0b0f15;box-shadow:0 20px 80px rgba(0,0,0,.6)}
#editUserModal .pf2-aside{border-right:1px solid rgba(0,217,255,.18);padding:18px;overflow:auto;font-family:'Share Tech Mono',monospace;color:#d6dde6}
#editUserModal .pf2-aside .pfp{aspect-ratio:4/4.6;border:1px solid rgba(0,217,255,.35)}
#editUserModal .upnote{margin-top:8px;font-size:9.5px;letter-spacing:1px;color:#7d8a99;line-height:1.5;border:1px dashed rgba(0,217,255,.18);padding:7px}
#editUserModal .pf2-aside .name{font-size:18px;margin-top:12px;color:#fff}
#editUserModal .pf2-aside .rankfull{font-size:10.5px;color:#7d8a99;letter-spacing:1px}
#editUserModal .kv{margin:12px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 10px;font-size:10.5px}
#editUserModal .kv dt{color:#4b5765;letter-spacing:2px}#editUserModal .kv dd{margin:0;text-align:right;word-break:break-all}
#editUserModal .danger{margin-top:18px;border-top:1px solid rgba(255,77,77,.25);padding-top:12px}
#editUserModal .danger button{width:100%;background:rgba(255,77,77,.05);border:1px solid rgba(255,77,77,.4);color:#ff4d4d;padding:8px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11px;cursor:pointer}
#editUserModal .pf2-main{display:flex;flex-direction:column;min-width:0;min-height:0;padding:18px 22px;overflow-y:auto}
#editUserModal .pf2-main .edit-modal-title{margin:0 40px 14px 0}
#editUserModal .pf2-main .edit-modal-scroll{min-height:0}
#editUserModal .pf2-x{position:absolute;top:12px;right:12px;width:30px;height:30px;background:none;border:1px solid rgba(0,217,255,.35);color:#9fb3c4;cursor:pointer;z-index:2}
#editUserModal .pf2-x:hover{color:#fff;border-color:#00D9FF}
#editUserModal #editPane-att{overflow:auto}
#editUserModal .pf2-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px}
#editUserModal .pf2-kpis div{border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:14px;text-align:center;font-family:'Share Tech Mono',monospace}
#editUserModal .pf2-kpis b{display:block;font-family:Rajdhani,sans-serif;font-size:26px;color:#00D9FF}
#editUserModal .pf2-kpis span{font-size:9px;letter-spacing:2.5px;color:#7d8a99}
#editUserModal .pf2-last{margin-top:14px;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:2px;color:#7d8a99}
#editUserModal .pf2-last b{color:#d6dde6;font-weight:400}
#editUserModal .pf2-note{font-family:'Share Tech Mono',monospace;font-size:10px;color:#4b5765;letter-spacing:1px;margin-top:10px}
@media(max-width:820px){#editUserModal .edit-modal-content.pf2-win{grid-template-columns:1fr;grid-template-rows:auto;overflow:auto}#editUserModal .pf2-aside{border-right:0;border-bottom:1px solid rgba(0,217,255,.18)}#editUserModal .pf2-aside .pfp{max-width:200px}#editUserModal .pf2-main{overflow:visible}#editUserModal .pf2-kpis{grid-template-columns:repeat(2,1fr)}}
`;

// ───────── mount ─────────
function mount() {
  const panel = document.getElementById("panel-active");
  if (!panel || document.getElementById(ROOT_ID)) return;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  // Keep the original list in the page (hidden) so the original code still runs safely.
  [...panel.children].forEach((c) => (c.style.display = "none"));
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="h1">PERSONNEL FILES</div>
    <div class="sub">ALL MEMBER FILES — CLICK A CARD TO OPEN THE FULL FILE</div>
    <div class="tabs" role="tablist"></div>
    <div class="toolbar">
      <label class="search"><span>⌕</span><input type="search" placeholder="SEARCH NAME, CALLSIGN, DISCORD..." aria-label="Search personnel"></label>
      <select aria-label="Sort"><option value="rank">SORT: RANK (HIGH → LOW)</option><option value="name">SORT: NAME A–Z</option><option value="joined">SORT: NEWEST FIRST</option><option value="att">SORT: ATTENDANCE (LOW → HIGH)</option></select>
      <span class="count"></span>
    </div>
    <div class="grid"><div class="empty">LOADING...</div></div>`;
  panel.appendChild(root);

  root.querySelector(".search input").addEventListener("input", (e) => {
    query = e.target.value;
    render();
  });
  root.querySelector("select").addEventListener("change", (e) => {
    sort = e.target.value;
    render();
  });
  root.addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) {
      tab = t.dataset.tab;
      return render();
    }
    const b = e.target.closest("[data-act]");
    if (b) {
      e.stopPropagation();
      if (b.dataset.act === "discord") return window.openDiscordEdit?.(b.dataset.id);
      return openFile(b.dataset.id, b.dataset.act === "record" ? "record" : "details");
    }
    const c = e.target.closest('.card[data-open="1"]');
    if (c) openFile(c.dataset.id, "details");
  });
  root.addEventListener("keydown", (e) => {
    const c = e.target.closest?.('.card[data-open="1"]');
    if (c && e.key === "Enter") openFile(c.dataset.id, "details");
  });

  new MutationObserver(() => {
    if (!panel.classList.contains("hidden")) refresh();
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  if (!panel.classList.contains("hidden")) refresh();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();

// Other pages (e.g. Messages → FILE) can open a member's file.
window.addEventListener("pf:open", (e) => {
  const id = e.detail;
  let tries = 0;
  const tryOpen = () => (users.some((x) => x.id === id) ? openFile(id, "details") : ++tries < 10 && setTimeout(tryOpen, 500));
  if (id) tryOpen();
});
