/**
 * Cortana Control card (approved mock 2026-11-12) — shown on Network Status → Cortana v2.
 *   Everyone with access sees status (online / shut down + reason, version vs GitHub).
 *   🔑 Control Password: server owner only. Update & Restart · Restart · Shut down: Commander + Developer, with the password.
 * Data: /api/terminal/cortana-control. While an action runs the card checks every 2 s and shows the steps.
 */
import { addCss, esc, notify } from "./_common.js";

const API = "/api/terminal/cortana-control";
let S = null, host = null, poll = null;
const t = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");
const ago = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`; };
async function call(method, body) {
  const r = await fetch(API, { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
  return b;
}
let lastLoad = 0;
async function load() {
  lastLoad = Date.now();
  try { S = await call("GET"); } catch (e) { if (!S) S = { error: e.message }; }
  draw();
  const running = S?.control && ["running", "restarting"].includes(S.control.state) && Date.now() - Date.parse(S.control.atISO) < 10 * 60_000;
  clearTimeout(poll);
  if (running && host?.isConnected) poll = setTimeout(load, 2000);
}

addCss("ctlV1", `
.ctl{border:1px solid var(--l);background:var(--p);padding:13px 17px}.ctl.dn{border-color:rgba(255,77,77,.35)}
.ctl h3{margin:0;font:700 15px Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}.ctl .sb{font-size:10.5px;color:var(--d);margin:2px 0 8px}
.ctl .rw{display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);font-size:12px}.ctl .rw span{color:var(--d);width:150px;flex-shrink:0}.ctl .rw b{font-weight:400;color:#fff;min-width:0}
.ctl .bt{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}.ctl .b.g{border-color:#c9a227;color:#c9a227}.ctl .b.r{border-color:rgba(255,77,77,.55);color:#ff4d4d;margin-left:auto}
.ctl .lg{margin-top:11px;background:#05070a;border:1px solid rgba(0,217,255,.12);padding:8px 11px;font-size:11.5px;line-height:1.8}
.ctl .lg div{display:flex;gap:9px}.ctl .lg i{font-style:normal;width:14px}
.cx-f{width:100%;box-sizing:border-box;background:#070a0f;border:1px solid var(--l2);padding:7px 10px;font:inherit;font-size:12px;color:#fff;outline:0}.cx-f:focus{border-color:#00D9FF}
.cx-l{display:block;font-size:10px;letter-spacing:2px;color:var(--d);margin:10px 0 4px}
.cx-w{border-left:3px solid #f59e0b;background:rgba(245,158,11,.07);padding:8px 10px;margin:10px 0;color:#f5c26b;font-size:12px}
.cx-pw{font:700 17px "Share Tech Mono",monospace;letter-spacing:2px;color:#22e07a;background:#05070a;border:1px solid rgba(34,224,122,.35);padding:10px;text-align:center;user-select:all}
`);

function draw() {
  if (!host?.isConnected) return;
  if (!S) { host.innerHTML = '<div class="ctl dim">CORTANA CONTROL · LOADING…</div>'; return; }
  if (S.error) { host.innerHTML = `<div class="ctl dim">CORTANA CONTROL · ${esc(S.error)}</div>`; return; }
  const v = S.version, c = S.control, sd = S.shutdown;
  const st = sd ? `<b style="color:#ff4d4d">● SHUT DOWN · by ${esc(sd.by)} · ${t(sd.atISO)}</b>` : S.online ? `<b style="color:#22e07a">● ONLINE${S.startedAtISO ? ` · up ${ago(S.startedAtISO)}` : ""}</b>` : `<b style="color:#ff4d4d">● OFFLINE${S.lastSeenISO ? ` · last seen ${t(S.lastSeenISO)}` : ""}</b>`;
  const ICON = { ok: ["✓", "#22e07a"], run: ["◷", "#00D9FF"], fail: ["✕", "#ff4d4d"], skip: ["–", "#7d8a99"] };
  const recent = c && Date.now() - Date.parse(c.atISO) < 30 * 60_000;
  const lock = S.lockedUntilISO ? ` disabled title="Locked after wrong passwords until ${t(S.lockedUntilISO)}"` : "";
  const off = sd || !S.online ? " disabled" : "";
  host.innerHTML = `<div class="ctl ${sd ? "dn" : ""}"><h3>⚙ CORTANA · HOME SERVER</h3><div class="sb">Runs on the home server with PM2 · Cortana_V2</div>
    <div class="rw"><span>STATUS</span>${st}</div>
    ${sd ? `<div class="rw"><span>REASON</span><b>${esc(sd.reason)}</b></div><div class="rw"><span>TO START AGAIN</span><b>On the home server: <span style="color:#00D9FF">pm2 start Cortana_V2</span></b></div>` : ""}
    <div class="rw"><span>RUNNING</span><b>${v.commit ? `${esc(v.commit)} · "${esc(v.subject)}"` : "—"}</b></div>
    <div class="rw"><span>NEWEST ON GITHUB</span><b ${v.behind ? 'style="color:#f59e0b"' : ""}>${v.fetchError ? `<span style="color:#ff8080">Couldn't check GitHub</span>` : v.behind ? `${esc(v.newest)} · "${esc(v.newestSubject)}" · ${v.behind} new` : v.commit ? "✓ up to date" : "—"}${v.checkedAtISO ? ` <small class="dim">· checked ${t(v.checkedAtISO)}</small>` : ""}</b></div>
    ${!sd && S.lastShutdown ? `<div class="rw"><span>LAST SHUT DOWN</span><b class="dim">${t(S.lastShutdown.atISO)} · ${esc(S.lastShutdown.by)} · ${esc(S.lastShutdown.reason)}</b></div>` : ""}
    ${S.canControl || S.owner ? `<div class="bt">
      ${S.canControl ? `<button class="b sm g" data-x="update"${lock}${off}>⇩ UPDATE &amp; RESTART</button><button class="b sm" data-x="restart"${lock}${off}>↻ RESTART</button>` : ""}
      ${S.owner ? `<button class="b sm" data-x="pw">🔑 ${S.hasPassword ? "CHANGE" : "SET"} CONTROL PASSWORD</button>` : ""}
      ${S.canControl ? `<button class="b sm r" data-x="shutdown"${lock}${off}>⏻ SHUT DOWN</button>` : ""}</div>
      ${S.canControl && !S.hasPassword ? `<div class="cx-w">No Control Password yet — ${S.owner ? "set one with 🔑 first." : "the server owner needs to set it first."}</div>` : ""}
      ${S.lockedUntilISO ? `<div class="cx-w">Locked after 5 wrong passwords until ${t(S.lockedUntilISO)}.</div>` : ""}` : ""}
    ${recent && c.steps.length ? `<div class="lg" aria-live="polite"><div class="dim" style="font-size:10px;letter-spacing:2px">${esc(String(c.action).toUpperCase())} · ${esc(c.by)} · ${t(c.atISO)}</div>${c.steps.map((s) => { const [i, col] = ICON[s.s] || ICON.skip; return `<div style="color:${col}"><i>${i}</i><span>${esc(s.t)}${s.d ? ` <span class="dim">— ${esc(s.d)}</span>` : ""}</span></div>`; }).join("")}${c.state === "restarting" ? '<div style="color:#7d8a99"><i>·</i><span>waiting to come back online…</span></div>' : ""}</div>` : ""}
  </div>`;
}

/** Pop-up box. onOk(ov) → resolve true to close; throw an Error to show its message and keep the box open. */
function modal(title, color, body, go, onOk, onOpen) {
  const ov = document.createElement("div");
  ov.className = "v2m";
  ov.innerHTML = `<div class="mw" style="width:min(460px,100%);border-color:${color}" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/&amp;/g, "&"))}"><div class="hd"><div><h2 style="color:${color}">${title}</h2></div><button class="b" data-z="x" aria-label="Close">✕</button></div>
    <div class="bd">${body}<div class="cx-err" role="alert" style="color:#ff8080;font-size:12px;margin-top:8px"></div></div>
    <div class="mf"><span class="hint"></span><button class="b" data-z="x">CANCEL</button><button class="b" data-z="ok" style="border-color:${color};color:${color}">${go}</button></div></div>`;
  document.body.appendChild(ov);
  const prev = document.activeElement;
  const close = () => { ov.remove(); prev?.focus?.(); };
  onOpen?.(ov);
  ov.querySelector("input,select,textarea")?.focus();
  let working = false;
  const ok = async () => {
    if (working) return; working = true;
    const btn = ov.querySelector('[data-z="ok"]'); btn.disabled = true;
    try { if (await onOk(ov)) close(); }
    catch (e) { ov.querySelector(".cx-err").textContent = "✕ " + e.message; }
    finally { working = false; btn.disabled = false; }
  };
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && e.target.tagName === "INPUT") ok(); });
  // Closes on ✕ / CANCEL / Esc, or a click that starts AND ends on the dark background — dragging out of a box doesn't close it.
  let downOnBg = false;
  ov.addEventListener("mousedown", (e) => { downOnBg = e.target === ov; });
  ov.addEventListener("click", (e) => { const z = e.target.closest("[data-z]")?.dataset.z; if ((e.target === ov && downOnBg) || z === "x") close(); if (z === "ok") ok(); downOnBg = false; });
}

function doAction(kind) {
  const isSd = kind === "shutdown";
  const body = isSd
    ? `Cortana stops completely: Discord commands, tickets, live updates and Network Status checks all stop.
       <div class="cx-w">⚠ The website <b>cannot</b> start it again. On the home server: <b style="color:#fff">pm2 start Cortana_V2</b></div>
       <label class="cx-l" for="cxR">REASON (REQUIRED)</label><select class="cx-f" id="cxR"><option value="">— pick a reason —</option><option>Maintenance / server work</option><option>Bot misbehaving / spamming</option><option>Security concern</option><option>Other</option></select>
       <textarea class="cx-f" id="cxD" maxlength="300" rows="2" style="margin-top:6px;resize:none" placeholder="Details (required for Other)" aria-label="Details"></textarea>
       <label class="cx-l" for="cxP">CONTROL PASSWORD</label><input class="cx-f" id="cxP" type="password" autocomplete="off">
       <label class="cx-l" for="cxC">TYPE SHUTDOWN</label><input class="cx-f" id="cxC" autocomplete="off" style="letter-spacing:3px">`
    : `${kind === "update" ? "Cortana gets the newest code from GitHub, installs packages if they changed, then restarts (about 30 s offline). If anything fails it stops and the old Cortana keeps running." : "Cortana restarts — about 10–20 seconds offline."}
       <label class="cx-l" for="cxP">CONTROL PASSWORD</label><input class="cx-f" id="cxP" type="password" autocomplete="off">`;
  const title = isSd ? "⏻ SHUT DOWN CORTANA?" : kind === "update" ? "⇩ UPDATE &amp; RESTART CORTANA?" : "↻ RESTART CORTANA?";
  const color = isSd ? "#ff4d4d" : kind === "update" ? "#c9a227" : "#00D9FF";
  modal(title, color, body, isSd ? "⏻ SHUT DOWN" : kind === "update" ? "⇩ UPDATE" : "↻ RESTART", async (ov) => {
    const q = (x) => ov.querySelector(x);
    try {
      const r = await call("POST", { action: kind, password: q("#cxP").value, ...(isSd ? { reason: q("#cxR").value, details: q("#cxD").value, confirm: q("#cxC").value.trim() } : {}) });
      notify(r.msg.toUpperCase()); setTimeout(load, 1500); return true;
    } catch (e) { q("#cxP").value = ""; throw e; }
  });
}

function doPassword() {
  const body = `Only you (the server owner) can set this. Commander and Developers need it to update, restart or shut down Cortana.
    <label class="cx-l" for="cxP1">NEW PASSWORD (AT LEAST 10 CHARACTERS)</label><input class="cx-f" id="cxP1" type="password" autocomplete="new-password">
    <label class="cx-l" for="cxP2">TYPE IT AGAIN</label><input class="cx-f" id="cxP2" type="password" autocomplete="new-password">
    <div style="margin-top:10px"><button class="b sm" type="button" id="cxGen">⚄ GENERATE A STRONG ONE</button></div><div id="cxShow" style="margin-top:10px"></div>
    <div class="cx-w">Saved scrambled — nobody can see it again. Never paste it in chat or Discord.</div>`;
  modal("🔑 CONTROL PASSWORD", "#00D9FF", body, "SAVE", async (ov) => {
    const a = ov.querySelector("#cxP1").value, b = ov.querySelector("#cxP2").value;
    if (a !== b) throw new Error("The two passwords don't match.");
    const r = await call("POST", { action: "password", password: a });
    notify("✓ " + r.msg.toUpperCase()); load(); return true;
  }, (ov) => {
    ov.querySelector("#cxGen").addEventListener("click", () => {
      const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", a = new Uint32Array(16);
      crypto.getRandomValues(a);
      const s = Array.from(a, (x) => abc[x % abc.length]).join("").replace(/(.{4})(?!$)/g, "$1-");
      ov.querySelector("#cxP1").value = s; ov.querySelector("#cxP2").value = s;
      ov.querySelector("#cxShow").innerHTML = `<div class="cx-pw">${s}</div><div style="display:flex;gap:8px;margin-top:6px;align-items:center"><button class="b sm" type="button" id="cxCopy">⧉ COPY</button><span class="dim" style="font-size:11px">Shown once — save it in your password manager, then SAVE.</span></div>`;
      ov.querySelector("#cxCopy").onclick = () => navigator.clipboard?.writeText(s).then(() => notify("✓ COPIED")).catch(() => {});
    });
  });
}

/** Called by network-v2.js after each draw: <div id="ctlBox"> is the card's place. */
export function mountControl(el) {
  host = el;
  if (!el.dataset.wired) {
    el.dataset.wired = "1";
    el.addEventListener("click", (e) => {
      const x = e.target.closest("[data-x]")?.dataset.x;
      if (!x) return;
      if (x === "pw") return doPassword();
      doAction(x);
    });
  }
  if (S) draw(); // last known state at once — no "LOADING" flash when the page redraws
  if (!S || Date.now() - lastLoad > 20_000) load();
}
export const refreshControl = () => load();
