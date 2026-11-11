/**
 * SECURITY → Network Status (approved mock 2026-11-10). Access: "net". Cortana control buttons: "bot".
 * LIVE: Cortana's heartbeat (every 10 s, pushed instantly by Ably) + /api/terminal/health every 15 s
 * (database ping + size, instant-updates set-up, incidents). Banner: operational / degraded / outage,
 * also shown in the browser tab title. Every state is written as text, not colour only.
 */
import { collection, doc, onSnapshot } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, db, esc, mountPanel, notify, onReady } from "./_common.js";
import { ago, cortanaJob, ukTime } from "./discord-common.js";

let bs = {}, health = null, webMs = null, webHist = [], incidents = [], acc = {}, root = null, timer = null, unsubs = [], lastAt = 0, busy = "", baseTitle = document.title;
const STALE = 45_000;
const live = () => typeof window.__terminalLive === "function" ? window.__terminalLive() : null;

function state() {
  const online = bs.lastHeartbeatISO && bs.online !== false && Date.now() - Date.parse(bs.lastHeartbeatISO) < STALE;
  const dbOk = health?.db?.ok !== false;
  const items = [];
  if (!online) items.push(["down", "Cortana offline"]);
  if (health && !dbOk) items.push(["down", "Database unreachable"]);
  if (webMs == null && health === null && lastAt) items.push(["down", "Website not answering"]);
  if (online && bs.pingMs > 250) items.push(["slow", `Discord ping ${bs.pingMs} ms`]);
  if (health?.db?.ms > 500) items.push(["slow", `Database slow (${health.db.ms} ms)`]);
  if (webMs > 1500) items.push(["slow", `Website slow (${webMs} ms)`]);
  if (online && bs.missingPerms?.length) items.push(["slow", `Cortana missing: ${bs.missingPerms.join(", ")}`]);
  if (online && bs.jobsQueued > 10) items.push(["slow", `${bs.jobsQueued} Cortana jobs waiting`]);
  const level = items.some(([l]) => l === "down") ? "down" : items.length ? "slow" : "ok";
  return { online, level, items };
}
/** Bar chart. Always N slots (empty ones faint) so one reading is one thin bar, not a full block.
 *  Amber only when a reading is actually slow (over `slow` ms), not just the highest so far. */
const spark = (vals, max, slow = Infinity, n = 30) => {
  const v = vals.slice(-n);
  const pad = Array(Math.max(0, n - v.length)).fill(null);
  return `<div class="nt-spark" aria-hidden="true">${[...pad, ...v].map((x) => (x == null ? '<i class="e"></i>' : `<i style="height:${Math.max(4, Math.min(100, (x / (max || 1)) * 100))}%;${x > slow ? "background:#f59e0b" : ""}"></i>`)).join("")}</div>`;
};
const row = (k, v, cls = "") => `<div class="nt-row"><span>${k}</span><span class="${cls}">${v}</span></div>`;
const upFor = (iso) => { if (!iso) return "—"; const m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h ${m % 60} m`; };

function draw() {
  if (!acc.net) { root.innerHTML = '<div class="panel-title">NETWORK STATUS</div><div class="empty">You don\'t have Network Status access.</div>'; return; }
  const s = state();
  const L = { ok: ["● ALL SYSTEMS OPERATIONAL", "#22e07a"], slow: ["▲ DEGRADED", "#f59e0b"], down: ["✕ OUTAGE", "#ff4d4d"] }[s.level];
  // Tab title warning only while this page is open, and only once Cortana's status has loaded.
  const shown = !document.getElementById("panel-network")?.classList.contains("hidden");
  document.title = !shown || !bs.lastHeartbeatISO || s.level === "ok" ? baseTitle : `${s.level === "down" ? "⚠ OUTAGE" : "▲ DEGRADED"} · ${baseTitle}`;
  const hours = Array.from({ length: 24 }, (_, i) => new Date(Date.now() - (23 - i) * 3600_000).toISOString().slice(0, 13)).map((h) => bs.pingByHour?.[h] ?? 0);
  const days = Object.values(bs.uptimeMinutes || {});
  const uptime30 = days.length ? Math.min(100, (days.reduce((a, b) => a + b, 0) / (days.length * 1440)) * 100).toFixed(2) : null;
  const lv = live();
  const ok = (b, y, n) => (b ? `<span style="color:#22e07a">● ${y}</span>` : `<span style="color:#ff4d4d">✕ ${n}</span>`);
  root.innerHTML = `<div class="panel-title">NETWORK STATUS</div><div class="nt-sub">LIVE HEALTH OF THE WEBSITE, CORTANA, DATABASE, DISCORD + INSTANT UPDATES · UPDATES BY ITSELF</div>
  <div class="nt-banner" style="border-color:${L[1]}66" role="status" aria-live="polite"><div><b style="color:${L[1]}">${L[0]}</b>
    ${s.items.length ? `<ul>${s.items.map(([l, t]) => `<li style="color:${l === "down" ? "#ff4d4d" : "#f59e0b"}">${l === "down" ? "✕" : "▲"} ${esc(t)}</li>`).join("")}</ul>` : ""}
    <small>LAST CHECK ${lastAt ? Math.round((Date.now() - lastAt) / 1000) + " S AGO" : "…"} · CORTANA HEARTBEAT ${bs.lastHeartbeatISO ? Math.round((Date.now() - Date.parse(bs.lastHeartbeatISO)) / 1000) + " S AGO" : "NEVER"}</small></div>
    <button class="b" data-x="check">⟳ CHECK NOW</button></div>
  <div class="nt-4">
    <div class="nt-card"><b>🌐 WEBSITE</b><div class="nt-st">${ok(webMs != null, "ONLINE", "NOT ANSWERING")}</div>${row("RESPONSE", webMs != null ? webMs + " ms" : "—")}${row("CHECKED", "every 15 s")}${spark(webHist, Math.max(1500, ...webHist), 1500)}<small class="nt-n">AMBER = SLOWER THAN 1.5 S · THE FIRST CHECK AFTER A QUIET SPELL IS SLOWER (SERVER WAKING UP)</small></div>
    <div class="nt-card"><b><i class="nt-logo"></i> CORTANA</b><div class="nt-st">${ok(s.online, "ONLINE · v" + esc(bs.version || "2"), "OFFLINE")}</div>
      ${row("DISCORD PING", s.online ? (bs.pingMs ?? "—") + " ms" : "—", bs.pingMs > 250 ? "wr" : "")}${row("UP FOR", s.online ? upFor(bs.startedAtISO) : "—")}${row("CPU · RAM", s.online ? `${bs.cpuPercent ?? "—"}% · ${bs.memoryMb ?? "—"} MB` : "—")}
      ${row("JOBS QUEUED", bs.jobsQueued ?? 0, bs.jobsQueued > 10 ? "wr" : "")}${row("ERRORS (24 H)", bs.errors24h ?? 0, bs.errors24h ? "wr" : "")}${row("UPTIME (30 D)", uptime30 ? uptime30 + "%" : "—")}${row("RUNS UNDER", bs.supervised ? "PM2 (auto-restart)" : "dev / manual")}</div>
    <div class="nt-card"><b>🗄 DATABASE</b><div class="nt-st">${health ? ok(health.db?.ok, "CONNECTED", "UNREACHABLE") : "…"}</div>${row("MONGODB ATLAS", health?.db?.ms != null ? health.db.ms + " ms" : "—", health?.db?.ms > 500 ? "wr" : "")}${row("DATA", health?.db?.dataMb != null ? health.db.dataMb + " MB" : "—")}${row("ON DISK (WITH INDEXES)", health?.db?.storageMb != null ? health.db.storageMb + " MB" : "—")}
      ${health?.db?.storageMb != null ? `<div class="nt-bar" title="of 512 MB (free tier)"><div style="width:${Math.min(100, (health.db.storageMb / 512) * 100)}%"></div></div><small class="nt-n">${Math.round((health.db.storageMb / 512) * 100)}% OF 512 MB (FREE TIER)</small>` : ""}</div>
    <div class="nt-card"><b>⚡ INSTANT UPDATES</b><div class="nt-st">${health ? (health.ably?.configured ? (lv === true ? '<span style="color:#22e07a">● LIVE (ABLY)</span>' : lv === false ? '<span style="color:#f59e0b">▲ RECONNECTING</span>' : '<span style="color:#22e07a">● SET UP</span>') : '<span style="color:#f59e0b">▲ NOT SET UP</span>') : "…"}</div>
      ${row("THIS PAGE", lv === true ? "connected" : lv === false ? "polling (fallback)" : "—")}${row("FALLBACK", "polling every 2.5–15 s")}${row("KEY", health?.ably?.configured ? "in .env.local ✓" : "missing (ABLY_API_KEY)", health?.ably?.configured ? "" : "wr")}</div></div>
  <div class="nt-2"><div class="nt-card"><b>DISCORD</b>
      ${row("SERVER", s.online ? `${esc(bs.guildName || "—")} · ${bs.memberCount ?? "—"} members` : "—")}
      ${row("CORTANA PERMISSIONS", !s.online ? "—" : bs.missingPerms?.length ? `▲ missing: ${esc(bs.missingPerms.join(", "))}` : "✓ all granted", bs.missingPerms?.length ? "wr" : "ok")}
      ${row("INTENTS", !s.online ? "—" : `${bs.intents?.members ? "✓" : "✕"} Members · ${bs.intents?.messageContent ? "✓" : "✕"} Message Content`, bs.intents && (!bs.intents.members || !bs.intents.messageContent) ? "wr" : "")}
      ${row("HEARTBEAT", `every ${bs.heartbeatSec || 10} s`)}</div>
    <div class="nt-card"><b>CORTANA CONTROL</b><p class="nt-n" style="margin:6px 0 10px">COMMANDER / DEVELOPER ONLY · EVERY ACTION GOES TO THE AUDIT LOG</p>
      ${acc.bot ? `<div class="nt-btns"><button class="b" data-x="restart" style="border-color:#f59e0b;color:#f59e0b" ${busy || !s.online ? "disabled" : ""}>${busy === "restart" ? "RESTARTING…" : "↻ RESTART CORTANA"}</button><button class="b" data-x="sync" ${busy || !s.online ? "disabled" : ""}>${busy === "sync" ? "SYNCING…" : "⟳ RE-SYNC CHANNELS + ROLES"}</button><button class="b" data-x="cmds" ${busy || !s.online ? "disabled" : ""}>${busy === "cmds" ? "WORKING…" : "⌘ RE-REGISTER COMMANDS"}</button></div>
      <p class="nt-n" style="margin-top:10px">${bs.supervised ? "RESTART: CORTANA SAVES ITS WORK, STOPS, PM2 STARTS IT AGAIN (~10 S). THE WEBSITE KEEPS WORKING." : "▲ CORTANA ISN'T RUNNING UNDER PM2 — A RESTART WOULD STOP IT. START IT AGAIN BY HAND (npm run dev:all)."}</p>` : '<p class="nt-n">You can see the status. Only Developers / Command can control Cortana.</p>'}</div></div>
  <div class="nt-2"><div class="nt-card"><b>DISCORD PING · LAST 24 H</b>${spark(hours, Math.max(250, ...hours), 400, 24)}<div class="nt-n" style="display:flex;justify-content:space-between"><span>24 H AGO</span><span>HIGHEST ${Math.max(0, ...hours)} MS</span><span>NOW</span></div></div>
    <div class="nt-card" style="padding:0"><div style="padding:12px 14px"><b>INCIDENTS</b></div><table class="nt-tb"><thead><tr><th>WHEN</th><th>WHAT</th><th>HOW LONG</th></tr></thead><tbody>
      ${incidents.slice(0, 12).map((x) => { const end = x.endedAtISO ? Date.parse(x.endedAtISO) : Date.now(), m = Math.max(0, Math.round((end - Date.parse(x.startedAtISO)) / 60000)); return `<tr><td>${esc(ukTime(x.startedAtISO))}</td><td><span class="pill ${x.level === "down" ? "er" : "wr"}">${x.level === "down" ? "DOWN" : "SLOW"}</span> ${esc(x.what)}</td><td>${x.endedAtISO ? (m < 1 ? "under 1 min" : m < 60 ? m + " min" : Math.round(m / 60) + " h") : '<b style="color:#ff4d4d">ONGOING · ' + (m < 1 ? "<1" : m) + " min</b>"}</td></tr>`; }).join("") || '<tr><td colspan="3" class="empty">No incidents. 👍</td></tr>'}</tbody></table></div></div>`;
}

async function check() {
  const t = performance.now();
  try {
    const r = await fetch("/api/terminal/health", { cache: "no-store", credentials: "same-origin" });
    webMs = Math.round(performance.now() - t);
    health = r.ok ? await r.json() : { db: { ok: true } };
  } catch {
    webMs = null;
    health = null;
  }
  webHist = [...webHist, webMs ?? 0].slice(-24);
  lastAt = Date.now();
  if (root?.closest(".panel") && !root.closest(".panel").classList.contains("hidden")) draw();
}

async function control(x) {
  const map = { restart: ["bot.restart", "RESTART CORTANA?", "Cortana stops for about 10 seconds, then PM2 starts it again. Discord buttons pause for that time.", "↻ RESTARTING — BACK IN ~10 S"], sync: ["sync.now", null, null, "✓ CHANNELS + ROLES RE-SYNCED"], cmds: ["commands.register", null, null, "✓ SLASH COMMANDS RE-REGISTERED"] };
  const [type, title, body, ok] = map[x];
  if (title && !(await ask({ kind: "warn", title, body, go: "RESTART", cancel: "CANCEL" }))) return;
  busy = x; draw();
  try {
    const r = await cortanaJob(type, {});
    if (x === "restart") await audit("security", "CORTANA RESTART", "from Network Status");
    notify(r ? ok : "◷ CORTANA DIDN'T ANSWER", !r);
  } catch (e) { notify("FAILED: " + e.message, 1); }
  busy = ""; draw();
}

function start() {
  if (!unsubs.length) {
    unsubs.push(onSnapshot(doc(db, "bot_status", "cortana"), (s) => { bs = s.exists() ? s.data() : {}; draw(); }, () => {}));
    unsubs.push(onSnapshot(collection(db, "net_incidents"), (s) => { incidents = s.docs.map((d) => d.data()).sort((a, b) => String(b.startedAtISO).localeCompare(String(a.startedAtISO))); draw(); }, () => {}));
  }
  check();
  clearInterval(timer);
  timer = setInterval(() => { check(); }, 15_000);
  draw();
}

const CSS = `
#netV2 .nt-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#netV2 .nt-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;background:rgba(0,0,0,.25);border:1px solid;padding:14px 16px;margin-bottom:16px}
#netV2 .nt-banner b{font:700 16px monospace;letter-spacing:2px}#netV2 .nt-banner ul{margin:6px 0 0;padding:0;list-style:none;font:12px monospace}#netV2 .nt-banner small{display:block;color:#6f8a96;font:10px monospace;letter-spacing:1px;margin-top:6px}
#netV2 .nt-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}#netV2 .nt-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
#netV2 .nt-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}#netV2 .nt-card>b{font:700 12px monospace;letter-spacing:2px;display:flex;align-items:center;gap:6px}
#netV2 .nt-logo{display:inline-block;width:16px;height:16px;background:url(/images/logo.png) center/contain no-repeat}
#netV2 .nt-st{font:700 12px monospace;margin:6px 0 4px}
#netV2 .nt-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(0,217,255,.07);font-size:13px}#netV2 .nt-row span:first-child{color:#6f8a96;font:11px monospace;letter-spacing:1px}#netV2 .nt-row .wr{color:#f59e0b}#netV2 .nt-row .ok{color:#22e07a}
#netV2 .nt-spark{display:flex;align-items:flex-end;gap:2px;height:44px;margin-top:10px}#netV2 .nt-spark i{flex:1;background:rgba(0,217,255,.55)}#netV2 .nt-spark i.e{height:4%;background:rgba(0,217,255,.08)}
#netV2 .nt-2 .nt-spark{height:90px}
#netV2 .nt-bar{height:6px;background:#0c1a22;margin-top:8px}#netV2 .nt-bar div{height:100%;background:#00D9FF}
#netV2 .nt-n{color:#6f8a96;font:10px monospace;letter-spacing:1px}
#netV2 .nt-btns{display:flex;gap:8px;flex-wrap:wrap}
#netV2 .nt-tb{width:100%;border-collapse:collapse;font-size:13px}#netV2 .nt-tb th{text-align:left;font:10px monospace;letter-spacing:1.5px;color:#6f8a96;padding:8px 14px;border-bottom:1px solid rgba(0,217,255,.18)}#netV2 .nt-tb td{padding:8px 14px;border-bottom:1px solid rgba(0,217,255,.07)}
#netV2 .pill{font:10px monospace;letter-spacing:1px;padding:2px 6px;border:1px solid}#netV2 .pill.er{color:#ff4d4d;border-color:rgba(255,77,77,.4)}#netV2 .pill.wr{color:#f59e0b;border-color:rgba(245,158,11,.4)}
@media(max-width:1200px){#netV2 .nt-4{grid-template-columns:1fr 1fr}}@media(max-width:800px){#netV2 .nt-4,#netV2 .nt-2{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("net-v2", CSS);
  onAccess((me) => { acc = me?.access || {}; if (root) draw(); });
  root = mountPanel("panel-network", "netV2", start);
  // Leaving the page puts the normal tab title back.
  const pn = document.getElementById("panel-network");
  if (pn) new MutationObserver(() => { if (pn.classList.contains("hidden")) document.title = baseTitle; }).observe(pn, { attributes: true, attributeFilter: ["class"] });
  if (root) {
    root.addEventListener("click", (e) => { const b = e.target.closest("[data-x]"); if (!b) return; if (b.dataset.x === "check") return check(); control(b.dataset.x); });
    setInterval(() => { if (root.closest(".panel") && !root.closest(".panel").classList.contains("hidden")) draw(); }, 5000); // keep "x s ago" + offline detection fresh
  }
});
