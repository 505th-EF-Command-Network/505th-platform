/**
 * TOP BAR v2 (approved mock 2026-11-10): breadcrumb, search (Ctrl+K), alerts bell,
 * messages, and the "me" menu with the hex profile picture + logout confirm.
 * The original top-bar buttons stay in the page (hidden) so the original code
 * (message badge, notification listener) keeps running; we mirror their state.
 */
import { onAuthStateChanged } from "/terminal-shim/auth.js";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, auth, db, esc, getMe, hexAvatar, onReady, toDate } from "./_common.js";

const TYPE_ICON = { note: ["✎", "#00D9FF"], message: ["✉", "#00D9FF"], promotion: ["▲", "#f59e0b"], event: ["⚑", "#22e07a"], bct: ["✚", "#a78bfa"], staff: ["★", "#f59e0b"], sitrep: ["✉", "#f59e0b"], warning: ["⚠", "#ff4d4d"] };
const CMD_TYPES = new Set(["sitrep", "staff", "warning", "bct"]);

addCss("tb2", `
.top-bar-right>*:not(.tb2){display:none!important}
.main-content{position:relative;z-index:0}
@media(min-width:769px){#sidebar{z-index:5}}
.nav-tip{z-index:1000!important}
.tb2{display:flex;align-items:center;gap:6px;font-family:'Share Tech Mono',monospace}
.tb2-crumb{font-size:10px;letter-spacing:2px;color:#7d8a99;margin-right:8px;white-space:nowrap}.tb2-crumb b{color:#00D9FF;font-weight:400}
.tb2-search{display:flex;align-items:center;gap:8px;height:32px;min-width:220px;padding:0 10px;border:1px solid rgba(0,217,255,.25);background:rgba(0,0,0,.3);color:#7d8a99;font:inherit;font-size:10px;letter-spacing:1.5px;cursor:pointer}
.tb2-search kbd{margin-left:auto;border:1px solid rgba(255,255,255,.15);padding:0 4px;font-size:9px}
.tb2-ib{position:relative;width:36px;height:34px;border:1px solid rgba(0,217,255,.25);background:none;color:#00D9FF;font-size:15px;cursor:pointer}
.tb2-ib:hover,.tb2-ib[aria-expanded=true],.tb2-ib.on{background:rgba(0,217,255,.08);border-color:#00D9FF}
.tb2-badge{position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#ef4444;color:#fff;font-size:9px;line-height:17px;font-family:Rajdhani,sans-serif;font-weight:700}
.tb2-me{display:flex;align-items:center;gap:8px;height:38px;padding:0 8px 0 4px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font:inherit}
.tb2-me:hover,.tb2-me[aria-expanded=true]{border-color:rgba(0,217,255,.35)}
.tb2-me b{display:block;font-family:Rajdhani,sans-serif;font-size:12px;letter-spacing:1.5px;color:#e0e0e0;text-align:left}.tb2-me small{display:block;font-size:8.5px;letter-spacing:1.5px;color:#f59e0b;text-align:left}
.tb2-dd{position:fixed;top:56px;z-index:600;background:#0b0f15;border:1px solid rgba(0,217,255,.35);box-shadow:0 12px 40px rgba(0,0,0,.6);font-family:'Share Tech Mono',monospace}
.tb2-dd[hidden]{display:none}
.tb2-al{right:120px;width:380px;max-height:70vh;display:flex;flex-direction:column}
.tb2-alh{display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(0,217,255,.15)}.tb2-alh b{font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}
.tb2-lnk{margin-left:auto;background:none;border:0;color:#7d8a99;font:inherit;font-size:9.5px;letter-spacing:1.5px;cursor:pointer}.tb2-lnk:hover{color:#00D9FF}
.tb2-tabs{display:flex;border-bottom:1px solid rgba(0,217,255,.1)}.tb2-tabs button{flex:1;padding:7px;background:none;border:0;border-bottom:2px solid transparent;color:#7d8a99;font:inherit;font-size:9.5px;letter-spacing:2px;cursor:pointer}.tb2-tabs button.on{color:#00D9FF;border-color:#00D9FF}
.tb2-list{overflow-y:auto;flex:1}
.tb2-it{display:flex;gap:10px;width:100%;text-align:left;padding:10px 12px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.04);color:inherit;font:inherit;cursor:pointer}
.tb2-it:hover{background:rgba(0,217,255,.05)}.tb2-it.un{background:rgba(0,217,255,.04)}
.tb2-ic{width:28px;height:28px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--c);color:var(--c);font-size:12px}
.tb2-it b{display:block;font-size:11px;color:#e0e0e0;font-weight:400;letter-spacing:.5px}.tb2-it small{display:block;font-size:9.5px;color:#7d8a99;margin-top:2px;line-height:1.4}
.tb2-dot{width:7px;height:7px;border-radius:50%;background:#00D9FF;margin-top:4px;flex-shrink:0}
.tb2-empty{padding:28px;text-align:center;font-size:10px;letter-spacing:2px;color:#555}
.tb2-mm{right:12px;width:230px;padding:6px 0}
.tb2-mm a,.tb2-mm button{display:flex;gap:10px;width:100%;padding:9px 14px;background:none;border:0;color:#d6dde6;font:inherit;font-size:10.5px;letter-spacing:1.5px;text-decoration:none;cursor:pointer;text-align:left}
.tb2-mm a:hover,.tb2-mm button:hover{background:rgba(0,217,255,.07);color:#00D9FF}.tb2-mm hr{border:0;border-top:1px solid rgba(255,255,255,.06);margin:4px 0}.tb2-mm .red:hover{color:#ef4444;background:rgba(239,68,68,.07)}
.tb2-k{position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.6);display:flex;justify-content:center;padding-top:12vh}.tb2-k[hidden]{display:none}
.tb2-kb{width:520px;max-width:92vw;background:#0b0f15;border:1px solid rgba(0,217,255,.4);align-self:flex-start}
.tb2-kb input{width:100%;padding:14px 16px;background:none;border:0;border-bottom:1px solid rgba(0,217,255,.2);color:#e0e0e0;font:inherit;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none}
.tb2-kb ul{list-style:none;margin:0;padding:4px 0;max-height:50vh;overflow-y:auto}.tb2-kb li button{width:100%;text-align:left;padding:9px 16px;background:none;border:0;color:#d6dde6;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer}
.tb2-kb li button.sel,.tb2-kb li button:hover{background:rgba(0,217,255,.08);color:#00D9FF}.tb2-kb li small{color:#7d8a99;margin-left:8px;font-size:9px;letter-spacing:2px}
.tb2-lo{position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.65);display:grid;place-items:center}.tb2-lo[hidden]{display:none}
.tb2-lob{width:400px;max-width:92vw;background:#0b0f15;border:1px solid rgba(239,68,68,.45);padding:20px 22px;font-family:'Share Tech Mono',monospace}
.tb2-lob h3{margin:0 0 8px;font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#ef4444}.tb2-lob p{font-size:11px;color:#aeb9c4;line-height:1.6}
.tb2-lob label{display:flex;gap:8px;align-items:center;font-size:10.5px;color:#d6dde6;margin:12px 0 18px}
.tb2-lob .row{display:flex;gap:8px;justify-content:flex-end}.tb2-lob button{min-height:34px;padding:0 16px;font:inherit;font-size:10.5px;letter-spacing:2px;cursor:pointer;background:none;border:1px solid rgba(255,255,255,.25);color:#d6dde6}
.tb2-lob button.go{background:#ef4444;border-color:#ef4444;color:#fff}
.tb2 button:focus-visible,.tb2-dd button:focus-visible,.tb2-dd a:focus-visible{outline:2px solid #00D9FF;outline-offset:1px}
@media(max-width:900px){.tb2-crumb,.tb2-search span,.tb2-me div{display:none}.tb2-search{min-width:0}.tb2-al{right:8px;left:8px;width:auto}}
`);

let uid = null;
let alerts = [];
let tab = "all";

const $ = (s) => document.querySelector(s);
const ago = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d)) return "";
  const s = (Date.now() - d) / 1000;
  return s < 60 ? "NOW" : s < 3600 ? `${Math.floor(s / 60)}M AGO` : s < 86400 ? `${Math.floor(s / 3600)}H AGO` : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
};

function closeAll(except) {
  document.querySelectorAll(".tb2-dd").forEach((d) => d !== except && (d.hidden = true));
  document.querySelectorAll(".tb2 [aria-expanded]").forEach((b) => b.getAttribute("aria-controls") !== except?.id && b.setAttribute("aria-expanded", "false"));
}
function toggle(btn, dd) {
  const open = dd.hidden;
  closeAll(open ? dd : null);
  dd.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}

function renderAlerts() {
  const un = alerts.filter((a) => !a.read).length;
  const b = $("#tb2AlBadge");
  b.hidden = !un;
  b.textContent = un > 9 ? "9+" : un;
  const list = alerts.filter((a) => (tab === "all" ? true : tab === "mention" ? a.type === "message" || /@/.test(a.body || "") : CMD_TYPES.has(a.type)));
  $("#tb2AlList").innerHTML = list.length
    ? list
        .map((a) => {
          const [ic, c] = TYPE_ICON[a.type] || ["◆", "#7d8a99"];
          return `<button class="tb2-it ${a.read ? "" : "un"}" data-id="${a.id}"><span class="tb2-ic" style="--c:${c}" aria-hidden="true">${ic}</span><span style="flex:1;min-width:0"><b>${esc(a.title || "Alert")}</b><small>${esc(a.body || "")}</small><small>${ago(a.createdAt)}</small></span>${a.read ? "" : '<span class="tb2-dot" aria-label="Unread"></span>'}</button>`;
        })
        .join("")
    : '<div class="tb2-empty">NO ALERTS</div>';
}

function groupName(el) {
  const h = el?.closest(".nav-item")?.querySelector(".nav-header");
  if (!h) return "";
  const c = h.cloneNode(true);
  c.querySelectorAll(".nav-icon,.arrow,.nav-tip").forEach((x) => x.remove());
  return c.textContent.replace(/[^A-Za-z0-9 &]/g, "").trim();
}
function searchItems() {
  return [...document.querySelectorAll("#sidebar .sub-link[data-panel]")]
    .filter((l) => l.style.display !== "none")
    .map((l) => ({ panel: l.dataset.panel, label: l.textContent.trim(), group: groupName(l) }));
}
function openSearch() {
  const k = $("#tb2K");
  k.hidden = false;
  const inp = k.querySelector("input");
  inp.value = "";
  drawSearch();
  inp.focus();
}
let sel = 0;
function drawSearch() {
  const q = $("#tb2K input").value.toLowerCase();
  const items = searchItems().filter((i) => !q || i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q));
  sel = Math.min(sel, Math.max(0, items.length - 1));
  $("#tb2K ul").innerHTML = items.length
    ? items.map((i, n) => `<li><button class="${n === sel ? "sel" : ""}" data-panel="${i.panel}">${esc(i.label)}<small>${esc(i.group)}</small></button></li>`).join("")
    : '<li class="tb2-empty">NOTHING FOUND</li>';
}
function go(panel) {
  $("#tb2K").hidden = true;
  if (typeof window.showPanel === "function") window.showPanel(panel);
}

function crumb() {
  const vis = [...document.querySelectorAll(".panel")].find((p) => !p.classList.contains("hidden"));
  const title = (vis?.querySelector(".panel-title") || vis?.querySelector(".h1"))?.textContent?.trim() || "DASHBOARD";
  const link = vis && document.querySelector(`#sidebar .sub-link[data-panel="${vis.id}"]`);
  const group = link && groupName(link);
  $("#tb2Crumb").innerHTML = `TERMINAL / ${group ? esc(group) + " / " : ""}<b>${esc(title.replace(/_$/, ""))}</b>`;
}

function build() {
  const right = document.querySelector(".top-bar-right");
  if (!right || right.querySelector(".tb2")) return;
  const wrap = document.createElement("div");
  wrap.className = "tb2";
  wrap.innerHTML = `
    <span class="tb2-crumb" id="tb2Crumb"></span>
    <button class="tb2-search" id="tb2Search" aria-label="Search the terminal (Ctrl+K)">⌕ <span>SEARCH TERMINAL</span><kbd>CTRL K</kbd></button>
    <button class="tb2-ib" id="tb2Bell" aria-label="Alerts" aria-haspopup="true" aria-expanded="false" aria-controls="tb2Al">🔔<span class="tb2-badge" id="tb2AlBadge" hidden></span></button>
    <button class="tb2-ib" id="tb2Msg" aria-label="Open or close messages">✉<span class="tb2-badge" id="tb2MsgBadge" hidden></span></button>
    <button class="tb2-me" id="tb2Me" aria-haspopup="true" aria-expanded="false" aria-controls="tb2Mm"><span id="tb2MeHex"></span><div><b id="tb2MeName">—</b><small id="tb2MeRole"></small></div></button>`;
  right.appendChild(wrap);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="tb2-dd tb2-al" id="tb2Al" hidden role="dialog" aria-label="Alerts">
      <div class="tb2-alh"><b>ALERTS</b><button class="tb2-lnk" id="tb2AlRead">✓ MARK ALL READ</button></div>
      <div class="tb2-tabs" role="tablist"><button class="on" data-t="all">ALL</button><button data-t="mention">MENTIONS</button><button data-t="cmd">COMMAND</button></div>
      <div class="tb2-list" id="tb2AlList"><div class="tb2-empty">LOADING…</div></div>
      <div class="tb2-alh" style="border:0;border-top:1px solid rgba(0,217,255,.15)"><a class="tb2-lnk" style="margin:0;text-decoration:none" href="/profile?tab=notif">⚙ ALERT SETTINGS</a></div>
    </div>
    <div class="tb2-dd tb2-mm" id="tb2Mm" hidden role="menu">
      <a href="/profile" role="menuitem">♟ MY PROFILE</a><a href="/profile?tab=pfp" role="menuitem">⬢ CHANGE PICTURE</a><a href="/profile?tab=notif" role="menuitem">🔔 ALERT SETTINGS</a>
      <hr><a href="/home" role="menuitem">⌂ VIEW WEBSITE</a><a href="/resources-roster" role="menuitem">☰ ROSTER</a>
      <hr><button class="red" id="tb2Out" role="menuitem">⏻ LOG OUT</button>
    </div>
    <div class="tb2-k" id="tb2K" hidden><div class="tb2-kb" role="dialog" aria-label="Search"><input placeholder="Search pages…" aria-label="Search pages"><ul></ul></div></div>
    <div class="tb2-lo" id="tb2Lo" hidden><form class="tb2-lob" role="dialog" aria-labelledby="tb2LoT" method="post" action="/api/auth/logout">
      <h3 id="tb2LoT">⏻ LOG OUT?</h3><p>You will need to sign in with Discord again.</p>
      <label><input type="checkbox" name="all" value="1"> Also sign out on all my other devices</label>
      <div class="row"><button type="button" id="tb2LoNo">CANCEL</button><button class="go" type="submit">LOG OUT</button></div></form></div>`
  );

  $("#tb2Bell").onclick = (e) => { e.stopPropagation(); toggle($("#tb2Bell"), $("#tb2Al")); };
  $("#tb2Me").onclick = (e) => { e.stopPropagation(); toggle($("#tb2Me"), $("#tb2Mm")); };
  new MutationObserver(() => $("#tb2Msg").classList.toggle("on", !document.getElementById("panel-msg2")?.classList.contains("hidden"))).observe(document.querySelector(".main-content") || document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  $("#tb2Msg").onclick = () => { closeAll(); window.openMessagesV2 ? window.openMessagesV2() : window.toggleMsgPanel?.(); };
  $("#tb2Search").onclick = openSearch;
  $("#tb2Out").onclick = () => { closeAll(); $("#tb2Lo").hidden = false; $("#tb2LoNo").focus(); };
  $("#tb2LoNo").onclick = () => ($("#tb2Lo").hidden = true);
  document.addEventListener("click", (e) => { if (!e.target.closest(".tb2-dd")) closeAll(); });
  document.querySelectorAll(".tb2-dd").forEach((d) => d.addEventListener("click", (e) => e.stopPropagation()));
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") { closeAll(); $("#tb2K").hidden = true; $("#tb2Lo").hidden = true; }
  });
  const kIn = $("#tb2K input");
  kIn.oninput = () => { sel = 0; drawSearch(); };
  kIn.onkeydown = (e) => {
    const n = $("#tb2K ul").querySelectorAll("button").length;
    if (e.key === "ArrowDown") { sel = (sel + 1) % Math.max(n, 1); drawSearch(); e.preventDefault(); }
    if (e.key === "ArrowUp") { sel = (sel - 1 + n) % Math.max(n, 1); drawSearch(); e.preventDefault(); }
    if (e.key === "Enter") { const b = $("#tb2K ul button.sel"); if (b) go(b.dataset.panel); }
  };
  $("#tb2K").onclick = (e) => { const b = e.target.closest("button[data-panel]"); if (b) go(b.dataset.panel); else if (e.target.id === "tb2K") $("#tb2K").hidden = true; };
  $("#tb2Lo").onclick = (e) => { if (e.target.id === "tb2Lo") $("#tb2Lo").hidden = true; };

  document.querySelectorAll("#tb2Al .tb2-tabs button").forEach((b) => (b.onclick = () => {
    tab = b.dataset.t;
    document.querySelectorAll("#tb2Al .tb2-tabs button").forEach((x) => x.classList.toggle("on", x === b));
    renderAlerts();
  }));
  $("#tb2AlList").onclick = async (e) => {
    const it = e.target.closest(".tb2-it");
    if (!it || !uid) return;
    const a = alerts.find((x) => x.id === it.dataset.id);
    if (a && !a.read) { a.read = true; renderAlerts(); updateDoc(doc(db, "notifications", uid, "items", a.id), { read: true }).catch(() => {}); }
    if (a?.type === "note" && a.noteId) { closeAll(); window.dispatchEvent(new CustomEvent("ws:open", { detail: { kind: "note", id: a.noteId } })); }
    if (a?.type === "message") { closeAll(); window.openMessagesV2 ? window.openMessagesV2(a.convId) : window.toggleMsgPanel?.(); }
  };
  $("#tb2AlRead").onclick = async () => {
    const un = alerts.filter((a) => !a.read);
    un.forEach((a) => (a.read = true));
    renderAlerts();
    await Promise.all(un.map((a) => updateDoc(doc(db, "notifications", uid, "items", a.id), { read: true }).catch(() => {})));
  };

  // Mirror the original messages badge.
  const ob = document.getElementById("msgUnreadBadge");
  const mirror = () => { const mb = $("#tb2MsgBadge"); const show = ob && ob.style.display !== "none" && ob.textContent !== "0"; mb.hidden = !show; mb.textContent = ob?.textContent || ""; };
  if (ob) new MutationObserver(mirror).observe(ob, { attributes: true, childList: true, characterData: true, subtree: true });
  mirror();

  // Breadcrumb follows the visible panel.
  new MutationObserver(crumb).observe(document.querySelector(".main-content") || document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  crumb();
}

async function start(user) {
  if (!user || uid) return;
  uid = user.uid;
  // Sync the Discord picture on load (keeps photoUrl fresh everywhere).
  fetch("/api/me/profile", { cache: "no-store" }).catch(() => {});
  const me = await getMe().catch(() => null);
  if (me) {
    $("#tb2MeHex").innerHTML = hexAvatar(me, "sm");
    $("#tb2MeName").textContent = [me.callsign || me.firstName || ""].join(" ").toUpperCase() || "ME";
    $("#tb2MeRole").textContent = String(me.rank || "").split("/").pop().trim().toUpperCase();
  }
  onSnapshot(query(collection(db, "notifications", uid, "items"), orderBy("createdAt", "desc"), limit(30)), (snap) => {
    alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAlerts();
  });
}

onReady(() => {
  build();
  onAuthStateChanged(auth, (u) => start(u));
});
