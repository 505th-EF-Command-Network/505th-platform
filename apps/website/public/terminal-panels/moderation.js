/**
 * DISCORD → Moderation (approved mock 2026-11-10). Warn / Timeout: "modw" · Kick / Ban: "modk".
 * Cortana does the action in Discord, makes a numbered case (mod_cases, Cortana-only), posts to the Mod Log
 * channel and the audit log. Nobody can act on someone of their own website rank or higher (checked by Cortana).
 * 3 active warnings in 30 days → automatic 24 h timeout.
 */
import { collection, getDocs, onSnapshot } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, db, esc, memberName, mountPanel, notify, onReady } from "./_common.js";
import { ago, cortanaJob, ukTime } from "./discord-common.js";

const ACTIONS = { warn: ["⚠ WARN", "#f59e0b", "modw"], timeout: ["⏱ TIMEOUT", "#00D9FF", "modw"], kick: ["👢 KICK", "#ff8a3d", "modk"], ban: ["⛔ BAN", "#ff4d4d", "modk"] };
const LENGTHS = [[10, "10 min"], [60, "1 hour"], [360, "6 hours"], [1440, "1 day"], [10080, "1 week"], [40320, "28 days"]];
let users = [], cases = [], acc = {}, root = null, busy = false, unsub = null, cf = "all", q = "";
let v = { who: "", discordId: "", name: "", action: "warn", reason: "", note: "", minutes: 60, deleteDays: 0, dm: true };

const linked = () => users.filter((u) => /^\d{17,20}$/.test(String(u.discordId || "")));
const activeWarns = (id) => cases.filter((c) => c.discordId === id && c.action === "warn" && c.active).length;
const allowedAct = (a) => !!acc[ACTIONS[a][2]];

function problems() {
  if (!/^\d{17,20}$/.test(v.discordId)) return "Pick a member (or paste a Discord ID).";
  if (!allowedAct(v.action)) return "You don't have access to that action.";
  if (v.reason.trim().length < 3) return "Give a reason (the member sees it).";
  return "";
}
function stats() {
  const since = Date.now() - 30 * 864e5;
  const n = (a, act) => cases.filter((c) => c.action === a && (act ? c.active : Date.parse(c.atISO) > since)).length;
  return `<div class="md-kpi"><div><b style="color:#f59e0b">${n("warn")}</b><small>WARNINGS (30 D)</small></div><div><b style="color:#00D9FF">${n("timeout", true)}</b><small>ACTIVE TIMEOUTS</small></div><div><b>${n("kick")}</b><small>KICKS (30 D)</small></div><div><b style="color:#ff4d4d">${n("ban", true)}</b><small>ACTIVE BANS</small></div></div>`;
}
function formHtml() {
  const p = problems(), w = v.discordId ? activeWarns(v.discordId) : 0;
  return `<div class="md-card"><b class="md-h">NEW ACTION</b>
    <label class="lbl" for="mdWho">MEMBER</label>
    <div class="md-pick"><input class="fld md-srch" id="mdWho" value="${esc(v.who)}" placeholder="Type a name, or paste a Discord ID" autocomplete="off" role="combobox" aria-expanded="${pickOpen}" aria-controls="mdDD" aria-autocomplete="list">
    ${pickOpen ? pickList() : ""}</div>
    ${v.discordId && !pickOpen ? `<small class="md-n" style="color:#22e07a">✓ ${v.name ? esc(v.name) + " · " : "NOT LINKED · "}DISCORD ID ${esc(v.discordId)}</small>` : ""}
    <span class="lbl">ACTION</span><div class="md-seg" role="radiogroup" aria-label="Action">${Object.entries(ACTIONS).map(([k, [l, c]]) => `<button class="${v.action === k ? "on" : ""}" role="radio" aria-checked="${v.action === k}" data-act="${k}" ${allowedAct(k) ? "" : 'disabled title="Officer access needed"'} style="${v.action === k ? `color:${c};background:${c}1f;box-shadow:inset 0 -2px 0 ${c}` : ""}">${l}</button>`).join("")}</div>
    ${v.action === "timeout" ? `<label class="lbl" for="mdLen">LENGTH</label><select class="fld" id="mdLen" data-k="minutes">${LENGTHS.map(([m, l]) => `<option value="${m}" ${v.minutes === m ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
    ${v.action === "ban" ? `<label class="lbl" for="mdDel">DELETE THEIR RECENT MESSAGES</label><select class="fld" id="mdDel" data-k="deleteDays">${[[0, "Don't delete"], [1, "Last 24 hours"], [7, "Last 7 days"]].map(([d, l]) => `<option value="${d}" ${v.deleteDays === d ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
    <label class="lbl" for="mdR">REASON (MEMBER SEES THIS)</label><textarea class="fld" id="mdR" data-k="reason" rows="2" maxlength="500">${esc(v.reason)}</textarea>
    <label class="lbl" for="mdN">STAFF NOTE (PRIVATE)</label><input class="fld" id="mdN" data-k="note" maxlength="500" value="${esc(v.note)}">
    <div class="md-cnt">${v.reason.length} / 500</div>
    <label class="md-chk"><input type="checkbox" id="mdDm" ${v.dm ? "checked" : ""}> DM the member the reason</label>
    ${v.discordId && w ? `<div class="md-warn">▲ ${w} ACTIVE WARNING${w > 1 ? "S" : ""} ALREADY · 3 WARNINGS IN 30 DAYS = AUTOMATIC 24 H TIMEOUT</div>` : ""}
    <div class="md-ft"><span class="md-err" role="status">${p ? "▲ " + esc(p) : ""}</span><button class="b" data-x="go" ${p || busy ? "disabled" : ""} style="border-color:${ACTIONS[v.action][1]};color:${ACTIONS[v.action][1]}">${busy ? "WORKING…" : "ISSUE " + ACTIONS[v.action][0].split(" ")[1]}</button></div>
    <p class="md-n" style="margin-top:12px">WARN / TIMEOUT: STAFF NCO+ · KICK / BAN: OFFICER+ · YOU CAN'T ACT ON YOUR OWN RANK OR HIGHER</p></div>`;
}
function casesHtml() {
  const s = q.toLowerCase();
  const list = cases.filter((c) => (cf === "all" || c.active) && (!s || String(c.targetName).toLowerCase().includes(s) || c.discordId === s)).slice(0, 100);
  const lift = (c) => !c.active || c.action === "kick" ? "" : c.action === "ban" ? (acc.modk ? `<button class="b" data-lift="${c.id}">UNBAN</button>` : "") : `<button class="b" data-lift="${c.id}">${c.action === "timeout" ? "LIFT" : "CLEAR"}</button>`;
  const tag = (c) => `<span class="pill" style="color:${ACTIONS[c.action][1]};border-color:${ACTIONS[c.action][1]}66">${c.action.toUpperCase()}${c.action === "timeout" && c.minutes ? " " + (LENGTHS.find(([m]) => m === c.minutes)?.[1] || c.minutes + "m").toUpperCase() : ""}</span>`;
  return `<div class="md-card" style="padding:0"><div class="md-hd"><b class="md-h" style="margin:0">CASES</b><div class="chips"><button class="ch ${cf === "all" ? "on" : ""}" data-cf="all">ALL</button><button class="ch ${cf === "active" ? "on" : ""}" data-cf="active">ACTIVE</button><input class="fld md-q" id="mdQ" value="${esc(q)}" placeholder="Search member…" aria-label="Search cases by member"></div></div>
    <div style="overflow:auto"><table class="md-tb"><thead><tr><th>#</th><th>MEMBER</th><th>ACTION</th><th>REASON</th><th>BY</th><th>WHEN</th><th></th></tr></thead><tbody>
    ${list.map((c) => `<tr><td>${c.number}</td><td>${esc(c.targetName)}</td><td>${tag(c)}${c.auto ? ' <span class="md-n" style="display:inline">AUTO</span>' : ""}</td><td title="${esc(c.note ? "Staff note: " + c.note : "")}">${esc(c.reason)}${c.note ? " 🗒" : ""}</td><td>${esc(c.byName)}</td><td title="${esc(ukTime(c.atISO))}">${ago(c.atISO)}</td>
      <td>${c.active ? lift(c) : `<span class="pill">${c.liftedByName ? "LIFTED" : c.action === "kick" ? "DONE" : "EXPIRED"}</span>`}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">No cases.</td></tr>'}</tbody></table></div></div>`;
}
function draw() {
  if (!acc.modw && !acc.modk) { root.innerHTML = '<div class="panel-title">MODERATION</div><div class="empty">You don\'t have Moderation access.</div>'; return; }
  const keep = document.activeElement?.id, pos = document.activeElement?.selectionStart;
  root.innerHTML = `<div class="panel-title">MODERATION</div><div class="md-sub">WARN · TIMEOUT · KICK · BAN · EVERY ACTION IS A CASE · LOGGED TO THE MOD LOG + AUDIT LOG</div>${stats()}<div class="md-g">${formHtml()}${casesHtml()}</div>`;
  if (keep) { const el = root.querySelector("#" + keep); el?.focus(); if (el && pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch {} }
}
const soft = () => { const c = root.querySelector(".md-cnt"); if (c) c.textContent = `${v.reason.length} / 500`; const b = root.querySelector('[data-x="go"]'), e = root.querySelector(".md-err"), p = problems(); if (b) b.disabled = !!p || busy; if (e) e.textContent = p ? "▲ " + p : ""; };

/* ───────── member picker (dark list: hex avatar, rank, platoon, warnings) ───────── */
let pickOpen = false, pickHi = 0;
const initials = (u) => (String(u.callsign || u.lastName || u.firstName || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "?").toUpperCase();
function pickItems() {
  const q = v.who.trim().toLowerCase();
  const list = linked().filter((u) => !q || memberName(u).toLowerCase().includes(q) || String(u.callsign || "").toLowerCase().includes(q) || String(u.discordId).includes(q)).slice(0, 8);
  const raw = (v.who.match(/\b(\d{17,20})\b/) || [])[1];
  return { list, raw: raw && !linked().some((u) => u.discordId === raw) ? raw : "" };
}
function pickList() {
  const { list, raw } = pickItems();
  const rows = list.map((u, n) => { const w = activeWarns(u.discordId); return `<div class="o ${n === pickHi ? "hi" : ""}" role="option" id="mdo${n}" data-pick="${esc(u.discordId)}"><span class="av">${esc(initials(u))}</span><span><b>${esc(memberName(u))}</b><small>${esc([u.platoon, u.discordUsername ? "@" + u.discordUsername : ""].filter(Boolean).join(" · ").toUpperCase() || "LINKED")}</small></span>${w ? `<span class="w">⚠ ${w} WARNING${w > 1 ? "S" : ""}</span>` : ""}</div>`; }).join("");
  return `<div class="md-dd" id="mdDD" role="listbox">${list.length ? '<div class="g">LINKED MEMBERS</div>' + rows : ""}
    <div class="g">NOT LINKED</div>${raw ? `<div class="o ${list.length === pickHi ? "hi" : ""}" role="option" data-pick="${raw}"><span class="av" style="color:#6f8a96">#</span><span><b>Discord ID ${raw}</b><small>USE THIS ID</small></span></div>` : '<div class="o dis"><span class="av" style="color:#6f8a96">#</span><span><b>Paste a Discord ID…</b><small>FOR PEOPLE WITHOUT A WEBSITE ACCOUNT</small></span></div>'}</div>`;
}
function choose(id) {
  const u = linked().find((x) => x.discordId === id);
  v.discordId = id;
  v.name = u ? memberName(u) : "";
  v.who = u ? memberName(u) : id;
  pickOpen = false;
  draw();
}

function pickWho(text) {
  v.who = text;
  const id = (text.match(/^\s*(\d{17,20})\s*$/) || [])[1] || "";
  const u = id ? linked().find((x) => x.discordId === id) : null;
  v.discordId = id;
  v.name = u ? memberName(u) : "";
}

async function go() {
  if (problems() || busy) return;
  const [label] = ACTIONS[v.action];
  const who = v.name || `Discord ID ${v.discordId}`;
  const big = v.action === "kick" || v.action === "ban";
  if (!(await ask({ kind: big ? "danger" : "warn", title: `${label.split(" ")[1]} ${who.toUpperCase()}?`, body: `Reason: ${v.reason}${v.action === "timeout" ? ` · ${LENGTHS.find(([m]) => m === v.minutes)?.[1]}` : ""}`, item: who, ...(big ? { warn: v.action === "ban" ? "THEY CAN'T REJOIN UNTIL UNBANNED." : "THEY ARE REMOVED FROM THE SERVER." } : {}), go: label.split(" ")[1], cancel: "CANCEL" }))) return;
  busy = true; draw();
  try {
    const r = await cortanaJob("mod.action", { discordId: v.discordId, action: v.action, reason: v.reason.trim(), note: v.note.trim(), minutes: Number(v.minutes), deleteDays: Number(v.deleteDays), dm: v.dm });
    notify(r ? `✓ CASE #${r.result?.caseNumber ?? ""} · ${label.split(" ")[1]} DONE${v.dm && r.result?.dmSent === false ? " (DM FAILED — THEIR DMS ARE CLOSED)" : ""}` : "◷ CORTANA IS OFFLINE — DONE WHEN IT'S BACK", !r);
    v = { ...v, who: "", discordId: "", name: "", reason: "", note: "" };
  } catch (e) { notify("FAILED: " + e.message, 1); }
  busy = false; draw();
}

function wire() {
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "mdWho") { pickWho(t.value); pickOpen = true; pickHi = 0; return draw(); }
    if (t.id === "mdQ") { q = t.value; return draw(); }
    if (t.dataset.k && t.tagName !== "SELECT") { v[t.dataset.k] = t.value; soft(); }
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "mdDm") v.dm = t.checked;
    if (t.dataset.k && t.tagName === "SELECT") { v[t.dataset.k] = Number(t.value); draw(); }
  });
  root.addEventListener("mousedown", (e) => { const o = e.target.closest("[data-pick]"); if (o) { e.preventDefault(); choose(o.dataset.pick); } });
  root.addEventListener("focusin", (e) => { if (e.target.id === "mdWho" && !pickOpen) { pickOpen = true; draw(); } });
  root.addEventListener("focusout", (e) => { if (e.target.id === "mdWho") setTimeout(() => { if (pickOpen && document.activeElement?.id !== "mdWho") { pickOpen = false; draw(); } }, 120); });
  root.addEventListener("keydown", (e) => {
    if (e.target.id !== "mdWho" || !pickOpen) return;
    const opts = [...root.querySelectorAll("#mdDD [data-pick]")];
    if (e.key === "ArrowDown") { e.preventDefault(); pickHi = Math.min(opts.length - 1, pickHi + 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); pickHi = Math.max(0, pickHi - 1); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); const o = opts[pickHi]; if (o) choose(o.dataset.pick); }
    else if (e.key === "Escape") { pickOpen = false; draw(); }
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.act) { v.action = b.dataset.act; return draw(); }
    if (b.dataset.cf) { cf = b.dataset.cf; return draw(); }
    if (b.dataset.lift) {
      const c = cases.find((x) => x.id === b.dataset.lift);
      const word = c.action === "ban" ? "UNBAN" : c.action === "timeout" ? "LIFT TIMEOUT" : "CLEAR WARNING";
      if (!(await ask({ kind: "warn", title: `${word}?`, body: `Case #${c.number} · ${c.targetName}`, go: word, cancel: "CANCEL" }))) return;
      busy = true; draw();
      try { const r = await cortanaJob("mod.lift", { caseId: c.id }); notify(r ? `✓ ${word} DONE` : "◷ CORTANA IS OFFLINE — DONE WHEN IT'S BACK", !r); } catch (err) { notify("FAILED: " + err.message, 1); }
      busy = false; return draw();
    }
    if (b.dataset.x === "go") go();
  });
}

async function load() {
  users = (await getDocs(collection(db, "users")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => !u.suspended) ?? [];
  if (!unsub) unsub = onSnapshot(collection(db, "mod_cases"), (s) => {
    cases = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.number || 0) - (a.number || 0));
    const a = document.activeElement;
    if (!busy && !(a && root.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"))) draw();
  }, () => {});
  draw();
}

const CSS = `
#modV2 .md-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#modV2 .md-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}#modV2 .md-kpi div{border:1px solid rgba(0,217,255,.18);padding:10px;background:rgba(0,0,0,.25)}#modV2 .md-kpi b{font:700 22px monospace;display:block}#modV2 .md-kpi small{color:#6f8a96;font:10px monospace;letter-spacing:1px}
#modV2 .md-g{display:grid;grid-template-columns:400px minmax(0,1fr);gap:16px;align-items:start}
#modV2 .md-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#modV2 .md-h{font:700 12px monospace;letter-spacing:2px;display:block}
#modV2 .md-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;flex-wrap:wrap}
#modV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:12px 0 6px}
#modV2 .md-n{display:block;font:10px monospace;letter-spacing:1px;color:#6f8a96;margin-top:4px}
#modV2 .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#modV2 .ch{all:unset;cursor:pointer;font:11px monospace;padding:5px 9px;border:1px solid rgba(0,217,255,.18);color:#cfe9f2}#modV2 .ch.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}#modV2 .ch:disabled{opacity:.35;cursor:not-allowed}#modV2 .ch:focus-visible{outline:2px solid #00D9FF}
#modV2 .md-q{width:180px;padding:4px 8px;font-size:12px}
#modV2 .md-pick{position:relative}#modV2 .md-srch{padding-left:34px}#modV2 .md-pick:before{content:"⌕";position:absolute;left:12px;top:9px;color:#00D9FF;font-size:16px;z-index:1}
#modV2 .md-dd{position:absolute;left:0;right:0;top:100%;z-index:50;background:#07131b;border:1px solid #00D9FF;border-top:0;box-shadow:0 12px 30px rgba(0,0,0,.6);max-height:320px;overflow:auto}
#modV2 .md-dd .g{font:10px monospace;letter-spacing:2px;color:#6f8a96;padding:8px 12px 4px;display:flex;gap:6px;align-items:center}#modV2 .md-dd .g:after{content:"";flex:1;height:1px;background:rgba(0,217,255,.18)}
#modV2 .md-dd .o{display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer}#modV2 .md-dd .o.hi,#modV2 .md-dd .o:hover{background:rgba(0,217,255,.1)}#modV2 .md-dd .o.dis{opacity:.5;cursor:default}
#modV2 .md-dd .o b{display:block;font-size:14px;font-weight:600}#modV2 .md-dd .o small{display:block;color:#6f8a96;font:10px monospace;letter-spacing:1px}#modV2 .md-dd .o .w{margin-left:auto;font:10px monospace;color:#f59e0b;white-space:nowrap}
#modV2 .av{width:28px;height:28px;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%);background:linear-gradient(135deg,#0d3443,#0b1a22);display:grid;place-items:center;font:700 10px monospace;color:#00D9FF;flex-shrink:0}
#modV2 .md-seg{display:flex;border:1px solid rgba(0,217,255,.18);width:fit-content;flex-wrap:wrap}#modV2 .md-seg button{all:unset;cursor:pointer;padding:8px 14px;font:700 11px monospace;letter-spacing:1.5px;color:#6f8a96;border-right:1px solid rgba(0,217,255,.18)}#modV2 .md-seg button:last-child{border-right:0}#modV2 .md-seg button:disabled{opacity:.35;cursor:not-allowed}#modV2 .md-seg button:focus-visible{outline:2px solid #00D9FF;outline-offset:-2px}
#modV2 .md-cnt{font:10px monospace;color:#6f8a96;text-align:right;margin-top:4px}
#modV2 .md-chk{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}
#modV2 .md-warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);padding:8px;margin-top:10px;font:11px monospace;color:#f59e0b}
#modV2 .md-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px}#modV2 .md-err{color:#f59e0b;font:11px monospace}
#modV2 .md-tb{width:100%;border-collapse:collapse;font-size:13px}#modV2 .md-tb th{text-align:left;font:10px monospace;letter-spacing:1.5px;color:#6f8a96;padding:8px;border-bottom:1px solid rgba(0,217,255,.18)}#modV2 .md-tb td{padding:8px;border-bottom:1px solid rgba(0,217,255,.07)}
#modV2 .pill{font:10px monospace;letter-spacing:1px;padding:2px 6px;border:1px solid rgba(0,217,255,.18);color:#6f8a96;white-space:nowrap}
@media(max-width:1100px){#modV2 .md-g,#modV2 .md-kpi{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("mod-v2", CSS);
  onAccess((me) => { acc = me?.access || {}; if (!acc.modw && acc.modk) v.action = "kick"; if (root) draw(); });
  root = mountPanel("panel-mod", "modV2", () => load().catch((e) => notify("MODERATION LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
