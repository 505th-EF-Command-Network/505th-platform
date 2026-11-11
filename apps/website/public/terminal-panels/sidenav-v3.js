/**
 * SIDE NAV v3 (approved mock 2026-11-11).
 * Adds to the v2 menu (nav-v2.js builds the groups and access rules; nothing removed):
 *   - bigger text · filter box ( / ) · ★ pinned pages (saved on your users doc: navPins)
 *   - count badges: red = needs action (BCT approvals, tickets waiting for staff)
 *   - groups open/close on their own and remember it · « COLLAPSE to an icon strip (remembered)
 * Must load AFTER nav-v2.js.
 */
import { collection, doc, getDocs, query, updateDoc, where } from "/terminal-shim/firestore.js";
import { addCss, auth, db, getMe, onReady } from "./_common.js";
import { onAccess } from "./nav-v2.js";

const LS_OPEN = "sn3.open", LS_RAIL = "sn3.rail";
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let pins = [];
let side = null;

const linkOf = (panel) => $(`#sidebar .nav-item .sub-link[data-panel="${panel}"]`);
const labelOf = (el) => el.textContent.replace(/☆|★/g, "").trim();

// ───────── groups: open / close on their own, remembered ─────────
function setupGroups() {
  const open = new Set(lsGet(LS_OPEN, []));
  $$("#sidebar .nav-item").forEach((g) => g.classList.toggle("open", open.has(g.id)));
  window.toggleDropdown = (id) => {
    const g = document.getElementById(id);
    if (!g) return;
    if (document.body.classList.contains("sn3-rail")) { setRail(false); g.classList.add("open"); }
    else g.classList.toggle("open");
    lsSet(LS_OPEN, $$("#sidebar .nav-item.open").map((x) => x.id));
    $(".nav-header", g)?.setAttribute("aria-expanded", String(g.classList.contains("open")));
  };
  $$("#sidebar .nav-header").forEach((h) => {
    h.setAttribute("role", "button");
    h.tabIndex = 0;
    h.setAttribute("aria-expanded", String(h.parentElement.classList.contains("open")));
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); h.click(); } });
  });
  $$("#sidebar .sub-link, #sidebar .dash-link").forEach((l) => {
    l.tabIndex = 0;
    l.setAttribute("role", "link");
    l.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); l.click(); } });
  });
}

// ───────── filter ─────────
function setupFilter() {
  const dash = $("#sidebar .dash-link");
  if (!dash || $("#sn3F")) return;
  dash.insertAdjacentHTML("beforebegin", `<div class="sn3-f"><input id="sn3F" placeholder="FILTER MENU…  ( / )" aria-label="Filter menu" autocomplete="off"></div>`);
  const f = $("#sn3F");
  let before = null;
  f.addEventListener("input", () => {
    const q = f.value.trim().toLowerCase();
    if (q && !before) before = $$("#sidebar .nav-item.open").map((g) => g.id);
    $$("#sidebar .nav-item").forEach((g) => {
      if (g.style.display === "none" && !g.dataset.sn3hid) return; // no access
      let any = false;
      $$(".sub-link", g).forEach((l) => {
        if (l.dataset.sn3acc === undefined) l.dataset.sn3acc = l.style.display === "none" ? "0" : "1";
        if (l.dataset.sn3acc === "0") return;
        const hit = !q || labelOf(l).toLowerCase().includes(q) || labelOf($(".nav-header", g)).toLowerCase().includes(q);
        l.classList.toggle("sn3-miss", !hit);
        any ||= hit;
      });
      $$(".nv2-label", g).forEach((x) => x.classList.toggle("sn3-miss", !!q));
      g.classList.toggle("sn3-miss", !any);
      if (q) g.classList.add("open");
    });
    $("#sn3Pins")?.classList.toggle("sn3-miss", !!q);
    if (!q) {
      $$("#sidebar .sn3-miss").forEach((x) => x.classList.remove("sn3-miss"));
      $$("#sidebar .sub-link").forEach((l) => delete l.dataset.sn3acc);
      if (before) $$("#sidebar .nav-item").forEach((g) => g.classList.toggle("open", before.includes(g.id)));
      before = null;
    }
  });
  f.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { f.value = ""; f.dispatchEvent(new Event("input")); f.blur(); }
    if (e.key === "Enter") { const l = $$("#sidebar .nav-item .sub-link").find((x) => !x.classList.contains("sn3-miss") && x.style.display !== "none" && x.offsetParent); if (l) { l.click(); f.value = ""; f.dispatchEvent(new Event("input")); } }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
      e.preventDefault();
      if (document.body.classList.contains("sn3-rail")) setRail(false);
      f.focus();
    }
  });
}

// ───────── pins ─────────
function drawPins() {
  let box = $("#sn3Pins");
  if (!box) {
    $("#sidebar .dash-link")?.insertAdjacentHTML("afterend", `<div id="sn3Pins" class="sn3-pins"></div>`);
    box = $("#sn3Pins");
  }
  const live = pins.map((p) => [p, linkOf(p)]).filter(([, l]) => l && l.style.display !== "none");
  box.innerHTML = live.length
    ? `<div class="sn3-ph">★ PINNED</div>` + live.map(([p, l]) => `<div class="sub-link sn3-pin" data-panel="${p}" tabindex="0" role="link">${l.innerHTML.replace(/<button[\s\S]*?<\/button>/g, "").replace(/<span class="sn3-n[^>]*>[\s\S]*?<\/span>/g, "")}<button class="sn3-pb on" data-unpin="${p}" aria-label="Unpin">★</button></div>`).join("")
    : "";
  $$("#sidebar .nav-item .sub-link[data-panel]").forEach((l) => $(".sn3-pb", l)?.classList.toggle("on", pins.includes(l.dataset.panel)));
  syncActive();
}
async function togglePin(panel) {
  pins = pins.includes(panel) ? pins.filter((p) => p !== panel) : [...pins, panel].slice(0, 8);
  drawPins();
  const uid = auth.currentUser?.uid;
  if (uid) updateDoc(doc(db, "users", uid), { navPins: pins }).catch(() => {});
}
function setupPins() {
  $$("#sidebar .nav-item .sub-link[data-panel]").forEach((l) => {
    if ($(".sn3-pb", l)) return;
    l.insertAdjacentHTML("beforeend", `<button class="sn3-pb" tabindex="-1" aria-label="Pin ${labelOf(l)}" title="Pin to top (or right-click)">☆</button>`);
  });
  side.addEventListener("click", (e) => {
    const b = e.target.closest(".sn3-pb");
    if (b) { e.preventDefault(); e.stopPropagation(); togglePin(b.dataset.unpin || b.closest(".sub-link").dataset.panel); return; }
    const p = e.target.closest(".sn3-pin");
    if (p) window.showPanel?.(p.dataset.panel);
  }, true);
  side.addEventListener("contextmenu", (e) => {
    const l = e.target.closest(".sub-link[data-panel]");
    if (!l) return;
    e.preventDefault();
    togglePin(l.dataset.panel);
  });
  side.addEventListener("keydown", (e) => { const p = e.target.closest(".sn3-pin"); if (p && e.key === "Enter") window.showPanel?.(p.dataset.panel); });
}
function syncActive() {
  const vis = $(".main-content > .panel:not(.hidden)")?.id;
  $$("#sidebar .sn3-pin").forEach((p) => p.classList.toggle("active", p.dataset.panel === vis));
}

// ───────── counts ─────────
function badge(panel, n, kind = "r") {
  const l = linkOf(panel);
  if (!l) return;
  let b = $(".sn3-n", l);
  if (!n) return b?.remove();
  if (!b) { b = document.createElement("span"); l.insertBefore(b, $(".sn3-pb", l)); }
  b.className = "sn3-n " + kind;
  b.textContent = n > 99 ? "99+" : n;
  b.setAttribute("aria-label", `${n} need action`);
}
function groupTotals() {
  $$("#sidebar .nav-item").forEach((g) => {
    const t = $$(".sn3-n.r", g).reduce((a, b) => a + (parseInt(b.textContent, 10) || 0), 0);
    const h = $(".nav-header", g);
    let b = $(".sn3-gn", h);
    if (!t) return b?.remove();
    if (!b) { b = document.createElement("span"); b.className = "sn3-gn"; h.insertBefore(b, $(".arrow", h)); }
    b.textContent = t > 99 ? "99+" : t;
  });
}
async function counts(acc) {
  const a = acc?.access || {};
  try {
    if (a.bct) badge("panel-register", (await getDocs(query(collection(db, "users"), where("status", "==", "pending")))).size);
  } catch {}
  try {
    if (a.tk) {
      const s = await getDocs(query(collection(db, "tickets"), where("status", "==", "open")));
      badge("panel-tickets", s.docs.filter((d) => d.data().waiting === "staff").length);
    }
  } catch {}
  groupTotals();
  drawPins();
}

// ───────── collapse ─────────
function setRail(on) {
  document.body.classList.toggle("sn3-rail", on);
  lsSet(LS_RAIL, on);
  const b = $("#sn3Col");
  if (b) { b.textContent = on ? "»" : "« COLLAPSE"; b.setAttribute("aria-label", on ? "Expand menu" : "Collapse menu"); }
}
function setupFoot() {
  if ($("#sn3Foot")) return;
  side.insertAdjacentHTML("beforeend", `<div class="sn3-foot" id="sn3Foot"><span class="sn3-cs" id="sn3Cs"><i></i><span>CORTANA</span></span><button id="sn3Col" type="button">« COLLAPSE</button></div>`);
  $("#sn3Col").onclick = () => setRail(!document.body.classList.contains("sn3-rail"));
  setRail(lsGet(LS_RAIL, false) && innerWidth > 768);
}
async function cortana() {
  try {
    const { cortanaStatus } = await import("./_common.js");
    const s = await cortanaStatus();
    const el = $("#sn3Cs");
    if (el) { el.classList.toggle("off", !s.online); $("span", el).textContent = s.online ? "CORTANA OK" : "CORTANA OFFLINE"; }
  } catch {}
}

async function start() {
  side = document.getElementById("sidebar");
  if (!side || side.dataset.sn3) return;
  side.dataset.sn3 = "1";
  addCss("sn3", CSS);
  setupGroups();
  setupFilter();
  setupPins();
  setupFoot();
  const main = $(".main-content");
  if (main) new MutationObserver(syncActive).observe(main, { attributes: true, subtree: true, attributeFilter: ["class"] });
  onAccess(async (acc) => {
    const me = await getMe().catch(() => null);
    pins = Array.isArray(me?.navPins) ? me.navPins.filter((p) => typeof p === "string") : [];
    drawPins();
    counts(acc);
    setInterval(() => counts(acc), 120_000);
  });
  cortana();
  setInterval(cortana, 60_000);
}
onReady(start);

const CSS = `
#sidebar{display:flex;flex-direction:column;width:272px;padding:0;transition:width .15s}
#sidebar>*{flex-shrink:0}
.sn3-f{padding:12px 12px 8px}
.sn3-f input{width:100%;box-sizing:border-box;padding:10px;background:rgba(0,0,0,.45);border:1px solid rgba(0,217,255,.25);color:#e6edf5;font:14px 'Share Tech Mono',monospace;letter-spacing:1px;outline:none}
.sn3-f input:focus{border-color:#00D9FF}
#sidebar .dash-link{font-size:16px;padding:11px 16px}
#sidebar .nav-header{font-size:16px;padding:11px 16px;gap:12px}
#sidebar .nav-icon{font-size:16px;width:22px}
#sidebar .sub-links{padding-left:34px}
#sidebar .sub-link{display:flex;align-items:center;gap:8px;font-size:15.5px;padding:9px 12px 9px 14px}
#sidebar .nv2-label{font-size:10.5px!important;padding:10px 0 3px 14px!important}
#sidebar .sub-link:focus-visible,#sidebar .nav-header:focus-visible,#sidebar .dash-link:focus-visible{outline:1px solid #00D9FF;outline-offset:-1px}
.sn3-pb{all:unset;cursor:pointer;margin-left:auto;padding:0 4px;color:#4b5765;font-size:15px;opacity:0}
#sidebar .sub-link:hover .sn3-pb,#sidebar .sub-link:focus-within .sn3-pb,.sn3-pb.on{opacity:1}.sn3-pb.on{color:#C9A227}.sn3-pb:hover{color:#C9A227}
.sn3-n{margin-left:auto;min-width:22px;height:20px;padding:0 6px;border-radius:10px;display:inline-grid;place-items:center;font:700 12.5px Rajdhani,sans-serif;background:#ff4d4d;color:#fff}
.sn3-n.b{background:rgba(0,217,255,.2);color:#00D9FF}.sn3-n+.sn3-pb{margin-left:6px}
.sn3-gn{min-width:22px;height:20px;padding:0 6px;border-radius:10px;display:inline-grid;place-items:center;font:700 12.5px Rajdhani,sans-serif;background:#ff4d4d;color:#fff;margin-left:auto}
.sn3-gn+.arrow{margin-left:8px!important}
.nav-item.open .sn3-gn{display:none}
.sn3-pins{padding-bottom:4px}.sn3-pins:empty{display:none}
.sn3-ph{font:12px 'Share Tech Mono',monospace;letter-spacing:2.5px;color:#C9A227;padding:12px 16px 4px}
#sidebar .sn3-pin{padding-left:22px}
.sn3-miss{display:none!important}
.sn3-foot{margin-top:auto;position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid rgba(0,217,255,.2);background:rgba(8,10,14,.98);font:12px 'Share Tech Mono',monospace;letter-spacing:1.5px;color:#7d8a99}
.sn3-cs{display:flex;align-items:center;gap:7px;white-space:nowrap}.sn3-cs i{width:8px;height:8px;border-radius:50%;background:#22e07a;box-shadow:0 0 6px #22e07a}.sn3-cs.off i{background:#ff4d4d;box-shadow:0 0 6px #ff4d4d}.sn3-cs.off{color:#ff4d4d}
#sn3Col{all:unset;cursor:pointer;margin-left:auto;border:1px solid rgba(0,217,255,.3);padding:5px 10px;color:#00D9FF;font-size:12px;white-space:nowrap}#sn3Col:focus-visible,#sn3Col:hover{border-color:#00D9FF}
/* rail */
body.sn3-rail #sidebar{width:70px;overflow:visible}
body.sn3-rail .sn3-f,body.sn3-rail .sn3-pins,body.sn3-rail #sidebar .sub-links,body.sn3-rail #sidebar .arrow,body.sn3-rail .sn3-cs span,body.sn3-rail #sidebar .nv2-label{display:none!important}
body.sn3-rail #sidebar .nav-header,body.sn3-rail #sidebar .dash-link{justify-content:center;padding:13px 0;font-size:0;position:relative;border-left-width:0}
body.sn3-rail #sidebar .nav-icon{font-size:19px;width:auto}
body.sn3-rail .sn3-gn{position:absolute;top:3px;right:8px;margin:0;min-width:18px;height:17px;font-size:10.5px;display:inline-grid!important}
body.sn3-rail .sn3-foot{justify-content:center;padding:10px 0}body.sn3-rail #sn3Col{margin:0}
body.sn3-rail #sidebar .nav-tip{font-size:13px}
@media(max-width:768px){#sidebar{width:280px}body.sn3-rail #sidebar{width:280px}#sn3Col{display:none}}
@media(prefers-reduced-motion:reduce){#sidebar{transition:none}}
`;
