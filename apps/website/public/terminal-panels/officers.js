/**
 * OFFICER MANAGEMENT (approved mock 2026-11-09) — #panel-officers.
 * Grid: every member Recruiter and above × every access item.
 * Role dropdown = default access (saved through the normal personnel rules).
 * Click a cell = grant / remove for that one person (saved through /api/terminal/access).
 * The server re-checks everything.
 */
import { doc, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, db, esc, memberName, mountPanel, notify, onReady } from "./_common.js";

const ROOT = "omV2";
const LV = { recruiter: 2, nco: 2.5, staff_nco: 3, officer: 4, developer: 4.5, commander: 5 };
const RL = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER" };
const MIN_LABEL = { 2: "RECRUITER+", 2.5: "NCO+", 3: "STAFF NCO+", 4: "OFFICER+", 4.5: "DEV / CMDR" };
const GROUPS = ["MANPOWER", "OPERATIONS", "DISCORD", "WORKSPACE", "SECURITY", "COMMAND"];

let data = null; // { me, items, members, assignable }
let rows = []; // working copy [{uid, role, overrides}]
let saved = []; // last saved copy
let q = "", roleF = "", onlyChanged = false;

const clone = (x) => JSON.parse(JSON.stringify(x));
const item = (k) => data.items.find((i) => i.key === k);
const def = (r, it) => (LV[r.role] ?? 0) >= it.min;
const has = (r, it) => (r.role === "commander" ? true : it.locked ? def(r, it) : it.key in r.overrides ? r.overrides[it.key] === 1 : def(r, it));
const meHas = (k) => !!data.me.access[k];
function lockedWhy(r, it) {
  if (r.role === "commander") return "THE COMMANDER ALWAYS HAS FULL ACCESS";
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
  data.members.sort((a, b) => (LV[b.role] ?? 0) - (LV[a.role] ?? 0) || memberName(a).localeCompare(memberName(b)));
  rows = data.members.map((m) => ({ uid: m.uid, role: m.role, overrides: { ...m.overrides } }));
  saved = clone(rows);
  render();
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root || !data) return;
  const cols = GROUPS.map((g) => [g, data.items.filter((i) => i.group === g)]).filter(([, l]) => l.length);
  const count = (pred) => rows.filter(pred).length;
  root.querySelector(".kp").innerHTML = `<div class="k"><b>${count((r) => r.role === "commander")}</b><span>COMMANDER</span></div><div class="k"><b>${count((r) => r.role === "officer" || r.role === "developer")}</b><span>OFFICER / DEV</span></div><div class="k"><b>${count((r) => r.role === "staff_nco")}</b><span>STAFF NCO</span></div><div class="k"><b>${count((r) => r.role === "nco" || r.role === "recruiter")}</b><span>NCO / RECRUITER</span></div>`;

  let h = `<thead><tr><th rowspan="2" class="mh">MEMBER</th><th rowspan="2" class="rh">ROLE</th>${cols.map(([g, l]) => `<th colspan="${l.length}" class="gh">${g}</th>`).join("")}<th rowspan="2"></th></tr><tr>${cols
    .flatMap(([, l]) => l)
    .map((it) => `<th class="ch">${esc(it.label.toUpperCase())}<small>${MIN_LABEL[it.min] || ""}</small></th>`)
    .join("")}</tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const m = data.members[i];
    const n = Object.keys(r.overrides).length;
    if (q && !memberName(m).toLowerCase().includes(q.toLowerCase())) return;
    if (roleF && r.role !== roleF) return;
    if (onlyChanged && !n) return;
    const isMe = r.uid === data.me.uid;
    const roleLocked = r.role === "commander" || isMe || !data.assignable.includes(r.role);
    h += `<tr class="${isMe ? "me" : ""} ${changedOf(r, i) ? "dirty" : ""}"><td class="mh"><b>${esc(memberName(m))}</b>${isMe ? ' <span class="dim">YOU</span>' : ""}${n ? ` <span class="chg">● ${n} CHANGED</span>` : ""}</td><td class="rh">${
      roleLocked
        ? `<span class="rl r-${r.role}">${RL[r.role] || r.role}</span>`
        : `<select data-role="${i}" aria-label="Role for ${esc(memberName(m))}">${Object.keys(RL)
            .filter((x) => data.assignable.includes(x) || x === r.role)
            .map((x) => `<option value="${x}" ${x === r.role ? "selected" : ""}>${RL[x]}</option>`)
            .join("")}</select>`
    }</td>`;
    for (const [, l] of cols)
      for (const it of l) {
        const on = has(r, it), why = lockedWhy(r, it), ov = it.key in r.overrides;
        const was = JSON.stringify(saved[i].overrides[it.key]) !== JSON.stringify(r.overrides[it.key]);
        const cls = why ? (on ? "on lk" : "lk") : ov ? (on ? "gr" : "rv") : on ? "on" : "";
        const tip = why || (ov ? (on ? "EXTRA ACCESS — CLICK TO RESET" : "REMOVED — CLICK TO RESET") : on ? "ROLE DEFAULT — CLICK TO REMOVE" : !meHas(it.key) ? "YOU CAN'T GRANT WHAT YOU DON'T HAVE" : "CLICK TO GRANT");
        h += `<td><button class="c ${cls} ${was ? "dirty" : ""}" data-cell="${i}:${it.key}" role="checkbox" aria-checked="${on}" aria-label="${esc(memberName(m))} — ${esc(it.label)}" title="${tip}" ${why ? 'aria-disabled="true"' : ""}>${on ? "✓" : why ? "🔒" : ov ? "✕" : ""}</button></td>`;
      }
    h += `<td>${n && !lockedWhy(r, { locked: false }) ? `<button class="rst" data-reset="${i}" title="Reset to role defaults" aria-label="Reset ${esc(memberName(m))} to role defaults">↺</button>` : ""}</td></tr>`;
  });
  root.querySelector("table").innerHTML = h + "</tbody>";
  const d = rows.filter((r, i) => changedOf(r, i)).length;
  const bar = root.querySelector(".savebar");
  bar.classList.toggle("show", d > 0);
  bar.querySelector(".dn").textContent = `${d} MEMBER${d === 1 ? "" : "S"} CHANGED — NOT SAVED`;
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
    const changes = rows.filter((r, i) => JSON.stringify(r.overrides) !== JSON.stringify(saved[i].overrides) || r.role !== saved[i].role).map((r) => ({ uid: r.uid, access: r.overrides }));
    if (changes.length) {
      const res = await fetch("/api/terminal/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Save failed");
    }
    notify("✓ ACCESS SAVED — WRITTEN TO AUDIT LOG");
    await load();
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
#${ROOT} .hint{font-size:10px;letter-spacing:1px;color:var(--d);line-height:1.8;margin-top:12px}
`;

onReady(() => {
  const root = mountPanel("panel-officers", ROOT, () => load().catch((e) => notify("OFFICER MANAGEMENT LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">OFFICER MANAGEMENT</div>
    <div class="sub">EVERY MEMBER RECRUITER AND ABOVE — ROLE GIVES DEFAULT ACCESS, CLICK A CELL TO GRANT OR REMOVE FOR THAT PERSON</div>
    <div class="body"><div class="kp"></div>
    <div class="ftr"><input class="srch" data-f="q" placeholder="SEARCH MEMBER..." aria-label="Search member">
      <select class="srch" data-f="role" aria-label="Filter by role"><option value="">ALL ROLES</option>${Object.entries(RL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <label class="dim" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="only"> ONLY CHANGED FROM DEFAULT</label>
      <span class="lgd"><i class="c on"></i>ROLE DEFAULT <i class="c gr"></i>EXTRA GRANTED <i class="c rv"></i>REMOVED <i class="c lk"></i>LOCKED</span></div>
    <div class="wrap"><table></table></div>
    <div class="savebar"><span class="dn"></span><span style="flex:1"></span><button class="b" data-act="discard">DISCARD</button><button class="b gold" data-act="save">SAVE ACCESS CHANGES</button></div>
    <div class="hint">• Role sets the defaults; per-person changes stay when the role changes, until reset (↺).<br>• You can only give access you have yourself, and only to members whose role you're allowed to assign.<br>• 🔒 Commander always has everything · nobody edits their own row · Command pages are Developer / Commander only.<br>• Every change is written to the Audit Log, and the server enforces it on every page — not just the menu.</div></div>`;
  root.addEventListener("click", (e) => {
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
    if (rows.some((r, i) => changedOf(r, i))) e.preventDefault();
  });
});
