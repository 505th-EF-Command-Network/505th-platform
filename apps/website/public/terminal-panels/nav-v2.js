/**
 * MENU v2 (approved mock 2026-11-09): DISCORD · WORKSPACE · SECURITY · COMMAND.
 * - Replaces PUBLIC COMMS, DISCORD & NETWORK and AUDIT LOG groups.
 *   Their existing links are MOVED (not rebuilt) so the original editors keep working.
 * - Creates the empty panels for the new pages (each page fills its own panel).
 * - Shows / hides every link from the access grid (/api/terminal/access).
 *   The server enforces the same grid on every read and write.
 * Must load BEFORE the other terminal-panels modules.
 */
import { addCss, onReady } from "./_common.js";

/** access key → existing panel ids it opens. */
const PANEL_KEYS = {
  "panel-register": "bct", "panel-active": "pers", "panel-roster": "roster", "panel-unitcards": "oob", "panel-recruit-source": "rstat", "panel-promote": "promote",
  "panel-attendance": "att", "panel-att-history": "att", "panel-aar": "aar", "panel-gallery": "media", "panel-videos": "media",
  "panel-comms-library": "web", "panel-page-home": "web", "panel-page-505th": "web", "panel-page-alpha": "web", "panel-page-stalker": "web", "panel-page-corpsman": "web", "panel-page-54th": "web",
  "panel-audit-manpower": "audit", "panel-audit-battalion": "audit", "panel-audit-comms": "audit", "panel-audit-discord": "audit",
  "panel-discord": "set", "panel-webhooks": "set", "panel-discord-tracking": "set",
  // new pages
  "panel-tickets": "tk", "panel-events": "ev", "panel-send": "send", "panel-quick": "qu", "panel-info": "info", "panel-mod": "modw",
  "panel-projects": "proj", "panel-notes": "notes",
  "panel-officers": "om", "panel-network": "net",
  "panel-bot": "bot", "panel-overall": "ovr",
  "panel-auditv2": "audit", "panel-website": "web",
  "panel-cmd-status": "set", "panel-cmd-sitrep": "set", "panel-cmd-staff": "set", "panel-cmd-promote": "set", "panel-cmd-suspend": "set", "panel-cmd-settings": "set", "panel-cmd-cortana": "set", "panel-modlist": "set", "panel-cmd-rolesync": "set",
};

/** New pages that need Cortana v2 to reach Discord. Shown as "waiting for Cortana v2" for now. */
const NEEDS_CORTANA = {
};

const GROUPS = [
  { id: "nav-discord", icon: "&#9672;", label: "DISCORD", tip: "Tickets, events, messages, info posts and moderation — sent to Discord by Cortana.", links: [
    ["panel-tickets", "&#127915; Tickets"], ["panel-events", "&#9873; Events"], ["panel-send", "&#9993; Send Message"],
    ["panel-quick", "&#8682; Quick Upload"], ["panel-info", "&#128204; Info Posts"], ["panel-mod", "&#9960; Moderation"], ["panel-modlist", "&#128230; Modlist"]] },
  { id: "nav-workspace", icon: "&#9636;", label: "WORKSPACE", tip: "Staff projects, shared notes and the public website pages.", links: [
    ["panel-projects", "&#9783; Project Tracker"], ["panel-notes", "&#9998; Notes"], ["panel-website", "&#8962; Website"], ["move", "panel-comms-library"]] },
  { id: "nav-security", icon: "&#9961;", label: "SECURITY", tip: "Who has access to what, network health and the audit log.", links: [
    ["panel-officers", "&#9733; Officer Management"], ["panel-network", "&#9673; Network Status"], ["panel-auditv2", "&#9741; Audit Log"]] },
  { id: "nav-command", icon: "&#9733;", label: "COMMAND", tip: "Developer / Commander only.", cls: "cmdg", links: [
    ["label", "UNIT"], ["panel-cmd-status", "&#9673; Unit Status"], ["panel-cmd-sitrep", "&#9993; SITREP"], ["panel-cmd-staff", "&#9823; Command Staff"],
    ["panel-cmd-promote", "&#9650; Command Promotions"], ["panel-cmd-suspend", "&#9940; Suspensions"],
    ["label", "SYSTEM"], ["panel-overall", "&#9678; Overall Status"], ["panel-bot", "&#9654; Bot Server"], ["panel-cmd-cortana", "&#9670; Cortana Setup"], ["panel-cmd-rolesync", "&#8644; Discord Role Sync"], ["panel-cmd-settings", "&#9881; Settings"]] },
  { id: "nav-help", icon: "&#10067;", label: "HELP", tip: "What every page does, how-to steps and guided tours.", links: [["panel-help", "&#10067; Help &amp; Guided Tours"]] },
];

let me = null; // { uid, role, access }
export const access = () => me;
const listeners = [];
/** Run fn(me) once access is known (and again never). */
export function onAccess(fn) {
  me ? fn(me) : listeners.push(fn);
}

function buildMenu() {
  const side = document.getElementById("sidebar");
  const anchor = document.getElementById("nav-content");
  if (!side || !anchor) return;
  const old = ["nav-content", "nav-settings", "nav-auditlog"].map((id) => document.getElementById(id));
  const frag = document.createDocumentFragment();
  for (const g of GROUPS) {
    const item = document.createElement("div");
    item.className = "nav-item" + (g.cls ? " " + g.cls : "");
    item.id = g.id;
    item.innerHTML = `<div class="nav-header" onclick="toggleDropdown('${g.id}')"><span class="nav-icon">${g.icon}</span> ${g.label} <span class="arrow">&#9654;</span><div class="nav-tip"><div class="nav-tip-title">${g.label}</div><div class="nav-tip-body">${g.tip}</div></div></div><div class="sub-links"></div>`;
    const subs = item.querySelector(".sub-links");
    for (const [a, b] of g.links) {
      if (a === "label") {
        const l = document.createElement("div");
        l.className = "nv2-label";
        l.textContent = b;
        subs.appendChild(l);
      } else if (a === "move") {
        const link = side.querySelector(`[data-panel="${b}"]`);
        if (link) subs.appendChild(link);
      } else {
        const l = document.createElement("div");
        l.className = "sub-link";
        l.dataset.panel = a;
        l.innerHTML = b;
        l.setAttribute("onclick", `showPanel('${a}')`);
        subs.appendChild(l);
      }
    }
    frag.appendChild(item);
  }
  // Divider before COMMAND, like the original layout.
  const hr = document.createElement("hr");
  hr.className = "sidebar-divider";
  hr.id = "nv2-cmd-hr";
  frag.insertBefore(hr, frag.querySelector("#nav-command"));
  anchor.parentNode.insertBefore(frag, anchor);
  for (const o of old) o?.remove();
  // The old Command Panel popup is replaced by the COMMAND pages: keep its button (original code uses it) but never show it.
  const cmdBtn = document.getElementById("nav-commander-btn");
  if (cmdBtn) addCss("nv2-cmdbtn-hide", "#nav-commander-btn{display:none!important}");
  // Old links that are replaced by v2 pages (their panels stay for the original code).
  ["panel-page-home", "panel-page-505th", "panel-page-alpha", "panel-page-stalker", "panel-page-corpsman", "panel-page-54th",
   "panel-audit-manpower", "panel-audit-battalion", "panel-audit-comms", "panel-audit-discord", "panel-discord", "panel-webhooks", "panel-discord-tracking"]
    .forEach((id) => side.querySelector(`[data-panel="${id}"]`)?.remove());
  // Removing the old groups leaves dividers back to back — keep one.
  [...side.children].forEach((el) => {
    if (el.tagName === "HR" && el.id !== "nv2-cmd-hr" && el.previousElementSibling?.tagName === "HR") el.remove();
  });
}

function buildPanels() {
  const main = document.querySelector(".main-content");
  if (!main) return;
  for (const id of ["panel-tickets", "panel-events", "panel-send", "panel-quick", "panel-info", "panel-mod", "panel-projects", "panel-notes", "panel-officers", "panel-network",
    "panel-bot", "panel-overall", "panel-auditv2", "panel-website", "panel-cmd-status", "panel-cmd-sitrep", "panel-cmd-staff", "panel-cmd-promote", "panel-cmd-suspend", "panel-cmd-settings", "panel-cmd-cortana", "panel-modlist", "panel-cmd-rolesync", "panel-help"]) {
    if (document.getElementById(id)) continue;
    const p = document.createElement("div");
    p.className = "panel hidden";
    p.id = id;
    if (NEEDS_CORTANA[id]) {
      const [t, d] = NEEDS_CORTANA[id];
      p.innerHTML = `<div class="panel-title">${t}</div><div class="nv2-wait"><b>◷ WAITING FOR CORTANA v2</b><p>${d}</p><p>This page talks to Discord through Cortana. It will go live when Cortana v2 is built (same tested code as RCD Guardian). The design is approved.</p></div>`;
    }
    main.appendChild(p);
  }
  const deny = document.createElement("div");
  deny.className = "panel hidden";
  deny.id = "panel-noaccess";
  deny.innerHTML = '<div class="panel-title">NO ACCESS</div><div class="nv2-wait"><b>🔒 YOU DON\'T HAVE ACCESS TO THIS PAGE</b><p>Ask a Staff NCO or above to give you access in Security → Officer Management.</p></div>';
  main.appendChild(deny);
}

function applyAccess() {
  if (!me) return;
  const a = me.access;
  document.querySelectorAll("#sidebar .sub-link[data-panel]").forEach((l) => {
    const k = PANEL_KEYS[l.dataset.panel];
    if (k) l.style.display = a[k] ? "" : "none";
  });
  // Moderation link: either moderation level.
  const mod = document.querySelector('#sidebar [data-panel="panel-mod"]');
  if (mod) mod.style.display = a.modw || a.modk ? "" : "none";
  // A group (or a label) shows only if something under it shows.
  document.querySelectorAll("#sidebar .nav-item").forEach((g) => {
    const links = [...g.querySelectorAll(".sub-link")];
    if (links.length) g.style.display = links.some((l) => l.style.display !== "none") ? "" : "none";
    let label = null;
    for (const el of g.querySelectorAll(".sub-links > *")) {
      if (el.classList.contains("nv2-label")) {
        label = el;
        label.style.display = "none";
      } else if (label && el.style.display !== "none") label.style.display = "";
    }
  });
  const cmdHr = document.getElementById("nv2-cmd-hr");
  if (cmdHr) cmdHr.style.display = a.bot || a.set || a.ovr ? "" : "none";
}

async function loadAccess() {
  try {
    const r = await fetch("/api/terminal/access", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    me = (await r.json()).me;
  } catch (e) {
    console.warn("access load failed", e);
    return;
  }
  // No Notes access, but someone shared a note with you → show Notes (only those notes).
  if (!me.access.notes) {
    try {
      const j = await (await fetch("/api/terminal/notes", { cache: "no-store" })).json();
      if (j.notes?.length) me.access.notes = true;
    } catch {}
  }
  applyAccess();
  listeners.splice(0).forEach((fn) => fn(me));
}

function wrapShowPanel() {
  const orig = window.showPanel;
  if (typeof orig !== "function" || orig.__v2) return;
  const wrapped = function (id) {
    const k = id === "panel-mod" ? null : PANEL_KEYS[id];
    const blocked = me && ((k && !me.access[k]) || (id === "panel-mod" && !(me.access.modw || me.access.modk)));
    orig.call(this, blocked ? "panel-noaccess" : id);
  };
  wrapped.__v2 = true;
  window.showPanel = wrapped;
}

const CSS = `
#sidebar .nv2-label{color:rgba(0,217,255,.7);font-size:8px;letter-spacing:2px;padding:8px 0 2px 8px}
#sidebar .nav-item.cmdg>.nav-header{color:#f59e0b}
#sidebar .nav-item.cmdg .nv2-label{color:rgba(245,158,11,.65)}
.nv2-wait{border:1px solid rgba(0,217,255,.18);border-left:3px solid #f59e0b;background:rgba(245,158,11,.04);padding:18px 20px;margin-top:16px;font-family:'Share Tech Mono',monospace;color:#c6d0da;font-size:12px;line-height:1.7;max-width:760px}
.nv2-wait b{color:#f59e0b;letter-spacing:2px;font-size:12px}.nv2-wait p{margin:8px 0 0}
`;

// Build synchronously so the page modules loaded after this one can mount into the new panels.
buildMenu();
buildPanels();
addCss("navV2", CSS);
onReady(() => {
  wrapShowPanel();
  loadAccess();
  // The original page applies its own role visibility after sign-in; re-apply ours after it.
  addEventListener("terminal:ready", () => {
    wrapShowPanel();
    applyAccess();
  });
});
