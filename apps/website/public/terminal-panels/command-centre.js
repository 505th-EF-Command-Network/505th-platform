/**
 * COMMAND CENTRE (approved mock 2026-11-11)
 *  - #panel-cmd-home: one home for Command — the unit right now, UNIT and SYSTEM cards (what it's for · use when · live tags).
 *  - #panel-cmd-access: Commander gives Command Centre parts to members (optionally until a date) — /api/terminal/cmd-access.
 *  - "WHAT IS THIS?" boxes on every Command page (hide per page, remembered on this device).
 * Guided tours: help.js (▶ START TOUR / ▶ TOUR THIS PAGE).
 */
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "/terminal-shim/firestore.js";
import { addCss, ask, cortanaStatus, db, esc, getUsers, mountPanel, notify, onReady, ukDate } from "./_common.js";
import { onAccess } from "./nav-v2.js";

let me = null;
const OPS = { Active: ["ACTIVE", "#22e07a"], "Stand Down": ["STAND DOWN", "#7d8a99"], "On Op": ["ON OP", "#f59e0b"], "Training Cycle": ["TRAINING", "#00D9FF"], Maintenance: ["MAINTENANCE", "#a78bfa"] };
const PARTS = [
  ["cmd_status", "◉ Unit Status"], ["cmd_sitrep", "✉ SITREP"], ["cmd_staff", "♟ Command Staff"], ["cmd_promote", "▲ Command Promotions"], ["cmd_suspend", "⛔ Suspensions"],
  ["ovr", "◎ Overall Status"], ["bot", "▶ Bot Server"], ["set", "⚙ Settings · Cortana Setup · Role Sync"],
];
const PART_L = Object.fromEntries(PARTS);
const ago = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const tag = (t, c) => `<span class="cc-chip" style="color:${c}">${esc(t)}</span>`;

// ───────── "WHAT IS THIS?" boxes ─────────
const EXPLAIN = {
  "panel-cmd-status": ["The unit's current state, shown to everyone.", ["<b>Status</b> → the badge on the website and the dashboard.", "<b>Recruitment</b> → opens or closes the public sign-up page.", "<b>Message</b> → optional line under the badge (e.g. \"Back on 1 Dec\")."]],
  "panel-cmd-sitrep": ["Short reports from Command for your staff.", ["The pinned one shows at the top of every staff Dashboard.", "<b>Who can read it</b>: all staff, officers only, or Commander only.", "<b>Alert readers</b> sends them a notification."]],
  "panel-cmd-staff": ["Your leadership team at a glance.", ["Everyone NCO and above, with role and when they were last online.", "Click a person to open their personnel file."]],
  "panel-cmd-promote": ["Give or remove command-tier roles.", ["Officer and Developer get full Terminal access.", "Only the Commander can make or remove a Commander.", "Normal rank promotions are in the Roster / Personnel Files."]],
  "panel-cmd-suspend": ["Block someone from the Terminal for a while.", ["They are signed out everywhere and see your reason.", "Pick a length — it lifts by itself — or until restored.", "For Discord-only problems use Discord → Moderation."]],
  "panel-overall": ["Health of the whole Command Network.", ["Website, database, Cortana and Discord in one view.", "Come here first when something seems slow or broken."]],
  "panel-bot": ["Cortana's process on the home server.", ["Ping, memory, jobs and errors.", "Reload or restart if Cortana stops answering."]],
  "panel-cmd-cortana": ["Where Cortana posts in Discord.", ["Channels for events, logs, AARs, welcome and more.", "Set once; change it when channels are renamed or added."]],
  "panel-cmd-rolesync": ["Website ranks and roles → Discord roles.", ["Cortana keeps Discord roles matching the personnel files.", "Use CHECK EVERYONE if someone's roles look wrong."]],
  "panel-cmd-settings": ["Unit-wide settings.", ["Discord invite link, webhooks, Cortana's presence, the Discord role map.", "Audit Log clean-up is in Security → Audit Log."]],
  "panel-cmd-access": ["You decide who else can use the Command Centre.", ["<b>FULL</b> = every Command page (except this one).", "<b>CUSTOM</b> = only the parts you tick (e.g. SITREP only).", "<b>UNTIL</b> = access ends by itself on that date."]],
};
const hidden = () => { try { return new Set(JSON.parse(localStorage.getItem("ccHideExplain") || "[]")); } catch { return new Set(); } };
function addExplain(panel) {
  const e = EXPLAIN[panel.id];
  if (!e || panel.querySelector(".cc-explain")) return;
  const root = panel.querySelector(".cmdv2, .v2, #cmdCortV2, #rsyncV2") || panel;
  const sub = root.querySelector(".sub") || root.querySelector(".h1, .panel-title");
  if (!sub) return;
  const box = document.createElement("div");
  box.className = "cc-explain";
  box.hidden = hidden().has(panel.id);
  box.innerHTML = `<span aria-hidden="true">ℹ</span><div><b>WHAT IS THIS?</b> ${e[0]}<ul>${e[1].map((x) => `<li>${x}</li>`).join("")}</ul></div><div class="cc-ex-b"><button type="button" class="b sm" data-tourpage="${panel.id}">▶ TOUR</button><button type="button" class="b sm" data-hideex="${panel.id}" aria-label="Hide this box">HIDE</button></div>`;
  sub.insertAdjacentElement("afterend", box);
  let show = panel.querySelector(".cc-showex");
  if (!show) {
    show = document.createElement("button");
    show.type = "button";
    show.className = "cc-showex";
    show.textContent = "ℹ WHAT IS THIS?";
    show.dataset.showex = panel.id;
    box.insertAdjacentElement("afterend", show);
  }
  show.hidden = !box.hidden;
}
document.addEventListener("click", (e) => {
  const h = e.target.closest("[data-hideex]"), s = e.target.closest("[data-showex]"), t = e.target.closest("[data-tourpage]");
  if (t) return import("./help.js").then((m) => m.startTour(t.dataset.tourpage)).catch(() => notify("TOUR NOT AVAILABLE", 1));
  if (!h && !s) return;
  const id = (h || s).dataset.hideex || (h || s).dataset.showex;
  const set = hidden();
  h ? set.add(id) : set.delete(id);
  try { localStorage.setItem("ccHideExplain", JSON.stringify([...set])); } catch { /* blocked */ }
  const p = document.getElementById(id);
  p.querySelector(".cc-explain").hidden = !!h;
  p.querySelector(".cc-showex").hidden = !h;
});

// ───────── Command Centre home ─────────
const CARDS = {
  UNIT: [
    ["panel-cmd-status", "cmd_status", "◉", "UNIT STATUS", "Commander · Developer", "Tell everyone what the unit is doing right now, and open or close recruitment.", "going on deployment, standing down, maintenance, or pausing sign-ups.", "status"],
    ["panel-cmd-sitrep", "cmd_sitrep", "✉", "SITREP", "Commander · Officer", "Post a situation report — orders, news or priorities — for your staff.", "before an op, after a big change, or for weekly orders.", "sitrep"],
    ["panel-cmd-staff", "cmd_staff", "♟", "COMMAND STAFF", "Commander", "See your leadership team at a glance — who holds which role and who is active.", "checking cover before an op, or reviewing who is inactive.", "staff"],
    ["panel-cmd-promote", "cmd_promote", "▲", "COMMAND PROMOTIONS", "Commander", "Give command-tier roles — Officer, Developer — with a record.", "appointing new leadership. Normal ranks are in the Roster.", "promote"],
    ["panel-cmd-suspend", "cmd_suspend", "⛔", "SUSPENSIONS", "Commander · Developer", "Block someone from the Terminal for a while, with a reason and an end date.", "investigations or serious conduct. Discord-only: use Moderation.", "suspend"],
    ["panel-roster", "roster", "↻", "MONTHLY RESET", "Staff NCO+", "Done by Cortana at 00:00 on the 1st. Shown here so you can see it ran.", "checking the month rolled over.", "reset"],
  ],
  SYSTEM: [
    ["panel-overall", "ovr", "◎", "OVERALL STATUS", "Commander · Developer", "Health of the website, database, Cortana and Discord in one view.", "something seems slow or broken.", "overall"],
    ["panel-bot", "bot", "▶", "BOT SERVER", "Developer", "Cortana's process: ping, memory, jobs, errors, restart.", "Cortana isn't replying, or after an update.", "bot"],
    ["panel-cmd-cortana", "set", "◆", "CORTANA SETUP", "Commander · Developer", "Which Discord channels Cortana posts to: events, logs, AARs, welcome.", "a new channel is made, or posts go to the wrong place.", null],
    ["panel-cmd-rolesync", "set", "⇄", "DISCORD ROLE SYNC", "Commander · Developer", "Keeps Discord roles matching the website ranks and roles.", "someone's Discord roles look wrong.", null],
    ["panel-cmd-settings", "set", "⚙", "SETTINGS", "Commander · Developer", "Discord invite, webhooks, Cortana presence, the Discord role map.", "changing the invite link or a webhook.", null],
    ["panel-auditv2", "audit", "☍", "AUDIT LOG", "Officer+", "Everything that happened — website, Discord, Hub.", "\"who changed this?\"", "audit"],
  ],
};
const D = {};
async function loadHome() {
  const safe = (p) => p.catch(() => null);
  const [st, fr, us, rm, cort, grants] = await Promise.all([
    safe(getDoc(doc(db, "unit_config", "status"))), safe(getDocs(query(collection(db, "fragos"), orderBy("createdAt", "desc"), limit(20)))), safe(getUsers()),
    safe(getDoc(doc(db, "settings", "roster_meta"))), safe(cortanaStatus()),
    ["commander", "developer"].includes(me?.role) ? safe(fetch("/api/terminal/cmd-access", { cache: "no-store" }).then((r) => r.json())) : null,
  ]);
  D.status = st?.data() || {};
  D.fragos = fr ? fr.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  D.users = us || [];
  D.reset = rm?.data() || {};
  D.cort = cort || {};
  D.grants = grants?.grants || null;
  renderHome();
}
function live(k) {
  const u = D.users, staff = u.filter((x) => ["nco", "staff_nco", "officer", "developer", "commander"].includes(x.role));
  if (k === "status") { const [l, c] = OPS[D.status.opStatus] || ["NOT SET", "#7d8a99"]; return [tag(l, c) + tag(D.status.recruitmentOpen !== false ? "RECRUITING" : "RECRUITMENT CLOSED", D.status.recruitmentOpen !== false ? "#22e07a" : "#ff4d4d"), D.status.updatedAt ? "Changed " + ago(D.status.updatedAt) : ""]; }
  if (k === "sitrep") { const p = D.fragos.find((f) => f.pinned) || D.fragos[0]; return [tag(`${D.fragos.filter((f) => f.pinned).length} PINNED`, "#00D9FF") + tag(`${D.fragos.length} SENT`, "#7d8a99"), p ? `Last: "${esc(String(p.title || "").slice(0, 30))}"` : "None yet"]; }
  if (k === "staff") return [tag(`${staff.filter((x) => x.role === "commander").length} COMMANDER`, "#f59e0b") + tag(`${staff.filter((x) => x.role === "officer").length} OFFICERS`, "#a78bfa") + tag(`${staff.length} NCO+`, "#00D9FF"), ""];
  if (k === "promote") return [tag(`${staff.filter((x) => ["officer", "developer"].includes(x.role)).length} COMMAND-TIER`, "#22e07a"), ""];
  if (k === "suspend") { const s = u.filter((x) => x.suspended === true); return [tag(`${s.length} SUSPENDED`, s.length ? "#ff4d4d" : "#7d8a99"), ""]; }
  if (k === "reset") { const cur = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7); const ok = (D.reset.lastAttendanceReset || "") >= cur; return [tag(ok ? "✓ THIS MONTH DONE" : "⚠ NOT RUN", ok ? "#22e07a" : "#ff4d4d"), D.reset.lastResetBy ? "By " + esc(D.reset.lastResetBy) : ""]; }
  if (k === "overall" || k === "bot") return [D.cort.online ? tag(`● ${D.cort.pingMs ?? "—"} MS`, "#22e07a") + (k === "bot" ? tag(`${D.cort.errors24h ?? 0} ERRORS`, "#7d8a99") : "") : tag(D.cort.lastHeartbeatISO ? "✕ CORTANA OFFLINE" : "NOT RUNNING", "#ff4d4d"), ""];
  return ["", ""];
}
function renderHome() {
  const root = document.getElementById("ccHome");
  if (!root || !me) return;
  const a = me.access;
  const [ol, oc] = OPS[D.status.opStatus] || ["NOT SET", "#7d8a99"];
  const rOpen = D.status.recruitmentOpen !== false;
  const p = D.fragos.find((f) => f.pinned) || D.fragos[0];
  const card = ([panel, key, ic, t, who, what, when, lk]) => {
    if (!a[key]) return "";
    const [tags, foot] = lk ? live(lk) : ["", ""];
    return `<div class="cc-card"><div class="cc-t"><span class="cc-ic" aria-hidden="true">${ic}</span><div><h3>${t}</h3><div class="cc-who">${esc(who).toUpperCase()}</div></div></div>
      <p>${esc(what)}</p><div class="cc-when">USE WHEN: ${esc(when)}</div><div class="cc-now">${tags}</div>
      <div class="cc-ft"><span class="cc-k">${foot}</span><span style="flex:1"></span><button type="button" class="b sm cmd" data-go="${panel}">OPEN →</button></div></div>`;
  };
  const isOwner = ["commander", "developer"].includes(me.role);
  const g = D.grants?.filter((x) => x.active) || [];
  const soon = g.filter((x) => x.untilISO && Date.parse(x.untilISO) - Date.now() < 3 * 864e5).length;
  let first = false;
  try { first = !localStorage.getItem("ccTourSeen"); } catch { /* blocked */ }
  root.innerHTML = `
    <div class="cc-hd" id="ccHead"><div class="cc-star" aria-hidden="true">★</div><div><h1>COMMAND CENTRE</h1><div class="cc-k">${esc(String(me.role).toUpperCase())} · EVERYTHING THAT RUNS THE UNIT, IN ONE PLACE</div></div><span style="flex:1"></span><button type="button" class="b gold" data-tourpage="panel-cmd-home" id="ccTourBtn">▶ START TOUR</button><button type="button" class="b" data-go="panel-help">HELP</button></div>
    ${first ? `<div class="cc-first"><span aria-hidden="true">👋</span><span style="flex:1"><b>FIRST TIME HERE?</b> The short tour shows what each part does. Restart it any time from ▶ START TOUR or HELP.</span><button type="button" class="b gold" data-tourpage="panel-cmd-home">▶ TAKE THE TOUR</button><button type="button" class="b sm" data-notnow>NOT NOW</button></div>` : ""}
    <div class="cc-status" id="ccStatus">
      <div style="--acc:${oc}"><span>UNIT STATUS</span><b style="color:${oc}">◉ ${ol}</b><small>Shown on the website and dashboard</small></div>
      <div style="--acc:${rOpen ? "#22e07a" : "#ff4d4d"}"><span>RECRUITMENT</span><b style="color:${rOpen ? "#22e07a" : "#ff4d4d"}">${rOpen ? "● OPEN" : "○ CLOSED"}</b><small>${rOpen ? "Sign-up page is live" : "Sign-up page is closed"}</small></div>
      <div style="--acc:#00D9FF"><span>LATEST SITREP</span><b>${p ? `"${esc(String(p.title || "SITREP").toUpperCase().slice(0, 26))}"` : "NONE"}</b><small>${p?.createdAt ? ukDate(p.createdAt) : "—"}</small></div>
      <div style="--acc:${D.cort.online ? "#22e07a" : "#ff4d4d"}"><span>SYSTEMS</span><b style="color:${D.cort.online ? "#22e07a" : "#ff4d4d"}">${D.cort.online ? "● CORTANA ONLINE" : "✕ CORTANA OFFLINE"}</b><small>Website · Database · Cortana · Discord</small></div></div>
    ${CARDS.UNIT.some(([, k]) => a[k]) ? `<div class="cc-sec" id="ccUnit"><h2>UNIT — RUN THE 505TH</h2><i></i></div><div class="cc-cards">${CARDS.UNIT.map(card).join("")}
      ${isOwner ? `<div class="cc-card gold"><div class="cc-t"><span class="cc-ic" aria-hidden="true">🔑</span><div><h3>COMMAND ACCESS</h3><div class="cc-who">COMMANDER ONLY</div></div></div><p>Decide who else can use the Command Centre — and which parts.</p><div class="cc-when">USE WHEN: an officer covers for you, or someone needs one tool (e.g. SITREP only).</div><div class="cc-now">${tag(`${g.length} PEOPLE`, "#ffd166")}${soon ? tag(`${soon} END SOON`, "#f59e0b") : ""}</div><div class="cc-ft"><span style="flex:1"></span><button type="button" class="b sm cmd" data-go="panel-cmd-access">OPEN →</button></div></div>` : ""}</div>` : ""}
    ${CARDS.SYSTEM.some(([, k]) => a[k]) ? `<div class="cc-sec" id="ccSys"><h2>SYSTEM — KEEP IT RUNNING</h2><i></i></div><div class="cc-cards">${CARDS.SYSTEM.map(card).join("")}</div>` : ""}`;
}

// ───────── Command Access ─────────
let A = { grants: [], members: [] }, form = null;
async function loadAccess() {
  const r = await fetch("/api/terminal/cmd-access", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { document.querySelector("#ccAccess .body").innerHTML = `<div class="empty">🔒 ${esc(j.error || "ONLY THE COMMANDER CAN OPEN THIS PAGE")}</div>`; return; }
  A = j;
  renderAccess();
}
function renderAccess() {
  const root = document.querySelector("#ccAccess .body");
  if (!root) return;
  const until = (iso) => { if (!iso) return '<span class="cc-k">NO END</span>'; const d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return `<span style="color:${d <= 3 ? "#f59e0b" : "#c6d0da"}">${ukDate(iso).toUpperCase()}</span> <span class="cc-k">(${d > 0 ? d + " day" + (d === 1 ? "" : "s") : "ended"})</span>`; };
  const what = (keys) => keys.length === PARTS.length ? tag("FULL", "#22e07a") : keys.map((k) => tag((PART_L[k] || k).replace(/^\S+\s/, "").split(" · ")[0].toUpperCase(), "#00D9FF")).join("");
  root.innerHTML = `
    <div class="cc-sec" style="margin-top:0"><h2 style="color:#fff;font-size:12px">WHO HAS ACCESS NOW</h2><i></i><button type="button" class="b gold sm" data-cca="new">＋ GIVE ACCESS</button></div>
    <table class="cc-t2"><thead><tr><th>MEMBER</th><th>ACCESS</th><th>UNTIL</th><th>GIVEN</th><th></th></tr></thead><tbody>
      <tr><td><b>Commander & Developers</b><div class="cc-k">BY ROLE</div></td><td>${tag("★ ALWAYS — FULL", "#ffd166")}</td><td class="cc-k">—</td><td class="cc-k">—</td><td></td></tr>
      ${A.grants.map((g) => `<tr class="${g.active ? "" : "off"}"><td><b>${esc(g.name)}</b><div class="cc-k">${esc(String(g.role).replace("_", " ").toUpperCase())}${g.active ? "" : " · ENDED"}</div></td><td>${what(g.keys)}</td><td>${until(g.untilISO)}</td>
        <td class="cc-k">${esc(g.by)}${g.atISO ? " · " + ukDate(g.atISO) : ""}${g.reason ? `<br>"${esc(g.reason)}"` : ""}</td><td style="white-space:nowrap"><button type="button" class="b sm" data-cca="edit" data-uid="${esc(g.uid)}">EDIT</button> <button type="button" class="b sm red" data-cca="rm" data-uid="${esc(g.uid)}">REMOVE</button></td></tr>`).join("")}
    </tbody></table>
    ${form ? formHtml() : ""}
    <p class="cc-k" style="margin-top:12px">SAFETY: only the Commander (and Developers, for support) can open this page. Nobody can give themselves access. Command Access itself and the Commander role can never be given here. Promotions stay limited by the person's own role.</p>`;
}
function formHtml() {
  const f = form;
  const custom = f.mode === "custom";
  const end = f.untilISO ? ukDate(f.untilISO).toUpperCase() : "no end";
  const who = A.members.find((m) => m.uid === f.uid);
  return `<div class="cc-form" id="ccForm"><b class="cc-gold">${f.edit ? "✎ CHANGE ACCESS" : "＋ GIVE ACCESS"}</b>
    <label class="cc-l" for="ccWho">1 · WHO</label><select class="fld" id="ccWho" ${f.edit ? "disabled" : ""}><option value="">— pick member —</option>${A.members.map((m) => `<option value="${esc(m.uid)}" ${m.uid === f.uid ? "selected" : ""}>${esc(m.name)} · ${esc(String(m.role).replace("_", " ").toUpperCase())}</option>`).join("")}</select>
    <span class="cc-l">2 · HOW MUCH</span><div class="cc-mode"><button type="button" class="${custom ? "" : "on"}" data-mode="full" aria-pressed="${!custom}"><b>FULL</b><small>Every Command page</small></button><button type="button" class="${custom ? "on" : ""}" data-mode="custom" aria-pressed="${custom}"><b>CUSTOM</b><small>Only what you tick</small></button></div>
    ${custom ? `<div class="cc-parts">${PARTS.map(([k, l]) => `<label><input type="checkbox" data-part="${k}" ${f.keys.includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>` : ""}
    <span class="cc-l">3 · UNTIL <span class="cc-k">(OPTIONAL — ENDS BY ITSELF)</span></span><div class="cc-row">${[[7, "1 WEEK"], [14, "2 WEEKS"], [30, "1 MONTH"]].map(([d, l]) => `<button type="button" class="b sm" data-days="${d}">${l}</button>`).join("")}<input class="fld" type="date" id="ccDate" value="${f.untilISO ? f.untilISO.slice(0, 10) : ""}" aria-label="End date" style="width:auto"><button type="button" class="b sm" data-days="0">NO END</button></div>
    <label class="cc-l" for="ccWhy">4 · REASON <span class="cc-k">(SHOWN TO THEM AND IN THE AUDIT LOG)</span></label><input class="fld" id="ccWhy" maxlength="200" value="${esc(f.reason)}" placeholder="e.g. Posting SITREPs while I'm on leave">
    <div class="cc-prev"><span class="cc-k">PREVIEW</span><br><b>${who ? esc(who.name) : "—"}</b> will see <b>COMMAND</b> in the menu with <b>${custom ? (f.keys.length ? f.keys.map((k) => esc((PART_L[k] || k).replace(/^\S+\s/, ""))).join(", ") : "nothing yet") : "every Command page"}</b> · ends <b>${esc(end)}</b> · they get a notification now.</div>
    <div class="cc-row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="b" data-cca="cancel">CANCEL</button><button type="button" class="b gold" data-cca="save">🔑 ${f.edit ? "SAVE CHANGES" : "GIVE ACCESS"}</button></div></div>`;
}
function readForm() {
  const f = form;
  if (!f) return;
  const w = document.getElementById("ccWho"); if (w && !f.edit) f.uid = w.value;
  const y = document.getElementById("ccWhy"); if (y) f.reason = y.value;
  const d = document.getElementById("ccDate"); if (d) f.untilISO = d.value ? new Date(d.value + "T23:59:00").toISOString() : null;
  f.keys = f.mode === "custom" ? [...document.querySelectorAll("#ccForm [data-part]:checked")].map((x) => x.dataset.part) : f.keys;
}
async function saveGrant() {
  readForm();
  const f = form;
  if (!f.uid) return notify("PICK A MEMBER", 1);
  if (f.mode === "custom" && !f.keys.length) return notify("TICK AT LEAST ONE PART", 1);
  if (String(f.reason).trim().length < 3) return notify("GIVE A REASON", 1);
  try {
    const r = await fetch("/api/terminal/cmd-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: f.uid, keys: f.mode === "full" ? "full" : f.keys, untilISO: f.untilISO, reason: f.reason.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Could not save");
    notify("🔑 COMMAND ACCESS SAVED");
    form = null;
    loadAccess();
  } catch (e) {
    notify(e.message.toUpperCase(), 1);
  }
}

const CSS = `
#ccHome,#ccAccess{font-family:'Share Tech Mono',monospace;color:#d6dde6}
.cc-k{font-size:10px;letter-spacing:1.5px;color:#7d8a99}.cc-gold{color:#ffd166;letter-spacing:2px;font-weight:400}
#ccHome .b.cmd,#ccAccess .b.cmd{border-color:#f59e0b;color:#f59e0b}#ccAccess .b.red{border-color:#ff4d4d;color:#ff4d4d}
.cc-hd{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:16px 18px;border:1px solid rgba(245,158,11,.35);background:linear-gradient(110deg,rgba(245,158,11,.12),rgba(245,158,11,.02) 50%,transparent),#0b0f15;margin-bottom:12px}
.cc-hd h1{margin:0;font:700 24px Rajdhani,sans-serif;letter-spacing:5px;color:#f59e0b}
.cc-star{width:52px;height:58px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(135deg,#f59e0b,#4a2a0a);display:grid;place-items:center;font-size:24px;color:#041014}
.cc-first{border:1px solid rgba(255,209,102,.5);background:linear-gradient(90deg,rgba(255,209,102,.1),transparent);padding:12px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.cc-first b{color:#ffd166;font-weight:400;letter-spacing:1px}
.cc-status{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.cc-status>div{border:1px solid rgba(0,217,255,.16);background:#0b0f15;padding:12px 14px;position:relative}.cc-status>div:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--acc)}
.cc-status b{display:block;font:700 17px Rajdhani,sans-serif;color:#fff;letter-spacing:2px}.cc-status span{font-size:9.5px;letter-spacing:1.5px;color:#7d8a99}.cc-status small{display:block;font-size:10.5px;color:#c6d0da;margin-top:2px}
.cc-sec{display:flex;align-items:center;gap:10px;margin:18px 0 10px}.cc-sec h2{margin:0;font:700 14px Rajdhani,sans-serif;letter-spacing:4px;color:#f59e0b}.cc-sec i{flex:1;height:1px;background:rgba(245,158,11,.3)}
.cc-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.cc-card{border:1px solid rgba(0,217,255,.16);background:#0b0f15;padding:14px;display:flex;flex-direction:column;gap:8px}.cc-card:hover{border-color:#f59e0b}.cc-card.gold{border-color:rgba(255,209,102,.5)}
.cc-t{display:flex;gap:10px;align-items:center}.cc-ic{width:38px;height:38px;border:1px solid rgba(245,158,11,.45);display:grid;place-items:center;color:#f59e0b;font-size:17px;flex-shrink:0}.cc-card.gold .cc-ic{border-color:#ffd166;color:#ffd166}
.cc-card h3{margin:0;font:700 15px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}.cc-who{font-size:9.5px;letter-spacing:1.5px;color:#7d8a99}
.cc-card p{margin:0;font-size:12px;color:#c6d0da}.cc-when{font-size:11px;color:#7d8a99;border-left:2px solid rgba(245,158,11,.45);padding-left:8px}
.cc-now{display:flex;gap:6px;flex-wrap:wrap;min-height:18px}.cc-chip{font-size:9.5px;letter-spacing:1px;padding:2px 7px;border:1px solid currentColor}
.cc-ft{display:flex;gap:6px;align-items:center;margin-top:auto}
.cc-explain{margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(0,217,255,.25);background:rgba(0,217,255,.04);font-size:12px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;font-family:'Share Tech Mono',monospace}
.cc-explain b{color:#00D9FF;font-weight:400;letter-spacing:1px}.cc-explain ul{margin:4px 0 0;padding-left:16px;color:#c6d0da}.cc-explain li b{color:#fff}.cc-ex-b{display:flex;gap:6px}
.cc-showex{all:unset;cursor:pointer;font-size:10px;letter-spacing:1.5px;color:#7d8a99;margin:6px 0 10px;display:inline-block}.cc-showex:hover{color:#00D9FF}.cc-showex[hidden]{display:none}
.cc-t2{width:100%;border-collapse:collapse;font-size:12px;border:1px solid rgba(0,217,255,.16);background:#0b0f15}.cc-t2 th{text-align:left;font-size:9.5px;letter-spacing:2px;color:#7d8a99;font-weight:400;padding:8px 10px;border-bottom:1px solid rgba(0,217,255,.16)}
.cc-t2 td{padding:9px 10px;border-bottom:1px solid rgba(0,217,255,.07);vertical-align:top}.cc-t2 td b{color:#fff;font-weight:400}.cc-t2 tr.off{opacity:.5}
.cc-form{border:1px solid #ffd166;background:#0e131b;padding:14px;margin-top:14px}
.cc-l{display:block;font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin:14px 0 5px}
.cc-mode{display:flex;gap:6px}.cc-mode button{all:unset;cursor:pointer;flex:1;border:1px solid rgba(0,217,255,.16);background:#0b0f15;padding:10px;text-align:center}.cc-mode button.on{border-color:#22e07a;box-shadow:inset 0 -3px 0 #22e07a}.cc-mode b{display:block;font:700 13px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}.cc-mode small{font-size:10px;color:#7d8a99}
.cc-parts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:12px}.cc-parts label{display:flex;gap:8px;align-items:center;cursor:pointer}.cc-parts input{accent-color:#22e07a;width:16px;height:16px}
.cc-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cc-prev{border:1px dashed rgba(0,217,255,.32);padding:10px 12px;margin-top:12px;font-size:11.5px}.cc-prev b{color:#fff;font-weight:400}
#ccHome button:focus-visible,#ccAccess button:focus-visible,.cc-explain button:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
@media(max-width:1000px){.cc-cards{grid-template-columns:1fr 1fr}.cc-status{grid-template-columns:1fr 1fr}}@media(max-width:640px){.cc-cards,.cc-parts{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("ccV3", CSS);
  onAccess((m) => {
    me = m;
    renderHome();
    // "What is this?" boxes on every Command page (pages draw themselves; add once they exist).
    const add = () => Object.keys(EXPLAIN).forEach((id) => { const p = document.getElementById(id); if (p) addExplain(p); });
    add();
    for (const id of Object.keys(EXPLAIN)) {
      const p = document.getElementById(id);
      if (p) new MutationObserver(() => !p.classList.contains("hidden") && addExplain(p)).observe(p, { attributes: true, attributeFilter: ["class"], childList: true });
    }
  });
  const home = mountPanel("panel-cmd-home", "ccHome", () => loadHome().catch((e) => notify("COMMAND CENTRE LOAD FAILED: " + e.message, 1)));
  home?.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) return window.showPanel?.(g.dataset.go);
    if (e.target.closest("[data-notnow]")) { try { localStorage.setItem("ccTourSeen", "1"); } catch { /* blocked */ } return renderHome(); }
    if (e.target.closest("[data-tourpage]")) { try { localStorage.setItem("ccTourSeen", "1"); } catch { /* blocked */ } }
  });
  const acc = mountPanel("panel-cmd-access", "ccAccess", () => loadAccess().catch((e) => notify("COMMAND ACCESS LOAD FAILED: " + e.message, 1)));
  if (acc) {
    acc.innerHTML = '<div class="h1">COMMAND ACCESS</div><div class="sub">COMMANDER ONLY — WHO ELSE CAN USE THE COMMAND CENTRE, AND WHICH PARTS</div><div class="body"><div class="empty">LOADING…</div></div>';
    acc.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cca],[data-mode],[data-days]");
      if (!b) return;
      if (b.dataset.mode) { readForm(); form.mode = b.dataset.mode; if (form.mode === "custom" && !form.keys.length) form.keys = ["cmd_sitrep"]; return renderAccess(); }
      if (b.dataset.days != null) { readForm(); const d = +b.dataset.days; form.untilISO = d ? new Date(Date.now() + d * 864e5).toISOString() : null; return renderAccess(); }
      const a = b.dataset.cca;
      if (a === "new") { form = { uid: "", mode: "custom", keys: ["cmd_sitrep", "cmd_status"], untilISO: null, reason: "", edit: false }; renderAccess(); return document.getElementById("ccWho")?.focus(); }
      if (a === "edit") { const g = A.grants.find((x) => x.uid === b.dataset.uid); form = { uid: g.uid, mode: g.keys.length === PARTS.length ? "full" : "custom", keys: [...g.keys], untilISO: g.untilISO, reason: g.reason, edit: true }; return renderAccess(); }
      if (a === "cancel") { form = null; return renderAccess(); }
      if (a === "save") return saveGrant();
      if (a === "rm") {
        const g = A.grants.find((x) => x.uid === b.dataset.uid);
        if (!(await ask({ kind: "warn", title: "REMOVE COMMAND ACCESS?", body: "They lose every Command page straight away.", item: g?.name, go: "REMOVE" }))) return;
        const r = await fetch("/api/terminal/cmd-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: b.dataset.uid, remove: true }) });
        if (!r.ok) return notify(((await r.json().catch(() => ({}))).error || "Could not remove").toUpperCase(), 1);
        notify("COMMAND ACCESS REMOVED");
        return loadAccess();
      }
    });
    acc.addEventListener("change", (e) => { if (form && ["ccWho", "ccDate"].includes(e.target.id) || e.target.dataset?.part) { readForm(); renderAccess(); } });
  }
});
