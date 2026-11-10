/**
 * COMMAND → Discord Role Sync (approved 2026-11-10). Access: "set". Settings: settings/discord_sync.
 * BOTH WAYS for rank · unit (platoon) · squad · status (active / inactive / retired):
 * change it on the website/Hub → Cortana swaps the Discord roles; change the role in Discord → the personnel file follows.
 * Never changes website ACCESS. Feed = sync_log (written by Cortana). Also fills the SQUAD list in the personnel edit form.
 */
import { collection, doc, getDoc, onSnapshot, setDoc } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { PLATOON_ORDER, RANK_LIST, addCss, ask, audit, db, esc, mountPanel, notify, onReady, rankOrder } from "./_common.js";
import { ago, chanOptions, cortanaJob, loadDiscord } from "./discord-common.js";

const TABS = [["rank", "🎖 RANKS"], ["unit", "🪖 UNITS"], ["squad", "👥 SQUADS"], ["status", "📋 STATUS"], ["feed", "🕘 HISTORY"]];
const STATUS = [["active", "Active"], ["inactive", "Inactive"], ["retired", "Retired"]];
const KEY = { rank: "ranks", unit: "units", squad: "squads", status: "status" };
const blank = () => ({ enabled: false, ranks: {}, units: {}, squads: {}, status: {}, keepRankOnRemove: true, retiredRemovesSquad: true, inactiveRemovesSquad: false, logChannelId: "" });

let S = null, saved = "", roles = [], chans = [], users = [], feed = [], acc = {}, root = null, tab = "rank", busy = false, newSquad = "", subs = [];
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dirty = () => S && JSON.stringify(S) !== saved;
const roleById = (id) => roles.find((r) => r.id === id);
const valuesOf = (g) => g === "rank" ? [...RANK_LIST].sort((a, b) => rankOrder(a) - rankOrder(b)) : g === "unit" ? PLATOON_ORDER : g === "squad" ? Object.keys(S.squads) : STATUS.map(([k]) => k);
const labelOf = (g, v) => (g === "status" ? STATUS.find(([k]) => k === v)?.[1] : v);
const count = (g, v) => users.filter((u) => (g === "rank" ? u.rank === v : g === "unit" ? u.platoon === v : g === "squad" ? u.squad === v : (u.role === "retired_veteran" ? "retired" : u.status === "inactive" ? "inactive" : "active") === v)).length;

/** Auto-match empty rows by name ("E7 / Gunnery Sergeant" ↔ @Gunnery Sergeant, "1st Platoon" ↔ @1st Platoon …). */
function autoMatch() {
  let n = 0;
  for (const g of ["rank", "unit", "squad", "status"]) for (const v of valuesOf(g)) {
    const m = S[KEY[g]];
    if (m[v]) continue;
    const want = norm(g === "rank" ? v.split("/").pop() : labelOf(g, v));
    const grade = g === "rank" ? norm(v.split("/")[0]) : "";
    // Exact name first ("Staff Sergeant"), then names with the grade too ("Staff Sergeant E6", "E6 Staff Sergeant").
    const cands = roles.filter((r) => !r.managed);
    const hit = cands.find((r) => norm(r.name) === want)
      || (grade && cands.find((r) => norm(r.name) === want + grade || norm(r.name) === grade + want))
      || (g !== "rank" && cands.find((r) => norm(r.name).includes(want) && want.length > 3));
    if (hit) { m[v] = hit.id; n++; }
  }
  return n;
}
const roleOpts = (cur) => `<option value="">— no role —</option>${roles.filter((r) => !r.managed).map((r) => `<option value="${r.id}" ${r.color && r.color !== "#000000" ? `data-color="${r.color}"` : ""} ${r.id === cur ? "selected" : ""} ${r.botCanAssign ? "" : "disabled"}>@${esc(r.name)}${r.botCanAssign ? "" : " (Cortana can't give this)"}</option>`).join("")}`;

function tableHtml(g) {
  const m = S[KEY[g]], vals = valuesOf(g);
  return `<div class="rs-card" style="padding:0"><table class="rs-tb"><thead><tr><th>WEBSITE ${g === "rank" ? "RANK" : g === "unit" ? "UNIT / PLATOON" : g === "squad" ? "SQUAD" : "STATUS"}</th><th>DISCORD ROLE</th><th>MEMBERS</th><th></th></tr></thead><tbody>
    ${vals.map((v) => { const rid = m[v], r = rid ? roleById(rid) : null; return `<tr><td><b>${esc(labelOf(g, v))}</b></td><td><select class="fld" data-map="${g}" data-v="${esc(v)}" aria-label="Discord role for ${esc(labelOf(g, v))}">${roleOpts(rid)}</select></td><td>${count(g, v)}</td>
      <td style="white-space:nowrap">${!rid ? '<span class="pill wr">▲ NOT SET</span>' : !r ? '<span class="pill er">✕ ROLE DELETED</span>' : !r.botCanAssign ? '<span class="pill er">✕ ABOVE CORTANA</span>' : '<span class="pill ok">✓ MATCHED</span>'}${g === "squad" ? ` <button class="b red" data-sqrm="${esc(v)}" aria-label="Remove squad ${esc(v)}">✕</button>` : ""}</td></tr>`; }).join("") || '<tr><td colspan="4" class="empty">No squads yet — add one below.</td></tr>'}</tbody></table>
    ${g === "squad" ? `<div class="rs-add"><input class="fld" id="rsSq" maxlength="40" value="${esc(newSquad)}" placeholder="New squad, e.g. Killjoy 1-1"><button class="b" data-x="addsq">＋ ADD SQUAD</button></div>` : ""}
    ${g === "status" ? '<p class="rs-n" style="padding:0 14px 12px">RETIRED = the personnel file shows "Retired". Staff (Recruiter and above) can\'t be set to Retired from Discord — change their access on the website first.</p>' : ""}</div>`;
}
function feedHtml(limit = 60) {
  const icon = (x) => x.group === "error" ? ["!", "#f59e0b"] : x.group === "rank" ? (rankOrder(x.to) < rankOrder(x.from) ? ["▲", "#22e07a"] : ["▼", "#ff4d4d"]) : x.group === "unit" ? ["🪖", "#00D9FF"] : x.group === "squad" ? ["⇄", "#00D9FF"] : ["◐", "#f59e0b"];
  return `<div class="rs-feed">${feed.slice(0, limit).map((x) => { const [i, c] = icon(x); return `<div class="it"><span class="ic" style="color:${c}">${i}</span><div><b>${x.group === "error" ? `Couldn't sync ${esc(x.who)}` : `${esc(x.from || "—")} → ${esc(x.to || "—")} · ${esc(x.who)}`}</b><small>${x.group === "error" ? esc(x.note || "") : `${esc(x.source.toUpperCase())} · ${esc(x.group.toUpperCase())} · BY ${esc(x.by)}`} · ${ago(x.atISO)}</small></div></div>`; }).join("") || '<div class="empty">No changes yet.</div>'}</div>`;
}

function draw() {
  if (!acc.set) { root.innerHTML = '<div class="panel-title">DISCORD ROLE SYNC</div><div class="empty">Developer / Commander only.</div>'; return; }
  if (!S) { root.innerHTML = '<div class="panel-title">DISCORD ROLE SYNC</div><div class="empty">LOADING…</div>'; return; }
  const n = (g) => [valuesOf(g).filter((v) => S[KEY[g]][v]).length, valuesOf(g).length];
  root.innerHTML = `<div class="panel-title">DISCORD ROLE SYNC</div><div class="rs-sub">DISCORD ROLE ⇄ PERSONNEL FILE · PROMOTE / DEMOTE · UNIT TRANSFER · SQUAD MOVE · INACTIVE / RETIRED · INSTANT ON WEBSITE + HUB</div>
  <div class="rs-card rs-top"><div><label class="rs-sw"><button class="sw ${S.enabled ? "on" : ""}" data-x="enabled" role="switch" aria-checked="${S.enabled}"><span></span></button><b>${S.enabled ? "⇄ SYNC IS ON — BOTH WAYS" : "SYNC IS OFF"}</b></label>
      <p class="rs-n">Change it on the website / Hub → Cortana swaps the Discord roles. Change the role in Discord → the personnel file follows. One role per group. Website ACCESS is never changed.</p></div>
    <div class="rs-opts"><label><input type="checkbox" data-opt="keepRankOnRemove" ${S.keepRankOnRemove !== false ? "checked" : ""}> Rank / unit role just removed (no new one) → keep the website rank / unit</label>
      <label><input type="checkbox" data-opt="retiredRemovesSquad" ${S.retiredRemovesSquad !== false ? "checked" : ""}> Retired → remove squad role</label>
      <label><input type="checkbox" data-opt="inactiveRemovesSquad" ${S.inactiveRemovesSquad ? "checked" : ""}> Inactive → remove squad role</label>
      <label class="rs-log">#personnel-log (optional) <select class="fld" data-x="log">${chanOptions(chans, S.logChannelId, { none: "— no log —" })}</select></label></div></div>
  <div class="rs-4">${["rank", "unit", "squad", "status"].map((g) => { const [a, b] = n(g); return `<div class="rs-card"><b>${TABS.find(([k]) => k === g)[1]}</b><small>${a} of ${b} mapped${a < b ? ` · <span style="color:#f59e0b">${b - a} not set</span>` : ""}</small></div>`; }).join("")}</div>
  <div class="rs-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
  <div class="rs-g"><div>${tab === "feed" ? `<div class="rs-card">${feedHtml(200)}</div>` : tableHtml(tab)}
    <div class="rs-ft"><span class="rs-n">${dirty() ? "UNSAVED CHANGES" : saved ? "SAVED" : "NOT SAVED YET"} · ⚡ EMPTY ROWS ARE MATCHED BY NAME</span><div style="display:flex;gap:8px"><button class="b" data-x="auto">⚡ AUTO-MATCH</button><button class="b" data-x="all" ${busy ? "disabled" : ""}>⟳ CHECK EVERYONE NOW</button><button class="b gold" data-x="save" ${dirty() && !busy ? "" : "disabled"}>SAVE</button></div></div></div>
    <div class="rs-card"><b class="rs-h">LIVE FEED</b><p class="rs-n" style="margin:0 0 6px">WHAT CORTANA CHANGED · WEBSITE + HUB UPDATE INSTANTLY</p>${feedHtml(12)}</div></div>`;
}

async function save() {
  busy = true; draw();
  try {
    await setDoc(doc(db, "settings", "discord_sync"), { ...S, updatedAtISO: new Date().toISOString() });
    await audit("discord", "ROLE SYNC SAVED", `${S.enabled ? "ON" : "OFF"} · ${["ranks", "units", "squads", "status"].map((k) => `${Object.values(S[k]).filter(Boolean).length} ${k}`).join(", ")}`);
    saved = JSON.stringify(S);
    fillSquadSelect();
    notify("✓ ROLE SYNC SAVED — CORTANA USES IT NOW");
  } catch (e) { notify("SAVE FAILED: " + e.message, 1); }
  busy = false; draw();
}

/** Personnel edit form (legacy) → SQUAD list from these settings. */
function fillSquadSelect() {
  const sel = document.getElementById("editSquad");
  if (!sel || !S) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— NO SQUAD —</option>' + Object.keys(S.squads).map((q) => `<option value="${esc(q)}">${esc(q)}</option>`).join("");
  sel.value = cur;
}

function wire() {
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.map) { const m = S[KEY[t.dataset.map]]; if (t.value) m[t.dataset.v] = t.value; else if (t.dataset.map === "squad") m[t.dataset.v] = ""; else delete m[t.dataset.v]; return draw(); }
    if (t.dataset.opt) { S[t.dataset.opt] = t.checked; return draw(); }
    if (t.dataset.x === "log") { S.logChannelId = t.value; return draw(); }
  });
  root.addEventListener("input", (e) => { if (e.target.id === "rsSq") newSquad = e.target.value; });
  root.addEventListener("keydown", (e) => { if (e.target.id === "rsSq" && e.key === "Enter") { e.preventDefault(); root.querySelector('[data-x="addsq"]').click(); } });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; return draw(); }
    if (b.dataset.sqrm) { const n = b.dataset.sqrm; if (await ask({ kind: "warn", title: `REMOVE SQUAD ${n}?`, body: count("squad", n) ? `${count("squad", n)} member(s) are in it — their squad stays on the personnel file until changed.` : "Nobody is in it.", go: "REMOVE", cancel: "KEEP" })) { delete S.squads[n]; draw(); } return; }
    switch (b.dataset.x) {
      case "enabled": S.enabled = !S.enabled; return draw();
      case "addsq": { const n = newSquad.trim().slice(0, 40); if (!n) return; if (S.squads[n] !== undefined) return notify("THAT SQUAD ALREADY EXISTS", 1); S.squads[n] = roles.find((r) => norm(r.name) === norm(n))?.id || ""; newSquad = ""; return draw(); }
      case "auto": { const n = autoMatch(); notify(n ? `⚡ MATCHED ${n} ROLE(S) BY NAME — CHECK + SAVE` : "NOTHING NEW TO MATCH"); return draw(); }
      case "save": return save();
      case "all":
        if (dirty()) return notify("SAVE FIRST", 1);
        if (!S.enabled) return notify("TURN SYNC ON FIRST", 1);
        if (!(await ask({ kind: "warn", title: "CHECK EVERYONE NOW?", body: "Cortana makes every linked member's Discord roles match their personnel file (website wins). Roles not in these lists are never touched.", go: "CHECK EVERYONE", cancel: "CANCEL" }))) return;
        busy = true; draw();
        try { const r = await cortanaJob("rolesync.all", {}, { ms: 120000 }); notify(r ? `✓ ${r.result?.members ?? 0} MEMBERS CHECKED · ${r.result?.changed ?? 0} ROLE CHANGES` : "◷ CORTANA IS OFFLINE", !r); } catch (err) { notify("FAILED: " + err.message, 1); }
        busy = false; return draw();
    }
  });
}

async function load() {
  ({ chans, roles } = await loadDiscord());
  const d = (await getDoc(doc(db, "settings", "discord_sync"))).data?.();
  S = { ...blank(), ...(d || {}) };
  for (const k of ["ranks", "units", "squads", "status"]) S[k] = { ...(S[k] || {}) };
  delete S.updatedAtISO;
  saved = d ? JSON.stringify(S) : "";
  if (!d) autoMatch();
  if (!subs.length) {
    subs.push(onSnapshot(collection(db, "sync_log"), (s) => { feed = s.docs.map((x) => x.data()).sort((a, b) => String(b.atISO).localeCompare(String(a.atISO))); if (!root.contains(document.activeElement)) draw(); }, () => {}));
    subs.push(onSnapshot(collection(db, "users"), (s) => { users = s.docs.map((x) => x.data()); }, () => {}));
  }
  draw();
}

const CSS = `
#rsyncV2 .rs-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#rsyncV2 .rs-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#rsyncV2 .rs-top{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
#rsyncV2 .rs-sw{display:flex;align-items:center;gap:10px;font:700 13px monospace;letter-spacing:1.5px}
#rsyncV2 .sw{all:unset;cursor:pointer;width:42px;height:22px;border:1px solid #6f8a96;position:relative;flex-shrink:0}#rsyncV2 .sw span{position:absolute;left:2px;top:2px;width:16px;height:16px;background:#6f8a96;transition:left .15s}#rsyncV2 .sw.on{border-color:#22e07a;background:rgba(34,224,122,.2)}#rsyncV2 .sw.on span{left:22px;background:#22e07a}#rsyncV2 .sw:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
#rsyncV2 .rs-opts{display:grid;gap:8px;font-size:13px}#rsyncV2 .rs-opts label{display:flex;gap:8px;align-items:center}#rsyncV2 .rs-log{flex-wrap:wrap}#rsyncV2 .rs-log .ukp,#rsyncV2 .rs-log select{flex:1;min-width:200px}
#rsyncV2 .rs-n{color:#6f8a96;font:10px monospace;letter-spacing:1px;margin:6px 0 0}
#rsyncV2 .rs-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}#rsyncV2 .rs-4 b{font:700 12px monospace;letter-spacing:2px;display:block}#rsyncV2 .rs-4 small{color:#6f8a96;font:11px monospace}
#rsyncV2 .rs-tabs{display:flex;border-bottom:1px solid rgba(0,217,255,.18);margin-bottom:14px;overflow:auto}#rsyncV2 .rs-tabs button{all:unset;cursor:pointer;padding:10px 16px;font:700 12px monospace;letter-spacing:2px;color:#6f8a96;border-bottom:2px solid transparent;white-space:nowrap}#rsyncV2 .rs-tabs button.on{color:#00D9FF;border-bottom-color:#00D9FF}#rsyncV2 .rs-tabs button:focus-visible{outline:2px solid #00D9FF}
#rsyncV2 .rs-g{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
#rsyncV2 .rs-tb{width:100%;border-collapse:collapse;font-size:13px}#rsyncV2 .rs-tb th{text-align:left;font:10px monospace;letter-spacing:1.5px;color:#6f8a96;padding:8px 14px;border-bottom:1px solid rgba(0,217,255,.18)}#rsyncV2 .rs-tb td{padding:6px 14px;border-bottom:1px solid rgba(0,217,255,.07)}#rsyncV2 .rs-tb td:nth-child(2){min-width:220px}
#rsyncV2 .pill{font:10px monospace;letter-spacing:1px;padding:2px 6px;border:1px solid}#rsyncV2 .pill.ok{color:#22e07a;border-color:rgba(34,224,122,.4)}#rsyncV2 .pill.wr{color:#f59e0b;border-color:rgba(245,158,11,.4)}#rsyncV2 .pill.er{color:#ff4d4d;border-color:rgba(255,77,77,.4)}
#rsyncV2 .rs-add{display:flex;gap:8px;padding:12px 14px}
#rsyncV2 .rs-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
#rsyncV2 .rs-h{font:700 12px monospace;letter-spacing:2px}
#rsyncV2 .rs-feed .it{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid rgba(0,217,255,.08);align-items:center}#rsyncV2 .rs-feed .ic{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(0,217,255,.18);flex-shrink:0}#rsyncV2 .rs-feed b{font-size:13px}#rsyncV2 .rs-feed small{display:block;color:#6f8a96;font:10px monospace;letter-spacing:1px}
@media(max-width:1100px){#rsyncV2 .rs-top,#rsyncV2 .rs-g{grid-template-columns:1fr}#rsyncV2 .rs-4{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  addCss("rsync-v2", CSS);
  onAccess((me) => {
    acc = me?.access || {};
    if (root) draw();
    // Fill the personnel form's SQUAD list for anyone who can edit personnel.
    getDoc(doc(db, "settings", "discord_sync")).then((s) => { if (!S && s.exists()) { const d = s.data(); S = { ...blank(), ...d }; saved = JSON.stringify(S); } fillSquadSelect(); }).catch(() => {});
  });
  root = mountPanel("panel-cmd-rolesync", "rsyncV2", () => load().catch((e) => notify("ROLE SYNC LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
