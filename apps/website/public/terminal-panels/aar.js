/**
 * AFTER ACTION REPORTS v2 (approved mock 2026-11-09) — replaces #panel-aar.
 * Archive (cards + filters + read view) and a 5-step wizard.
 * The wizard copies its values into the ORIGINAL hidden form fields and calls the
 * original window.submitAAR(), so the saved `aars` document, audit log and
 * Discord webhook are exactly the same as before.
 * Image attachments use signed Cloudinary uploads (folder 505th_aar).
 */
import { collection, getDocs } from "/terminal-shim/firestore.js";
import { addCss, closeModal, db, esc, getMe, mountPanel, notify, onReady, openModal, toDate, ukDate, uploadImage } from "./_common.js";
import { ask, tell } from "./_common.js";

const ROOT = "aarV2";
const UNITS = { alpha: ["Alpha Company", "/images/logos/Alpha Company.png"], forcerecon: ["JTF-23 Force Recon", "/images/logos/Stalker_Patch.png"], corpsman: ["Hospital Corpsman", "/images/logos/Hospital_Corpsman.png"], airwing: ["54th Air Wing", "/images/logos/54th Air Wing.png"], combined: ["Combined Arms", "/images/logo.png"] };
const RES = { success: ["MISSION SUCCESS", "#22e07a"], partial: ["PARTIAL SUCCESS", "#f5c518"], failure: ["MISSION FAILURE", "#ff4d4d"] };
const OPS = { main_op: "Main Op", patrol: "Patrol", deployment: "Deployment", fun_op: "Fun Op" };
const STEPS = [["BRIEFING", "Who, what, when"], ["MISSION PLAN", "Objective & intent"], ["WHAT HAPPENED", "Execution & enemy"], ["DEBRIEF", "Result & lessons"], ["REVIEW", "Check & publish"]];
// wizard field → original element id
const FIELDS = {
  title: "aarTitle", date: "aarDate", opType: "aarOpType", commander: "aarCommander", filedBy: "aarFiledBy", author: "aarAuthor", location: "aarLocation", classification: "aarClassification",
  mainObjective: "aarMainObjective", commanderIntent: "aarCommanderIntent", objectiveStandards: "aarObjectiveStandards", plannedExecution: "aarPlannedExecution",
  actualExecution: "aarActualExecution", unitsInvolved: "aarUnitsInvolved", personnel: "aarPersonnel", casualties: "aarCasualties", enemyFaction: "aarEnemyFaction", enemyCasualties: "aarEnemyCasualties", enemyTactics: "aarEnemyTactics", enemyDisposition: "aarEnemyDisposition",
  successfulManeuvers: "aarSuccessfulManeuvers", mistakes: "aarMistakes", unexpected: "aarUnexpected", objectiveOutcome: "aarObjectiveOutcome", lessonsLearned: "aarLessonsLearned", recommended: "aarRecommended", miscComments: "aarMiscComments",
};
const REQUIRED = { 0: ["unit", "title", "date", "opType", "commander"], 2: ["actualExecution"], 3: ["result"] };
const DRAFT_KEY = "aarV2Draft";

let reports = [];
let fUnit = "", fRes = "", q = "";
let w = null; // wizard state {step, v:{...}, files:[{url,name,st}]}

const dateOf = (a) => toDate(a.date) || (a.submittedAt ? new Date(a.submittedAt) : null);

async function load() {
  const s = await getDocs(collection(db, "aars"));
  reports = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (dateOf(b)?.getTime() || 0) - (dateOf(a)?.getTime() || 0));
  render();
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const list = reports.filter((a) => (!fUnit || a.unit === fUnit) && (!fRes || a.result === fRes) && String(a.title || "").toLowerCase().includes(q.toLowerCase()));
  const draft = readDraft();
  root.querySelector(".body").innerHTML = `
    ${draft ? `<div class="draft">✎ UNFINISHED REPORT: <b>${esc(draft.v.title || "Untitled")}</b> — STEP ${draft.step + 1}/5<span class="sp"></span><button class="b sm" data-act="resume">CONTINUE</button><button class="b sm" data-act="discard">DISCARD</button></div>` : ""}
    <div class="ftr">
      <input class="in" data-f="q" placeholder="SEARCH MISSION NAME..." value="${esc(q)}" aria-label="Search">
      <select class="in" data-f="unit" aria-label="Unit"><option value="">ALL UNITS</option>${Object.entries(UNITS).map(([k, [l]]) => `<option value="${k}" ${fUnit === k ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select>
      <select class="in" data-f="res" aria-label="Result"><option value="">ALL RESULTS</option>${Object.entries(RES).map(([k, [l]]) => `<option value="${k}" ${fRes === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <span class="sp"></span><span class="cnt">${list.length} REPORT${list.length === 1 ? "" : "S"}</span></div>
    <div class="cards">${
      list.length
        ? list
            .map((a) => {
              const [rl, rc] = RES[a.result] || ["—", "#7d8a99"];
              const [ul, logo] = UNITS[a.unit] || ["—", "/images/logo.png"];
              return `<button class="ac" data-open="${a.id}" style="--rc:${rc}"><img src="${encodeURI(logo)}" alt="" class="lg">
                <div class="ai"><div class="at">${esc(a.title || "Untitled")}</div>
                <div class="am">${esc(ul.toUpperCase())} · ${esc((OPS[a.operationType] || a.operationType || "—").toUpperCase())} · ${dateOf(a) ? ukDate(dateOf(a)) : "—"}</div>
                <div class="as">${esc(String(a.summary || "").slice(0, 140))}${String(a.summary || "").length > 140 ? "…" : ""}</div></div>
                <span class="rb">${rl}</span>${a.attachments?.length ? `<span class="ph">▣ ${a.attachments.length}</span>` : ""}</button>`;
            })
            .join("")
        : '<div class="empty">NO REPORTS MATCH</div>'
    }</div>`;
}

function openReport(id) {
  const a = reports.find((x) => x.id === id);
  if (!a) return;
  const [rl, rc] = RES[a.result] || ["—", "#7d8a99"];
  const sec = (t, rows) => {
    const r = rows.filter(([, v]) => v != null && String(v).trim() !== "");
    return r.length ? `<div class="rs"><div class="rh">${t}</div>${r.map(([k, v]) => `<div class="rf"><span>${k}</span><p>${esc(v)}</p></div>`).join("")}</div>` : "";
  };
  openModal(
    `<div class="aarv"><div class="rtop"><img src="${encodeURI((UNITS[a.unit] || [, "/images/logo.png"])[1])}" alt="">
      <div><div class="h1" style="font-size:20px">${esc(a.title || "Untitled")}</div>
      <div class="am">${esc(((UNITS[a.unit] || ["—"])[0]).toUpperCase())} · ${esc((OPS[a.operationType] || "—").toUpperCase())} · ${dateOf(a) ? ukDate(dateOf(a)) : "—"} · ${esc(a.classification || "CL-5")}</div></div>
      <span class="rb" style="--rc:${rc}">${rl}</span></div>
    ${sec("BRIEFING", [["COMMANDING OFFICER", a.commander], ["FILED BY", a.filedBy], ["AUTHOR", a.author], ["LOCATION", a.location]])}
    ${sec("MISSION PLAN", [["MAIN OBJECTIVE", a.mainObjective], ["COMMANDER'S INTENT", a.commanderIntent], ["OBJECTIVE STANDARDS", a.objectiveStandards], ["PLANNED EXECUTION", a.plannedExecution]])}
    ${sec("WHAT HAPPENED", [["ACTUAL EXECUTION", a.summary], ["UNITS INVOLVED", a.unitsInvolved], ["INITIAL STRENGTH", a.personnel], ["FRIENDLY CASUALTIES", a.casualties], ["ENEMY FACTION", a.enemyFaction], ["ENEMY CASUALTIES", a.enemyCasualties], ["ENEMY TACTICS", a.enemyTactics], ["ENEMY DISPOSITION", a.enemyDisposition]])}
    ${sec("DEBRIEF", [["SUCCESSFUL MANEUVERS", a.successfulManeuvers], ["MISTAKES / FAILURES", a.mistakes], ["UNEXPECTED OCCURRENCES", a.unexpected], ["OBJECTIVE OUTCOME", a.objectiveOutcome], ["LESSONS LEARNED", a.lessonsLearned], ["RECOMMENDATIONS", a.recommended], ["OTHER COMMENTS", a.miscComments]])}
    ${a.attachments?.length ? `<div class="rs"><div class="rh">IMAGES</div><div class="rimg">${a.attachments.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div></div>` : ""}
    <div class="am" style="margin-top:12px">SUBMITTED BY ${esc(a.submittedByName || "—")}${a.submittedAt ? " · " + ukDate(a.submittedAt) : ""}</div>
    <div class="wact"><button class="b red" data-x="del">DELETE REPORT</button><span class="sp"></span><button class="b" data-x="close">CLOSE</button></div></div>`,
    { width: 860, color: rc + "88", pad: true },
  );
  document.querySelector(".v2m").addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close") return closeModal();
    if (x === "del") {
      // original deleteAAR: confirm → delete → log → reload its own list
      await window.deleteAAR(id);
      closeModal();
      load();
    }
  });
}

// ── wizard ──────────────────────────────────────────────────────────
const readDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
};
const saveDraft = () => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: w.step, v: w.v, files: w.files.filter((f) => f.st === "ok") }));
  } catch {}
};
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

async function startWizard(fromDraft) {
  const d = fromDraft ? readDraft() : null;
  const me = await getMe().catch(() => null);
  w = d ? { step: d.step, v: d.v, files: d.files || [] } : { step: 0, v: { date: new Date().toISOString().slice(0, 10), classification: "CL-5", filedBy: me?.callsign || "" }, files: [] };
  openModal('<div class="wiz"></div>', { width: 900, pad: true });
  const box = document.querySelector(".v2m");
  box.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) {
      w.v[k] = e.target.value;
      e.target.classList.remove("bad");
      saveDraft();
    }
  });
  box.addEventListener("change", (e) => {
    if (e.target.id === "wF") addFiles(e.target.files);
  });
  box.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const [k, v] = pick.dataset.pick.split(":");
      w.v[k] = v;
      saveDraft();
      return drawWizard();
    }
    const go = e.target.closest("[data-go]");
    if (go) return goto(+go.dataset.go);
    const rm = e.target.closest("[data-rmf]");
    if (rm) {
      w.files.splice(+rm.dataset.rmf, 1);
      saveDraft();
      return drawWizard();
    }
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close") {
      closeModal();
      return render();
    }
    if (x === "next") return goto(w.step + 1);
    if (x === "back") return goto(w.step - 1);
    if (x === "submit") return submit();
  });
  drawWizard();
}

function missing(step) {
  return (REQUIRED[step] || []).filter((k) => !String(w.v[k] || "").trim());
}
function goto(n) {
  if (n > w.step) {
    for (let s = w.step; s < n; s++) {
      const m = missing(s);
      if (m.length) {
        w.step = s;
        drawWizard(m);
        return notify("FILL THE REQUIRED FIELDS (MARKED *)", 1);
      }
    }
  }
  w.step = Math.max(0, Math.min(4, n));
  saveDraft();
  drawWizard();
}

const inp = (k, label, req, ph = "", type = "text") => `<div><label class="lb" for="w_${k}">${label}${req ? " *" : ""}</label><input class="in" id="w_${k}" data-k="${k}" type="${type}" value="${esc(w.v[k] || "")}" placeholder="${esc(ph)}" ${type === "number" ? 'min="0"' : ""}></div>`;
const ta = (k, label, req, ph = "", rows = 3) => `<div class="full"><label class="lb" for="w_${k}">${label}${req ? " *" : ""}</label><textarea class="in" id="w_${k}" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(w.v[k] || "")}</textarea></div>`;

function drawWizard(bad = []) {
  const box = document.querySelector(".v2m .wiz");
  if (!box) return;
  const s = w.step;
  let body = "";
  if (s === 0)
    body = `<label class="lb">UNIT *</label><div class="units">${Object.entries(UNITS).map(([k, [l, logo]]) => `<button class="uo ${w.v.unit === k ? "on" : ""}" data-pick="unit:${k}" aria-pressed="${w.v.unit === k}"><img src="${encodeURI(logo)}" alt="">${l.toUpperCase()}</button>`).join("")}</div>
      <div class="g2">${inp("title", "MISSION NAME", 1, "Operation ...")}${inp("date", "DATE", 1, "", "date")}
      <div><label class="lb" for="w_opType">OPERATION TYPE *</label><select class="in" id="w_opType" data-k="opType"><option value="">— SELECT —</option>${Object.entries(OPS).map(([k, l]) => `<option value="${k}" ${w.v.opType === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      ${inp("commander", "COMMANDING OFFICER", 1)}${inp("filedBy", "FILED BY")}${inp("author", "AUTHOR")}${inp("location", "LOCATION")}
      <div><label class="lb" for="w_classification">CLASSIFICATION</label><select class="in" id="w_classification" data-k="classification">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option ${w.v.classification === "CL-" + n ? "selected" : ""}>CL-${n}</option>`).join("")}</select></div></div>`;
  if (s === 1) body = `<div class="g2">${ta("mainObjective", "MAIN OBJECTIVE")}${ta("commanderIntent", "COMMANDER'S INTENT")}${ta("objectiveStandards", "OBJECTIVE STANDARDS")}${ta("plannedExecution", "PLANNED EXECUTION", 0, "", 4)}</div>`;
  if (s === 2)
    body = `<div class="g2">${ta("actualExecution", "ACTUAL EXECUTION — WHAT HAPPENED", 1, "Step by step, how the operation went", 6)}${inp("unitsInvolved", "UNITS INVOLVED")}<div class="g2 in2">${inp("personnel", "INITIAL STRENGTH", 0, "", "number")}${inp("casualties", "FRIENDLY CASUALTIES", 0, "", "number")}</div>
      ${inp("enemyFaction", "ENEMY FACTION")}${inp("enemyCasualties", "ENEMY CASUALTIES")}${ta("enemyTactics", "ENEMY TACTICS AS OBSERVED")}${ta("enemyDisposition", "ENEMY DISPOSITION")}</div>`;
  if (s === 3)
    body = `<label class="lb">RESULT *</label><div class="res">${Object.entries(RES).map(([k, [l, c]]) => `<button class="ro ${w.v.result === k ? "on" : ""}" style="--rc:${c}" data-pick="result:${k}" aria-pressed="${w.v.result === k}">${l}</button>`).join("")}</div>
      <div class="g2">${ta("successfulManeuvers", "SUCCESSFUL MANEUVERS")}${ta("mistakes", "MISTAKES / FAILURES")}${ta("unexpected", "UNEXPECTED OCCURRENCES")}${ta("objectiveOutcome", "OBJECTIVE OUTCOME")}${ta("lessonsLearned", "LESSONS LEARNED")}${ta("recommended", "OPERATIONAL FOLLOW-UP / RECOMMENDATIONS")}${ta("miscComments", "OTHER COMMENTS")}</div>
      <label class="lb">IMAGES (OPTIONAL)</label><label class="drop" tabindex="0">⇪ ADD SCREENSHOTS<input type="file" id="wF" accept="image/*" multiple hidden></label>
      <div class="fl">${w.files.map((f, i) => `<div class="fi ${f.st}">${f.url ? `<img src="${esc(f.url)}" alt="">` : '<div class="ph2"></div>'}<span>${f.st === "up" ? f.pct + "%" : f.st === "err" ? "FAILED" : "✓"}</span><button class="b sm" data-rmf="${i}" aria-label="Remove">✕</button></div>`).join("")}</div>`;
  if (s === 4) {
    const v = w.v, [rl, rc] = RES[v.result] || ["—", "#7d8a99"];
    const filled = Object.keys(FIELDS).filter((k) => String(v[k] || "").trim()).length;
    body = `<div class="rev"><div class="rtop"><img src="${encodeURI((UNITS[v.unit] || [, "/images/logo.png"])[1])}" alt=""><div><div class="h1" style="font-size:20px">${esc(v.title || "Untitled")}</div>
      <div class="am">${esc(((UNITS[v.unit] || ["—"])[0]).toUpperCase())} · ${esc((OPS[v.opType] || "—").toUpperCase())} · ${v.date ? ukDate(v.date) : "—"} · ${esc(v.classification)} · CO ${esc(v.commander || "—")}</div></div><span class="rb" style="--rc:${rc}">${rl}</span></div>
      <div class="rs"><div class="rh">ACTUAL EXECUTION</div><p>${esc(v.actualExecution || "—")}</p></div>
      ${v.lessonsLearned ? `<div class="rs"><div class="rh">LESSONS LEARNED</div><p>${esc(v.lessonsLearned)}</p></div>` : ""}
      <div class="am">${filled}/${Object.keys(FIELDS).length} FIELDS FILLED · ${w.files.filter((f) => f.st === "ok").length} IMAGE(S) · PUBLISHING POSTS TO DISCORD</div></div>`;
  }
  box.innerHTML = `
    <div class="steps">${STEPS.map(([t, sub], i) => `<button class="st ${i === s ? "on" : i < s ? "done" : ""}" data-go="${i}" ${i === s ? 'aria-current="step"' : ""}><b>${i < s ? "✓" : i + 1}</b><span>${t}<small>${sub}</small></span></button>`).join("")}</div>
    <div class="h1" style="font-size:17px;margin-top:14px">${s + 1} · ${STEPS[s][0]}</div>
    <div class="wb">${body}</div>
    <div class="wact"><button class="b" data-x="close">SAVE & CLOSE</button><span class="sp"></span>
      ${s > 0 ? '<button class="b" data-x="back">◂ BACK</button>' : ""}
      ${s < 4 ? '<button class="b gold" data-x="next">NEXT ▸</button>' : '<button class="b gold" data-x="submit" id="wSubmit">PUBLISH REPORT</button>'}</div>`;
  for (const k of bad) box.querySelector(`[data-k="${k}"]`)?.classList.add("bad");
  if (bad.includes("unit")) box.querySelector(".units")?.classList.add("bad");
  if (bad.includes("result")) box.querySelector(".res")?.classList.add("bad");
}

async function addFiles(list) {
  for (const file of list) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      notify(`${file.name}: IMAGES UP TO 10 MB ONLY`, 1);
      continue;
    }
    const f = { st: "up", pct: 0, url: "" };
    w.files.push(f);
    drawWizard();
    try {
      const r = await uploadImage(file, "505th_aar", (p) => {
        f.pct = p;
        drawWizard();
      });
      f.url = r.secure_url;
      f.st = "ok";
    } catch (e) {
      f.st = "err";
      notify("UPLOAD FAILED: " + e.message, 1);
    }
    saveDraft();
    drawWizard();
  }
}

async function submit() {
  for (let s = 0; s < 4; s++) {
    const m = missing(s);
    if (m.length) {
      w.step = s;
      drawWizard(m);
      return notify("FILL THE REQUIRED FIELDS (MARKED *)", 1);
    }
  }
  if (w.files.some((f) => f.st === "up")) return notify("WAIT FOR IMAGES TO FINISH UPLOADING", 1);
  const btn = document.getElementById("wSubmit");
  btn.disabled = true;
  btn.textContent = "PUBLISHING...";
  // 1) fill the original hidden form
  window.aarClearForm(true);
  for (const [k, id] of Object.entries(FIELDS)) {
    const el = document.getElementById(id);
    if (el) el.value = w.v[k] ?? "";
  }
  for (const [name, val] of [["aarUnit", w.v.unit], ["aarResult", w.v.result]]) {
    const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (r) r.checked = true;
  }
  const list = document.getElementById("aarAttachmentsList");
  for (const f of w.files.filter((x) => x.st === "ok")) {
    const h = document.createElement("input");
    h.type = "hidden";
    h.className = "aar-attachment-input";
    h.value = f.url;
    list.appendChild(h);
  }
  // 2) original submit (saves to `aars`, audit log, Discord webhook)
  await window.submitAAR();
  const st = document.getElementById("aarSubmitStatus")?.textContent || "";
  // The original clears the status text on success; it only stays on failure.
  if (!/FAILED|FILL REQUIRED/.test(st)) {
    clearDraft();
    closeModal();
    notify("✓ REPORT PUBLISHED");
    load();
  } else {
    btn.disabled = false;
    btn.textContent = "PUBLISH REPORT";
    notify(st || "PUBLISH FAILED", 1);
  }
}

const CSS = `
#${ROOT} .draft{display:flex;gap:8px;align-items:center;border:1px solid var(--am);background:#141006;color:var(--am);padding:10px 14px;font-size:11px;letter-spacing:1.5px;margin:12px 0}
#${ROOT} .draft b{color:#fff}
#${ROOT} .ftr{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}#${ROOT} .ftr .in{width:auto;min-width:180px}
#${ROOT} .cnt{font-size:10px;letter-spacing:2px;color:var(--d)}
#${ROOT} .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:10px}
#${ROOT} .ac{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:start;text-align:left;border:1px solid var(--l);border-left:3px solid var(--rc);background:var(--p);padding:12px;cursor:pointer;font:inherit;color:inherit;position:relative}
#${ROOT} .ac:hover,#${ROOT} .ac:focus-visible{border-color:var(--l2);border-left-color:var(--rc);background:var(--p2)}
#${ROOT} .lg{width:44px;height:44px;object-fit:contain}
#${ROOT} .at{font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;color:#fff;letter-spacing:1px}
.aarv .am,#${ROOT} .am,.wiz .am{font-size:9.5px;letter-spacing:1.5px;color:var(--d);margin-top:3px}
#${ROOT} .as{font-size:11.5px;color:#aeb9c4;margin-top:6px;line-height:1.45}
#${ROOT} .rb,.v2m .rb{font-size:9px;letter-spacing:1.5px;border:1px solid var(--rc);color:var(--rc);padding:2px 6px;white-space:nowrap}
#${ROOT} .ph{position:absolute;right:12px;bottom:10px;font-size:9.5px;color:var(--d)}
.v2m .rtop{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--l)}
.v2m .rtop img{width:52px;height:52px;object-fit:contain}
.v2m .rs{margin-top:14px}.v2m .rh{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;color:var(--a);font-size:12.5px;margin-bottom:6px}
.v2m .rf{display:grid;grid-template-columns:200px 1fr;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03)}
.v2m .rf span{font-size:9.5px;letter-spacing:1.5px;color:var(--d);padding-top:2px}.v2m .rf p,.v2m .rs p{margin:0;font-size:12.5px;line-height:1.55;white-space:pre-wrap;color:#d6dde6}
.v2m .rimg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.v2m .rimg img{width:100%;aspect-ratio:16/10;object-fit:cover;border:1px solid var(--l)}
.v2m .wact{display:flex;gap:8px;align-items:center;margin-top:18px;padding-top:12px;border-top:1px solid var(--l)}
.v2m .sp{flex:1}.v2m .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}.v2m .b.sm{padding:4px 9px;font-size:10px}
.wiz .steps{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.wiz .st{display:flex;gap:8px;align-items:center;border:1px solid var(--l);background:none;padding:8px;text-align:left;cursor:pointer;font:inherit;color:var(--d)}
.wiz .st b{width:22px;height:22px;display:grid;place-items:center;border:1px solid currentColor;font-size:11px;flex-shrink:0}
.wiz .st span{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:1.5px;font-size:11.5px}.wiz .st small{display:block;font-family:'Share Tech Mono',monospace;font-weight:400;font-size:9px;letter-spacing:.5px}
.wiz .st.on{color:var(--a);border-color:var(--a)}.wiz .st.done{color:var(--g)}
.wiz .wb{max-height:58vh;overflow:auto;padding-right:6px}
.wiz .lb{display:block;font-size:9.5px;letter-spacing:2px;color:var(--d);margin:12px 0 5px}
.wiz .g2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.wiz .g2 .full{grid-column:1/-1}.wiz .in2{gap:0 10px}
.wiz textarea.in{resize:vertical;line-height:1.5}
.wiz .bad{border-color:#ff4d4d!important;box-shadow:0 0 0 1px #ff4d4d}
.wiz .units{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:2px}
.wiz .uo{border:1px solid var(--l);background:none;padding:10px 6px;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:1.5px;font-size:11px;color:var(--d);display:flex;flex-direction:column;align-items:center;gap:6px}
.wiz .uo img{width:40px;height:40px;object-fit:contain;opacity:.45}.wiz .uo.on{border-color:var(--a);color:var(--a);background:rgba(0,217,255,.06)}.wiz .uo.on img{opacity:1}
.wiz .res{display:flex;gap:8px;padding:2px}.wiz .ro{flex:1;border:1px solid color-mix(in srgb,var(--rc) 40%,transparent);color:color-mix(in srgb,var(--rc) 55%,transparent);background:none;padding:12px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;cursor:pointer}
.wiz .ro.on{border-color:var(--rc);color:var(--rc);background:color-mix(in srgb,var(--rc) 10%,transparent)}
.wiz .drop{display:block;border:1px dashed var(--l2);padding:14px;text-align:center;font-size:11px;letter-spacing:2px;color:var(--a);cursor:pointer}
.wiz .fl{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.wiz .fi{display:flex;gap:6px;align-items:center;border:1px solid var(--l);padding:4px;font-size:10px}
.wiz .fi img,.wiz .ph2{width:56px;height:40px;object-fit:cover;background:#111}.wiz .fi.err{border-color:#ff4d4d;color:#ff4d4d}
@media(max-width:800px){#${ROOT} .cards{grid-template-columns:1fr}.wiz .steps{grid-template-columns:repeat(5,auto)}.wiz .st span{display:none}.wiz .g2,.wiz .units{grid-template-columns:1fr 1fr}.v2m .rf{grid-template-columns:1fr}}
`;

onReady(() => {
  const root = mountPanel("panel-aar", ROOT, () => load().catch((e) => notify("AAR LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `<div class="bar"><div><div class="h1">AFTER ACTION REPORTS</div><div class="sub" style="margin:4px 0 0">OPERATION REPORTS — PUBLISHED TO THE PUBLIC AAR PAGE AND DISCORD</div></div><span class="sp"></span><button class="b gold" data-act="new">+ NEW REPORT</button></div><div class="body"><div class="empty">LOADING...</div></div>`;
  root.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === "q") {
      q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const el = root.querySelector('[data-f="q"]');
      el.focus();
      el.setSelectionRange(pos, pos);
    } else {
      if (f === "unit") fUnit = e.target.value;
      if (f === "res") fRes = e.target.value;
      render();
    }
  });
  root.addEventListener("click", async (e) => {
    const o = e.target.closest("[data-open]");
    if (o) return openReport(o.dataset.open);
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "new") {
      if (readDraft() && !(await ask({ kind: "warn", title: "DISCARD YOUR DRAFT?", body: "You have an unfinished report. Starting a new one discards it.", go: "START NEW" }))) return;
      clearDraft();
      return startWizard(false);
    }
    if (act === "resume") return startWizard(true);
    if (act === "discard" && (await ask({ kind: "danger", title: "DISCARD DRAFT?", body: "Your unfinished report will be thrown away.", warn: "THIS CANNOT BE UNDONE.", go: "DISCARD" }))) {
      clearDraft();
      render();
    }
  });
});
