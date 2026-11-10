/**
 * ATTENDANCE TRACKER v2 (approved mock 2026-11-09) — replaces #panel-attendance.
 *
 * All saving goes through the ORIGINAL functions, so the rules stay the same:
 * loadAttEvent / attCreateNewEvent / attCycleState (auto-save) /
 * saveAttendance(true) = lock + recalculate stats / unlockEvent /
 * deleteAttEvent / editAttMonthlyRate. Presence ("online now") is the
 * original presence system; this panel only reads it.
 */
import { collection, doc, getDocs, onSnapshot, orderBy, query, where, limit } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, db, esc, getUsers, isMember, memberName, mountPanel, notify, onReady, platoonOrder, rankOrder, rateColor, today, toDate } from "./_common.js";
import { ask, tell } from "./_common.js";

// Lock / unlock = "Lock Attendance" in the access grid (Staff NCO+ by default).
let canLock = false;
onAccess((me) => { canLock = !!me.access.lock; });
const ROOT = "attV2";
const TYPE = { main_op: ["MAIN OP", "#00D9FF"], patrol: ["PATROL", "#22e07a"], training: ["TRAINING", "#f59e0b"], fun_op: ["FUN OP", "#a78bfa"] };
const PLATOONS = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot"];

let users = [];
let events = [];
let cur = null; // selected event {id,...}
let pf = "ALL";
let q = "";
let eq = "";
let unsubEv = null;
let unsubPres = null;
let presence = [];
let busy = false;

const roll = () =>
  users
    .filter((u) => isMember(u) && u.platoon !== "Reserves" && u.role !== "retired_veteran")
    .sort((a, b) => platoonOrder(a.platoon) - platoonOrder(b.platoon) || rankOrder(a.rank) - rankOrder(b.rank));
const pct = (e) => {
  const n = roll().length;
  return n ? Math.round(((e.attendees || []).length / n) * 100) : 0;
};
const rateOf = (u) => (u.opsEligible ? Math.round(((u.opsAttended || 0) / u.opsEligible) * 100) : null);

async function load() {
  users = await getUsers();
  const snap = await getDocs(query(collection(db, "attendance_events"), orderBy("date", "desc"), limit(60)));
  events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (cur) cur = events.find((e) => e.id === cur.id) || null;
  if (!cur && events.length) {
    // Open the newest unlocked event, otherwise the newest event.
    await pick((events.find((e) => !e.locked) || events[0]).id, true);
  }
  render();
}

async function pick(id, quiet) {
  const e = events.find((x) => x.id === id);
  if (!e) return;
  cur = { ...e };
  render();
  // Point the original code at this event (it keeps its own copy for saving).
  if (typeof window.loadAttEvent === "function") await window.loadAttEvent(id);
  unsubEv?.();
  unsubEv = onSnapshot(doc(db, "attendance_events", id), (s) => {
    if (!s.exists() || !cur || cur.id !== id || busy) return;
    cur = { id, ...s.data() };
    const i = events.findIndex((x) => x.id === id);
    if (i >= 0) events[i] = { ...cur };
    render();
  });
  if (!quiet) document.getElementById(ROOT)?.querySelector(".evc")?.scrollIntoView({ block: "nearest" });
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
const presenceHtml = () => {
  const seen = new Set();
  const list = presence.filter((p) => !seen.has(p.uid) && seen.add(p.uid));
  return list.length
    ? list.map((p) => `<span class="pp"><i></i>${esc(memberName(p))}${p.eventId && cur && p.eventId === cur.id ? " · HERE" : ""}</span>`).join("")
    : '<span style="color:var(--dd)">ONLY YOU</span>';
};

// ───────── render ─────────
function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const members = roll();
  const locked = events.filter((e) => e.locked);
  const tAtt = members.reduce((s, u) => s + (u.opsAttended || 0), 0);
  const tElig = members.reduce((s, u) => s + (u.opsEligible || 0), 0);
  const unitRate = tElig ? Math.round((tAtt / tElig) * 100) : 0;
  const below = members.filter((u) => rateOf(u) != null && rateOf(u) < 50).length;
  const ym = today().slice(0, 7);
  const thisMonth = events.filter((e) => String(e.date || "").startsWith(ym)).length;

  root.querySelector(".unit").innerHTML = `
    <div class="k"><b style="color:var(--a)">${locked.length}</b><span>TOTAL OPS</span></div>
    <div class="k"><b style="color:${rateColor(unitRate)}">${unitRate}%</b><span>UNIT ATTENDANCE</span></div>
    <div class="k"><b style="color:var(--am)">${below}</b><span>MEMBERS BELOW 50%</span></div>
    <div class="k"><b style="color:var(--a)">${thisMonth}</b><span>OPS THIS MONTH</span></div>`;
  root.querySelector(".who").innerHTML = presenceHtml();

  // Events rail, grouped by month
  let last = "";
  root.querySelector(".evs").innerHTML =
    events
      .filter((e) => String(e.title || "").toLowerCase().includes(eq.toLowerCase()))
      .map((e) => {
        const m = toDate(e.date)?.toLocaleString("en-GB", { month: "long", year: "numeric" }).toUpperCase() || "—";
        const head = m !== last ? `<div class="mon">${m}</div>` : "";
        last = m;
        const [tl, tc] = TYPE[e.type] || [String(e.type || "—").toUpperCase(), "#9fb3c4"];
        const p = pct(e);
        return `${head}<button class="ev ${cur && e.id === cur.id ? "on" : ""}" style="--tc:${tc}" data-ev="${esc(e.id)}"><span class="eb"></span>
          <span style="min-width:0"><span class="et">${esc(e.title || "Untitled")}</span><span class="em">${esc(String(e.date || "").slice(8, 10))} ${esc(String(e.date || "").slice(5, 7))} · <b>${tl}</b> · ${e.locked ? "🔒" : '<b style="color:var(--g)">● LIVE</b>'}</span></span>
          <span class="pc" style="color:${rateColor(p)}">${p}%<small>${(e.attendees || []).length} PRESENT</small></span></button>`;
      })
      .join("") || '<div class="mon">NO EVENTS YET</div>';

  // Selected event
  const evc = root.querySelector(".evc");
  if (!cur) {
    evc.innerHTML = '<div class="empty" style="margin:20px">CREATE AN EVENT ON THE LEFT TO START ROLL CALL</div>';
    return;
  }
  const att = new Set(cur.attendees || []);
  const [tl, tc] = TYPE[cur.type] || [String(cur.type || "—").toUpperCase(), "#9fb3c4"];
  const present = members.filter((u) => att.has(u.id)).length;
  const p = members.length ? Math.round((present / members.length) * 100) : 0;
  const shown = members.filter((u) => (pf === "ALL" || u.platoon === pf) && memberName(u).toLowerCase().includes(q.toLowerCase()));
  const d = toDate(cur.date);
  evc.classList.toggle("locked", !!cur.locked);
  evc.innerHTML = `
    <div class="evh">
      <div class="ring" style="--p:${p};--rc:${rateColor(p)}"><div style="color:${rateColor(p)}">${p}%</div></div>
      <div class="ttl"><h2>${esc(cur.title || "Untitled")}</h2>
        <div class="tags"><span class="tag" style="color:${tc};border-color:${tc}88">${tl}</span>
          <span class="tag" style="color:#9fb3c4;border-color:#3b4a5a">${d && !isNaN(d) ? d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "—"}</span>
          ${cur.locked ? '<span class="tag" style="color:var(--am);border-color:var(--am)">🔒 LOCKED</span>' : '<span class="tag" style="color:var(--g);border-color:var(--g)">● LIVE — ROLL CALL OPEN</span>'}</div>
        <div class="counts"><span><b style="color:var(--g)">${present}</b>PRESENT</span><span><b style="color:var(--r)">${members.length - present}</b>ABSENT</span><span><b style="color:#c6d0da">${members.length}</b>ELIGIBLE</span></div></div>
      <div class="acts">${
        !canLock
          ? '<span class="tag" style="color:var(--d);border-color:var(--l2)">LOCK / UNLOCK: STAFF NCO AND ABOVE</span>'
          : cur.locked
          ? `<button class="b" style="color:var(--am);border-color:var(--am)" data-act="unlock">🔓 UNLOCK TO CORRECT</button>`
          : `<button class="b gold" data-act="lock">🔒 LOCK &amp; FINALISE</button>`
      }<button class="b red" data-act="delete" ${cur.locked ? 'disabled title="Unlock first"' : ""}>✕ DELETE EVENT</button></div>
    </div>
    <div class="lockednote">🔒 LOCKED — PERMANENT RECORD. STATS ARE COUNTED. UNLOCK TO CORRECT, THEN RE-LOCK.</div>
    <div class="tools">
      ${["ALL", ...PLATOONS]
        .map((pl) => {
          const g = pl === "ALL" ? members : members.filter((u) => u.platoon === pl);
          if (!g.length && pl !== "ALL") return "";
          return `<button class="chip ${pf === pl ? "on" : ""}" data-pf="${esc(pl)}">${pl === "ALL" ? "ALL" : esc(pl.replace("Platoon", "PLT").toUpperCase())}<small>${g.filter((u) => att.has(u.id)).length}/${g.length}</small></button>`;
        })
        .join("")}
      <span class="sp"></span>
      <input class="srch rq" placeholder="FIND MARINE..." value="${esc(q)}" aria-label="Find member">
      <button class="b" data-act="all" ${cur.locked ? "disabled" : ""}>✓ ALL SHOWN PRESENT</button>
      <button class="b" data-act="clear" ${cur.locked ? "disabled" : ""}>CLEAR</button>
    </div>
    <div class="roll">${
      PLATOONS.concat(["Awaiting BCT", ""])
        .map((pl) => {
          const g = shown.filter((u) => (u.platoon || "") === pl);
          if (!g.length) return "";
          return `<div class="grp">${esc((pl || "NO PLATOON").toUpperCase())}<span>${g.filter((u) => att.has(u.id)).length} / ${g.length} PRESENT</span></div>` +
            g
              .map((u) => {
                const on = att.has(u.id);
                const r = rateOf(u);
                return `<div class="m ${on ? "p" : ""}" role="button" tabindex="0" aria-pressed="${on}" data-uid="${esc(u.id)}"><span class="box">✓</span>
                  <span style="min-width:0"><span class="nm2">${esc(memberName(u))}</span><span class="rk">${esc(u.rank || "—")}</span></span>
                  <button class="rate" style="color:${rateColor(r)}" title="Monthly rate — click to correct" data-rate="${esc(u.id)}">${r == null ? "—" : r + "%"}<small>${u.opsAttended || 0}/${u.opsEligible || 0}</small></button></div>`;
              })
              .join("");
        })
        .join("") || '<div class="empty" style="grid-column:1/-1">NOBODY MATCHES</div>'
    }</div>
    <div class="legend">TAP A NAME TO MARK PRESENT / ABSENT · SAVES AUTOMATICALLY · % = ATTENDANCE RATE (CLICK TO CORRECT)</div>`;
  const rq = evc.querySelector(".rq");
  if (rq && document.activeElement?.classList?.contains("rq-was")) rq.focus();
}

// ───────── actions ─────────
async function toggle(uid) {
  if (!cur || cur.locked) return notify("EVENT IS LOCKED — UNLOCK TO CORRECT", 1);
  const set = new Set(cur.attendees || []);
  set.has(uid) ? set.delete(uid) : set.add(uid);
  cur.attendees = [...set];
  const i = events.findIndex((x) => x.id === cur.id);
  if (i >= 0) events[i].attendees = cur.attendees;
  render();
  busy = true;
  try {
    await window.attCycleState(uid); // original: toggles its copy + saves
  } finally {
    busy = false;
  }
}

async function markAll(present) {
  if (!cur || cur.locked) return;
  const att = new Set(cur.attendees || []);
  const targets = roll().filter((u) => (pf === "ALL" || u.platoon === pf) && memberName(u).toLowerCase().includes(q.toLowerCase()) && att.has(u.id) !== present);
  if (!targets.length) return;
  for (const u of targets) await toggle(u.id);
  notify(present ? `✓ ${targets.length} MARKED PRESENT` : `${targets.length} CLEARED`);
}

async function createEvent(form) {
  const title = form.querySelector(".nfn").value.trim();
  const date = form.querySelector(".nfd").value;
  const type = form.querySelector(".nft").value;
  if (!title) return notify("ENTER AN OPERATION / EVENT NAME", 1);
  // Fill the original form and use the original create (duplicate check, audit log, live sync).
  document.getElementById("attEventTitle").value = title;
  document.getElementById("attEventDate").value = date;
  document.getElementById("attEventType").value = type;
  await window.attCreateNewEvent();
  form.classList.remove("open");
  form.querySelector(".nfn").value = "";
  cur = null;
  const snap = await getDocs(query(collection(db, "attendance_events"), where("title", "==", title), where("date", "==", date)));
  await load();
  if (!snap.empty) await pick(snap.docs[0].id);
}

const CSS = `
#${ROOT} .live{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--l);background:var(--p);padding:8px 12px;margin:14px 0 12px;font-size:10px;letter-spacing:2px;color:var(--d)}
#${ROOT} .who{display:flex;gap:6px;flex-wrap:wrap}
#${ROOT} .pp{display:flex;align-items:center;gap:6px;border:1px solid rgba(0,217,255,.4);color:var(--a);padding:3px 8px;font-size:10px;letter-spacing:1px}
#${ROOT} .pp i{width:7px;height:7px;border-radius:50%;background:var(--g);box-shadow:0 0 6px var(--g)}
#${ROOT} .unit{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
#${ROOT} .layout{display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start}
#${ROOT} .rail{border:1px solid var(--l);background:var(--p);position:sticky;top:12px}
#${ROOT} .rail-h{display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--l)}
#${ROOT} .rail-h h3{margin:0;font-family:Rajdhani,sans-serif;letter-spacing:3px;font-size:13px;color:var(--a)}
#${ROOT} .nf{display:none;padding:12px;border-bottom:1px solid var(--l);background:#0a0e14;gap:8px;flex-direction:column}
#${ROOT} .nf.open{display:flex}
#${ROOT} .nf input,#${ROOT} .nf select{background:#070a0f;border:1px solid var(--l2);padding:8px;font:inherit;font-size:12px;outline:0;width:100%;color:#d6dde6}
#${ROOT} .nf .r{display:flex;gap:8px}
#${ROOT} .rail-s{padding:8px 12px;border-bottom:1px solid var(--l)}
#${ROOT} .rail-s input{width:100%}
#${ROOT} .evs{max-height:600px;overflow:auto}
#${ROOT} .mon{font-size:9px;letter-spacing:3px;color:var(--dd);padding:10px 12px 4px}
#${ROOT} .ev{display:grid;grid-template-columns:3px 1fr auto;gap:10px;align-items:center;padding:9px 12px 9px 0;border:0;border-bottom:1px solid rgba(0,217,255,.06);cursor:pointer;background:none;width:100%;text-align:left;font:inherit;color:inherit}
#${ROOT} .ev:hover{background:rgba(0,217,255,.04)}#${ROOT} .ev.on{background:rgba(0,217,255,.08)}
#${ROOT} .ev .eb{align-self:stretch;background:var(--tc)}
#${ROOT} .ev .et{display:block;font-size:12.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .ev .em{display:block;font-size:9px;letter-spacing:1.5px;color:var(--d);margin-top:3px}
#${ROOT} .ev .em b{font-weight:400;color:var(--tc)}
#${ROOT} .ev .pc{text-align:right;font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px}
#${ROOT} .ev .pc small{display:block;font-family:'Share Tech Mono',monospace;font-size:8.5px;letter-spacing:1px;color:var(--d);font-weight:400}
#${ROOT} .evc{border:1px solid var(--l);background:var(--p);min-width:0}
#${ROOT} .evh{display:flex;gap:16px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--l);flex-wrap:wrap}
#${ROOT} .ring{width:84px;height:84px;border-radius:50%;background:conic-gradient(var(--rc) calc(var(--p)*1%),#1a2330 0);display:grid;place-items:center;flex-shrink:0}
#${ROOT} .ring div{width:68px;height:68px;border-radius:50%;background:var(--p);display:grid;place-items:center;font-family:Rajdhani,sans-serif;font-weight:700;font-size:20px}
#${ROOT} .ttl{flex:1;min-width:200px}
#${ROOT} .ttl h2{margin:0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:22px;color:#fff}
#${ROOT} .tags{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;font-size:10px;letter-spacing:1.5px}
#${ROOT} .tag{border:1px solid;padding:2px 7px}
#${ROOT} .counts{display:flex;gap:18px;margin-top:10px;font-size:10px;letter-spacing:2px;color:var(--d)}
#${ROOT} .counts b{font-family:Rajdhani,sans-serif;font-size:20px;margin-right:4px}
#${ROOT} .acts{display:flex;flex-direction:column;gap:6px}
#${ROOT} .lockednote{display:none;padding:9px 18px;background:rgba(245,158,11,.07);border-bottom:1px solid rgba(245,158,11,.3);color:var(--am);font-size:10.5px;letter-spacing:1.5px}
#${ROOT} .evc.locked .lockednote{display:block}
#${ROOT} .tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--l)}
#${ROOT} .tools .srch{width:170px}
#${ROOT} .roll{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;padding:14px 18px 18px}
#${ROOT} .grp{grid-column:1/-1;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:12px;color:var(--a);opacity:.8;border-bottom:1px solid var(--l);padding:6px 0 4px;margin-top:6px;display:flex;justify-content:space-between}
#${ROOT} .grp span{font-family:'Share Tech Mono',monospace;font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
#${ROOT} .m{display:flex;align-items:center;gap:10px;border:1px solid var(--l);background:var(--p2);padding:9px 10px;cursor:pointer;transition:border-color .12s,background .12s}
#${ROOT} .m:hover{border-color:var(--l2)}#${ROOT} .m:focus-visible{outline:2px solid var(--a);outline-offset:1px}
#${ROOT} .m .box{width:26px;height:26px;flex-shrink:0;border:1px solid #3b4a5a;display:grid;place-items:center;font-size:14px;color:transparent}
#${ROOT} .m .nm2{display:block;font-size:12.5px;color:#c6d0da;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .m .rk{display:block;font-size:9px;letter-spacing:1px;color:var(--dd);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .m .rate{margin-left:auto;text-align:right;font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;background:none;border:1px solid transparent;cursor:pointer;padding:2px 4px}
#${ROOT} .m .rate:hover{border-color:var(--l2)}
#${ROOT} .m .rate small{display:block;font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--dd);font-weight:400;letter-spacing:1px}
#${ROOT} .m.p{border-color:rgba(34,224,122,.55);background:rgba(34,224,122,.07)}
#${ROOT} .m.p .box{border-color:var(--g);background:var(--g);color:#03130a}
#${ROOT} .m.p .nm2{color:#fff}
#${ROOT} .evc.locked .m{cursor:not-allowed;opacity:.8}
#${ROOT} .legend{padding:0 18px 14px;font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
@media(max-width:1100px){#${ROOT} .layout{grid-template-columns:1fr}#${ROOT} .rail{position:static}#${ROOT} .evs{max-height:260px}#${ROOT} .unit{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){#${ROOT} .roll{grid-template-columns:1fr 1fr}#${ROOT} .m .rate{display:none}#${ROOT} .tools .srch{width:100%}}
`;

onReady(() => {
  const root = mountPanel("panel-attendance", ROOT, async () => {
    watchPresence();
    try {
      await load();
    } catch (e) {
      notify("ATTENDANCE LOAD FAILED: " + e.message, 1);
    }
  });
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">ATTENDANCE TRACKER</div>
    <div class="live" aria-live="polite"><span>ONLINE NOW</span><div class="who"></div><span class="sp"></span><span style="color:var(--g)">✓ SAVES AUTOMATICALLY</span></div>
    <div class="unit"></div>
    <div class="layout">
      <aside class="rail">
        <div class="rail-h"><h3>EVENTS</h3><button class="b" data-act="new">+ NEW EVENT</button></div>
        <div class="nf">
          <input class="nfn" placeholder="Operation / event name" aria-label="Event name" maxlength="120">
          <div class="r"><input class="nfd" type="date" value="${today()}" aria-label="Date"><select class="nft" aria-label="Type"><option value="main_op">MAIN OP</option><option value="patrol">PATROL</option><option value="training">TRAINING</option><option value="fun_op">FUN OP</option></select></div>
          <button class="b gold" data-act="create">CREATE &amp; START ROLL CALL ▸</button>
        </div>
        <div class="rail-s"><input class="srch eq" placeholder="SEARCH EVENTS..." aria-label="Search events"></div>
        <div class="evs"></div>
      </aside>
      <section class="evc"></section>
    </div>`;

  root.addEventListener("click", async (e) => {
    const t = e.target;
    const rate = t.closest("[data-rate]");
    if (rate) {
      e.stopPropagation();
      const u = users.find((x) => x.id === rate.dataset.rate);
      if (u) window.editAttMonthlyRate?.(u.id, memberName(u), u.opsAttended || 0, u.opsEligible || 0);
      return;
    }
    const m = t.closest(".m[data-uid]");
    if (m) return toggle(m.dataset.uid);
    const ev = t.closest("[data-ev]");
    if (ev) return pick(ev.dataset.ev);
    const pfb = t.closest("[data-pf]");
    if (pfb) {
      pf = pfb.dataset.pf;
      return render();
    }
    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "new") return root.querySelector(".nf").classList.toggle("open");
    if (act === "create") return createEvent(root.querySelector(".nf"));
    if (act === "all") return markAll(true);
    if (act === "clear") return markAll(false);
    if (act === "lock") {
      if (!(await ask({ kind: "warn", title: "LOCK ATTENDANCE?", body: "This finalises attendance and recalculates every member's stats.", item: cur.title, go: "LOCK" }))) return;
      await window.saveAttendance(true);
      return load();
    }
    if (act === "unlock") {
      await window.unlockEvent();
      return load();
    }
    if (act === "delete") {
      const id = cur.id;
      await window.deleteAttEvent(id, cur.title || "this event");
      const snap = await getDocs(collection(db, "attendance_events"));
      if (!snap.docs.some((d) => d.id === id)) {
        cur = null;
        unsubEv?.();
      }
      return load();
    }
  });
  root.addEventListener("keydown", (e) => {
    const m = e.target.closest?.(".m[data-uid]");
    if (m && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle(m.dataset.uid);
    }
    if (e.key === "Enter" && e.target.classList?.contains("nfn")) createEvent(root.querySelector(".nf"));
  });
  root.addEventListener("input", (e) => {
    if (e.target.classList.contains("rq")) {
      q = e.target.value;
      render();
      const el = root.querySelector(".rq");
      el.focus();
      el.setSelectionRange(q.length, q.length);
    }
    if (e.target.classList.contains("eq")) {
      eq = e.target.value;
      render();
    }
  });
});
