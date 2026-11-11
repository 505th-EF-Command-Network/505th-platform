/**
 * DASHBOARD v2 — built to the approved mock (shell-v2, 2026-11-10).
 * Welcome bar · customise bar · widget grid · "+ Add widget" drawer.
 * Layout is saved per member on users/{uid}.dashLayout = { order: [...], wide: [...] }.
 * Widgets only appear if the member has the access item they need.
 * Cortana / Discord / Hub numbers show as "not running" until Cortana v2 reports them.
 */
import { onAuthStateChanged } from "/terminal-shim/auth.js";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, auth, cortanaStatus, db, esc, uptimeDays, getMe, getUsers, hexAvatar, isMember, memberName, notify, onReady, platoonOrder, rateColor, toDate } from "./_common.js";
import { onAccess } from "./nav-v2.js";

addCss("dash2", `
#panel-dashboard > :not(.panel-title):not(#dash2){display:none!important}
#dash2{font-family:'Share Tech Mono',monospace;color:#d6dde6}
#dash2 .b{background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;padding:8px 14px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11.5px;cursor:pointer}
#dash2 .b.gold,.d2-drawer .b.gold{background:#f59e0b;border-color:#f59e0b;color:#000}
.d2-drawer .b{background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;cursor:pointer}
#dash2 .b.sm,.d2-drawer .b.sm{padding:4px 9px;font-size:10px}
#dash2 .dim,.d2-drawer .dim{color:#7d8a99;font-size:10.5px;letter-spacing:1.5px}
#dash2 .lnk{background:none;border:0;color:#00D9FF;font-size:10px;letter-spacing:1.5px;cursor:pointer;font-family:inherit}
.d2-welcome{display:flex;align-items:center;gap:16px;border:1px solid rgba(0,217,255,.18);background:linear-gradient(90deg,rgba(0,217,255,.06),transparent);padding:14px 18px}
.d2-hi{font-family:Rajdhani,sans-serif;font-weight:700;font-size:24px;letter-spacing:4px;color:#fff}
.d2-unit{text-align:right;margin-left:auto}.d2-unit b{display:block;font-family:Rajdhani,sans-serif;font-size:16px;letter-spacing:2px}.d2-unit small{font-size:10px;letter-spacing:2px}
.d2-custbar{display:none;align-items:center;gap:10px;border:1px dashed #f59e0b;background:rgba(245,158,11,.06);color:#f59e0b;padding:10px 14px;margin-top:12px;flex-wrap:wrap}.d2-custbar.on{display:flex}.d2-custbar b{font-family:Rajdhani,sans-serif;letter-spacing:2px}
.d2-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.d2-w{border:1px solid rgba(0,217,255,.18);background:#0b0f15;padding:14px 16px;position:relative;min-height:120px;min-width:0}.d2-w.wide{grid-column:1/-1}
.d2-wh{display:flex;justify-content:space-between;align-items:center;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;color:#00D9FF;font-size:13px;margin-bottom:10px;gap:8px}
.d2-wt{display:none;gap:4px}.d2-editing .d2-w{border-style:dashed;border-color:#f59e0b;cursor:grab}.d2-editing .d2-wt{display:flex}.d2-w.dragging{opacity:.35}.d2-w.over{box-shadow:0 0 0 2px #00D9FF}
.d2-wt button{background:#070a0f;border:1px solid rgba(0,217,255,.35);color:#c6d0da;width:26px;height:24px;cursor:pointer;font-size:11px}.d2-wt .rm{color:#ff4d4d;border-color:rgba(255,77,77,.5)}.d2-wt .hd{cursor:grab}
.d2-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.d2-kpi{border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:14px;text-align:center}.d2-kpi b{display:block;font-family:Rajdhani,sans-serif;font-size:26px;color:#00D9FF}.d2-kpi span{font-size:9px;letter-spacing:2.5px;color:#7d8a99}
.d2-op{display:grid;grid-template-columns:48px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:center}.d2-op .d{text-align:center;font-size:9.5px;letter-spacing:2px;color:#7d8a99}.d2-op .d b{display:block;font-family:Rajdhani,sans-serif;font-size:22px;color:#fff;line-height:1}.d2-op>div>b{font-family:Rajdhani,sans-serif;font-size:15px;color:#fff}.d2-op small{display:block;font-size:10px;color:#7d8a99;letter-spacing:1px}
.d2-todo{border-left:3px solid #00D9FF;padding:8px 12px;margin-bottom:6px;font-size:12px;background:rgba(255,255,255,.02);display:flex;justify-content:space-between;gap:8px;align-items:center}.d2-todo.am{border-color:#f59e0b}
.d2-onl{display:flex;flex-wrap:wrap;gap:12px}.d2-ou{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative}.d2-ou small{font-size:9.5px;color:#7d8a99}.d2-ou::after{content:"";position:absolute;right:2px;top:22px;width:8px;height:8px;background:#22e07a;border-radius:50%;border:2px solid #0b0f15}
.d2-act{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:7px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04)}.d2-act b{color:#fff;font-weight:400}.d2-act small{font-size:10px;color:#7d8a99}
.d2-kvr{display:flex;justify-content:space-between;font-size:11.5px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}.d2-kvr span{color:#7d8a99;letter-spacing:1.5px;font-size:10px}.d2-kvr b{font-weight:400;color:#fff}
.d2-lb{font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin:14px 0 6px}
.d2-hbar{display:grid;grid-template-columns:120px 1fr 64px;gap:10px;align-items:center;font-size:10.5px;letter-spacing:1.2px;color:#7d8a99;margin-bottom:8px}.d2-hbar b{color:#fff;font-weight:400;text-align:right}
.d2-ub{display:flex;gap:2px;height:16px}.d2-ub i{flex:1;background:#22e07a;opacity:.8}.d2-ub i.uw{background:#f59e0b}.d2-ub i.ur{background:#ff4d4d}.d2-ub i.uo{background:#26303b;opacity:1}
.d2-sys{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.d2-sy{border:1px solid rgba(0,217,255,.18);border-left:3px solid var(--sc);padding:10px}.d2-sy.ok{--sc:#22e07a}.d2-sy.warn{--sc:#f59e0b}.d2-sy.bad{--sc:#ff4d4d}.d2-sy.off{--sc:#4b5765}.d2-sy b{display:block;font-family:Rajdhani,sans-serif;letter-spacing:2px;color:#fff;font-size:14px}.d2-sy span{font-size:9.5px;letter-spacing:1.5px;color:var(--sc)}.d2-sy.off span{color:#7d8a99}.d2-sy small{display:block;font-size:9.5px;color:#7d8a99;margin-top:4px}
.d2-ch{display:flex;align-items:flex-end;gap:3px;height:60px;margin-top:6px}.d2-ch i{flex:1;background:linear-gradient(#00D9FF,rgba(0,217,255,.3));min-height:2px}.d2-ch i.off{background:#26303b}
.d2-stf{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}.d2-stf b{font-family:Rajdhani,sans-serif;font-size:14px;color:#fff;font-weight:700}.d2-stf small{display:block;font-size:9.5px;color:#7d8a99;letter-spacing:1px}.d2-stf .wh2{font-size:10px;color:#7d8a99;text-align:right}.d2-stf .wh2 i{font-style:normal;color:#00D9FF}
.d2-cort{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.d2-cort div{border:1px solid rgba(0,217,255,.18);padding:10px;text-align:center}.d2-cort b{display:block;font-family:Rajdhani,sans-serif;font-size:20px;color:#4b5765}.d2-cort span{font-size:9px;letter-spacing:1.5px;color:#7d8a99}
.d2-sr{font-family:Rajdhani,sans-serif;color:#fff;font-size:15px;letter-spacing:1px}.d2-w p.d2-p{margin:6px 0;font-size:12.5px;white-space:pre-wrap}
.d2-hint{font-size:10px;color:#7d8a99;line-height:1.6;margin-top:10px}
.d2-drawer{position:fixed;top:58px;right:0;bottom:0;width:360px;max-width:94vw;background:#0b0f15;border-left:1px solid rgba(0,217,255,.35);z-index:450;padding:14px;overflow:auto;box-shadow:-20px 0 60px rgba(0,0,0,.5);font-family:'Share Tech Mono',monospace}.d2-drawer[hidden]{display:none}
.d2-dh{display:flex;align-items:center;margin-bottom:12px}.d2-dh b{font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF;flex:1}
.d2-ci{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;border:1px solid rgba(0,217,255,.18);padding:10px;margin-bottom:8px}.d2-ci .ico{width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(0,217,255,.35);color:#00D9FF;font-size:16px}
.d2-ci b{display:block;font-size:12px;letter-spacing:1.5px;color:#fff;font-weight:400}.d2-ci small{font-size:10px;color:#7d8a99;line-height:1.4}.d2-ci.on{opacity:.45}.d2-ci .lock{font-size:9.5px;color:#7d8a99;letter-spacing:1px}
.d2-ch2{font-size:9.5px;letter-spacing:2px;color:#f59e0b;margin:14px 0 8px}
.d2-pl{display:grid;grid-template-columns:120px 1fr 34px;gap:10px;align-items:center;font-size:11px;padding:4px 0}.d2-pl span{color:#aeb9c4;letter-spacing:1px}.d2-pl b{text-align:right;font-weight:400;color:#fff}.d2-pl .bar{height:8px;background:#1a2330}.d2-pl .bar i{display:block;height:100%;background:#00D9FF}
.d2-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;width:100%;padding:7px 0;border:0;border-bottom:1px solid rgba(255,255,255,.04);background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer}.d2-row:hover{background:rgba(0,217,255,.04)}.d2-row small{font-size:10px;color:#7d8a99}.d2-row b{font-weight:400;color:#fff}
.d2-tag{font-size:9px;letter-spacing:1.5px;border:1px solid var(--c,#7d8a99);color:var(--c,#7d8a99);padding:1px 6px;white-space:nowrap}
.d2-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.d2-kan{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.d2-kan div{border:1px solid rgba(0,217,255,.18);padding:6px;text-align:center}.d2-kan b{display:block;font-family:Rajdhani,sans-serif;font-size:18px;color:#00D9FF}.d2-kan span{font-size:8.5px;letter-spacing:1.5px;color:#7d8a99}
#dash2 button:focus-visible,.d2-drawer button:focus-visible{outline:2px solid #00D9FF;outline-offset:1px}
@media(max-width:1000px){.d2-grid,.d2-sys,.d2-cort,.d2-kpis{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.d2-grid{grid-template-columns:1fr}.d2-welcome{flex-wrap:wrap}}
`);

const OPS = { Active: ["ACTIVE", "#22e07a"], "Stand Down": ["STAND DOWN", "#7d8a99"], "On Op": ["ON OP", "#f59e0b"], "Training Cycle": ["TRAINING", "#00D9FF"], Maintenance: ["MAINTENANCE", "#a78bfa"] };
const STAFF = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
const ROLE_L = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER" };

let uid = null;
let acc = {};
let L = [];
let WIDE = new Set();
let editing = false;
const D = { cortana: { online: false }, users: [], fragos: null, events: [], att: [], tasks: [], notes: [], audit: [], pres: [], status: {}, ping: {} };

const ukTime = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : ""; };
const ukDay = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/London" }).toUpperCase() : ""; };
const empty = (t) => `<p class="dim">${t}</p>`;
const active = () => D.users.filter((u) => isMember(u) && !["retired_veteran", "left", "inactive"].includes(u.status) && u.status !== "suspended");
const pending = () => D.users.filter((u) => u.status === "pending");
const onlineNow = () => {
  const cut = Date.now() - 3 * 60 * 1000;
  const m = new Map();
  D.pres.filter((p) => Date.parse(p.updatedAt || 0) > cut).forEach((p) => m.set(p.uid, p));
  // You're looking at the dashboard, so you're online — even if your check-in hasn't been saved yet.
  if (D.me?.uid && !m.has(D.me.uid)) m.set(D.me.uid, { uid: D.me.uid, role: D.me.role || "", panel: "admin_dashboard", updatedAt: new Date().toISOString() });
  return [...m.values()];
};
const userOf = (id) => D.users.find((u) => u.id === id) || {};
const panelName = (p) => {
  const id = String(p || "").replace(/^admin_/, "panel-");
  const l = document.querySelector(`#sidebar .sub-link[data-panel="${id}"]`) || document.querySelector(`#sidebar .sub-link[data-panel="panel-${p}"]`);
  if (/dashboard/.test(String(p))) return "DASHBOARD";
  return (l ? l.textContent.trim() : String(p || "Terminal").replace(/_/g, " ")).toUpperCase();
};
const ub = (pcts) => `<div class="d2-ub">${pcts.map((v) => `<i class="${v == null ? "uo" : v < 95 ? "ur" : v < 99.9 ? "uw" : ""}"></i>`).join("")}</div>`;
const NO_HISTORY = Array(30).fill(null);
/** Website / database uptime from Cortana's 1-minute checks (bot_status/monitors): % of checks that passed per UK day. */
const monDays = (m) => Array.from({ length: 30 }, (_, i) => {
  const d = m?.days?.[new Date(Date.now() - (29 - i) * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" })];
  return d && d.n ? Math.round((d.ok / d.n) * 1000) / 10 : null;
});
function monthAtt(offset) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - offset, 1);
  const key = d.toISOString().slice(0, 7);
  const evs = D.att.filter((e) => String(e.date || "").startsWith(key));
  const size = active().length || 1;
  if (!evs.length) return { key, pct: null, label: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() };
  const got = evs.reduce((s, e) => s + (Array.isArray(e.attendees) ? e.attendees.length : 0), 0);
  return { key, pct: Math.min(100, Math.round((got / (evs.length * size)) * 100)), label: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() };
}
const go = (panel) => window.showPanel?.(panel);

/* ───────── widgets ───────── */
const WID = {
  sitrep: { t: "📌 SITREP", d: "Latest report from Command", ico: "📌", g: "UNIT", b: () => {
    const f = D.fragos;
    if (!f) return empty("NO SITREP POSTED.");
    return `<div class="d2-sr">${esc(String(f.title || "SITREP").toUpperCase())}</div><p class="d2-p">${esc(f.body || "")}</p><small class="dim">${esc(f.authorName || "")}${f.createdAt ? " · " + ukDay(f.createdAt) : ""}</small>`;
  } },
  kpis: { t: "▦ KEY NUMBERS", d: "BCT waiting, members, online, attendance", ico: "▦", g: "UNIT", b: () => {
    const m = monthAtt(0);
    return `<div class="d2-kpis"><button class="d2-kpi" data-go="panel-register" style="cursor:pointer"><b style="color:#f59e0b">${pending().length}</b><span>WAITING FOR BCT</span></button><div class="d2-kpi"><b>${active().length}</b><span>ACTIVE MEMBERS</span></div><div class="d2-kpi"><b style="color:#22e07a">${onlineNow().length}</b><span>ONLINE IN TERMINAL</span></div><div class="d2-kpi"><b>${m.pct == null ? "—" : m.pct + "%"}</b><span>ATTENDANCE (${m.label})</span></div></div>`;
  } },
  ops: { t: "⚑ NEXT OPS", d: "Upcoming events and sign-ups", ico: "⚑", g: "UNIT", b: () => {
    const t = new Date().toISOString().slice(0, 10);
    const evs = D.events.filter((e) => (e.date || "") >= t).sort((a, z) => `${a.date}${a.startTime}`.localeCompare(`${z.date}${z.startTime}`)).slice(0, 3);
    if (!evs.length) return empty("NO OPS SCHEDULED.");
    return evs.map((e) => {
      const d = new Date(`${e.date}T12:00:00`);
      const n = Array.isArray(e.signups) ? e.signups.length : e.signupCount ?? e.goingCount;
      return `<div class="d2-op"><div class="d"><b>${d.getDate()}</b>${d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div><div><b>${esc(e.title || "Op")}</b><small>${d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()} ${esc(e.startTime || "")}${n != null ? ` · ${n} SIGNED UP` : ""}</small></div></div>`;
    }).join("");
  } },
  todo: { t: "✓ NEEDS YOU", d: "Things waiting for you to act on", ico: "✓", g: "UNIT", b: () => {
    const rows = needsList();
    return rows.length ? rows.map(([txt, panel, am]) => `<div class="d2-todo ${am ? "am" : ""}"><span>${txt}</span><button class="lnk" data-go="${panel}">OPEN</button></div>`).join("") : empty("NOTHING NEEDS YOU RIGHT NOW.");
  } },
  system: { t: "◎ SYSTEM STATUS", d: "Website, database, Cortana, Discord, Cloudinary, Hub — ping and 30-day uptime", ico: "◎", g: "STATUS", acc: "net", accL: "NETWORK STATUS", b: () => {
    const p = D.ping;
    const c = D.cortana;
    const tile = (n, ok, sub) => `<div class="d2-sy ${ok === true ? "ok" : ok === false ? "bad" : "off"}"><b>${n}</b><span>${ok === true ? "● ONLINE" : ok === false ? "✕ DOWN" : "○ NOT RUNNING"}</span><small>${sub}</small></div>`;
    const cortOk = c.online ? true : c.lastHeartbeatISO ? false : null;
    const cortSub = c.online ? `${c.pingMs} MS DISCORD PING` : c.lastHeartbeatISO ? `LAST SEEN ${ukDay(c.lastHeartbeatISO)} ${ukTime(c.lastHeartbeatISO)}` : "NOT STARTED YET";
    const up = uptimeDays(c);
    const pct = (a) => { const v = a.filter((x) => x != null); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(2) + "%" : "—"; };
    return `<div class="d2-sys">${tile("WEBSITE", p.web != null ? true : p.webErr ? false : null, p.web != null ? `${p.web} MS` : "CHECKING…")}${tile("DATABASE", p.db != null ? true : p.dbErr ? false : null, p.db != null ? `${p.db} MS` : "CHECKING…")}${tile("CORTANA v2", cortOk, cortSub)}${tile("DISCORD API", c.online ? c.pingMs < 1000 : null, c.online ? "CHECKED BY CORTANA" : "NEEDS CORTANA")}${tile("CLOUDINARY", p.cdn != null ? true : p.cdnErr ? false : null, p.cdn != null ? `IMAGES · ${p.cdn} MS` : p.cdnErr ? "CAN'T REACH IMAGES" : "CHECKING…")}${tile("505TH HUB", null, "NOT BUILT YET")}</div>
      <div class="d2-lb">UPTIME — LAST 30 DAYS</div>${[["WEBSITE", monDays(D.mon?.web)], ["DATABASE", monDays(D.mon?.db)], ["CORTANA", up], ["505TH HUB", NO_HISTORY]].map(([n, a]) => `<div class="d2-hbar"><span>${n}</span>${ub(a)}<b>${pct(a)}</b></div>`).join("")}<small class="dim">CORTANA CHECKS THE WEBSITE AND DATABASE EVERY MINUTE AND POSTS AN ALERT IN DISCORD IF ONE IS DOWN FOR 3 MINUTES. HUB: NOT BUILT YET.</small>`;
  } },
  cortana: { t: "◈ CORTANA HEALTH", d: "Bot status, ping, memory, queued jobs, errors", ico: "◈", g: "STATUS", acc: "bot", accL: "BOT SERVER", b: () => {
    const c = D.cortana;
    const up = c.startedAtISO ? Math.floor((Date.now() - Date.parse(c.startedAtISO)) / 60000) : 0;
    const hrs = Array.from({ length: 24 }, (_, i) => new Date(Date.now() - (23 - i) * 3600_000).toISOString().slice(0, 13));
    const vals = hrs.map((h) => c.pingByHour?.[h] ?? null);
    const max = Math.max(100, ...vals.filter((v) => v != null));
    const st = c.online ? `<span style="color:#22e07a;letter-spacing:2px;font-size:11px">● ONLINE · UP ${Math.floor(up / 1440)}D ${Math.floor((up % 1440) / 60)}H</span>` : c.lastHeartbeatISO ? `<span style="color:#ff4d4d;letter-spacing:2px;font-size:11px">✕ OFFLINE — LAST SEEN ${ukDay(c.lastHeartbeatISO)} ${ukTime(c.lastHeartbeatISO)}</span>` : `<span style="color:#7d8a99;letter-spacing:2px;font-size:11px">○ NOT STARTED YET</span>`;
    const n = (v, u = "", col = "#22e07a") => `<b style="color:${c.online ? col : "#4b5765"}">${c.online && v != null ? v + u : "—"}</b>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">${st}<button class="b sm" data-go="panel-bot">BOT SERVER ▸</button></div>
      <div class="d2-cort"><div>${n(c.pingMs, "ms")}<span>PING</span></div><div>${n(c.cpuPercent, "%")}<span>CPU</span></div><div>${n(c.memoryMb, "MB", "#fff")}<span>MEMORY</span></div><div>${n(c.jobsQueued, "", c.jobsQueued ? "#f59e0b" : "#22e07a")}<span>JOBS QUEUED</span></div></div>
      <div class="d2-lb">DISCORD PING — LAST 24H</div><div class="d2-ch">${vals.map((v) => `<i class="${v == null ? "off" : ""}" style="height:${v == null ? 3 : Math.max(4, Math.round((v / max) * 100))}%;${v > 300 ? "background:#f59e0b" : ""}" title="${v ?? "—"} ms"></i>`).join("")}</div>
      <small class="dim">${c.errors24h ?? 0} ERRORS (24H)${c.version ? ` · v${esc(c.version)}` : ""}${c.supervised ? " · PM2" : ""}</small>`;
  } },
  staff: { t: "♟ STAFF ONLINE", d: "Staff online now — in the terminal, and where", ico: "♟", g: "STATUS", b: () => {
    const on = onlineNow().filter((p) => STAFF.has(userOf(p.uid).role || p.role));
    if (!on.length) return empty("NO STAFF ONLINE RIGHT NOW.");
    return on.map((p) => { const u = { ...p, ...userOf(p.uid) }; return `<div class="d2-stf">${hexAvatar(u, "sm")}<span><b>${esc(memberName(u))}${p.uid === uid ? ' <small style="display:inline">(YOU)</small>' : ""}</b><small>${ROLE_L[u.role] || ""}</small></span><span class="wh2">TERMINAL<br><i>${esc(panelName(p.panel))}</i></span></div>`; }).join("") + `<small class="dim">${on.length} STAFF IN THE TERMINAL · DISCORD VOICE SHOWS ONCE CORTANA v2 IS RUNNING</small>`;
  } },
  online: { t: "● ONLINE NOW", d: "Everyone online now, with hex pictures", ico: "●", g: "UNIT", b: () => {
    const on = onlineNow();
    return on.length ? `<div class="d2-onl">${on.map((p) => { const u = { ...p, ...userOf(p.uid) }; return `<span class="d2-ou">${hexAvatar(u, "sm")}<small>${esc(u.callsign || u.lastName || "")}</small></span>`; }).join("")}</div><small class="dim" style="display:block;margin-top:10px">IN THE TERMINAL · DISCORD ONLINE SHOWS ONCE CORTANA v2 IS RUNNING</small>` : empty("NOBODY ONLINE.");
  } },
  activity: { t: "☍ RECENT ACTIVITY", d: "Latest changes from the Audit Log", ico: "☍", g: "WORK", acc: "audit", accL: "AUDIT LOG", b: () =>
    D.audit.length ? D.audit.slice(0, 5).map((a) => { const u = userOf(a.uid); return `<div class="d2-act">${hexAvatar(u.id ? u : { callsign: a.by }, "xs")}<span><b>${esc(u.id ? memberName(u) : a.by || "System")}</b> ${esc(String(a.action || "").toLowerCase())}</span><small>${ukTime(a.createdAtISO || a.createdAt)}</small></div>`; }).join("") : empty("NO ACTIVITY YET.") },
  attendance: { t: "▣ ATTENDANCE TREND", d: "Unit attendance % per month", ico: "▣", g: "UNIT", acc: "att", accL: "ATTENDANCE", b: () => {
    const ms = Array.from({ length: 12 }, (_, i) => monthAtt(11 - i));
    const now = ms[11], prev = ms[10];
    const arrow = now.pct != null && prev.pct != null ? (now.pct >= prev.pct ? " ▲" : " ▼") : "";
    return `<div class="d2-ch" style="height:90px">${ms.map((m) => `<i class="${m.pct == null ? "off" : ""}" style="height:${m.pct ?? 3}%" title="${m.label} ${m.pct ?? "—"}%"></i>`).join("")}</div><small class="dim">${ms[0].label} → ${now.label} · THIS MONTH ${now.pct == null ? "—" : now.pct + "%"}${arrow}</small>`;
  } },
  recruit: { t: "▲ RECRUITMENT", d: "New sign-ups and where they came from", ico: "▲", g: "UNIT", acc: "rstat", accL: "RECRUIT STATS", b: () => {
    const key = new Date().toISOString().slice(0, 7);
    const month = D.users.filter((u) => String(u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : u.createdAt || u.joinedAt || "").startsWith(key)).length;
    const src = {};
    D.users.forEach((u) => u.recruitSource && (src[u.recruitSource] = (src[u.recruitSource] || 0) + 1));
    const tot = Object.values(src).reduce((a, b) => a + b, 0);
    const top = Object.entries(src).sort((a, b) => b[1] - a[1])[0];
    return `<div class="d2-kvr"><span>SIGN-UPS THIS MONTH</span><b>${month}</b></div><div class="d2-kvr"><span>WAITING FOR BCT</span><b style="color:#f59e0b">${pending().length}</b></div><div class="d2-kvr"><span>TOP SOURCE</span><b>${top ? `${esc(top[0])} ${Math.round((top[1] / tot) * 100)}%` : "—"}</b></div>`;
  } },
  tasks: { t: "☷ MY TASKS", d: "Your tasks from the Project Tracker", ico: "☷", g: "WORK", acc: "proj", accL: "PROJECTS", b: () => {
    const ts = D.tasks.filter((x) => x.assignee === uid && x.status !== "done");
    return ts.length ? ts.slice(0, 6).map((x) => `<div class="d2-todo ${x.priority === "high" ? "am" : ""}"><span>${esc(x.title)}</span><span class="dim">${x.due ? "DUE " + ukDay(x.due) : "NO DATE"}</span></div>`).join("") : empty("NO OPEN TASKS FOR YOU.");
  } },
  tickets: { t: "🎫 OPEN TICKETS", d: "Tickets waiting for a reply (Cortana v2)", ico: "🎫", g: "WORK", acc: "tk", accL: "TICKETS", b: () => {
    const open = (D.tickets || []).filter((t) => t.status === "open").sort((a, b) => String(a.openedAtISO).localeCompare(String(b.openedAtISO)));
    const wait = open.filter((t) => t.waiting !== "member").length;
    const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} MIN` : m < 1440 ? `${Math.round(m / 60)} H` : `${Math.round(m / 1440)} D`; };
    return (open.length ? open.slice(0, 6).map((t) => `<div class="d2-todo ${t.waiting !== "member" ? "am" : ""}"><span>#${String(t.number).padStart(4, "0")} · ${esc(t.typeEmoji || "")} ${esc(t.openerName || "")}</span><span class="dim">${t.waiting !== "member" ? "NEEDS REPLY" : "WAITING ON MEMBER"} · ${ago(t.lastActivityISO || t.openedAtISO)}</span></div>`).join("") : empty("NO OPEN TICKETS."))
      + `<div class="d2-foot"><small class="dim">${open.length} OPEN · ${wait} NEED A REPLY</small><button class="lnk" data-go="panel-tickets">OPEN TICKETS ▸</button></div>`;
  } },
  strength: { t: "▤ ROSTER STRENGTH", d: "Active members by platoon", ico: "▤", g: "UNIT", acc: "roster", accL: "ROSTER", b: () => {
    const c = {};
    active().forEach((u) => { const p = u.platoon || "Unassigned"; c[p] = (c[p] || 0) + 1; });
    const rows = Object.entries(c).sort((a, b) => platoonOrder(a[0]) - platoonOrder(b[0]));
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.length ? rows.map(([p, n]) => `<div class="d2-pl"><span>${esc(p.toUpperCase())}</span><div class="bar"><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`).join("") + `<div class="d2-foot"><small class="dim">${active().length} ACTIVE IN ${rows.length} PLATOONS</small><button class="lnk" data-go="panel-roster">OPEN ROSTER ▸</button></div>` : empty("NO MEMBERS.");
  } },
  atthealth: { t: "✚ ATTENDANCE HEALTH", d: "Last 90 days — overall %, at risk and never attended", ico: "✚", g: "UNIT", acc: "att", accL: "ATTENDANCE", b: () => {
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const evs = D.att.filter((e) => (e.date || "") >= since);
    if (!evs.length) return empty("NO OPS IN THE LAST 90 DAYS.");
    const mem = active().map((u) => {
      const joined = String(u.joinedAt || u.approvedAt || "").slice(0, 10);
      const elig = evs.filter((e) => !joined || e.date >= joined);
      const went = elig.filter((e) => (e.attendees || []).includes(u.id)).length;
      return { u, elig: elig.length, went, pct: elig.length ? Math.round((went / elig.length) * 100) : null };
    }).filter((m) => m.elig);
    const all = mem.reduce((s, m) => s + m.went, 0), tot = mem.reduce((s, m) => s + m.elig, 0);
    const overall = tot ? Math.round((all / tot) * 100) : 0;
    const below = mem.filter((m) => m.pct < 50), never = mem.filter((m) => m.went === 0), perfect = mem.filter((m) => m.pct === 100);
    return `<div class="d2-kpis"><div class="d2-kpi"><b style="color:${rateColor(overall)}">${overall}%</b><span>OVERALL (90D)</span></div><div class="d2-kpi"><b>${evs.length}</b><span>OPS (90D)</span></div><div class="d2-kpi"><b style="color:#ff4d4d">${below.length}</b><span>BELOW 50%</span></div><div class="d2-kpi"><b style="color:#22e07a">${perfect.length}</b><span>PERFECT</span></div></div>
      ${never.length ? `<div class="d2-lb" style="color:#ff4d4d">⚠ NEVER ATTENDED (${never.length})</div>${never.slice(0, 4).map((m) => `<button class="d2-row" data-go="panel-attendance">${hexAvatar(m.u, "xs")}<b>${esc(memberName(m.u))}</b><small>0 / ${m.elig}</small></button>`).join("")}` : ""}
      <div class="d2-foot"><span></span><button class="lnk" data-go="panel-attendance">OPEN ATTENDANCE ▸</button></div>`;
  } },
  bct: { t: "✚ BCT APPROVALS", d: "Recruits waiting for BCT approval, and how long", ico: "✚", g: "WORK", acc: "bct", accL: "BCT APPROVALS", b: () => {
    const p = pending().sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0));
    const days = (u) => { const d = toDate(u.createdAt); return d && !isNaN(d) ? Math.floor((Date.now() - d) / 864e5) : null; };
    return (p.length ? p.slice(0, 6).map((u) => { const n = days(u); return `<button class="d2-row" data-go="panel-register">${hexAvatar(u, "xs")}<b>${esc(memberName(u) || u.discordUsername || "Recruit")}</b><span class="d2-tag" style="--c:${n > 7 ? "#ff4d4d" : n > 2 ? "#f59e0b" : "#22e07a"}">${n == null ? "WAITING" : n === 0 ? "TODAY" : n + "D WAITING"}</span></button>`; }).join("") : empty("NOBODY WAITING FOR BCT.")) +
      `<div class="d2-foot"><small class="dim">${p.length} WAITING</small><button class="lnk" data-go="panel-register">OPEN BCT APPROVALS ▸</button></div>`;
  } },
  auditlog: { t: "☍ AUDIT LOG", d: "Live audit log — who did what, by section", ico: "☍", g: "WORK", acc: "audit", accL: "AUDIT LOG", b: () =>
    (D.audit.length ? D.audit.slice(0, 10).map((a) => { const u = userOf(a.uid); return `<button class="d2-row" data-go="panel-auditv2">${hexAvatar(u.id ? u : { callsign: a.by }, "xs")}<span><b>${esc(u.id ? memberName(u) : a.by || "System")}</b> <small>${esc(String(a.action || ""))}${a.details ? " — " + esc(String(a.details).slice(0, 60)) : ""}</small></span><span style="text-align:right"><span class="d2-tag">${esc(String(a.section || "").toUpperCase())}</span><br><small>${ukDay(a.createdAtISO || a.createdAt)} ${ukTime(a.createdAtISO || a.createdAt)}</small></span></button>`; }).join("") : empty("NO ENTRIES YET.")) +
    `<div class="d2-foot"><span></span><button class="lnk" data-go="panel-auditv2">OPEN AUDIT LOG ▸</button></div>` },
  notes: { t: "✎ NOTES", d: "Latest shared notes — click to open", ico: "✎", g: "WORK", acc: "notes", accL: "NOTES", b: () =>
    (D.notes.length ? D.notes.slice(0, 6).map((n) => `<button class="d2-row" data-note="${n.id}"><span>✎</span><span><b>${esc(n.title || "Untitled")}</b><br><small>${esc(String(n.body || "").split("\n")[0].slice(0, 70))}</small></span><small>${ukDay(n.updatedAtISO)}<br>${esc(n.updatedByName || "")}</small></button>`).join("") : empty("NO NOTES YET.")) +
    `<div class="d2-foot"><small class="dim">${D.notes.length} NOTES</small><button class="lnk" data-go="panel-notes">OPEN NOTES ▸</button></div>` },
  projects: { t: "☷ PROJECT TRACKER", d: "All open projects by column — click to open", ico: "☷", g: "WORK", acc: "proj", accL: "PROJECTS", b: () => {
    const cols = [["todo", "TO DO"], ["doing", "IN PROGRESS"], ["review", "REVIEW"], ["done", "DONE"]];
    const open = D.tasks.filter((x) => x.status !== "done").sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, med: 1, low: 2 }[b.priority] ?? 1) || String(a.due || "9").localeCompare(String(b.due || "9")));
    const t = new Date().toISOString().slice(0, 10);
    const pc = { high: "#ff4d4d", med: "#f59e0b", low: "#7d8a99" };
    return `<div class="d2-kan">${cols.map(([k, l]) => `<div><b>${D.tasks.filter((x) => (x.status || "todo") === k).length}</b><span>${l}</span></div>`).join("")}</div>` +
      (open.length ? open.slice(0, 7).map((x) => `<button class="d2-row" data-task="${x.id}"><span class="d2-tag" style="--c:${pc[x.priority] || pc.med}">${String(x.priority || "med").toUpperCase()}</span><span><b>${esc(x.title)}</b><br><small>${esc(x.assigneeName || "UNASSIGNED")} · ${esc(({ todo: "TO DO", doing: "IN PROGRESS", review: "REVIEW" })[x.status || "todo"] || "")}</small></span><small style="${x.due && x.due < t ? "color:#ff4d4d" : ""}">${x.due ? (x.due < t ? "LATE " : "DUE ") + ukDay(x.due) : ""}</small></button>`).join("") : empty("NO OPEN PROJECTS.")) +
      `<div class="d2-foot"><small class="dim">${open.length} OPEN</small><button class="lnk" data-go="panel-projects">OPEN TRACKER ▸</button></div>`;
  } },
};
const DEF = ["sitrep", "kpis", "system", "cortana", "staff", "ops", "todo", "activity"];
const DEF_WIDE = ["sitrep", "kpis", "system"];
const allowed = (k) => !!WID[k] && (!WID[k].acc || acc[WID[k].acc]);

function needsList() {
  const out = [];
  const p = pending().length;
  if (acc.bct && p) out.push([`${p} recruit${p === 1 ? "" : "s"} waiting for BCT approval`, "panel-register", 1]);
  const t = new Date().toISOString().slice(0, 10);
  if (acc.att) D.att.filter((e) => !e.locked && (e.date || "") <= t && (e.date || "") >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).forEach((e) => out.push([`${esc(e.title || "Op")} attendance not locked yet`, "panel-attendance", 0]));
  if (acc.proj) D.tasks.filter((x) => x.assignee === uid && x.status !== "done" && x.due && x.due <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).forEach((x) => out.push([`Task "${esc(x.title)}" ${x.due < t ? "is late" : "due " + ukDay(x.due)}`, "panel-projects", x.due < t ? 1 : 0]));
  return out;
}

/* ───────── layout ───────── */
async function save() {
  try {
    await updateDoc(doc(db, "users", uid), { dashLayout: { order: L, wide: [...WIDE] } });
  } catch {
    notify("COULD NOT SAVE YOUR LAYOUT", true);
  }
}
function drawW() {
  const g = document.getElementById("d2Grid");
  const shown = L.filter(allowed);
  g.innerHTML = shown.map((k) => {
    const w = WID[k];
    let body = "";
    try { body = w.b(); } catch (e) { body = empty("NOT AVAILABLE."); }
    return `<section class="d2-w ${WIDE.has(k) ? "wide" : ""}" draggable="${editing}" data-k="${k}" aria-label="${esc(w.t.replace(/^\S+\s/, ""))}"><div class="d2-wh"><span>${w.t}</span><span class="d2-wt"><button class="hd" title="Drag to move" aria-label="Move">⠿</button><button data-a="wide" title="Wide / narrow" aria-label="Wide or narrow">⇔</button><button class="rm" data-a="rm" title="Remove" aria-label="Remove">✕</button></span></div>${body}</section>`;
  }).join("") || `<div class="d2-w wide"><p class="dim">EMPTY — CLICK ✎ CUSTOMISE → + ADD WIDGET</p></div>`;
  g.classList.toggle("d2-editing", editing);
}
function cust(on) {
  editing = on;
  document.getElementById("d2Cust").classList.toggle("on", on);
  document.getElementById("d2CustBtn").style.display = on ? "none" : "";
  if (!on) drawer(false);
  drawW();
}
function drawer(on) {
  document.getElementById("d2Drawer").hidden = !on;
  if (on) drawCat();
}
function drawCat() {
  document.getElementById("d2Cat").innerHTML = ["STATUS", "UNIT", "WORK"].map((grp) => {
    const ks = Object.keys(WID).filter((k) => WID[k].g === grp && allowed(k));
    if (!ks.length) return "";
    return `<div class="d2-ch2">${grp}</div>` + ks.map((k) => {
      const w = WID[k], on = L.includes(k);
      return `<div class="d2-ci ${on ? "on" : ""}"><span class="ico">${w.ico}</span><span><b>${w.t.replace(/^\S+\s/, "")}</b><small>${w.d}</small>${w.accL ? `<div class="lock">NEEDS: ${w.accL}</div>` : ""}</span>${on ? '<span class="dim">ADDED</span>' : `<button class="b sm gold" data-add="${k}">+ ADD</button>`}</div>`;
    }).join("");
  }).join("");
}

/* ───────── data ───────── */
async function timed(fn) { const t = performance.now(); await fn(); return Math.round(performance.now() - t); }
async function load() {
  const safe = (p, f) => p.then(f).catch(() => {});
  await Promise.all([
    safe(getUsers(), (u) => (D.users = u)),
    safe(getDocs(query(collection(db, "fragos"), orderBy("createdAt", "desc"), limit(5))), (s) => {
      const role = D.me?.role || "";
      D.fragos = s.docs.map((d) => d.data()).find((f) => !(f.visibility === "commander_only" && !["commander", "developer"].includes(role)) && !(f.visibility === "officers_only" && !["commander", "developer", "officer"].includes(role))) || null;
    }),
    safe(getDocs(collection(db, "community_events")), (s) => (D.events = s.docs.map((d) => d.data()))),
    acc.att ? safe(getDocs(collection(db, "attendance_events")), (s) => (D.att = s.docs.map((d) => d.data()))) : null,
    acc.proj ? safe(getDocs(collection(db, "projects")), (s) => (D.tasks = s.docs.map((d) => ({ id: d.id, ...d.data() })))) : null,
    acc.notes ? safe(fetch("/api/terminal/notes", { cache: "no-store" }).then((r) => r.json()), (j) => (D.notes = j.notes || [])) : null,
    acc.audit ? safe(getDocs(query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(12))), (s) => (D.audit = s.docs.map((d) => d.data()))) : null,
    safe(getDocs(collection(db, "presence_sessions")), (s) => (D.pres = s.docs.map((d) => d.data()))),
    safe(getDoc(doc(db, "unit_config", "status")), (s) => (D.status = s.data() || {})),
    safe(cortanaStatus(), (c) => (D.cortana = c)),
    safe(getDoc(doc(db, "bot_status", "monitors")), (s) => (D.mon = s.data() || null)),
    acc.tk ? safe(getDocs(collection(db, "tickets")), (s) => (D.tickets = s.docs.map((d) => { const x = d.data(); return { number: x.number, status: x.status, typeEmoji: x.typeEmoji, openerName: x.openerName, waiting: x.waiting, openedAtISO: x.openedAtISO, lastActivityISO: x.lastActivityISO }; }))) : null,
  ]);
  D.ping.web = await timed(() => fetch("/api/terminal/access", { cache: "no-store" }).then((r) => { if (!r.ok) throw 0; })).catch(() => ((D.ping.webErr = 1), null));
  D.ping.db = await timed(() => getDoc(doc(db, "unit_config", "status"))).catch(() => ((D.ping.dbErr = 1), null));
  // Cloudinary = where gallery / event / Quick Upload images live. Checks its image servers answer.
  D.ping.cdn = await timed(() => fetch("https://res.cloudinary.com/", { mode: "no-cors", cache: "no-store" })).catch(() => ((D.ping.cdnErr = 1), null));
}

/* ───────── welcome bar ───────── */
function hello() {
  const n = new Date();
  const h = Number(n.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  const part = h < 5 || h >= 18 ? "EVENING" : h < 12 ? "MORNING" : "AFTERNOON";
  const name = String(D.me?.callsign || D.me?.firstName || "").toUpperCase();
  document.getElementById("d2Hello").textContent = `GOOD ${part}${name ? ", " + name : ""}`;
  const day = n.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/London" }).toUpperCase().replace(",", "");
  const time = n.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const k = needsList().length;
  document.getElementById("d2Sub").innerHTML = `${esc(day)} · ${time} UK · ${k ? `<span style="color:#f59e0b">${k} THING${k === 1 ? "" : "S"} NEED YOU</span>` : "NOTHING NEEDS YOU"}`;
  const [l, c] = OPS[D.status.opStatus] || ["NOT SET", "#7d8a99"];
  const open = D.status.recruitmentOpen !== false;
  document.getElementById("d2Unit").innerHTML = `<b style="color:${c}">◉ ${l}</b><small style="color:${open ? "#22e07a" : "#ff4d4d"}">${open ? "● RECRUITING" : "○ RECRUITMENT CLOSED"}</small>`;
}

function mount() {
  const panel = document.getElementById("panel-dashboard");
  if (!panel || document.getElementById("dash2")) return;
  const root = document.createElement("div");
  root.id = "dash2";
  root.innerHTML = `
    <div class="d2-welcome"><span id="d2Hex"></span><div><div class="d2-hi" id="d2Hello">WELCOME</div><div class="dim" id="d2Sub"></div></div><div class="d2-unit" id="d2Unit"></div><button class="b" id="d2CustBtn" style="margin-left:14px">✎ CUSTOMISE</button></div>
    <div class="d2-custbar" id="d2Cust"><b>✎ CUSTOMISING YOUR DASHBOARD</b><span class="dim">DRAG ⠿ TO MOVE · ⇔ WIDE / NARROW · ✕ REMOVE · ONLY YOU SEE YOUR LAYOUT</span><span style="flex:1"></span><button class="b" id="d2Reset">↺ RESET TO DEFAULT</button><button class="b" id="d2Add">+ ADD WIDGET</button><button class="b gold" id="d2Done">DONE</button></div>
    <div class="d2-grid" id="d2Grid"></div>
    <p class="d2-hint">Widgets only appear in the list if you have access to them. Your layout is saved to your account, so it follows you to any device.</p>`;
  panel.appendChild(root);
  document.body.insertAdjacentHTML("beforeend", `<aside class="d2-drawer" id="d2Drawer" hidden aria-label="Add widget"><div class="d2-dh"><b>ADD WIDGET</b><button class="b sm" id="d2DrClose" aria-label="Close">✕</button></div><div id="d2Cat"></div></aside>`);

  document.getElementById("d2CustBtn").onclick = () => cust(true);
  document.getElementById("d2Done").onclick = () => { cust(false); save(); notify("✓ DASHBOARD SAVED"); };
  document.getElementById("d2Add").onclick = () => drawer(true);
  document.getElementById("d2DrClose").onclick = () => drawer(false);
  document.getElementById("d2Reset").onclick = () => { L = [...DEF]; WIDE = new Set(DEF_WIDE); drawW(); drawCat(); save(); };
  document.getElementById("d2Cat").onclick = (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    L.unshift(b.dataset.add);
    drawW(); drawCat(); save();
    notify("✓ ADDED");
  };
  const g = document.getElementById("d2Grid");
  g.addEventListener("click", (e) => {
    const nt = e.target.closest("[data-note]"), tk = e.target.closest("[data-task]");
    if (!editing && (nt || tk)) return window.dispatchEvent(new CustomEvent("ws:open", { detail: nt ? { kind: "note", id: nt.dataset.note } : { kind: "task", id: tk.dataset.task } }));
    const go1 = e.target.closest("[data-go]");
    if (go1 && !editing) return go(go1.dataset.go);
    const b = e.target.closest(".d2-wt button[data-a]");
    if (!b) return;
    const k = b.closest(".d2-w").dataset.k;
    if (b.dataset.a === "rm") L = L.filter((x) => x !== k);
    else WIDE.has(k) ? WIDE.delete(k) : WIDE.add(k);
    drawW(); save();
    if (!document.getElementById("d2Drawer").hidden) drawCat();
  });
  let dragK = null;
  g.addEventListener("dragstart", (e) => { const w = e.target.closest(".d2-w"); if (!editing || !w) return; dragK = w.dataset.k; w.classList.add("dragging"); });
  g.addEventListener("dragend", () => g.querySelectorAll(".d2-w").forEach((w) => w.classList.remove("dragging", "over")));
  g.addEventListener("dragover", (e) => { const w = e.target.closest(".d2-w"); if (!editing || !w) return; e.preventDefault(); g.querySelectorAll(".over").forEach((x) => x !== w && x.classList.remove("over")); w.classList.add("over"); });
  g.addEventListener("drop", (e) => {
    const w = e.target.closest(".d2-w");
    if (!w || !dragK) return;
    e.preventDefault();
    const to = L.indexOf(w.dataset.k);
    L = L.filter((k) => k !== dragK);
    L.splice(to, 0, dragK);
    dragK = null;
    drawW(); save();
  });
}

async function refresh() {
  await load();
  hello();
  if (!editing) drawW();
}

onReady(() => {
  onAuthStateChanged(auth, (u) => {
    if (!u || uid) return;
    uid = u.uid;
    onAccess(async (me) => {
      acc = me.access || {};
      D.me = await getMe().catch(() => null);
      const s = D.me?.dashLayout;
      if (s && Array.isArray(s.order)) { L = s.order.filter((k) => WID[k]); WIDE = new Set((s.wide || []).filter((k) => WID[k])); }
      else { L = [...DEF]; WIDE = new Set(DEF_WIDE); }
      mount();
      document.getElementById("d2Hex").innerHTML = hexAvatar(D.me || {}, "lg");
      drawW();
      await refresh();
      setInterval(() => (document.getElementById("panel-dashboard")?.classList.contains("hidden") ? hello() : refresh()), 60000);
    });
  });
});
