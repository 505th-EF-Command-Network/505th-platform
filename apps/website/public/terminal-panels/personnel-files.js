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
import { ask, tell } from "./_common.js";

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
    <div class="name">${esc(memberName(u))}</div><div class="rankfull">${esc(u.rank || "No rank")}</div>
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
}

// ───────── styles ─────────
const CSS = `
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
