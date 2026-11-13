/**
 * ATTENDANCE TRACKER v3 (approved mock 2026-11-11) — replaces #panel-attendance.
 *
 * Tabs: TRACKER (mark an op) · NEW EVENT · HISTORY (opens Attendance History).
 * Each member is PRESENT / EXCUSED (with a short reason) / ABSENT for an event.
 * Changes save as you go. LOCK recounts every member's stats from all locked events
 * (same rules as before: every locked event counts as eligible, excused included —
 * pending the Commander's decision on excused).
 *
 * Data: attendance_events { title, date, type, attendees[], excused[], excusedReasons{uid:text}, locked, … }
 * Sign-ups: community_events linked by attendanceEventId (from the Events page / Cortana).
 */
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { rebuildMonth, ukMonth } from "./attendance-core.js";
import { addCss, ask, audit, db, esc, getMe, getUsers, isMember, memberName, mountPanel, notify, onReady, platoonOrder, rankOrder, rateColor, today, toDate } from "./_common.js";

let canLock = false;
onAccess((m) => { canLock = !!m.access?.lock; });

const ROOT = "attV3";
const TYPE = { main_op: ["OPERATIONS", "#00D9FF"], patrol: ["PATROL", "#22e07a"], training: ["TRAINING", "#f59e0b"], fun_op: ["FUN OP", "#a78bfa"] };
const PLATOONS = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", ""];

let me = null;
let users = [];
let events = [];
let comm = []; // community_events (Discord events)
let cur = null;
let tab = "t";
let flt = "ALL";
let q = "";
let eq = "";
let editHead = false;
let unsubEv = null;
let unsubPres = null;
let presence = [];
let busy = 0;
let nf = { mode: "discord", ce: "", title: "", date: today(), type: "main_op", tickGoing: true };

const roll = () =>
  users
    .filter((u) => isMember(u) && u.platoon !== "Reserves" && u.role !== "retired_veteran")
    .sort((a, b) => platoonOrder(a.platoon) - platoonOrder(b.platoon) || rankOrder(a.rank) - rankOrder(b.rank));
const pg = (u) => (String(u.rank || "").match(/^([OE]\d+)/) || [])[1] || "";
const rateOf = (u) => (u.opsEligible ? Math.round(((u.opsAttended || 0) / u.opsEligible) * 100) : null);
const stateOf = (e, uid) => ((e.attendees || []).includes(uid) ? "p" : (e.excused || []).includes(uid) ? "e" : "a");
const fmtD = (d, o) => { const x = toDate(d); return x && !isNaN(x) ? x.toLocaleDateString("en-GB", o).toUpperCase() : "—"; };
const linked = (e) => comm.find((c) => c.attendanceEventId === e?.id);
const goingKeys = (c) => new Set((c?.buttons || []).filter((b) => b.attending).map((b) => b.key));
function signup(c, uid) {
  const s = (c?.signups || []).find((x) => x.uid === uid);
  if (!s) return null;
  const b = (c.buttons || []).find((x) => x.key === s.choice);
  return { label: `${b?.emoji || ""} ${b?.label || s.choice}`.trim(), going: goingKeys(c).has(s.choice) && !s.waiting, waiting: !!s.waiting };
}
const goingUids = (c) => (c?.signups || []).filter((s) => s.uid && !s.waiting && goingKeys(c).has(s.choice)).map((s) => s.uid);

// ───────── load ─────────
async function load() {
  me = me || (await getMe());
  const [us, evS, ceS] = await Promise.all([getUsers(), getDocs(collection(db, "attendance_events")), getDocs(collection(db, "community_events")).catch(() => null)]);
  users = us;
  events = evS.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  comm = ceS ? ceS.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  if (cur) cur = events.find((e) => e.id === cur.id) || null;
  if (!cur && events.length) watch((events.find((e) => !e.locked) || events[0]).id);
  render();
}

function watch(id) {
  const e = events.find((x) => x.id === id);
  if (!e) return;
  cur = { ...e };
  editHead = false;
  unsubEv?.();
  unsubEv = onSnapshot(doc(db, "attendance_events", id), (s) => {
    if (!s.exists() || !cur || cur.id !== id || busy) return;
    cur = { id, ...s.data() };
    const i = events.findIndex((x) => x.id === id);
    if (i >= 0) events[i] = { ...cur };
    render();
  });
}

function watchPresence() {
  if (unsubPres) return;
  unsubPres = onSnapshot(query(collection(db, "presence_sessions"), where("panel", "==", "attendance")), (snap) => {
    const now = Date.now();
    presence = snap.docs.map((d) => d.data()).filter((p) => now - new Date(p.updatedAt).getTime() < 90000);
    const el = document.querySelector(`#${ROOT} .who`);
    if (el) el.innerHTML = presenceHtml();
  });
}
function presenceHtml() {
  const seen = new Set();
  const list = presence.filter((p) => !seen.has(p.uid) && seen.add(p.uid));
  return list.length ? list.map((p) => `<span class="pp"><i></i>${esc(memberName(p))}</span>`).join("") : '<span class="k">ONLY YOU</span>';
}

// ───────── render ─────────
function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  let b = root.querySelector(".body");
  if (!b) { b = document.createElement("div"); b.className = "body"; root.appendChild(b); }
  const tabBtn = (k, l) => `<button type="button" class="chip ${tab === k ? "on" : ""}" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`;
  b.innerHTML = `
    <div class="bar"><div class="h1">ATTENDANCE TRACKER</div><span class="sp"></span>${tabBtn("t", "▣ TRACKER")}${tabBtn("n", "＋ NEW EVENT")}<button type="button" class="chip" data-act="history">▤ HISTORY ↗</button></div>
    <div class="live" aria-live="polite"><span>ONLINE NOW</span><div class="who">${presenceHtml()}</div><span class="sp"></span><span style="color:#22e07a">✓ SAVES AUTOMATICALLY</span></div>
    ${tab === "n" ? newHtml() : trackerHtml()}`;
}

function kpis() {
  const m = roll();
  const tA = m.reduce((s, u) => s + (u.opsAttended || 0), 0), tE = m.reduce((s, u) => s + (u.opsEligible || 0), 0);
  const all = tE ? Math.round((tA / tE) * 100) : 0;
  const ym = today().slice(0, 7);
  const monthLocked = events.filter((e) => e.locked && String(e.date || "").startsWith(ym));
  const mp = monthLocked.reduce((s, e) => s + (e.attendees || []).length, 0);
  const mRate = monthLocked.length && m.length ? Math.round((mp / (monthLocked.length * m.length)) * 100) : null;
  const full = m.filter((u) => (u.attendance || 0) >= 3).length;
  const open = events.filter((e) => !e.locked).length;
  return `<div class="kp">
    <div><b style="color:${rateColor(all)}">${all}%</b><span>UNIT RATE (ALL TIME)</span></div>
    <div><b>${monthLocked.length}</b><span>OPS THIS MONTH</span></div>
    <div><b style="color:${rateColor(mRate)}">${mRate == null ? "—" : mRate + "%"}</b><span>THIS MONTH</span></div>
    <div><b>${full}</b><span>MEMBERS AT 3/3</span></div>
    <div><b style="color:${open ? "#f59e0b" : "#fff"}">${open}</b><span>NOT LOCKED</span></div></div>`;
}

function railHtml() {
  let last = "";
  const list = events.filter((e) => String(e.title || "").toLowerCase().includes(eq.toLowerCase()));
  return `<aside class="card rail"><div style="padding:8px"><input class="in eq" placeholder="Search ops…" value="${esc(eq)}" aria-label="Search events"></div><div class="evs">${
    list
      .map((e) => {
        const mon = fmtD(e.date, { month: "long", year: "numeric" });
        const head = mon !== last ? `<div class="mon">${mon}</div>` : "";
        last = mon;
        const [tl, tc] = TYPE[e.type] || [String(e.type || "—").toUpperCase(), "#9fb3c4"];
        const c = linked(e);
        const n = roll().length;
        const p = n ? Math.round(((e.attendees || []).length / n) * 100) : 0;
        return `${head}<button type="button" class="ev ${cur?.id === e.id ? "on" : ""}" data-ev="${esc(e.id)}"><span style="min-width:0"><b>${esc(e.title || "Untitled")}</b><small>${fmtD(e.date, { weekday: "short", day: "2-digit" })} · <span style="color:${tc}">${tl}</span>${c ? ` · ${goingUids(c).length} SIGNED UP` : ""}</small></span><small style="color:${e.locked ? rateColor(p) : "#22e07a"}">${e.locked ? "🔒 " + p + "%" : "● OPEN"}</small></button>`;
      })
      .join("") || '<div class="empty">NO EVENTS YET</div>'
  }</div></aside>`;
}

function trackerHtml() {
  return `${kpis()}<div class="att">${railHtml()}<section class="card evc">${cur ? eventHtml() : '<div class="empty">PICK AN EVENT, OR ＋ NEW EVENT TO START ROLL CALL</div>'}</section></div>`;
}

function eventHtml() {
  const e = cur;
  const m = roll();
  const c = linked(e);
  const [tl, tc] = TYPE[e.type] || [String(e.type || "—").toUpperCase(), "#9fb3c4"];
  const cnt = { p: 0, e: 0, a: 0 };
  m.forEach((u) => cnt[stateOf(e, u.id)]++);
  const turn = m.length ? Math.round((cnt.p / m.length) * 100) : 0;
  const going = new Set(goingUids(c));
  const locked = !!e.locked;
  const shown = m.filter((u) => {
    if (!memberName(u).toLowerCase().includes(q.toLowerCase())) return false;
    const s = stateOf(e, u.id);
    return flt === "ALL" || (flt === "P" && s === "p") || (flt === "A" && s !== "p") || (flt === "S" && going.has(u.id));
  });
  // last 3 locked events before this one, newest first
  const prior = events.filter((x) => x.locked && x.id !== e.id && String(x.date || "") <= String(e.date || "")).slice(0, 3);
  const sym = { p: '<span style="color:#22e07a">✓</span>', e: '<span style="color:#f59e0b">E</span>', a: '<span style="color:#4b5765">–</span>' };
  const head = editHead && !locked
    ? `<div class="g3" style="flex:1"><div><label for="ah_t">TITLE</label><input class="in" id="ah_t" value="${esc(e.title || "")}" maxlength="120"></div><div><label for="ah_d">DATE</label><input class="in" type="date" id="ah_d" value="${esc(e.date || "")}"></div><div><label for="ah_y">TYPE</label><select class="in" id="ah_y">${Object.entries(TYPE).map(([k, [l]]) => `<option value="${k}" ${e.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div><button type="button" class="b sm" data-act="headcancel">CANCEL</button><button type="button" class="b sm gold" data-act="headsave">SAVE</button>`
    : `<div style="min-width:0;flex:1"><h2>${esc(e.title || "Untitled")}</h2><span class="k">${fmtD(e.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} · <span style="color:${tc}">${tl}</span>${e.createdBy ? " · CREATED BY " + esc(String(e.createdBy).toUpperCase()) : ""}${c ? ' · <span style="color:#22e07a">LINKED TO DISCORD EVENT ✓</span>' : ""}</span></div>
       ${locked ? "" : '<button type="button" class="b sm" data-act="headedit">✎ RENAME / DATE</button>'}<button type="button" class="b sm red" data-act="delete" ${locked ? 'disabled title="Unlock first"' : ""}>🗑 DELETE</button>`;
  const fb = (k, l) => `<button type="button" class="chip ${flt === k ? "on" : ""}" data-f="${k}" aria-pressed="${flt === k}">${l}</button>`;
  let rows = "";
  for (const pl of PLATOONS) {
    const g = shown.filter((u) => (u.platoon || "") === pl);
    if (!g.length) continue;
    rows += `<tr class="grp"><td colspan="5">${esc((pl || "NO PLATOON").toUpperCase())} <small>${g.filter((u) => stateOf(e, u.id) === "p").length} / ${g.length} PRESENT</small></td></tr>`;
    rows += g
      .map((u) => {
        const s = stateOf(e, u.id);
        const su = signup(c, u.id);
        const r = rateOf(u);
        const btn = s === "p" ? ["✓ PRESENT", "#22e07a"] : s === "e" ? ["E EXCUSED", "#f59e0b"] : ["– ABSENT", "#7d8a99"];
        return `<tr class="${s}"><td><b>${esc(memberName(u))}</b> ${pg(u) ? `<span class="pg">${esc(pg(u))}</span>` : ""}<button type="button" class="rate" data-rate="${esc(u.id)}" title="Attendance rate — click to correct" style="color:${rateColor(r)}">${r == null ? "—" : r + "%"}</button></td>
          <td class="k">${esc(u.squad || "—")}</td>
          <td>${su ? `<span style="color:${su.going ? "#a78bfa" : "#7d8a99"}">${esc(su.label)}${su.waiting ? " ⏳" : ""}</span>` : '<span class="k">—</span>'}</td>
          <td class="l3">${prior.length ? prior.map((x) => sym[stateOf(x, u.id)]).join(" ") : '<span class="k">—</span>'}</td>
          <td><button type="button" class="st" data-cyc="${esc(u.id)}" style="color:${btn[1]};border-color:${btn[1]}" ${locked ? "disabled" : ""} aria-label="${esc(memberName(u))}: ${btn[0]} — click to change">${btn[0]}</button>${s === "e" ? ` <input class="in rs" data-rs="${esc(u.id)}" maxlength="60" placeholder="Reason (optional)" value="${esc(e.excusedReasons?.[u.id] || "")}" ${locked ? "disabled" : ""} aria-label="Excused reason for ${esc(memberName(u))}">` : ""}</td></tr>`;
      })
      .join("");
  }
  const lock = !canLock
    ? `<div class="lockbar dim"><span>🔒 LOCK / UNLOCK: STAFF NCO AND ABOVE</span></div>`
    : locked
    ? `<div class="lockbar"><span>🔒 LOCKED — PERMANENT RECORD, STATS COUNTED${e.lockedBy ? " · BY " + esc(String(e.lockedBy).toUpperCase()) : ""}. UNLOCK TO FIX, THEN LOCK AGAIN.</span><button type="button" class="b" data-act="unlock">🔓 UNLOCK TO CORRECT</button></div>`
    : `<div class="lockbar"><span>🔒 LOCK recounts everyone's stats from all locked ops: ${cnt.p} present → +1 op attended · everyone → +1 op eligible · ATT this month updates · unlock any time to fix</span><button type="button" class="b gold" data-act="lock">🔒 LOCK EVENT</button></div>`;
  return `<div class="eh">${head}</div>
    <div class="ts"><div><b style="color:#22e07a">${cnt.p}</b><span>✓ PRESENT</span></div><div><b style="color:#f59e0b">${cnt.e}</b><span>E EXCUSED</span></div><div><b>${cnt.a}</b><span>– ABSENT</span></div><div><b style="color:${rateColor(turn)}">${turn}%</b><span>TURNOUT</span></div></div>
    <div class="bar tools"><input class="in rq" placeholder="Find member…" value="${esc(q)}" aria-label="Find member">${fb("ALL", `ALL ${m.length}`)}${fb("P", "PRESENT")}${fb("A", "ABSENT")}${c ? fb("S", `<span style="color:#a78bfa">SIGNED UP ${going.size}</span>`) : ""}<span class="sp"></span>
      ${c ? `<button type="button" class="b sm" data-act="tickgoing" ${locked ? "disabled" : ""}>✓ TICK ALL SIGNED UP (${going.size})</button>` : ""}<button type="button" class="b sm" data-act="clear" ${locked ? "disabled" : ""}>CLEAR ALL</button></div>
    <div class="tw"><table><thead><tr><th>MEMBER</th><th>SQUAD</th><th>DISCORD SIGN-UP</th><th>LAST 3 OPS</th><th>THIS OP</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">NOBODY MATCHES</td></tr>'}</tbody></table></div>
    <p class="k" style="padding:6px 14px">Click THIS OP to cycle ✓ → E → –. Excused can have a short reason. Changes save as you go until you LOCK.</p>
    ${lock}`;
}

function newHtml() {
  const now = Date.now();
  const avail = comm
    .filter((c) => c.status !== "cancelled" && !events.some((e) => e.id === c.attendanceEventId) && Date.parse(c.startAtISO) > now - 7 * 864e5)
    .sort((a, b) => String(a.startAtISO).localeCompare(String(b.startAtISO)));
  const fromD = nf.mode === "discord";
  const ce = avail.find((c) => c.id === nf.ce);
  const g = ce ? goingUids(ce).length : 0;
  return `<div class="card nfc"><b class="st2">＋ NEW ATTENDANCE EVENT</b>
    <div class="bar" style="margin-top:12px"><button type="button" class="chip ${fromD ? "on" : ""}" data-mode="discord" aria-pressed="${fromD}">FROM A DISCORD EVENT</button><button type="button" class="chip ${fromD ? "" : "on"}" data-mode="blank" aria-pressed="${!fromD}">BLANK</button></div>
    ${fromD ? `<label for="nf_ce">PICK EVENT</label><select class="in" id="nf_ce"><option value="">${avail.length ? "— pick —" : "No Discord events without an attendance sheet"}</option>${avail.map((c) => `<option value="${esc(c.id)}" ${nf.ce === c.id ? "selected" : ""}>${esc(c.title)} — ${fmtD(c.startAtISO, { weekday: "short", day: "2-digit", month: "short" })} · ${goingUids(c).length} signed up</option>`).join("")}</select>` : ""}
    <div class="g3" style="margin-top:10px"><div><label for="nf_t">TITLE</label><input class="in" id="nf_t" maxlength="120" value="${esc(nf.title)}"></div><div><label for="nf_d">DATE</label><input class="in" type="date" id="nf_d" value="${esc(nf.date)}"></div><div><label for="nf_y">TYPE</label><select class="in" id="nf_y">${Object.entries(TYPE).map(([k, [l]]) => `<option value="${k}" ${nf.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    ${fromD && ce ? `<label class="ck"><input type="checkbox" id="nf_g" ${nf.tickGoing ? "checked" : ""}> Tick the ${g} people who signed up "Going" as present to start with</label>` : ""}
    <div class="bar" style="margin-top:12px"><span class="sp"></span><button type="button" class="b" data-tab="t">CANCEL</button><button type="button" class="b gold" data-act="create">CREATE</button></div></div>`;
}

// ───────── saving ─────────
/** An event from an earlier month changed after its month was saved → update that month's History record. */
async function historyCatchUp(e, action) {
  const m = String(e?.date || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m) || m >= ukMonth()) return;
  try {
    await rebuildMonth(m, { by: me?.callsign || memberName(me) || "Staff", title: e.title || "—", action });
    notify(`ATTENDANCE HISTORY FOR ${m} UPDATED`);
  } catch (x) {
    console.warn("history catch-up failed", x);
  }
}

async function save(patch, quiet) {
  if (!cur) return;
  busy++;
  try {
    Object.assign(cur, patch);
    const i = events.findIndex((x) => x.id === cur.id);
    if (i >= 0) Object.assign(events[i], patch);
    await updateDoc(doc(db, "attendance_events", cur.id), { ...patch, updatedBy: me?.callsign || memberName(me) || "Staff", updatedAt: new Date().toISOString() });
  } catch (e) {
    notify("SAVE FAILED: " + e.message, 1);
  } finally {
    busy--;
  }
  if (!quiet) render();
}

function cycle(uid) {
  if (!cur || cur.locked) return notify("EVENT IS LOCKED — UNLOCK TO CORRECT", 1);
  const att = new Set(cur.attendees || []), exc = new Set(cur.excused || []);
  const s = stateOf(cur, uid);
  att.delete(uid); exc.delete(uid);
  if (s === "a") att.add(uid);
  else if (s === "p") exc.add(uid);
  const reasons = { ...(cur.excusedReasons || {}) };
  if (s === "e") delete reasons[uid];
  render();
  return save({ attendees: [...att], excused: [...exc], excusedReasons: reasons });
}

/** Recount every member's stats from all locked events (same rules as the original). */
async function recalcAllStats() {
  notify("RECALCULATING STATS…");
  const [evS, uS] = await Promise.all([getDocs(query(collection(db, "attendance_events"), where("locked", "==", true))), getDocs(collection(db, "users"))]);
  const locked = evS.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ym = today().slice(0, 7);
  const month = locked.filter((e) => String(e.date || "").startsWith(ym));
  const members = uS.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.status !== "pending" && u.status !== "denied" && u.platoon !== "Reserves");
  for (const u of members) {
    let opsAttended = 0, lastAttendedDate = null;
    for (const e of locked) {
      if ((e.attendees || []).includes(u.id)) {
        opsAttended++;
        if (!lastAttendedDate || e.date > lastAttendedDate) lastAttendedDate = e.date;
      }
    }
    const attendance = Math.min(month.filter((e) => (e.attendees || []).includes(u.id)).length, 3);
    await updateDoc(doc(db, "users", u.id), { opsAttended, opsEligible: locked.length, attendance, lastAttendedDate, updatedAt: new Date().toISOString() });
  }
}

async function lockEvent(e = cur, asked = false) {
  const p = (e.attendees || []).length;
  if (!asked && !(await ask({ kind: "warn", title: "LOCK ATTENDANCE?", body: `${p} present. This finalises the event and recounts every member's stats.`, item: e.title, go: "LOCK" }))) return;
  busy++;
  try {
    await updateDoc(doc(db, "attendance_events", e.id), { locked: true, lockedBy: me?.callsign || "Staff", lockedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await recalcAllStats();
    await audit("battalion_ops", "EVENT LOCKED", `${e.title} (${e.date}) — ${p} present, ${(e.excused || []).length} excused, stats recalculated`);
    window.fireWebhook?.("attendance", { title: e.title, date: e.date, type: (TYPE[e.type] || [e.type])[0], present: p, by: me?.callsign || "Staff" });
    notify(`EVENT LOCKED — ${p} PRESENT — STATS RECALCULATED`);
    await historyCatchUp(e, "locked late");
  } catch (x) {
    notify("LOCK FAILED: " + x.message, 1);
  } finally {
    busy--;
  }
  if (document.getElementById(ROOT)) await load().catch(() => {});
}

async function unlockEvent(e = cur, asked = false) {
  if (!asked && !(await ask({ kind: "warn", title: "UNLOCK THIS EVENT?", body: "You can then correct it. Lock it again afterwards so stats are recounted.", item: e.title, go: "UNLOCK" }))) return;
  try {
    await updateDoc(doc(db, "attendance_events", e.id), { locked: false, unlockedBy: me?.callsign || "Staff", unlockedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await audit("battalion_ops", "EVENT UNLOCKED", `${e.title || "—"} (${e.date || "—"}) unlocked for corrections`);
    notify("EVENT UNLOCKED — MAKE CORRECTIONS THEN LOCK AGAIN");
    await historyCatchUp(e, "unlocked");
  } catch (x) {
    notify("UNLOCK FAILED: " + x.message, 1);
  }
  if (document.getElementById(ROOT)) await load().catch(() => {});
}

async function deleteEvent() {
  const e = cur;
  if (e.locked) return notify("UNLOCK FIRST — LOCKED EVENTS ARE PERMANENT RECORD", 1);
  if (!(await ask({ kind: "danger", title: "DELETE EVENT?", body: "The roll call for this event is removed. Stats are recounted.", item: e.title, go: "DELETE" }))) return;
  try {
    await deleteDoc(doc(db, "attendance_events", e.id));
    const c = linked(e);
    if (c) await updateDoc(doc(db, "community_events", c.id), { attendanceEventId: null }).catch(() => {});
    await recalcAllStats();
    await audit("battalion_ops", "EVENT DELETED", `${e.title || "—"} (${e.date || "—"})`);
    unsubEv?.();
    cur = null;
    notify("EVENT DELETED — STATS RECALCULATED");
  } catch (x) {
    notify("DELETE FAILED: " + x.message, 1);
  }
  await load();
}

async function createEvent() {
  const title = nf.title.trim(), date = nf.date, type = nf.type;
  if (!title) return notify("ENTER AN OPERATION / EVENT NAME", 1);
  if (!date) return notify("DATE REQUIRED", 1);
  if (events.some((e) => e.title === title && e.date === date)) return notify("AN EVENT WITH THIS NAME AND DATE ALREADY EXISTS", 1);
  const ce = nf.mode === "discord" ? comm.find((c) => c.id === nf.ce) : null;
  const attendees = ce && nf.tickGoing ? goingUids(ce).filter((uid) => users.some((u) => u.id === uid)) : [];
  const by = me?.callsign || memberName(me) || "Staff";
  try {
    const ref = await addDoc(collection(db, "attendance_events"), { title, date, type, attendees, excused: [], excusedReasons: {}, locked: false, createdBy: by, createdAt: new Date().toISOString(), updatedBy: by, updatedAt: new Date().toISOString() });
    if (ce) await updateDoc(doc(db, "community_events", ce.id), { attendanceEventId: ref.id }).catch(() => notify("CREATED — BUT COULD NOT LINK THE DISCORD EVENT", 1));
    await audit("battalion_ops", "EVENT CREATED", `${title} (${date}) — Type: ${type}${ce ? " — from Discord event, " + attendees.length + " pre-ticked" : ""}`);
    notify("EVENT CREATED — " + title);
    nf = { mode: "discord", ce: "", title: "", date: today(), type: "main_op", tickGoing: true };
    tab = "t";
    cur = null;
    await load();
    watch(ref.id);
    render();
  } catch (x) {
    notify("CREATE FAILED: " + x.message, 1);
  }
}

/** Used by the Events page check-in (lock / unlock with the same rules). It asks first itself. */
window.attV3 = {
  async lock(id) { me = me || (await getMe()); const s = (await getDocs(collection(db, "attendance_events"))).docs.find((d) => d.id === id); if (s) await lockEvent({ id, ...s.data() }, true); },
  async unlock(id) { me = me || (await getMe()); const s = (await getDocs(collection(db, "attendance_events"))).docs.find((d) => d.id === id); if (s) await unlockEvent({ id, ...s.data() }, true); },
};

// ───────── styles ─────────
const CSS = `
#${ROOT} .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}#${ROOT} .sp{flex:1}
#${ROOT} .h1{font:700 20px Rajdhani,sans-serif;letter-spacing:4px;color:#00D9FF}
#${ROOT} .k{font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}
#${ROOT} .in{height:34px;background:#060a0e;border:1px solid rgba(0,217,255,.3);color:#fff;padding:0 10px;font:13px "Share Tech Mono",monospace;width:100%;box-sizing:border-box}#${ROOT} .in:focus{outline:none;border-color:#00D9FF}
#${ROOT} label{display:block;font:9.5px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;margin:10px 0 4px}#${ROOT} label.ck{letter-spacing:.5px;font-size:12px;color:#c6d0da}
#${ROOT} .chip{all:unset;cursor:pointer;padding:5px 10px;border:1px solid rgba(0,217,255,.18);font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}#${ROOT} .chip.on{color:#fff;border-color:#00D9FF;background:rgba(0,217,255,.1)}
#${ROOT} .chip:focus-visible,#${ROOT} .ev:focus-visible,#${ROOT} .st:focus-visible,#${ROOT} .rate:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
#${ROOT} .card{background:#0b0f15;border:1px solid rgba(0,217,255,.18)}
#${ROOT} .live{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid rgba(0,217,255,.18);background:#0b0f15;padding:8px 12px;margin-bottom:12px;font:10px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99}
#${ROOT} .who{display:flex;gap:6px;flex-wrap:wrap}#${ROOT} .pp{display:flex;align-items:center;gap:6px;border:1px solid rgba(0,217,255,.4);color:#00D9FF;padding:3px 8px;letter-spacing:1px}#${ROOT} .pp i{width:7px;height:7px;border-radius:50%;background:#22e07a}
#${ROOT} .kp{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}#${ROOT} .kp div,#${ROOT} .ts div{border:1px solid rgba(0,217,255,.18);background:#0b0f15;padding:10px;text-align:center}
#${ROOT} .kp b,#${ROOT} .ts b{display:block;color:#fff;font:700 22px Rajdhani,sans-serif}#${ROOT} .kp span,#${ROOT} .ts span{font:9px "Share Tech Mono",monospace;letter-spacing:1.5px;color:#7d8a99}
#${ROOT} .att{display:grid;grid-template-columns:290px minmax(0,1fr);gap:14px;align-items:start}
#${ROOT} .rail{position:sticky;top:10px}#${ROOT} .evs{max-height:calc(100vh - 330px);overflow:auto}
#${ROOT} .mon{padding:8px 12px;font:10px "Share Tech Mono",monospace;letter-spacing:2px;color:#00D9FF;border-bottom:1px solid rgba(0,217,255,.18)}
#${ROOT} .ev{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:8px;justify-content:space-between;align-items:center;width:100%;padding:9px 12px;border-bottom:1px solid rgba(0,217,255,.07)}#${ROOT} .ev:hover{background:rgba(0,217,255,.04)}#${ROOT} .ev.on{background:rgba(0,217,255,.07);box-shadow:inset 3px 0 0 #00D9FF}
#${ROOT} .ev b{display:block;color:#fff;font:700 14px Rajdhani,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${ROOT} .ev small{font:10px "Share Tech Mono",monospace;color:#7d8a99;white-space:nowrap}
#${ROOT} .evc{min-width:0}#${ROOT} .eh{padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid rgba(0,217,255,.18)}
#${ROOT} .eh h2{margin:0 0 2px;color:#fff;font:700 22px Rajdhani,sans-serif;letter-spacing:2px}
#${ROOT} .g3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:0 12px}#${ROOT} .eh .g3 label{margin-top:0}
#${ROOT} .ts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 14px}
#${ROOT} .tools{padding:0 14px;margin-bottom:8px}#${ROOT} .tools .rq{max-width:200px}
#${ROOT} .tw{padding:0 14px;overflow-x:auto}#${ROOT} table{width:100%;border-collapse:collapse}
#${ROOT} th{font:9.5px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;text-align:left;padding:7px 10px;border-bottom:1px solid rgba(0,217,255,.18)}
#${ROOT} td{padding:6px 10px;border-bottom:1px solid rgba(0,217,255,.07);font:12px "Share Tech Mono",monospace;color:#c6d0da;vertical-align:middle}
#${ROOT} td b{color:#fff;font:700 14px Rajdhani,sans-serif;letter-spacing:.5px}#${ROOT} tr.p td{background:rgba(34,224,122,.04)}#${ROOT} tr.e td{background:rgba(245,158,11,.05)}
#${ROOT} tr.grp td{background:none;color:#00D9FF;font:700 12px Rajdhani,sans-serif;letter-spacing:3px;padding-top:14px}#${ROOT} tr.grp small{color:#7d8a99;font:9.5px "Share Tech Mono",monospace;letter-spacing:1px;margin-left:8px}
#${ROOT} .pg{display:inline-block;min-width:28px;text-align:center;padding:0 4px;border:1px solid rgba(0,217,255,.18);color:#00D9FF;font-size:10px;margin-left:4px}
#${ROOT} .rate{all:unset;cursor:pointer;margin-left:8px;font:700 12px Rajdhani,sans-serif;padding:0 4px;border:1px solid transparent}#${ROOT} .rate:hover{border-color:rgba(0,217,255,.35)}
#${ROOT} .l3{letter-spacing:3px;font-weight:700}
#${ROOT} .st{all:unset;cursor:pointer;min-width:96px;text-align:center;padding:4px 8px;border:1px solid;font:10.5px "Share Tech Mono",monospace;letter-spacing:1px}#${ROOT} .st:disabled{cursor:not-allowed;opacity:.7}
#${ROOT} .rs{height:26px;max-width:180px;display:inline-block;vertical-align:middle;font-size:11px}
#${ROOT} .lockbar{display:flex;gap:10px;align-items:center;margin:4px 14px 14px;padding:10px 12px;border:1px solid #ffd166;color:#ffd166;font:11px "Share Tech Mono",monospace;letter-spacing:.5px}#${ROOT} .lockbar span{flex:1}#${ROOT} .lockbar.dim{border-color:rgba(0,217,255,.18);color:#7d8a99}
#${ROOT} .b.red{border-color:#ff4d4d;color:#ff4d4d}
#${ROOT} .nfc{padding:16px;max-width:700px}#${ROOT} .st2{color:#fff;letter-spacing:2px;font:700 15px Rajdhani,sans-serif}
#${ROOT} .empty{padding:30px;text-align:center;color:#7d8a99;font:11px "Share Tech Mono",monospace;letter-spacing:2px}
@media(max-width:1000px){#${ROOT} .att{grid-template-columns:1fr}#${ROOT} .rail{position:static}#${ROOT} .evs{max-height:260px}#${ROOT} .kp{grid-template-columns:repeat(2,1fr)}#${ROOT} .g3{grid-template-columns:1fr}}
`;

// ───────── events ─────────
onReady(() => {
  const root = mountPanel("panel-attendance", ROOT, async () => {
    watchPresence();
    try { await load(); } catch (e) { notify("ATTENDANCE LOAD FAILED: " + e.message, 1); }
  });
  if (!root) return;
  addCss(ROOT, CSS);
  if (!root.querySelector(".body")) root.innerHTML = '<div class="body"><div class="empty">LOADING…</div></div>';

  root.addEventListener("click", async (ev) => {
    const t = ev.target;
    const rate = t.closest("[data-rate]");
    if (rate) {
      const u = users.find((x) => x.id === rate.dataset.rate);
      if (u) window.editAttMonthlyRate?.(u.id, memberName(u), u.opsAttended || 0, u.opsEligible || 0);
      return;
    }
    const cy = t.closest("[data-cyc]");
    if (cy) return cycle(cy.dataset.cyc);
    const e = t.closest("[data-ev]");
    if (e) { watch(e.dataset.ev); return render(); }
    const tb = t.closest("[data-tab]");
    if (tb) { tab = tb.dataset.tab; return render(); }
    const f = t.closest("[data-f]");
    if (f) { flt = f.dataset.f; return render(); }
    const md = t.closest("[data-mode]");
    if (md) { nf.mode = md.dataset.mode; return render(); }
    const act = t.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "history") return window.showPanel?.("panel-att-history");
    if (act === "create") return createEvent();
    if (!cur) return;
    if (act === "headedit") { editHead = true; return render(); }
    if (act === "headcancel") { editHead = false; return render(); }
    if (act === "headsave") {
      const title = root.querySelector("#ah_t").value.trim(), date = root.querySelector("#ah_d").value, type = root.querySelector("#ah_y").value;
      if (!title || !date) return notify("TITLE AND DATE REQUIRED", 1);
      const old = `${cur.title} (${cur.date})`;
      editHead = false;
      await save({ title, date, type });
      audit("battalion_ops", "EVENT EDITED", `${old} → ${title} (${date}) — Type: ${type}`);
      return;
    }
    if (act === "lock") return lockEvent();
    if (act === "unlock") return unlockEvent();
    if (act === "delete") return deleteEvent();
    if (cur.locked) return;
    if (act === "tickgoing") {
      const add = goingUids(linked(cur)).filter((uid) => roll().some((u) => u.id === uid));
      const att = new Set(cur.attendees || []);
      add.forEach((uid) => att.add(uid));
      const exc = (cur.excused || []).filter((uid) => !att.has(uid));
      await save({ attendees: [...att], excused: exc });
      return notify(`✓ ${add.length} SIGNED UP MARKED PRESENT`);
    }
    if (act === "clear") {
      if (!(await ask({ kind: "warn", title: "CLEAR ALL?", body: "Everyone on this event goes back to absent.", item: cur.title, go: "CLEAR" }))) return;
      return save({ attendees: [], excused: [], excusedReasons: {} });
    }
  });

  root.addEventListener("input", (ev) => {
    const t = ev.target;
    const keep = (sel) => { render(); const el = root.querySelector(sel); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
    if (t.classList.contains("rq")) { q = t.value; return keep(".rq"); }
    if (t.classList.contains("eq")) { eq = t.value; return keep(".eq"); }
    if (t.id === "nf_t") nf.title = t.value;
  });

  // Saved when you leave the box, so typing isn't interrupted.
  root.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.rs && cur && !cur.locked) {
      const reasons = { ...(cur.excusedReasons || {}), [t.dataset.rs]: t.value.trim().slice(0, 60) };
      return save({ excusedReasons: reasons }, true);
    }
    if (t.id === "nf_d") nf.date = t.value;
    if (t.id === "nf_y") nf.type = t.value;
    if (t.id === "nf_g") nf.tickGoing = t.checked;
    if (t.id === "nf_ce") {
      nf.ce = t.value;
      const c = comm.find((x) => x.id === nf.ce);
      if (c) {
        nf.title = c.title || nf.title;
        nf.date = String(c.startAtISO || "").slice(0, 10) || nf.date;
        if (TYPE[c.opType]) nf.type = c.opType;
      }
      render();
    }
  });
});
