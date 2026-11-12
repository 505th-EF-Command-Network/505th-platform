/**
 * WORKSPACE → NOTES v2 (approved mock 2026-11-12).
 *   Board (drag sticky notes, your own layout) · List · Calendar (your reminders) · search (Ctrl+K)
 *   Rich text: bold / italic / underline / strike, highlighter (yellow / green / red), checklists, bullets, numbers, images (Cloudinary)
 *   Colour · folder · #tags · 📌 pin · 🗄 archive · ⏰ reminder (🔔 + Hub pop-up, sent by Cortana) · share (people / groups, view / edit)
 * Data: /api/terminal/notes (lib/notes/service.ts — the server cleans all note HTML). Live: reloads on the 505th Net "notes" topic.
 */
import { addCss, ask, audit, closeModal, esc, mountPanel, notify, onReady, openModal, uploadImage } from "./_common.js";

const API = "/api/terminal/notes";
let selDay = null;
let D = null, sel = null, view = "board", filter = { k: "all" }, q = "", root = null, saveT = null, dirty = false, calY = new Date().getFullYear(), calM = new Date().getMonth();
let people = [], groups = [], shareDraft = null;
const FCOL = ["#00D9FF", "#c9a227", "#22e07a", "#f472b6", "#8b93f8", "#f59e0b", "#2dd4bf"];
const fcol = (f) => FCOL[[...f].reduce((s, c) => s + c.charCodeAt(0), 0) % FCOL.length];

async function api(method, body, qs = "") {
  const r = await fetch(API + qs, { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `Error ${r.status}`);
  return b;
}
async function load() {
  D = await api("GET");
  people = D.people || []; groups = D.groups || [];
  if (sel && !D.notes.some((n) => n.id === sel)) sel = null;
  draw();
}
const cur = () => D?.notes.find((n) => n.id === sel);
const canEdit = (n) => n && n.access !== "view";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const remDay = (n) => (n.rem ? iso(new Date(n.rem.atISO)) : "");
const remTxt = (r) => {
  if (!r) return "";
  const d = new Date(r.atISO), diff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5);
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `⏰ ${diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${t}${r.repeat !== "none" ? " ↻" : ""}${r.sentISO ? " ✓" : ""}`;
};
const prog = (n) => { const a = (n.body.match(/class="ck/g) || []).length, b = (n.body.match(/class="ck d"/g) || []).length; return a ? `${b} / ${a}` : ""; };
const visible = () => (D?.notes || [])
  .filter((n) => (filter.k === "arch" ? n.arch : !n.arch))
  .filter((n) => filter.k === "all" || filter.k === "arch" || (filter.k === "pin" && n.pin) || (filter.k === "rem" && n.rem) || (filter.k === "mine" && n.access === "owner") || (filter.k === "shared" && n.access !== "owner") || (filter.k === "f" && n.folder === filter.v) || (filter.k === "tag" && n.tags.includes(filter.v)))
  .filter((n) => !q || `${n.title} ${n.text} ${n.tags.join(" ")} ${n.folder}`.toLowerCase().includes(q));

/* ───────── drawing ───────── */
function side() {
  const N = D.notes, live = N.filter((n) => !n.arch);
  const it = (k, l, c, v) => `<button class="nv-it ${filter.k === k && (v === undefined || filter.v === v) ? "on" : ""}" data-fk="${k}" ${v !== undefined ? `data-fv="${esc(v)}"` : ""}>${l}<small>${c}</small></button>`;
  const folders = [...new Set(live.map((n) => n.folder).filter(Boolean))].sort();
  const tags = [...new Set(live.flatMap((n) => n.tags))].sort();
  return `${D.canCreate ? '<button class="nv-new" data-x="new">＋ NEW NOTE</button>' : ""}
    <div class="nv-sec">VIEWS</div>${it("all", "▦ All notes", live.length)}${it("pin", "📌 Pinned", live.filter((n) => n.pin).length)}${it("rem", "⏰ Reminders", live.filter((n) => n.rem).length)}${it("mine", "★ Mine", live.filter((n) => n.access === "owner").length)}${it("shared", "👥 Shared with me", live.filter((n) => n.access !== "owner").length)}${it("arch", "🗄 Archive", N.filter((n) => n.arch).length)}
    ${folders.length ? `<div class="nv-sec">FOLDERS</div>${folders.map((f) => it("f", `<span class="nv-dot" style="background:${fcol(f)}"></span>${esc(f)}`, live.filter((n) => n.folder === f).length, f)).join("")}` : ""}
    ${tags.length ? `<div class="nv-sec">TAGS</div><div class="nv-tags">${tags.map((t) => `<button class="nv-tag ${filter.k === "tag" && filter.v === t ? "on" : ""}" data-fk="tag" data-fv="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}`;
}
function card(n, i) {
  const x = n.x ?? 20 + (i % 4) * 230, y = n.y ?? 20 + Math.floor(i / 4) * 210;
  return `<div class="nv-n ${n.id === sel ? "sel" : ""}" data-id="${n.id}" style="left:${x}px;top:${y}px;border-top-color:${n.color}" tabindex="0" aria-label="${esc(n.title || "Untitled")}">
    <h4>${n.pin ? '<span class="nv-pin">📌</span>' : ""}<span class="nv-ti">${esc(n.title || "Untitled")}</span><span class="nv-gr" data-grip title="Drag to move">⠿⠿</span></h4>
    <div class="nv-tx">${n.body || '<span class="dim">Empty note</span>'}</div>
    <div class="nv-meta">${n.rem ? `<span class="nv-tg rm">${remTxt(n.rem)}</span>` : ""}${prog(n) ? `<span class="nv-tg">☑ ${prog(n)}</span>` : ""}${n.tags.map((t) => `<span class="nv-tg">#${esc(t)}</span>`).join("")}${n.access !== "owner" ? `<span class="nv-tg">👥 ${esc(n.ownerName)}${n.access === "view" ? " · view" : ""}</span>` : n.shareSummary?.mode === "shared" ? '<span class="nv-tg">👥 shared</span>' : ""}</div></div>`;
}
function area() {
  const v = visible();
  if (!v.length) return `<div class="nv-empty">${q ? "NOTHING MATCHES YOUR SEARCH" : "NO NOTES HERE"}${D.canCreate && !q ? '<br><br><button class="b gold" data-x="new">＋ NEW NOTE</button>' : ""}</div>`;
  if (view === "board") { const h = Math.max(620, ...v.map((n, i) => (n.y ?? 20 + Math.floor(i / 4) * 210) + 240)); return `<div class="nv-board" id="nvBoard" style="height:${h}px">${v.map(card).join("")}</div>`; }
  if (view === "list") return `<div class="nv-list">${[...v].sort((a, b) => (b.pin | 0) - (a.pin | 0)).map((n) => `<button class="nv-row ${n.id === sel ? "sel" : ""}" data-id="${n.id}" style="border-left-color:${n.color}">${n.pin ? "📌" : ""}<b>${esc(n.title || "Untitled")}</b><small>${esc(n.text.replace(/\s+/g, " ").slice(0, 90))}</small><span class="nv-rr">${n.rem ? `<span class="nv-tg rm">${remTxt(n.rem)}</span>` : ""}${prog(n) ? `<span class="nv-tg">☑ ${prog(n)}</span>` : ""}<small class="dim">${n.updatedAtISO ? new Date(n.updatedAtISO).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</small></span></button>`).join("")}</div>`;
  const m = new Date(calY, calM, 1), first = new Date(m); first.setDate(1 - ((m.getDay() + 6) % 7));
  let h = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => `<div class="nv-ch">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(first); d.setDate(first.getDate() + i); const k = iso(d);
    const evs = v.filter((n) => remDay(n) === k).sort((a, b) => a.rem.atISO.localeCompare(b.rem.atISO));
    h += `<div class="nv-c ${k === iso(new Date()) ? "t" : ""} ${k === selDay ? "s" : ""} ${d.getMonth() !== calM ? "o" : ""}" data-day="${k}" role="button" tabindex="0" aria-pressed="${k === selDay}" aria-label="${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${evs.length ? `, ${evs.length} reminder${evs.length > 1 ? "s" : ""}` : ""}"><span class="nv-dn">${d.getDate()}</span>${D.canCreate ? `<button class="nv-add" data-addday="${k}" title="New note with a reminder on this day" aria-label="New note on this day">＋</button>` : ""}${evs.map((n) => `<span class="nv-ev" data-id="${n.id}" style="border-color:${n.color}">${new Date(n.rem.atISO).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ${esc(n.title || "Untitled")}</span>`).join("")}</div>`;
  }
  return `<div class="nv-calw"><div class="nv-calh"><b>${m.toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase()}</b><button class="b sm" data-cal="-1" aria-label="Previous month">◀</button><button class="b sm" data-cal="0">TODAY</button><button class="b sm" data-cal="1" aria-label="Next month">▶</button></div><div class="nv-cal">${h}</div><p class="dim" style="font-size:11px;margin:8px 0 0">${selDay ? `<b style="color:#00D9FF">${new Date(selDay + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</b> selected${D.canCreate ? ` — <button class="b sm" data-addday="${selDay}">＋ NEW NOTE ON THIS DAY</button>` : ""}` : "Click a day to select it · ＋ adds a note with a reminder on that day."} · Your reminders only.</p></div>`;
}
function editor() {
  const n = cur();
  const W = widget();
  if (!n) return `<div class="nv-empty" style="padding:40px 10px">PICK A NOTE</div>${W}`;
  const ro = !canEdit(n);
  const remD = n.rem ? new Date(n.rem.atISO) : null;
  return `<div class="nv-sub">${ro ? "VIEW ONLY · " + esc(n.ownerName) : n.access === "owner" ? "YOUR NOTE" : "SHARED BY " + esc(n.ownerName) + " · CAN EDIT"}${n.updatedByName ? ` · saved by ${esc(n.updatedByName)}` : ""} <span id="nvSaved" class="dim"></span></div>
    <input class="nv-title" id="nvT" value="${esc(n.title)}" ${ro ? "readonly" : ""} aria-label="Title" maxlength="120">
    ${ro ? "" : `<div class="nv-tb" role="toolbar" aria-label="Formatting">
      <button data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button><button data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button><button data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button><button data-cmd="strikeThrough" title="Strike">S̶</button><span class="sep"></span>
      <button data-hl="y" title="Yellow highlight" class="hy">H</button><button data-hl="g" title="Green highlight" class="hg">H</button><button data-hl="r" title="Red highlight" class="hr">H</button><button data-hl="x" title="Remove highlight">⌫</button><span class="sep"></span>
      <button data-ck title="Checklist item">☑</button><button data-cmd="insertUnorderedList" title="Bullets">•</button><button data-cmd="insertOrderedList" title="Numbers">1.</button><span class="sep"></span><button data-img title="Add image">🖼</button></div>
    <div class="nv-lbl">COLOUR</div><div class="nv-sw">${D.colours.map((c) => `<button style="background:${c}" class="${n.color === c ? "on" : ""}" data-col="${c}" aria-label="Colour ${c}" aria-pressed="${n.color === c}"></button>`).join("")}</div>`}
    <div class="nv-body" id="nvB" ${ro ? "" : 'contenteditable="true"'} role="textbox" aria-multiline="true" aria-label="Note text">${n.body}</div>
    ${ro ? "" : '<div class="nv-drop" id="nvDrop" data-img>🖼 DROP IMAGES HERE · or paste (Ctrl+V) into the note</div><input type="file" id="nvFile" accept="image/*" hidden>'}
    <div class="nv-lbl">⏰ REMINDER <small class="dim">(just for you)</small></div>
    <div class="nv-rem"><input type="date" id="nvRd" value="${remD ? iso(remD) : ""}" aria-label="Reminder date"><input type="time" id="nvRt" value="${remD ? remD.toTimeString().slice(0, 5) : "19:00"}" aria-label="Reminder time">
      <select id="nvRr" aria-label="Repeat"><option value="none">no repeat</option><option value="daily" ${n.rem?.repeat === "daily" ? "selected" : ""}>daily</option><option value="weekly" ${n.rem?.repeat === "weekly" ? "selected" : ""}>weekly</option></select>
      <button class="b sm" data-x="rem">${n.rem ? "UPDATE" : "SET"}</button>${n.rem ? '<button class="b sm red" data-x="remclr" aria-label="Remove reminder">✕</button>' : ""}
      <div class="dim" style="width:100%;font-size:10.5px">${n.rem ? `${remTxt(n.rem)} → 🔔 alert + Hub pop-up` : "No reminder"}</div></div>
    ${ro ? "" : `<div class="nv-lbl">FOLDER · TAGS</div><div style="display:flex;gap:6px"><input class="srch" id="nvF" list="nvFl" value="${esc(n.folder)}" placeholder="Folder" maxlength="40" aria-label="Folder" style="width:42%"><datalist id="nvFl">${[...new Set(D.notes.map((x) => x.folder).filter(Boolean))].map((f) => `<option value="${esc(f)}">`).join("")}</datalist><input class="srch" id="nvG" value="${esc(n.tags.join(", "))}" placeholder="tags, comma, separated" aria-label="Tags"></div>`}
    <div class="nv-lbl">SHARING</div><div class="nv-share">${n.shareSummary?.mode === "shared" ? [...n.shareSummary.groups.map((g) => `<span class="nv-tg">👥 ${esc(g.label)} · ${g.perm}</span>`), ...n.shareSummary.people.map((p) => `<span class="nv-tg">${esc(p.name)} · ${p.perm}</span>`)].join("") : '<span class="dim">🔒 Only you</span>'}${n.access === "owner" ? '<button class="b sm" data-x="share">⇪ SHARE</button>' : ""}</div>
    <div class="nv-lbl">MORE</div><div class="nv-more"><button class="b sm ${n.pin ? "on" : ""}" data-x="pin">📌 ${n.pin ? "UNPIN" : "PIN"}</button>${D.canCreate ? '<button class="b sm" data-x="dup">⧉ DUPLICATE</button>' : ""}<button class="b sm" data-x="arch">🗄 ${n.arch ? "RESTORE" : "ARCHIVE"}</button>${n.access === "owner" ? '<button class="b sm red" data-x="del">🗑 DELETE</button>' : ""}</div>${W}`;
}
function widget() {
  const live = D.notes.filter((x) => !x.arch);
  const rows = [
    ...live.filter((x) => x.pin).map((x) => `<button class="nv-w" data-id="${x.id}"><span class="nv-pin">📌</span>${esc(x.title || "Untitled")}</button>`),
    ...live.filter((x) => x.rem && !x.rem.sentISO).sort((a, b) => a.rem.atISO.localeCompare(b.rem.atISO)).slice(0, 4).map((x) => `<button class="nv-w" data-id="${x.id}" style="color:#f59e0b">${remTxt(x.rem)} · ${esc(x.title || "Untitled")}</button>`),
    ...live.filter((x) => prog(x) && !x.pin).slice(0, 3).map((x) => `<button class="nv-w" data-id="${x.id}">☑ ${esc(x.title || "Untitled")} · ${prog(x)}</button>`),
  ];
  return `<div class="nv-wg"><h5>✎ QUICK <span>also on your Dashboard</span></h5>${rows.join("") || '<div class="dim" style="font-size:11px;padding:4px 0">Pin notes or set reminders to see them here.</div>'}${D.canCreate ? '<input class="srch" id="nvQ" placeholder="＋ Quick note… (Enter)" aria-label="Quick note" maxlength="120">' : ""}</div>`;
}
function draw() {
  if (!root) return;
  if (!D) { root.innerHTML = '<div class="nv-empty">LOADING…</div>'; return; }
  const focusId = document.activeElement?.id, keepBody = focusId === "nvB" || focusId === "nvT";
  root.innerHTML = `<div class="nv-top"><div><div class="h1" style="border:none;padding:0">✎ NOTES</div><div class="sub" style="margin:3px 0 0">YOUR NOTES + SHARED WITH YOU · SAVED AUTOMATICALLY</div></div><span style="flex:1"></span>
      <input class="srch" id="nvS" value="${esc(q)}" placeholder="🔍 Search notes, checklists, tags…  (Ctrl+K)" aria-label="Search notes" style="width:min(420px,40vw)">
      <div class="nv-seg" role="tablist">${[["board", "BOARD"], ["list", "LIST"], ["cal", "CALENDAR"]].map(([k, l]) => `<button role="tab" aria-selected="${view === k}" class="${view === k ? "on" : ""}" data-v="${k}">${l}</button>`).join("")}</div></div>
    <div class="nv-lay"><aside class="nv-side">${side()}</aside><div class="nv-area">${area()}</div><div class="nv-ed" id="nvEd">${editor()}</div></div>`;
  if (keepBody) { const el = document.getElementById(focusId); el?.focus(); if (focusId === "nvB") { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
}
const redrawSoft = () => { const a = root?.querySelector(".nv-area"), s = root?.querySelector(".nv-side"); if (a) a.innerHTML = area(); if (s) s.innerHTML = side(); };

/* ───────── saving ───────── */
function queueSave() { dirty = true; const s = document.getElementById("nvSaved"); if (s) s.textContent = "· saving…"; clearTimeout(saveT); saveT = setTimeout(saveNow, 700); }
async function saveNow() {
  clearTimeout(saveT);
  if (!dirty) return;
  dirty = false;
  const n = cur(), b = document.getElementById("nvB"), t = document.getElementById("nvT");
  if (!n || !canEdit(n) || !b) return;
  n.body = b.innerHTML; n.title = t?.value ?? n.title; n.text = b.innerText;
  try { await api("PATCH", { id: n.id, title: n.title, body: n.body }); const s = document.getElementById("nvSaved"); if (s) s.textContent = "· ✓ saved"; redrawSoft(); }
  catch (e) { dirty = true; notify("NOT SAVED: " + e.message.toUpperCase(), 1); }
}
async function patch(fields, msg) {
  const n = cur(); if (!n) return;
  Object.assign(n, fields);
  draw();
  try { await api("PATCH", { id: n.id, ...fields }); if (msg) notify(msg); } catch (e) { notify(e.message.toUpperCase(), 1); load(); }
}
async function create(fields) {
  await saveNow();
  try { const r = await api("POST", { title: "New note", body: "", ...fields }); sel = r.id; await load(); document.getElementById("nvT")?.select(); }
  catch (e) { notify("COULD NOT CREATE NOTE: " + e.message.toUpperCase(), 1); }
}
async function addImage(file) {
  if (!file?.type?.startsWith("image/")) return;
  if (file.size > 10 * 1048576) return notify("IMAGE TOO BIG — 10 MB MAX", 1);
  notify("⇪ UPLOADING IMAGE…");
  try {
    const up = await uploadImage(file, "505th_notes");
    const b = document.getElementById("nvB"); if (!b) return;
    b.focus();
    document.execCommand("insertHTML", false, `<img src="${esc(up.secure_url)}" alt="">`);
    queueSave(); notify("✓ IMAGE ADDED");
  } catch (e) { notify("IMAGE NOT ADDED: " + e.message.toUpperCase(), 1); }
}

/* ───────── sharing (same rules as v1) ───────── */
function hexFor(p) {
  const url = p.photoUrl && /^https:\/\//.test(p.photoUrl) ? p.photoUrl : null;
  return url ? `<span class="hx hx-sm" style="--img:url('${esc(url).replace(/'/g, "%27")}')"></span>` : `<span class="hx hx-sm noimg">${esc(((p.callsign || p.name || "?").replace(/^\S+\s+/, "")[0] || "?").toUpperCase())}</span>`;
}
function openShare() {
  const n = cur();
  if (!n || n.access !== "owner") return;
  shareDraft = JSON.parse(JSON.stringify(n.share || { mode: "private", people: {}, groups: {} }));
  openModal(`<div class="hd"><h2>⇪ SHARE NOTE</h2><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="lb">WHO CAN SEE THIS NOTE</div>
      <div class="modes"><button class="mode" data-mode="private"><i>🔒</i><span><b>ONLY ME</b><small>Private — nobody else sees it</small></span></button><button class="mode" data-mode="shared"><i>👥</i><span><b>SHARED</b><small>People and groups you pick</small></span></button></div>
      <div id="shBox"><div class="lb">ADD PEOPLE</div>
        <div class="addrow"><input class="srch" id="shQ" placeholder="Type a name or callsign…" autocomplete="off" aria-label="Find members"><select class="srch" id="shPerm" style="width:auto" aria-label="Permission for new people"><option value="view">CAN VIEW</option><option value="edit">CAN EDIT</option></select><div class="sug" id="shSug" hidden></div></div>
        <div class="lb" style="margin-top:14px">ADD GROUPS</div><div class="grps" id="shGrps"></div><div class="lb">SHARED WITH</div><div class="who" id="shWho"></div></div></div>
    <div class="mf"><span class="hint">Groups follow roles. People you add get a 🔔 alert.</span><button class="b" data-close>CANCEL</button><button class="b gold" id="shSave">SAVE</button></div>`, { width: 580 });
  drawShare();
  const m = document.querySelector(".v2m");
  m.addEventListener("click", async (e) => {
    const md = e.target.closest("[data-mode]"); if (md) { shareDraft.mode = md.dataset.mode; return drawShare(); }
    const g = e.target.closest("[data-grp]"); if (g) { const k = g.dataset.grp; shareDraft.groups[k] ? delete shareDraft.groups[k] : (shareDraft.groups[k] = document.getElementById("shPerm").value); return drawShare(); }
    const add = e.target.closest("[data-addp]"); if (add) { shareDraft.people[add.dataset.addp] = document.getElementById("shPerm").value; document.getElementById("shQ").value = ""; document.getElementById("shSug").hidden = true; return drawShare(); }
    const rm = e.target.closest("[data-rm]"); if (rm) { const [t, k] = rm.dataset.rm.split(":"); delete shareDraft[t][k]; return drawShare(); }
    if (!e.target.closest(".addrow")) document.getElementById("shSug").hidden = true;
    if (e.target.id === "shSave") {
      try { const r = await api("PATCH", { id: sel, share: shareDraft }); closeModal(); notify(`✓ SHARING SAVED${r.alerted ? ` — ${r.alerted} ALERTED` : ""}`); await load(); }
      catch (err) { notify("NOT SAVED: " + err.message, 1); }
    }
  });
  m.addEventListener("change", (e) => { const s = e.target.closest("[data-perm]"); if (s) { const [t, k] = s.dataset.perm.split(":"); shareDraft[t][k] = s.value; } });
  const qq = document.getElementById("shQ");
  const sug = () => {
    const v = qq.value.toLowerCase();
    const list = people.filter((p) => !shareDraft.people[p.uid] && (!v || p.name.toLowerCase().includes(v) || String(p.callsign).toLowerCase().includes(v))).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 25);
    const box = document.getElementById("shSug"); box.hidden = !list.length;
    box.innerHTML = list.map((p) => `<button data-addp="${esc(p.uid)}">${hexFor(p)}${esc(p.name)}<small>${esc(String(p.role).replace("_", " ").toUpperCase())}</small></button>`).join("");
  };
  qq.addEventListener("input", sug); qq.addEventListener("focus", sug);
}
function drawShare() {
  const m = document.querySelector(".v2m"); if (!m) return;
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

/* ───────── CSS ───────── */
addCss("notesV3", `
#notesV3 .nv-top{display:flex;align-items:flex-end;gap:10px;margin-bottom:12px;flex-wrap:wrap}
#notesV3 .nv-seg{display:flex;border:1px solid var(--l)}#notesV3 .nv-seg button{background:none;border:0;padding:7px 12px;font:inherit;font-size:10.5px;letter-spacing:1.5px;color:var(--d);cursor:pointer}#notesV3 .nv-seg button.on{background:rgba(0,217,255,.12);color:#00D9FF}
#notesV3 .nv-lay{display:grid;grid-template-columns:210px minmax(0,1fr) 360px;gap:12px;align-items:start}
#notesV3 .nv-side{border:1px solid var(--l);background:var(--p);padding:10px;position:sticky;top:10px}
#notesV3 .nv-new{display:block;width:100%;border:1px solid #c9a227;color:#c9a227;background:none;padding:8px;font:inherit;letter-spacing:2px;cursor:pointer;margin-bottom:6px}#notesV3 .nv-new:hover{background:rgba(201,162,39,.1)}
#notesV3 .nv-sec{font-size:9.5px;letter-spacing:2px;color:var(--dd);margin:12px 4px 4px}
#notesV3 .nv-it{display:flex;align-items:center;gap:7px;width:100%;padding:6px 8px;background:none;border:0;border-left:3px solid transparent;color:#c6d0da;font:inherit;font-size:12px;text-align:left;cursor:pointer}#notesV3 .nv-it:hover{background:rgba(0,217,255,.04)}#notesV3 .nv-it.on{background:rgba(0,217,255,.08);border-left-color:#00D9FF}#notesV3 .nv-it small{margin-left:auto;color:var(--d)}
#notesV3 .nv-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
#notesV3 .nv-tags{display:flex;gap:4px;flex-wrap:wrap;padding:0 4px}#notesV3 .nv-tag{background:none;border:1px solid var(--l);color:var(--d);font:inherit;font-size:10px;padding:0 6px;cursor:pointer}#notesV3 .nv-tag.on{background:rgba(0,217,255,.15);color:#00D9FF}
#notesV3 .nv-area{min-width:0}
#notesV3 .nv-board{position:relative;border:1px dashed rgba(0,217,255,.12);background:radial-gradient(circle,rgba(0,217,255,.08) 1px,transparent 1px) 0 0/22px 22px;overflow:auto;min-height:620px}
#notesV3 .nv-n{position:absolute;width:214px;padding:9px 11px 11px;border-top:4px solid;background:#0d131b;box-shadow:0 8px 22px rgba(0,0,0,.55);font-size:12px;line-height:1.55;cursor:pointer}
#notesV3 .nv-n:focus-visible,#notesV3 .nv-n.sel{outline:1px solid #00D9FF}#notesV3 .nv-n.drag{transform:rotate(-2deg);box-shadow:0 18px 40px rgba(0,0,0,.8),0 0 0 1px #c9a227;z-index:50;cursor:grabbing}
#notesV3 .nv-n h4{margin:0 0 5px;font:700 14px Rajdhani,sans-serif;letter-spacing:1px;color:#fff;display:flex;gap:6px;align-items:center;cursor:grab}#notesV3 .nv-ti{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#notesV3 .nv-gr{margin-left:auto;color:var(--d);letter-spacing:-2px}
#notesV3 .nv-tx{max-height:160px;overflow:hidden;word-break:break-word}#notesV3 .nv-tx img{max-height:90px}
#notesV3 .nv-meta{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}#notesV3 .nv-tg{font-size:9.5px;letter-spacing:.5px;padding:0 6px;border:1px solid var(--l);color:var(--d)}#notesV3 .nv-tg.rm{color:#f59e0b;border-color:rgba(245,158,11,.35)}
#notesV3 .nv-pin{color:#f59e0b}
#notesV3 mark.y{background:#f5d90a;color:#000;padding:0 2px}#notesV3 mark.g{background:rgba(34,224,122,.35);color:inherit;padding:0 2px}#notesV3 mark.r{background:rgba(255,77,77,.35);color:inherit;padding:0 2px}
#notesV3 .ck{display:flex;gap:6px;align-items:flex-start}#notesV3 .ck>b{width:13px;height:13px;border:1px solid #00D9FF;flex-shrink:0;margin-top:4px;font-size:10px;line-height:11px;text-align:center;color:#00D9FF;cursor:pointer;font-weight:400}#notesV3 .ck.d{color:var(--d);text-decoration:line-through}
#notesV3 .nv-tx img,#notesV3 .nv-body img{max-width:100%;display:block;margin:6px 0;border:1px solid var(--l)}
#notesV3 .nv-list{display:flex;flex-direction:column;gap:6px}#notesV3 .nv-row{display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--l);border-left:4px solid;background:#0d131b;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}#notesV3 .nv-row.sel{background:rgba(0,217,255,.06)}
#notesV3 .nv-row b{color:#fff;font-weight:400;white-space:nowrap}#notesV3 .nv-row small{color:var(--d);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}#notesV3 .nv-rr{margin-left:auto;display:flex;gap:5px;align-items:center;flex-shrink:0}
#notesV3 .nv-calw{width:100%}#notesV3 .nv-calh{display:flex;align-items:center;gap:6px;margin-bottom:8px}#notesV3 .nv-calh b{font:700 17px Rajdhani,sans-serif;letter-spacing:3px;color:#fff;margin-right:auto}
#notesV3 .nv-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;width:100%}#notesV3 .nv-ch{font-size:9.5px;letter-spacing:2px;color:var(--d);text-align:center;padding:4px}
#notesV3 .nv-c{min-height:100px;min-width:0;border:1px solid var(--l);background:#0b0f15;padding:4px 6px;font-size:10.5px;cursor:pointer}#notesV3 .nv-c:hover{border-color:rgba(0,217,255,.45)}#notesV3 .nv-c.t{border-color:#00D9FF;background:#0d1a24}#notesV3 .nv-c.o{opacity:.35}
#notesV3 .nv-c.s{border-color:#c9a227;box-shadow:inset 0 0 0 1px #c9a227}#notesV3 .nv-c:focus-visible{outline:2px solid #00D9FF}
#notesV3 .nv-dn{color:var(--d)}#notesV3 .nv-add{float:right;background:none;border:1px solid transparent;color:#4b5765;font:inherit;font-size:13px;line-height:1;padding:0 4px;cursor:pointer}#notesV3 .nv-c:hover .nv-add,#notesV3 .nv-c.s .nv-add{color:#00D9FF}#notesV3 .nv-add:hover{border-color:#00D9FF}
#notesV3 .nv-ev{display:block;margin-top:3px;padding:1px 4px;border-left:3px solid;background:#121a24;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#notesV3 .nv-ed{border:1px solid var(--l);background:var(--p);padding:13px;position:sticky;top:10px;max-height:calc(100vh - 140px);overflow:auto}
#notesV3 .nv-sub{font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
#notesV3 .nv-title{width:100%;background:none;border:0;border-bottom:1px solid var(--l);font:700 18px Rajdhani,sans-serif;letter-spacing:1px;color:#fff;padding:4px 0;outline:0}#notesV3 .nv-title:focus{border-bottom-color:#00D9FF}
#notesV3 .nv-tb{display:flex;gap:3px;flex-wrap:wrap;padding:5px;border:1px solid var(--l);background:#070a0f;margin:10px 0}
#notesV3 .nv-tb button{min-width:26px;height:26px;display:grid;place-items:center;border:1px solid transparent;background:none;color:#c6d0da;font:inherit;font-size:12px;cursor:pointer}#notesV3 .nv-tb button:hover,#notesV3 .nv-tb button:focus-visible{border-color:var(--l2)}
#notesV3 .nv-tb .hy{background:#f5d90a;color:#000}#notesV3 .nv-tb .hg{background:rgba(34,224,122,.35)}#notesV3 .nv-tb .hr{background:rgba(255,77,77,.35)}#notesV3 .nv-tb .sep{width:1px;background:var(--l);margin:0 3px}
#notesV3 .nv-lbl{font-size:9.5px;letter-spacing:2px;color:var(--d);margin:12px 0 5px}
#notesV3 .nv-sw{display:flex;gap:7px}#notesV3 .nv-sw button{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer}#notesV3 .nv-sw button.on{border-color:#fff}
#notesV3 .nv-body{border:1px solid var(--l);background:#070a0f;padding:10px;min-height:170px;font-size:12.5px;line-height:1.7;outline:0;word-break:break-word;margin-top:10px}#notesV3 .nv-body:focus{border-color:#00D9FF}
#notesV3 .nv-drop{border:1px dashed var(--l);padding:9px;text-align:center;font-size:10px;letter-spacing:1.5px;color:var(--dd);margin-top:6px;cursor:pointer}#notesV3 .nv-drop.over{border-color:#c9a227;color:#c9a227}
#notesV3 .nv-rem{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.06);padding:7px 9px;display:flex;gap:5px;flex-wrap:wrap;align-items:center}
#notesV3 .nv-rem input,#notesV3 .nv-rem select{background:#070a0f;border:1px solid rgba(245,158,11,.4);color:#fff;font:inherit;font-size:11px;padding:3px 5px;color-scheme:dark}
#notesV3 .nv-share,#notesV3 .nv-more{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
#notesV3 .b.sm{padding:4px 9px;font-size:10px}#notesV3 .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}#notesV3 .b.on{color:#f59e0b;border-color:#f59e0b}
#notesV3 .nv-wg{margin-top:16px;border:1px solid var(--l);background:#0b0f15;padding:9px 11px}#notesV3 .nv-wg h5{margin:0 0 6px;font:700 12px Rajdhani,sans-serif;letter-spacing:2px;color:#00D9FF;display:flex}#notesV3 .nv-wg h5 span{margin-left:auto;color:var(--d);font:10px "Share Tech Mono",monospace;letter-spacing:0}
#notesV3 .nv-w{display:block;width:100%;text-align:left;background:none;border:0;border-top:1px solid rgba(255,255,255,.04);padding:5px 0;color:#c6d0da;font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#notesV3 .nv-wg .srch{width:100%;margin-top:6px}
#notesV3 .nv-empty{color:var(--dd);letter-spacing:2px;font-size:11px;text-align:center;padding:60px 10px}
@media(max-width:1250px){#notesV3 .nv-lay{grid-template-columns:180px minmax(0,1fr)}#notesV3 .nv-ed{grid-column:1/-1;position:static;max-height:none}}
@media(prefers-reduced-motion:reduce){#notesV3 .nv-n.drag{transform:none}}
`);

/* ───────── events ───────── */
onReady(() => {
  root = mountPanel("panel-notes", "notesV3", () => load().catch((e) => notify("NOTES LOAD FAILED: " + e.message.toUpperCase(), 1)));
  if (!root) return;
  // Live: someone else saved / shared a note → reload (not while you're typing in it).
  let lt = null;
  window.addEventListener("terminal-live", (e) => {
    if (e.detail !== "notes" || document.getElementById("panel-notes")?.classList.contains("hidden")) return;
    clearTimeout(lt); lt = setTimeout(() => { if (!dirty && !["nvB", "nvT", "nvF", "nvG"].includes(document.activeElement?.id)) load().catch(() => {}); }, 800);
  });
  window.addEventListener("ws:open", (e) => { if (e.detail?.kind === "note") { sel = e.detail.id; draw(); } });
  window.addEventListener("beforeunload", (e) => { if (dirty) { saveNow(); e.preventDefault(); } });

  root.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "nvS") { q = e.target.value.toLowerCase(); const a = root.querySelector(".nv-area"); if (a) a.innerHTML = area(); return; }
    if (id === "nvB" || id === "nvT") return queueSave();
  });
  root.addEventListener("change", (e) => {
    const id = e.target.id, n = cur();
    if (id === "nvF" && n) return patch({ folder: e.target.value.trim() });
    if (id === "nvG" && n) return patch({ tags: e.target.value.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean) });
    if (id === "nvFile" && e.target.files[0]) return addImage(e.target.files[0]);
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.id === "nvQ" && e.key === "Enter" && e.target.value.trim()) { const t = e.target.value.trim(); e.target.value = ""; return create({ title: t }); }
    if (e.target.classList?.contains("nv-n") && e.key === "Enter") { sel = e.target.dataset.id; draw(); }
    if (e.target.classList?.contains("nv-c") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selDay = e.target.dataset.day; draw(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !document.getElementById("panel-notes")?.classList.contains("hidden")) { e.preventDefault(); document.getElementById("nvS")?.focus(); }
  });
  root.addEventListener("click", async (e) => {
    const t = e.target;
    const fk = t.closest("[data-fk]"); if (fk) { filter = { k: fk.dataset.fk, v: fk.dataset.fv }; if (filter.k === "tag" && fk.classList.contains("on")) filter = { k: "all" }; return draw(); }
    const vb = t.closest("[data-v]"); if (vb) { view = vb.dataset.v; return draw(); }
    const cn = t.closest("[data-cal]"); if (cn) { const v = +cn.dataset.cal; if (!v) { calY = new Date().getFullYear(); calM = new Date().getMonth(); } else { calM += v; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } } return draw(); }
    // tick a checklist box (on a card, in the editor)
    const box = t.closest(".ck > b");
    if (box) {
      const ck = box.parentElement, inEd = !!t.closest("#nvB"), id = inEd ? sel : t.closest("[data-id]")?.dataset.id, n = D.notes.find((x) => x.id === id);
      if (!n || !canEdit(n)) return;
      if (inEd) { ck.classList.toggle("d"); box.textContent = ck.classList.contains("d") ? "✓" : ""; return queueSave(); }
      const tmp = document.createElement("div"); tmp.innerHTML = n.body;
      const i = [...t.closest(".nv-tx").querySelectorAll(".ck")].indexOf(ck), c = tmp.querySelectorAll(".ck")[i];
      if (!c) return;
      c.classList.toggle("d"); c.querySelector("b").textContent = c.classList.contains("d") ? "✓" : "";
      sel = n.id; return patch({ body: tmp.innerHTML });
    }
    const add = t.closest("[data-addday]");
    if (add && D.canCreate) return create({ rem: { atISO: new Date(`${add.dataset.addday}T19:00`).toISOString(), repeat: "none" } });
    const day = t.closest("[data-day]");
    if (day && !t.closest("[data-id]")) { selDay = selDay === day.dataset.day ? null : day.dataset.day; return draw(); }
    const card = t.closest("[data-id]");
    if (card && !t.closest("[data-grip]") && !t.closest("#nvEd .nv-body")) { if (card.dataset.id !== sel) { await saveNow(); sel = card.dataset.id; draw(); } return; }
    const n = cur();
    if (t.closest("[data-col]") && n) return patch({ color: t.closest("[data-col]").dataset.col });
    const cmd = t.closest("[data-cmd]"); if (cmd) { document.getElementById("nvB")?.focus(); document.execCommand(cmd.dataset.cmd); return queueSave(); }
    const hl = t.closest("[data-hl]");
    if (hl) {
      const b = document.getElementById("nvB"), s = getSelection();
      if (!s.rangeCount || s.isCollapsed || !b.contains(s.anchorNode)) return notify("SELECT SOME TEXT IN THE NOTE FIRST", 1);
      if (hl.dataset.hl === "x") b.querySelectorAll("mark").forEach((m) => { if (s.containsNode(m, true)) m.replaceWith(...m.childNodes); });
      else { const r = s.getRangeAt(0), m = document.createElement("mark"); m.className = hl.dataset.hl; m.appendChild(r.extractContents()); r.insertNode(m); }
      s.removeAllRanges(); return queueSave();
    }
    if (t.closest("[data-ck]")) { const b = document.getElementById("nvB"); b.focus(); document.execCommand("insertHTML", false, '<div class="ck"><b></b><span>New item</span></div>'); return queueSave(); }
    if (t.closest("[data-img]")) return document.getElementById("nvFile")?.click();
    const x = t.closest("[data-x]")?.dataset.x;
    if (!x) return;
    if (x === "new") return create(filter.k === "f" ? { folder: filter.v } : {});
    if (!n) return;
    if (x === "rem") {
      const d = document.getElementById("nvRd").value, tm = document.getElementById("nvRt").value || "19:00";
      if (!d) return notify("PICK A DATE FIRST", 1);
      return patch({ rem: { atISO: new Date(`${d}T${tm}`).toISOString(), repeat: document.getElementById("nvRr").value } }, "⏰ REMINDER SET — 🔔 ALERT + HUB POP-UP");
    }
    if (x === "remclr") return patch({ rem: null }, "REMINDER REMOVED");
    if (x === "pin") return patch({ pin: !n.pin });
    if (x === "arch") { const a = !n.arch; await patch({ arch: a }, a ? "🗄 ARCHIVED" : "✓ RESTORED"); if (a) { sel = null; draw(); } return; }
    if (x === "dup") { await saveNow(); return create({ title: `${n.title} (copy)`, body: n.body, color: n.color, folder: n.folder, tags: n.tags, x: (n.x ?? 20) + 24, y: (n.y ?? 20) + 24 }); }
    if (x === "share") { await saveNow(); return openShare(); }
    if (x === "del") {
      if (!(await ask({ kind: "danger", title: "DELETE NOTE?", body: n.shareSummary?.mode === "shared" ? "It is deleted for everyone it is shared with." : "", item: n.title || "Untitled", warn: "THIS CANNOT BE UNDONE.", go: "DELETE NOTE" }))) return;
      clearTimeout(saveT); dirty = false;
      try { await api("DELETE", null, `?id=${encodeURIComponent(n.id)}`); await audit("workspace", "NOTE DELETED", n.title); sel = null; load(); } catch (err) { notify("DELETE FAILED: " + err.message, 1); }
    }
  });
  // images: paste / drop into the note
  root.addEventListener("paste", (e) => { if (!e.target.closest?.("#nvB")) return; const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); addImage(f); } });
  root.addEventListener("dragover", (e) => { if (e.target.closest?.("#nvDrop,#nvB") && [...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); document.getElementById("nvDrop")?.classList.add("over"); } });
  root.addEventListener("dragleave", () => document.getElementById("nvDrop")?.classList.remove("over"));
  root.addEventListener("drop", (e) => { if (!e.target.closest?.("#nvDrop,#nvB")) return; const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); document.getElementById("nvDrop")?.classList.remove("over"); addImage(f); } });
  // drag notes on the board (title bar or ⠿⠿). Your own layout — saved just for you.
  let dr = null;
  root.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".nv-n h4"); if (!g || view !== "board" || e.button !== 0) return;
    const el = g.closest(".nv-n"), n = D.notes.find((x) => x.id === el.dataset.id), b = document.getElementById("nvBoard");
    dr = { n, el, b, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", (e) => {
    if (!dr) return;
    const dx = e.clientX - dr.sx, dy = e.clientY - dr.sy;
    if (!dr.moved && Math.hypot(dx, dy) < 4) return;
    dr.moved = true; dr.el.classList.add("drag");
    const x = Math.max(0, Math.min(dr.b.scrollWidth - 216, dr.ox + dx)), y = Math.max(0, dr.oy + dy);
    dr.el.style.left = x + "px"; dr.el.style.top = y + "px"; dr.x = x; dr.y = y;
  });
  root.addEventListener("pointerup", async () => {
    if (!dr) return;
    const d = dr; dr = null;
    d.el.classList.remove("drag");
    if (!d.moved) return;
    d.n.x = Math.round(d.x); d.n.y = Math.round(d.y);
    try { await api("PATCH", { id: d.n.id, x: d.n.x, y: d.n.y }); } catch (err) { notify("POSITION NOT SAVED: " + err.message, 1); }
  });
});
