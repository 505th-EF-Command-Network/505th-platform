/**
 * AFTER ACTION REPORTS v3 (approved mock 2026-11-11) — replaces #panel-aar.
 * Archive: split view (list left, full report right), filters, drafts.
 * Writing: one page with 6 sections (✓ when filled), auto-saved as a DRAFT in `aars` (status "draft",
 * never shown publicly), PUBLISH when ready. Objectives are a tick list. "Fill from event" uses the Attendance Tracker.
 * Saves the same `aars` fields as the original form (+ objectives, status, updatedAt). Publishing writes the
 * Audit Log and asks Cortana to post the report in Discord (Cortana Setup → Logs → AAR posts).
 * The original hidden form + window.submitAAR are no longer used.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, db, esc, getMe, mountPanel, notify, onReady, toDate, ukDate, uploadImage } from "./_common.js";
import { ask, tell } from "./_common.js";
import { cortanaJob } from "./discord-common.js";

const ROOT = "aarV2";
const UNITS = { alpha: ["Alpha Company", "/images/logos/Alpha Company.png"], forcerecon: ["JTF-23 Force Recon", "/images/logos/Stalker_Patch.png"], corpsman: ["Hospital Corpsman", "/images/logos/Hospital_Corpsman.png"], airwing: ["54th Air Wing", "/images/logos/54th Air Wing.png"], combined: ["Combined Arms", "/images/logo.png"] };
const RES = { success: ["MISSION SUCCESS", "#22e07a", "✓"], partial: ["PARTIAL SUCCESS", "#f5c518", "◐"], failure: ["MISSION FAILURE", "#ff4d4d", "✕"] };
const OPS = { main_op: "Main Op", patrol: "Patrol", deployment: "Deployment", fun_op: "Fun Op" };
const CLS = ["CL-5", "CL-4", "CL-3", "CL-2", "CL-1"];
const ATT2OP = { main_op: "main_op", patrol: "patrol", training: "deployment", fun_op: "fun_op" };
const SECTIONS = [
  ["BRIEFING", ["title", "date", "opType", "unit", "commander"]],
  ["MISSION PLAN", ["mainObjective"]],
  ["WHAT HAPPENED", ["actualExecution"]],
  ["ENEMY", ["enemyFaction"]],
  ["DEBRIEF", ["result", "objectiveOutcome"]],
  ["ATTACHMENTS", []],
];
const REQUIRED = { title: "Operation name", date: "Date", opType: "Op type", unit: "Unit", commander: "Commander", actualExecution: "Actual execution", result: "Result" };
const TEXT = ["title", "opType", "commander", "filedBy", "author", "location", "classification", "mainObjective", "commanderIntent", "objectiveStandards", "plannedExecution", "unitsInvolved", "enemyFaction", "enemyCasualties", "enemyTactics", "enemyDisposition", "successfulManeuvers", "mistakes", "unexpected", "objectiveOutcome", "lessonsLearned", "recommended", "miscComments", "result", "unit"];

let reports = [], attEvents = null;
let fType = "", fUnit = "", fDrafts = false, q = "", sel = null;
let w = null; // writer: { id, status, sec, v:{...}, objectives:[{text,done}], files:[url], dirty, saving, savedAt }
let me = null, timer = null;

const dateOf = (a) => toDate(a.date) || (a.submittedAt ? new Date(a.submittedAt) : null);
const isDraft = (a) => a.status === "draft";
const filled = (v) => v != null && String(v).trim() !== "";
const ymd = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "");

async function load() {
  if (!me) me = await getMe().catch(() => null);
  const s = await getDocs(collection(db, "aars"));
  reports = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (dateOf(b)?.getTime() || 0) - (dateOf(a)?.getTime() || 0));
  if (!w) render();
}

function bodyOf(root) {
  let b = root.querySelector(".body");
  if (!b) { b = document.createElement("div"); b.className = "body"; root.appendChild(b); }
  return b;
}

/* ───────── archive ───────── */
function visible() {
  return reports.filter((a) => (fDrafts ? isDraft(a) : !isDraft(a)) && (!fType || a.operationType === fType) && (!fUnit || a.unit === fUnit) && String(a.title || "").toLowerCase().includes(q.toLowerCase()));
}
function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const list = visible();
  if (!list.some((a) => a.id === sel)) sel = list[0]?.id || null;
  const pub = reports.filter((a) => !isDraft(a)), drafts = reports.filter(isDraft);
  const chip = (attr, val, cur, label, n) => `<button type="button" class="chip ${cur === val ? "on" : ""}" data-${attr}="${val}" aria-pressed="${cur === val}">${label}${n != null ? ` <span>${n}</span>` : ""}</button>`;
  bodyOf(root).innerHTML = `
    <div class="bar"><div class="h1">AFTER ACTION REPORTS</div><span class="sp"></span><input class="in" data-q placeholder="Search…" value="${esc(q)}" aria-label="Search reports"><button type="button" class="b gold" data-act="new">＋ NEW AAR</button></div>
    <div class="bar">${chip("t", "", fType, "ALL", pub.length)}${Object.entries(OPS).map(([k, l]) => chip("t", k, fType, l.toUpperCase())).join("")}
      <span class="lab">UNIT</span>${chip("u", "", fUnit, "ALL")}${Object.entries(UNITS).map(([k, [l]]) => chip("u", k, fUnit, l.split(" ")[0].toUpperCase())).join("")}
      <button type="button" class="chip ${fDrafts ? "on" : ""}" data-drafts aria-pressed="${fDrafts}">DRAFTS <span>${drafts.length}</span></button></div>
    <div class="split"><div class="list" role="listbox" aria-label="Reports">${list.map(rowHtml).join("") || `<div class="empty">${fDrafts ? "NO DRAFTS" : "NO REPORTS MATCH"}</div>`}</div>
    <div class="read">${sel ? readHtml(reports.find((a) => a.id === sel)) : '<div class="empty">PICK A REPORT</div>'}</div></div>`;
}
function rowHtml(a) {
  const r = RES[a.result];
  const sub = isDraft(a) ? `DRAFT · saved ${a.updatedAt ? ukDate(a.updatedAt) : "—"}${a.submittedByName ? " by " + esc(a.submittedByName) : ""}` : `${dateOf(a) ? esc(ukDate(dateOf(a)).toUpperCase()) : "—"} · ${esc((OPS[a.operationType] || "—").toUpperCase())} · ${esc(((UNITS[a.unit] || ["—"])[0]).split(" ")[0].toUpperCase())}${r ? ` · ${r[2]} ${r[0].split(" ").pop()}` : ""}`;
  return `<button type="button" role="option" aria-selected="${a.id === sel}" class="it ${a.id === sel ? "on" : ""}" data-sel="${a.id}" style="--rc:${isDraft(a) ? "#7d8a99" : r?.[1] || "#7d8a99"}"><b>${esc(a.title || "Untitled")}</b><small>${sub}</small></button>`;
}
function readHtml(a) {
  if (!a) return "";
  const r = RES[a.result] || ["—", "#7d8a99", ""];
  const objs = Array.isArray(a.objectives) ? a.objectives : [];
  const sec = (t, rows) => { const x = rows.filter(([, v]) => filled(v)); return x.length ? `<h4>${t}</h4>${x.map(([k, v]) => `<div class="rf"><span>${k}</span><p>${esc(v)}</p></div>`).join("")}` : ""; };
  return `<div class="tags"><span style="color:#00D9FF">${esc((OPS[a.operationType] || "—").toUpperCase())}</span><span style="color:${r[1]}">${r[2]} ${r[0]}</span><span style="color:#7d8a99">${esc(a.classification || "CL-5")}</span>${isDraft(a) ? '<span style="color:#ffd166">DRAFT — NOT PUBLISHED</span>' : ""}</div>
    <h2>${esc(a.title || "Untitled")}</h2>
    <div class="k">${dateOf(a) ? esc(ukDate(dateOf(a)).toUpperCase()) : "—"} · ${esc(((UNITS[a.unit] || ["—"])[0]).toUpperCase())}${a.commander ? " · CO: " + esc(a.commander) : ""}${a.filedBy ? " · FILED BY " + esc(a.filedBy) : ""}${a.location ? " · 📍 " + esc(a.location) : ""}</div>
    <div class="stats"><div><b>${esc(a.personnel ?? "—")}</b><span>DEPLOYED</span></div><div><b>${esc(a.casualties ?? 0)}</b><span>FRIENDLY CAS</span></div><div><b>${esc(a.enemyCasualties || "—")}</b><span>ENEMY CAS</span></div><div><b>${objs.length ? `${objs.filter((o) => o.done).length}/${objs.length}` : "—"}</b><span>OBJECTIVES</span></div></div>
    ${objs.length ? `<h4>OBJECTIVES</h4><ul class="objs">${objs.map((o) => `<li style="color:${o.done ? "#22e07a" : "#7d8a99"}">${o.done ? "✓" : "○"} ${esc(o.text)}</li>`).join("")}</ul>` : ""}
    ${sec("MISSION PLAN", [["MAIN OBJECTIVE", a.mainObjective], ["COMMANDER'S INTENT", a.commanderIntent], ["STANDARDS", a.objectiveStandards], ["PLANNED EXECUTION", a.plannedExecution]])}
    ${sec("WHAT HAPPENED", [["ACTUAL EXECUTION", a.summary], ["UNITS INVOLVED", a.unitsInvolved], ["SUCCESSFUL MANOEUVRES", a.successfulManeuvers], ["MISTAKES", a.mistakes], ["UNEXPECTED", a.unexpected]])}
    ${sec("ENEMY", [["FACTION", a.enemyFaction], ["DISPOSITION", a.enemyDisposition], ["TACTICS", a.enemyTactics]])}
    ${sec("DEBRIEF", [["OUTCOME", a.objectiveOutcome], ["LESSONS LEARNED", a.lessonsLearned], ["RECOMMENDED", a.recommended], ["OTHER COMMENTS", a.miscComments]])}
    ${a.attachments?.length ? `<h4>IMAGES</h4><div class="rimg">${a.attachments.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}
    <div class="k" style="margin-top:14px">SUBMITTED BY ${esc(a.submittedByName || "—")}${a.submittedAt ? " · " + esc(ukDate(a.submittedAt)) : ""}${a.updatedByName ? " · LAST EDIT " + esc(a.updatedByName) : ""}</div>
    <div class="bar" style="margin-top:14px"><span class="sp"></span><button type="button" class="b sm" data-act="edit">✎ ${isDraft(a) ? "CONTINUE DRAFT" : "EDIT"}</button>${isDraft(a) ? "" : '<a class="b sm" href="/resources-aar" target="_blank" rel="noopener">↗ PUBLIC PAGE</a>'}<button type="button" class="b sm red" data-act="del">🗑 DELETE</button></div>`;
}

/* ───────── writer ───────── */
function blank() {
  return { title: "", date: ymd(new Date()), opType: "", unit: "", commander: "", filedBy: me?.callsign || me?.name || "", author: me?.callsign || me?.name || "", location: "", classification: "CL-5", personnel: "", casualties: "", unitsInvolved: "", mainObjective: "", commanderIntent: "", objectiveStandards: "", plannedExecution: "", actualExecution: "", successfulManeuvers: "", mistakes: "", unexpected: "", enemyFaction: "", enemyCasualties: "", enemyTactics: "", enemyDisposition: "", result: "", objectiveOutcome: "", lessonsLearned: "", recommended: "", miscComments: "" };
}
function openWriter(a) {
  const v = blank();
  if (a) { for (const k of TEXT) if (a[k] != null) v[k] = String(a[k]); v.actualExecution = a.summary || ""; v.date = ymd(dateOf(a)) || v.date; v.opType = a.operationType || ""; v.personnel = a.personnel ?? ""; v.casualties = a.casualties ?? ""; }
  w = { id: a?.id || null, status: a ? a.status || "published" : "draft", sec: 0, v, objectives: Array.isArray(a?.objectives) ? a.objectives.map((o) => ({ text: String(o.text || ""), done: !!o.done })) : [], files: Array.isArray(a?.attachments) ? [...a.attachments] : [], dirty: false, savedAt: a?.updatedAt || null };
  drawWriter();
}
const secDone = (i) => (i === 5 ? w.files.length > 0 : i === 1 ? filled(w.v.mainObjective) || w.objectives.length > 0 : SECTIONS[i][1].every((k) => filled(w.v[k])));
const F = (k, label, type = "text", extra = "") => `<div><label for="aw_${k}">${label}${REQUIRED[k] ? ' <i class="req">*</i>' : ""}</label>${type === "area" ? `<textarea class="in" id="aw_${k}" data-k="${k}" ${extra}>${esc(w.v[k])}</textarea>` : `<input class="in" id="aw_${k}" data-k="${k}" type="${type}" value="${esc(w.v[k])}" ${extra}>`}</div>`;
const S = (k, label, opts) => `<div><label for="aw_${k}">${label}${REQUIRED[k] ? ' <i class="req">*</i>' : ""}</label><select class="in" id="aw_${k}" data-k="${k}"><option value="">— pick —</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${w.v[k] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
function secHtml(i) {
  if (i === 0) return `<div class="bar"><span class="sp"></span>${attEvents && attEvents.length ? `<select class="in" id="aw_ev" style="max-width:380px" aria-label="Fill from attendance event"><option value="">⇩ FILL FROM ATTENDANCE EVENT…</option>${attEvents.map((e) => `<option value="${esc(e.id)}">${esc(String(e.date || "").slice(0, 10))} · ${esc(e.title || "Untitled")} · ${(e.attendees || []).length} present</option>`).join("")}</select>` : '<button type="button" class="b sm" data-act="fromev">⇩ FILL FROM ATTENDANCE EVENT</button>'}</div>
    <div class="g3">${F("title", "OPERATION NAME", "text", 'maxlength="120"')}${F("date", "DATE", "date")}${S("opType", "OP TYPE", Object.entries(OPS))}
    ${S("unit", "UNIT", Object.entries(UNITS).map(([k, [l]]) => [k, l]))}${F("commander", "COMMANDER", "text", 'maxlength="80"')}${F("filedBy", "FILED BY", "text", 'maxlength="80"')}
    ${F("location", "LOCATION", "text", 'maxlength="100"')}${F("unitsInvolved", "UNITS INVOLVED", "text", 'maxlength="200"')}${S("classification", "CLASSIFICATION", CLS.map((c) => [c, c]))}
    ${F("personnel", "DEPLOYED", "number", 'min="0" max="500"')}${F("casualties", "FRIENDLY CASUALTIES", "number", 'min="0" max="500"')}${F("author", "AUTHOR (SHOWN PUBLICLY)", "text", 'maxlength="80"')}</div>`;
  if (i === 1) return `<div class="g2">${F("commanderIntent", "COMMANDER'S INTENT", "area")}${F("mainObjective", "MAIN OBJECTIVE", "area")}
    <div><label>OBJECTIVES — TICK WHEN COMPLETED</label><ul class="oed">${w.objectives.map((o, n) => `<li><label class="ck"><input type="checkbox" data-od="${n}" ${o.done ? "checked" : ""}> ${esc(o.text)}</label><button type="button" class="x" data-orm="${n}" aria-label="Remove objective">✕</button></li>`).join("")}
      <li><input class="in" id="aw_obj" placeholder="＋ Add objective… (Enter)" maxlength="120" aria-label="Add objective"></li></ul></div>
    <div>${F("objectiveStandards", "STANDARDS / SUCCESS CRITERIA", "area")}${F("plannedExecution", "PLANNED EXECUTION", "area")}</div></div>`;
  if (i === 2) return `<div class="g2">${F("actualExecution", "ACTUAL EXECUTION (SUMMARY ON THE PUBLIC CARD)", "area", 'style="height:120px"')}${F("successfulManeuvers", "SUCCESSFUL MANOEUVRES", "area", 'style="height:120px"')}${F("mistakes", "MISTAKES", "area")}${F("unexpected", "UNEXPECTED EVENTS", "area")}</div>`;
  if (i === 3) return `<div class="g2">${F("enemyFaction", "ENEMY FACTION", "text", 'maxlength="80"')}${F("enemyCasualties", "ENEMY CASUALTIES", "text", 'maxlength="40"')}${F("enemyDisposition", "ENEMY DISPOSITION", "area")}${F("enemyTactics", "ENEMY TACTICS", "area")}</div>`;
  if (i === 4) return `<label>RESULT <i class="req">*</i></label><div class="bar" role="radiogroup" aria-label="Result">${Object.entries(RES).map(([k, [l, c, s]]) => `<button type="button" role="radio" aria-checked="${w.v.result === k}" class="chip ${w.v.result === k ? "on" : ""}" data-res="${k}" style="${w.v.result === k ? `color:${c};border-color:${c}` : ""}">${s} ${l}</button>`).join("")}</div>
    <div class="g2">${F("objectiveOutcome", "OUTCOME", "area")}${F("lessonsLearned", "LESSONS LEARNED", "area")}${F("recommended", "RECOMMENDED CHANGES", "area")}${F("miscComments", "OTHER COMMENTS", "area")}</div>`;
  const miss = Object.keys(REQUIRED).filter((k) => !filled(w.v[k]));
  return `<label class="drop" for="aw_files">⇪ CLICK TO UPLOAD SCREENSHOTS · first image = cover on the public card<input type="file" id="aw_files" accept="image/*" multiple hidden></label>
    <div class="bar" style="margin-top:10px">${w.files.map((u, n) => `<span class="chip"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">🖼 ${n === 0 ? "COVER" : "IMAGE " + (n + 1)}</a> <button type="button" class="x" data-frm="${n}" aria-label="Remove image">✕</button></span>`).join("") || '<span class="k">NO IMAGES YET (OPTIONAL)</span>'}</div>
    <div class="chk"><b>READY TO PUBLISH?</b><ul class="objs">${Object.entries(REQUIRED).map(([k, l]) => `<li style="color:${filled(w.v[k]) ? "#22e07a" : "#f59e0b"}">${filled(w.v[k]) ? "✓" : "○"} ${l}</li>`).join("")}<li style="color:#7d8a99">${w.objectives.length ? `✓ ${w.objectives.filter((o) => o.done).length} of ${w.objectives.length} objectives ticked` : "○ No objectives (optional)"}</li></ul>
    <div class="k">${miss.length ? "Fill the ○ items to publish." : "Publishing shows it on the public AAR page and Cortana posts it in Discord."}</div></div>`;
}
function drawWriter(focusId) {
  const root = document.getElementById(ROOT);
  if (!root || !w) return;
  const y = root.querySelector(".wsec")?.scrollTop || 0;
  bodyOf(root).innerHTML = `
    <div class="bar"><div class="h1">${w.id && w.status !== "draft" ? "EDIT AAR" : "NEW AAR"}</div><span class="saved" role="status">${w.saving ? "◷ SAVING…" : w.dirty ? "● UNSAVED" : w.savedAt ? "● " + (w.status === "draft" ? "DRAFT" : "") + " SAVED " + esc(new Date(w.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })) : ""}</span>
      <span class="sp"></span><button type="button" class="b" data-act="back">← BACK</button>${w.status === "draft" ? '<button type="button" class="b" data-act="save">SAVE DRAFT</button><button type="button" class="b gold" data-act="publish">PUBLISH</button>' : '<button type="button" class="b gold" data-act="save">SAVE CHANGES</button>'}</div>
    <div class="form"><nav class="nav" aria-label="Sections">${SECTIONS.map(([t], i) => `<button type="button" data-sec="${i}" class="${w.sec === i ? "on" : ""} ${secDone(i) ? "ok" : ""}" aria-current="${w.sec === i ? "step" : "false"}">${t}</button>`).join("")}</nav>
    <div><div class="card wsec"><b class="st">${SECTIONS[w.sec][0]}</b><div style="margin-top:10px">${secHtml(w.sec)}</div></div>
    <div class="bar"><span class="sp"></span>${w.sec > 0 ? '<button type="button" class="b" data-sec-step="-1">← PREVIOUS</button>' : ""}${w.sec < 5 ? '<button type="button" class="b" data-sec-step="1">NEXT →</button>' : ""}</div></div></div>`;
  const sc = root.querySelector(".wsec"); if (sc) sc.scrollTop = y;
  if (focusId) document.getElementById(focusId)?.focus();
}
function touch() {
  w.dirty = true;
  const s = document.querySelector(`#${ROOT} .saved`); if (s) s.textContent = "● UNSAVED";
  document.querySelectorAll(`#${ROOT} .nav [data-sec]`).forEach((b) => b.classList.toggle("ok", secDone(+b.dataset.sec)));
  clearTimeout(timer);
  if (w.status === "draft") timer = setTimeout(() => save(false, true), 2500); // drafts save by themselves
}
function payload() {
  const v = w.v, d = v.date ? new Date(v.date + "T12:00:00") : new Date();
  const out = {};
  for (const k of TEXT) out[k] = String(v[k] ?? "").trim();
  delete out.opType;
  return { ...out, operationType: v.opType, summary: String(v.actualExecution || "").trim(), personnel: v.personnel === "" ? null : Math.max(0, parseInt(v.personnel, 10) || 0), casualties: Math.max(0, parseInt(v.casualties, 10) || 0),
    classification: v.classification || "CL-5", objectives: w.objectives.slice(0, 20), attachments: w.files.slice(0, 10), date: d, updatedAt: new Date().toISOString(), updatedByName: me?.callsign || me?.name || "Staff" };
}
async function save(publish = false, quiet = false) {
  if (!w || w.saving) return;
  if (publish) {
    const miss = Object.entries(REQUIRED).filter(([k]) => !filled(w.v[k])).map(([, l]) => l);
    if (miss.length) { w.sec = 5; drawWriter(); return tell("NOT READY TO PUBLISH", "Fill: " + miss.join(", "), "warn"); }
  } else if (!filled(w.v.title)) { if (!quiet) notify("ADD AN OPERATION NAME FIRST", 1); return; }
  w.saving = true;
  const p = payload();
  const wasNew = !w.id;
  try {
    if (publish || w.status !== "draft") Object.assign(p, { status: "published" });
    else p.status = "draft";
    if (publish && w.status === "draft") Object.assign(p, { submittedBy: me?.uid || "", submittedByName: me?.callsign || me?.name || "Staff", submittedAt: new Date().toISOString() });
    if (wasNew) { if (!publish) Object.assign(p, { submittedBy: me?.uid || "", submittedByName: me?.callsign || me?.name || "Staff" }); const ref = await addDoc(collection(db, "aars"), p); w.id = ref.id; }
    else await updateDoc(doc(db, "aars", w.id), p);
    w.dirty = false; w.saving = false; w.savedAt = p.updatedAt;
    if (publish && w.status === "draft") {
      w.status = "published";
      await audit("operations", "AAR PUBLISHED", `${p.title} (${OPS[p.operationType] || p.operationType}) — ${(UNITS[p.unit] || [p.unit])[0]} — ${(RES[p.result] || [p.result])[0]}`).catch(() => {});
      cortanaJob("aar.post", { aarId: w.id }, { wait: false }).catch(() => {});
      notify("✓ AAR PUBLISHED");
      sel = w.id; w = null; fDrafts = false;
      return load();
    }
    if (!quiet) { notify(w.status === "draft" ? "✓ DRAFT SAVED" : "✓ CHANGES SAVED"); if (w.status !== "draft") audit("operations", "AAR EDITED", p.title).catch(() => {}); }
    const s = document.querySelector(`#${ROOT} .saved`); if (s) s.textContent = `● ${w.status === "draft" ? "DRAFT " : ""}SAVED ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (e) {
    w.saving = false;
    notify("SAVE FAILED: " + e.message, 1);
  }
}
async function fromEvent(id) {
  if (!attEvents) {
    attEvents = (await getDocs(collection(db, "attendance_events")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 25) || [];
    if (!attEvents.length) return tell("NO EVENTS", "There are no Attendance Tracker events yet.", "info");
    drawWriter("aw_ev");
    return;
  }
  const e = attEvents.find((x) => x.id === id);
  if (!e) return;
  w.v.title = e.title || w.v.title;
  w.v.date = String(e.date || "").slice(0, 10) || w.v.date;
  if (ATT2OP[e.type]) w.v.opType = ATT2OP[e.type];
  w.v.personnel = String((e.attendees || []).length);
  drawWriter(); touch();
  notify("✓ FILLED FROM " + String(e.title || "EVENT").toUpperCase());
}
async function addFiles(files) {
  for (const f of [...files].slice(0, 10 - w.files.length)) {
    if (!/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) { notify(`SKIPPED ${f.name} (IMAGES UP TO 10 MB)`, 1); continue; }
    try { const r = await uploadImage(f, "505th_aar"); w.files.push(r.secure_url); drawWriter(); touch(); }
    catch (e) { notify("UPLOAD FAILED: " + e.message, 1); }
  }
}
async function leaveWriter() {
  if (w?.dirty && w.status !== "draft" && !(await ask({ kind: "warn", title: "LEAVE WITHOUT SAVING?", body: "Your changes to this report are not saved.", go: "LEAVE", cancel: "STAY" }))) return;
  if (w?.dirty && w.status === "draft") await save(false, true);
  clearTimeout(timer); w = null; load();
}

const CSS = `
#${ROOT} .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}#${ROOT} .sp{flex:1}
#${ROOT} .h1{font:700 20px Rajdhani,sans-serif;letter-spacing:4px;color:#00D9FF}
#${ROOT} .lab{font:10px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;margin-left:8px}
#${ROOT} .in{height:34px;background:#060a0e;border:1px solid rgba(0,217,255,.3);color:#fff;padding:0 10px;font:13px "Share Tech Mono",monospace;width:100%}#${ROOT} .bar>.in{max-width:220px}
#${ROOT} textarea.in{height:76px;padding:8px 10px;resize:vertical;line-height:1.5}#${ROOT} .in:focus{outline:none;border-color:#00D9FF;box-shadow:0 0 8px rgba(0,217,255,.35)}
#${ROOT} label{display:block;font:9.5px "Share Tech Mono",monospace;letter-spacing:2px;color:#7d8a99;margin:0 0 4px}#${ROOT} .req{color:#ffd166;font-style:normal}
#${ROOT} .chip{all:unset;cursor:pointer;padding:5px 10px;border:1px solid rgba(0,217,255,.18);font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}#${ROOT} .chip.on{color:#fff;border-color:#00D9FF;background:rgba(0,217,255,.1)}#${ROOT} .chip span{opacity:.7}
#${ROOT} .chip:focus-visible,#${ROOT} .it:focus-visible,#${ROOT} .nav button:focus-visible,#${ROOT} .x:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
#${ROOT} .split{display:grid;grid-template-columns:330px minmax(0,1fr);gap:14px;min-height:540px}
#${ROOT} .list{background:#0b0f15;border:1px solid rgba(0,217,255,.18);max-height:calc(100vh - 260px);overflow:auto}
#${ROOT} .it{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;padding:10px 12px;border-bottom:1px solid rgba(0,217,255,.07);border-left:3px solid var(--rc)}#${ROOT} .it.on{background:rgba(0,217,255,.07)}#${ROOT} .it b{display:block;color:#fff;font:700 14px Rajdhani,sans-serif;letter-spacing:.5px}#${ROOT} .it small{color:#7d8a99;font:10.5px "Share Tech Mono",monospace}
#${ROOT} .read{background:#0b0f15;border:1px solid rgba(0,217,255,.18);padding:18px;min-width:0;max-height:calc(100vh - 260px);overflow:auto}
#${ROOT} .read h2{margin:6px 0 2px;color:#fff;font:700 24px Rajdhani,sans-serif;letter-spacing:2px}#${ROOT} .read h4{margin:16px 0 6px;font:10.5px "Share Tech Mono",monospace;letter-spacing:2.5px;color:#00D9FF}
#${ROOT} .tags span{display:inline-block;margin:0 6px 4px 0;padding:2px 8px;border:1px solid currentColor;font:10px "Share Tech Mono",monospace;letter-spacing:1.5px}
#${ROOT} .k{font:10.5px "Share Tech Mono",monospace;letter-spacing:1px;color:#7d8a99}
#${ROOT} .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}#${ROOT} .stats div{border:1px solid rgba(0,217,255,.18);padding:8px;text-align:center}#${ROOT} .stats b{display:block;color:#fff;font:700 18px "Share Tech Mono",monospace}#${ROOT} .stats span{font:9px "Share Tech Mono",monospace;letter-spacing:1.5px;color:#7d8a99}
#${ROOT} .rf{margin:0 0 8px}#${ROOT} .rf span{font:9.5px "Share Tech Mono",monospace;letter-spacing:1.5px;color:#7d8a99}#${ROOT} .rf p{margin:2px 0 0;color:#c6d0da;white-space:pre-wrap}
#${ROOT} .objs{list-style:none;margin:0;padding:0}#${ROOT} .objs li{margin:3px 0}
#${ROOT} .rimg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}#${ROOT} .rimg img{width:100%;aspect-ratio:16/10;object-fit:cover;border:1px solid rgba(0,217,255,.18)}
#${ROOT} .b.red{border-color:#ff4d4d;color:#ff4d4d}#${ROOT} a.b{text-decoration:none}
#${ROOT} .saved{color:#22e07a;font:11px "Share Tech Mono",monospace;letter-spacing:1px}
#${ROOT} .form{display:grid;grid-template-columns:180px minmax(0,1fr);gap:14px}
#${ROOT} .nav{background:#0b0f15;border:1px solid rgba(0,217,255,.18);align-self:start;position:sticky;top:10px}#${ROOT} .nav button{all:unset;cursor:pointer;display:block;width:100%;box-sizing:border-box;padding:9px 12px;color:#7d8a99;border-left:2px solid transparent;font:11px "Share Tech Mono",monospace;letter-spacing:1.5px}#${ROOT} .nav button.on{color:#fff;border-left-color:#00D9FF;background:rgba(0,217,255,.06)}#${ROOT} .nav button.ok:after{content:" ✓";color:#22e07a}
#${ROOT} .card{background:#0b0f15;border:1px solid rgba(0,217,255,.18)}#${ROOT} .wsec{padding:16px;margin-bottom:12px}#${ROOT} .st{color:#fff;letter-spacing:2px;font:700 15px Rajdhani,sans-serif}
#${ROOT} .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}#${ROOT} .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 14px}
#${ROOT} .oed{list-style:none;margin:0;padding:8px 10px;border:1px solid rgba(0,217,255,.18)}#${ROOT} .oed li{display:flex;align-items:center;gap:8px;margin:4px 0}#${ROOT} .oed .ck{flex:1;display:flex;gap:8px;align-items:center;font:12px "Share Tech Mono",monospace;letter-spacing:0;color:#d6dde6;margin:0}
#${ROOT} .x{all:unset;cursor:pointer;color:#7d8a99;padding:0 6px}#${ROOT} .x:hover{color:#ff4d4d}
#${ROOT} .drop{display:block;border:1px dashed rgba(0,217,255,.4);padding:22px;text-align:center;color:#7d8a99;cursor:pointer;font-size:11px}#${ROOT} .drop:hover{border-color:#00D9FF;color:#fff}
#${ROOT} .chk{border:1px solid rgba(0,217,255,.18);padding:12px;margin-top:12px}#${ROOT} .chk b{color:#fff;letter-spacing:1px}
#${ROOT} .empty{padding:30px;text-align:center;color:#7d8a99;font:11px "Share Tech Mono",monospace;letter-spacing:2px}
@media (max-width:900px){#${ROOT} .split,#${ROOT} .form{grid-template-columns:1fr}#${ROOT} .list,#${ROOT} .read{max-height:none}#${ROOT} .g2,#${ROOT} .g3{grid-template-columns:1fr}#${ROOT} .nav{position:static;display:flex;overflow-x:auto}#${ROOT} .nav button{white-space:nowrap;border-left:0;border-bottom:2px solid transparent}#${ROOT} .nav button.on{border-bottom-color:#00D9FF}#${ROOT} .stats{grid-template-columns:repeat(2,1fr)}}
`;

/* ───────── events ───────── */
onReady(() => {
  const root = mountPanel("panel-aar", ROOT, () => load().catch((e) => notify("AAR LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  if (!root.querySelector(".body")) root.innerHTML = '<div class="body"><div class="empty">LOADING…</div></div>';
  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (!w) {
      const it = t.closest("[data-sel]"); if (it) { sel = it.dataset.sel; return render(); }
      const ty = t.closest("[data-t]"); if (ty) { fType = ty.dataset.t; fDrafts = false; return render(); }
      const un = t.closest("[data-u]"); if (un) { fUnit = un.dataset.u; return render(); }
      if (t.closest("[data-drafts]")) { fDrafts = !fDrafts; return render(); }
      const act = t.closest("[data-act]")?.dataset.act;
      if (act === "new") return openWriter(null);
      const a = reports.find((x) => x.id === sel);
      if (act === "edit" && a) return openWriter(a);
      if (act === "del" && a) {
        if (!(await ask({ kind: "danger", title: "DELETE THIS AAR?", body: isDraft(a) ? "The draft is deleted." : "It is removed from the archive and the public AAR page.", item: a.title, warn: "THIS CANNOT BE UNDONE.", go: "DELETE" }))) return;
        try { await deleteDoc(doc(db, "aars", a.id)); await audit("operations", "AAR DELETED", a.title || a.id).catch(() => {}); notify("AAR DELETED"); sel = null; load(); }
        catch (err) { notify("DELETE FAILED: " + err.message, 1); }
      }
      return;
    }
    const sb = t.closest("[data-sec]"); if (sb) { w.sec = +sb.dataset.sec; return drawWriter(); }
    const st = t.closest("[data-sec-step]"); if (st) { w.sec = Math.max(0, Math.min(5, w.sec + +st.dataset.secStep)); return drawWriter(); }
    const rs = t.closest("[data-res]"); if (rs) { w.v.result = rs.dataset.res; drawWriter(); return touch(); }
    const orm = t.closest("[data-orm]"); if (orm) { w.objectives.splice(+orm.dataset.orm, 1); drawWriter("aw_obj"); return touch(); }
    const frm = t.closest("[data-frm]"); if (frm) { w.files.splice(+frm.dataset.frm, 1); drawWriter(); return touch(); }
    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "back") return leaveWriter();
    if (act === "save") return save(false);
    if (act === "publish") return save(true);
    if (act === "fromev") return fromEvent();
  });
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.q != null) { q = t.value; render(); const i = root.querySelector("[data-q]"); i?.focus(); i?.setSelectionRange(q.length, q.length); return; }
    if (w && t.dataset.k) { w.v[t.dataset.k] = t.value; touch(); }
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (!w) return;
    if (t.dataset.od != null) { w.objectives[+t.dataset.od].done = t.checked; return touch(); }
    if (t.id === "aw_files") return addFiles(t.files);
    if (t.id === "aw_ev") return fromEvent(t.value);
    if (t.dataset.k && t.tagName === "SELECT") { w.v[t.dataset.k] = t.value; touch(); }
  });
  root.addEventListener("keydown", (e) => {
    if (w && e.target.id === "aw_obj" && e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v || w.objectives.length >= 20) return;
      w.objectives.push({ text: v.slice(0, 120), done: false });
      drawWriter("aw_obj"); touch();
    }
  });
  window.addEventListener("beforeunload", (e) => { if (w?.dirty && w.status !== "draft") e.preventDefault(); });
});


