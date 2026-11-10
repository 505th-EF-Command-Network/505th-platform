/**
 * WORKSPACE (approved mock 2026-11-09): PROJECT TRACKER + NOTES.
 * Collections `projects` and `notes` (terminal data API). Access: "proj" / "notes"
 * in the grid (Staff NCO+ by default) — enforced by the server on read and write.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, closeModal, db, esc, getMe, getUsers, isMember, memberName, mountPanel, notify, onReady, openModal, ukDate } from "./_common.js";
import { ask, tell } from "./_common.js";

const COLS = [["todo", "TO DO"], ["doing", "IN PROGRESS"], ["review", "REVIEW"], ["done", "DONE"]];
const PRI = { high: ["HIGH", "#ff4d4d"], med: ["MED", "#f59e0b"], low: ["LOW", "#7d8a99"] };
const STAFF_ROLES = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);

/* ───────────────────────────── PROJECT TRACKER ───────────────────────────── */
let tasks = [];
let staff = [];
let showDone = true;

async function loadProjects() {
  const [snap, us] = await Promise.all([getDocs(collection(db, "projects")), staff.length ? null : getUsers()]);
  if (us) staff = us.filter((u) => isMember(u) && STAFF_ROLES.has(u.role)).sort((a, b) => memberName(a).localeCompare(memberName(b)));
  tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProjects();
}

function renderProjects() {
  const root = document.getElementById("projV2");
  if (!root) return;
  root.querySelector(".kan").innerHTML = COLS.map(([k, label]) => {
    const list = tasks
      .filter((t) => (t.status || "todo") === k)
      .sort((a, b) => (k === "done" ? String(b.doneAt || "").localeCompare(String(a.doneAt || "")) : ({ high: 0, med: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, med: 1, low: 2 }[b.priority] ?? 1) || String(a.due || "9").localeCompare(String(b.due || "9"))));
    const shown = k === "done" && !showDone ? [] : k === "done" ? list.slice(0, 15) : list;
    return `<div class="col" data-col="${k}"><h3>${label}<span>${list.length}</span></h3>
      ${shown
        .map((t) => {
          const [pl, pc] = PRI[t.priority] || PRI.med;
          const late = t.due && k !== "done" && t.due < new Date().toISOString().slice(0, 10);
          return `<button class="tk ${k === "done" ? "dn" : ""}" draggable="true" data-id="${t.id}" aria-label="${esc(t.title)} — open">
            <b>${esc(t.title)}</b>
            <span class="tm">${k !== "done" ? `<i class="pr" style="color:${pc};border-color:${pc}">${pl}</i>` : ""}${esc(t.assigneeName || "UNASSIGNED")}${t.due ? ` · <span style="${late ? "color:#ff4d4d" : ""}">${late ? "LATE " : "DUE "}${ukDate(t.due, { day: "2-digit", month: "short" }).toUpperCase()}</span>` : ""}</span>
            ${t.progress && k !== "done" ? `<span class="pb"><i style="width:${Math.min(100, t.progress)}%"></i></span>` : ""}</button>`;
        })
        .join("")}
      ${k === "done" && list.length > 15 && showDone ? `<div class="more">+ ${list.length - 15} OLDER</div>` : ""}
      ${k === "todo" ? '<button class="add" data-act="new">+ ADD TASK</button>' : ""}</div>`;
  }).join("");
}

function openTask(t) {
  const isNew = !t;
  t = t || { title: "", description: "", status: "todo", priority: "med", assigneeUid: "", due: "", progress: 0 };
  openModal(
    `<div class="hd"><div><h2>${isNew ? "NEW TASK" : "EDIT TASK"}</h2>${!isNew ? `<small>CREATED BY ${esc(t.createdByName || "—")}${t.createdAtISO ? " · " + ukDate(t.createdAtISO) : ""}</small>` : ""}</div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd">
      <label class="lbl" for="tT">TITLE</label><input class="fld" id="tT" maxlength="120" value="${esc(t.title)}">
      <label class="lbl" for="tD">DETAILS</label><textarea class="fld" id="tD" maxlength="2000" rows="4">${esc(t.description || "")}</textarea>
      <div class="g4">
        <div><label class="lbl" for="tS">STATUS</label><select class="fld" id="tS">${COLS.map(([k, l]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div><label class="lbl" for="tP">PRIORITY</label><select class="fld" id="tP">${Object.entries(PRI).map(([k, [l]]) => `<option value="${k}" ${t.priority === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div><label class="lbl" for="tA">ASSIGNED TO</label><select class="fld" id="tA"><option value="">UNASSIGNED</option>${staff.map((u) => `<option value="${esc(u.id)}" ${u.id === t.assigneeUid ? "selected" : ""}>${esc(memberName(u))}</option>`).join("")}</select></div>
        <div><label class="lbl" for="tDu">DUE</label><input class="fld" type="date" id="tDu" value="${esc(t.due || "")}"></div>
      </div>
      <label class="lbl" for="tPr">PROGRESS <small id="tPv">${t.progress || 0}%</small></label><input type="range" id="tPr" min="0" max="100" step="5" value="${t.progress || 0}" style="width:100%;accent-color:#22e07a">
    </div>
    <div class="ft">${isNew ? "<span></span>" : '<button class="b red" data-x="del">DELETE</button>'}<div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" data-x="save">${isNew ? "ADD TASK" : "SAVE"}</button></div></div>`,
    { width: 680 },
  );
  const box = document.getElementById("v2Modal");
  box.querySelector("#tPr").addEventListener("input", (e) => (box.querySelector("#tPv").textContent = e.target.value + "%"));
  box.addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "del") {
      if (!(await ask({ kind: "danger", title: "DELETE TASK?", item: t.title, warn: "THIS CANNOT BE UNDONE.", go: "DELETE TASK" }))) return;
      try {
        await deleteDoc(doc(db, "projects", t.id));
        await audit("workspace", "TASK DELETED", t.title);
        closeModal();
        loadProjects();
      } catch (err) {
        notify("DELETE FAILED: " + err.message, 1);
      }
    }
    if (x !== "save") return;
    const title = box.querySelector("#tT").value.trim();
    if (title.length < 3) return notify("GIVE THE TASK A TITLE (3+ CHARACTERS)", 1);
    const aUid = box.querySelector("#tA").value;
    const status = box.querySelector("#tS").value;
    const me = await getMe();
    const v = {
      title, description: box.querySelector("#tD").value.trim(), status, priority: box.querySelector("#tP").value,
      assigneeUid: aUid, assigneeName: aUid ? memberName(staff.find((u) => u.id === aUid)) : "",
      due: box.querySelector("#tDu").value, progress: status === "done" ? 100 : +box.querySelector("#tPr").value,
      updatedAtISO: new Date().toISOString(), updatedByName: memberName(me),
      ...(status === "done" && t.status !== "done" ? { doneAt: new Date().toISOString() } : {}),
    };
    try {
      if (isNew) {
        await addDoc(collection(db, "projects"), { ...v, createdBy: me?.uid || "", createdByName: memberName(me), createdAt: serverTimestamp(), createdAtISO: new Date().toISOString() });
        await audit("workspace", "TASK ADDED", title);
      } else {
        await updateDoc(doc(db, "projects", t.id), v);
        if (t.status !== status) await audit("workspace", "TASK MOVED", `${title}: ${t.status} → ${status}`);
      }
      notify(isNew ? "✓ TASK ADDED" : "✓ TASK SAVED");
      closeModal();
      loadProjects();
    } catch (err) {
      notify("SAVE FAILED: " + err.message, 1);
    }
  });
}

async function moveTask(id, status) {
  const t = tasks.find((x) => x.id === id);
  if (!t || (t.status || "todo") === status) return;
  const prev = t.status;
  t.status = status;
  if (status === "done") (t.progress = 100), (t.doneAt = new Date().toISOString());
  renderProjects();
  try {
    await updateDoc(doc(db, "projects", id), { status, ...(status === "done" ? { progress: 100, doneAt: t.doneAt } : {}), updatedAtISO: new Date().toISOString() });
    await audit("workspace", "TASK MOVED", `${t.title}: ${prev || "todo"} → ${status}`);
  } catch (e) {
    t.status = prev;
    renderProjects();
    notify("MOVE FAILED: " + e.message, 1);
  }
}

/* ────────────────────────────────── NOTES ────────────────────────────────── */
// Per-note sharing (approved mock 2026-11-10). All reads/saves go through /api/terminal/notes,
// which checks who can see / edit each note. Owner: 🔒 private or 👥 shared with people + groups.
let notes = [];
let people = [];
let groups = [];
let meUid = null;
let cur = null;
let nq = "";
let nf = "all";
let saveTimer = null;
let dirty = false;
let shareDraft = null;

const PERM_L = { view: "CAN VIEW", edit: "CAN EDIT" };
async function api(method, body, qs = "") {
  const r = await fetch("/api/terminal/notes" + qs, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Server error");
  return j;
}

async function loadNotes() {
  const j = await api("GET");
  notes = j.notes || [];
  people = j.people || [];
  groups = j.groups || [];
  meUid = j.me;
  const nb = document.querySelector('#notesV2 [data-act="nnew"]');
  if (nb) nb.style.display = j.canCreate ? "" : "none";
  if (!cur || !notes.some((n) => n.id === cur)) cur = notes[0]?.id || null;
  const ed = document.querySelector("#notesV2 .ne");
  if (ed) ed.dataset.id = "";
  renderNotes();
}

function shareTag(n) {
  const s = n.shareSummary || { mode: "private", people: [], groups: [] };
  if (n.access !== "owner") return `<span class="tag" style="--c:#f59e0b">◈ ${esc(n.ownerName || "SHARED")} · ${PERM_L[n.access] || ""}</span>`;
  if (s.mode === "private") return `<span class="tag" style="--c:#7d8a99">🔒 PRIVATE</span>`;
  const bits = [];
  if (s.people.length) bits.push(`${s.people.length} ${s.people.length === 1 ? "PERSON" : "PEOPLE"}`);
  s.groups.forEach((g) => bits.push(g.label));
  return `<span class="tag" style="--c:#00D9FF">👥 ${esc(bits.join(" · ") || "NOBODY YET")}</span>`;
}
function shareLine(n) {
  const s = n.shareSummary;
  if (!s || s.mode === "private") return "🔒 PRIVATE — ONLY YOU";
  const names = [...s.people.map((p) => p.name), ...s.groups.map((g) => g.label)];
  return names.length ? `SHARED WITH <b>${esc(names.slice(0, 3).join(", "))}${names.length > 3 ? ` +${names.length - 3}` : ""}</b>` : "SHARED — NOBODY ADDED YET";
}

function renderNotes() {
  const root = document.getElementById("notesV2");
  if (!root) return;
  root.querySelectorAll(".nf button").forEach((b) => b.classList.toggle("on", b.dataset.nf === nf));
  const list = notes.filter((n) => (nf === "all" || (nf === "mine" ? n.access === "owner" : n.access !== "owner")) && (n.title + " " + n.body).toLowerCase().includes(nq.toLowerCase()));
  root.querySelector(".nl-items").innerHTML = list.length
    ? list.map((n) => `<button class="ni ${n.id === cur ? "on" : ""}" data-note="${n.id}"><b>${esc(n.title || "Untitled")}</b><small>${shareTag(n)} ${ukDate(n.updatedAtISO, { day: "2-digit", month: "short" }).toUpperCase()}</small></button>`).join("")
    : `<div class="empty" style="padding:20px">${nf === "shared" ? "NOTHING SHARED WITH YOU" : "NO NOTES"}</div>`;
  const n = notes.find((x) => x.id === cur);
  const ed = root.querySelector(".ne");
  if (!n) {
    ed.innerHTML = '<div class="empty">PICK A NOTE OR CREATE ONE</div>';
    ed.dataset.id = "";
    return;
  }
  if (ed.dataset.id === n.id) {
    const sl = document.getElementById("nShare");
    if (sl) sl.innerHTML = shareLine(n);
    return; // keep caret while typing
  }
  ed.dataset.id = n.id;
  const ro = n.access === "view";
  const own = n.access === "owner";
  ed.innerHTML = `<input class="srch ttl" id="nT" maxlength="120" value="${esc(n.title || "")}" aria-label="Note title" ${ro ? "readonly" : ""}>
    ${ro ? `<div class="ro">◈ VIEW ONLY — SHARED BY ${esc(n.ownerName || "the owner")}</div>` : ""}
    <div class="ntb">${ro ? "" : '<button class="b sm" data-ins="• ">• LIST</button><button class="b sm" data-ins="☐ ">☐ CHECKLIST</button>'}<span class="hint" id="nShare">${own ? shareLine(n) : `OWNER: ${esc(n.ownerName || "—")} · YOU ${PERM_L[n.access]}`}</span><span style="flex:1"></span><span class="st" id="nSt">${ro ? "" : "SAVED"}</span>${own ? '<button class="b sm gold" data-act="nshare">⇪ SHARE</button><button class="b sm red" data-act="ndel">DELETE</button>' : ""}</div>
    <textarea class="srch body" id="nB" aria-label="Note text" ${ro ? "readonly" : ""}>${esc(n.body || "")}</textarea>
    <div class="hint">${ro ? "" : "Saved automatically · "}last edit ${esc(n.updatedByName || "—")}, ${ukDate(n.updatedAtISO)}</div>`;
}

function queueSave() {
  const n = notes.find((x) => x.id === cur);
  if (!n || n.access === "view") return;
  dirty = true;
  const st = document.getElementById("nSt");
  if (st) st.textContent = "SAVING...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 900);
}
async function saveNote() {
  const n = notes.find((x) => x.id === cur);
  if (!n || !dirty || n.access === "view") return;
  dirty = false;
  n.title = document.getElementById("nT").value.trim() || "Untitled";
  n.body = document.getElementById("nB").value;
  n.updatedAtISO = new Date().toISOString();
  try {
    await api("PATCH", { id: n.id, title: n.title, body: n.body });
    const st = document.getElementById("nSt");
    if (st) st.textContent = "✓ SAVED";
    const it = document.querySelector(`#notesV2 [data-note="${n.id}"] b`);
    if (it) it.textContent = n.title;
  } catch (e) {
    dirty = true;
    notify("NOTE NOT SAVED: " + e.message, 1);
    const st = document.getElementById("nSt");
    if (st) st.textContent = "✕ NOT SAVED";
  }
}

/* ── share popup ── */
function hexFor(p) {
  const url = p.photoUrl && /^https:\/\//.test(p.photoUrl) ? p.photoUrl : null;
  return url ? `<span class="hx hx-sm" style="--img:url('${esc(url).replace(/'/g, "%27")}')"></span>` : `<span class="hx hx-sm noimg">${esc(((p.callsign || p.name || "?").replace(/^\S+\s+/, "")[0] || "?").toUpperCase())}</span>`;
}
function openShare() {
  const n = notes.find((x) => x.id === cur);
  if (!n || n.access !== "owner") return;
  shareDraft = JSON.parse(JSON.stringify(n.share || { mode: "private", people: {}, groups: {} }));
  openModal(`<div class="hd"><h2>⇪ SHARE NOTE</h2><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd">
      <div class="lb">WHO CAN SEE THIS NOTE</div>
      <div class="modes"><button class="mode" data-mode="private"><i>🔒</i><span><b>ONLY ME</b><small>Private — nobody else sees it</small></span></button><button class="mode" data-mode="shared"><i>👥</i><span><b>SHARED</b><small>People and groups you pick</small></span></button></div>
      <div id="shBox">
        <div class="lb">ADD PEOPLE</div>
        <div class="addrow"><input class="srch" id="shQ" placeholder="Type a name or callsign…" autocomplete="off" aria-label="Find members"><select class="srch" id="shPerm" style="width:auto" aria-label="Permission for new people"><option value="view">CAN VIEW</option><option value="edit">CAN EDIT</option></select><div class="sug" id="shSug" hidden></div></div>
        <div class="lb" style="margin-top:14px">ADD GROUPS</div><div class="grps" id="shGrps"></div>
        <div class="lb">SHARED WITH</div><div class="who" id="shWho"></div>
      </div>
    </div>
    <div class="mf"><span class="hint">Groups follow roles. People you add get a 🔔 alert. Pick any staff: Recruiter, NCO, Staff NCO, Officer, Developer, Commander.</span><button class="b" data-close>CANCEL</button><button class="b gold" id="shSave">SAVE</button></div>`, { width: 580 });
  drawShare();
  const m = document.querySelector(".v2m");
  m.addEventListener("click", async (e) => {
    const md = e.target.closest("[data-mode]");
    if (md) { shareDraft.mode = md.dataset.mode; return drawShare(); }
    const g = e.target.closest("[data-grp]");
    if (g) { const k = g.dataset.grp; shareDraft.groups[k] ? delete shareDraft.groups[k] : (shareDraft.groups[k] = document.getElementById("shPerm").value); return drawShare(); }
    const add = e.target.closest("[data-addp]");
    if (add) { shareDraft.people[add.dataset.addp] = document.getElementById("shPerm").value; document.getElementById("shQ").value = ""; document.getElementById("shSug").hidden = true; return drawShare(); }
    const rm = e.target.closest("[data-rm]");
    if (rm) { const [t, k] = rm.dataset.rm.split(":"); delete shareDraft[t][k]; return drawShare(); }
    if (!e.target.closest(".addrow")) document.getElementById("shSug").hidden = true;
    if (e.target.id === "shSave") {
      try {
        const r = await api("PATCH", { id: cur, share: shareDraft });
        closeModal();
        notify(`✓ SHARING SAVED${r.alerted ? ` — ${r.alerted} ALERTED` : ""}`);
        await loadNotes();
      } catch (err) { notify("NOT SAVED: " + err.message, 1); }
    }
  });
  m.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-perm]");
    if (sel) { const [t, k] = sel.dataset.perm.split(":"); shareDraft[t][k] = sel.value; }
  });
  const q = document.getElementById("shQ");
  const sug = () => {
    const v = q.value.toLowerCase();
    const list = people.filter((p) => !shareDraft.people[p.uid] && (!v || p.name.toLowerCase().includes(v) || String(p.callsign).toLowerCase().includes(v))).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 25);
    const box = document.getElementById("shSug");
    box.hidden = !list.length;
    box.innerHTML = list.map((p) => `<button data-addp="${esc(p.uid)}">${hexFor(p)}${esc(p.name)}<small>${esc(String(p.role).replace("_", " ").toUpperCase())}</small></button>`).join("");
  };
  q.addEventListener("input", sug);
  q.addEventListener("focus", sug);
}
function drawShare() {
  const m = document.querySelector(".v2m");
  if (!m) return;
  m.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === shareDraft.mode));
  document.getElementById("shBox").style.display = shareDraft.mode === "private" ? "none" : "";
  document.getElementById("shGrps").innerHTML = groups.map((g) => `<button class="gc ${shareDraft.groups[g.key] ? "on" : ""}" data-grp="${g.key}" aria-pressed="${!!shareDraft.groups[g.key]}">${shareDraft.groups[g.key] ? "✓ " : "+ "}${g.label}</button>`).join("");
  const opt = (v) => `<option value="view" ${v === "view" ? "selected" : ""}>CAN VIEW</option><option value="edit" ${v === "edit" ? "selected" : ""}>CAN EDIT</option>`;
  const rows = [
    ...Object.entries(shareDraft.people).map(([uid, v]) => { const p = people.find((x) => x.uid === uid) || { name: "Former member", role: "" }; return `<div class="wr">${hexFor(p)}<span><b>${esc(p.name)}</b><small>${esc(String(p.role).replace("_", " ").toUpperCase())}</small></span><select data-perm="people:${esc(uid)}" aria-label="Permission for ${esc(p.name)}">${opt(v)}</select><button class="xr" data-rm="people:${esc(uid)}" aria-label="Remove ${esc(p.name)}">✕</button></div>`; }),
    ...Object.entries(shareDraft.groups).map(([k, v]) => { const g = groups.find((x) => x.key === k) || { label: k }; return `<div class="wr"><span class="hx hx-sm noimg">👥</span><span><b>${esc(g.label)}</b><small>GROUP</small></span><select data-perm="groups:${k}" aria-label="Permission for ${esc(g.label)}">${opt(v)}</select><button class="xr" data-rm="groups:${k}" aria-label="Remove ${esc(g.label)}">✕</button></div>`; }),
  ];
  document.getElementById("shWho").innerHTML = `<div class="wr"><span class="hx hx-sm noimg">★</span><span><b>You</b><small>OWNER</small></span><span class="own">OWNER</span><span></span></div>` + (rows.join("") || '<div class="empty" style="padding:12px">ADD PEOPLE OR GROUPS ABOVE</div>');
}

/* ─────────────────────────────────── CSS ─────────────────────────────────── */
const CSS = `
#projV2 .kan{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:12px;margin-top:14px;overflow-x:auto}
#projV2 .col{border:1px solid var(--l);background:var(--p);padding:10px;min-height:380px;display:flex;flex-direction:column;gap:8px}
#projV2 .col.over{border-color:var(--a);background:rgba(0,217,255,.04)}
#projV2 h3{margin:0 0 4px;font-family:Rajdhani,sans-serif;letter-spacing:3px;font-size:12.5px;color:var(--a);display:flex;justify-content:space-between}#projV2 h3 span{color:var(--d)}
#projV2 .tk{text-align:left;border:1px solid var(--l);background:var(--p2);padding:10px;cursor:grab;font:inherit;color:inherit;display:flex;flex-direction:column;gap:6px}
#projV2 .tk:hover,#projV2 .tk:focus-visible{border-color:var(--l2)}#projV2 .tk.dragging{opacity:.4}
#projV2 .tk b{font-family:Rajdhani,sans-serif;font-size:14.5px;color:#fff;letter-spacing:.5px}#projV2 .tk.dn{opacity:.55}#projV2 .tk.dn b{text-decoration:line-through}
#projV2 .tm{font-size:9.5px;letter-spacing:1px;color:var(--d);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#projV2 .pr{border:1px solid;padding:0 5px;font-size:9px;font-style:normal}
#projV2 .pb{height:4px;background:rgba(255,255,255,.07)}#projV2 .pb i{display:block;height:100%;background:var(--g)}
#projV2 .add{border:1px dashed var(--l2);background:none;color:var(--a);padding:8px;font:inherit;font-size:10.5px;letter-spacing:2px;cursor:pointer}
#projV2 .more{font-size:9.5px;color:var(--d);letter-spacing:1.5px;text-align:center}
.v2m .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
#notesV2 .split{display:grid;grid-template-columns:290px 1fr;gap:14px;margin-top:14px}
#notesV2 .nl{border:1px solid var(--l);background:var(--p);padding:10px;display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 230px)}
#notesV2 .nl-items{overflow:auto;display:flex;flex-direction:column;gap:2px}
#notesV2 .ni{text-align:left;padding:9px 10px;border:1px solid transparent;background:none;cursor:pointer;font:inherit;color:inherit}
#notesV2 .ni.on{border-color:var(--a);background:rgba(0,217,255,.05)}#notesV2 .ni b{display:block;font-family:Rajdhani,sans-serif;font-size:14px;color:#fff}#notesV2 .ni small{font-size:9.5px;color:var(--d);letter-spacing:1px}
#notesV2 .ne{border:1px solid var(--l);background:var(--p);padding:14px;display:flex;flex-direction:column;gap:10px;min-height:460px}
#notesV2 .ttl{font-family:Rajdhani,sans-serif;font-weight:700;font-size:19px;letter-spacing:1px;width:100%}
#notesV2 .ntb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--l);padding-bottom:10px}
#notesV2 .body{flex:1;min-height:360px;width:100%;resize:vertical;font-size:13px;line-height:1.85}
#notesV2 .st{font-size:9.5px;letter-spacing:2px;color:var(--g)}
#notesV2 .hint,#projV2 .hint{font-size:9.5px;letter-spacing:1px;color:var(--d)}
#notesV2 .b.sm,#projV2 .b.sm{padding:4px 9px;font-size:10px}
#notesV2 .nf{display:flex;gap:2px}#notesV2 .nf button{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:var(--d);font:inherit;font-size:9.5px;letter-spacing:1.5px;padding:6px 0;cursor:pointer}#notesV2 .nf button.on{color:var(--a);border-color:var(--a)}
#notesV2 .tag,.v2m .tag{font-size:9px;letter-spacing:1.5px;border:1px solid var(--c);color:var(--c);padding:1px 6px;margin-right:6px}
#notesV2 .ni small{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px}
#notesV2 .ro{font-size:10px;letter-spacing:1.5px;color:#f59e0b;padding:6px 10px;border:1px dashed rgba(245,158,11,.4);background:rgba(245,158,11,.05)}
#notesV2 .hint b{color:var(--t);font-weight:400}
.v2m .lb{font-size:9.5px;letter-spacing:2px;color:var(--d);margin:0 0 8px}
.v2m .modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.v2m .mode{display:flex;gap:10px;align-items:center;border:1px solid var(--l);background:none;padding:10px;cursor:pointer;text-align:left;font:inherit;color:inherit}.v2m .mode.on{border-color:var(--a);background:rgba(0,217,255,.06)}
.v2m .mode i{font-style:normal;font-size:18px}.v2m .mode b{display:block;font-size:11.5px;letter-spacing:1.5px;color:#fff;font-weight:400}.v2m .mode small{font-size:9.5px;color:var(--d)}
.v2m .addrow{display:grid;grid-template-columns:1fr auto;gap:8px;position:relative}
.v2m .sug{position:absolute;top:40px;left:0;right:0;background:#070a0f;border:1px solid var(--l2);z-index:5;max-height:240px;overflow:auto}.v2m .sug[hidden]{display:none}
.v2m .sug button{display:flex;gap:10px;align-items:center;width:100%;background:none;border:0;padding:7px 10px;text-align:left;cursor:pointer;font:inherit;font-size:12px;color:var(--t)}.v2m .sug button:hover{background:rgba(0,217,255,.07)}.v2m .sug small{margin-left:auto;font-size:9px;color:var(--d);letter-spacing:1.5px}
.v2m .grps{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.v2m .gc{border:1px solid var(--l2);color:var(--a);background:none;padding:4px 10px;font:inherit;font-size:10px;letter-spacing:1.5px;cursor:pointer}.v2m .gc.on{background:rgba(0,217,255,.15)}
.v2m .who{border:1px solid var(--l);max-height:260px;overflow:auto}
.v2m .wr{display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}
.v2m .wr b{font-weight:400;color:#fff;display:block}.v2m .wr small{font-size:9.5px;color:var(--d);letter-spacing:1px}
.v2m .wr select{background:#070a0f;border:1px solid var(--l2);padding:4px 6px;font:inherit;font-size:10px;letter-spacing:1px;color:var(--t)}
.v2m .xr{background:none;border:1px solid rgba(255,77,77,.4);color:#ff4d4d;width:26px;height:24px;cursor:pointer}
.v2m .own{color:#f59e0b;font-size:10px;letter-spacing:1.5px}
.v2m .mf{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--l)}.v2m .mf .hint{font-size:9.5px;color:var(--d);flex:1;line-height:1.5}
@media(max-width:900px){#projV2 .kan{grid-template-columns:repeat(4,240px)}#notesV2 .split{grid-template-columns:1fr}.v2m .g4{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  addCss("workspaceV2", CSS);

  // Project tracker
  const pr = mountPanel("panel-projects", "projV2", () => loadProjects().catch((e) => notify("PROJECTS LOAD FAILED: " + e.message, 1)));
  if (pr) {
    pr.innerHTML = `<div class="bar"><div><div class="h1">PROJECT TRACKER</div><div class="sub" style="margin:4px 0 0">STAFF TASKS AND UNIT PROJECTS — DRAG A CARD TO MOVE IT, CLICK TO EDIT</div></div><span class="sp"></span>
      <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="done" checked> SHOW DONE</label><button class="b gold" data-act="new">+ NEW TASK</button></div><div class="kan"><div class="empty">LOADING...</div></div>`;
    pr.addEventListener("click", (e) => {
      if (e.target.closest("[data-act=new]")) return openTask(null);
      const c = e.target.closest(".tk");
      if (c) openTask(tasks.find((t) => t.id === c.dataset.id));
    });
    pr.addEventListener("change", (e) => {
      if (e.target.dataset.f === "done") (showDone = e.target.checked), renderProjects();
    });
    pr.addEventListener("dragstart", (e) => {
      const c = e.target.closest(".tk");
      if (!c) return;
      e.dataTransfer.setData("text/plain", c.dataset.id);
      c.classList.add("dragging");
    });
    pr.addEventListener("dragend", (e) => e.target.closest(".tk")?.classList.remove("dragging"));
    pr.addEventListener("dragover", (e) => {
      const col = e.target.closest(".col");
      if (!col) return;
      e.preventDefault();
      pr.querySelectorAll(".col.over").forEach((c) => c !== col && c.classList.remove("over"));
      col.classList.add("over");
    });
    pr.addEventListener("drop", (e) => {
      const col = e.target.closest(".col");
      pr.querySelectorAll(".col.over").forEach((c) => c.classList.remove("over"));
      if (!col) return;
      e.preventDefault();
      moveTask(e.dataTransfer.getData("text/plain"), col.dataset.col);
    });
  }

  // Notes
  const nt = mountPanel("panel-notes", "notesV2", () => loadNotes().catch((e) => notify("NOTES LOAD FAILED: " + e.message, 1)));
  if (nt) {
    nt.innerHTML = `<div class="h1">NOTES</div><div class="sub">YOUR NOTES AND NOTES SHARED WITH YOU — SAVED AUTOMATICALLY</div>
      <div class="split"><div class="nl"><input class="srch" data-f="nq" placeholder="SEARCH NOTES..." aria-label="Search notes"><button class="b gold" data-act="nnew">+ NEW NOTE</button><div class="nf" role="tablist"><button data-nf="all" class="on">ALL</button><button data-nf="mine">MINE</button><button data-nf="shared">SHARED WITH ME</button></div><div class="nl-items"></div></div>
      <div class="ne"><div class="empty">LOADING...</div></div></div>`;
    nt.addEventListener("input", async (e) => {
      if (e.target.dataset.f === "nq") return (nq = e.target.value), renderNotes();
      if (e.target.id === "nT" || e.target.id === "nB") queueSave();
    });
    nt.addEventListener("click", async (e) => {
      const ni = e.target.closest("[data-note]");
      if (ni) {
        await saveNote();
        cur = ni.dataset.note;
        return renderNotes();
      }
      const tab = e.target.closest("[data-nf]");
      if (tab) { nf = tab.dataset.nf; return renderNotes(); }
      const ins = e.target.closest("[data-ins]");
      if (ins) {
        const ta = document.getElementById("nB");
        const at = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
        ta.setRangeText(ins.dataset.ins, at, at, "end");
        ta.focus();
        return queueSave();
      }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "nnew") {
        await saveNote();
        try {
          const r = await api("POST", { title: "New note", body: "" });
          cur = r.id;
          nf = nf === "shared" ? "all" : nf;
          await loadNotes();
          document.getElementById("nT")?.select();
        } catch (err) {
          notify("COULD NOT CREATE NOTE: " + err.message, 1);
        }
      }
      if (act === "nshare") { await saveNote(); return openShare(); }
      if (act === "ndel") {
        const n = notes.find((x) => x.id === cur);
        if (!n || !(await ask({ kind: "danger", title: "DELETE NOTE?", body: n.shareSummary?.mode === "shared" ? "It is deleted for everyone it is shared with." : "", item: n.title || "Untitled", warn: "THIS CANNOT BE UNDONE.", go: "DELETE NOTE" }))) return;
        try {
          clearTimeout(saveTimer);
          dirty = false;
          await api("DELETE", null, `?id=${encodeURIComponent(n.id)}`);
          await audit("workspace", "NOTE DELETED", n.title);
          cur = null;
          loadNotes();
        } catch (err) {
          notify("DELETE FAILED: " + err.message, 1);
        }
      }
    });
    // Tick ☐ / ☑ lines: click on the box character inside the text.
    nt.addEventListener("mouseup", (e) => {
      if (e.target.id !== "nB" || e.target.readOnly) return;
      const ta = e.target, i = ta.selectionStart;
      if (ta.selectionEnd !== i) return;
      const ch = ta.value[i] === "☐" || ta.value[i] === "☑" ? i : ta.value[i - 1] === "☐" || ta.value[i - 1] === "☑" ? i - 1 : -1;
      if (ch < 0) return;
      ta.setRangeText(ta.value[ch] === "☐" ? "☑" : "☐", ch, ch + 1, "preserve");
      queueSave();
    });
    addEventListener("beforeunload", (e) => {
      if (dirty) {
        saveNote();
        e.preventDefault();
      }
    });
  }
});

// Dashboard widgets can open a note or a task directly.
window.addEventListener("ws:open", (e) => {
  const { kind, id } = e.detail || {};
  if (kind === "note") {
    cur = id;
    window.showPanel?.("panel-notes"); // loading the panel keeps `cur` if you can open that note
  } else if (kind === "task") {
    window.showPanel?.("panel-projects");
    let n = 0;
    const tryOpen = () => { const t = tasks.find((x) => x.id === id); t ? openTask(t) : ++n < 10 && setTimeout(tryOpen, 400); };
    tryOpen();
  }
});
