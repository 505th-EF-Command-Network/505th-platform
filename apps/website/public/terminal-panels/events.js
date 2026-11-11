/**
 * EVENTS + ATTENDANCE CHECK (approved mock 2026-11-09) — #panel-events.
 * Same flow as Rev Creative Developer: 4 steps (Location → Details → Sign-ups → Review)
 * with a live Discord preview, presets and up to 5 custom sign-up buttons.
 *
 * Data: `community_events`. Discord work (scheduled event + sign-up post) is queued in
 * `bot_jobs` for Cortana v2 — until Cortana v2 runs, events show "WAITING FOR CORTANA".
 *
 * Attendance link: creating an event can also create its `attendance_events` record
 * (linkedEventId). Sign-ups are only a guide: NCO+ ticks who really turned up in the
 * Attendance Check (attendees = present, noShow = no-show). Locking uses the ORIGINAL
 * lock (saveAttendance(true)) so stats recalculate exactly as before.
 */
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp, updateDoc } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, audit, closeModal, db, esc, getMe, getUsers, isMember, memberName, mountPanel, notify, onReady, openModal, rankOrder } from "./_common.js";
import { ask, tell } from "./_common.js";
import { cortanaJob } from "./discord-common.js";

/* Sign-up channels come from COMMAND → Cortana Setup (settings/cortana.signupChannels, IDs).
 * Until that is saved, the 6 official 505th channels are matched by name (emoji / dashes ignored). */
let cortanaCfg = {};
const SIGNUP_CHANNELS = ["killjoy-1-1", "killjoy-1-2", "jtf-23", "hm", "pilots", "event-schedule"];
let discordChans = [];
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Discord channel ID for a label, or "" if not synced / not found. */
function chanFor(label) {
  const n = norm(label);
  const text = discordChans.filter((c) => c.type === "text" || c.type === "announcement");
  const hit = text.find((c) => norm(c.name) === n) || (n.length > 2 ? text.find((c) => norm(c.name).endsWith(n)) : null);
  return hit ? hit.id : "";
}
/** [label, id] pairs for the wizard: Cortana Setup list first, else the official names. */
const signupList = () => Array.isArray(cortanaCfg.signupChannels) && cortanaCfg.signupChannels.length
  ? cortanaCfg.signupChannels.map((id) => [discordChans.find((c) => c.id === id)?.name || "deleted", discordChans.some((c) => c.id === id) ? id : ""])
  : SIGNUP_CHANNELS.map((c) => [c, chanFor(c)]);
/** Voice / stage pick list from Cortana Setup (names, so old events still match). */
const vcList = (kind) => (cortanaCfg[kind === "stage" ? "stageChannels" : "voiceChannels"] || []).map((id) => discordChans.find((c) => c.id === id)?.name).filter(Boolean);
const chanLabel = (ref) => { const c = discordChans.find((x) => x.id === ref); return c ? c.name : String(ref || "").replace(/^#/, ""); };

const ROOT = "evV2";
const LIMITS = { title: 100, description: 1000, location: 100, maxGoing: 500, buttons: 5, buttonLabel: 40 };
const PRESETS = [
  ["Going / Can't go", [["✅", "Going", "green", 0, true], ["❌", "Can't go", "grey", 0, false]]],
  ["BLUFOR / OPFOR", [["🔵", "BLUFOR", "blue", 0, true], ["🔴", "OPFOR", "red", 0, true], ["❌", "Can't make it", "grey", 0, false]]],
  ["Attend / Can't make it", [["👍", "Attend", "green", 0, true], ["👎", "Can't make it", "grey", 0, false]]],
];
const REPEAT = { none: "Does not repeat", weekly: "Every week", fortnightly: "Every 2 weeks" };
const ATT_TYPES = { main_op: "Main Op", patrol: "Patrol", training: "Training", fun_op: "Fun Op" };
const STEPS = ["LOCATION", "DETAILS", "SIGN-UPS", "REVIEW"];
const mkB = (a) => ({ emoji: a[0], label: a[1], style: a[2], limit: a[3], attending: a[4] });

let events = [];
let attById = new Map();
let members = [];
let acc = {};
onAccess((me) => (acc = me.access));

/* ─────────────────────────────── time (UK) ─────────────────────────────── */
/** "2026-11-21" + "19:00" in UK time → Date (handles GMT/BST). */
function ukToDate(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const [h, m] = fmt.format(guess).split(":").map(Number);
  const [wh, wm] = time.split(":").map(Number);
  return new Date(guess.getTime() - ((h * 60 + m) - (wh * 60 + wm)) * 60000);
}
const ukFmt = (iso, opts) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...opts });
const whenLabel = (e) =>
  e.date ? `${new Date(`${e.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${e.startTime}–${e.endTime}` : "Choose a date";
const whereLabel = (e) => (e.where === "else" ? `📍 ${e.location || "Somewhere else"}` : `${e.where === "stage" ? "🎙" : "🔊"} ${e.voiceChannel || (e.where === "stage" ? "Stage channel" : "Voice channel")}`);

/* ─────────────────────────────────── list ─────────────────────────────────── */
async function load() {
  const [evSnap, atSnap, us] = await Promise.all([getDocs(collection(db, "community_events")), getDocs(collection(db, "attendance_events")), members.length ? null : getUsers()]);
  discordChans = (await getDocs(collection(db, "discord_channels")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? discordChans;
  cortanaCfg = (await getDoc(doc(db, "settings", "cortana")).catch(() => null))?.data?.() || {};
  const hb = (await getDoc(doc(db, "bot_status", "cortana")).catch(() => null))?.data?.();
  cortanaOnline = hb?.lastHeartbeatISO ? Date.now() - Date.parse(hb.lastHeartbeatISO) < 3 * 60000 : null;
  if (us) members = us.filter(isMember).sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank) || memberName(a).localeCompare(memberName(b)));
  events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  attById = new Map(atSnap.docs.filter((d) => d.data().linkedEventId).map((d) => [d.id, { id: d.id, ...d.data() }]));
  renderList();
}

const counts = (e) => (e.buttons || []).map((b) => [b, (e.signups || []).filter((s) => s.choice === b.key).length]);
function attChip(e) {
  const a = e.attendanceEventId && attById.get(e.attendanceEventId);
  if (!a) return "";
  if (a.locked) return `<span class="ch ok">🔒 CHECKED — ${(a.attendees || []).length} ATTENDED</span>`;
  const now = Date.now();
  if (new Date(e.startAtISO).getTime() <= now + 30 * 60000) {
    const su = signedUpUids(e), checked = su.filter((u) => (a.attendees || []).includes(u) || (a.noShow || []).includes(u)).length;
    return `<span class="ch am">▣ ATTENDANCE CHECK OPEN${su.length ? ` — ${checked}/${su.length} CHECKED` : ` — ${(a.attendees || []).length} PRESENT`}</span>`;
  }
  return '<span class="ch ac">▣ ATTENDANCE LINKED</span>';
}
/* Refresh + Live Status (approved mock 2026-11-11) */
const isOpen = (e) => e.status !== "cancelled" && e.status !== "completed" && !e.discord?.closedAtISO && Date.parse(e.endAtISO) > Date.now();
const needsFix = (e) => isOpen(e) && (e.discord?.status === "failed" || e.discord?.status === "queued" || !e.discord?.status || (e.discord?.status === "posted" && e.discord?.missing));
let evTab = "details";
let cortanaOnline = null; // from bot_status/cortana heartbeat (null = unknown)
const discordChip = (e) => e.status === "completed" ? '<span class="ch ok">✓ Completed</span>' : (e.discord?.status === "posted" ? (e.discord?.closedAtISO ? '<span class="ch">🚪 Sign-ups closed</span>' : e.discord?.missing ? '<span class="ch wt">⚠ POST MISSING</span>' : '<span class="ch ok">● Live in Discord</span>') : e.discord?.status === "failed" ? '<span class="ch er">Discord error</span>' : '<span class="ch wt">◷ WAITING FOR CORTANA v2</span>');
const signedUpUids = (e) => {
  const att = new Set((e.buttons || []).filter((b) => b.attending).map((b) => b.key));
  return [...new Set((e.signups || []).filter((s) => att.has(s.choice) && s.uid).map((s) => s.uid))];
};

function row(e) {
  return `<button class="evr ${e.status === "cancelled" ? "dim" : ""}" data-open="${e.id}"><span><b>${esc(e.title)}</b><small>${esc(ukFmt(e.startAtISO, { weekday: "short", day: "2-digit", month: "short" }).toUpperCase())} · ${esc(e.startTime)}–${esc(e.endTime)}</small></span>
    <span class="chips">${e.status === "cancelled" ? '<span class="ch er">Cancelled</span>' : discordChip(e)}${e.repeat && e.repeat !== "none" ? `<span class="ch rp">↻ ${REPEAT[e.repeat]}</span>` : ""}${counts(e)
      .map(([b, n]) => `<span class="ch">${esc(b.emoji)} ${esc(b.label)} ${n}${b.limit ? "/" + b.limit : ""}</span>`)
      .join("")}${attChip(e)}</span></button>`;
}

function renderList() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const now = Date.now();
  const live = events.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) <= now && Date.parse(e.endAtISO) > now);
  const up = events.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > now).sort((a, b) => a.startAtISO.localeCompare(b.startAtISO));
  const past = events.filter((e) => !(e.status !== "cancelled" && Date.parse(e.endAtISO) > now)).sort((a, b) => b.startAtISO.localeCompare(a.startAtISO)).slice(0, 30);
  const fix = events.filter(needsFix);
  root.querySelector(".list").innerHTML = `
    ${fix.length && acc.ev !== false ? `<div class="ev-warn" role="status">⚠ <span>${fix.length} EVENT${fix.length === 1 ? "" : "S"} NEED${fix.length === 1 ? "S" : ""} A REFRESH — ${fix.map((e) => esc(e.title)).slice(0, 3).join(", ")}${fix.length > 3 ? "…" : ""}. Cortana also fixes these by itself when it starts.</span><button class="b" data-act="fixall">↻ FIX NOW</button></div>` : ""}
    ${live.length ? `<h3 class="evh live">● HAPPENING NOW</h3>${live.map(row).join("")}` : ""}
    <h3 class="evh">UPCOMING</h3>${up.length ? up.map(row).join("") : '<div class="empty">NO UPCOMING EVENTS</div>'}
    <h3 class="evh">PAST AND CANCELLED</h3>${past.length ? past.map(row).join("") : '<div class="empty">NOTHING YET</div>'}`;
}

/* ───────────────────────────────── wizard ──────────────────────────────── */
let w = null; // { step, v, editId }

function startWizard(edit) {
  const today = new Date().toISOString().slice(0, 10);
  w = {
    step: 0,
    editId: edit?.id || null,
    v: edit
      ? JSON.parse(JSON.stringify({ ...edit, opType: edit.opType || attById.get(edit.attendanceEventId)?.type || "", buttons: edit.buttons.map(({ key, ...b }) => b) }))
      : { where: "voice", voiceChannel: "", location: "", title: "", description: "", date: today, startTime: "19:00", endTime: "22:00", repeat: "none", banner: "", channel: "", buttons: PRESETS[0][1].map(mkB), linkAttendance: true, attType: "main_op", opType: "main_op" },
  };
  const root = document.getElementById(ROOT);
  root.querySelector(".list-wrap").hidden = true;
  root.querySelector(".wiz").hidden = false;
  drawWizard();
  scrollTo(0, 0);
}
function endWizard() {
  const root = document.getElementById(ROOT);
  root.querySelector(".list-wrap").hidden = false;
  root.querySelector(".wiz").hidden = true;
  w = null;
}

function check(s) {
  const v = w.v;
  if (s === 0) {
    if (v.where !== "else" && !v.voiceChannel.trim()) return `Type the ${v.where === "stage" ? "stage" : "voice"} channel name.`;
    if (v.where === "else" && !v.location.trim()) return "Type where the event happens.";
  }
  if (s === 1) {
    if (v.title.trim().length < 3) return "Give the event a title (at least 3 characters).";
    if (!v.date || !v.startTime || !v.endTime) return "Choose the date, start and end time.";
  }
  if (s === 2) {
    if (!v.channel.trim()) return "Pick the channel for the sign-up post.";
    if (!v.buttons.length) return "Add at least one sign-up button.";
    if (v.buttons.some((b) => !b.label.trim())) return "Every button needs a label.";
  }
  return null;
}
function go(to) {
  if (to < 0 || to > 3) return;
  if (to > w.step)
    for (let s = w.step; s < to; s++) {
      const e = check(s);
      if (e) {
        w.step = s;
        return drawWizard(e);
      }
    }
  w.step = to;
  drawWizard();
}

const opt = (key, icon, label, hint) =>
  `<label class="eo ${w.v.where === key ? "on" : ""}"><input type="radio" name="evWhere" value="${key}" ${w.v.where === key ? "checked" : ""}><span><b>${icon} ${label}</b><small>${hint}</small></span></label>`;

function drawWizard(err) {
  const root = document.getElementById(ROOT);
  const v = w.v, s = w.step;
  let body = "";
  if (s === 0)
    body = `<h2 class="eh">WHERE IS YOUR EVENT?</h2><p class="hint">So no one gets lost on where to go.</p>
      ${opt("stage", "🎙", "STAGE CHANNEL", "For bigger events: speakers on stage, everyone else listens.")}
      ${opt("voice", "🔊", "VOICE CHANNEL", "Hang out with voice, video and Screen Share.")}
      ${opt("else", "📍", "SOMEWHERE ELSE", "A game server, an external link or an in-person place.")}
      ${v.where === "else"
        ? `<label class="lbl" for="evLoc">LOCATION</label><input class="fld" id="evLoc" data-k="location" maxlength="${LIMITS.location}" value="${esc(v.location)}" placeholder="e.g. Arma 3 — 505th server">`
        : `<label class="lbl" for="evVc">${v.where === "stage" ? "STAGE" : "VOICE"} CHANNEL</label>${vcList(v.where).length ? `<select class="fld" id="evVc" data-k="voiceChannel"><option value="">— pick a channel —</option>${vcList(v.where).map((n) => `<option ${n === v.voiceChannel ? "selected" : ""}>${esc(n)}</option>`).join("")}${v.voiceChannel && !vcList(v.where).includes(v.voiceChannel) ? `<option selected>${esc(v.voiceChannel)}</option>` : ""}</select>` : `<input class="fld" id="evVc" data-k="voiceChannel" maxlength="100" value="${esc(v.voiceChannel)}" placeholder="e.g. Ops Briefing"><p class="hint">Add voice / stage channels in COMMAND → Cortana Setup to get a pick list here.</p>`}`}`;
  if (s === 1)
    body = `<h2 class="eh">WHAT'S YOUR EVENT ABOUT?</h2><p class="hint">All times are UK time (GMT/BST handled automatically).</p>
      <span class="lbl">OPERATION TYPE</span><div class="pres" role="radiogroup" aria-label="Operation type">${Object.entries(ATT_TYPES).map(([k, l]) => `<button class="pill" role="radio" aria-checked="${v.opType === k}" data-optype="${k}" style="${v.opType === k ? "border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.12)" : ""}">${l.toUpperCase()}</button>`).join("")}</div>
      <p class="hint">Shown on the homepage, the sign-up post and the Upcoming Events list.</p>
      <label class="lbl" for="evT">EVENT TOPIC</label><input class="fld" id="evT" data-k="title" maxlength="${LIMITS.title}" value="${esc(v.title)}" placeholder="e.g. Weekend Op: Operation Firebreak">
      <div class="g3"><div><label class="lbl" for="evD">DATE</label><input class="fld" type="date" id="evD" data-k="date" value="${esc(v.date)}"></div>
        <div><label class="lbl" for="evS">START</label><input class="fld" type="time" id="evS" data-k="startTime" value="${esc(v.startTime)}"></div>
        <div><label class="lbl" for="evE">END</label><input class="fld" type="time" id="evE" data-k="endTime" value="${esc(v.endTime)}"></div></div>
      <p class="hint">Ends after midnight? Set an earlier end time and it moves to the next day.</p>
      <label class="lbl" for="evR">REPEAT</label><select class="fld" id="evR" data-k="repeat">${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}" ${v.repeat === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <p class="hint">Repeating: 30 minutes after it starts, the next one is created and posted with fresh sign-ups. Set back to "Does not repeat" to stop.</p>
      <label class="lbl" for="evDs">DESCRIPTION (OPTIONAL)</label><textarea class="fld" id="evDs" data-k="description" rows="4" maxlength="${LIMITS.description}">${esc(v.description)}</textarea>
      <label class="lbl" for="evBn">COVER IMAGE URL (OPTIONAL)</label><input class="fld" id="evBn" data-k="banner" value="${esc(v.banner)}" placeholder="Paste an image link from the Gallery">
      <p class="hint">Shown on the sign-up post and as the Discord event cover. Wide images (about 800×320) look best.</p>`;
  if (s === 2)
    body = `<h2 class="eh">SIGN-UPS</h2><p class="hint">Choose the buttons people press under the sign-up post.</p>
      <span class="lbl">POST THE SIGN-UP IN</span><div class="pres" role="radiogroup" aria-label="Sign-up channel">${signupList().map(([c, id]) => { const on = id && v.channel === id; return `<button class="pill${on ? " on" : ""}" role="radio" aria-checked="${on ? "true" : "false"}" data-chan="${esc(id)}" ${id ? "" : 'disabled title="Not found in Discord yet"'} style="${on ? "border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.12)" : ""}">#${esc(c)}</button>`; }).join("")}</div>
      ${signupList().some(([, id]) => id) ? "" : '<p class="hint">Channels appear once Cortana v2 has synced the Discord server. Set them in COMMAND → Cortana Setup.</p>'}
      <span class="lbl">QUICK PRESETS</span><div class="pres">${PRESETS.map((p, i) => `<button class="pill" data-preset="${i}">${p[0]}</button>`).join("")}</div>
      <span class="lbl">BUTTONS (${v.buttons.length}/${LIMITS.buttons})</span>
      <ul class="ebl">${v.buttons
        .map(
          (b, i) => `<li><span class="mv"><button data-mv="${i}:-1" ${i ? "" : "disabled"} aria-label="Move ${esc(b.label || "button")} up">▲</button><button data-mv="${i}:1" ${i < v.buttons.length - 1 ? "" : "disabled"} aria-label="Move ${esc(b.label || "button")} down">▼</button></span>
          <input class="fld" style="text-align:center" data-b="${i}:emoji" value="${esc(b.emoji)}" maxlength="64" aria-label="Emoji" placeholder="🙂">
          <input class="fld" data-b="${i}:label" value="${esc(b.label)}" maxlength="${LIMITS.buttonLabel}" aria-label="Label" placeholder="Label">
          <select class="fld" data-b="${i}:style" aria-label="Colour">${["blue", "green", "red", "grey"].map((st) => `<option value="${st}" ${st === b.style ? "selected" : ""}>${st[0].toUpperCase() + st.slice(1)}</option>`).join("")}</select>
          <input class="fld" type="number" min="0" max="${LIMITS.maxGoing}" data-b="${i}:limit" value="${b.limit || ""}" placeholder="∞" aria-label="Places (empty = no limit)">
          <label class="att" title="Attending: tagged when it starts and counted as going"><input type="checkbox" data-b="${i}:attending" ${b.attending ? "checked" : ""}> ATTENDING</label>
          <button class="rm" data-rm="${i}" aria-label="Remove ${esc(b.label || "button")}">✕</button></li>`,
        )
        .join("")}</ul>
      ${v.buttons.length < LIMITS.buttons ? '<button class="b sm" data-act="addbtn">+ ADD BUTTON</button>' : ""}
      <p class="hint">Places: empty = no limit; a full button greys out. One choice per person — pressing another moves them. "Attending" people are tagged when it starts.</p>
      ${w.editId ? '<p class="hint">Changing buttons keeps sign-ups on buttons that stay in the same position.</p>' : ""}`;
  if (s === 3)
    body = `<h2 class="eh">CHECK AND ${w.editId ? "SAVE" : "CREATE"}</h2><ul class="erv">
      <li>✓ <b>${esc(v.title || "Untitled")}</b> · ${esc(whenLabel(v))} (UK)</li><li>✓ Where: ${esc(whereLabel(v))}</li>
      <li>✓ Discord event in the server's Events list</li>
      <li>✓ Sign-up post in #${esc(chanLabel(v.channel) || "—")} · ${v.buttons.map((b) => `${esc(b.emoji)} ${esc(b.label)}${b.limit ? ` (${b.limit})` : ""}`).join(" · ")}</li>
      <li>✓ ${v.repeat === "none" ? REPEAT.none : REPEAT[v.repeat] + " — next one is created automatically"}</li>
      <li>✓ Attending people tagged at the start · posts removed 30 minutes after</li>
      ${v.linkAttendance ? "<li>✓ <b>Attendance Tracker event created</b> · sign-ups shown as SIGNED UP · NCO+ confirms at the Attendance Check</li>" : '<li style="opacity:.55">✕ No attendance event</li>'}</ul>
      ${w.editId && v.attendanceEventId ? '<p class="hint">Attendance is already linked to this event.</p>' : `<label class="eo ${v.linkAttendance ? "on" : ""}" style="margin-top:16px"><input type="checkbox" id="evLink" ${v.linkAttendance ? "checked" : ""}><span><b>▣ ALSO CREATE ATTENDANCE TRACKER EVENT</b><small>Same title and date. People who press an "Attending" button show as SIGNED UP — not present. An NCO or above ticks who actually turned up at the Attendance Check, then Staff NCO+ locks it.</small></span></label>
      `}
      <p class="hint" style="color:#f59e0b">◷ Cortana v2 isn't running yet: the event is saved now and posted to Discord automatically when Cortana v2 goes live.</p>`;

  root.querySelector(".wiz-form").innerHTML = `
    <ol class="esteps">${STEPS.map((t, i) => `<li><button class="${i < s ? "dn" : i === s ? "cu" : ""}" data-go="${i}" ${i === s ? 'aria-current="step"' : ""}><i></i><b>${i + 1}</b>${t}</button></li>`).join("")}</ol>
    ${body}
    ${err ? `<p class="eerr" role="alert">${esc(err)}</p>` : ""}
    <div class="act">${s > 0 ? '<button class="b" data-act="back">← BACK</button>' : ""}<span style="flex:1"></span>${s < 3 ? '<button class="b gold" data-act="next">NEXT</button>' : `<button class="b gold" data-act="create">${w.editId ? "SAVE EVENT" : "CREATE EVENT"}</button>`}</div>`;
  preview();
}

function preview() {
  const root = document.getElementById(ROOT);
  const v = w.v;
  root.querySelector(".wiz-pv").innerHTML = `<span class="lbl" style="margin-top:0">DISCORD EVENT</span>
    <div class="dev"><div class="dev1"><p class="dvw">📅 ${esc(whenLabel(v))}</p><p class="dvt">${esc(v.title || "Event title")}</p>${v.description ? `<p class="dvd">${esc(v.description.slice(0, 200))}</p>` : ""}</div><p class="dvl">${esc(whereLabel(v))}</p></div>
    <span class="lbl">SIGN-UP POST</span>
    <div class="dsp"><p class="dvt" style="font-size:15px">📌 ${esc(v.title || "Event title")}</p>
      <div class="dsg">${v.buttons.map((b) => `<div><b>${esc(b.emoji)} ${esc(b.label || "Label")}</b><span>0${b.limit ? "/" + b.limit : ""}</span></div>`).join("")}</div>
      <div class="dsb">${v.buttons.map((b) => `<span class="st-${b.style}">${esc(b.emoji)} ${esc(b.label || "Label")}</span>`).join("")}</div></div>`;
}

async function create() {
  for (let s = 0; s < 3; s++) {
    const e = check(s);
    if (e) {
      w.step = s;
      return drawWizard(e);
    }
  }
  const btn = document.querySelector(`#${ROOT} [data-act=create]`);
  btn.disabled = true;
  btn.textContent = "SAVING...";
  const v = w.v;
  const start = ukToDate(v.date, v.startTime);
  let end = ukToDate(v.date, v.endTime);
  if (end <= start) end = new Date(end.getTime() + 86400000);
  const me = await getMe();
  const old = w.editId ? events.find((e) => e.id === w.editId) : null;
  // Keep sign-ups on buttons that stay in the same position (same as RCD).
  const buttons = v.buttons.map((b, i) => ({ key: old?.buttons?.[i]?.key || `b${i + 1}`, emoji: b.emoji.trim(), label: b.label.trim(), style: b.style, limit: Math.max(0, Math.min(LIMITS.maxGoing, +b.limit || 0)), attending: !!b.attending }));
  const keys = new Set(buttons.map((b) => b.key));
  const rec = {
    title: v.title.trim(), description: v.description.trim(), where: v.where, voiceChannel: v.where === "else" ? "" : v.voiceChannel.trim(), location: v.where === "else" ? v.location.trim() : "",
    date: v.date, startTime: v.startTime, endTime: v.endTime, startAtISO: start.toISOString(), endAtISO: end.toISOString(),
    opType: ATT_TYPES[v.opType] ? v.opType : "main_op",
    repeat: v.repeat, banner: v.banner.trim(), channel: v.channel.trim().replace(/^#/, ""), buttons,
    // Sign-ups come from Discord (Cortana saves them). Only touch them when a button was removed,
    // so an edit never wipes sign-ups made while the editor was open.
    ...(!old ? { signups: [] } : (old.signups || []).some((s) => !keys.has(s.choice)) ? { signups: (old.signups || []).filter((s) => keys.has(s.choice)) } : {}),
    updatedAtISO: new Date().toISOString(), updatedByName: memberName(me),
  };
  try {
    let id = w.editId;
    if (id) {
      await updateDoc(doc(db, "community_events", id), rec);
      await audit("discord", "EVENT EDITED", `${rec.title} — ${whenLabel(v)}`);
    } else {
      const ref = await addDoc(collection(db, "community_events"), {
        ...rec, status: "scheduled", attendanceEventId: null, discord: { status: "queued" },
        createdBy: me?.uid || "", createdByName: memberName(me), createdAt: serverTimestamp(), createdAtISO: new Date().toISOString(),
      });
      id = ref.id;
      await audit("discord", "EVENT CREATED", `${rec.title} — ${whenLabel(v)}`);
    }
    if (!old?.attendanceEventId && v.linkAttendance) {
      const at = await addDoc(collection(db, "attendance_events"), {
        title: rec.title, date: rec.date, type: rec.opType, attendees: [], excused: [], noShow: [], locked: false, linkedEventId: id,
        createdBy: me?.callsign || "Staff", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: me?.callsign || "Staff",
      });
      await updateDoc(doc(db, "community_events", id), { attendanceEventId: at.id });
    } else if (old?.attendanceEventId) {
      await updateDoc(doc(db, "attendance_events", old.attendanceEventId), { title: rec.title, date: rec.date, updatedAt: new Date().toISOString() }).catch(() => {});
    }
    // Queue for Cortana v2 (posts / updates the Discord event + sign-up post).
    await addDoc(collection(db, "bot_jobs"), { type: "event.publish", payload: { eventId: id }, status: "pending", requestedBy: me?.uid || "", createdAtISO: new Date().toISOString(), attempts: 0 });
    notify(w.editId ? "✓ EVENT SAVED" : "✓ EVENT CREATED — QUEUED FOR DISCORD");
    endWizard();
    load();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = w.editId ? "SAVE EVENT" : "CREATE EVENT";
    notify("SAVE FAILED: " + e.message, 1);
  }
}

/* ───────────────────────────── delete (same flow as RCD) ─────────────────────────────
 * 1. Ask Cortana to remove the Discord event, the sign-up post and its reminder messages
 *    (job `event.remove`, with the Discord IDs so it works even after the record is gone).
 * 2. Wait up to 30 s for Cortana to finish.
 * 3. Delete the record. The linked attendance record is kept (it may already have stats) and unlinked.
 */
async function waitForJob(id, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const d = (await getDoc(doc(db, "bot_jobs", id)).catch(() => null))?.data();
    if (d && (d.status === "done" || d.status === "failed")) return d;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}
async function deleteEvent(e) {
  if (!(await ask({ kind: "danger", title: "DELETE EVENT?", body: "The Discord event and the sign-up post are deleted, and the event is removed from the website. Sign-ups are lost.", item: e.title, warn: "THIS CANNOT BE UNDONE.", go: "DELETE EVENT" }))) return;
  const btn = document.querySelector('#v2Modal [data-x="delete"]');
  if (btn) { btn.disabled = true; btn.textContent = "DELETING…"; }
  try {
    const me = await getMe();
    const d = e.discord || {};
    let note = "";
    if (d.messageId || d.scheduledEventId) {
      const job = await addDoc(collection(db, "bot_jobs"), {
        type: "event.remove", status: "pending", attempts: 0, requestedBy: me?.uid || "", createdAtISO: new Date().toISOString(),
        payload: { eventId: e.id, title: e.title, channelId: d.channelId || null, messageId: d.messageId || null, scheduledEventId: d.scheduledEventId || null, extraMessageIds: [d.reminderMessageId, d.startMessageId].filter(Boolean) },
      });
      const r = await waitForJob(job.id);
      if (!r) note = " — CORTANA IS OFFLINE: THE DISCORD POST WILL BE REMOVED WHEN IT'S BACK";
      else if (r.status === "failed") note = ` — DISCORD: ${String(r.error || "error").toUpperCase()}`;
    }
    await deleteDoc(doc(db, "community_events", e.id));
    if (e.attendanceEventId) await updateDoc(doc(db, "attendance_events", e.attendanceEventId), { linkedEventId: null }).catch(() => {});
    await audit("discord", "EVENT DELETED", `${e.title} — ${whenLabel(e)}`);
    closeModal();
    notify("✓ EVENT DELETED" + note, !!note);
    load();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "🗑 DELETE"; }
    notify("DELETE FAILED: " + err.message, 1);
  }
}

/** END EVENT: mark completed now; Cortana logs sign-ups to #mission-log, deletes the posts and completes the Discord event. */
async function endEvent(e) {
  if (!(await ask({ kind: "info", title: "END EVENT?", body: "The event is marked completed. Cortana logs the sign-ups to the mission log, removes the sign-up post and ends the Discord event.", item: e.title, go: "END EVENT", cancel: "NOT YET" }))) return;
  const btn = document.querySelector('#v2Modal [data-x="end"]');
  if (btn) { btn.disabled = true; btn.textContent = "ENDING…"; }
  try {
    const me = await getMe();
    const now = new Date().toISOString();
    await updateDoc(doc(db, "community_events", e.id), { status: "completed", completedAtISO: now, endAtISO: now, updatedAtISO: now });
    let note = "";
    if (e.discord?.messageId || e.discord?.scheduledEventId) {
      const job = await addDoc(collection(db, "bot_jobs"), { type: "event.complete", status: "pending", attempts: 0, requestedBy: me?.uid || "", createdAtISO: now, payload: { eventId: e.id } });
      const r = await waitForJob(job.id);
      if (!r) note = " — CORTANA IS OFFLINE: DISCORD WILL UPDATE WHEN IT'S BACK";
      else if (r.status === "failed") note = ` — DISCORD: ${String(r.error || "error").toUpperCase()}`;
    }
    await audit("discord", "EVENT ENDED", `${e.title} — ${whenLabel(e)}`);
    closeModal();
    notify("✓ EVENT ENDED" + note, !!note);
    load();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "✓ END EVENT"; }
    notify("END FAILED: " + err.message, 1);
  }
}

/* ───────────────────────────── event detail ───────────────────────────── */
async function refreshAll(all) {
  if (acc.ev === false) return notify("YOU DON'T HAVE EVENTS ACCESS", 1);
  notify(all ? "↻ REFRESHING ALL SIGN-UP POSTS…" : "↻ FIXING SIGN-UP POSTS…");
  try {
    const r = await cortanaJob("event.refreshAll", { all }, { ms: 60000 });
    if (!r) return notify("◷ CORTANA IS OFFLINE — IT FIXES THEM BY ITSELF WHEN IT'S BACK", 1);
    const x = r.result || {};
    notify(`✓ ${x.fixed || 0} RE-POSTED · ${x.updated || 0} UPDATED${x.failed ? ` · ${x.failed} FAILED` : ""}`, !!x.failed);
    audit("discord", "EVENT POSTS REFRESHED", `${x.fixed || 0} re-posted · ${x.updated || 0} updated`);
  } catch (err) { notify("REFRESH FAILED: " + err.message, 1); }
}
async function refreshOne(e, ping) {
  notify(ping ? "↻ RE-POSTING WITH PING…" : "↻ REFRESHING POST…");
  try {
    const r = await cortanaJob("event.refresh", { eventId: e.id, ping: !!ping }, { ms: 45000 });
    if (!r) return notify("◷ CORTANA IS OFFLINE — IT FIXES THIS BY ITSELF WHEN IT'S BACK", 1);
    const x = r.result || {};
    notify(x.skipped ? "THIS EVENT IS FINISHED — NOTHING TO REFRESH" : x.fixed ? "✓ SIGN-UP POST RE-POSTED" : "✓ SIGN-UP POST UPDATED");
    if (!x.skipped) audit("discord", "EVENT POST REFRESHED", `${e.title}${x.fixed ? " · re-posted" : " · updated"}${ping ? " · with ping" : ""}`);
  } catch (err) { notify("REFRESH FAILED: " + err.message, 1); }
}

/** LIVE STATUS tab: timeline, numbers, sign-ups, system check, activity. */
function liveHtml(e) {
  const d = e.discord || {}, now = Date.now(), start = Date.parse(e.startAtISO), end = Date.parse(e.endAtISO);
  const closeAt = Math.min(start + 30 * 60000, end);
  const going = (e.signups || []).filter((x) => !x.waiting && (e.buttons || []).find((b) => b.key === x.choice)?.attending).length;
  const t = (iso) => (iso ? esc(ukFmt(iso, { weekday: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()) : "");
  const steps = [
    ["POSTED", d.postedAtISO || (d.status === "posted" ? e.createdAtISO : null), d.status === "posted"],
    ["REMINDER", d.reminderSentISO, !!d.reminderSentISO],
    [`STARTED${d.startSentISO ? ` · PINGED ${going}` : ""}`, d.startSentISO || e.startAtISO, !!d.startSentISO],
    ["LOCKED", d.lockedISO || d.startSentISO, !!(d.lockedISO || d.startSentISO)],
    ["CLOSES", d.closedAtISO || new Date(closeAt).toISOString(), !!d.closedAtISO],
    ["MISSION LOG", d.closedAtISO || null, !!d.closedAtISO],
  ];
  const cur = e.status === "cancelled" ? -1 : steps.findIndex((x) => !x[2]);
  const running = e.status !== "cancelled" && now >= start && now < end && !d.closedAtISO && e.status !== "completed";
  const sys = [
    ["Cortana", cortanaOnline === false ? ["er", "● OFFLINE — FIXES ITSELF WHEN BACK"] : cortanaOnline ? ["ok", "● ONLINE"] : ["", "— UNKNOWN"]],
    ["Sign-up post", d.closedAtISO ? ["", "CLOSED · REMOVED"] : d.status !== "posted" ? [d.status === "failed" ? "er" : "wt", d.status === "failed" ? `✕ FAILED${d.error ? " — " + esc(d.error) : ""}` : "◷ WAITING TO POST"] : d.missing ? ["wt", "⚠ MISSING IN DISCORD"] : ["ok", `✓ IN #${esc(chanLabel(d.channelId || e.channel))}${d.startSentISO ? " · 🔒 LOCKED" : ""}`]],
    ["Discord event (calendar)", d.scheduledEventId ? ["ok", "✓ MADE"] : ["", "— NOT MADE"]],
    ["Start ping", d.startSentISO ? ["ok", `✓ SENT ${t(d.startSentISO)} (${going} ${going === 1 ? "PERSON" : "PEOPLE"})`] : ["", now < start ? `◷ AT ${t(e.startAtISO)}` : "— NOT SENT"]],
    ["Attendance record", e.attendanceEventId ? ["ok", "✓ LINKED"] : ["", "— NOT LINKED"]],
  ];
  const bad = isOpen(e) && (d.status !== "posted" || d.missing);
  const feed = [
    ...(e.signups || []).filter((x) => x.atISO).map((x) => [x.atISO, `${esc(x.name)} chose ${esc((e.buttons || []).find((b) => b.key === x.choice)?.emoji || "")} ${esc((e.buttons || []).find((b) => b.key === x.choice)?.label || x.choice)}`]),
    d.postedAtISO && [d.postedAtISO, "Cortana posted the sign-up"],
    d.refreshedAtISO && [d.refreshedAtISO, "Sign-up post refreshed"],
    d.reminderSentISO && [d.reminderSentISO, "Reminder posted"],
    d.startSentISO && [d.startSentISO, `Cortana pinged ${going} · post locked 🔒`],
    d.closedAtISO && [d.closedAtISO, "Sign-ups closed · logged to #mission-log"],
    e.createdAtISO && [e.createdAtISO, `Created by ${esc(e.createdByName || "—")}`],
  ].filter(Boolean).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 12);
  const cnt = counts(e);
  const slots = cnt.filter(([b]) => b.limit);
  return `${running ? `<div class="lv-live"><i></i>LIVE · STARTED ${esc(String(Math.max(0, Math.round((now - start) / 60000))))} MIN AGO</div>` : ""}
    <div class="lv-tl">${steps.map(([l, iso, done], i) => `<div class="${done ? "d" : i === cur ? "n" : ""}"><i></i><b>${l}</b>${done || i === cur ? t(iso) : ""}</div>`).join("")}</div>
    <div class="lv-g"><div>
      <div class="lv-tiles">${cnt.map(([b, n]) => `<div><b>${n}${b.limit ? "/" + b.limit : ""}</b><span>${esc(b.emoji)} ${esc(b.label.toUpperCase())}</span></div>`).join("")}${slots.length ? `<div><b>${slots.reduce((a, [, n]) => a + n, 0)}/${slots.reduce((a, [b]) => a + b.limit, 0)}</b><span>SLOTS FILLED</span></div>` : ""}</div>
      <span class="lbl">SIGN-UPS</span>
      <table class="lv-t"><thead><tr><th>MEMBER</th><th>CHOICE</th><th>WHEN</th></tr></thead><tbody>${(e.signups || []).slice().sort((a, b) => String(a.atISO).localeCompare(String(b.atISO))).map((x) => { const b = (e.buttons || []).find((y) => y.key === x.choice); return `<tr><td>${esc(x.name)}</td><td>${esc(b?.emoji || "")} ${esc(b?.label || x.choice)}${x.waiting ? ' <span class="dim">· WAITING LIST</span>' : ""}</td><td class="dim">${x.atISO ? esc(ago2(x.atISO)) : "—"}</td></tr>`; }).join("") || '<tr><td colspan="3" class="dim">No sign-ups yet.</td></tr>'}</tbody></table>
    </div><div>
      <span class="lbl">SYSTEM CHECK</span>
      <ul class="lv-sys">${sys.map(([k, [c, v]]) => `<li><span>${k}</span><span class="${c}">${v}</span></li>`).join("")}</ul>
      ${bad && acc.ev !== false ? `<div class="lv-fix">⚠ Something is out of sync. <button class="b" data-x="refresh">↻ FIX</button><button class="b" data-x="repostping">↻ REPOST WITH PING</button></div>` : ""}
      <span class="lbl" style="margin-top:14px">ACTIVITY</span>
      <ul class="lv-feed">${feed.map(([iso, txt]) => `<li><time>${esc(ago2(iso))}</time>${txt}</li>`).join("") || '<li class="dim">Nothing yet.</li>'}</ul>
    </div></div>`;
}
const ago2 = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min ago` : m < 1440 ? ukFmt(iso, { hour: "2-digit", minute: "2-digit" }) : ukFmt(iso, { weekday: "short", day: "2-digit", month: "short" }); };

function openEvent(id) {
  const e = events.find((x) => x.id === id);
  if (!e) return;
  setTimeout(() => { const m = document.getElementById("v2Modal"); if (m) m.dataset.ev = id; }, 0);
  const a = e.attendanceEventId && attById.get(e.attendanceEventId);
  openModal(
    `<div class="hd"><div><h2>${esc(e.title.toUpperCase())}</h2><small>${esc(ukFmt(e.startAtISO, { weekday: "long", day: "numeric", month: "long" }).toUpperCase())} · ${esc(e.startTime)}–${esc(e.endTime)} UK · ${esc(whereLabel(e))}</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="ev-tabs" role="tablist"><button role="tab" data-evtab="details" class="${evTab === "details" ? "on" : ""}" aria-selected="${evTab === "details"}">DETAILS</button><button role="tab" data-evtab="live" class="${evTab === "live" ? "on" : ""}" aria-selected="${evTab === "live"}">● LIVE STATUS</button></div>
    <div class="bd">${evTab === "live" ? liveHtml(e) : `
      <div class="chips" style="margin-bottom:12px">${e.status === "cancelled" ? '<span class="ch er">Cancelled</span>' : discordChip(e)}${e.repeat !== "none" ? `<span class="ch rp">↻ ${REPEAT[e.repeat]}</span>` : ""}${attChip(e)}</div>
      ${e.description ? `<p style="white-space:pre-wrap;margin:0 0 12px;line-height:1.6">${esc(e.description)}</p>` : ""}
      <span class="lbl">SIGN-UPS · POSTED IN #${esc(chanLabel(e.channel))}</span>
      <div class="sg">${counts(e)
        .map(([b, n]) => `<div><b>${esc(b.emoji)} ${esc(b.label)} <span>${n}${b.limit ? "/" + b.limit : ""}</span></b><small>${(e.signups || []).filter((s) => s.choice === b.key).map((s) => esc(s.name)).join(", ") || "—"}</small></div>`)
        .join("")}</div>
      ${e.discord?.status !== "posted" ? '<p class="hint">Sign-ups arrive from the Discord buttons once Cortana v2 posts this event.</p>' : ""}
      <div class="hint">CREATED BY ${esc(e.createdByName || "—")}${e.updatedByName ? ` · LAST EDIT ${esc(e.updatedByName)}` : ""}</div>`}
    </div>
    <div class="ft"><div style="display:flex;gap:8px">${e.status !== "cancelled" && e.status !== "completed" && acc.ev ? '<button class="b red" data-x="cancel">CANCEL EVENT</button>' : ""}${acc.ev ? '<button class="b red" data-x="delete">🗑 DELETE</button>' : ""}</div>
      <div style="display:flex;gap:8px">${isOpen(e) && acc.ev ? '<button class="b" data-x="refresh" title="Update the Discord sign-up post — re-posts it (no ping) if it was deleted">↻ REFRESH POST</button>' : ""}${e.status !== "cancelled" && e.status !== "completed" && acc.ev && Date.parse(e.startAtISO) <= Date.now() ? '<button class="b" data-x="end" style="border-color:#22e07a;color:#22e07a">✓ END EVENT</button>' : ""}${a && acc.att ? '<button class="b" data-x="check">▣ ATTENDANCE CHECK</button>' : ""}${e.status !== "cancelled" && e.status !== "completed" && acc.ev ? '<button class="b gold" data-x="edit">EDIT</button>' : ""}</div></div>`,
    { width: 720 },
  );
  document.getElementById("v2Modal").addEventListener("click", async (ev) => {
    const tb = ev.target.closest("[data-evtab]");
    if (tb) { evTab = tb.dataset.evtab; return openEvent(e.id); }
    const x = ev.target.closest("[data-x]")?.dataset.x;
    if (x === "refresh") return refreshOne(e, false);
    if (x === "repostping") {
      if (!(await ask({ kind: "warn", title: "REPOST WITH PING?", body: "The sign-up post is posted again and the usual roles are pinged.", item: e.title, go: "REPOST + PING", cancel: "NO" }))) return;
      return refreshOne(e, true);
    }
    if (x === "edit") {
      closeModal();
      startWizard(e);
    }
    if (x === "check") openCheck(e);
    if (x === "delete") return deleteEvent(e);
    if (x === "end") return endEvent(e);
    if (x === "cancel") {
      if (!(await ask({ kind: "warn", title: "CANCEL EVENT?", body: "Cortana marks the Discord event and sign-up post as cancelled.", item: e.title, go: "CANCEL EVENT", cancel: "KEEP IT" }))) return;
      try {
        await updateDoc(doc(db, "community_events", e.id), { status: "cancelled", cancelledAtISO: new Date().toISOString() });
        await addDoc(collection(db, "bot_jobs"), { type: "event.cancel", payload: { eventId: e.id }, status: "pending", createdAtISO: new Date().toISOString(), attempts: 0 });
        await audit("discord", "EVENT CANCELLED", e.title);
        notify("✓ EVENT CANCELLED");
        closeModal();
        load();
      } catch (err) {
        notify("CANCEL FAILED: " + err.message, 1);
      }
    }
  });
}

/* ─────────────────────────── attendance check ─────────────────────────── */
let chk = null; // { e, a, unsub }

function openCheck(e) {
  chk?.unsub?.();
  const a = attById.get(e.attendanceEventId);
  chk = { e, a: { ...a }, unsub: null };
  openModal(`<div class="hd"><div><h2>ATTENDANCE CHECK — ${esc(e.title.toUpperCase())}</h2><small>${esc(ukFmt(e.startAtISO, { weekday: "short", day: "2-digit", month: "short" }).toUpperCase())} · ${esc(e.startTime)}–${esc(e.endTime)} · ${esc((ATT_TYPES[a.type] || a.type || "").toUpperCase())} · CHECKED BY NCO AND ABOVE</small></div><button class="xx" data-close aria-label="Close">✕</button></div><div class="bd ac"></div><div class="ft ac-ft"></div>`, { width: 880 });
  const box = document.getElementById("v2Modal");
  // Live: other NCOs checking at the same time see each other's ticks.
  chk.unsub = onSnapshot(doc(db, "attendance_events", a.id), (s) => {
    if (!chk || !s.exists()) return;
    chk.a = { id: s.id, ...s.data() };
    attById.set(s.id, chk.a);
    drawCheck();
  });
  new MutationObserver((_, o) => {
    if (!document.body.contains(box)) {
      chk?.unsub?.();
      chk = null;
      o.disconnect();
      renderList();
    }
  }).observe(document.body, { childList: true });
  box.addEventListener("click", onCheckClick);
  box.addEventListener("change", onCheckChange);
  drawCheck();
}

function drawCheck() {
  const box = document.getElementById("v2Modal");
  if (!box || !chk) return;
  const { e, a } = chk;
  const present = new Set(a.attendees || []), no = new Set(a.noShow || []);
  const su = signedUpUids(e);
  const extra = [...present].filter((u) => !su.includes(u));
  // Added people stay listed when marked no-show (so it can be corrected).
  const list = [...new Set([...su, ...extra, ...[...no].filter((u) => !su.includes(u))])];
  const byId = new Map(members.map((m) => [m.id, m]));
  const st = (u) => (present.has(u) ? "p" : no.has(u) ? "n" : "");
  const notChecked = su.filter((u) => !st(u)).length;
  const locked = !!a.locked;
  box.querySelector(".ac").innerHTML = `
    <div class="ak"><div><b style="color:#22e07a">${present.size}</b><span>PRESENT</span></div><div><b style="color:#ff4d4d">${no.size}</b><span>NO-SHOW</span></div><div><b style="color:#f59e0b">${notChecked}</b><span>NOT CHECKED</span></div><div><b>${extra.length}</b><span>ADDED (NOT SIGNED UP)</span></div></div>
    <div class="act" style="margin:0 0 10px">${su.length ? `<button class="b sm" data-c="allp" ${locked || !notChecked ? "disabled" : ""}>✓ MARK ALL SIGNED-UP NOT CHECKED AS PRESENT</button>` : '<span class="hint">NO DISCORD SIGN-UPS YET — ADD WHO TURNED UP</span>'}<span style="flex:1"></span>
      <select class="fld" id="acAdd" style="width:auto;margin:0" ${locked ? "disabled" : ""} aria-label="Add a member who turned up"><option value="">+ ADD SOMEONE WHO TURNED UP${su.length ? " WITHOUT SIGNING UP" : ""}…</option>${members.filter((m) => !list.includes(m.id)).map((m) => `<option value="${esc(m.id)}">${esc(memberName(m))}</option>`).join("")}</select></div>
    <div class="acl">${
      list.length
        ? list
            .map((u) => {
              const m = byId.get(u), s = st(u), isSu = su.includes(u);
              return `<div class="acr ${s === "p" ? "ok" : s === "n" ? "no" : "q"}"><span><b>${esc(m ? memberName(m) : u)}</b><small>${isSu ? "SIGNED UP ✅" : "ADDED — NOT SIGNED UP"}</small></span>
              <div class="seg" role="group" aria-label="${esc(m ? memberName(m) : u)}">${[["p", "✓ PRESENT"], ["n", "✕ NO-SHOW"], ["", "? NOT CHECKED"]].map(([k, l]) => `<button class="${s === k ? "on" : ""}" data-set="${esc(u)}:${k}" ${locked ? "disabled" : ""}>${l}</button>`).join("")}</div>
              ${!isSu && !locked ? `<button class="b sm red" data-set="${esc(u)}:x" aria-label="Remove">✕</button>` : "<span></span>"}</div>`;
            })
            .join("")
        : '<div class="empty">NOBODY YET</div>'
    }</div>`;
  box.querySelector(".ac-ft").innerHTML = `<span class="hint" style="margin:0">${locked ? "🔒 LOCKED — PERMANENT RECORD. STATS ARE COUNTED." : notChecked ? `${notChecked} NOT CHECKED YET — THEY COUNT AS ABSENT WHEN LOCKED.` : "SAVES AS YOU CLICK."}</span>
    <div style="display:flex;gap:8px"><button class="b" data-close>CLOSE</button>${acc.lock ? (locked ? '<button class="b" data-c="unlock">🔓 UNLOCK TO CORRECT</button>' : '<button class="b gold" data-c="lock">🔒 LOCK &amp; FINALISE</button>') : ""}</div>`;
}

async function saveCheck(attendees, noShow, msg) {
  const me = await getMe();
  try {
    await updateDoc(doc(db, "attendance_events", chk.a.id), { attendees, noShow, updatedAt: new Date().toISOString(), updatedBy: me?.callsign || "Staff" });
    chk.a = { ...chk.a, attendees, noShow };
    drawCheck();
  } catch (e) {
    notify((msg || "SAVE FAILED") + ": " + e.message, 1);
  }
}

async function onCheckClick(ev) {
  if (!chk) return;
  const set = ev.target.closest("[data-set]");
  if (set) {
    if (chk.a.locked) return;
    const [u, k] = set.dataset.set.split(":");
    const p = (chk.a.attendees || []).filter((x) => x !== u), n = (chk.a.noShow || []).filter((x) => x !== u);
    if (k === "p") p.push(u);
    if (k === "n") n.push(u);
    return saveCheck(p, n);
  }
  const c = ev.target.closest("[data-c]")?.dataset.c;
  if (c === "allp") {
    const su = signedUpUids(chk.e);
    const p = new Set(chk.a.attendees || []), n = new Set(chk.a.noShow || []);
    su.forEach((u) => !p.has(u) && !n.has(u) && p.add(u));
    return saveCheck([...p], [...n]);
  }
  if (c === "lock" || c === "unlock") {
    // Original lock / unlock: recalculates every member's stats exactly like the Attendance Tracker.
    if (typeof window.loadAttEvent !== "function") return notify("ATTENDANCE TRACKER NOT READY", 1);
    await window.loadAttEvent(chk.a.id);
    if (c === "lock") {
      const nc = signedUpUids(chk.e).filter((u) => !(chk.a.attendees || []).includes(u) && !(chk.a.noShow || []).includes(u)).length;
      if (!(await ask({ kind: "warn", title: "LOCK & FINALISE?", body: `${(chk.a.attendees || []).length} present${nc ? ` · ${nc} not checked (count as absent)` : ""}.\nStats are recalculated for everyone.`, item: chk.e.title, go: "LOCK" }))) return;
      await window.saveAttendance(true);
    } else await window.unlockEvent();
    const s = await getDoc(doc(db, "attendance_events", chk.a.id));
    if (s.exists()) chk.a = { id: s.id, ...s.data() };
    drawCheck();
  }
}
function onCheckChange(ev) {
  if (ev.target.id !== "acAdd" || !ev.target.value || !chk) return;
  const u = ev.target.value;
  saveCheck([...(chk.a.attendees || []).filter((x) => x !== u), u], (chk.a.noShow || []).filter((x) => x !== u));
}

/* ─────────────────────────────────── CSS ─────────────────────────────────── */
const CSS = `
#${ROOT} .ev-warn{display:flex;gap:10px;align-items:center;border:1px solid rgba(245,158,11,.45);background:rgba(245,158,11,.07);color:#f59e0b;padding:10px 12px;margin:0 0 12px;font-size:11px;letter-spacing:1px}#${ROOT} .ev-warn span{flex:1}#${ROOT} .ev-warn .b{border-color:#f59e0b;color:#f59e0b}
#v2Modal .ev-tabs{display:flex;border-bottom:1px solid rgba(0,217,255,.18);padding:0 16px}#v2Modal .ev-tabs button{all:unset;cursor:pointer;padding:9px 14px;font:11px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;border-bottom:2px solid transparent}#v2Modal .ev-tabs button.on{color:#fff;border-bottom-color:#00D9FF}#v2Modal .ev-tabs button:focus-visible{outline:2px solid #00D9FF}
#v2Modal .lv-live{display:flex;align-items:center;gap:6px;color:#ff4d4d;font:11px "Share Tech Mono",monospace;letter-spacing:2px;margin-bottom:10px}#v2Modal .lv-live i{width:9px;height:9px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 8px #ff4d4d;animation:lvp 1.4s infinite}@keyframes lvp{50%{opacity:.3}}@media (prefers-reduced-motion:reduce){#v2Modal .lv-live i{animation:none}}
#v2Modal .lv-tl{display:grid;grid-template-columns:repeat(6,1fr);margin:4px 0 16px}#v2Modal .lv-tl>div{position:relative;text-align:center;padding-top:22px;font:9.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}
#v2Modal .lv-tl>div:before{content:"";position:absolute;top:8px;left:0;right:0;height:2px;background:#1c2a30}#v2Modal .lv-tl>div:first-child:before{left:50%}#v2Modal .lv-tl>div:last-child:before{right:50%}#v2Modal .lv-tl>div.d:before{background:#22e07a}
#v2Modal .lv-tl i{position:absolute;top:2px;left:50%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;background:#1c2a30;border:2px solid #0b0f15}#v2Modal .lv-tl .d i{background:#22e07a}#v2Modal .lv-tl .n i{background:#00D9FF;box-shadow:0 0 10px #00D9FF}
#v2Modal .lv-tl b{display:block;color:#e8eef2;font-weight:400}#v2Modal .lv-tl .n b{color:#00D9FF}
#v2Modal .lv-g{display:grid;grid-template-columns:1.2fr 1fr;gap:16px}
#v2Modal .lv-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-bottom:12px}#v2Modal .lv-tiles>div{border:1px solid rgba(0,217,255,.18);padding:10px;text-align:center}#v2Modal .lv-tiles b{display:block;font:700 20px "Share Tech Mono",monospace;color:#fff}#v2Modal .lv-tiles span{font:9.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}
#v2Modal .lv-t{width:100%;border-collapse:collapse}#v2Modal .lv-t td,#v2Modal .lv-t th{padding:6px 8px;border-bottom:1px solid rgba(0,217,255,.07);text-align:left;font-size:12px}#v2Modal .lv-t th{font:10px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;font-weight:400}
#v2Modal .lv-sys,#v2Modal .lv-feed{list-style:none;margin:0;padding:0}#v2Modal .lv-sys li{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(0,217,255,.07);font-size:12px}#v2Modal .lv-sys .ok{color:#22e07a}#v2Modal .lv-sys .wt{color:#f59e0b}#v2Modal .lv-sys .er{color:#ff4d4d}
#v2Modal .lv-fix{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:8px 10px;border:1px solid rgba(245,158,11,.45);color:#f59e0b;font-size:12px}
#v2Modal .lv-feed li{padding:5px 0;border-bottom:1px solid rgba(0,217,255,.06);font-size:12px}#v2Modal .lv-feed time{color:#7d8a99;margin-right:8px;font:11px "Share Tech Mono",monospace}
@media (max-width:720px){#v2Modal .lv-g{grid-template-columns:1fr}#v2Modal .lv-tl{grid-template-columns:repeat(3,1fr);row-gap:10px}}
#evV2 .ch.ok{color:#22e07a;border-color:rgba(34,224,122,.45)}
#evV2 .live-flash{animation:evFlash 1.6s ease-out}@keyframes evFlash{0%{box-shadow:0 0 0 2px #22e07a;background:rgba(34,224,122,.1)}100%{box-shadow:0 0 0 0 transparent}}
@media(prefers-reduced-motion:reduce){#evV2 .live-flash{animation:none;outline:1px solid #22e07a}}
#${ROOT} .evh{font-family:Rajdhani,sans-serif;letter-spacing:3px;font-size:14px;color:#fff;margin:20px 0 10px}#${ROOT} .evh.live{color:var(--g)}
#${ROOT} .evr{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;width:100%;text-align:left;border:1px solid var(--l);background:var(--p);padding:12px 16px;margin-bottom:8px;cursor:pointer;font:inherit;color:inherit}
#${ROOT} .evr:hover,#${ROOT} .evr:focus-visible{border-color:var(--am)}#${ROOT} .evr.dim{opacity:.55}
#${ROOT} .evr b{display:block;font-family:Rajdhani,sans-serif;font-size:16px;color:#fff;letter-spacing:.5px}#${ROOT} .evr small{font-size:10.5px;color:var(--d);letter-spacing:1px}
.chips{display:flex;gap:6px;flex-wrap:wrap}.ch{background:rgba(255,255,255,.06);padding:3px 8px;font-size:11px;font-family:'Share Tech Mono',monospace}
.ch.rp{background:rgba(56,189,248,.12);color:#7dd3fc}.ch.er{background:rgba(255,77,77,.15);color:#fca5a5}.ch.wt{background:rgba(245,158,11,.1);color:#f5c26b}
.ch.am{background:rgba(245,158,11,.14);color:#f59e0b}.ch.ac{background:rgba(0,217,255,.1);color:#00D9FF}.ch.ok{background:rgba(34,224,122,.12);color:#22e07a}
#${ROOT} .wiz[hidden]{display:none}#${ROOT} .wiz{display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start;margin-top:14px}
#${ROOT} .wiz-form{border:1px solid var(--l);background:var(--p);padding:20px}
#${ROOT} .wiz-pv{position:sticky;top:12px}
#${ROOT} .esteps{list-style:none;padding:0;margin:0 0 22px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#${ROOT} .esteps button{width:100%;background:none;border:0;text-align:left;cursor:pointer;padding:0;color:var(--d);font:inherit;font-size:10.5px;letter-spacing:2px}
#${ROOT} .esteps i{display:block;height:3px;background:rgba(255,255,255,.1);margin-bottom:7px}#${ROOT} .esteps .dn i{background:var(--am)}#${ROOT} .esteps .cu i{background:linear-gradient(90deg,var(--am),var(--a))}#${ROOT} .esteps .cu{color:#fff}#${ROOT} .esteps b{color:var(--am);margin-right:4px}
#${ROOT} .eh{font-family:Rajdhani,sans-serif;font-size:22px;letter-spacing:2px;color:#fff;margin:0 0 4px}
#${ROOT} .hint{font-size:10.5px;letter-spacing:.5px;color:var(--d);margin:6px 0 0;line-height:1.5}
#${ROOT} .eo,.v2m .eo{display:flex;gap:12px;border:1px solid var(--l);padding:14px;margin-top:10px;cursor:pointer;background:rgba(0,0,0,.25)}
#${ROOT} .eo.on{border-color:var(--am);background:rgba(245,158,11,.05)}#${ROOT} .eo input{accent-color:#f59e0b}
#${ROOT} .eo b{display:block;font-family:Rajdhani,sans-serif;font-size:14px;letter-spacing:1.5px;color:#fff}#${ROOT} .eo small{font-size:11px;color:var(--d)}
#${ROOT} .lbl{display:block;font-size:9.5px;letter-spacing:2.5px;color:#aeb9c4;margin:14px 0 7px}
#${ROOT} .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:9px 10px;font:inherit;font-size:12px;outline:0;color:#d6dde6}#${ROOT} .fld:focus{border-color:#00D9FF}#${ROOT} textarea.fld{resize:vertical}
#${ROOT} .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
#${ROOT} .pres{display:flex;gap:6px;flex-wrap:wrap}#${ROOT} .pill{background:none;border:1px solid var(--l2);color:var(--txt,#d6dde6);padding:6px 12px;font:inherit;font-size:11px;cursor:pointer;border-radius:999px}#${ROOT} .pill:hover{border-color:var(--am)}
#${ROOT} .ebl{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-direction:column;gap:6px}
#${ROOT} .ebl li{display:grid;grid-template-columns:22px 56px 1fr 96px 70px auto 28px;gap:6px;align-items:center;border:1px solid var(--l);background:rgba(0,0,0,.25);padding:6px}
#${ROOT} .ebl .fld{padding:6px}#${ROOT} .mv{display:flex;flex-direction:column}#${ROOT} .mv button,#${ROOT} .rm{background:none;border:0;color:var(--d);cursor:pointer;font-size:11px;padding:0}#${ROOT} .mv button:disabled{opacity:.25}#${ROOT} .rm:hover{color:var(--r)}
#${ROOT} .att{font-size:10px;color:var(--d);display:flex;gap:4px;align-items:center;letter-spacing:1px}
#${ROOT} .erv{list-style:none;padding:0;margin:0;font-size:12.5px;line-height:2.1;color:var(--d)}#${ROOT} .erv b{color:#fff;font-weight:400}
#${ROOT} .eerr{background:rgba(255,77,77,.12);border:1px solid rgba(255,77,77,.4);color:#fca5a5;padding:8px 12px;font-size:12px;margin-top:16px}
#${ROOT} .act,.v2m .act{display:flex;gap:8px;align-items:center;margin-top:18px;flex-wrap:wrap}
#${ROOT} .b.sm,.v2m .b.sm{padding:4px 9px;font-size:10px}
.dev{background:#2b2d31;border-radius:10px;overflow:hidden;font-family:'gg sans','Segoe UI',Arial,sans-serif}.dev1{padding:14px}
.dvw{margin:0;color:#949cf7;font-size:13px;font-weight:600}.dvt{margin:4px 0 0;font-size:18px;font-weight:700;color:#fff;font-family:'gg sans','Segoe UI',Arial,sans-serif}.dvd{margin:4px 0 0;font-size:13px;color:#b5bac1}.dvl{margin:0;border-top:1px solid #3f4147;padding:10px 14px;font-size:13px;color:#b5bac1}
.dsp{background:#2b2d31;border-left:4px solid #f59e0b;border-radius:6px;padding:12px;font-family:'gg sans','Segoe UI',Arial,sans-serif}.dsg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:12px;color:#fff}.dsg span{color:#b5bac1;display:block}
.dsb{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.dsb span{padding:5px 10px;border-radius:4px;font-size:12px;font-weight:600;color:#fff}
.st-blue{background:#5865f2}.st-green{background:#248046}.st-red{background:#da373c}.st-grey{background:#4e5058}
.v2m .sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}.v2m .sg>div{border:1px solid rgba(0,217,255,.18);padding:8px 10px}.v2m .sg b{display:block;font-family:Rajdhani,sans-serif;color:#fff;font-size:14px}.v2m .sg b span{color:#00D9FF}.v2m .sg small{font-size:11px;color:#7d8a99}
.v2m .hint{font-size:10px;letter-spacing:1px;color:#7d8a99;margin-top:10px}
.v2m .ak{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.v2m .ak>div{border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:12px;text-align:center}.v2m .ak b{display:block;font-family:Rajdhani,sans-serif;font-size:24px;color:#00D9FF}.v2m .ak span{font-size:9px;letter-spacing:2px;color:#7d8a99}
.v2m .acl{display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto}
.v2m .acr{display:grid;grid-template-columns:1fr auto 34px;gap:10px;align-items:center;border:1px solid rgba(0,217,255,.18);border-left:3px solid #4b5765;padding:8px 10px}
.v2m .acr b{display:block;font-family:Rajdhani,sans-serif;font-size:15px;color:#fff}.v2m .acr small{font-size:9.5px;color:#7d8a99;letter-spacing:1px}
.v2m .acr.ok{border-left-color:#22e07a}.v2m .acr.no{border-left-color:#ff4d4d}.v2m .acr.q{border-left-color:#f59e0b}
.v2m .seg{display:flex;gap:4px}.v2m .seg button{background:none;border:1px solid rgba(0,217,255,.18);color:#7d8a99;padding:5px 10px;font:inherit;font-size:10px;letter-spacing:1.5px;cursor:pointer}.v2m .seg button:disabled{opacity:.4;cursor:not-allowed}
.v2m .acr.ok .seg button.on{color:#22e07a;border-color:#22e07a;background:rgba(34,224,122,.08)}.v2m .acr.no .seg button.on{color:#ff4d4d;border-color:#ff4d4d;background:rgba(255,77,77,.08)}.v2m .acr.q .seg button.on{color:#f59e0b;border-color:#f59e0b;background:rgba(245,158,11,.08)}
.v2m .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:7px 9px;font:inherit;font-size:11px;outline:0;color:#d6dde6}
@media(max-width:1100px){#${ROOT} .wiz{grid-template-columns:1fr}#${ROOT} .ebl li{grid-template-columns:22px 56px 1fr 90px}.v2m .ak{grid-template-columns:1fr 1fr}}
`;

/* ── live: Discord sign-ups show here within a few seconds ── */
let live = null;
let liveKey = "";
function startLive() {
  if (live) return;
  live = onSnapshot(collection(db, "community_events"), (snap) => {
    const panel = document.getElementById("panel-events");
    if (!panel || panel.classList.contains("hidden") || w) return; // not on screen, or wizard open
    const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const key = JSON.stringify(next.map((e) => [e.id, e.signups, e.discord, e.status, e.updatedAtISO]));
    if (key === liveKey) return;
    const first = !liveKey;
    liveKey = key;
    if (first) return; // load() already drew the page
    const changed = new Set(next.filter((e) => JSON.stringify(e) !== JSON.stringify(events.find((x) => x.id === e.id))).map((e) => e.id));
    events = next;
    renderList();
    changed.forEach((id) => document.querySelector(`#${ROOT} [data-open="${id}"]`)?.classList.add("live-flash"));
    // Event details open? Redraw it with the new sign-ups.
    const m = document.getElementById("v2Modal");
    if (m?.dataset.ev && changed.has(m.dataset.ev)) {
      const body = m.querySelector(".bd");
      const y = body?.scrollTop || 0;
      openEvent(m.dataset.ev);
      setTimeout(() => { const b = document.querySelector("#v2Modal .bd"); if (b) b.scrollTop = y; }, 0);
    }
  });
}

onReady(() => {
  const root = mountPanel("panel-events", ROOT, () => !w && load().then(startLive).then(() => {
    // Dashboard "OPEN LIVE STATUS" → open that event on the Live Status tab.
    let id = null;
    try { id = sessionStorage.getItem("evOpenLive"); sessionStorage.removeItem("evOpenLive"); } catch { /* blocked */ }
    if (id && events.some((x) => x.id === id)) { evTab = "live"; openEvent(id); }
  }).catch((e) => notify("EVENTS LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="list-wrap"><div class="bar"><div><div class="h1">EVENTS</div><div class="sub" style="margin:4px 0 0">EVENTS WITH YOUR OWN SIGN-UP BUTTONS IN DISCORD — CAN REPEAT EVERY WEEK OR EVERY 2 WEEKS</div></div><span class="sp"></span><button class="b" data-act="refreshall" title="Update every upcoming sign-up post in Discord (no pings)">↻ REFRESH ALL POSTS</button><button class="b gold" data-act="new">📅 CREATE EVENT</button></div>
    <div class="list"><div class="empty">LOADING...</div></div></div>
    <div class="wiz" hidden><div><div class="bar"><div class="h1">${"CREATE EVENT"}</div><span class="sp"></span><button class="b" data-act="list">← ALL EVENTS</button></div><div class="wiz-form" style="margin-top:12px"></div></div><aside class="wiz-pv"></aside></div>`;

  root.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o) { evTab = "details"; return openEvent(o.dataset.open); }
    const g = e.target.closest("[data-go]");
    if (g) return go(+g.dataset.go);
    const ot = e.target.closest("[data-optype]");
    if (ot) {
      w.v.opType = ot.dataset.optype;
      return drawWizard();
    }
    const ch = e.target.closest("[data-chan]");
    if (ch) {
      w.v.channel = ch.dataset.chan;
      return drawWizard();
    }
    const p = e.target.closest("[data-preset]");
    if (p) {
      w.v.buttons = PRESETS[+p.dataset.preset][1].map(mkB);
      return drawWizard();
    }
    const mv = e.target.closest("[data-mv]");
    if (mv) {
      const [i, d] = mv.dataset.mv.split(":").map(Number);
      const [x] = w.v.buttons.splice(i, 1);
      w.v.buttons.splice(i + d, 0, x);
      return drawWizard();
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      w.v.buttons.splice(+rm.dataset.rm, 1);
      return drawWizard();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "new") return acc.ev === false ? notify("YOU DON'T HAVE EVENTS ACCESS", 1) : startWizard(null);
    if (act === "list") return endWizard();
    if (act === "next") return go(w.step + 1);
    if (act === "back") return go(w.step - 1);
    if (act === "addbtn") {
      w.v.buttons.push({ emoji: "", label: "", style: "grey", limit: 0, attending: true });
      return drawWizard();
    }
    if (act === "create") return create();
    if (act === "refreshall" || act === "fixall") return refreshAll(act === "refreshall");
  });
  root.addEventListener("input", (e) => {
    if (!w) return;
    const k = e.target.dataset.k;
    if (k) {
      w.v[k] = e.target.value;
      return preview();
    }
    const b = e.target.dataset.b;
    if (b) {
      const [i, f] = b.split(":");
      w.v.buttons[+i][f] = f === "attending" ? e.target.checked : f === "limit" ? Math.max(0, +e.target.value || 0) : e.target.value;
      preview();
    }
  });
  root.addEventListener("change", (e) => {
    if (!w) return;
    if (e.target.name === "evWhere") {
      w.v.where = e.target.value;
      return drawWizard();
    }
    if (e.target.id === "evLink") {
      w.v.linkAttendance = e.target.checked;
      return drawWizard();
    }
    if (e.target.dataset.b?.endsWith(":attending")) w.v.buttons[+e.target.dataset.b.split(":")[0]].attending = e.target.checked;
    if (e.target.dataset.k === "repeat" || e.target.dataset.k === "attType") w.v[e.target.dataset.k] = e.target.value;
  });
});
