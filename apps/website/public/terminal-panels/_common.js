/**
 * Shared helpers for the redesigned Command Terminal panels.
 * Each panel module replaces one original panel's contents; the original
 * elements stay in the page (hidden) so the original code keeps running.
 */
import { getAuth } from "/terminal-shim/auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, serverTimestamp } from "/terminal-shim/firestore.js";

export const db = getFirestore();
export const auth = getAuth();

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
export const PLATOON_ORDER = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", "Reserves"];

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const rankAbbr = (r) => RANK_ABBR[r] || (r ? String(r).split("/").pop().trim() : "");
export function memberName(u) {
  if (!u) return "—";
  const first = (u.firstName || "").trim(), last = (u.lastName || "").trim(), cs = (u.callsign || "").trim();
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : last || (cs ? `"${cs}"` : "")}`.trim();
  return [rankAbbr(u.rank || ""), name].filter(Boolean).join(" ") || "—";
}
export function rankOrder(r) {
  const m = String(r || "").match(/^([OE])(\d+)/);
  if (!m) return r === "Reservist" ? 900 : 999;
  return (m[1] === "O" ? 0 : 100) + (99 - parseInt(m[2], 10));
}
export const platoonOrder = (p) => {
  const i = PLATOON_ORDER.indexOf(p);
  return i < 0 ? 99 : i;
};
export const rateColor = (p) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
export const toDate = (v) => (!v ? null : typeof v.toDate === "function" ? v.toDate() : new Date(v));
export const ukDate = (v, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  const d = toDate(v);
  return d && !isNaN(d) ? d.toLocaleDateString("en-GB", opts).toUpperCase() : "—";
};
export const today = () => new Date().toISOString().slice(0, 10);
export function since(v) {
  const d = toDate(v);
  if (!d || isNaN(d)) return "—";
  const n = new Date();
  let m = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
  if (m < 0) m = 0;
  const y = Math.floor(m / 12);
  return (y ? y + "y " : "") + (m % 12) + "m";
}
export const isMember = (u) => u.status !== "pending" && u.status !== "denied";

export function notify(msg, err) {
  const n = document.getElementById("notification");
  if (!n) return;
  n.textContent = msg;
  n.className = "notification show" + (err ? " error" : "");
  setTimeout(() => (n.className = "notification"), 3000);
}

let _me = null;
/** The signed-in staff member's own users doc. */
export async function getMe() {
  if (_me) return _me;
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const s = await getDoc(doc(db, "users", uid));
  _me = s.exists() ? { uid, ...s.data() } : { uid, role: "" };
  return _me;
}

export async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Same shape as writeAuditLog() in the original page. */
export async function audit(section, action, details) {
  const me = await getMe();
  if (!me) return;
  try {
    await addDoc(collection(db, "audit_logs"), {
      section, action, details,
      uid: me.uid, by: memberName(me) || me.callsign || "Unknown", role: me.role || "—",
      createdAt: serverTimestamp(), createdAtISO: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("audit failed", e);
  }
}

export async function notifyMember(uid, type, title, body) {
  try {
    await addDoc(collection(db, "notifications", uid, "items"), { type, read: false, title, body, createdAt: serverTimestamp() });
  } catch (_) {}
}

/** Posts an embed to a configured Discord webhook (settings/webhooks[key]), if set. */
export async function webhook(key, embed) {
  try {
    const s = await getDoc(doc(db, "settings", "webhooks"));
    const url = s.exists() ? s.data()[key] : null;
    if (!url || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "505th Command Terminal", allowed_mentions: { parse: [] }, embeds: [{ footer: { text: "505th Expeditionary Force • Command Terminal" }, timestamp: new Date().toISOString(), ...embed }] }),
    });
  } catch (e) {
    console.warn("webhook failed", e);
  }
}

/** Shared look for all v2 panels (scoped to .v2). */
export const BASE_CSS = `
.v2,.v2m{--a:#00D9FF;--g:#22e07a;--am:#f59e0b;--r:#ff4d4d;--l:rgba(0,217,255,.18);--l2:rgba(0,217,255,.35);--p:#0b0f15;--p2:#0e131b;--d:#7d8a99;--dd:#4b5765;font-family:'Share Tech Mono',monospace;color:#d6dde6}
.v2 *{box-sizing:border-box}
.v2 .h1{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;color:var(--a);font-size:20px;padding-bottom:10px;border-bottom:1px solid var(--l)}
.v2 .sub{font-size:10px;letter-spacing:3px;color:var(--d);margin:10px 0 0}
.v2 .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.v2 .k{border:1px solid var(--l);background:var(--p);padding:10px 12px;display:flex;align-items:baseline;gap:10px}
.v2 .k b{font-family:Rajdhani,sans-serif;font-size:24px}.v2 .k span{font-size:9px;letter-spacing:2.5px;color:var(--d)}
.v2 .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.v2 .sp{flex:1}
.v2 .b,.v2m .b{background:none;border:1px solid var(--l2,rgba(0,217,255,.35));color:var(--a,#00D9FF);padding:7px 12px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11px;cursor:pointer;white-space:nowrap}
.v2 .b:disabled,.v2m .b:disabled{opacity:.4;cursor:not-allowed}
.v2 .b.gold,.v2m .b.gold{color:#000;background:#f59e0b;border-color:#f59e0b}
.v2 .b.teal,.v2m .b.teal{color:#2dd4bf;border-color:rgba(45,212,191,.5)}
.v2 .b.red,.v2m .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}
.v2 .b.green,.v2m .b.green{color:#22e07a;border-color:rgba(34,224,122,.5)}
.v2 .srch,.v2m .srch{background:#070a0f;border:1px solid rgba(0,217,255,.18);padding:7px 9px;font:inherit;font-size:11px;outline:0;color:#d6dde6}
.v2 .chip{border:1px solid var(--l);background:var(--p);padding:6px 10px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:10.5px;color:var(--d);cursor:pointer}
.v2 .chip.on{color:var(--a);border-color:var(--a)}.v2 .chip small{opacity:.65;margin-left:4px;font-family:'Share Tech Mono',monospace}
.v2 .pchip{font-family:Rajdhani,sans-serif;font-weight:700;font-size:10px;letter-spacing:1.5px;padding:2px 6px;border:1px solid #3b4a5a;color:#9fb3c4;white-space:nowrap}
.v2 .empty{text-align:center;padding:40px;color:var(--d);letter-spacing:4px;font-size:11px;border:1px dashed var(--l)}
.v2 table.t{width:100%;border-collapse:collapse;border:1px solid var(--l);background:var(--p)}
.v2 .t th{text-align:left;font-size:9.5px;letter-spacing:2.5px;color:var(--a);opacity:.85;padding:10px 12px;border-bottom:1px solid var(--l2);font-weight:400;white-space:nowrap;user-select:none}
.v2 .t th[data-k]{cursor:pointer}.v2 .t th.s::after{content:" ▾"}.v2 .t th.s.up::after{content:" ▴"}
.v2 .t td{padding:9px 12px;border-bottom:1px solid rgba(0,217,255,.06);font-size:12px;color:#c6d0da;white-space:nowrap}
.v2 .t tr:hover td{background:rgba(0,217,255,.03)}
.v2 .t .nm{color:#fff;cursor:pointer}.v2 .t .nm:hover{color:var(--a)}
.v2 .t .s2{display:block;font-size:9px;color:var(--dd);letter-spacing:1px;margin-top:2px}
.v2 .t .grp td{background:rgba(0,217,255,.04)!important;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;color:var(--a);font-size:12px}
.v2 .wrapx{overflow-x:auto}
.v2 .more{position:relative}
.v2 .menu{display:none;position:absolute;right:0;top:calc(100% + 4px);background:#0b0f15;border:1px solid var(--l2);min-width:260px;z-index:20;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.v2 .menu.open{display:block}
.v2 .menu button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--l);padding:10px 12px;font:inherit;font-size:11px;letter-spacing:1px;color:#c6d0da;cursor:pointer}
.v2 .menu button:hover{background:rgba(0,217,255,.06)}
.v2 .menu small{display:block;color:var(--d);font-size:9px;margin-top:2px}
.v2m{position:fixed;inset:0;background:rgba(2,4,7,.8);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999;font-family:'Share Tech Mono',monospace;color:#d6dde6}
.v2m *{box-sizing:border-box}
.v2m .mw.pad{padding:18px 22px;overflow:auto}
.v2m .h1{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;color:var(--mcol,#00D9FF);padding-bottom:10px;border-bottom:1px solid var(--l)}
.v2m .in{width:100%;background:#070a0f;border:1px solid var(--l2);padding:8px 10px;font:inherit;font-size:12px;outline:0;color:#d6dde6}
.v2m .in:focus{border-color:var(--a)}
.v2m .mw{width:min(900px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:#0b0f15;border:1px solid var(--mc,rgba(0,217,255,.35));box-shadow:0 20px 80px rgba(0,0,0,.6)}
.v2m .hd{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(0,217,255,.18)}
.v2m h2{margin:0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;font-size:16px;color:var(--mcol,#00D9FF)}
.v2m .hd small{display:block;font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin-top:2px}
.v2m .xx{background:none;border:1px solid rgba(0,217,255,.35);width:30px;height:30px;color:#9fb3c4;cursor:pointer}
.v2m .bd{padding:16px 20px;overflow:auto}
.v2m .lbl{display:block;font-size:9.5px;letter-spacing:2.5px;color:#aeb9c4;margin:0 0 7px}
.v2m .lbl small{color:#4b5765;letter-spacing:1px}
.v2m .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:9px 10px;font:inherit;font-size:12px;outline:0;margin-bottom:14px;color:#d6dde6}
.v2m .fld:focus{border-color:#00D9FF}
.v2m textarea.fld{min-height:70px;resize:vertical}
.v2m .ft{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid rgba(0,217,255,.18);background:#090c11;flex-wrap:wrap}
.v2m .hint{font-size:9.5px;letter-spacing:1.5px;color:#7d8a99}
@media(max-width:700px){.v2 .kp{grid-template-columns:repeat(2,1fr)}}
`;

let _cssDone = new Set();
export function addCss(id, css) {
  if (_cssDone.has(id)) return;
  _cssDone.add(id);
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
}

/**
 * Replaces a panel's visible content with a v2 root (original children stay,
 * hidden). Calls onShow() every time the panel is opened.
 */
export function mountPanel(panelId, rootId, onShow) {
  const panel = document.getElementById(panelId);
  if (!panel || document.getElementById(rootId)) return null;
  addCss("v2-base", BASE_CSS);
  addCss("v2-hide-" + panelId, `#${panelId} > :not(#${rootId}){display:none!important}`);
  const root = document.createElement("div");
  root.id = rootId;
  root.className = "v2";
  panel.appendChild(root);
  new MutationObserver(() => {
    if (!panel.classList.contains("hidden")) onShow();
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  if (!panel.classList.contains("hidden")) onShow();
  return root;
}

/** Simple modal; returns the overlay element. Esc / backdrop / [data-close] close it. */
export function openModal(html, { color = "rgba(0,217,255,.35)", title = "#00D9FF", width = 900, pad = false } = {}) {
  closeModal();
  const ov = document.createElement("div");
  ov.className = "v2m";
  ov.id = "v2Modal";
  ov.innerHTML = `<div class="mw${pad ? " pad" : ""}" role="dialog" aria-modal="true" style="--mc:${color};--mcol:${title};width:min(${width}px,100%)">${html}</div>`;
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(ov);
  setTimeout(() => ov.querySelector("input,select,textarea,button:not([data-close])")?.focus(), 30);
  return ov;
}
export function closeModal() {
  document.getElementById("v2Modal")?.remove();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

export const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());

/** Signed Cloudinary upload. Server signs; secret never reaches the browser. */
export async function uploadImage(file, folder, onProgress) {
  const sr = await fetch("/api/terminal/upload-sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder }) });
  const s = await sr.json().catch(() => ({}));
  if (!sr.ok) throw new Error(s.error || "Upload not allowed");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", s.apiKey);
  fd.append("timestamp", String(s.timestamp));
  fd.append("folder", s.folder);
  fd.append("signature", s.signature);
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", `https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch {}
      d.secure_url ? resolve(d) : reject(new Error(d.error?.message || "Upload failed"));
    };
    x.onerror = () => reject(new Error("Network error"));
    x.send(fd);
  });
}

/* ───────── Hex profile pictures (same everywhere) ───────── */
const HEX_CSS = `
.hx{display:inline-block;flex-shrink:0;position:relative;vertical-align:middle;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%);background:#0e1a24 var(--img,none) no-repeat;background-size:var(--z,100%) auto;background-position:var(--px,50%) var(--py,50%)}
.hx::after{content:"";position:absolute;inset:0;clip-path:inherit;box-shadow:inset 0 0 0 2px rgba(0,217,255,.55);pointer-events:none}
.hx.pf-hexempty{background:rgba(0,217,255,.35)}.hx.pf-hexempty::after{inset:2px;box-shadow:none;background:#0a1018 url(/images/logo.png) center/38% no-repeat;opacity:1}.hx.pf-hexempty::before{content:"";position:absolute;inset:0;background:#0a1018;opacity:.85;clip-path:inherit;z-index:1}
.hx.noimg{display:inline-grid;place-items:center;color:#00D9FF;font-family:Rajdhani,sans-serif;font-weight:700}
.hx-xs{width:22px;height:20px;font-size:9px}.hx-sm{width:34px;height:30px;font-size:12px}.hx-md{width:46px;height:40px;font-size:15px}.hx-lg{width:64px;height:56px;font-size:20px}.hx-xl{width:150px;height:130px;font-size:40px}
`;
addCss("hex-avatars", HEX_CSS);
/** The picture to show for a member: their upload, else their Discord picture. */
export function photoUrlOf(u) {
  const p = (u && (u.photoUrl || u.photoURL || u.discordAvatarUrl)) || "";
  return /^https:\/\//.test(p) ? p : "";
}
/** Hex picture HTML. size: xs | sm | md | lg | xl. */
export function hexAvatar(u, size = "sm", extraClass = "") {
  const url = photoUrlOf(u);
  const ph = u?.photo || {};
  const label = esc(memberName(u));
  if (!url) {
    const ini = esc(((u?.callsign || u?.lastName || "?").trim()[0] || "?").toUpperCase());
    return `<span class="hx hx-${size} noimg ${extraClass}" role="img" aria-label="${label}">${ini}</span>`;
  }
  const zoom = ph.source === "upload" ? Math.max(100, Math.min(250, +ph.zoom || 100)) : 100;
  const x = ph.source === "upload" ? +ph.x || 50 : 50, y = ph.source === "upload" ? +ph.y || 50 : 50;
  return `<span class="hx hx-${size} ${extraClass}" role="img" aria-label="${label}" style="--img:url('${esc(url).replace(/'/g, "%27")}');--z:${zoom}%;--px:${x}%;--py:${y}%"></span>`;
}

/* ───────── Confirm pop-ups (approved mock 2026-11-10) — replace window.confirm / alert / prompt ─────────
 * await ask({ kind: "danger", title: "DELETE NOTE?", body: "…", item: "✎ Note title", warn: "THIS CANNOT BE UNDONE.", go: "DELETE NOTE" }) → true / false
 *   kind: "danger" (red ✕) · "big" (red ⚠, must type `type`, default DELETE) · "warn" (amber ▲) · "reason" (amber ✎, returns the reason text or null)
 *         "ok" (cyan ◈) · "info" (green ✓, one button)
 * Enter = confirm, Esc = cancel. Delete/warn pop-ups start on CANCEL so a stray Enter never deletes.
 * `body` is plain text (escaped); use `bodyHtml` only with text you built and escaped yourself.
 */
const CF_KIND = {
  danger: ["#ff4d4d", "✕"], big: ["#ff4d4d", "⚠"], warn: ["#f59e0b", "▲"], reason: ["#f59e0b", "✎"], ok: ["#00D9FF", "◈"], info: ["#22e07a", "✓"],
};
const CF_CSS = `
.cf-ov{position:fixed;inset:0;background:rgba(2,4,7,.78);backdrop-filter:blur(3px);display:grid;place-items:center;z-index:2000;padding:20px;animation:cfFd .15s;font-family:'Share Tech Mono',monospace}
@keyframes cfFd{from{opacity:0}}@keyframes cfPp{from{transform:translateY(8px) scale(.98);opacity:.4}}
.cf{width:min(440px,100%);background:#0b0f15;border:1px solid var(--c);box-shadow:0 0 40px color-mix(in srgb,var(--c) 18%,transparent),0 20px 80px rgba(0,0,0,.6);animation:cfPp .18s;color:#d6dde6}
.cf-h{display:flex;align-items:center;gap:12px;padding:16px 20px 0}
.cf-ic{width:40px;height:40px;flex-shrink:0;display:grid;place-items:center;font-size:18px;color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}
.cf-h h3{margin:0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:17px;color:var(--c)}
.cf-b{padding:12px 20px 4px 72px;font-size:12px;line-height:1.7;color:#c6d0da;white-space:pre-line}.cf-b b{color:#fff;font-weight:400}
.cf-item{margin-top:10px;border:1px solid rgba(0,217,255,.18);background:#070a0f;padding:8px 10px;font-size:11.5px;color:#fff;white-space:normal}
.cf-warn{margin-top:10px;font-size:10px;letter-spacing:1.5px;color:#ff4d4d}
.cf-lb{display:block;font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin:12px 0 6px}
.cf-in{width:100%;box-sizing:border-box;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;font:inherit;font-size:12px;outline:0;color:#d6dde6}.cf-in:focus{border-color:var(--c)}
textarea.cf-in{resize:vertical;min-height:64px}
.cf-f{display:flex;justify-content:flex-end;gap:8px;padding:16px 20px;margin-top:10px;border-top:1px solid rgba(0,217,255,.18);background:#090c11}
.cf-btn{min-height:36px;padding:0 18px;white-space:nowrap;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2.5px;font-size:12.5px;cursor:pointer;background:none;border:1px solid #5b6b7c;color:#c6d0da}
.cf-btn:hover{border-color:#9fb3c4}.cf-btn.go{background:var(--c);border-color:var(--c);color:#000}.cf-btn.go:disabled{opacity:.35;cursor:not-allowed}
.cf-btn:focus-visible,.cf-in:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
.cf-key{font-size:9px;color:#7d8a99;letter-spacing:1px;margin-right:auto;align-self:center}
@media(max-width:520px){.cf-b{padding-left:20px}.cf-key{display:none}}`;
export function ask(o = {}) {
  addCss("cfV2", CF_CSS);
  const kind = CF_KIND[o.kind] ? o.kind : "ok";
  const [c0, icon] = CF_KIND[kind];
  const c = o.color || c0;
  const one = kind === "info";
  const typeWord = kind === "big" ? o.type || "DELETE" : null;
  const safe = ["danger", "big", "warn"].includes(kind);
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "cf-ov";
    ov.innerHTML = `<div class="cf" role="alertdialog" aria-modal="true" aria-labelledby="cfT" aria-describedby="cfB" style="--c:${c}">
      <div class="cf-h"><span class="cf-ic" aria-hidden="true">${o.icon || icon}</span><h3 id="cfT">${esc(o.title || "ARE YOU SURE?")}</h3></div>
      <div class="cf-b" id="cfB">${o.bodyHtml ?? esc(o.body || "")}${o.item ? `<div class="cf-item">${esc(o.item)}</div>` : ""}${kind === "reason" ? `<label class="cf-lb" for="cfR">${esc(o.label || "REASON (REQUIRED)")}</label><textarea class="cf-in" id="cfR" maxlength="300"></textarea>` : ""}${typeWord ? `<label class="cf-lb" for="cfY">TYPE <b style="color:${c}">${esc(typeWord)}</b> TO CONFIRM</label><input class="cf-in" id="cfY" autocomplete="off">` : ""}${o.warn ? `<div class="cf-warn">${esc(o.warn)}</div>` : ""}</div>
      <div class="cf-f"><span class="cf-key">ENTER = ${one ? "OK" : "CONFIRM"} · ESC = ${one ? "CLOSE" : "CANCEL"}</span>${one ? "" : `<button class="cf-btn" data-cf="no">${esc(o.cancel || "CANCEL")}</button>`}<button class="cf-btn go" data-cf="go">${esc(o.go || (one ? "OK" : "CONFIRM"))}</button></div></div>`;
    document.body.appendChild(ov);
    const go = ov.querySelector('[data-cf="go"]'), no = ov.querySelector('[data-cf="no"]');
    const r = ov.querySelector("#cfR"), y = ov.querySelector("#cfY");
    const check = () => (go.disabled = (r && r.value.trim().length < 3) || (y && y.value.trim().toUpperCase() !== typeWord));
    check();
    const done = (val) => {
      document.removeEventListener("keydown", key, true);
      ov.remove();
      prev?.focus?.();
      resolve(val);
    };
    const yes = () => !go.disabled && done(kind === "reason" ? r.value.trim() : true);
    const nope = () => done(kind === "reason" ? null : one ? true : false);
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); nope(); }
      else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target !== no) { e.preventDefault(); e.stopPropagation(); yes(); }
      else if (e.key === "Tab") { // keep focus inside
        const f = [...ov.querySelectorAll("button:not(:disabled),input,textarea")];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key, true);
    ov.addEventListener("input", check);
    go.onclick = yes;
    if (no) no.onclick = nope;
    ov.addEventListener("click", (e) => { if (e.target === ov && kind !== "big") nope(); });
    setTimeout(() => (r || y || (safe && no) || go).focus(), 20);
  });
}
/** One-button notice (replaces alert()). */
export const tell = (title, body, kind = "info") => ask({ kind: "info", title, body, go: "OK", ...(kind === "error" ? { color: "#ff4d4d", icon: "!" } : {}) }).then(() => {});
// The original page (legacy code) can use the same pop-ups.
window.cf = { ask, tell };
/** For the original page: turn an old confirm("TITLE?\n\nbody") message into the new pop-up. */
window.cfConfirm = (msg, opts = {}) => {
  const [first, ...rest] = String(msg).split("\n");
  const body = rest.join("\n").trim();
  const danger = /DELETE|REMOVE|CLEAR|RESET|PERMANENT/i.test(msg);
  const go = opts.go || (first.match(/^(DELETE|REMOVE|CLEAR|RESET|UNLOCK|SUSPEND|REINSTATE|MIGRATE|BACKFILL|ASSIGN|FORCE)/i)?.[1] || "CONFIRM").toUpperCase();
  return ask({ kind: opts.kind || (danger ? "danger" : "warn"), title: first.trim().toUpperCase(), body, warn: /cannot be undone|permanent/i.test(msg) ? "THIS CANNOT BE UNDONE." : "", go, ...opts });
};
