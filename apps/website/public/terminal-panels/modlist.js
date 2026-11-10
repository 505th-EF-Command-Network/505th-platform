/**
 * DISCORD → Modlist. Access: "set" (Developer / Command). Same as /modlist in Discord.
 * Import the Arma 3 Launcher preset (.html) → preview (🆕 added / 🗑 removed vs the last list) + extra message
 * → Cortana posts it in the Aux Mod channel with a clean preset file to download.
 * The file is read in the browser; only mod names + Workshop IDs are sent.
 */
import { doc, onSnapshot } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, db, esc, mountPanel, notify, onReady } from "./_common.js";
import { cortanaJob, ukTime } from "./discord-common.js";

let cur = null, next = null, note = "", fileName = "", acc = {}, root = null, busy = false, unsub = null, showAll = false;

function parsePreset(html) {
  const d = new DOMParser().parseFromString(html, "text/html");
  const presetName = (d.querySelector('meta[name="arma:PresetName"]')?.getAttribute("content") || "505th Modlist").trim().slice(0, 100);
  const mods = [], seen = new Set();
  for (const tr of d.querySelectorAll('tr[data-type="ModContainer"]')) {
    const name = (tr.querySelector('[data-type="DisplayName"]')?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const id = ((tr.querySelector('a[href*="filedetails"]')?.getAttribute("href") || "").match(/id=(\d+)/) || [])[1];
    if (name && id && !seen.has(id)) { seen.add(id); mods.push({ name, id }); }
  }
  return { mods, presetName };
}
const diff = () => {
  if (!next || !cur?.mods) return null;
  const a = new Set(cur.mods.map((m) => m.id)), b = new Set(next.mods.map((m) => m.id));
  return { added: next.mods.filter((m) => !a.has(m.id)), removed: cur.mods.filter((m) => !b.has(m.id)) };
};
const ws = (m) => `https://steamcommunity.com/sharedfiles/filedetails/?id=${encodeURIComponent(m.id)}`;
const modRow = (m, n, cls = "") => `<li class="${cls}"><span class="n">${String(n + 1).padStart(2, "0")}</span><a href="${ws(m)}" target="_blank" rel="noopener">${esc(m.name)}</a></li>`;

function draw() {
  if (!acc.set) { root.innerHTML = '<div class="panel-title">MODLIST</div><div class="empty">Only Developers / Command can post the modlist. Members can use /modlist in Discord.</div>'; return; }
  const d = diff(), list = next?.mods || cur?.mods || [];
  root.innerHTML = `<div class="panel-title">MODLIST</div><div class="ml-sub">IMPORT THE ARMA 3 LAUNCHER PRESET → CHECK WHAT CHANGED → CORTANA POSTS IT WITH A PRESET TO DOWNLOAD · SAME AS /modlist IN DISCORD</div>
  <div class="ml-g"><div class="ml-card">
    <label class="ml-drop" tabindex="0" id="mlDrop"><input type="file" id="mlFile" accept=".html,.htm,text/html" hidden>
      ⇪ ${fileName ? esc(fileName) : "DROP THE PRESET .HTML HERE"}<br><small>Arma 3 Launcher → Mods → Preset → … → Export to file</small></label>
    ${next ? `<div class="ml-ok">✓ ${next.mods.length} MODS IN “${esc(next.presetName)}”</div>` : ""}
    ${d ? `<div class="ml-2"><div class="ml-box ad"><b>🆕 ADDED (${d.added.length})</b>${d.added.length ? `<ul>${d.added.map((m) => `<li>${esc(m.name)}</li>`).join("")}</ul>` : "<p>—</p>"}</div>
      <div class="ml-box rm"><b>🗑 REMOVED (${d.removed.length})</b>${d.removed.length ? `<ul>${d.removed.map((m) => `<li>${esc(m.name)}</li>`).join("")}</ul>` : "<p>—</p>"}</div></div>` : next && !cur ? '<p class="ml-n">FIRST MODLIST — NOTHING TO COMPARE WITH YET.</p>' : ""}
    <label class="lbl" for="mlNote">EXTRA MESSAGE (OPTIONAL)</label><textarea class="fld" id="mlNote" rows="3" maxlength="1500" placeholder="e.g. Added JSG uniforms, removed the old Pelican pack. Update before Saturday's op!">${esc(note)}</textarea>
    <div class="ml-n" id="mlCnt" style="text-align:right">${note.length} / 1500</div>
    <div class="ml-ft"><span class="ml-n">POSTS IN THE AUX MOD CHANNEL (CORTANA SETUP)</span><button class="b gold" data-x="post" ${!next || busy ? "disabled" : ""}>${busy ? "POSTING…" : next ? `POST ${next.mods.length} MODS` : "IMPORT A PRESET FIRST"}</button></div>
  </div>
  <div class="ml-card"><div class="ml-hd"><b>${next ? "NEW LIST (PREVIEW)" : "CURRENT LIST"}</b><span class="ml-n">${cur?.updatedAtISO ? `LAST POSTED ${esc(ukTime(cur.updatedAtISO))} BY ${esc(cur.byName || "—")}${cur.jumpUrl ? ` · <a href="${esc(cur.jumpUrl)}" target="_blank" rel="noopener">OPEN IN DISCORD ↗</a>` : ""}` : "NOTHING POSTED YET"}</span></div>
    ${list.length ? `<ol class="ml-list">${(showAll ? list : list.slice(0, 40)).map((m, n) => modRow(m, n, d?.added.some((x) => x.id === m.id) ? "new" : "")).join("")}</ol>${list.length > 40 ? `<button class="b" data-x="all">${showAll ? "SHOW LESS" : `SHOW ALL ${list.length}`}</button>` : ""}` : '<div class="empty">No mods yet.</div>'}
    ${next ? '<div style="margin-top:10px"><button class="b" data-x="clear">✕ CLEAR IMPORT</button></div>' : ""}</div></div>`;
}

async function read(file) {
  if (!file) return;
  if (!/\.html?$/i.test(file.name) || file.size > 2_000_000) return notify("PICK THE ARMA 3 LAUNCHER PRESET (.HTML, UNDER 2 MB)", 1);
  const p = parsePreset(await file.text());
  if (!p.mods.length) return notify("NO MODS FOUND — IS THIS AN ARMA 3 LAUNCHER PRESET?", 1);
  next = p; fileName = file.name; showAll = false;
  draw();
}
async function post() {
  const d = diff();
  if (!(await ask({ kind: "ok", title: `POST ${next.mods.length} MODS?`, body: d ? `🆕 ${d.added.length} added · 🗑 ${d.removed.length} removed. Cortana posts it in the Aux Mod channel.` : "Cortana posts it in the Aux Mod channel.", go: "POST", cancel: "CANCEL" }))) return;
  busy = true; draw();
  try {
    const r = await cortanaJob("modlist.post", { mods: next.mods, presetName: next.presetName, note: note.trim() }, { ms: 30000 });
    notify(r ? "✓ MODLIST POSTED" : "◷ CORTANA IS OFFLINE — POSTED WHEN IT'S BACK", !r);
    if (r) { next = null; note = ""; fileName = ""; }
  } catch (e) { notify("FAILED: " + e.message, 1); }
  busy = false; draw();
}

function wire() {
  root.addEventListener("change", (e) => { if (e.target.id === "mlFile") { read(e.target.files[0]); e.target.value = ""; } });
  root.addEventListener("input", (e) => { if (e.target.id === "mlNote") { note = e.target.value; const c = root.querySelector("#mlCnt"); if (c) c.textContent = `${note.length} / 1500`; } });
  root.addEventListener("keydown", (e) => { if (e.target.id === "mlDrop" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); root.querySelector("#mlFile").click(); } });
  root.addEventListener("dragover", (e) => { const d = e.target.closest("#mlDrop"); if (d) { e.preventDefault(); d.classList.add("over"); } });
  root.addEventListener("dragleave", (e) => e.target.closest("#mlDrop")?.classList.remove("over"));
  root.addEventListener("drop", (e) => { const d = e.target.closest("#mlDrop"); if (!d) return; e.preventDefault(); d.classList.remove("over"); read(e.dataTransfer.files[0]); });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x]"); if (!b) return;
    if (b.dataset.x === "post") post();
    if (b.dataset.x === "all") { showAll = !showAll; draw(); }
    if (b.dataset.x === "clear") { next = null; fileName = ""; draw(); }
  });
}

const CSS = `
#modlistV2 .ml-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#modlistV2 .ml-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
#modlistV2 .ml-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#modlistV2 .ml-drop{display:block;border:1px dashed #00D9FF;padding:24px;text-align:center;font:12px monospace;letter-spacing:1px;cursor:pointer}#modlistV2 .ml-drop small{color:#6f8a96}#modlistV2 .ml-drop.over,#modlistV2 .ml-drop:focus-visible{background:rgba(0,217,255,.08);outline:none}
#modlistV2 .ml-ok{color:#22e07a;font:700 12px monospace;letter-spacing:1px;margin-top:10px}
#modlistV2 .ml-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
#modlistV2 .ml-box{border:1px solid;padding:8px 10px;max-height:180px;overflow:auto}#modlistV2 .ml-box.ad{border-color:rgba(34,224,122,.4)}#modlistV2 .ml-box.rm{border-color:rgba(255,77,77,.4)}
#modlistV2 .ml-box b{font:700 11px monospace;letter-spacing:1px}#modlistV2 .ml-box.ad b{color:#22e07a}#modlistV2 .ml-box.rm b{color:#ff4d4d}#modlistV2 .ml-box ul{margin:6px 0 0;padding-left:16px;font-size:13px}#modlistV2 .ml-box p{margin:6px 0 0;color:#6f8a96}
#modlistV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:12px 0 6px}
#modlistV2 .ml-n{color:#6f8a96;font:10px monospace;letter-spacing:1px}#modlistV2 .ml-n a{color:#00D9FF}
#modlistV2 .ml-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px}
#modlistV2 .ml-hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}#modlistV2 .ml-hd b{font:700 12px monospace;letter-spacing:2px}
#modlistV2 .ml-list{list-style:none;margin:0 0 10px;padding:0;columns:2;column-gap:18px;font-size:13px}#modlistV2 .ml-list li{break-inside:avoid;padding:3px 0;display:flex;gap:8px}#modlistV2 .ml-list .n{color:#6f8a96;font:11px monospace}#modlistV2 .ml-list a{color:#cfe9f2;text-decoration:none}#modlistV2 .ml-list a:hover{color:#00D9FF;text-decoration:underline}#modlistV2 .ml-list li.new a{color:#22e07a}#modlistV2 .ml-list li.new a:after{content:" NEW";font:9px monospace;color:#22e07a}
@media(max-width:1000px){#modlistV2 .ml-g{grid-template-columns:1fr}#modlistV2 .ml-list{columns:1}}
`;

onReady(() => {
  addCss("modlist-v2", CSS);
  onAccess((me) => { acc = me?.access || {}; if (root) draw(); });
  root = mountPanel("panel-modlist", "modlistV2", () => {
    if (!unsub) unsub = onSnapshot(doc(db, "bot_state", "modlist"), (s) => { cur = s.exists() ? s.data() : null; if (!busy && !root.contains(document.activeElement)) draw(); }, () => {});
    draw();
  });
  if (root) wire();
});
