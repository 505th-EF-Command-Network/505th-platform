/**
 * SECURITY → NETWORK STATUS v2 (approved mock 2026-11-12) — Uptime-Kuma style. Access: "net"; change monitors: Developer + Commander;
 * Cortana buttons (restart / re-sync / re-register commands): "bot".
 * Data: /api/terminal/network (lib/net/core.ts), written by Cortana every 60 s. LIVE: net_status changes arrive through the 505th Net
 * ("terminal-live" event from the shim) → the page reloads within a second. If the live line is down it checks every 30 s and says ● POLLING.
 */
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, esc, mountPanel, notify, onReady } from "./_common.js";
import { cortanaJob } from "./discord-common.js";
import { mountControl } from "./cortana-control.js";

const API = "/api/terminal/network";
const COL = { 0: "#22e07a", 1: "#f59e0b", 2: "#ff4d4d" };
const ST = { up: ["UP", "#22e07a"], slow: ["SLOW", "#f59e0b"], down: ["DOWN", "#ff4d4d"], paused: ["PAUSED", "#7d8a99"], stale: ["NO DATA", "#7d8a99"], pending: ["WAITING", "#7d8a99"] };
let D = null, det = null, sel = null, range = "24H", q = "", root = null, acc = {}, unsub = null, poll = null, lastLoad = 0, tick = null;
const live = () => (typeof window.__terminalLive === "function" ? window.__terminalLive() : null);
const hm = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");
const dur = (a, b) => { const m = Math.max(1, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`; };
async function call(method, body, qs = "") {
  const r = await fetch(API + qs, { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
  return b;
}
async function load() {
  D = await call("GET"); lastLoad = Date.now();
  if (!sel || !D.monitors.some((m) => m.id === sel)) sel = D.monitors[0]?.id || null;
  if (sel) det = await call("GET", null, `?mon=${encodeURIComponent(sel)}&range=${range}`).catch(() => det);
  draw();
}
const pill = (m) => { const [l, c] = m.status === "down" ? ["DOWN", "#ff4d4d"] : m.status === "paused" ? ["PAUSED", "#4b5765"] : m.status === "stale" ? ["NO DATA", "#4b5765"] : [m.up30 != null ? `${m.up30}%` : "—", m.status === "slow" ? "#f59e0b" : "#22e07a"];
  return `<span class="pc" style="background:${c};color:${c === "#4b5765" ? "#fff" : "#000"}">${l}</span>`; };
const mini = (last, n = 14) => { const v = last.slice(-n), pad = Array(Math.max(0, n - v.length)).fill(null);
  return `<span class="mini">${[...pad, ...v].map((b) => `<i style="background:${b ? COL[b[2]] : "#1d2630"}"></i>`).join("")}</span>`; };

function chart(pts) {
  if (!pts?.length) return '<div class="dim" style="padding:60px;text-align:center">NO CHECKS IN THIS RANGE YET</div>';
  const W = 900, H = 210, P = 34;
  const v = pts.map((p) => p[1]).filter((x) => x >= 0), max = Math.max(100, ...v) * 1.15;
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1, x = (t) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 8), y = (ms) => H - 20 - (ms / max) * (H - 32);
  let d = "", prev = null;
  for (const p of pts) { if (p[1] < 0) { prev = null; continue; } d += (prev ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); prev = p; }
  const area = d ? `${d}L${x(pts[pts.length - 1][0]).toFixed(1)},${H - 20}L${x(pts.find((p) => p[1] >= 0)?.[0] ?? t0).toFixed(1)},${H - 20}Z` : "";
  const down = pts.filter((p) => p[2] === 2).map((p) => `<rect x="${x(p[0]) - 2}" y="8" width="4" height="${H - 28}" fill="#ff4d4d33"/>`).join("");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const ms = Math.round(max * f); return `<line x1="${P}" x2="${W}" y1="${y(ms)}" y2="${y(ms)}" stroke="#00d9ff14"/><text x="${P - 4}" y="${y(ms) + 3}" fill="#4b5765" font-size="9" text-anchor="end">${ms}</text>`; }).join("");
  const lbl = (t) => (t1 - t0 > 2880 ? new Date(t * 60000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : hm(t * 60000));
  const xl = [0, 0.25, 0.5, 0.75, 1].map((f) => { const t = t0 + (t1 - t0) * f; return `<text x="${x(t)}" y="${H - 4}" fill="#4b5765" font-size="9" text-anchor="middle">${lbl(t)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label="Response time chart">${grid}${down}<path d="${area}" fill="#22e07a14"/><path d="${d}" fill="none" stroke="#22e07a" stroke-width="1.6" vector-effect="non-scaling-stroke"/>${xl}</svg>`;
}

function draw() {
  if (!root) return;
  if (!D) { root.innerHTML = '<div class="empty">LOADING…</div>'; return; }
  const ms = D.monitors, m = ms.find((x) => x.id === sel), L = live();
  const c = (s) => ms.filter((x) => x.status === s).length;
  const up30 = ms.filter((x) => x.up30 != null && !x.paused), all = up30.length ? (up30.reduce((a, x) => a + x.up30, 0) / up30.length).toFixed(2) + "%" : "—";
  const ago = Math.round((Date.now() - lastLoad) / 1000);
  let g = "";
  const list = ms.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).map((x) => { const h = x.group !== g ? `<div class="grp">${esc((g = x.group))}</div>` : "";
    return h + `<button class="mon ${x.id === sel ? "on" : ""}" data-m="${x.id}" aria-current="${x.id === sel}">${pill(x)}<span class="nm"><b>${esc(x.name)}</b>${x.third ? '<small class="t3">3RD-PARTY</small>' : ""}${x.muted ? '<small class="mu">🔕</small>' : ""}</span>${mini(x.last)}</button>`; }).join("");
  const [sl, sc] = m ? ST[m.status] || ST.pending : ["", ""];
  const beats = m ? m.last.slice(-60) : [];
  const padB = Array(Math.max(0, 60 - beats.length)).fill(null);
  const inc = det?.incidents || [];
  root.innerHTML = `
  <div class="top"><div><div class="h1" style="border:none;padding:0">◉ NETWORK STATUS</div><div class="sub" style="margin:3px 0 0">EVERY 505TH SERVICE · CHECKED EVERY MINUTE BY CORTANA · 90-DAY HISTORY</div></div><span style="flex:1"></span>
    <span class="lv" style="color:${!D.cortanaChecking ? "#ff4d4d" : L === true ? "#22e07a" : "#f59e0b"}">${!D.cortanaChecking ? "✕ CORTANA ISN'T CHECKING" : L === true ? "● LIVE" : "● POLLING"} · <span id="ntAgo">${ago < 2 ? "updated now" : `updated ${ago}s ago`}</span></span>
    ${D.canEdit ? '<button class="b" data-x="add">＋ ADD MONITOR</button>' : ""}<button class="b" data-x="check">↻ CHECK NOW</button></div>
  <div class="sum"><div><b style="color:#22e07a">${c("up")}</b><span>UP</span></div><div><b style="color:#ff4d4d">${c("down") + c("stale")}</b><span>DOWN / NO DATA</span></div><div><b style="color:#f59e0b">${c("slow")}</b><span>SLOW</span></div><div><b style="color:#00D9FF">${all}</b><span>UPTIME · 30 DAYS · ALL</span></div></div>
  <div class="lay"><div class="list"><div class="lh"><input class="fld" id="ntQ" placeholder="🔍 Search monitors…" aria-label="Search monitors" value="${esc(q)}"></div><div class="ls">${list}</div></div>
  <div class="det">${!m ? '<div class="card dim">PICK A MONITOR</div>' : `
    <div class="card"><div class="dh"><div style="min-width:0"><h2>${esc(m.name)}</h2><div class="dim" style="font-size:12px">${esc(m.target || m.info || m.type.toUpperCase())}${m.info && m.target ? ` · ${esc(m.info)}` : ""}</div>
      <div class="acts">${D.canEdit ? `<button class="b sm" data-x="pause">${m.paused ? "▶ RESUME" : "⏸ PAUSE"}</button><button class="b sm" data-x="edit">✎ EDIT</button><button class="b sm" data-x="mute">${m.muted ? "🔔 ALERTS ON" : "🔕 MUTE ALERTS"}</button>${m.builtin ? "" : '<button class="b sm red" data-x="del">🗑 DELETE</button>'}` : ""}
      ${m.id === "cortana" && acc.bot ? '<button class="b sm" data-c="sync">⇄ RE-SYNC CHANNELS</button><button class="b sm" data-c="cmds">/ RE-REGISTER COMMANDS</button>' : ""}</div></div>
      <span class="tag">${esc(m.type.toUpperCase())}</span></div></div>
    ${m.id === "cortana" ? '<div id="ctlBox"></div>' : ""}
    <div class="card"><div class="beat"><div class="bars">${[...padB, ...beats].map((b) => (b ? `<i style="background:${COL[b[2]]}" title="${hm(b[0] * 60000)} · ${["UP", "SLOW", "DOWN"][b[2]]}${b[1] >= 0 ? ` · ${b[1]} ms` : ""}"></i>` : '<i class="e"></i>')).join("")}</div>
      <span class="state" style="background:${sc};color:${sc === "#7d8a99" ? "#fff" : "#000"}">${sl}</span></div>
      <div class="dim" style="font-size:11px;margin-top:6px">${m.paused ? "Paused — not checked" : `Checked every 60 seconds · last check ${m.checkedAtISO ? hm(Date.parse(m.checkedAtISO)) : "—"}`}${m.status === "down" && m.downSinceISO ? ` · <b style="color:#ff4d4d">down for ${dur(m.downSinceISO)}${m.muted ? " (alerts muted)" : " — alert sent after 3 checks"}</b>` : ""}${m.error && m.status === "down" ? `<br><span style="color:#ffb3b3">${esc(m.error)}</span>` : ""}</div></div>
    <div class="card stats"><div><b>RESPONSE</b><small>(current)</small><u>${m.ms != null ? m.ms + " ms" : "—"}</u></div><div><b>AVG. RESPONSE</b><small>(24-hour)</small><u>${m.avg24 != null ? m.avg24 + " ms" : "—"}</u></div>
      <div><b>UPTIME</b><small>(24-hour)</small><u>${m.up24 != null ? m.up24 + "%" : "—"}</u></div><div><b>UPTIME</b><small>(30-day)</small><u>${m.up30 != null ? m.up30 + "%" : "—"}</u></div>
      <div><b>${m.certValidToISO ? "CERT EXP." : "INCIDENTS"}</b><small>(${m.certValidToISO ? dt(m.certValidToISO).split(",")[0] : "30-day"})</small><u>${m.certValidToISO ? Math.round((Date.parse(m.certValidToISO) - Date.now()) / 864e5) + " days" : inc.filter((i) => Date.now() - Date.parse(i.startedAtISO) < 30 * 864e5).length}</u></div></div>
    <div class="card"><div class="rng" role="radiogroup" aria-label="Chart range">${["1H", "24H", "7D", "30D", "90D"].map((r) => `<button class="${r === range ? "on" : ""}" data-r="${r}" role="radio" aria-checked="${r === range}">${r}</button>`).join("")}</div>
      <div class="chart">${chart(det?.points)}</div></div>
    <div class="card"><div class="ch">INCIDENTS</div>${inc.length ? `<table><thead><tr><th>STARTED</th><th>ENDED</th><th>LENGTH</th><th>ERROR</th><th>NOTE</th></tr></thead><tbody>${inc.map((i) => `<tr><td>${dt(i.startedAtISO)}</td><td>${i.endedAtISO ? dt(i.endedAtISO) : '<b style="color:#ff4d4d">ONGOING</b>'}</td><td>${dur(i.startedAtISO, i.endedAtISO)}</td><td style="color:#ffb3b3">${esc(i.error)}</td><td>${i.note ? esc(i.note) + " " : ""}<button class="lk" data-n="${esc(i.id)}">${i.note ? "✎" : "＋ add note"}</button></td></tr>`).join("")}</tbody></table>` : '<p class="dim" style="margin:6px 0 0">No incidents ✓</p>'}</div>`}
  </div></div>`;
  const cb = root.querySelector("#ctlBox");
  if (cb) mountControl(cb);
}

async function editBox(m) {
  const isNew = !m;
  const type = m?.type || "http";
  const ov = document.createElement("div");
  ov.className = "v2m";
  ov.innerHTML = `<div class="mw" style="width:min(480px,100%)" role="dialog" aria-modal="true" aria-label="${isNew ? "Add monitor" : "Edit monitor"}"><div class="hd"><div><h2>${isNew ? "＋ ADD MONITOR" : "✎ EDIT MONITOR"}</h2></div><button class="b" data-z="x" aria-label="Close">✕</button></div><div class="bd">
    ${isNew ? `<label class="lbl" for="nmT">TYPE</label><select class="fld" id="nmT"><option value="http">Website / API (https://…)</option><option value="game">Arma 3 / Steam game server</option></select>` : ""}
    <label class="lbl" for="nmN">NAME</label><input class="fld" id="nmN" maxlength="50" value="${esc(m?.name || "")}">
    ${isNew || type === "http" || type === "game" ? `<label class="lbl" for="nmA">ADDRESS <small id="nmH">${type === "game" ? "host:queryPort — the game port + 1" : "must start with https://"}</small></label><input class="fld" id="nmA" maxlength="200" value="${esc(m?.target || "")}" placeholder="${type === "game" ? "203.0.113.10:2303" : "https://"}">` : ""}
    <label class="lbl" for="nmS">COUNT AS SLOW OVER (MS)</label><input class="fld" id="nmS" type="number" min="50" max="30000" value="${m?.slowMs ?? 2500}"></div>
    <div class="mf"><span class="hint">Down for 3 checks in a row → Discord + 🔔 alert (unless muted).</span><button class="b" data-z="x">CANCEL</button><button class="b gold" data-z="ok">${isNew ? "ADD" : "SAVE"}</button></div></div>`;
  document.body.appendChild(ov);
  const t = ov.querySelector("#nmT");
  t?.addEventListener("change", () => { ov.querySelector("#nmH").textContent = t.value === "game" ? "host:queryPort — the game port + 1" : "must start with https://"; ov.querySelector("#nmA").placeholder = t.value === "game" ? "203.0.113.10:2303" : "https://"; });
  ov.querySelector("#nmN").focus();
  ov.addEventListener("click", async (e) => {
    const z = e.target.closest("[data-z]")?.dataset.z;
    if (e.target === ov || z === "x") return ov.remove();
    if (z !== "ok") return;
    const body = { name: ov.querySelector("#nmN").value, slowMs: Number(ov.querySelector("#nmS").value), ...(ov.querySelector("#nmA") ? { target: ov.querySelector("#nmA").value } : {}) };
    try { const r = await call("POST", isNew ? { action: "add", type: t.value, ...body } : { action: "edit", id: m.id, ...body }); notify("✓ " + r.msg.toUpperCase()); ov.remove(); if (r.id) sel = r.id; await load(); }
    catch (err) { notify(err.message.toUpperCase(), 1); }
  });
}

const CSS = `
#netV3 .top{display:flex;align-items:flex-end;gap:10px;margin-bottom:12px;flex-wrap:wrap}#netV3 .lv{font-size:10.5px;letter-spacing:2px}
#netV3 .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}#netV3 .sum div{border:1px solid var(--l);background:var(--p);padding:9px 13px}#netV3 .sum b{display:block;font:700 23px Rajdhani,sans-serif}#netV3 .sum span{font-size:9.5px;letter-spacing:2px;color:var(--d)}
#netV3 .lay{display:grid;grid-template-columns:320px 1fr;gap:12px}
#netV3 .list{border:1px solid var(--l);background:var(--p);display:flex;flex-direction:column;max-height:calc(100vh - 250px);min-height:400px}#netV3 .lh{padding:9px;border-bottom:1px solid var(--l)}#netV3 .ls{overflow:auto}
#netV3 .fld{width:100%;background:#070a0f;border:1px solid var(--l2);padding:7px 10px;font:inherit;font-size:12px;color:#d6dde6;outline:0}
#netV3 .grp{font-size:9.5px;letter-spacing:2px;color:var(--dd);padding:10px 12px 3px}
#netV3 .mon{display:flex;align-items:center;gap:9px;width:100%;padding:8px 12px;border:0;border-left:3px solid transparent;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}#netV3 .mon:hover{background:rgba(0,217,255,.04)}#netV3 .mon.on{background:rgba(0,217,255,.08);border-left-color:#00D9FF}
#netV3 .pc{min-width:50px;text-align:center;font-size:10px;font-weight:700;padding:1px 6px;border-radius:9px}
#netV3 .nm{flex:1;min-width:0}#netV3 .nm b{display:block;font-weight:400;color:#fff;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#netV3 .nm small{font-size:9px;letter-spacing:1px;padding:0 5px;border-radius:7px;margin-right:4px}#netV3 .t3{background:#5865f2;color:#fff}
#netV3 .mini{display:flex;gap:2px}#netV3 .mini i{width:4px;height:16px;border-radius:2px}
#netV3 .det{display:flex;flex-direction:column;gap:12px;min-width:0}#netV3 .card{border:1px solid var(--l);background:var(--p);padding:13px 17px}
#netV3 .dh{display:flex;align-items:flex-start;gap:12px}#netV3 .dh h2{margin:0;font:700 23px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}#netV3 .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
#netV3 .tag{margin-left:auto;font-size:9.5px;letter-spacing:1.5px;padding:1px 7px;border:1px solid var(--l);color:var(--d)}
#netV3 .b.sm{padding:4px 10px;font-size:10px}#netV3 .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}
#netV3 .beat{display:flex;align-items:center;gap:16px}#netV3 .bars{display:flex;gap:3px;flex:1;overflow:hidden}#netV3 .bars i{flex:1;min-width:4px;max-width:12px;height:30px;border-radius:3px}#netV3 .bars i.e{background:#1d2630}
#netV3 .bars i:last-child{animation:ntIn .4s ease-out}@keyframes ntIn{from{transform:scaleY(.2);opacity:.3}}@media(prefers-reduced-motion:reduce){#netV3 .bars i:last-child{animation:none}}
#netV3 .state{font:700 21px Rajdhani,sans-serif;letter-spacing:2px;padding:3px 18px;border-radius:20px;white-space:nowrap}
#netV3 .stats{display:grid;grid-template-columns:repeat(5,1fr);text-align:center}#netV3 .stats b{display:block;font:700 14px Rajdhani,sans-serif;letter-spacing:1.5px;color:#fff}#netV3 .stats small{display:block;font-size:10px;color:var(--d)}#netV3 .stats u{display:block;margin-top:5px;font-size:13px;text-decoration:none;color:#00D9FF}
#netV3 .rng{display:flex;gap:5px;justify-content:flex-end;margin-bottom:6px}#netV3 .rng button{border:1px solid var(--l);background:none;padding:2px 9px;font:inherit;font-size:10px;letter-spacing:1px;color:var(--d);cursor:pointer}#netV3 .rng button.on{border-color:#00D9FF;color:#00D9FF}
#netV3 .chart{height:220px}#netV3 .ch{font:700 13px Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}
#netV3 table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}#netV3 th{text-align:left;font-weight:400;font-size:9.5px;letter-spacing:2px;color:var(--d);padding:6px 8px;border-bottom:1px solid var(--l)}#netV3 td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.03)}
#netV3 .lk{background:none;border:none;color:#00D9FF;cursor:pointer;font:inherit;padding:0}#netV3 .dim{color:var(--d)}
@media(max-width:1000px){#netV3 .lay{grid-template-columns:1fr}#netV3 .stats{grid-template-columns:repeat(2,1fr);gap:10px}#netV3 .sum{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  onAccess((me) => { acc = me.access || {}; });
  root = mountPanel("panel-network", "netV3", () => {
    load().catch((e) => notify("NETWORK STATUS: " + e.message.toUpperCase(), 1));
    if (!unsub) { let t; unsub = (e) => { if (!["net_status", "net_monitors", "net_events"].includes(e.detail)) return; if (document.getElementById("panel-network")?.classList.contains("hidden")) return; clearTimeout(t); t = setTimeout(() => load().catch(() => {}), 400); }; window.addEventListener("terminal-live", unsub); }
    clearInterval(poll); poll = setInterval(() => { if (document.getElementById("panel-network")?.classList.contains("hidden")) return; if (live() !== true || Date.now() - lastLoad > 30_000) load().catch(() => {}); }, 30_000);
    clearInterval(tick); tick = setInterval(() => { const a = document.getElementById("ntAgo"); if (a) { const s = Math.round((Date.now() - lastLoad) / 1000); a.textContent = s < 2 ? "updated now" : `updated ${s}s ago`; } }, 1000);
  });
  if (!root) return;
  addCss("netV3", CSS);
  // The old Network Status (network.js) is no longer mounted on this panel.
  root.addEventListener("input", (e) => { if (e.target.id === "ntQ") { q = e.target.value; const p = e.target.selectionStart; draw(); const i = root.querySelector("#ntQ"); i.focus(); i.setSelectionRange(p, p); } });
  root.addEventListener("click", async (e) => {
    const mon = e.target.closest("[data-m]"); if (mon) { sel = mon.dataset.m; det = null; draw(); det = await call("GET", null, `?mon=${encodeURIComponent(sel)}&range=${range}`).catch(() => null); return draw(); }
    const r = e.target.closest("[data-r]"); if (r) { range = r.dataset.r; det = await call("GET", null, `?mon=${encodeURIComponent(sel)}&range=${range}`).catch(() => det); return draw(); }
    const n = e.target.closest("[data-n]");
    if (n) { const note = await ask({ kind: "reason", optional: true, title: "INCIDENT NOTE", body: "e.g. \"Vercel outage\" or \"server restart\".", label: "NOTE", go: "SAVE" }); if (note !== null) { try { await call("POST", { action: "note", incidentId: n.dataset.n, note }); await load(); } catch (err) { notify(err.message.toUpperCase(), 1); } } return; }
    const cj = e.target.closest("[data-c]");
    if (cj) {
      const map = { restart: ["bot.restart", "RESTART CORTANA?", "Cortana stops for about 10 seconds, then PM2 starts it again.", "↻ RESTARTING — BACK IN ~10 S"], sync: ["sync.now", null, null, "✓ CHANNELS + ROLES RE-SYNCED"], cmds: ["commands.register", null, null, "✓ SLASH COMMANDS RE-REGISTERED"] };
      const [type, title, body, ok] = map[cj.dataset.c];
      if (title && !(await ask({ kind: "warn", title, body, go: "RESTART" }))) return;
      try { const r2 = await cortanaJob(type, {}); if (cj.dataset.c === "restart") await audit("security", "CORTANA RESTART", "from Network Status"); notify(r2 ? ok : "◷ CORTANA DIDN'T ANSWER", !r2); } catch (err) { notify("FAILED: " + err.message, 1); }
      return;
    }
    const x = e.target.closest("[data-x]")?.dataset.x; if (!x) return;
    const m = D?.monitors.find((y) => y.id === sel);
    try {
      if (x === "check") { const r3 = await call("POST", { action: "check" }); notify("↻ " + r3.msg.toUpperCase()); return; }
      if (x === "add") return editBox(null);
      if (!m) return;
      if (x === "edit") return editBox(m);
      if (x === "pause") { const r3 = await call("POST", { action: "pause", id: m.id, on: !m.paused }); notify("✓ " + r3.msg.toUpperCase()); }
      if (x === "mute") { const r3 = await call("POST", { action: "mute", id: m.id, on: !m.muted }); notify("✓ " + r3.msg.toUpperCase()); }
      if (x === "del") { if (!(await ask({ kind: "danger", title: `DELETE ${m.name.toUpperCase()}?`, body: "The monitor and its history are removed.", go: "🗑 DELETE" }))) return; const r3 = await call("POST", { action: "delete", id: m.id }); notify("✓ " + r3.msg.toUpperCase()); sel = null; }
      await load();
    } catch (err) { notify(err.message.toUpperCase(), 1); }
  });
});
