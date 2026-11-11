/**
 * BATTALION ROSTER v2 (approved mock 2026-11-09) — replaces #panel-roster.
 *
 * Original rules kept by calling the original functions:
 *  - ATT pip / PT / month-end reset: attendance-core.js (moved out of the legacy Terminal)
 *  - Row menu: openRosterCtx + ctxAction (edit / promote / transfer / warn / stats / medals)
 *  - Backfill platoon dates: openBackfillPlatoonModal
 * New: Award Medal / Award Ribbon windows (same record shape as the originals).
 */
import { doc, updateDoc } from "/terminal-shim/firestore.js";
import { addPip, promotePT, resetStatus, runReset, shiftMonth, ukMonth } from "./attendance-core.js";
import {
  addCss, ask, audit, closeModal, db, esc, getMe, getUsers, isMember, memberName, mountPanel, notify, notifyMember, onReady, openModal,
  platoonOrder, rankAbbr, rankOrder, since, today, ukDate, webhook,
} from "./_common.js";

const ROOT = "rosV2";
const MEDALS = [
  ["Medal of Honor", "Medal of Honor Medal.png"], ["Navy Cross", "Navy Cross Medal.png"], ["Air Force Cross", "Air Force Cross Medal.png"],
  ["Silver Star", "Silver Medal.png"], ["Bronze Star", "Bronze Star Medal.png"], ["Navy Achievement", "Navy Achievement Medal.png"],
  ["Air Force Achievement", "Air Force Achivement Medal.png"], ["POW Medal", "POW Medal.png"],
];
// Same list as RIBBON_TYPES in the original page.
const RIBBONS = [["Training Ribbon", "#2DD4BF"], ["Commendation Ribbon", "#F59E0B"], ["Ribbon C", "#A78BFA"]];
const EDIT_ROLES = new Set(["commander", "officer", "developer", "staff_nco"]);
const RESET_ROLES = new Set(["commander", "developer", "staff_nco", "officer"]);

let rows = [];
let meta = {};
let pollT = null;
let me = null;
let sortK = "rank";
let sortDir = 1;
let q = "";
let pl = "";
let group = true;

async function load() {
  me = await getMe();
  meta = await resetStatus().catch(() => ({ month: ukMonth() })); // Cortana runs the reset at 00:00 on the 1st

  rows = (await getUsers()).filter((u) => isMember(u) && u.role !== "retired_veteran");
  render();
}

const ribbonBar = (c) => `background:linear-gradient(90deg,${c} 0 30%,rgba(0,0,0,.55) 30% 38%,#fff 38% 46%,rgba(0,0,0,.55) 46% 54%,#fff 54% 62%,rgba(0,0,0,.55) 62% 70%,${c} 70%)`;

const pgOf = (r) => (String(r.rank || "").match(/^([OE]\d+)/) || [])[1] || (r.rank === "Reservist" ? "RES" : "—");
const pgNum = (r) => { const m = pgOf(r).match(/^([OE])(\d+)/); return m ? (m[1] === "O" ? 100 : 0) + +m[2] : -1; };
const rateOf = (r) => (r.opsEligible ? Math.round(((r.opsAttended || 0) / r.opsEligible) * 100) : null);
const rc = (p) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
// [label, key, default direction] — direction 1 = as listed
const SORTS = {
  rank: ["Rank (high → low)", (r) => rankOrder(r.rank), 1], rankup: ["Rank (low → high)", (r) => rankOrder(r.rank), -1],
  pg: ["Paygrade (high → low)", (r) => -pgNum(r), 1], pgup: ["Paygrade (low → high)", (r) => -pgNum(r), -1],
  name: ["Name A–Z", (r) => `${r.lastName || ""} ${r.firstName || ""}`.toLowerCase(), 1],
  rate: ["Attendance % (high → low)", (r) => -(rateOf(r) ?? -1), 1], att: ["ATT this month", (r) => -(r.attendance || 0), 1],
  pt: ["PT (most first)", (r) => -(r.promotionTracker || 0), 1], rib: ["Ribbons (most first)", (r) => -(r.ribbonHistory || []).length, 1],
  med: ["Medals (most first)", (r) => -(r.commendationHistory || []).length, 1], joined: ["Joined (oldest first)", (r) => r.graduation || r.joinedPlatoon || "9999", 1],
  squad: ["Squad", (r) => String(r.squad || "~").toLowerCase(), 1],
};
const open = new Set(); // platoons folded open (empty = all open on first load)
let opened = false;

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const canEdit = EDIT_ROLES.has(me?.role);
  const act = rows.filter((r) => r.platoon !== "Reserves");
  const tA = act.reduce((s, r) => s + (r.opsAttended || 0), 0), tE = act.reduce((s, r) => s + (r.opsEligible || 0), 0);
  const rate = tE ? Math.round((tA / tE) * 100) : 0;
  root.querySelector(".kp").innerHTML = `
    <div class="k"><b style="color:var(--g)">${act.filter((r) => r.platoon !== "Awaiting BCT").length}</b><span>ACTIVE</span></div>
    <div class="k"><b style="color:var(--a)">${rows.reduce((s, r) => s + (r.promotionTracker || 0), 0)}</b><span>PT (TOTAL)</span></div>
    <div class="k"><b style="color:#2dd4bf">${rows.reduce((s, r) => s + (r.ribbonHistory || []).length, 0)}</b><span>RIBBONS</span></div>
    <div class="k"><b style="color:var(--am)">${rows.filter((r) => r.platoon === "Reserves").length}</b><span>RESERVES</span></div>
    <div class="k"><b>${rows.filter((r) => r.platoon === "Awaiting BCT").length}</b><span>AWAITING BCT</span></div>
    <div class="k"><b style="color:${rc(rate)}">${rate}%</b><span>ATTENDANCE</span></div>
    <div class="k"><b style="color:var(--g)">${act.filter((r) => (r.attendance || 0) >= 3).length}</b><span>3/3 THIS MONTH</span></div>`;
  root.querySelector(".reset").outerHTML = bannerHtml();
  const plSel = root.querySelector(".rpl");
  const plats = [...new Set(rows.map((r) => r.platoon || ""))].sort((a, b) => platoonOrder(a) - platoonOrder(b));
  plSel.innerHTML = `<option value="">ALL PLATOONS</option>` + plats.map((p) => `<option ${pl && p === pl ? "selected" : ""} value="${esc(p)}">${esc(p || "No platoon")}</option>`).join("");
  if (!opened) { plats.forEach((p) => open.add(p)); opened = true; }

  const [, key, dir0] = SORTS[sortK] || SORTS.rank;
  const dir = dir0 * sortDir;
  const list = rows.filter((r) => (!pl || (r.platoon || "") === pl) && memberName(r).toLowerCase().includes(q.toLowerCase()));
  list.sort((a, b) => { const A = key(a), B = key(b); return A !== B ? (A > B ? 1 : -1) * dir : rankOrder(a.rank) - rankOrder(b.rank) || memberName(a).localeCompare(memberName(b)); });

  const head = `<thead><tr><th>RANK</th><th>NAME</th><th>PAYGRADE</th><th>SQUAD</th>${group ? "" : "<th>PLATOON</th>"}<th>ATT (MONTH)</th><th>PT</th><th>ATTENDANCE</th><th>RIBBONS</th><th>MEDALS</th><th></th></tr></thead>`;
  const row = (r) => {
    const att = r.attendance || 0;
    const pg = pgOf(r), pgc = pg[0] === "O" ? "o" : pg[0] === "E" ? "e" : "r";
    const p = rateOf(r), rib = (r.ribbonHistory || []).length, med = (r.commendationHistory || []).length;
    return `<tr class="${sel === r.id ? "on" : ""}">
      <td class="s2">${esc(rankAbbr(r.rank) || "—")}</td>
      <td><button class="nm" data-act="card" data-id="${esc(r.id)}">${esc(memberName(r).replace(/^\S+\s/, ""))}</button></td>
      <td><span class="pgb ${pgc}" title="${esc(r.rank || "")}">${esc(pg)}</span></td>
      <td class="s2">${esc(r.squad || "—")}</td>${group ? "" : `<td><span class="pchip">${esc(r.platoon || "—")}</span></td>`}
      <td><div class="pips">${[1, 2, 3].map((k) => (k === att + 1 && canEdit ? `<button class="pip next" title="Add attendance (+1)" aria-label="Add attendance for ${esc(memberName(r))}" data-act="att" data-id="${esc(r.id)}"></button>` : `<span class="pip ${att >= k ? "f" + att : ""}"></span>`)).join("")}<span class="pn">${att}/3</span></div></td>
      <td><span class="ptb"><span class="ptv">${r.promotionTracker || 0}</span>${canEdit ? `<button class="pl ${att >= 3 ? "rd" : ""}" data-act="pt" data-id="${esc(r.id)}" title="${att >= 3 ? "Award +1 PT and reset ATT (3/3)" : "Give +1 PT"}" aria-label="Give PT to ${esc(memberName(r))}">＋</button>` : ""}</span></td>
      <td style="color:${rc(p)}">${p == null ? "—" : p + "%"} <small class="s2">(${r.opsAttended || 0}/${r.opsEligible || 0})</small></td>
      <td><span style="color:${rib ? "#2dd4bf" : "#3b4a5a"}">▬ ${rib}</span></td>
      <td><span style="color:${med ? "#a78bfa" : "#3b4a5a"}">★ ${med}</span></td>
      <td>${canEdit ? `<button class="rowbtn" aria-label="Actions for ${esc(memberName(r))}" data-act="menu" data-id="${esc(r.id)}">⋯</button>` : ""}</td></tr>`;
  };
  const tbl = (g) => `<div class="wrapx"><table class="t">${head}<tbody>${g.map(row).join("")}</tbody></table></div>`;
  let html = "";
  if (group) {
    const plats2 = [...new Set(list.map((r) => r.platoon || ""))].sort((a, b) => platoonOrder(a) - platoonOrder(b));
    html = plats2.map((p) => {
      const g = list.filter((r) => (r.platoon || "") === p);
      const gE = g.reduce((s, r) => s + (r.opsEligible || 0), 0), gr = gE ? Math.round((g.reduce((s, r) => s + (r.opsAttended || 0), 0) / gE) * 100) : null;
      return `<details class="grp2" data-pl="${esc(p)}" ${open.has(p) || q ? "open" : ""}><summary>${esc((p || "NO PLATOON").toUpperCase())}<small>${g.length} MEMBER${g.length === 1 ? "" : "S"}${gr == null ? "" : ` · <span style="color:${rc(gr)}">${gr}%</span>`}</small></summary>${tbl(g)}</details>`;
    }).join("");
  } else html = list.length ? tbl(list) : "";
  root.querySelector(".tables").innerHTML = html || '<div class="empty">NOBODY MATCHES</div>';
  root.querySelector(".rsort").value = sortK;
  root.querySelector(".gbtn").textContent = group ? "GROUP: PLATOON ✓" : "GROUP: OFF";
  root.querySelector(".gbtn").setAttribute("aria-pressed", group);
  root.querySelectorAll(".needs-edit").forEach((b) => (b.style.display = canEdit ? "" : "none"));
  root.querySelector(".reset-btn").style.display = RESET_ROLES.has(me?.role) ? "" : "none";
  drawCard();
}

// ───────── monthly reset banner ─────────
const monLabel = (m) => { const [y, mo] = String(m).split("-").map(Number); return new Date(Date.UTC(y, mo - 1, 15)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase(); };
function bannerHtml() {
  const cur = meta.month || ukMonth(), next = shiftMonth(cur, 1), last = meta.lastAttendanceReset || "";
  const can = RESET_ROLES.has(me?.role);
  const run = meta.resetRunning;
  clearTimeout(pollT);
  if (run && Date.now() - Date.parse(run.startedAt) < 15 * 60000) {
    pollT = setTimeout(() => load().catch(() => {}), 5000);
    return `<div class="reset run" role="status"><span><b>◷ RESET RUNNING…</b> — by ${esc(run.by || "?")} · ${run.total ? `${run.done} / ${run.total} members done` : "starting"}<small>Don't close the page if you started it.</small></span></div>`;
  }
  const [y, mo] = next.split("-").map(Number);
  const days = Math.max(0, Math.ceil((Date.UTC(y, mo - 1, 1) - Date.now()) / 864e5));
  if (last >= next) return `<div class="reset ok"><span><b>✓ ${monLabel(next)} RESET DONE EARLY</b> — ${esc(ukDate(meta.lastResetAt, { day: "2-digit", month: "short" }).toUpperCase())} by ${esc(meta.lastResetBy || "—")} · Cortana will skip it on the 1st.</span></div>`;
  if (last === cur) {
    const by = meta.lastResetAt ? `${ukDate(meta.lastResetAt, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()} ${new Date(meta.lastResetAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} by ${meta.lastResetBy || "—"}` : "done";
    return `<div class="reset ${days <= 3 ? "due" : "ok"}"><span><b>✓ ${monLabel(cur)} RESET DONE</b> — ${esc(by)}${meta.lastResetPromoted != null ? ` · ${meta.lastResetPromoted} got +1 PT` : ""}${meta.lastResetSaved ? ` · ${monLabel(meta.lastResetSaved)} saved to History` : ""}<small>Next reset: 01 ${monLabel(next)} (in ${days} day${days === 1 ? "" : "s"}) — Cortana runs it at 00:00 UK time.${days <= 3 ? " Only run early if the Commander asks." : ""}</small></span>${days <= 3 && can ? '<button class="b sm r" data-act="reset" data-mode="early">RUN EARLY…</button>' : ""}</div>`;
  }
  return `<div class="reset miss" role="alert"><span><b>⚠ ${monLabel(cur)} RESET HAS NOT RUN</b> — Cortana may have been offline at midnight.<small>Running it now: saves ${monLabel(shiftMonth(cur, -1))} to History → +1 PT for 3/3 → ATT back to 0/3. Events already locked this month are kept.</small></span>${can ? '<button class="b sm red" data-act="reset" data-mode="missed">↻ RUN RESET NOW</button>' : '<span class="s2">ASK STAFF TO RUN IT</span>'}</div>`;
}

// ───────── side card ─────────
let sel = null;
function drawCard() {
  const root = document.getElementById(ROOT);
  const box = root?.querySelector(".card2");
  if (!box) return;
  const r = rows.find((x) => x.id === sel);
  if (!r) { box.hidden = true; return; }
  const canEdit = EDIT_ROLES.has(me?.role);
  const p = rateOf(r);
  box.hidden = false;
  box.innerHTML = `<button class="xx" data-act="cardclose" aria-label="Close">✕</button><span class="s2">MEMBER</span><h3>${esc(memberName(r))}</h3>
    <div class="s2">${esc(pgOf(r))} · ${esc(r.platoon || "—")}${r.squad ? " · " + esc(r.squad) : ""}${r.billet ? " · " + esc(r.billet) : ""}</div>
    <div class="cst"><div><b>${r.attendance || 0}/3</b><span>ATT</span></div><div><b style="color:var(--a)">${r.promotionTracker || 0}</b><span>PT</span></div><div><b style="color:${rc(p)}">${p == null ? "—" : p + "%"}</b><span>ATTENDANCE</span></div><div><b>${(r.ribbonHistory || []).length}/${(r.commendationHistory || []).length}</b><span>RIB / MED</span></div></div>
    ${canEdit ? `<div class="acts"><button class="b sm" data-ca="edit">✎ PERSONNEL FILE</button><button class="b sm" data-ca="promote">▲ PROMOTE</button><button class="b sm" data-ca="transfer">⇄ TRANSFER</button><button class="b sm" data-ca="warn" style="color:var(--am);border-color:var(--am)">⚠ WARN</button><button class="b sm" data-ca="medal" style="color:#C9A227;border-color:#C9A227">★ AWARD MEDAL</button><button class="b sm" data-ca="ribbon" style="color:#2dd4bf;border-color:#2dd4bf">▬ AWARD RIBBON</button><button class="b sm" data-ca="medals" style="color:#a78bfa;border-color:#a78bfa">☆ MEDAL HISTORY</button><button class="b sm" data-ca="stats">▤ EDIT STATS</button></div>` : '<p class="s2">VIEW ONLY</p>'}`;
}

async function givePT(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  if ((r.attendance || 0) >= 3) return promotePT(r);
  if (!(await ask({ kind: "warn", title: "GIVE +1 PT?", body: `${r.attendance || 0}/3 this month — this is a manual award (ATT is not reset).`, item: memberName(r), go: "+1 PT" }))) return;
  const n = (r.promotionTracker || 0) + 1;
  await updateDoc(doc(db, "users", id), { promotionTracker: n, updatedAt: new Date().toISOString() });
  await audit("manpower", "PT AWARDED (MANUAL)", `${memberName(r)} → ${n} PT (ATT ${r.attendance || 0}/3)`);
  notify(`+1 PT — ${memberName(r)}`.toUpperCase());
}

// ───────── row menu → original quick actions ─────────
const MENU = [
  ["edit", "✎ Open personnel file"], ["promote", "⇧ Promote"], ["transfer", "⇄ Transfer platoon"],
  ["medal", "★ Award medal", "#C9A227"], ["ribbon", "▬ Award ribbon", "#2dd4bf"], ["medals", "☆ View medal history", "#a78bfa"],
  ["stats", "▣ Edit roster stats"], ["warn", "⚠ File warning", "#f59e0b"],
];
function openMenu(btn, id) {
  closeMenu();
  const m = document.createElement("div");
  m.className = "v2 rosmenu";
  m.id = "rosMenu";
  m.setAttribute("role", "menu");
  const r = rows.find((x) => x.id === id);
  m.innerHTML = `<div class="ch">${esc(memberName(r))}</div>` + MENU.map(([a, l, c]) => `<button role="menuitem" data-ma="${a}" style="${c ? "color:" + c : ""}">${l}</button>`).join("");
  document.body.appendChild(m);
  const b = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(b.right - 240, innerWidth - 250)) + "px";
  m.style.top = Math.min(b.bottom + 4, innerHeight - m.offsetHeight - 8) + "px";
  m.addEventListener("click", (e) => {
    const a = e.target.closest("[data-ma]")?.dataset.ma;
    if (!a) return;
    closeMenu();
    if (a === "medal") return openMedal([id]);
    if (a === "ribbon") return openRibbon([id]);
    runOriginal(a, id);
  });
  m.querySelector("button")?.focus();
}
function closeMenu() {
  document.getElementById("rosMenu")?.remove();
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#rosMenu") && !e.target.closest('[data-act="menu"]')) closeMenu();
});

async function runOriginal(action, id) {
  if (typeof window.openRosterCtx !== "function") return;
  // openRosterCtx records which member the action is for; ctxAction then opens the original window.
  window.openRosterCtx({ stopPropagation() {}, preventDefault() {}, clientX: 0, clientY: 0, pageX: 0, pageY: 0 }, id);
  await window.ctxAction(action);
}

// ───────── award windows ─────────
let picked = new Set();
let pickPl = "";
let pickQ = "";
function pickerHtml(kind, ribbonName) {
  const plats = [...new Set(rows.map((r) => r.platoon || ""))].filter(Boolean).sort((a, b) => platoonOrder(a) - platoonOrder(b));
  const list = rows
    .filter((r) => (!pickPl || r.platoon === pickPl) && memberName(r).toLowerCase().includes(pickQ.toLowerCase()))
    .sort((a, b) => memberName(a).localeCompare(memberName(b)));
  const has = (r) => (r.ribbonHistory || []).filter((x) => x.title === ribbonName).length;
  return `<div class="pick-h"><input class="srch pq" placeholder="SEARCH..." value="${esc(pickQ)}" aria-label="Search recipients">
      <button class="pc2 ${!pickPl ? "on" : ""}" data-pp="">ALL</button>${plats.map((p) => `<button class="pc2 ${pickPl === p ? "on" : ""}" data-pp="${esc(p)}">${esc(p.replace("Platoon", "PLT").toUpperCase())}</button>`).join("")}</div>
    <div class="pick-c"><span>${list.length} SHOWN</span><span><button class="pc2" data-sel="1">SELECT SHOWN</button> <button class="pc2" data-sel="0">CLEAR</button></span></div>
    <div class="plist">${
      list
        .map((r) => {
          const h = kind === "ribbon" ? has(r) : 0;
          return `<label class="pr"><input type="checkbox" data-pick="${esc(r.id)}" ${picked.has(r.id) ? "checked" : ""}><span>${esc(memberName(r))}</span>${h ? `<span class="has">×${h} → ×${h + 1}</span>` : ""}<span class="pp">${esc(r.platoon || "")}</span></label>`;
        })
        .join("") || '<div class="pr">NOBODY MATCHES</div>'
    }</div>
    <div class="tags">${[...picked].map((id) => `<button class="tg" data-unpick="${esc(id)}" title="Remove">${esc(memberName(rows.find((r) => r.id === id)))} ✕</button>`).join("")}</div>`;
}

function wirePicker(ov, kind, refresh) {
  ov.addEventListener("click", (e) => {
    const pp = e.target.closest("[data-pp]");
    if (pp) {
      pickPl = pp.dataset.pp;
      return refresh();
    }
    const sel = e.target.closest("[data-sel]");
    if (sel) {
      rows
        .filter((r) => (!pickPl || r.platoon === pickPl) && memberName(r).toLowerCase().includes(pickQ.toLowerCase()))
        .forEach((r) => (sel.dataset.sel === "1" ? picked.add(r.id) : picked.delete(r.id)));
      return refresh();
    }
    const up = e.target.closest("[data-unpick]");
    if (up) {
      picked.delete(up.dataset.unpick);
      return refresh();
    }
  });
  ov.addEventListener("change", (e) => {
    const c = e.target.closest("[data-pick]");
    if (c) {
      c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick);
      refresh();
    }
  });
  ov.addEventListener("input", (e) => {
    if (e.target.classList.contains("pq")) {
      pickQ = e.target.value;
      refresh();
      const el = ov.querySelector(".pq");
      el.focus();
      el.setSelectionRange(pickQ.length, pickQ.length);
    }
  });
}

async function award(kind, f) {
  const by = memberName(me) || me?.callsign || "Staff";
  let n = 0;
  for (const id of picked) {
    const u = rows.find((r) => r.id === id);
    if (!u) continue;
    const base = { date: f.date, note: f.note, addedBy: by, addedAt: new Date().toISOString() };
    try {
      if (kind === "medal") {
        const updated = [...(u.commendationHistory || []), { ...base, title: f.title, medalImg: f.img }];
        await updateDoc(doc(db, "users", id), { commendationHistory: updated });
        u.commendationHistory = updated;
        if (f.notify) await notifyMember(id, "medal", "You have been awarded a medal", f.title + (f.note ? " — " + f.note.slice(0, 80) : ""));
      } else {
        const updated = [...(u.ribbonHistory || []), { ...base, title: f.title }];
        await updateDoc(doc(db, "users", id), { ribbonHistory: updated });
        u.ribbonHistory = updated;
        if (f.notify) await notifyMember(id, "medal", "You have been awarded a ribbon", f.title + (f.note ? " — " + f.note.slice(0, 80) : ""));
      }
      n++;
    } catch (e) {
      console.warn("award failed", id, e.message);
    }
  }
  window.loadRosterPanel?.(); // keep the original's copy in sync
  await audit("manpower", kind === "medal" ? "MEDAL AWARDED (BULK)" : "RIBBON AWARDED (BULK)", `${f.title} awarded to ${n} member(s)`);
  if (kind === "medal" && f.post)
    await webhook("promote", {
      title: `★ ${f.title}`,
      description: `Awarded to ${[...picked].map((id) => memberName(rows.find((r) => r.id === id))).slice(0, 20).join(", ")}${f.note ? `\n\n_${f.note}_` : ""}`,
      color: 0xc9a227,
    });
  return n;
}

function openMedal(pre = []) {
  picked = new Set(pre);
  pickPl = "";
  pickQ = "";
  let sel = 0;
  const ov = openModal(
    `<div class="hd"><div><h2>★ AWARD MEDAL</h2><small>ADDS TO EACH RECIPIENT'S SERVICE RECORD → MEDAL HISTORY</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
     <div class="bd2"><div class="lft">
       <span class="lbl">1 · MEDAL</span><div class="medals"></div>
       <label class="lbl" for="awT">2 · AWARD TITLE</label><input class="fld" id="awT" maxlength="80">
       <label class="lbl" for="awN">3 · CITATION <small>(OPTIONAL — SHOWN ON THEIR RECORD)</small></label><textarea class="fld" id="awN" maxlength="400" placeholder="e.g. For conspicuous gallantry during Operation Iron Veil"></textarea>
       <label class="lbl" for="awD">DATE</label><input class="fld" type="date" id="awD" value="${today()}" max="${today()}">
     </div><div class="rgt"><span class="lbl">4 · RECIPIENTS</span><div class="picker"></div><div class="pv"></div></div></div>
     <div class="ft"><span class="hint" style="display:flex;gap:14px;flex-wrap:wrap"><label><input type="checkbox" id="awNo" checked> NOTIFY THEM</label><label><input type="checkbox" id="awPo" checked> POST TO DISCORD</label></span>
       <div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" id="awGo">★ AWARD</button></div></div>`,
    { color: "rgba(201,162,39,.55)", title: "#C9A227" },
  );
  ov.classList.add("aw");
  const $ = (s) => ov.querySelector(s);
  $("#awT").value = MEDALS[0][0];
  const drawMedals = () =>
    ($(".medals").innerHTML = MEDALS.map(
      ([n, img], i) => `<button class="md ${i === sel ? "on" : ""}" data-md="${i}"><img src="/images/medal_emojis/${encodeURIComponent(img)}" alt="">${esc(n.toUpperCase())}</button>`,
    ).join(""));
  const refresh = () => {
    $(".picker").innerHTML = pickerHtml("medal");
    const n = picked.size, t = $("#awT").value.trim();
    $(".pv").innerHTML = n ? `AWARDING <b>${esc(t || "—")}</b> TO <b>${n} MARINE${n === 1 ? "" : "S"}</b>.` : "PICK AT LEAST ONE RECIPIENT.";
    $("#awGo").disabled = !n || !t;
    $("#awGo").textContent = "★ AWARD" + (n ? " TO " + n : "");
  };
  drawMedals();
  refresh();
  wirePicker(ov, "medal", refresh);
  ov.addEventListener("click", (e) => {
    const md = e.target.closest("[data-md]");
    if (md) {
      sel = +md.dataset.md;
      $("#awT").value = MEDALS[sel][0];
      drawMedals();
      refresh();
    }
  });
  $("#awT").addEventListener("input", refresh);
  $("#awGo").addEventListener("click", async () => {
    $("#awGo").disabled = true;
    const n = await award("medal", { title: $("#awT").value.trim(), img: MEDALS[sel][1], note: $("#awN").value.trim(), date: $("#awD").value || today(), notify: $("#awNo").checked, post: $("#awPo").checked });
    closeModal();
    notify(`★ ${$("#awT")?.value || "MEDAL"} AWARDED TO ${n} MARINE${n === 1 ? "" : "S"}`.toUpperCase());
    load();
  });
}

function openRibbon(pre = []) {
  picked = new Set(pre);
  pickPl = "";
  pickQ = "";
  let sel = 0;
  const ov = openModal(
    `<div class="hd"><div><h2>▬ AWARD RIBBON</h2><small>RIBBONS STACK — EACH AWARD ADDS ONE (×2, ×3 …)</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
     <div class="bd2"><div class="lft">
       <span class="lbl">1 · RIBBON</span><div class="ribs"></div>
       <label class="lbl" for="awN">2 · CITATION <small>(OPTIONAL)</small></label><textarea class="fld" id="awN" maxlength="400" placeholder="e.g. Completed CLS course"></textarea>
       <label class="lbl" for="awD">DATE</label><input class="fld" type="date" id="awD" value="${today()}" max="${today()}">
     </div><div class="rgt"><span class="lbl">3 · RECIPIENTS <small>(TEAL = ALREADY HAS IT)</small></span><div class="picker"></div><div class="pv"></div></div></div>
     <div class="ft"><span class="hint"><label><input type="checkbox" id="awNo" checked> NOTIFY THEM IN THE TERMINAL</label></span>
       <div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b" id="awGo" style="color:#000;background:#2dd4bf;border-color:#2dd4bf">▬ AWARD</button></div></div>`,
    { color: "rgba(45,212,191,.55)", title: "#2dd4bf" },
  );
  ov.classList.add("aw");
  const $ = (s) => ov.querySelector(s);
  const refresh = () => {
    const name = RIBBONS[sel][0];
    $(".ribs").innerHTML = RIBBONS.map(
      ([n, c], i) => `<button class="rb ${i === sel ? "on" : ""}" data-rb="${i}"><span class="bar3" style="${ribbonBar(c)}"></span>${esc(n)}<small>${rows.filter((r) => (r.ribbonHistory || []).some((x) => x.title === n)).length} HOLDERS</small></button>`,
    ).join("");
    $(".picker").innerHTML = pickerHtml("ribbon", name);
    const n = picked.size;
    $(".pv").innerHTML = n ? `AWARDING <b>${esc(name)}</b> TO <b>${n} MARINE${n === 1 ? "" : "S"}</b>.` : "PICK AT LEAST ONE RECIPIENT.";
    $("#awGo").disabled = !n;
    $("#awGo").textContent = "▬ AWARD" + (n ? " TO " + n : "");
  };
  refresh();
  wirePicker(ov, "ribbon", refresh);
  ov.addEventListener("click", (e) => {
    const rb = e.target.closest("[data-rb]");
    if (rb) {
      sel = +rb.dataset.rb;
      refresh();
    }
  });
  $("#awGo").addEventListener("click", async () => {
    $("#awGo").disabled = true;
    const n = await award("ribbon", { title: RIBBONS[sel][0], note: $("#awN").value.trim(), date: $("#awD").value || today(), notify: $("#awNo").checked });
    closeModal();
    notify(`▬ ${RIBBONS[sel][0]} AWARDED TO ${n} MARINE${n === 1 ? "" : "S"}`.toUpperCase());
    load();
  });
}

function openReset(mode) {
  const cur = meta.month || ukMonth();
  const month = mode === "early" ? shiftMonth(cur, 1) : cur;
  if ((meta.lastAttendanceReset || "") >= month) return notify(`${monLabel(month)} RESET IS ALREADY DONE`, 1);
  const prev = shiftMonth(month, -1);
  const ready = rows.filter((r) => r.platoon !== "Reserves" && (r.attendance || 0) >= 3);
  const names = ready.slice(0, 8).map((r) => esc(memberName(r))).join(", ") + (ready.length > 8 ? ` … +${ready.length - 8}` : "");
  const ov = openModal(
    `<div class="hd"><div><h2>⚠ RUN ${monLabel(month)} RESET${mode === "early" ? " EARLY" : ""}?</h2><small>${mode === "early" ? "CORTANA WILL THEN SKIP IT ON THE 1ST" : "BACKUP — CORTANA NORMALLY DOES THIS AT 00:00 ON THE 1ST"}</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
     <div class="bd"><div class="danger-box">1. <b>Save</b> ${monLabel(prev)} to Attendance History.<br>2. <b>+1 PT</b> to everyone who reached 3/3 (${ready.length} now${ready.length ? ": " + names : ""}).<br>3. Everyone's ATT → <b>0/3</b> (events already locked in ${monLabel(month)} still count).<br><br>It cannot be undone.</div>
       <label class="lbl" for="rsT" style="margin-top:14px">TYPE <b style="color:#ff4d4d;font-weight:400">RESET</b> TO CONFIRM</label><input class="fld" id="rsT" autocomplete="off"></div>
     <div class="ft"><span class="hint">LOGGED IN THE AUDIT LOG</span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b red" id="rsGo" disabled>↻ RUN RESET</button></div></div>`,
    { color: "rgba(255,77,77,.55)", title: "#ff4d4d", width: 560 },
  );
  const t = ov.querySelector("#rsT"), go = ov.querySelector("#rsGo");
  t.addEventListener("input", () => (go.disabled = t.value !== "RESET"));
  go.addEventListener("click", async () => {
    go.disabled = true;
    closeModal();
    const p = runReset(month, memberName(me) || me?.callsign || "Staff");
    setTimeout(() => load().catch(() => {}), 800); // shows the running banner
    await p;
    load();
  });
}

const CSS = `
#rosV2 .pgb{display:inline-block;min-width:38px;text-align:center;font:700 11px "Share Tech Mono",monospace;padding:2px 6px;border:1px solid}
#rosV2 .pgb.o{color:#f59e0b;border-color:rgba(245,158,11,.5);background:rgba(245,158,11,.06)}#rosV2 .pgb.e{color:#00D9FF;border-color:rgba(0,217,255,.4);background:rgba(0,217,255,.05)}#rosV2 .pgb.r{color:#8a9aa6;border-color:#3b4a5a}
#${ROOT} .pips{display:flex;gap:4px;align-items:center}
#${ROOT} .pip{width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,217,255,.3);background:none;padding:0;display:inline-block}
#${ROOT} .pip.next{cursor:pointer;border-style:dashed;border-color:var(--a)}
#${ROOT} .pip.next:hover{background:rgba(0,217,255,.25)}
#${ROOT} .pip.f1{background:#ff4d4d;border-color:#ff4d4d}#${ROOT} .pip.f2{background:var(--am);border-color:var(--am)}#${ROOT} .pip.f3{background:var(--g);border-color:var(--g)}
#${ROOT} .pn{font-size:10px;color:var(--d);margin-left:4px}
#${ROOT} .ready{font:inherit;font-size:8.5px;letter-spacing:1.5px;color:#000;background:var(--g);padding:2px 6px;margin-left:6px;border:0;cursor:pointer;animation:rGl 1.6s ease-in-out infinite}
@keyframes rGl{50%{box-shadow:0 0 10px #22e07a}}
@media(prefers-reduced-motion:reduce){#${ROOT} .ready{animation:none}}
#${ROOT} .ptv{font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;color:var(--a)}
#${ROOT} .rib{font-family:Rajdhani,sans-serif;font-weight:700}
#${ROOT} .rowbtn{background:none;border:1px solid transparent;color:var(--d);cursor:pointer;padding:2px 8px;font-size:14px}
#${ROOT} .rowbtn:hover{border-color:var(--l2);color:var(--a)}
#${ROOT} .kp{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
#${ROOT} .reset{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(0,217,255,.35);background:rgba(0,217,255,.05);margin:0 0 12px;font-size:11.5px;color:#c6d0da}#${ROOT} .reset>span{flex:1;min-width:240px}#${ROOT} .reset small{display:block;color:var(--d);font-size:10.5px;margin-top:2px}
#${ROOT} .reset b{font-weight:400}#${ROOT} .reset.ok{border-color:rgba(34,224,122,.45);background:rgba(34,224,122,.05)}#${ROOT} .reset.ok b,#${ROOT} .reset.due b{color:var(--g)}#${ROOT} .reset.miss{border-color:#ff4d4d;background:rgba(255,77,77,.08)}#${ROOT} .reset.miss b{color:#ff4d4d}#${ROOT} .reset.run{border-color:#ffd166;background:rgba(255,209,102,.06)}#${ROOT} .reset.run b{color:#ffd166}
#${ROOT} .b.red{background:#ff4d4d;border-color:#ff4d4d;color:#fff}#${ROOT} .b.r{border-color:#ff4d4d;color:#ff4d4d}
#${ROOT} .grp2{margin-bottom:10px}#${ROOT} .grp2 summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:center;padding:9px 12px;border:1px solid var(--l);background:var(--p);font:700 14px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}
#${ROOT} .grp2 summary::before{content:"▸";color:var(--a);transition:transform .15s}#${ROOT} .grp2[open] summary::before{transform:rotate(90deg)}#${ROOT} .grp2 summary small{margin-left:auto;font:10.5px 'Share Tech Mono',monospace;letter-spacing:1px;color:var(--d)}
#${ROOT} .grp2 summary:focus-visible,#${ROOT} .nm:focus-visible,#${ROOT} .pl:focus-visible{outline:2px solid var(--a);outline-offset:2px}
#${ROOT} .grp2 .wrapx{border-top:0}
#${ROOT} .nm{all:unset;cursor:pointer;color:#fff;font:700 14px Rajdhani,sans-serif;letter-spacing:.5px}#${ROOT} .nm:hover{color:var(--a)}#${ROOT} tr.on td{background:rgba(0,217,255,.07)}
#${ROOT} .ptb{display:inline-flex;align-items:center;gap:6px}#${ROOT} .pl{all:unset;cursor:pointer;width:20px;height:20px;display:grid;place-items:center;border:1px solid var(--l2);color:var(--a);font-size:12px}#${ROOT} .pl:hover{border-color:var(--a)}#${ROOT} .pl.rd{background:var(--g);border-color:var(--g);color:#000}
#${ROOT} .card2{position:fixed;right:18px;bottom:18px;z-index:900;width:360px;max-width:calc(100vw - 36px);border:1px solid var(--a);background:#0b0f15;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
#${ROOT} .card2 h3{margin:2px 0;color:#fff;font:700 18px Rajdhani,sans-serif;letter-spacing:1px}#${ROOT} .card2 .xx{all:unset;cursor:pointer;position:absolute;right:10px;top:8px;color:var(--d)}
#${ROOT} .cst{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}#${ROOT} .cst div{border:1px solid var(--l);text-align:center;padding:6px}#${ROOT} .cst b{display:block;font:700 15px Rajdhani,sans-serif;color:#fff}#${ROOT} .cst span{font-size:8.5px;letter-spacing:1px;color:var(--d)}
#${ROOT} .card2 .acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#${ROOT} .legend{font-size:9.5px;letter-spacing:1.5px;color:var(--d);margin:8px 0 0}
.rosmenu{position:fixed;z-index:9990;background:#0b0f15;border:1px solid rgba(0,217,255,.35);min-width:240px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
.rosmenu .ch{padding:10px 12px;border-bottom:1px solid rgba(0,217,255,.18);font-size:12px;color:#00D9FF;letter-spacing:1px}
.rosmenu button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid rgba(0,217,255,.06);padding:9px 12px;font:inherit;font-size:11.5px;color:#c6d0da;cursor:pointer}
.rosmenu button:hover,.rosmenu button:focus{background:rgba(0,217,255,.06);outline:0}
.v2m.aw .bd2{display:grid;grid-template-columns:1fr 1fr;min-height:0;flex:1;overflow:hidden}
.v2m.aw .lft{padding:16px 20px;border-right:1px solid rgba(0,217,255,.18);overflow:auto}
.v2m.aw .rgt{padding:16px 20px;display:flex;flex-direction:column;min-height:0;overflow:auto}
.v2m .medals{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.v2m .md{border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:8px 4px 7px;text-align:center;cursor:pointer;font:inherit;font-size:8.5px;letter-spacing:1px;color:#7d8a99}
.v2m .md img{width:38px;height:44px;object-fit:contain;display:block;margin:0 auto 4px}
.v2m .md.on{border-color:#C9A227;background:rgba(185,150,50,.12);color:#f3d27a}
.v2m .ribs{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.v2m .rb{display:flex;align-items:center;gap:12px;border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:10px 12px;cursor:pointer;font:inherit;font-size:12px;color:#c6d0da;text-align:left}
.v2m .rb.on{border-color:#2dd4bf;background:rgba(45,212,191,.08);color:#fff}
.v2m .rb .bar3{width:48px;height:18px;flex-shrink:0;border:1px solid rgba(0,0,0,.6)}
.v2m .rb small{margin-left:auto;font-size:9.5px;color:#7d8a99;letter-spacing:1px}
.v2m .pick-h{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.v2m .pick-h .srch{flex:1;min-width:140px}
.v2m .pc2{border:1px solid rgba(0,217,255,.18);background:none;color:#7d8a99;font:inherit;font-size:9.5px;letter-spacing:1.5px;padding:5px 8px;cursor:pointer}
.v2m .pc2.on{color:#00D9FF;border-color:#00D9FF}
.v2m .pick-c{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:1.5px;color:#7d8a99;margin-bottom:6px;align-items:center}
.v2m .plist{min-height:160px;max-height:300px;overflow:auto;border:1px solid rgba(0,217,255,.18)}
.v2m .pr{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(0,217,255,.05);cursor:pointer;font-size:12px}
.v2m .pr:hover{background:rgba(0,217,255,.04)}
.v2m .pr input{accent-color:#00D9FF;width:15px;height:15px}
.v2m .pr .pp{margin-left:auto;font-size:9.5px;color:#4b5765;letter-spacing:1px}
.v2m .pr .has{font-size:9.5px;color:#2dd4bf;letter-spacing:1px}
.v2m .tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;min-height:24px}
.v2m .tg{font:inherit;font-size:10px;letter-spacing:1px;border:1px solid rgba(0,217,255,.35);background:none;color:#00D9FF;padding:3px 7px;cursor:pointer}
.v2m .tg:hover{border-color:#ff4d4d;color:#ff4d4d}
.v2m .pv{border:1px dashed rgba(0,217,255,.35);padding:10px 12px;font-size:11px;letter-spacing:1px;color:#7d8a99;line-height:1.6;margin-top:12px}
.v2m .pv b{color:#fff;font-weight:400}
.v2m .ft label{display:inline-flex;gap:6px;align-items:center;cursor:pointer}
.v2m .ft input[type=checkbox]{accent-color:#00D9FF}
.v2m .danger-box{border:1px solid rgba(255,77,77,.35);background:rgba(255,77,77,.05);padding:12px 14px;font-size:11px;line-height:1.7}
.v2m .danger-box b{color:#ff4d4d;font-weight:400}
@media(max-width:760px){.v2m.aw .bd2{grid-template-columns:1fr;overflow:auto}.v2m.aw .lft{border-right:0;border-bottom:1px solid rgba(0,217,255,.18)}}
`;

onReady(() => {
  const root = mountPanel("panel-roster", ROOT, () => load().catch((e) => notify("ROSTER LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">BATTALION ROSTER</div>
    <div class="sub">UNIT STRENGTH · MONTHLY ATTENDANCE · PROMOTION TRACKING — NCO+</div>
    <div class="kp"></div>
    <div class="bar">
      <input class="srch rq" placeholder="FIND MARINE..." aria-label="Find member" style="width:200px">
      <select class="srch rpl" aria-label="Platoon"></select>
      <select class="srch rsort" aria-label="Sort by">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}">SORT: ${l.toUpperCase()}</option>`).join("")}</select>
      <button class="b gbtn" data-act="group" aria-pressed="true">GROUP: PLATOON ✓</button>
      <span class="sp"></span>
      <button class="b gold needs-edit" data-act="medal">★ AWARD MEDAL</button>
      <button class="b teal needs-edit" data-act="ribbon">▬ AWARD RIBBON</button>
      <div class="more"><button class="b" data-act="more" aria-haspopup="true">⋯ MORE</button>
        <div class="menu"><button data-act="public">↗ View public roster page<small>What members see</small></button>
          <button data-act="backfill" class="needs-edit">▶ Backfill platoon dates<small>Fill missing 'joined platoon' dates</small></button>
          <button data-act="reset" data-mode="early" class="reset-btn" style="color:#ff4d4d">⚠ Run next month’s reset early<small>Cortana normally runs it at 00:00 on the 1st</small></button></div></div>
    </div>
    <div class="reset"></div>
    <div class="tables"></div>
    <aside class="card2" hidden aria-label="Member card"></aside>
    <div class="legend">CLICK THE DASHED PIP TO ADD ATTENDANCE · ＋ = GIVE PT (AT 3/3 IT ALSO RESETS ATT) · CLICK A NAME FOR THE MEMBER CARD · ⋯ = ALL ACTIONS</div>`;

  root.addEventListener("click", async (e) => {
    const ca = e.target.closest("[data-ca]")?.dataset.ca;
    if (ca && sel) {
      if (ca === "medal") return openMedal([sel]);
      if (ca === "ribbon") return openRibbon([sel]);
      return runOriginal(ca, sel);
    }
    const el = e.target.closest("[data-act]");
    if (!el) {
      root.querySelector(".menu")?.classList.remove("open");
      return;
    }
    const act = el.dataset.act, id = el.dataset.id;
    if (act !== "more") root.querySelector(".menu").classList.remove("open");
    if (act === "more") return root.querySelector(".menu").classList.toggle("open");
    if (act === "menu") return openMenu(el, id);
    if (act === "edit") return EDIT_ROLES.has(me?.role) ? runOriginal("edit", id) : null;
    if (act === "att") {
      el.disabled = true;
      const u = rows.find((x) => x.id === id);
      if (u) await addPip(u);
      return load();
    }
    if (act === "pt") {
      await givePT(id);
      return load();
    }
    if (act === "card") { sel = sel === id ? null : id; return render(); }
    if (act === "cardclose") { sel = null; return drawCard(); }
    if (act === "group") { group = !group; return render(); }
    if (act === "medal") return openMedal();
    if (act === "ribbon") return openRibbon();
    if (act === "public") return window.open("/resources-roster", "_blank", "noopener");
    if (act === "backfill") return window.openBackfillPlatoonModal?.();
    if (act === "reset") return openReset(el.dataset.mode || "missed");
  });
  root.addEventListener("toggle", (e) => {
    const d = e.target.closest?.("details.grp2");
    if (d) d.open ? open.add(d.dataset.pl) : open.delete(d.dataset.pl);
  }, true);
  root.addEventListener("input", (e) => {
    if (e.target.classList.contains("rq")) {
      q = e.target.value;
      render();
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.classList.contains("rpl")) {
      pl = e.target.value;
      render();
    }
    if (e.target.classList.contains("rsort")) {
      // Paygrade: rankOrder puts O9 first, so "highest first" is ascending; ties by name.
      sortK = e.target.value;
      sortDir = 1;
      render();
    }
  });
  // Original quick-action / edit windows closing → refresh the table.
  const watch = (id, attr, isOpen) => {
    const m = document.getElementById(id);
    if (m) new MutationObserver(() => !isOpen(m) && load()).observe(m, { attributes: true, attributeFilter: [attr] });
  };
  watch("quickActionModal", "style", (m) => m.style.display === "flex");
  watch("editUserModal", "class", (m) => m.classList.contains("active"));
  watch("backfillPlatoonModal", "style", (m) => m.style.display === "flex");
});
