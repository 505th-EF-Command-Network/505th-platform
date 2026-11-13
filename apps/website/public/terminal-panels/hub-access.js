/**
 * HUB ACCESS + DOWNLOAD CARD (release v0.1, approved mock 2026-11-11).
 *  - Dashboard: download card. On the list → ⤓ DOWNLOAD. Not on it → ✋ REQUEST ACCESS (the Commander gets a 🔔 alert).
 *  - SECURITY → 🔑 Hub Access (panel-hubaccess): requests, give / revoke / restore, quick-add a whole role. Commander changes; Developer views.
 * Everything goes through /api/terminal/hub-access (lib/hub/access-list.ts) — the same rules the app uses.
 */
import { addCss, ask, esc, mountPanel, notify, onReady } from "./_common.js";

const API = "/api/terminal/hub-access";
const LOGO = "https://i.ibb.co/d0Gn5M5R/505-TH-Logo.png";
const RCD = "/brand/rcd-avatar.png";
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const col = (u) => COLS[[...String(u)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLS.length];
const ini = (n) => (String(n).replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase();
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "");
function devState(p) {
  const on = p.lastUsedISO && Date.now() - Date.parse(p.lastUsedISO) < 5 * 60000;
  if (p.suspended) return ["SUSPENDED", "#ff4d4d", ""];
  if (p.status === "revoked") return ["REVOKED", "#ff4d4d", ""];
  if (p.status === "requested") return ["PENDING", "#f59e0b", "waiting for approval"];
  if (p.devices) return on ? ["● ONLINE", "#22e07a", `${p.devices} device${p.devices === 1 ? "" : "s"}`] : ["○ OFFLINE", "#7d8a99", `last seen ${ago(p.lastUsedISO)}`];
  if (p.status === "granted" || p.status === "always") return ["NOT INSTALLED", "#4b5765", ""];
  return ["—", "#4b5765", ""];
}
const ago = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 5 ? "active now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const ROLE = { commander: "Commander", developer: "Developer", officer: "Officer", staff_nco: "Staff NCO", nco: "NCO", recruiter: "Recruiter" };
async function call(method, body, q = "") {
  const r = await fetch(API + q, { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
  return b;
}

/* ───────── dashboard download card ───────── */
let mine = null;
async function card() {
  const panel = document.getElementById("panel-dashboard");
  if (!panel) return;
  try { mine = await call("GET"); } catch { return; }
  let el = document.getElementById("hubDl");
  if (!el) { el = document.createElement("div"); el.id = "hubDl"; el.className = "hubdl hubdl"; const t = panel.querySelector(".panel-title"); t ? t.after(el) : panel.prepend(el); }
  const r = mine.release, ok = mine.allowed;
  const head = `<div class="dlh"><img src="${LOGO}" alt="505th" ${ok ? "" : 'style="opacity:.5;filter:grayscale(1)"'}><div><b>505TH COMMAND NETWORK</b><small>THE STAFF APP FOR WINDOWS</small>
    <div class="tags">${r ? `<span class="v">v${esc(r.version)}</span>` : '<span class="v">COMING SOON</span>'}<span>WINDOWS 10 / 11 · 64-BIT</span>${ok ? '<span class="ok">✓ YOU HAVE ACCESS</span>' : '<span class="am">🔒 ACCESS BY INVITE</span>'}</div></div>
    <button class="x" data-dl="hide" aria-label="Hide this card" title="Hide">✕</button></div>`;
  let body;
  if (ok) {
    body = r ? `<div class="lbl2">WHAT'S IN v${esc(r.version)}</div><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      <a class="dlbtn" href="/api/terminal/hub-download" download>⤓ DOWNLOAD FOR WINDOWS</a>
      <div class="meta"><span>${esc(r.file)} · ${r.sizeMB} MB</span><span>Released ${day(r.dateISO)}</span></div>
      ${r.sha256 ? `<div class="meta"><span>SHA-256 ${esc(r.sha256.slice(0, 8))}…${esc(r.sha256.slice(-6))} <button class="lk" data-dl="sha">copy</button></span></div>` : ""}`
      : `<div class="lockmsg" style="border-color:#00d9ff;background:rgba(0,217,255,.06);color:#bfefff">You're on the list. The first release (v0.1) is being built — the download appears here when it's ready.</div>`;
  } else if (mine.status === "requested") {
    body = `<div class="lockmsg">✋ Request sent ${day(mine.requestAtISO)} — waiting for the Commander. You'll get a 🔔 alert.</div>`;
  } else if (mine.status === "revoked") {
    body = `<div class="lockmsg" style="border-color:#ff4d4d;background:rgba(255,77,77,.06);color:#ffb3b3">⛔ Your Hub access was revoked. Speak to the Commander.</div>`;
  } else {
    body = `<div class="lockmsg">The Hub is handed out by the <b>Commander</b>. Ask for access below — you'll get a 🔔 alert when it's approved.${mine.status === "denied" ? `<br><small>Last request was declined${mine.reason ? `: ${esc(mine.reason)}` : ""}.</small>` : ""}</div>
      <textarea class="fld" id="hubDlNote" rows="2" maxlength="300" placeholder="Why do you need the Hub? (optional)" aria-label="Reason"></textarea>
      <button class="dlbtn req" data-dl="req">✋ REQUEST ACCESS</button>`;
  }
  el.classList.toggle("lock", !ok);
  el.innerHTML = `${head}<div class="dlb">${body}</div><div class="foot"><img src="${RCD}" alt="" onerror="this.remove()">© 2026 505th Expeditionary Force · Developed by Rev Creative Developer${ok && r ? " · By downloading you accept the 505th Software Policy" : ""}</div>`;
  el.hidden = sessionStorage.getItem("hubDlHide") === "1";
}

/* ───────── Hub Access page ───────── */
let D = null, root = null, q = "", f = "all";
async function load() { D = await call("GET", null, "?list=1"); draw(); }
function draw() {
  if (!root || !D) return;
  const can = D.canManage;
  const reqs = D.people.filter((p) => p.status === "requested");
  const list = D.people.filter((p) => (f === "all" || (f === "access" ? p.status === "granted" || p.status === "always" : p.status === f)) && p.name.toLowerCase().includes(q.toLowerCase()));
  const av = (p) => p.photo ? `<img class="av" src="${esc(p.photo)}" alt="">` : `<span class="av" style="background:${col(p.uid)}">${esc(ini(p.name))}</span>`;
  const st = (p) => p.status === "always" ? '<span class="st2" style="color:#c9a227;border-color:#c9a22766">★ ALWAYS</span>' : p.status === "granted" ? '<span class="st2" style="color:#22e07a;border-color:#22e07a66">✓ ACCESS</span>'
    : p.status === "revoked" ? '<span class="st2" style="color:#ff4d4d;border-color:#ff4d4d66">✕ REVOKED</span>' : p.status === "requested" ? '<span class="st2" style="color:#f59e0b;border-color:#f59e0b66">✋ ASKED</span>'
    : p.status === "denied" ? '<span class="st2" style="color:#7d8a99;border-color:#7d8a9966">DECLINED</span>' : '<span class="st2" style="color:#4b5765;border-color:#4b576566">NO ACCESS</span>';
  const btn = (p) => !can || p.always ? "" : p.status === "granted" ? `<button class="b sm red" data-a="revoke" data-u="${p.uid}">REVOKE</button>` : p.status === "revoked" ? `<button class="b sm" data-a="restore" data-u="${p.uid}">RESTORE</button>`
    : `<button class="b sm" data-a="give" data-u="${p.uid}">＋ GIVE ACCESS</button>`;
  const chip = (k, l) => `<button class="ch ${f === k ? "on" : ""}" data-f="${k}" aria-pressed="${f === k}">${l}</button>`;
  root.innerHTML = `<div class="top"><img src="${LOGO}" alt="" style="width:38px"><div><div class="h1" style="border:none;padding:0">HUB ACCESS</div><div class="sub" style="margin:2px 0 0;color:#f59e0b">★ ${can ? "COMMANDER" : "VIEW ONLY — THE COMMANDER CHANGES THIS"} · WHO MAY DOWNLOAD AND SIGN IN TO THE COMMAND NETWORK APP</div></div></div>
  <div class="kp"><div><b style="color:#22e07a">${D.stats.access}</b><span>HAVE ACCESS</span></div><div><b style="color:#f59e0b">${D.stats.requests}</b><span>REQUESTS WAITING</span></div><div><b style="color:#00D9FF">${D.stats.online}</b><span>USING THE HUB NOW</span></div><div><b style="color:#ff4d4d">${D.stats.revoked}</b><span>REVOKED</span></div></div>
  ${reqs.length ? `<div class="req"><div class="rh">✋ REQUESTS WAITING · ${reqs.length}</div>${reqs.map((p) => `<div class="rr">${av(p)}<div style="flex:1"><b>${esc(p.name)}</b><small>${esc(ROLE[p.role] || p.role)} · ${p.note ? `“${esc(p.note)}”` : "no reason given"} · ${day(p.requestAtISO)}</small></div>
    ${can ? `<button class="b sm ok" data-a="approve" data-u="${p.uid}">✓ APPROVE</button><button class="b sm" data-a="deny" data-u="${p.uid}">DENY</button>` : ""}</div>`).join("")}</div>` : ""}
  <div class="flt"><input class="fld" id="haQ" placeholder="🔍 Find a member…" aria-label="Find a member" value="${esc(q)}">${chip("all", "ALL")}${chip("access", "HAS ACCESS")}${chip("revoked", "REVOKED")}${chip("none", "NO ACCESS")}
    ${can ? '<span class="qk">QUICK:</span><button class="ch" data-bulk="officer">＋ ALL OFFICERS</button><button class="ch" data-bulk="staff_nco">＋ ALL STAFF NCOs</button>' : ""}</div>
  <table><thead><tr><th>MEMBER</th><th>ACCESS</th><th>GIVEN / CHANGED BY</th><th>DEVICES</th><th></th></tr></thead><tbody>
  ${list.map((p) => `<tr class="${p.status === "revoked" ? "rv" : ""}"><td><div class="who">${av(p)}<div><b>${esc(p.name)}</b><small>${esc(ROLE[p.role] || p.role)}</small></div></div></td><td>${st(p)}</td>
    <td>${p.always ? "—" : p.byName ? `${esc(p.byName)} · ${day(p.atISO)}${p.reason ? `<small>“${esc(p.reason)}”</small>` : ""}` : "—"}</td>
    <td>${(() => { const [l, c, sub] = devState(p); return l === "—" ? "—" : `<span style="border:1px solid ${c}66;color:${c};padding:0 6px;font-size:9.5px;letter-spacing:1.5px">${l}</span>${sub ? ` <small class="dim" style="display:inline;margin-left:6px">${esc(sub)}</small>` : ""}`; })()}</td><td style="text-align:right">${btn(p)}</td></tr>`).join("") || '<tr><td colspan="5" class="dim" style="text-align:center;padding:24px">NO ONE MATCHES</td></tr>'}</tbody></table>
  <div class="notes"><div><b>REVOKE = INSTANT</b>Their Hub signs out on every PC within seconds, the download card locks, and they can't sign in again. A reason is required and goes in the Audit Log.</div>
    <div><b>ALWAYS</b>Commander and Developer always have access and can't be revoked here.</div><div><b>POLICY</b>Everyone must accept the 505th Software Use Policy in the app before they can use it.</div></div>`;
}
async function act(body, msg) {
  try { const r = await call("POST", body); notify("✓ " + String(r.msg || msg).toUpperCase()); await load(); } catch (e) { notify(e.message.toUpperCase(), 1); }
}

const CSS = `
#panel-dashboard > div#hubDl.hubdl.hubdl{display:block!important}#panel-dashboard > div#hubDl.hubdl.hubdl[hidden]{display:none!important}
#hubDl{border:1px solid #00D9FF;background:linear-gradient(135deg,#0b1a24,#080b10 60%);margin:0 0 16px;font-family:'Share Tech Mono',monospace;color:#d6dde6;max-width:760px}
#hubDl.lock{border-color:rgba(245,158,11,.5)}
#hubDl .dlh{display:flex;gap:16px;align-items:center;padding:16px 18px;position:relative}#hubDl .dlh img{width:70px;filter:drop-shadow(0 0 12px rgba(0,217,255,.4))}#hubDl .dlh b{display:block;font:700 19px Rajdhani,sans-serif;letter-spacing:3px;color:#fff}#hubDl .dlh small{font-size:10.5px;color:#7d8a99;letter-spacing:1px}
#hubDl .x{position:absolute;right:10px;top:8px;background:none;border:none;color:#4b5765;cursor:pointer;font-size:13px}#hubDl .x:hover{color:#fff}
#hubDl .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#hubDl .tags span{font-size:9.5px;letter-spacing:1.5px;padding:1px 7px;border:1px solid rgba(0,217,255,.18);color:#7d8a99}#hubDl .tags .v{border-color:#00D9FF;color:#00D9FF}#hubDl .tags .ok{border-color:rgba(34,224,122,.4);color:#22e07a}#hubDl .tags .am{border-color:rgba(245,158,11,.4);color:#f59e0b}
#hubDl .dlb{padding:0 18px 16px}#hubDl .lbl2{font-size:10px;letter-spacing:2px;color:#7d8a99}#hubDl ul{margin:6px 0 12px;padding-left:18px;font-size:12px;color:#c6d0da}
#hubDl .dlbtn{display:flex;align-items:center;justify-content:center;width:100%;padding:11px;background:#c9a227;color:#000;border:none;font:700 14px Rajdhani,sans-serif;letter-spacing:3px;text-decoration:none;cursor:pointer}
#hubDl .dlbtn.req{background:none;border:1px solid #f59e0b;color:#f59e0b;margin-top:10px}
#hubDl .meta{display:flex;justify-content:space-between;font-size:10.5px;color:#4b5765;margin-top:7px}#hubDl .lk{background:none;border:none;color:#00D9FF;cursor:pointer;font:inherit;padding:0}
#hubDl .lockmsg{border-left:2px solid #f59e0b;background:rgba(245,158,11,.06);padding:8px 12px;font-size:12px;color:#f7d08a;margin-bottom:10px}#hubDl .lockmsg small{color:#7d8a99}
#hubDl .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;font:inherit;font-size:12px;color:#d6dde6;outline:0;resize:none}
#hubDl .foot{display:flex;align-items:center;gap:8px;border-top:1px solid rgba(0,217,255,.18);padding:7px 18px;font-size:9.5px;color:#4b5765;letter-spacing:1px}#hubDl .foot img{width:18px;height:18px;border-radius:4px}
#hubAcc .top{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--l)}
#hubAcc .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}#hubAcc .kp div{border:1px solid var(--l);background:var(--p);padding:9px 13px}#hubAcc .kp b{display:block;font:700 23px Rajdhani,sans-serif}#hubAcc .kp span{font-size:9.5px;letter-spacing:2px;color:var(--d)}
#hubAcc .req{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.05);margin-bottom:14px}#hubAcc .rh{padding:7px 12px;font:700 11.5px Rajdhani,sans-serif;letter-spacing:2.5px;color:#f59e0b;border-bottom:1px solid rgba(245,158,11,.2)}
#hubAcc .rr{display:flex;align-items:center;gap:10px;padding:8px 12px;font-size:12.5px;border-bottom:1px solid rgba(255,255,255,.03)}#hubAcc .rr b{color:#fff;font-weight:400}#hubAcc .rr small,#hubAcc td small{display:block;color:var(--d);font-size:10.5px}
#hubAcc .av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#000;flex-shrink:0;object-fit:cover}
#hubAcc .flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}#hubAcc .flt .fld{flex:1;min-width:200px;background:#070a0f;border:1px solid var(--l2);padding:7px 10px;font:inherit;font-size:12px;color:#d6dde6;outline:0}
#hubAcc .ch{border:1px solid var(--l);background:none;color:var(--d);padding:5px 10px;font:inherit;font-size:10.5px;letter-spacing:1.5px;cursor:pointer}#hubAcc .ch.on{border-color:#00D9FF;color:#00D9FF}#hubAcc .qk{font-size:10px;letter-spacing:1.5px;color:var(--d);margin-left:8px}
#hubAcc table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid var(--l);background:var(--p)}#hubAcc th{text-align:left;font-weight:400;font-size:9.5px;letter-spacing:2px;color:var(--d);padding:7px 14px;border-bottom:1px solid var(--l)}#hubAcc td{padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.03)}
#hubAcc tr.rv{opacity:.6}#hubAcc .who{display:flex;gap:10px;align-items:center}#hubAcc .who b{color:#fff;font-weight:400}
#hubAcc .st2{font-size:9.5px;letter-spacing:1.5px;padding:1px 7px;border:1px solid}#hubAcc .dim{color:var(--d)}
#hubAcc .b.sm{padding:4px 10px;font-size:10px}#hubAcc .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}#hubAcc .b.ok{color:#22e07a;border-color:rgba(34,224,122,.5)}
#hubAcc .notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:14px}#hubAcc .notes div{border:1px solid var(--l);background:var(--p);padding:11px 13px;font-size:12px;color:#aeb9c4}#hubAcc .notes b{color:#00D9FF;display:block;font-size:10.5px;letter-spacing:2px;margin-bottom:3px}
@media(max-width:900px){#hubAcc .kp{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  addCss("hubAccess", CSS);
  // Dashboard card (re-checked when the dashboard opens).
  const dp = document.getElementById("panel-dashboard");
  if (dp) {
    void card();
    new MutationObserver(() => { if (!dp.classList.contains("hidden")) void card(); }).observe(dp, { attributes: true, attributeFilter: ["class"] });
    dp.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-dl]");
      if (!b) return;
      if (b.dataset.dl === "hide") { sessionStorage.setItem("hubDlHide", "1"); document.getElementById("hubDl").hidden = true; }
      if (b.dataset.dl === "sha" && mine?.release) { await navigator.clipboard.writeText(mine.release.sha256).catch(() => {}); notify("✓ SHA-256 COPIED"); }
      if (b.dataset.dl === "req") {
        b.disabled = true;
        try { const r = await call("POST", { action: "request", note: document.getElementById("hubDlNote")?.value || "" }); notify("✓ " + r.msg.toUpperCase()); } catch (err) { notify(err.message.toUpperCase(), 1); }
        void card();
      }
    });
  }
  // Hub Access page
  root = mountPanel("panel-hubaccess", "hubAcc", () => load().catch((e) => notify("HUB ACCESS: " + e.message.toUpperCase(), 1)));
  if (!root) return;
  root.innerHTML = '<div class="empty">LOADING…</div>';
  root.addEventListener("input", (e) => { if (e.target.id === "haQ") { q = e.target.value; const p = e.target.selectionStart; draw(); const i = root.querySelector("#haQ"); i.focus(); i.setSelectionRange(p, p); } });
  root.addEventListener("click", async (e) => {
    const fl = e.target.closest("[data-f]"); if (fl) { f = fl.dataset.f; return draw(); }
    const bk = e.target.closest("[data-bulk]");
    if (bk) { const l = bk.dataset.bulk === "officer" ? "ALL OFFICERS" : "ALL STAFF NCOs";
      if (await ask({ kind: "warn", title: `GIVE HUB ACCESS TO ${l}?`, body: "Anyone with that role who doesn't have access yet gets it (revoked people are skipped). They get a 🔔 alert.", go: "＋ GIVE ACCESS" })) act({ action: "bulk", role: bk.dataset.bulk }); return; }
    const b = e.target.closest("[data-a]"); if (!b) return;
    const p = D.people.find((x) => x.uid === b.dataset.u); if (!p) return;
    const a = b.dataset.a;
    if (a === "revoke") { const why = await ask({ kind: "reason", title: `REVOKE HUB ACCESS — ${p.name.toUpperCase()}?`, body: "They are signed out of the Hub on every PC straight away and can't sign in again.", label: "REASON (GOES IN THE AUDIT LOG)", go: "⛔ REVOKE" }); if (why) act({ action: "revoke", uid: p.uid, reason: why }); return; }
    if (a === "deny") { const why = await ask({ kind: "reason", optional: true, title: `DECLINE ${p.name.toUpperCase()}?`, body: "They get a 🔔 alert. They can ask again later.", label: "REASON (OPTIONAL — THEY SEE IT)", go: "DECLINE" }); if (why !== null) act({ action: "deny", uid: p.uid, reason: why }); return; }
    act({ action: a, uid: p.uid });
  });
});
