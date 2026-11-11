/**
 * WORKSPACE → PROJECT TRACKER v2 (approved mock 2026-11-11) — website Terminal.
 * Same data + rules as the Hub app: everything goes through /api/terminal/projects (lib/projects/core.ts).
 * Card wall → project: cover, description, tasks (+ sub-tasks, assignee, due), images, discussion (@ tag), team, activity.
 * 🔒 Private (owner only) or 👥 Invite only. Owner / Editor / Viewer. Alerts go to the 🔔 bell — no Discord DMs.
 * Replaces the old Kanban (workspace.js no longer mounts it). Old tasks were copied into "General".
 */
import { addCss, ask, esc, mountPanel, notify, onReady, uploadImage } from "./_common.js";

const ROOT = "projV3";
const PRI = { high: ["▲ HIGH", "#ff4d4d"], med: ["■ MED", "#f59e0b"], low: ["▼ LOW", "#7d8a99"] };
const STAT = { planning: ["PLANNING", "#00D9FF"], active: ["ACTIVE", "#22e07a"], hold: ["ON HOLD", "#f59e0b"], done: ["DONE", "#7d8a99"] };
const ROLE = { owner: ["OWNER", "#c9a227"], editor: ["EDITOR", "#00D9FF"], viewer: ["VIEWER", "#7d8a99"], pending: ["PENDING", "#f59e0b"] };
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];

let D = null, open = null, filter = "all", q = "", tf = "all", busy = false, root = null, tags = [], poll = null;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const day = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase() : "");
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "now" : m < 60 ? `${m} m` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const ini = (n) => (String(n).replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase();
const name = (uid) => D?.people.find((x) => x.uid === uid)?.name || "Unknown";
const col = (uid) => COLS[[...String(uid)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLS.length];
const av = (uid, s = 24) => `<i class="av" title="${esc(name(uid))}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.36)}px;background:${col(uid)}">${esc(ini(name(uid)))}</i>`;
const pct = (p) => { const t = p.tasks.filter((x) => !x.parent); return t.length ? Math.round((t.filter((x) => x.done).length / t.length) * 100) : p.status === "done" ? 100 : 0; };
const bg = (p) => (p.cover ? `url('${esc(p.cover)}') center/cover` : "linear-gradient(135deg,#0b3a52,#071a26)");
const cur = () => D?.projects.find((p) => p.id === open);

async function load() {
  const r = await fetch("/api/terminal/projects", { cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
  D = b;
  if (!typing()) draw();
}
const typing = () => root?.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.value;
async function run(body, quiet = false) {
  busy = true;
  try {
    const r = await fetch("/api/terminal/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
    if (!quiet) notify("✓ " + String(b.msg || "Saved").toUpperCase());
    busy = false;
    await load().catch(() => {});
    return b;
  } catch (e) {
    busy = false;
    notify(e.message.toUpperCase(), 1);
    return null;
  }
}

/* ───────── wall ───────── */
function wall() {
  const t = today(), week = new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const live = D.projects.filter((x) => x.myRole !== "pending"), all = live.flatMap((x) => x.tasks);
  const list = D.projects.filter((x) => (filter === "all" ? x.myRole !== "pending" : filter === "mine" ? x.myRole === "owner" : filter === "invited" ? x.myRole !== "owner" : x.status === filter && x.myRole !== "pending")
    && (x.title + " " + x.description).toLowerCase().includes(q.toLowerCase()));
  const chip = (k, l) => `<button class="ch ${filter === k ? "on" : ""}" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`;
  return `<div class="top"><div><div class="h1">PROJECT TRACKER</div><div class="sub" style="margin:4px 0 0">PRIVATE OR INVITE ONLY · TASKS, IMAGES AND DISCUSSION IN ONE PLACE</div></div><button class="b gold" data-x="new">＋ NEW PROJECT</button></div>
  <div class="kp">${[[live.filter((x) => x.status !== "done").length, "ACTIVE PROJECTS", "#00D9FF"], [all.filter((x) => !x.done && x.due && x.due >= t && x.due <= week).length, "TASKS DUE THIS WEEK", "#f59e0b"],
    [all.filter((x) => !x.done && x.due && x.due < t).length, "OVERDUE", "#ff4d4d"], [all.filter((x) => !x.done && x.assigneeUid === D.me).length, "MY OPEN TASKS", "#22e07a"]].map(([v, l, c]) => `<div><b style="color:${c}">${v}</b><span>${l}</span></div>`).join("")}</div>
  ${D.projects.filter((x) => x.myRole === "pending").map((x) => { const m = x.members.find((y) => y.uid === D.me) || {};
    return `<div class="inv" role="alert"><span style="font-size:18px">👥</span><span style="flex:1"><b>${esc(name(m.invitedBy))}</b> invited you to <b style="color:#00D9FF">${esc(x.title)}</b> as ${esc(String(m.role || "editor").toUpperCase())}${m.message ? ` <span class="dim">— “${esc(m.message)}”</span>` : ""}</span>
      <button class="b" data-x="decline" data-id="${x.id}">DECLINE</button><button class="b ok" data-x="accept" data-id="${x.id}">✓ ACCEPT</button></div>`; }).join("")}
  <div class="flt"><input class="fld" id="pjQ" placeholder="🔍 Find a project…" aria-label="Find a project" value="${esc(q)}">${chip("all", "ALL")}${chip("mine", "MINE")}${chip("invited", "INVITED TO")}${chip("active", "ACTIVE")}${chip("planning", "PLANNING")}${chip("hold", "ON HOLD")}${chip("done", "DONE")}</div>
  <div class="grid">${list.map((x) => { const pc = pct(x), late = x.tasks.filter((k) => !k.done && k.due && k.due < t).length, ppl = [x.ownerUid, ...x.members.filter((m) => m.status === "active").map((m) => m.uid)], top = x.tasks.filter((k) => !k.parent);
    return `<button class="pc" data-open="${x.id}" aria-label="Open ${esc(x.title)}"><div class="cov" style="background:${bg(x)}"><span class="st" style="color:${STAT[x.status][1]};border-color:${STAT[x.status][1]}">● ${STAT[x.status][0]}</span><span class="pr" style="color:${PRI[x.priority][1]}">${PRI[x.priority][0]}</span>${x.privacy === "private" ? '<span class="pv">🔒 PRIVATE</span>' : ""}</div>
      <div class="pb"><h3>${esc(x.title.toUpperCase())}</h3><p>${esc(x.description || "No description yet.")}</p><div class="prog"><i style="width:${pc}%"></i></div>
      <div class="meta"><span>${pc}% · ${top.filter((k) => k.done).length}/${top.length} tasks</span>${late ? `<span style="color:#ff4d4d">⚠ ${late} OVERDUE</span>` : x.deadline ? `<span style="color:${x.deadline < t ? "#ff4d4d" : "#f59e0b"}">⏰ ${day(x.deadline)}</span>` : ""}</div>
      <div class="meta"><span class="avs">${ppl.slice(0, 4).map((u) => av(u)).join("")}${ppl.length > 4 ? `<i class="av" style="background:#1d2733;color:#fff">+${ppl.length - 4}</i>` : ""}</span><span>💬 ${x.comments.length} · 🖼 ${x.images.length}</span></div></div></button>`; }).join("")}
    <button class="pc new" data-x="new">＋ NEW PROJECT</button></div>`;
}

/* ───────── one project ───────── */
function detail(x) {
  const t = today(), role = x.myRole, owner = role === "owner", edit = owner || role === "editor";
  const team = [x.ownerUid, ...x.members.filter((m) => m.status === "active").map((m) => m.uid)];
  const top = x.tasks.filter((k) => !k.parent), pc = pct(x);
  const show = (k) => tf === "all" || (tf === "mine" ? k.assigneeUid === D.me : tf === "open" ? !k.done : k.done);
  const days = x.deadline ? Math.round((Date.parse(`${x.deadline}T12:00:00`) - Date.parse(`${t}T12:00:00`)) / 864e5) : null;
  const opts = (sel) => `<option value="">Unassigned</option>${team.map((u) => `<option value="${u}" ${u === sel ? "selected" : ""}>${esc(name(u))}</option>`).join("")}`;
  const task = (k, sub) => { const kids = x.tasks.filter((c) => c.parent === k.id), late = !k.done && k.due && k.due < t;
    return `<div class="tk ${sub ? "sub" : ""}"><button class="cb ${k.done ? "y" : ""}" role="checkbox" aria-checked="${k.done}" aria-label="${k.done ? "Mark not done" : "Mark done"}" data-x="tick" data-t="${k.id}" ${edit ? "" : "disabled"}>${k.done ? "✓" : ""}</button>
      <span class="tt ${k.done ? "dn" : ""}">${esc(k.title)}</span>${kids.length ? `<small>☑ ${kids.filter((c) => c.done).length}/${kids.length}</small>` : ""}${k.priority === "high" && !k.done ? '<small style="color:#ff4d4d">▲</small>' : ""}
      ${k.due ? `<span class="due" style="color:${late ? "#ff4d4d" : k.done ? "#4b5765" : "#f59e0b"}">${late ? "⚠ OVERDUE · " : "⏰ "}${day(k.due)}</span>` : ""}
      ${edit ? `<select class="asg" data-x="assign" data-t="${k.id}" aria-label="Assigned to">${opts(k.assigneeUid)}</select><button class="del" data-x="deltask" data-t="${k.id}" aria-label="Delete task">🗑</button>` : k.assigneeUid ? av(k.assigneeUid, 22) : ""}</div>
      ${kids.filter(show).map((c) => task(c, true)).join("")}`; };
  const H = (tt, s = "") => `<div class="hh">${tt}<small>${s}</small></div>`;
  return `<button class="back" data-x="back">← ALL PROJECTS</button>
  <div class="dt"><div class="hero" style="background:${bg(x)}"><div class="shade"></div>${owner ? '<label class="cam">📷 CHANGE COVER<input type="file" accept="image/*" hidden data-up="cover"></label>' : ""}
    <div class="hc"><div class="row"><span class="st" style="position:static;color:${STAT[x.status][1]};border-color:${STAT[x.status][1]}">● ${STAT[x.status][0]}</span><span style="color:${PRI[x.priority][1]}">${PRI[x.priority][0]}</span><span class="tag">${esc(x.category.toUpperCase())}</span><span class="dim">${x.privacy === "private" ? "🔒 PRIVATE" : "👥 INVITE ONLY"}</span></div>
      <h2>${esc(x.title.toUpperCase())}</h2>
      <div class="row dim" style="font-size:11.5px">Owner <b class="w">${esc(name(x.ownerUid))}</b> · Started ${day(x.createdAtISO.slice(0, 10))}${x.deadline ? ` · Deadline <b style="color:${days < 0 ? "#ff4d4d" : "#f59e0b"};font-weight:400">${day(x.deadline)} (${days < 0 ? `${-days} days late` : `${days} days`})</b>` : ""}
        <span style="margin-left:auto;display:flex;gap:6px">${owner ? '<button class="b cy" data-x="invite">👥 INVITE</button><button class="b" data-x="edit">✎ EDIT</button><button class="b red" data-x="delproj">🗑 DELETE</button>' : role !== "pending" ? '<button class="b" data-x="leave">➖ LEAVE</button>' : ""}</span></div></div></div>
  <div class="cols"><div class="mn">
    ${H("DESCRIPTION", owner ? '<button class="lk" data-x="edit">✎ EDIT</button>' : "")}<p class="desc">${x.description ? esc(x.description) : '<span class="dim">No description yet.</span>'}</p>
    ${H("TASKS", `${top.filter((k) => k.done).length} / ${top.length} DONE`)}
    <div class="chips" style="margin-bottom:8px">${["all", "mine", "open", "done"].map((k) => `<button class="ch ${tf === k ? "on" : ""}" data-tf="${k}" aria-pressed="${tf === k}">${k.toUpperCase()}</button>`).join("")}</div>
    ${top.filter((k) => show(k) || x.tasks.some((c) => c.parent === k.id && show(c))).map((k) => task(k)).join("") || '<div class="empty">NO TASKS YET</div>'}
    ${edit ? `<form class="add" data-form="task"><input class="fld" name="title" maxlength="200" placeholder="＋ Add a task…" aria-label="New task" style="flex:1;min-width:200px">
      <select class="fld" name="assigneeUid" aria-label="Assign to">${opts("")}</select><input class="fld" type="date" name="due" aria-label="Due date">
      <select class="fld" name="parent" aria-label="Sub-task of"><option value="">Main task</option>${top.map((k) => `<option value="${k.id}">↳ ${esc(k.title.slice(0, 30))}</option>`).join("")}</select><button class="b cy">ADD</button></form>` : ""}
    ${H("IMAGES", `${x.images.length} · ${edit ? "DROP IMAGES HERE OR CLICK ＋" : "VIEW ONLY"}`)}
    <div class="gal" data-drop="${edit ? 1 : 0}">${x.images.map((im) => `<div class="im"><a href="${esc(im.url)}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="${esc(im.name || "Project image")}" loading="lazy"></a>
      ${edit ? `<button class="x" data-x="delimg" data-u="${esc(im.url)}" aria-label="Remove image">✕</button>` : ""}${owner && x.cover !== im.url ? `<button class="sc" data-x="setcover" data-u="${esc(im.url)}">SET COVER</button>` : ""}</div>`).join("")}
      ${edit ? '<label class="upl">＋<input type="file" accept="image/*" multiple hidden data-up="images"></label>' : ""}</div>
    ${H("DISCUSSION", "TEAM ONLY · TAG SOMEONE TO ALERT THEM")}
    ${x.comments.map((c) => `<div class="cm">${av(c.uid, 28)}<div class="cb2"><b>${esc(name(c.uid))}</b><small>${ago(c.atISO)} ago</small>${owner || c.uid === D.me ? `<button class="del" data-x="delcm" data-c="${c.id}" aria-label="Delete comment">🗑</button>` : ""}<div>${esc(c.text).replace(/\n/g, "<br>")}</div></div></div>`).join("")}
    ${role !== "pending" ? `<div class="add"><textarea class="fld" id="pjC" rows="2" maxlength="2000" placeholder="Write a comment…" aria-label="Comment" style="flex:1;min-width:240px;resize:none"></textarea>
      <div style="display:flex;flex-direction:column;gap:6px"><select class="fld" data-x="tag" aria-label="Tag someone"><option value="">@ TAG</option>${team.filter((u) => u !== D.me).map((u) => `<option value="${u}">${esc(name(u))}</option>`).join("")}</select><button class="b cy" data-x="post">POST</button></div></div>` : ""}
  </div><aside class="sd">
    <div class="ring" style="background:conic-gradient(#22e07a 0 ${pc}%,rgba(255,255,255,.05) 0)"><div>${pc}%</div></div><div class="rl">DONE · FROM TASKS</div>
    ${H("TEAM", owner ? '<button class="lk" data-x="invite">👥 INVITE</button>' : String(team.length))}
    ${[{ uid: x.ownerUid, role: "owner", status: "active" }, ...x.members].map((m) => { const r = m.status === "pending" ? "pending" : m.role, mine = x.tasks.filter((k) => k.assigneeUid === m.uid);
      return `<div class="mem ${m.status === "pending" ? "pend" : ""}">${av(m.uid, 30)}<div><span>${esc(name(m.uid))}</span><small>${m.status === "pending" ? "invite sent · waiting" : r === "viewer" ? "read + comment" : `${mine.length} tasks · ${mine.filter((k) => k.done).length} done`}</small></div>
        ${owner && m.uid !== x.ownerUid ? `<select class="rs" data-x="role" data-u="${m.uid}" style="color:${ROLE[r][1]};border-color:${ROLE[r][1]}66" aria-label="Role for ${esc(name(m.uid))}">${m.status === "pending" ? '<option value="x">PENDING</option>' : `<option value="editor" ${m.role === "editor" ? "selected" : ""}>EDITOR</option><option value="viewer" ${m.role === "viewer" ? "selected" : ""}>VIEWER</option><option value="owner">★ MAKE OWNER</option>`}<option value="remove">✕ REMOVE</option></select>`
          : `<span class="rb" style="color:${ROLE[r][1]};border-color:${ROLE[r][1]}66">${ROLE[r][0]}</span>`}</div>`; }).join("")}
    ${H("DETAILS")}${[["Category", x.category], ["Privacy", x.privacy === "private" ? "🔒 Private" : "👥 Invite only"], ["Your role", ROLE[role || "viewer"][0]], ["Updated", ago(x.updatedAtISO) + " ago"]].map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>`).join("")}
    ${H("ACTIVITY")}${[...x.activity].reverse().slice(0, 12).map((a) => `<div class="fd"><i>${esc(a.icon)}</i><span>${esc(a.text)}</span><small>${ago(a.atISO)}</small></div>`).join("")}
  </aside></div></div>`;
}

function draw() {
  if (!root || !D) return;
  const p = cur();
  if (open && !p) open = null;
  root.innerHTML = p ? detail(p) : wall();
}

/* ───────── pop-ups (project form + invite) ───────── */
function modal(title, body, foot, onBind) {
  const ov = document.createElement("div");
  ov.className = "pj-ov";
  ov.innerHTML = `<div class="pj-md v2m" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pj-mh"><img src="https://i.ibb.co/d0Gn5M5R/505-TH-Logo.png" alt="">505TH COMMAND NETWORK<button data-m="close" aria-label="Close">✕</button></div>
    <div class="pj-mt">${esc(title)}</div><div class="pj-mb">${body}</div><div class="pj-mf">${foot}</div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener("keydown", key, true); };
  const key = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", key, true);
  ov.addEventListener("mousedown", (e) => e.target === ov && close());
  ov.addEventListener("click", (e) => e.target.closest('[data-m="close"]') && close());
  onBind(ov, close);
  ov.querySelector("input,textarea")?.focus();
}

function projForm(p) {
  const v = { title: p?.title || "", description: p?.description || "", category: p?.category || "Operations", priority: p?.priority || "med", status: p?.status || "planning", deadline: p?.deadline || "", privacy: p?.privacy || "invite", cover: p?.cover || "" };
  const sel = (k, opts) => `<select class="fld" data-k="${k}">${opts.map(([val, l]) => `<option value="${val}" ${v[k] === val ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  modal(p ? "✎ EDIT PROJECT" : "＋ NEW PROJECT", `
    <label class="lbl">COVER IMAGE</label><label class="pj-cv" style="${v.cover ? `background:url('${esc(v.cover)}') center/cover` : ""}"><span>${v.cover ? "📷 CHANGE" : "📷 ADD A COVER (OPTIONAL)"}</span><input type="file" accept="image/*" hidden data-k="coverfile"></label>
    <label class="lbl" for="pjT">NAME</label><input class="fld" id="pjT" data-k="title" maxlength="80" value="${esc(v.title)}">
    <label class="lbl" for="pjD">DESCRIPTION</label><textarea class="fld" id="pjD" data-k="description" rows="5" maxlength="5000">${esc(v.description)}</textarea>
    <div class="g2"><div><label class="lbl">CATEGORY</label>${sel("category", D.categories.map((c) => [c, c]))}</div><div><label class="lbl">DEADLINE (OPTIONAL)</label><input class="fld" type="date" data-k="deadline" value="${esc(v.deadline)}"></div>
      <div><label class="lbl">STATUS</label>${sel("status", Object.entries(STAT).map(([k, [l]]) => [k, l]))}</div><div><label class="lbl">PRIORITY</label>${sel("priority", Object.entries(PRI).map(([k, [l]]) => [k, l]))}</div></div>
    <label class="lbl">WHO CAN SEE IT</label><div class="g2" role="radiogroup">${[["private", "🔒 PRIVATE", "Only you"], ["invite", "👥 INVITE ONLY", "You + people you invite"]].map(([k, l, s]) =>
      `<button type="button" class="pv-o ${v.privacy === k ? "on" : ""}" role="radio" aria-checked="${v.privacy === k}" data-pv="${k}"><b>${l}</b><small>${s}</small></button>`).join("")}</div>`,
    `<button class="b" data-m="close">CANCEL</button><button class="b cy" data-m="save">${p ? "SAVE" : "CREATE PROJECT"}</button>`,
    (ov, close) => {
      ov.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k && k !== "coverfile") v[k] = e.target.value; });
      ov.addEventListener("change", async (e) => {
        if (e.target.dataset.k !== "coverfile" || !e.target.files[0]) return;
        const lab = ov.querySelector(".pj-cv span"); lab.textContent = "UPLOADING…";
        try { v.cover = await uploadImage(e.target.files[0], "505th_projects"); ov.querySelector(".pj-cv").style.background = `url('${v.cover}') center/cover`; lab.textContent = "📷 CHANGE"; }
        catch (err) { lab.textContent = "📷 ADD A COVER (OPTIONAL)"; notify("UPLOAD FAILED: " + err.message, 1); }
      });
      ov.addEventListener("click", async (e) => {
        const pv = e.target.closest("[data-pv]");
        if (pv) { v.privacy = pv.dataset.pv; ov.querySelectorAll("[data-pv]").forEach((b) => { b.classList.toggle("on", b === pv); b.setAttribute("aria-checked", b === pv); }); }
        if (e.target.closest('[data-m="save"]')) {
          if (!v.title.trim()) return notify("GIVE THE PROJECT A NAME", 1);
          const r = await run(p ? { action: "update", id: p.id, ...v } : { action: "create", ...v });
          if (r) { close(); if (r.id) { open = r.id; draw(); } }
        }
      });
    });
}

function inviteBox(p) {
  const inTeam = new Set([p.ownerUid, ...p.members.map((m) => m.uid)]);
  let sel = [];
  modal(`👥 INVITE TO ${p.title.toUpperCase()}`, `<p class="dim" style="font-size:11px;letter-spacing:1px;margin:0 0 8px">THEY GET AN ALERT IN THE TERMINAL AND THE HUB, AND ACCEPT OR DECLINE. ONLY STAFF WITH PROJECTS ACCESS ARE LISTED.</p>
    <input class="fld" id="pjFind" placeholder="🔍 Find a member…" aria-label="Find a member" style="width:100%"><div class="pj-dd"></div><div class="pj-sel"></div>
    <textarea class="fld" id="pjMsg" rows="2" maxlength="300" placeholder="Optional message…" aria-label="Message" style="width:100%;margin-top:10px;resize:none"></textarea>`,
    `<button class="b" data-m="close">CANCEL</button><button class="b cy" data-m="send" disabled>SEND INVITES</button>`,
    (ov, close) => {
      const dd = ov.querySelector(".pj-dd"), box = ov.querySelector(".pj-sel"), send = ov.querySelector('[data-m="send"]');
      const redraw = () => {
        box.innerHTML = sel.length ? `<div class="lbl">TO INVITE</div>${sel.map((s) => `<div class="pj-row">${av(s.uid, 22)}${esc(name(s.uid))}<select class="fld" data-role="${s.uid}" aria-label="Role" style="margin-left:auto"><option value="editor" ${s.role === "editor" ? "selected" : ""}>EDITOR — add &amp; tick tasks</option><option value="viewer" ${s.role === "viewer" ? "selected" : ""}>VIEWER — read + comment</option></select><button class="lk" data-rm="${s.uid}" aria-label="Remove">✕</button></div>`).join("")}` : "";
        send.disabled = !sel.length; send.textContent = `SEND ${sel.length || ""} INVITE${sel.length === 1 ? "" : "S"}`;
      };
      ov.querySelector("#pjFind").addEventListener("input", (e) => {
        const s = e.target.value.trim().toLowerCase();
        dd.innerHTML = s ? D.people.filter((u) => u.name.toLowerCase().includes(s)).slice(0, 8).map((u) => { const dis = inTeam.has(u.uid) || sel.some((x) => x.uid === u.uid);
          return `<button class="pj-row" data-add="${u.uid}" ${dis ? "disabled" : ""}>${av(u.uid, 22)}${esc(u.name)}<small>${inTeam.has(u.uid) ? "ALREADY IN TEAM" : esc((u.platoon || "").toUpperCase())}</small></button>`; }).join("") : "";
      });
      ov.addEventListener("change", (e) => { const u = e.target.dataset.role; if (u) sel = sel.map((x) => (x.uid === u ? { ...x, role: e.target.value } : x)); });
      ov.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-add]"), rm = e.target.closest("[data-rm]");
        if (a && !a.disabled) { sel.push({ uid: a.dataset.add, role: "editor" }); dd.innerHTML = ""; ov.querySelector("#pjFind").value = ""; redraw(); }
        if (rm) { sel = sel.filter((x) => x.uid !== rm.dataset.rm); redraw(); }
        if (e.target.closest('[data-m="send"]') && sel.length) { const r = await run({ action: "invite", id: p.id, invites: sel, message: ov.querySelector("#pjMsg").value }); if (r) close(); }
      });
    });
}

/* ───────── images ───────── */
async function addImages(files, p) {
  const urls = [];
  for (const f of [...files].slice(0, 10)) {
    if (!f.type.startsWith("image/") || f.size > 10e6) { notify(`${f.name}: IMAGES UP TO 10 MB ONLY`, 1); continue; }
    try { notify("⇪ UPLOADING " + f.name.toUpperCase()); urls.push(await uploadImage(f, "505th_projects")); } catch (e) { notify("UPLOAD FAILED: " + e.message, 1); }
  }
  if (urls.length) await run({ action: "image.add", id: p.id, urls });
}

/* ───────── events ───────── */
function bind() {
  root.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-x],[data-open],[data-f],[data-tf]");
    if (!el || busy) return;
    if (el.dataset.open) { open = el.dataset.open; tf = "all"; tags = []; draw(); root.scrollIntoView({ block: "start" }); return; }
    if (el.dataset.f) { filter = el.dataset.f; draw(); return; }
    if (el.dataset.tf) { tf = el.dataset.tf; draw(); return; }
    const x = el.dataset.x, p = cur();
    if (x === "new") return projForm(null);
    if (x === "back") { open = null; draw(); return; }
    if (x === "accept" || x === "decline") return run({ action: "respond", id: el.dataset.id, accept: x === "accept" });
    if (!p) return;
    if (x === "edit") return projForm(p);
    if (x === "invite") return inviteBox(p);
    if (x === "tick") { const k = p.tasks.find((t) => t.id === el.dataset.t); return run({ action: "task.update", id: p.id, taskId: k.id, patch: { done: !k.done } }, true); }
    if (x === "deltask") { const k = p.tasks.find((t) => t.id === el.dataset.t), kids = p.tasks.filter((c) => c.parent === k.id).length;
      if (await ask({ kind: "danger", title: "DELETE TASK?", item: k.title, body: kids ? `Its ${kids} sub-task(s) are deleted too.` : "", go: "🗑 DELETE" })) run({ action: "task.delete", id: p.id, taskId: k.id }, true); return; }
    if (x === "delimg") { if (await ask({ kind: "danger", title: "REMOVE IMAGE?", body: "It is removed from this project.", go: "🗑 REMOVE" })) run({ action: "image.remove", id: p.id, url: el.dataset.u }, true); return; }
    if (x === "setcover") return run({ action: "update", id: p.id, cover: el.dataset.u });
    if (x === "delcm") return run({ action: "comment.delete", id: p.id, commentId: el.dataset.c }, true);
    if (x === "post") { const t = root.querySelector("#pjC").value.trim(); if (!t) return;
      const r = await run({ action: "comment", id: p.id, text: t, mentions: tags.filter((u) => t.includes("@" + name(u))) }, true); if (r) tags = []; return; }
    if (x === "delproj") { if (await ask({ kind: "danger", title: "DELETE PROJECT?", item: p.title, body: "All tasks, images and comments are removed. This can't be undone.", go: "🗑 DELETE PROJECT" })) { const r = await run({ action: "delete", id: p.id }); if (r) { open = null; draw(); } } return; }
    if (x === "leave") { if (await ask({ kind: "warn", title: "LEAVE PROJECT?", item: p.title, body: "Your tasks become unassigned.", go: "➖ LEAVE" })) { const r = await run({ action: "leave", id: p.id }); if (r) { open = null; draw(); } } return; }
  });
  root.addEventListener("change", async (e) => {
    const p = cur(), el = e.target;
    if (el.id === "pjQ") return;
    if (el.dataset.up && p && el.files?.length) {
      if (el.dataset.up === "cover") { try { notify("⇪ UPLOADING COVER"); const u = await uploadImage(el.files[0], "505th_projects"); run({ action: "update", id: p.id, cover: u }); } catch (err) { notify("UPLOAD FAILED: " + err.message, 1); } }
      else addImages(el.files, p);
      el.value = ""; return;
    }
    if (!p) return;
    if (el.dataset.x === "assign") return run({ action: "task.update", id: p.id, taskId: el.dataset.t, patch: { assigneeUid: el.value } }, true);
    if (el.dataset.x === "tag" && el.value) { const u = el.value, c = root.querySelector("#pjC"); tags = [...new Set([...tags, u])]; c.value += `${c.value && !c.value.endsWith(" ") ? " " : ""}@${name(u)} `; el.value = ""; c.focus(); return; }
    if (el.dataset.x === "role") {
      const u = el.dataset.u, v = el.value;
      if (v === "remove") { if (await ask({ kind: "danger", title: `REMOVE ${name(u).toUpperCase()}?`, body: `They lose access to ${p.title}. Their tasks become unassigned.`, go: "✕ REMOVE" })) run({ action: "member", id: p.id, uid: u, remove: true }); else draw(); }
      else if (v === "owner") { if (await ask({ kind: "warn", title: "HAND OVER OWNERSHIP?", body: `${name(u)} becomes the owner of ${p.title}. You become an editor.`, go: "★ HAND OVER" })) run({ action: "transfer", id: p.id, uid: u }); else draw(); }
      else run({ action: "member", id: p.id, uid: u, role: v });
    }
  });
  root.addEventListener("input", (e) => { if (e.target.id === "pjQ") { q = e.target.value; const pos = e.target.selectionStart; draw(); const i = root.querySelector("#pjQ"); i.focus(); i.setSelectionRange(pos, pos); } });
  root.addEventListener("submit", (e) => {
    const f = e.target.closest('[data-form="task"]'), p = cur();
    if (!f || !p) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (!String(v.title).trim()) return;
    run({ action: "task.add", id: p.id, ...v, parent: v.parent || null }, true);
  });
  root.addEventListener("dragover", (e) => { if (e.target.closest('[data-drop="1"]')) e.preventDefault(); });
  root.addEventListener("drop", (e) => { const g = e.target.closest('[data-drop="1"]'), p = cur(); if (!g || !p) return; e.preventDefault(); addImages(e.dataTransfer.files, p); });
}

const CSS = `
#${ROOT}{--pc:#0b0f15}#${ROOT} .fld{background:#070a0f;border:1px solid var(--l2);padding:7px 10px;font:inherit;font-size:12px;color:#d6dde6;outline:0}#${ROOT} .fld:focus{border-color:#00D9FF}#${ROOT} input[type=date]{color-scheme:dark}#${ROOT} .chips{display:flex;gap:6px;flex-wrap:wrap}#${ROOT} .top{display:flex;align-items:flex-end;gap:12px;justify-content:space-between}
#${ROOT} .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}#${ROOT} .kp div{border:1px solid var(--l);background:var(--p);padding:10px 14px}#${ROOT} .kp b{display:block;font-family:Rajdhani,sans-serif;font-size:24px}#${ROOT} .kp span{font-size:9.5px;letter-spacing:2px;color:var(--d)}
#${ROOT} .inv{display:flex;align-items:center;gap:12px;border:1px solid rgba(0,217,255,.4);background:rgba(0,217,255,.05);padding:10px 14px;margin-bottom:10px;font-size:12.5px}#${ROOT} .inv b{font-weight:400;color:#fff}
#${ROOT} .flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px}#${ROOT} .flt .fld{flex:1;min-width:220px}
#${ROOT} .ch{border:1px solid var(--l);background:none;color:var(--d);padding:5px 10px;font:inherit;font-size:10.5px;letter-spacing:1.5px;cursor:pointer}#${ROOT} .ch.on{border-color:#00D9FF;color:#00D9FF}
#${ROOT} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
#${ROOT} .pc{border:1px solid var(--l);background:var(--p);overflow:hidden;text-align:left;color:inherit;font:inherit;padding:0;cursor:pointer;transition:.2s}#${ROOT} .pc:hover{border-color:#00D9FF;box-shadow:0 0 22px -6px #00D9FF;transform:translateY(-2px)}
#${ROOT} .pc.new{display:grid;place-items:center;min-height:250px;border-style:dashed;color:var(--d);font-size:12px;letter-spacing:2px}
#${ROOT} .cov{height:120px;position:relative}#${ROOT} .cov:after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 40%,var(--pc))}
#${ROOT} .st{position:absolute;top:8px;left:8px;z-index:1;font-size:9.5px;letter-spacing:1.5px;padding:1px 6px;border:1px solid;background:#000a}#${ROOT} .pr{position:absolute;top:8px;right:8px;z-index:1;font-size:9.5px;letter-spacing:1.5px;padding:1px 6px;background:#000a}
#${ROOT} .pv{position:absolute;bottom:8px;right:8px;z-index:1;font-size:9.5px;letter-spacing:1.5px;padding:1px 6px;background:#000a;color:var(--d)}
#${ROOT} .pb{padding:4px 14px 14px}#${ROOT} .pb h3{margin:0;font:700 17px Rajdhani,sans-serif;letter-spacing:1.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${ROOT} .pb p{margin:4px 0 10px;color:var(--d);font-size:12px;height:36px;overflow:hidden}
#${ROOT} .prog{height:5px;background:rgba(255,255,255,.05)}#${ROOT} .prog i{display:block;height:100%;background:linear-gradient(90deg,#00D9FF,#22e07a)}
#${ROOT} .meta{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--d)}
#${ROOT} .av,.pj-ov .av{display:inline-grid;place-items:center;border-radius:50%;font-style:normal;font-weight:700;color:#000;flex-shrink:0}#${ROOT} .avs{display:flex}#${ROOT} .avs .av{width:24px;height:24px;font-size:9px;border:2px solid var(--pc);margin-left:-7px}#${ROOT} .avs .av:first-child{margin-left:0}
#${ROOT} .back,#${ROOT} .lk,.pj-ov .lk{background:none;border:none;color:var(--d);font:inherit;font-size:11px;letter-spacing:2px;cursor:pointer;padding:0;margin-bottom:10px}#${ROOT} .back:hover,#${ROOT} .lk:hover{color:#00D9FF}#${ROOT} .lk{margin:0;font-size:10px;letter-spacing:1px}
#${ROOT} .dt{border:1px solid var(--l);background:var(--p)}#${ROOT} .hero{height:190px;position:relative}#${ROOT} .shade{position:absolute;inset:0;background:linear-gradient(90deg,#0b0f15f2 30%,#0b0f1566)}
#${ROOT} .cam{position:absolute;right:14px;top:14px;z-index:2;font-size:10.5px;letter-spacing:1.5px;border:1px solid rgba(255,255,255,.3);padding:4px 10px;background:#0009;cursor:pointer}
#${ROOT} .hc{position:absolute;inset:0;z-index:1;padding:20px 24px;display:flex;flex-direction:column;justify-content:flex-end}#${ROOT} .hc h2{margin:4px 0;font:700 28px Rajdhani,sans-serif;letter-spacing:3px;color:#fff}
#${ROOT} .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:9.5px;letter-spacing:1.5px}#${ROOT} .tag{border:1px solid var(--l);padding:0 6px;color:var(--d)}#${ROOT} .dim,.pj-ov .dim{color:var(--d)}#${ROOT} .w{color:#fff;font-weight:400}
#${ROOT} .cols{display:grid;grid-template-columns:1fr 310px}#${ROOT} .mn{padding:16px 20px;border-right:1px solid rgba(0,217,255,.1);min-width:0}#${ROOT} .sd{padding:16px}
#${ROOT} .hh{display:flex;justify-content:space-between;align-items:center;font:700 13px Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF;margin:16px 0 8px}#${ROOT} .hh:first-child{margin-top:0}#${ROOT} .hh small{font:400 10px inherit;letter-spacing:1px;color:var(--d)}
#${ROOT} .desc{margin:0;white-space:pre-wrap;font-size:13px;color:#c6d0da}
#${ROOT} .tk{display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid rgba(255,255,255,.04);background:#0e131b;margin-bottom:4px}#${ROOT} .tk:hover{border-color:var(--l)}#${ROOT} .tk.sub{margin-left:28px}
#${ROOT} .cb{width:16px;height:16px;border:1px solid #00D9FF;background:none;flex-shrink:0;display:grid;place-items:center;font-size:11px;color:#000;cursor:pointer;padding:0}#${ROOT} .cb.y{background:#22e07a;border-color:#22e07a}
#${ROOT} .tt{flex:1;font-size:13px;color:#fff}#${ROOT} .tt.dn{text-decoration:line-through;color:#4b5765}#${ROOT} .tk small{font-size:10px;color:var(--d)}#${ROOT} .due{font-size:10px;padding:0 6px;border:1px solid currentColor}
#${ROOT} .asg{max-width:130px;background:none;border:1px solid transparent;color:var(--d);font:inherit;font-size:10.5px}#${ROOT} .asg:hover{border-color:var(--l)}
#${ROOT} .del{visibility:hidden;background:none;border:none;color:#4b5765;cursor:pointer}#${ROOT} .tk:hover .del,#${ROOT} .cm:hover .del{visibility:visible}#${ROOT} .del:hover{color:#ff4d4d}
#${ROOT} .add{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#${ROOT} .add .fld{font-size:12px}
#${ROOT} .gal{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#${ROOT} .im{position:relative;aspect-ratio:16/10;overflow:hidden;border:1px solid var(--l)}#${ROOT} .im img{width:100%;height:100%;object-fit:cover;display:block}
#${ROOT} .im .x,#${ROOT} .im .sc{display:none;position:absolute;background:#000b;border:none;color:#ff4d4d;cursor:pointer;font:inherit;font-size:11px;padding:1px 6px}#${ROOT} .im .x{right:4px;top:4px}#${ROOT} .im .sc{left:4px;bottom:4px;color:#fff;font-size:9.5px;letter-spacing:1px}#${ROOT} .im:hover .x,#${ROOT} .im:hover .sc{display:block}
#${ROOT} .upl{aspect-ratio:16/10;display:grid;place-items:center;border:1px dashed rgba(0,217,255,.25);color:var(--d);font-size:20px;cursor:pointer}#${ROOT} .upl:hover{border-color:#00D9FF;color:#00D9FF}
#${ROOT} .cm{display:flex;gap:10px;margin-bottom:10px}#${ROOT} .cm .av{width:28px;height:28px}#${ROOT} .cb2{flex:1;background:#0e131b;border:1px solid rgba(255,255,255,.04);padding:7px 10px;font-size:12.5px;color:#d6dde6}#${ROOT} .cb2 b{color:#00D9FF;font-weight:600;font-size:12px}#${ROOT} .cb2 small{color:#4b5765;font-size:10.5px;margin-left:6px}#${ROOT} .cb2 .del{float:right}
#${ROOT} .ring{width:96px;height:96px;border-radius:50%;margin:0 auto 6px;display:grid;place-items:center}#${ROOT} .ring div{width:78px;height:78px;border-radius:50%;background:var(--p);display:grid;place-items:center;font:700 24px Rajdhani,sans-serif;color:#fff}
#${ROOT} .rl{text-align:center;font-size:10px;letter-spacing:2px;color:var(--d);margin-bottom:10px}
#${ROOT} .mem{display:flex;align-items:center;gap:10px;padding:6px 0}#${ROOT} .mem.pend{opacity:.6}#${ROOT} .mem>div{flex:1;min-width:0;font-size:12.5px;color:#fff}#${ROOT} .mem small{display:block;font-size:10px;color:var(--d)}
#${ROOT} .rs,#${ROOT} .rb{font-size:9.5px;letter-spacing:1px;padding:0 6px;border:1px solid;background:none;font-family:inherit}
#${ROOT} .kv{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}#${ROOT} .kv span{color:var(--d)}#${ROOT} .kv b{font-weight:400;color:#fff}
#${ROOT} .fd{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:#aeb9c4}#${ROOT} .fd i{font-style:normal;width:20px;text-align:center}#${ROOT} .fd span{flex:1}#${ROOT} .fd small{color:#4b5765;white-space:nowrap}
#${ROOT} .b.ok,.pj-ov .b.ok{border-color:#22e07a;color:#22e07a}#${ROOT} .b.cy,.pj-ov .b.cy{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}
.pj-ov{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)}
.pj-md{width:560px;max-width:94vw;max-height:90vh;overflow:auto;background:#0b0f15;border:1px solid #00D9FF;box-shadow:0 18px 50px rgba(0,0,0,.7),0 0 30px rgba(0,217,255,.2);animation:pjPop .18s ease-out}
@keyframes pjPop{from{transform:scale(.96);opacity:0}}@media(prefers-reduced-motion:reduce){.pj-md{animation:none}}
.pj-mh{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid rgba(0,217,255,.1);font:600 10px Rajdhani,sans-serif;letter-spacing:3px;color:#7d8a99;background:linear-gradient(90deg,rgba(0,217,255,.06),transparent)}.pj-mh img{width:22px;height:22px;object-fit:contain}.pj-mh button{margin-left:auto;background:none;border:none;color:#4b5765;cursor:pointer;font-size:12px}
.pj-mt{padding:14px 16px 0;font:700 17px Rajdhani,sans-serif;letter-spacing:2.5px;color:#fff}.pj-mb{padding:6px 16px 14px}.pj-mf{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid rgba(0,217,255,.1);background:#080b10}
.pj-mb .fld{width:100%;margin-bottom:0}.pj-mb .lbl{margin:12px 0 5px}.pj-mb input[type=date]{color-scheme:dark}.pj-mb .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pj-cv{height:110px;display:grid;place-items:center;border:1px dashed rgba(0,217,255,.25);cursor:pointer;font-size:11px;letter-spacing:1.5px;color:#7d8a99}.pj-cv span{background:#0009;padding:2px 8px}
.pv-o{text-align:left;border:1px solid rgba(0,217,255,.15);background:none;padding:8px 12px;cursor:pointer;font:inherit;color:inherit}.pv-o.on{border-color:#00D9FF;background:rgba(0,217,255,.1)}.pv-o b{display:block;font-weight:400;font-size:11px;letter-spacing:1.5px;color:#fff}.pv-o.on b{color:#00D9FF}.pv-o small{font-size:10.5px;color:#7d8a99}
.pj-dd{border:1px solid rgba(0,217,255,.2);border-top:none;background:#070a0f}.pj-dd:empty{display:none}.pj-row{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;background:none;border:none;border-bottom:1px solid rgba(255,255,255,.04);color:#fff;font:inherit;font-size:12.5px;text-align:left;cursor:pointer}.pj-row:hover{background:rgba(0,217,255,.08)}.pj-row[disabled]{opacity:.4;cursor:default}.pj-row small{margin-left:auto;font-size:10px;letter-spacing:1px;color:#7d8a99}.pj-row .av{width:22px;height:22px;font-size:8px}
.pj-sel .fld{width:auto}
@media(max-width:1000px){#${ROOT} .cols{grid-template-columns:1fr}#${ROOT} .mn{border-right:none}#${ROOT} .kp{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  root = mountPanel("panel-projects", ROOT, () => {
    load().catch((e) => notify("PROJECTS LOAD FAILED: " + e.message, 1));
    clearInterval(poll);
    poll = setInterval(() => { if (!document.getElementById("panel-projects")?.classList.contains("hidden")) load().catch(() => {}); else clearInterval(poll); }, 30000);
  });
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = '<div class="empty">LOADING…</div>';
  bind();
});
