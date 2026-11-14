/**
 * OFFICER MANAGEMENT v2 (approved mock 2026-11-14) — #panel-officers.
 * PEOPLE: staff list + one person's access in groups (✓ role · + given · − taken · 🔒), reason required, time-limited access,
 * recent changes with UNDO. ROLE DEFAULTS: unchanged. CHANGE LOG: every change with who / what / reason / UNDO.
 * Grid: every member Recruiter and above × every access item.
 * Role dropdown = default access (saved through the normal personnel rules).
 * Click a cell = grant / remove for that one person (saved through /api/terminal/access).
 * The server re-checks everything.
 * ROLE ACCESS tab (approved mock 2026-11-11): what each ROLE gets by default (Developers / Command edit, /api/terminal/role-access).
 * Per-person changes on the Members tab still win.
 */
import { doc, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, db, esc, memberName, mountPanel, notify, onReady } from "./_common.js";

const ROOT = "omV2";
const LV = { recruiter: 2, nco: 2.5, staff_nco: 3, officer: 4, developer: 4.5, commander: 5 };
const RL = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER" };
const MIN_LABEL = { 2: "RECRUITER+", 2.5: "NCO+", 3: "STAFF NCO+", 4: "OFFICER+", 4.5: "DEV / CMDR" };
const GROUPS = ["MANPOWER", "OPERATIONS", "DISCORD", "WORKSPACE", "SECURITY", "COMMAND"];
const GNAME = { OPERATIONS: "EVENTS" };
let sel = -1; // selected person (index in rows)
let untilW = {}; // uid → { key: "YYYY-MM-DD" } for time-limited access being set now

let data = null; // { me, items, members, assignable }
let rows = []; // working copy [{uid, role, overrides}]
let saved = []; // last saved copy
let q = "", roleF = "", onlyChanged = false;
let tab = "members";
let ra = null; // { canEdit, items, roles, builtIn, current }
let raWork = {}, raSaved = {}; // role → {key: 0|1}

const clone = (x) => JSON.parse(JSON.stringify(x));
const item = (k) => data.items.find((i) => i.key === k);
/** Role default right now: Role Access table, else built-in. */
const roleDef = (role, key) => { const o = raSaved[role]; if (o && key in o) return o[key] === 1; return ra ? !!ra.builtIn[role]?.[key] : (LV[role] ?? 0) >= (item(key)?.min ?? 99); };
const def = (r, it) => (it.locked ? (LV[r.role] ?? 0) >= it.min : roleDef(r.role, it.key));
const FULL = new Set(["commander", "developer"]);
const has = (r, it) => (FULL.has(r.role) ? true : it.locked ? def(r, it) : it.key in r.overrides ? r.overrides[it.key] === 1 : def(r, it));
const meHas = (k) => !!data.me.access[k];
function lockedWhy(r, it) {
  if (r.role === "commander") return "THE COMMANDER ALWAYS HAS FULL ACCESS";
  if (r.role === "developer") return "DEVELOPERS ALWAYS HAVE FULL ACCESS";
  if (r.uid === data.me.uid) return "YOU CAN'T EDIT YOUR OWN ACCESS";
  if (it.locked) return "COMMAND PAGES: DEVELOPER / COMMANDER ONLY";
  if (!data.assignable.includes(r.role)) return "THIS MEMBER OUTRANKS YOUR AUTHORITY";
  return null;
}
const changedOf = (r, i) => JSON.stringify(r) !== JSON.stringify(saved[i]);

async function load() {
  const res = await fetch("/api/terminal/access", { cache: "no-store" });
  const j = await res.json();
  if (!j.members) {
    document.getElementById(ROOT).querySelector(".body").innerHTML = '<div class="empty">🔒 YOU DON\'T HAVE OFFICER MANAGEMENT ACCESS</div>';
    return;
  }
  data = j;
  const rr = await fetch("/api/terminal/role-access", { cache: "no-store" }).catch(() => null);
  ra = rr?.ok ? await rr.json() : null;
  raSaved = clone(ra?.current || {});
  raWork = clone(raSaved);
  data.members.sort((a, b) => (LV[b.role] ?? 0) - (LV[a.role] ?? 0) || memberName(a).localeCompare(memberName(b)));
  rows = data.members.map((m) => ({ uid: m.uid, role: m.role, overrides: { ...m.overrides } }));
  saved = clone(rows);
  if (sel < 0 || sel >= rows.length) sel = Math.max(0, rows.findIndex((r) => r.uid !== data.me.uid && !FULL.has(r.role)));
  render();
  showTab();
}

const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const colOf = (u) => COLS[[...String(u)].reduce((x, c) => x + c.charCodeAt(0), 0) % COLS.length];
const ini = (m) => (memberName(m).replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase();
const av = (m, big) => m.photo ? `<span class="av${big ? " big" : ""}" style="background:url('${esc(m.photo)}') center/cover"></span>` : `<span class="av${big ? " big" : ""}" style="background:${colOf(m.uid)}">${esc(ini(m))}</span>`;
const dmy = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const dt = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function render() {
  const root = document.getElementById(ROOT);
  if (!root || !data) return;
  const count = (pred) => rows.filter(pred).length;
  const last = (data.log || [])[0];
  root.querySelector(".kp").innerHTML = `<div class="k"><b>${rows.length}</b><span>STAFF</span></div><div class="k"><b style="color:#a78bfa">${count((r) => Object.keys(r.overrides).length)}</b><span>WITH CUSTOM ACCESS</span></div>
    <div class="k"><b>${(data.log || []).filter((l) => Date.now() - Date.parse(l.atISO) < 30 * 864e5).length}</b><span>CHANGES (30 DAYS)</span></div><div class="k"><b style="font-size:14px;padding:6px 0">${last ? `${esc(last.byName)} · ${dt(last.atISO)}` : "—"}</b><span>LAST CHANGE</span></div>`;
  // list
  root.querySelector(".pl").innerHTML = rows.map((r, i) => {
    const m = data.members[i], n = Object.keys(r.overrides).length;
    if (q && !memberName(m).toLowerCase().includes(q.toLowerCase())) return "";
    if (roleF && r.role !== roleF) return "";
    if (onlyChanged && !n) return "";
    return `<button class="pm ${i === sel ? "on" : ""} ${changedOf(r, i) ? "dirty" : ""}" data-pick="${i}">${av(m)}<span class="t"><b>${esc(memberName(m))}${r.uid === data.me.uid ? ' <i class="dim">YOU</i>' : ""}</b><small>${RL[r.role] || r.role}</small></span>${n ? `<span class="chg">● ${n}</span>` : ""}</button>`;
  }).join("") || '<div class="empty" style="padding:20px">NOBODY MATCHES.</div>';
  // detail
  const box = root.querySelector(".pd");
  if (sel < 0 || !rows[sel]) { box.innerHTML = '<div class="empty" style="padding:60px 20px">← PICK SOMEONE TO SEE THEIR ACCESS</div>'; return bar(); }
  const r = rows[sel], m = data.members[sel], full = FULL.has(r.role), isMe = r.uid === data.me.uid;
  const roleLocked = r.role === "commander" || isMe || !data.assignable.includes(r.role);
  const un = { ...(m.until || {}), ...(untilW[r.uid] || {}) };
  const hist = (data.log || []).filter((l) => l.targetUid === r.uid).slice(0, 6);
  box.innerHTML = `<div class="who">${av(m, 1)}<div style="flex:1;min-width:0"><div class="nm">${esc(memberName(m))}</div><small class="dim">ROLE DECIDES MOST ACCESS · CHANGES HERE ONLY AFFECT THIS PERSON</small></div>
      <div style="text-align:right"><small class="dim" style="display:block;margin-bottom:4px">ROLE</small>${roleLocked ? `<span class="rl r-${r.role}">${RL[r.role] || r.role}</span>` : `<select data-role="${sel}" aria-label="Role">${Object.keys(RL).filter((x) => data.assignable.includes(x) || x === r.role).map((x) => `<option value="${x}" ${x === r.role ? "selected" : ""}>${RL[x]}</option>`).join("")}</select>`}</div></div>
    ${full ? `<div class="warn">${RL[r.role]} ALWAYS HAS FULL ACCESS — NOTHING TO CHANGE.</div>` : isMe ? '<div class="warn">YOU CAN\'T EDIT YOUR OWN ACCESS.</div>' : ""}
    ${GROUPS.map((g) => { const list = data.items.filter((i) => i.group === g); if (!list.length) return "";
      return `<div class="grp"><h4>${GNAME[g] || g}<span>${list.filter((it) => has(r, it)).length}/${list.length}</span></h4><div class="its">${list.map((it) => {
        const on = has(r, it), d = def(r, it), ov = it.key in r.overrides, why = lockedWhy(r, it);
        const was = JSON.stringify(saved[sel].overrides[it.key]) !== JSON.stringify(r.overrides[it.key]);
        const cls = `${on ? "on" : "off"}${ov && on && !d ? " plus" : ""}${ov && !on && d ? " minus" : ""}${why ? " lk" : ""}${was ? " dirty" : ""}`;
        const tag = it.locked ? "🔒" : ov ? (on ? "ENABLED" : "DISABLED") : on ? "ROLE" : "";
        return `<button class="it ${cls}" data-cell="${sel}:${it.key}" role="checkbox" aria-checked="${on}" title="${esc(why || (ov ? "CLICK TO RESET TO ROLE" : on ? "CLICK TO TAKE AWAY" : "CLICK TO GIVE"))}" ${why ? 'aria-disabled="true"' : ""}>
          <i class="ic">${on ? "✓" : ""}</i><b>${esc(it.label)}</b><small>${tag}${un[it.key] && on && ov ? ` · UNTIL ${dmy(un[it.key])}` : ""}</small></button>`; }).join("")}</div></div>`; }).join("")}
    <div class="leg"><span>✓ HAS IT</span><span style="color:var(--g)">ENABLED — ON TOP OF ROLE</span><span>DISABLED — GREYED OUT</span><span>🔒 COMMANDER / DEVELOPER ONLY</span>
      ${full || isMe ? "" : `<span style="margin-left:auto;display:flex;gap:6px"><button class="b sm" data-act="reset1">↺ RESET TO ROLE</button><button class="b sm" data-act="until">⏱ TIME-LIMITED…</button></span>`}</div>
    <div class="untl" hidden><span class="dim">GIVE ACCESS UNTIL</span><select data-ukey>${data.items.filter((it) => !it.locked && it.key in r.overrides && r.overrides[it.key] === 1).map((it) => `<option value="${it.key}">${esc(it.label)}</option>`).join("") || '<option value="">— enable something first —</option>'}</select>
      <input type="date" data-udate min="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" max="${new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)}"><button class="b sm" data-act="setuntil">SET</button><span class="dim">· switches off by itself</span></div>
    <div class="hh">RECENT CHANGES FOR THIS PERSON</div>
    <div class="hl">${hist.map(logRow).join("") || '<div class="dim" style="padding:8px 0">NO CHANGES YET — EVERYTHING COMES FROM THE ROLE.</div>'}</div>`;
  bar();
}
function logRow(l) {
  return `<div class="lr${l.undone ? " undone" : ""}"><span class="lt">${dt(l.atISO)}</span><span style="flex:1"><b>${esc(l.byName)}</b> → ${esc(l.targetName)}: ${(l.changes || []).map((c) => `<span style="color:${c[0] === "+" ? "var(--g)" : "var(--d)"}">${c[0] === "+" ? "ENABLED " : "DISABLED "}${esc(c.slice(1))}</span>`).join(", ")} <i class="dim">— “${esc(l.reason || "")}”</i>${l.undone ? ` <i class="dim">(UNDONE${l.undoneBy ? " BY " + esc(l.undoneBy) : ""})</i>` : ""}</span>
    ${l.undone ? "" : `<button class="b sm" data-undo="${esc(l.id)}">UNDO</button>`}</div>`;
}
function bar() {
  const root = document.getElementById(ROOT);
  const d = rows.filter((r, i) => changedOf(r, i)).length + Object.keys(untilW).length;
  const b = root.querySelector(".savebar");
  b.classList.toggle("show", d > 0);
  b.querySelector(".dn").textContent = `${d} CHANGE${d === 1 ? "" : "S"} — NOT SAVED`;
}
function renderLog() {
  const root = document.getElementById(ROOT);
  root.querySelector(".lg").innerHTML = `<div class="hl">${(data.log || []).map(logRow).join("") || '<div class="empty">NO CHANGES YET.</div>'}</div>`;
}

/* ───────── ROLE ACCESS tab ───────── */
const raHas = (role, key) => { const o = raWork[role]; return o && key in o ? o[key] === 1 : !!ra.builtIn[role]?.[key]; };
const raChanged = (role, key) => { const o = raWork[role]; return !!o && key in o; }; // differs from built-in
const raDiff = () => {
  const out = [];
  for (const r of ra.roles) for (const it of ra.items) {
    if (it.locked || FULL.has(r.key)) continue;
    const was = raSaved[r.key] && it.key in raSaved[r.key] ? raSaved[r.key][it.key] === 1 : !!ra.builtIn[r.key][it.key];
    const will = raHas(r.key, it.key);
    if (was !== will) {
      const ppl = rows.filter((x) => x.role === r.key), keep = ppl.filter((x) => it.key in x.overrides).length;
      out.push({ up: will, txt: `${will ? "+" : "−"} ${RL[r.key]} → ${it.label} (${ppl.length - keep} member${ppl.length - keep === 1 ? "" : "s"} ${will ? "get" : "lose"} it${keep ? ` · ${keep} keep${keep === 1 ? "s" : ""} their personal setting` : ""})` });
    }
  }
  return out;
};
function renderRoles() {
  const root = document.getElementById(ROOT);
  const box = root.querySelector(".ra");
  if (!ra) { box.innerHTML = '<div class="empty">ROLE ACCESS COULD NOT LOAD.</div>'; return; }
  const ed = ra.canEdit;
  let h = `<div class="ra-info">Set what <b>each role</b> gets by default. Everyone with that role follows it — unless they have their own change on the Members tab (that still wins). Commander always has everything. Bot Server / Settings / Overall Status stay Developer + Commander only. ${ed ? "" : "<b>Only Developers / Command can change role defaults.</b>"}</div>
    <span class="lgd" style="margin:8px 0 10px"><i class="c on"></i>HAS IT <i class="c"></i>DOESN'T <i class="c on chgd"></i>CHANGED FROM BUILT-IN <i class="c lk"></i>FIXED</span>
    <div class="wrap"><table class="rat"><thead><tr><th class="mh">ACCESS</th>${ra.roles.map((r) => `<th class="ch">${RL[r.key]}<small>${r.count} MEMBER${r.count === 1 ? "" : "S"}</small></th>`).join("")}</tr></thead><tbody>`;
  for (const g of GROUPS) {
    const list = ra.items.filter((i) => i.group === g);
    if (!list.length) continue;
    h += `<tr><td class="gh" colspan="${ra.roles.length + 1}">${g}</td></tr>`;
    for (const it of list) {
      h += `<tr><td class="mh"><b>${esc(it.label)}</b>${it.locked ? ' <span class="dim">🔒 DEV / CMD ONLY</span>' : ""}</td>`;
      for (const r of ra.roles) {
        const fixed = it.locked || FULL.has(r.key) || !ed;
        const on = FULL.has(r.key) ? true : it.locked ? !!ra.builtIn[r.key][it.key] : raHas(r.key, it.key);
        const chg = !it.locked && !FULL.has(r.key) && raChanged(r.key, it.key);
        const tip = r.key === "commander" ? "COMMANDER ALWAYS HAS EVERYTHING" : r.key === "developer" ? "DEVELOPERS ALWAYS HAVE EVERYTHING" : it.locked ? "DEVELOPER / COMMANDER ONLY" : !ed ? "ONLY DEVELOPERS / COMMAND CAN CHANGE THIS" : chg ? "CHANGED FROM BUILT-IN — CLICK TO CHANGE" : "BUILT-IN DEFAULT — CLICK TO CHANGE";
        h += `<td><button class="c ${on ? "on" : ""} ${chg ? "chgd" : ""} ${fixed ? "lk" : ""}" ${fixed ? 'aria-disabled="true"' : `data-ra="${r.key}:${it.key}"`} role="checkbox" aria-checked="${on}" aria-label="${RL[r.key]} — ${esc(it.label)}" title="${tip}">${on ? "✓" : it.locked && r.key !== "commander" ? "🔒" : ""}</button></td>`;
      }
      h += "</tr>";
    }
  }
  h += "</tbody></table></div><div class=\"ra-foot\"></div>";
  box.innerHTML = h;
  raFoot();
}
/** Diff list + save bar only (no table rebuild → the page doesn't jump while you click). */
function raFoot() {
  const foot = document.querySelector(`#${ROOT} .ra-foot`);
  if (!foot) return;
  const d = raDiff();
  let h = "";
  if (d.length) h += `<div class="ra-diff"><b>${d.length} UNSAVED CHANGE${d.length === 1 ? "" : "S"}</b><ul>${d.map((x) => `<li class="${x.up ? "up" : "dn"}">${esc(x.txt)}</li>`).join("")}</ul></div>`;
  if (ra.canEdit) h += `<div class="savebar ${d.length ? "show" : ""}" style="${d.length ? "" : "display:flex;border-color:var(--l);color:var(--d);background:var(--p)"}"><span>${d.length ? `${d.length} UNSAVED CHANGE${d.length === 1 ? "" : "S"} · LOGGED TO THE AUDIT LOG` : "NO CHANGES"}</span><span style="flex:1"></span><button class="b" data-act="ra-builtin">RESET ALL TO BUILT-IN</button>${d.length ? '<button class="b" data-act="ra-discard">DISCARD</button><button class="b gold" data-act="ra-save">SAVE ROLE ACCESS</button>' : ""}</div>`;
  foot.innerHTML = h;
}
/** Update the clicked-on boxes in place. */
function raCells() {
  document.querySelectorAll(`#${ROOT} [data-ra]`).forEach((b) => {
    const [role, key] = b.dataset.ra.split(":");
    const on = raHas(role, key), chg = raChanged(role, key);
    b.classList.toggle("on", on);
    b.classList.toggle("chgd", chg);
    b.setAttribute("aria-checked", String(on));
    b.textContent = on ? "✓" : "";
    b.title = chg ? "CHANGED FROM BUILT-IN — CLICK TO CHANGE" : "BUILT-IN DEFAULT — CLICK TO CHANGE";
  });
  raFoot();
}
function raToggle(role, key) {
  const now = raHas(role, key), built = !!ra.builtIn[role][key];
  raWork[role] = { ...(raWork[role] || {}) };
  if (!now === built) delete raWork[role][key];
  else raWork[role][key] = now ? 0 : 1;
  if (!Object.keys(raWork[role]).length) delete raWork[role];
  raCells();
}
async function raSave() {
  const d = raDiff();
  if (!d.length) return;
  const res = await fetch("/api/terminal/role-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: raWork }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return notify("SAVE FAILED: " + (j.error || res.status), 1);
  notify(`✓ ROLE ACCESS SAVED (${j.changed} CHANGE${j.changed === 1 ? "" : "S"}) — WRITTEN TO AUDIT LOG`);
  await load();
}
function showTab() {
  const root = document.getElementById(ROOT);
  root.querySelectorAll("[data-tab]").forEach((b) => { b.classList.toggle("on", b.dataset.tab === tab); b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
  root.querySelector(".mem").hidden = tab !== "members";
  root.querySelector(".ra").hidden = tab !== "roles";
  root.querySelector(".lg").hidden = tab !== "log";
  if (tab === "roles") renderRoles();
  if (tab === "log") renderLog();
}

function toggle(i, key) {
  const r = rows[i], it = item(key);
  const why = lockedWhy(r, it);
  if (why) return notify(why, 1);
  if (key in r.overrides) delete r.overrides[key];
  else {
    const grant = !def(r, it);
    if (grant && !meHas(key)) return notify("YOU CAN'T GRANT ACCESS YOU DON'T HAVE YOURSELF", 1);
    r.overrides[key] = grant ? 1 : 0;
  }
  render();
}

async function save() {
  const btn = document.querySelector(`#${ROOT} [data-act=save]`);
  btn.disabled = true;
  try {
    // 1) role changes — normal personnel rules (assignable roles, not yourself)
    for (const [i, r] of rows.entries()) {
      if (r.role !== saved[i].role) {
        await updateDoc(doc(db, "users", r.uid), { role: r.role });
        await audit("security", "ROLE CHANGED", `${memberName(data.members[i])}: ${RL[saved[i].role]} → ${RL[r.role]}`);
      }
    }
    // 2) access overrides (normalised against the NEW role on the server)
    const reason = document.querySelector(`#${ROOT} [data-why]`)?.value.trim() || "";
    if (reason.length < 3) throw new Error("WRITE A REASON FIRST");
    const changes = rows.filter((r, i) => JSON.stringify(r.overrides) !== JSON.stringify(saved[i].overrides) || r.role !== saved[i].role || untilW[r.uid])
      .map((r, _, __, m = data.members.find((x) => x.uid === r.uid)) => ({ uid: r.uid, access: r.overrides, until: Object.fromEntries(Object.entries({ ...(m?.until || {}), ...(untilW[r.uid] || {}) }).map(([k, v]) => [k, v.length === 10 ? v + "T23:59:00Z" : v])) }));
    if (changes.length) {
      const res = await fetch("/api/terminal/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes, reason }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Save failed");
    }
    notify("✓ ACCESS SAVED — CHANGE LOG + 🔔 ALERT TO THE MEMBER");
    untilW = {};
    const keep = rows[sel]?.uid;
    await load();
    sel = rows.findIndex((r) => r.uid === keep);
    render();
  } catch (e) {
    notify("SAVE FAILED: " + e.message, 1);
  } finally {
    btn.disabled = false;
  }
}

const CSS = `
#${ROOT} .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
#${ROOT} .kp .k{border:1px solid var(--l);background:var(--p2);padding:12px;text-align:center}#${ROOT} .kp b{display:block;font-family:Rajdhani,sans-serif;font-size:24px;color:var(--a)}#${ROOT} .kp span{font-size:9px;letter-spacing:2px;color:var(--d)}
#${ROOT} .ftr{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
#${ROOT} .lgd{font-size:9.5px;letter-spacing:1.2px;color:var(--d);display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto}#${ROOT} .lgd .c{width:14px;height:14px;cursor:default}
#${ROOT} .wrap{overflow:auto;border:1px solid var(--l);max-height:calc(100vh - 330px)}
#${ROOT} table{border-collapse:separate;border-spacing:0;font-size:12px;min-width:1300px;width:100%}
#${ROOT} th{font-weight:400;color:var(--d);font-size:8.5px;letter-spacing:1.2px;padding:8px 4px;border-bottom:1px solid var(--l);background:var(--p);position:sticky;top:0;z-index:2}
#${ROOT} thead tr:nth-child(2) th{top:29px}
#${ROOT} th.gh{color:var(--a);font-size:9px;letter-spacing:2px;background:#0c141b}
#${ROOT} th.ch{vertical-align:bottom;line-height:1.3;text-align:center}#${ROOT} th small{display:block;color:var(--dd);font-size:8px}
#${ROOT} td{padding:5px 4px;text-align:center;border-bottom:1px solid rgba(255,255,255,.04)}
#${ROOT} .mh{text-align:left;position:sticky;left:0;background:var(--p);z-index:1;white-space:nowrap;padding-left:10px}#${ROOT} th.mh{z-index:3}
#${ROOT} .rh{text-align:left;white-space:nowrap}
#${ROOT} td.mh b{font-family:Rajdhani,sans-serif;font-size:14px;color:#fff}
#${ROOT} select{background:#070a0f;border:1px solid var(--l2);font:inherit;font-size:10px;padding:3px;color:#d6dde6}
#${ROOT} .c{display:inline-grid;place-items:center;width:24px;height:24px;border:1px solid var(--l);background:none;cursor:pointer;font-size:12px;padding:0;color:inherit;font-family:inherit}
#${ROOT} .c.on{background:rgba(0,217,255,.12);border-color:rgba(0,217,255,.5);color:var(--a)}
#${ROOT} .c.gr{background:rgba(34,224,122,.15);border-color:var(--g);color:var(--g)}
#${ROOT} .c.rv{border-color:var(--r);color:var(--r);background:rgba(255,77,77,.08)}
#${ROOT} .c.lk{cursor:not-allowed;opacity:.55}#${ROOT} .c.dirty{box-shadow:0 0 0 2px var(--am)}
#${ROOT} .c:focus-visible{outline:2px solid var(--a);outline-offset:1px}
#${ROOT} tr.me td{opacity:.75}#${ROOT} .chg{color:var(--am);font-size:9px;letter-spacing:1px}#${ROOT} .dim{color:var(--d);font-size:9px;letter-spacing:1.5px}
#${ROOT} .rl{font-size:9.5px;letter-spacing:1.5px;border:1px solid;padding:2px 7px}#${ROOT} .r-commander{color:var(--am)}#${ROOT} .r-developer,#${ROOT} .r-officer{color:#a78bfa}
#${ROOT} .rst{background:none;border:0;color:var(--d);cursor:pointer;font-size:13px}
#${ROOT} .savebar{position:sticky;bottom:10px;display:none;gap:8px;align-items:center;border:1px solid var(--am);background:#141006;color:var(--am);padding:10px 14px;font-size:11px;letter-spacing:2px;margin-top:10px;z-index:5}#${ROOT} .savebar.show{display:flex}
#${ROOT} .tabs{display:flex;border-bottom:1px solid var(--l);margin:10px 0 4px}#${ROOT} .tabs button{all:unset;cursor:pointer;padding:9px 16px;font-size:10.5px;letter-spacing:2px;color:var(--d);border-bottom:2px solid transparent}#${ROOT} .tabs button.on{color:#fff;border-bottom-color:var(--a)}#${ROOT} .tabs button:focus-visible{outline:2px solid var(--a)}
#${ROOT} .ra-info{border:1px solid var(--l);background:rgba(0,217,255,.04);padding:10px 12px;font-size:11px;line-height:1.7;color:#9fb3c4;margin-top:12px}#${ROOT} .ra-info b{color:#fff}
#${ROOT} table.rat{min-width:760px}#${ROOT} table.rat td.gh{text-align:left;color:var(--a);font-size:9px;letter-spacing:3px;padding-top:12px;background:none}
#${ROOT} .c.chgd{box-shadow:0 0 0 2px #ffd166}#${ROOT} .c.on.chgd{background:rgba(255,209,102,.25);border-color:#ffd166;color:#ffd166}
#${ROOT} .ra-diff{border:1px solid var(--l);margin-top:12px;padding:10px 12px;font-size:11px}#${ROOT} .ra-diff b{color:#ffd166;letter-spacing:2px}#${ROOT} .ra-diff ul{margin:6px 0 0;padding-left:16px}#${ROOT} .ra-diff .up{color:var(--g)}#${ROOT} .ra-diff .dn{color:var(--r)}
#${ROOT} .b.sm{padding:4px 9px;font-size:10px}
#${ROOT} .pp{display:grid;grid-template-columns:320px 1fr;gap:12px;align-items:start}
#${ROOT} .plw{border:1px solid var(--l);background:var(--p);max-height:calc(100vh - 300px);overflow:auto}
#${ROOT} .pm{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04);border-left:3px solid transparent;cursor:pointer}
#${ROOT} .pm:hover{background:rgba(0,217,255,.04)}#${ROOT} .pm.on{background:rgba(0,217,255,.08);border-left-color:var(--a)}#${ROOT} .pm.dirty{border-left-color:var(--am)}
#${ROOT} .pm .t{flex:1;min-width:0}#${ROOT} .pm b{display:block;font-family:Rajdhani,sans-serif;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${ROOT} .pm small{font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
#${ROOT} .pm .chg{color:#a78bfa;border:1px solid #a78bfa66;padding:0 5px}
#${ROOT} .av{width:34px;height:34px;flex-shrink:0;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%);display:grid;place-items:center;font:700 12px Rajdhani,sans-serif;color:#05070a}#${ROOT} .av.big{width:64px;height:64px;font-size:20px}
#${ROOT} .pd{border:1px solid var(--l);background:var(--p);min-height:420px}
#${ROOT} .who{display:flex;gap:14px;align-items:center;padding:14px}#${ROOT} .who .nm{font:700 20px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}
#${ROOT} .warn{margin:0 14px 10px;border-left:2px solid var(--am);background:rgba(245,158,11,.08);padding:6px 10px;font-size:11px;letter-spacing:1px;color:var(--am)}
#${ROOT} .grp{padding:10px 14px;border-top:1px solid rgba(255,255,255,.05)}#${ROOT} .grp h4{margin:0 0 8px;font-size:10.5px;letter-spacing:2.5px;color:var(--d);font-weight:400;display:flex}#${ROOT} .grp h4 span{margin-left:auto;color:var(--dd)}
#${ROOT} .its{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}
#${ROOT} .it{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.08);padding:7px 9px;cursor:pointer;background:rgba(0,0,0,.2)}
#${ROOT} .it .ic{width:18px;height:18px;display:grid;place-items:center;font-size:11px;font-style:normal;border:1px solid}#${ROOT} .it b{flex:1;font-weight:500;font-size:12.5px;color:#fff}#${ROOT} .it small{font-size:9px;letter-spacing:1px;color:var(--dd)}
#${ROOT} .it.on .ic{border-color:var(--g);color:var(--g)}#${ROOT} .it.off .ic{border-color:var(--dd)}#${ROOT} .it.off b{color:var(--d)}
#${ROOT} .it.plus{border-color:rgba(34,224,122,.5);background:rgba(34,224,122,.06)}#${ROOT} .it.plus small{color:var(--g)}#${ROOT} .it.minus{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.02);opacity:.5}#${ROOT} .it.minus b{text-decoration:line-through}#${ROOT} .it.minus small{color:var(--d)}
#${ROOT} .it.lk{cursor:not-allowed;opacity:.55}#${ROOT} .it.dirty{box-shadow:0 0 0 2px var(--am)}#${ROOT} .it:focus-visible{outline:2px solid var(--a)}
#${ROOT} .leg{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:8px 14px;font-size:10px;letter-spacing:1px;color:var(--d);border-top:1px solid rgba(255,255,255,.05)}
#${ROOT} .untl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 14px;border-top:1px solid rgba(255,255,255,.05);font-size:11px}#${ROOT} .untl[hidden]{display:none}
#${ROOT} .untl input,#${ROOT} .savebar input{background:#070a0f;border:1px solid var(--l2);color:#fff;font:inherit;font-size:11px;padding:4px 6px;color-scheme:dark}#${ROOT} .savebar input{flex:1;border-color:rgba(245,158,11,.5)}
#${ROOT} .hh{padding:9px 14px;border-top:1px solid rgba(0,217,255,.1);font-size:10.5px;letter-spacing:2.5px;color:var(--a)}
#${ROOT} .hl{padding:0 14px 12px}#${ROOT} .lr{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}#${ROOT} .lr b{color:#fff;font-weight:400}#${ROOT} .lr .lt{color:var(--d);width:120px;flex-shrink:0}#${ROOT} .lr.undone{opacity:.5}
#${ROOT} .lg{border:1px solid var(--l);background:var(--p);margin-top:12px;padding-top:6px}
@media(max-width:900px){#${ROOT} .pp{grid-template-columns:1fr}#${ROOT} .plw{max-height:260px}}
#${ROOT} .hint{font-size:10px;letter-spacing:1px;color:var(--d);line-height:1.8;margin-top:12px}
`;

onReady(() => {
  const root = mountPanel("panel-officers", ROOT, () => load().catch((e) => notify("OFFICER MANAGEMENT LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">OFFICER MANAGEMENT</div>
    <div class="sub">EVERY MEMBER RECRUITER AND ABOVE — ROLE GIVES DEFAULT ACCESS, CLICK A CELL TO GRANT OR REMOVE FOR THAT PERSON</div>
    <div class="tabs" role="tablist"><button role="tab" data-tab="members" class="on">♟ PEOPLE</button><button role="tab" data-tab="roles">☰ ROLE DEFAULTS</button><button role="tab" data-tab="log">☍ CHANGE LOG</button></div>
    <div class="body"><div class="mem"><div class="kp"></div>
    <div class="ftr"><input class="srch" data-f="q" placeholder="SEARCH MEMBER..." aria-label="Search member">
      <select class="srch" data-f="role" aria-label="Filter by role"><option value="">ALL ROLES</option>${Object.entries(RL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <label class="dim" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="only"> ONLY CHANGED FROM DEFAULT</label>
      </div>
    <div class="pp"><div class="plw"><div class="pl"></div></div><div class="pd"></div></div>
    <div class="savebar"><span class="dn"></span><input data-why placeholder="REASON (CHANGE LOG + THE MEMBER'S ALERT)" aria-label="Reason"><button class="b" data-act="discard">DISCARD</button><button class="b gold" data-act="save">SAVE ACCESS CHANGES</button></div>
    <div class="hint">• Role sets the defaults; per-person changes stay when the role changes, until reset (↺).<br>• You can only give access you have yourself, and only to members whose role you're allowed to assign.<br>• 🔒 Commander always has everything · nobody edits their own row · Command pages are Developer / Commander only.<br>• Every change is written to the Audit Log, and the server enforces it on every page — not just the menu.</div></div><div class="ra" hidden></div><div class="lg" hidden></div></div>`;
  root.addEventListener("click", (e) => {
    const pk = e.target.closest("[data-pick]");
    if (pk) { sel = +pk.dataset.pick; return render(); }
    const un = e.target.closest("[data-undo]");
    if (un) {
      if (rows.some((r, i) => changedOf(r, i))) return notify("SAVE OR DISCARD YOUR CHANGES FIRST", 1);
      return void fetch("/api/terminal/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "undo", id: un.dataset.undo }) })
        .then(async (res) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || "Undo failed"); notify("✓ UNDONE"); const keep = rows[sel]?.uid; await load(); sel = rows.findIndex((r) => r.uid === keep); render(); if (tab === "log") renderLog(); })
        .catch((err) => notify(String(err.message).toUpperCase(), 1));
    }
    const a1 = e.target.closest("[data-act]")?.dataset.act;
    if (a1 === "reset1" && sel >= 0) { rows[sel].overrides = {}; delete untilW[rows[sel].uid]; return render(); }
    if (a1 === "until") { const u = document.querySelector(`#${ROOT} .untl`); if (u) u.hidden = !u.hidden; return; }
    if (a1 === "setuntil" && sel >= 0) {
      const k = document.querySelector(`#${ROOT} [data-ukey]`)?.value, d = document.querySelector(`#${ROOT} [data-udate]`)?.value;
      if (!k || !d) return notify("PICK THE ACCESS AND A DATE", 1);
      untilW[rows[sel].uid] = { ...(untilW[rows[sel].uid] || {}), [k]: d };
      notify(`⏱ ${item(k).label.toUpperCase()} UNTIL ${dmy(d + "T12:00:00Z").toUpperCase()} — SAVE TO APPLY`);
      return render();
    }
    const tb = e.target.closest("[data-tab]");
    if (tb) { tab = tb.dataset.tab; return showTab(); }
    const ra2 = e.target.closest("[data-ra]");
    if (ra2) { const [r, k] = ra2.dataset.ra.split(":"); return raToggle(r, k); }
    const act2 = e.target.closest("[data-act]")?.dataset.act;
    if (act2 === "ra-save") return raSave();
    if (act2 === "ra-discard") { raWork = clone(raSaved); return raCells(); }
    if (act2 === "ra-builtin") { raWork = {}; notify("ALL ROLES SET BACK TO BUILT-IN — SAVE TO APPLY"); return raCells(); }
    const c = e.target.closest("[data-cell]");
    if (c) {
      const [i, k] = c.dataset.cell.split(":");
      return toggle(+i, k);
    }
    const r = e.target.closest("[data-reset]");
    if (r) {
      rows[+r.dataset.reset].overrides = {};
      return render();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save") return save();
    if (act === "discard") {
      rows = clone(saved);
      untilW = {};
      render();
    }
  });
  root.addEventListener("change", (e) => {
    const r = e.target.dataset.role;
    if (r != null) {
      rows[+r].role = e.target.value;
      notify(`ROLE → ${RL[e.target.value]} (EXTRA ACCESS KEPT) — SAVE TO APPLY`);
      return render();
    }
    if (e.target.dataset.f === "role") roleF = e.target.value;
    if (e.target.dataset.f === "only") onlyChanged = e.target.checked;
    render();
  });
  root.addEventListener("input", (e) => {
    if (e.target.dataset.f !== "q") return;
    q = e.target.value;
    render();
  });
  addEventListener("beforeunload", (e) => {
    if (rows.some((r, i) => changedOf(r, i)) || (ra && raDiff().length)) e.preventDefault();
  });
});
