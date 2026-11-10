/**
 * AUDIT LOG v2 (approved mock 2026-11-10) — #panel-auditv2 (Security → Audit Log).
 * One page for every area + the Discord server (via Cortana v2).
 * Data comes from /api/terminal/audit (both audit formats, retention purge).
 * Delete: Commander / Officer / Developer only, needs a reason + typed DELETE,
 * and the server adds a locked "ENTRIES DELETED" record that can't be removed.
 */
import { doc, setDoc } from "/terminal-shim/firestore.js";
import { addCss, closeModal, db, esc, mountPanel, notify, onReady, openModal } from "./_common.js";

const ROOT = "auditV2";
const AREAS = {
  manpower: ["MANPOWER", "#00D9FF"], operations: ["OPERATIONS", "#22e07a"], discord: ["DISCORD", "#a78bfa"],
  workspace: ["WORKSPACE", "#7dd3fc"], security: ["SECURITY", "#ff4d4d"], command: ["COMMAND", "#f59e0b"], server: ["DISCORD SERVER", "#5865F2"],
};
// Old section names → new areas.
const AREA_OF = {
  manpower: "manpower", battalion_ops: "operations", operations: "operations", intel: "operations",
  public_comms: "workspace", workspace: "workspace", discord: "discord", discord_network: "command",
  commander: "command", command: "command", security: "security",
};
const SENSITIVE = /ROLE|ACCESS|DELET|SUSPEND|REINSTATE|RESTART|\bBAN\b|KICK|SETTING|WEBHOOK|PROMOT|COMMANDER|UNLOCK|RETENTION/i;

let all = [];
let meta = { canDelete: false, canRetention: false, retentionDays: 90 };
let src = "", area = "", q = "", who = "", days = 7, sensOnly = false, open = null;
const sel = new Set();

async function load() {
  const r = await fetch("/api/terminal/audit", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    document.querySelector(`#${ROOT} .body`).innerHTML = `<div class="empty">🔒 ${r.status === 403 ? "YOU DON'T HAVE AUDIT LOG ACCESS" : "COULD NOT LOAD THE AUDIT LOG"}</div>`;
    return;
  }
  all = j.entries.map((e) => ({ ...e, area: e.source === "discord" ? "server" : AREA_OF[e.section] || "command", sens: e.locked || SENSITIVE.test(e.action), atMs: e.at ? Date.parse(e.at) || 0 : 0 })).sort((a, b) => b.atMs - a.atMs);
  meta = j;
  sel.clear();
  render();
}

function shown() {
  const now = Date.now(), ql = q.toLowerCase();
  return all.filter(
    (x) =>
      (!src || x.source === src) && (!area || x.area === area) && (!who || x.by === who) && (days >= 9999 || now - x.atMs <= days * 86400000) && (!sensOnly || x.sens) &&
      (x.action + " " + x.details + " " + x.by).toLowerCase().includes(ql),
  );
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const now = Date.now(), wk = all.filter((x) => now - x.atMs <= 7 * 86400000);
  const today = new Date().toDateString();
  const list = shown();
  const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", timeZone: "Europe/London" }).toUpperCase();
  const fmtT = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const staff = [...new Set(all.map((x) => x.by))].sort();
  const serverCount = all.filter((x) => x.source === "discord").length;
  let rows = "", last = "";
  for (const x of list.slice(0, 600)) {
    const d = x.atMs ? fmtDay(x.atMs) : "UNKNOWN DATE";
    if (d !== last) (rows += `<tr class="day"><td colspan="7">${d}</td></tr>`), (last = d);
    const [al, ac] = AREAS[x.area];
    rows += `<tr class="r ${sel.has(x.id) ? "sel" : ""} ${x.locked ? "lockr" : ""}" data-row="${esc(x.id)}">
      ${meta.canDelete ? `<td class="cb">${x.locked ? '<span title="Deletion records can\'t be deleted">🔒</span>' : `<input type="checkbox" data-sel="${esc(x.id)}" ${sel.has(x.id) ? "checked" : ""} aria-label="Select ${esc(x.action)}">`}</td>` : ""}
      <td class="tm">${x.atMs ? fmtT(x.atMs) : "—"}</td><td><span class="area" style="--c:${ac}">${al}</span></td>
      <td class="act">${x.sens ? '<span class="sx" title="Sensitive">⚠</span>' : ""}<b>${esc(x.action)}</b></td>
      <td class="det">${esc(x.details)}</td><td class="by"><b>${esc(x.by)}</b><small>${esc(String(x.role).toUpperCase())}</small>${x.source === "discord" ? '<span class="dsrc">◈ DISCORD</span>' : ""}</td><td class="dim">${open === x.id ? "▴" : "▾"}</td></tr>`;
    if (open === x.id)
      rows += `<tr class="exp"><td colspan="7"><div class="kv2"><span>WHEN</span><div>${x.atMs ? new Date(x.atMs).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—"}</div><span>AREA</span><div>${al}</div><span>ACTION</span><div>${esc(x.action)}</div><span>DETAILS</span><div style="white-space:pre-wrap">${esc(x.details) || "—"}</div><span>BY</span><div>${esc(x.by)} · ${esc(String(x.role).toUpperCase())}</div><span>ENTRY ID</span><div class="dim">${esc(x.id)}</div></div></td></tr>`;
  }
  const visIds = list.filter((x) => !x.locked).map((x) => x.id);
  root.querySelector(".body").innerHTML = `
    <div class="kp"><div><b>${all.filter((x) => x.atMs && new Date(x.atMs).toDateString() === today).length}</b><span>TODAY</span></div><div><b>${wk.length}</b><span>LAST 7 DAYS</span></div><div><b>${new Set(wk.map((x) => x.by)).size}</b><span>STAFF ACTIVE (7 DAYS)</span></div><div><b style="color:#ff4d4d">${wk.filter((x) => x.sens).length}</b><span>SENSITIVE (7 DAYS)</span></div></div>
    <div class="srcs">${[["", "ALL SOURCES"], ["terminal", "▣ COMMAND TERMINAL"], ["discord", "◈ DISCORD SERVER <small>VIA CORTANA</small>"]].map(([k, l]) => `<button class="${src === k ? "on" : ""}" data-src="${k}">${l}</button>`).join("")}</div>
    ${src === "discord" && !serverCount ? '<div class="note">◷ Discord server entries (joins / leaves, roles, nicknames, deleted / edited messages, channels, bans) arrive here once Cortana v2 is running.</div>' : ""}
    ${src !== "discord" ? `<div class="chips"><button class="ch ${!area ? "on" : ""}" style="--c:#c6d0da" data-area="">ALL<b>${all.filter((x) => x.source === "terminal").length}</b></button>${Object.entries(AREAS).filter(([k]) => k !== "server").map(([k, [l, c]]) => `<button class="ch ${area === k ? "on" : ""}" style="--c:${c}" data-area="${k}">${l}<b>${all.filter((x) => x.area === k).length}</b></button>`).join("")}</div>` : ""}
    <div class="ftr"><input class="srch" data-f="q" value="${esc(q)}" placeholder="SEARCH ACTION, DETAILS OR NAME..." aria-label="Search" style="min-width:300px">
      <select class="srch" data-f="who" aria-label="Staff member"><option value="">ALL STAFF</option>${staff.map((s) => `<option ${s === who ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select class="srch" data-f="days" aria-label="Date range">${[[1, "TODAY"], [7, "LAST 7 DAYS"], [30, "LAST 30 DAYS"], [9999, "ALL"]].map(([v, l]) => `<option value="${v}" ${v === days ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label class="ckl"><input type="checkbox" data-f="sens" ${sensOnly ? "checked" : ""}> ⚠ SENSITIVE ONLY</label><span style="flex:1"></span><span class="dim">${list.length} ENTRIES${list.length > 600 ? " (FIRST 600 SHOWN — NARROW THE FILTERS)" : ""}</span></div>
    <div class="bulk ${sel.size && meta.canDelete ? "show" : ""}"><span>${sel.size} SELECTED</span><span style="flex:1"></span><button class="b" data-act="clear">CLEAR</button><button class="b red" data-act="del">🗑 DELETE SELECTED</button></div>
    <table class="t"><thead><tr>${meta.canDelete ? `<th class="cb"><input type="checkbox" data-act="all" ${visIds.length && visIds.every((i) => sel.has(i)) ? "checked" : ""} aria-label="Select all shown"></th>` : ""}<th>TIME</th><th>AREA</th><th>ACTION</th><th>DETAILS</th><th>BY</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="empty">NO ENTRIES MATCH</td></tr>'}</tbody></table>
    <div class="hint">• <b>⚠ Sensitive</b> = role / access changes, deletes, suspensions, Cortana restarts, kicks / bans, settings.<br>
      • ${meta.canDelete ? "Every delete leaves a 🔒 locked \"ENTRIES DELETED\" record that can't be removed." : "Only Commander, Officer and Developer can delete entries."}<br>
      • Entries older than <b>${meta.retentionDays ? meta.retentionDays + " days" : "forever"}</b> are removed automatically (Command → Settings). Discord message text is private: Officer and above only.</div>`;
  root.querySelector(".ret").textContent = `⚙ RETENTION: ${meta.retentionDays ? meta.retentionDays + " DAYS" : "FOREVER"}`;
  root.querySelector(".ret").hidden = !meta.canRetention;
}

function exportCsv() {
  const list = shown();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["Time,Area,Action,Details,By,Role,Source", ...list.map((x) => [x.at, AREAS[x.area][0], x.action, x.details, x.by, x.role, x.source].map(cell).join(","))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `505th-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  notify(`⇩ EXPORTED ${list.length} ENTRIES`);
}

function openDel() {
  const n = sel.size;
  openModal(
    `<div class="hd"><div><h2 style="color:#ff4d4d">DELETE ${n} AUDIT ENTR${n === 1 ? "Y" : "IES"}</h2><small>PERMANENT</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><p style="font-size:12px;line-height:1.7;margin:0 0 12px">This permanently removes ${n} entr${n === 1 ? "y" : "ies"}. A locked <b style="color:#f59e0b">"ENTRIES DELETED"</b> record with your name, the count, the date range and your reason is kept — it can't be deleted.</p>
      <label class="lbl" for="adR">REASON *</label><input class="fld" id="adR" maxlength="300" placeholder="e.g. test entries from setup">
      <label class="lbl" for="adC">TYPE DELETE TO CONFIRM</label><input class="fld" id="adC" autocomplete="off"></div>
    <div class="ft"><span></span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b red" id="adGo" disabled>🗑 DELETE ${n}</button></div></div>`,
    { color: "rgba(255,77,77,.6)", title: "#ff4d4d", width: 560 },
  );
  const box = document.getElementById("v2Modal");
  const chk = () => (box.querySelector("#adGo").disabled = !(box.querySelector("#adR").value.trim().length >= 3 && box.querySelector("#adC").value === "DELETE"));
  box.addEventListener("input", chk);
  box.querySelector("#adGo").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const r = await fetch("/api/terminal/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...sel], reason: box.querySelector("#adR").value.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Delete failed");
      notify(`✓ ${j.deleted} DELETED — LOCKED RECORD ADDED`);
      closeModal();
      load();
    } catch (err) {
      notify("DELETE FAILED: " + err.message, 1);
      chk();
    }
  });
}

function openRet() {
  openModal(
    `<div class="hd"><div><h2>AUDIT LOG RETENTION</h2><small>COMMANDER / DEVELOPER</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><p style="font-size:12px;line-height:1.7;margin:0 0 12px">Entries older than this are removed automatically once a day. Locked "ENTRIES DELETED" records are kept for 1 year.</p>
      <label class="lbl" for="arS">KEEP ENTRIES FOR</label><select class="fld" id="arS">${[30, 90, 180, 365].map((d) => `<option value="${d}" ${d === meta.retentionDays ? "selected" : ""}>${d} DAYS${d === 90 ? " (RECOMMENDED)" : ""}</option>`).join("")}<option value="0" ${!meta.retentionDays ? "selected" : ""}>FOREVER</option></select>
      <p class="hint">Was: everything older than 7 days deleted each time someone opened the audit log.</p></div>
    <div class="ft"><span></span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" id="arGo">SAVE</button></div></div>`,
    { width: 520 },
  );
  document.getElementById("arGo").addEventListener("click", async () => {
    const v = +document.getElementById("arS").value;
    try {
      await setDoc(doc(db, "settings", "audit"), { retentionDays: v }, { merge: true });
      meta.retentionDays = v;
      closeModal();
      render();
      notify("✓ RETENTION SAVED");
    } catch (e) {
      notify("SAVE FAILED: " + e.message, 1);
    }
  });
}

const CSS = `
#${ROOT} .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}#${ROOT} .kp>div{border:1px solid var(--l);background:var(--p2);padding:12px;text-align:center}#${ROOT} .kp b{display:block;font-family:Rajdhani,sans-serif;font-size:24px;color:var(--a)}#${ROOT} .kp span{font-size:9px;letter-spacing:2px;color:var(--d)}
#${ROOT} .srcs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}#${ROOT} .srcs button{background:none;border:1px solid var(--l);color:var(--d);padding:9px 16px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:12px;cursor:pointer}#${ROOT} .srcs button.on{color:var(--a);border-color:var(--a);background:rgba(0,217,255,.06)}#${ROOT} .srcs small{font-family:'Share Tech Mono',monospace;font-weight:400;font-size:9px;color:var(--dd);margin-left:4px}
#${ROOT} .note{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.05);color:#f5c26b;padding:10px 14px;font-size:11.5px;margin-bottom:10px}
#${ROOT} .chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}#${ROOT} .ch{border:1px solid var(--l);background:none;color:var(--d);padding:7px 12px;font:inherit;font-size:10.5px;letter-spacing:1.5px;cursor:pointer}#${ROOT} .ch.on{border-color:var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 8%,transparent)}#${ROOT} .ch b{margin-left:6px;font-weight:400;opacity:.7}
#${ROOT} .ftr{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}#${ROOT} .ckl{display:flex;gap:6px;align-items:center;font-size:10.5px;letter-spacing:1.5px;color:var(--d)}#${ROOT} .dim{color:var(--d);font-size:10px;letter-spacing:1.5px}
#${ROOT} .bulk{position:sticky;top:8px;z-index:5;display:none;gap:8px;align-items:center;border:1px solid var(--r);background:#1a0909;color:var(--r);padding:10px 14px;font-size:11px;letter-spacing:2px;margin-bottom:10px}#${ROOT} .bulk.show{display:flex}
#${ROOT} .t{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--l);background:var(--p)}
#${ROOT} .t th{text-align:left;font-size:9.5px;letter-spacing:2px;color:var(--d);font-weight:400;padding:9px 10px;border-bottom:1px solid var(--l)}
#${ROOT} .t td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
#${ROOT} tr.day td{background:rgba(0,217,255,.04);color:var(--a);font-size:10px;letter-spacing:2.5px;padding:6px 10px}
#${ROOT} tr.r{cursor:pointer}#${ROOT} tr.r:hover td{background:rgba(255,255,255,.02)}#${ROOT} tr.sel td{background:rgba(255,77,77,.06)}
#${ROOT} .tm{white-space:nowrap;color:var(--d)}#${ROOT} .act b{color:#fff;font-weight:400;letter-spacing:1px}#${ROOT} .det{color:#c6d0da;max-width:560px;word-break:break-word}
#${ROOT} .by{white-space:nowrap}#${ROOT} .by b{font-family:Rajdhani,sans-serif;color:#fff;font-size:13.5px}#${ROOT} .by small{display:block;font-size:9px;color:var(--d);letter-spacing:1.5px}#${ROOT} .dsrc{font-size:9px;color:#a78bfa;display:block}
#${ROOT} .area{font-size:9.5px;letter-spacing:1.5px;border:1px solid var(--c);color:var(--c);padding:1px 6px;white-space:nowrap}
#${ROOT} .sx{color:var(--r);margin-right:4px}#${ROOT} .lockr .act b{color:var(--am)}
#${ROOT} .cb{width:34px}#${ROOT} .cb input{width:15px;height:15px;accent-color:#ff4d4d;cursor:pointer}
#${ROOT} tr.exp td{background:#070a0f!important;border-left:2px solid var(--a)}#${ROOT} .kv2{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;font-size:11.5px}#${ROOT} .kv2>span{color:var(--d);font-size:9.5px;letter-spacing:1.5px}
#${ROOT} .hint{font-size:10px;letter-spacing:.5px;color:var(--d);line-height:1.8;margin-top:12px}#${ROOT} .hint b{color:#c6d0da;font-weight:400}
.v2m .hint{font-size:10px;color:#7d8a99;margin-top:10px}
@media(max-width:900px){#${ROOT} .kp{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  const root = mountPanel("panel-auditv2", ROOT, () => load().catch((e) => notify("AUDIT LOG LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `<div class="bar"><div><div class="h1">AUDIT LOG</div><div class="sub" style="margin:4px 0 0">EVERY CHANGE IN THE COMMAND TERMINAL AND THE 505TH DISCORD SERVER — ONE PAGE</div></div><span class="sp"></span>
    <button class="b" data-act="csv">⇩ EXPORT CSV</button><button class="b ret" data-act="ret" hidden>⚙ RETENTION</button><button class="b" data-act="refresh" aria-label="Refresh">↻</button></div><div class="body"><div class="empty">LOADING...</div></div>`;
  root.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-sel]")) return;
    const s = t.closest("[data-src]");
    if (s) return (src = s.dataset.src), (area = ""), render();
    const a = t.closest("[data-area]");
    if (a) return (area = a.dataset.area), render();
    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "csv") return exportCsv();
    if (act === "ret") return openRet();
    if (act === "refresh") return load();
    if (act === "clear") return sel.clear(), render();
    if (act === "del") return openDel();
    if (act === "all") return;
    const row = t.closest("[data-row]");
    if (row) (open = open === row.dataset.row ? null : row.dataset.row), render();
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.sel) return t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel), render();
    if (t.dataset.act === "all") return shown().filter((x) => !x.locked).forEach((x) => (t.checked ? sel.add(x.id) : sel.delete(x.id))), render();
    if (t.dataset.f === "who") who = t.value;
    if (t.dataset.f === "days") days = +t.value;
    if (t.dataset.f === "sens") sensOnly = t.checked;
    render();
  });
  root.addEventListener("input", (e) => {
    if (e.target.dataset.f !== "q") return;
    q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = root.querySelector('[data-f="q"]');
    el.focus();
    el.setSelectionRange(pos, pos);
  });
});
