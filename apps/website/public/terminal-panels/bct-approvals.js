/**
 * 505th Command Terminal — BCT APPROVALS panel (approved mock 2026-11-09).
 * Replaces the original "Enlistment Queue" inside #panel-register.
 *
 * People only sign up after passing BCT, so approving = BCT passed:
 * Active · E2 / Private First Class · Marine · chosen platoon, with the
 * promotion + transfer written to the service record, an audit log entry,
 * an in-terminal notification and the "approved" Discord webhook.
 * Data goes through the same Firestore stand-in as the rest of the terminal.
 */
import { getAuth } from "/terminal-shim/auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, addDoc, serverTimestamp } from "/terminal-shim/firestore.js";

const db = getFirestore();
const auth = getAuth();
const ROOT_ID = "bctA";
const PFC = "E2 / Private First Class";
const PLATOONS = ["1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot"];
const SOURCES = ["Reddit", "Steam Community", "Disboard", "Discord", "Word of Mouth", "Other"];
const DENY_REASONS = ["Did not pass BCT / not known to instructor", "Did not meet requirements", "Fake or incomplete name", "Duplicate account", "Other"];
const STAFF_ROLES = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
const APPROVE_ROLES = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
const LOGO = "https://i.ibb.co/d0Gn5M5R/505-TH-Logo.png";

const RANK_ABBR = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen", "O6 / Colonel": "Col",
  "O5 / Lieutenant Colonel": "LtCol", "O4 / Major": "Maj", "O3 / Captain": "Capt", "O2 / First Lieutenant": "1stLt",
  "O1 / Second Lieutenant": "2ndLt", "E9 / Sergeant Major": "SgtMaj", "E9 / Master Gunnery Sergeant": "MGySgt",
  "E9 / First Sergeant": "1stSgt", "E8 / Master Sergeant": "MSgt", "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt",
  "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl", "E3 / Lance Corporal": "LCpl", "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO", "E7 / Chief Corpsman": "CPO",
  "E6 / Corpsman First Class": "HM1", "E5 / Corpsman Second Class": "HM2", "E4 / Corpsman Third Class": "HM3",
  "E3 / Hospitalman": "HM", "E2 / Hospitalman Apprentice": "HA", "E6 / Technical Sergeant": "TSgt", "E5 / Staff Sergeant": "SSgt",
  "E4 / Senior Airman": "SrA", "E3 / Airman First Class": "A1C", "E2 / Airman": "Amn", "E1 / Airman Basic": "AB", Reservist: "Res",
};

// ───────── helpers ─────────
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rankAbbr = (r) => RANK_ABBR[r] || (r ? String(r).split("/").pop().trim() : "");
function memberName(u) {
  const first = (u.firstName || "").trim(), last = (u.lastName || "").trim(), cs = (u.callsign || "").trim();
  const hasCs = cs && cs !== first && cs !== `${first} ${last}`;
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : last || (cs ? `"${cs}"` : "")}`.trim();
  return [rankAbbr(u.rank || ""), name].filter(Boolean).join(" ");
}
const fullName = (u) => [u.firstName, u.middleName ? u.middleName[0] + "." : "", u.lastName].filter(Boolean).join(" ") || "Unknown";
const toDate = (v) => (!v ? null : typeof v.toDate === "function" ? v.toDate() : new Date(v));
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (v) => {
  const d = toDate(v);
  return d && !isNaN(d) ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 864e5)) : 0;
};
const ymd = (v) => {
  const d = toDate(v);
  return d && !isNaN(d) ? d.toISOString().slice(0, 10) : "—";
};
const initials = (u) => ((u.firstName || "?")[0] + (u.lastName || "?")[0]).toUpperCase();
const notify = (msg, err) => {
  const n = document.getElementById("notification");
  if (!n) return;
  n.textContent = msg;
  n.className = "notification show" + (err ? " error" : "");
  setTimeout(() => (n.className = "notification"), 3000);
};

// ───────── state ─────────
let users = [];
let me = null; // { uid, ...userData }
let sel = null;

async function loadMe() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? { uid, ...s.data() } : { uid, role: "" };
}

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const instructors = () =>
  users
    .filter((u) => STAFF_ROLES.has(u.role) && u.status !== "pending" && u.status !== "denied")
    .map(memberName)
    .filter(Boolean)
    .sort();

// ───────── writes ─────────
async function audit(action, details) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      section: "manpower",
      action,
      details,
      uid: me.uid,
      by: memberName(me) || me.callsign || "Unknown",
      role: me.role || "—",
      createdAt: serverTimestamp(),
      createdAtISO: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("audit failed", e);
  }
}

async function webhook(key, embed) {
  try {
    const s = await getDoc(doc(db, "settings", "webhooks"));
    const url = s.exists() ? s.data()[key] : null;
    if (!url || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "505th Command Terminal", avatar_url: LOGO, allowed_mentions: { parse: [] }, embeds: [embed] }),
    });
  } catch (e) {
    console.warn("webhook failed", e);
  }
}

async function approve(u, f) {
  const by = memberName(me) || me.callsign || "Staff";
  const nowIso = new Date().toISOString();
  const note = f.note ? `BCT passed — ${f.note}` : "BCT passed";
  const promo = [...(u.promotionHistory || []), { date: f.date, fromRank: u.rank || "—", toRank: PFC, note, addedBy: by, addedAt: nowIso, auto: true }];
  const plt = [...(u.platoonHistory || []), { date: f.date, from: u.platoon || "—", to: f.platoon, note: "BCT passed", addedBy: by, addedAt: nowIso, auto: true }];
  await updateDoc(doc(db, "users", u.id), {
    status: "active",
    role: "marine",
    rank: PFC,
    platoon: f.platoon,
    joinedPlatoon: f.date,
    graduation: f.date,
    bctInstructor: f.instructor,
    recruitSource: f.source || u.recruitSource || "",
    approvedAt: nowIso,
    approvedBy: by,
    promotionHistory: promo,
    platoonHistory: plt,
    updatedAt: nowIso,
  });
  const pfcName = memberName({ ...u, rank: PFC });
  try {
    await addDoc(collection(db, "notifications", u.id, "items"), {
      type: "promotion", read: false, title: "Welcome to the 505th!", body: `BCT passed — you are now ${pfcName}, ${f.platoon}.`, createdAt: serverTimestamp(),
    });
  } catch (_) {}
  await audit("BCT APPROVED", `${fullName(u)} passed BCT (instructor: ${f.instructor}) → ${PFC}, ${f.platoon}${f.source ? " — Source: " + f.source : ""}`);
  if (f.post)
    await webhook("approved", {
      title: "🎖 New Marine — BCT Passed",
      description: `**${pfcName}** passed Basic Combat Training and joins **${f.platoon}**.`,
      color: 0x22e07a,
      fields: [
        { name: "BCT Instructor", value: f.instructor, inline: true },
        { name: "Approved by", value: by, inline: true },
      ],
      footer: { text: "505th Expeditionary Force • Command Terminal" },
      timestamp: nowIso,
    });
  return pfcName;
}

async function deny(u, f) {
  const by = memberName(me) || me.callsign || "Staff";
  await updateDoc(doc(db, "users", u.id), {
    status: "denied", deniedAt: new Date().toISOString(), deniedBy: by, denyReason: f.reason, denyNote: f.note || "", updatedAt: new Date().toISOString(),
  });
  await audit("ENLISTMENT DENIED", `${fullName(u)} — ${f.reason}${f.note ? " (" + f.note + ")" : ""}`);
  if (f.post)
    await webhook("denied", {
      title: "✕ Enlistment Denied",
      description: `**${fullName(u)}** was not approved.`,
      color: 0xff4d4d,
      fields: [{ name: "Denied by", value: by, inline: true }],
      footer: { text: "505th Expeditionary Force • Command Terminal" },
      timestamp: new Date().toISOString(),
    });
}

// ───────── render ─────────
const CSS = `
#${ROOT_ID}{--bA:#00D9FF;--bG:#22e07a;--bAm:#f59e0b;--bR:#ff4d4d;--bL:rgba(0,217,255,.18);--bL2:rgba(0,217,255,.35);--bP:#0b0f15;--bP2:#0e131b;--bD:#7d8a99;--bDD:#4b5765;font-family:'Share Tech Mono',monospace;color:#d6dde6}
#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} .h1{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;color:var(--bA);font-size:20px;padding-bottom:10px;border-bottom:1px solid var(--bL)}
#${ROOT_ID} .sub{font-size:10px;letter-spacing:3px;color:var(--bD);margin:10px 0 0}
#${ROOT_ID} .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
#${ROOT_ID} .stat{border:1px solid var(--bL);background:var(--bP);padding:14px;text-align:center}
#${ROOT_ID} .stat b{display:block;font-family:Rajdhani,sans-serif;font-size:30px;line-height:1}
#${ROOT_ID} .stat span{font-size:9px;letter-spacing:3px;color:var(--bD)}
#${ROOT_ID} .cols{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:start}
#${ROOT_ID} .col{border:1px solid var(--bL);background:var(--bP);min-width:0}
#${ROOT_ID} .colh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--bL);border-top:2px solid var(--cc)}
#${ROOT_ID} .colh h3{margin:0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:13px;color:var(--cc)}
#${ROOT_ID} .colh small{display:block;font-size:9px;letter-spacing:1.5px;color:var(--bD);margin-top:3px}
#${ROOT_ID} .colh .n{font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;background:var(--cc);color:#000;padding:1px 8px}
#${ROOT_ID} .list{padding:10px;display:flex;flex-direction:column;gap:10px;min-height:110px}
#${ROOT_ID} .rc{border:1px solid var(--bL);background:var(--bP2);padding:11px 12px;position:relative}
#${ROOT_ID} .rc::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--cc)}
#${ROOT_ID} .row{display:flex;gap:10px;align-items:center}
#${ROOT_ID} .av{width:38px;height:38px;flex-shrink:0;border:1px solid var(--bL2);background:#0a1018;display:grid;place-items:center;font-family:Rajdhani,sans-serif;font-weight:700;color:var(--bA);font-size:14px}
#${ROOT_ID} .nm{font-size:13.5px;color:#fff}
#${ROOT_ID} .meta{font-size:9.5px;color:var(--bD);letter-spacing:1px;margin-top:2px;word-break:break-all}
#${ROOT_ID} .info{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;margin:10px 0 0}
#${ROOT_ID} .info dt{color:var(--bDD);letter-spacing:1.5px}#${ROOT_ID} .info dd{margin:0;text-align:right;color:#c6d0da}
#${ROOT_ID} .wait{font-size:9.5px;letter-spacing:1.5px;padding:2px 6px;border:1px solid;white-space:nowrap}
#${ROOT_ID} .ra{display:flex;gap:6px;margin-top:10px}
#${ROOT_ID} .ra button{flex:1;background:none;border:1px solid;padding:7px 0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11px;cursor:pointer}
#${ROOT_ID} .gold{color:#000!important;background:var(--bAm)!important;border-color:var(--bAm)!important}
#${ROOT_ID} .no{color:var(--bR);border-color:rgba(255,77,77,.45)!important}
#${ROOT_ID} .no:hover{background:rgba(255,77,77,.06)}
#${ROOT_ID} .empty{text-align:center;color:var(--bDD);font-size:10px;letter-spacing:3px;padding:30px 0}
#${ROOT_ID} .foot{margin-top:14px;font-size:10px;letter-spacing:2px;color:var(--bD)}
#${ROOT_ID} .foot button{background:none;border:0;color:var(--bA);text-decoration:underline;cursor:pointer;font:inherit;letter-spacing:2px}
#${ROOT_ID} .denied{margin-top:10px;display:none}
#${ROOT_ID} .denied.open{display:block}
@media(max-width:1100px){#${ROOT_ID} .cols{grid-template-columns:1fr}#${ROOT_ID} .stats{grid-template-columns:repeat(2,1fr)}}
.bctov{position:fixed;inset:0;background:rgba(2,4,7,.78);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999;font-family:'Share Tech Mono',monospace;color:#d6dde6}
.bctov .m{width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#0b0f15;border:1px solid rgba(0,217,255,.35);box-shadow:0 20px 80px rgba(0,0,0,.6)}
.bctov .mh{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(0,217,255,.18)}
.bctov h2{margin:0;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:4px;font-size:16px}
.bctov .fid{font-size:10px;letter-spacing:2px;color:#7d8a99;margin-top:2px}
.bctov .x{background:none;border:1px solid rgba(0,217,255,.35);width:30px;height:30px;cursor:pointer;color:#9fb3c4}
.bctov .bd{padding:18px 20px}
.bctov .cert{border:1px solid rgba(245,158,11,.45);background:linear-gradient(135deg,rgba(245,158,11,.08),transparent 60%);padding:14px 16px;display:flex;gap:14px;align-items:center}
.bctov .seal{width:46px;height:46px;border-radius:50%;border:2px solid #f59e0b;display:grid;place-items:center;color:#f59e0b;font-family:Rajdhani,sans-serif;font-weight:700;font-size:12px;flex-shrink:0}
.bctov .cert b{display:block;font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#f59e0b;font-size:14px}
.bctov .cert span{font-size:10px;color:#7d8a99;letter-spacing:1px}
.bctov .form{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:14px}
.bctov .f.full{grid-column:1/-1}
.bctov label.l{display:block;font-size:9.5px;letter-spacing:2.5px;color:#aeb9c4;margin-bottom:6px}
.bctov label.l small{color:#4b5765;letter-spacing:1px}
.bctov input,.bctov select{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:9px 10px;font:inherit;font-size:12px;color:#d6dde6;outline:0}
.bctov input:focus,.bctov select:focus{border-color:#00D9FF;box-shadow:0 0 0 1px #00D9FF}
.bctov .chg{border:1px solid rgba(0,217,255,.18);background:#070a0f;margin-top:14px}
.bctov .chg div{display:grid;grid-template-columns:110px 1fr auto 1fr;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(0,217,255,.07);font-size:11px}
.bctov .chg div:last-child{border-bottom:0}
.bctov .chg dt{color:#4b5765;letter-spacing:2px;font-size:9px}
.bctov .old{color:#7d8a99}.bctov .new{color:#22e07a}
.bctov .chk{display:flex;gap:8px;align-items:center;font-size:10.5px;margin-top:12px}
.bctov .chk input{width:auto;accent-color:#00D9FF}
.bctov .mf{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid rgba(0,217,255,.18);background:#090c11}
.bctov .hint{font-size:9.5px;letter-spacing:1.5px;color:#7d8a99}
.bctov .btn{white-space:nowrap;background:transparent;border:1px solid;padding:8px 16px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2.5px;font-size:12px;cursor:pointer}
.bctov .btn:disabled{opacity:.6;cursor:wait}
@media(max-width:600px){.bctov .form{grid-template-columns:1fr}.bctov .mf{flex-direction:column;align-items:stretch}}
`;

function waitTag(d) {
  const c = d > 14 ? "var(--bR)" : d > 7 ? "var(--bAm)" : "var(--bG)";
  return `<span class="wait" style="color:${c};border-color:${c}">${d}D WAITING</span>`;
}

function render() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const canAct = APPROVE_ROLES.has(me?.role);
  const pending = users.filter((u) => u.status === "pending").sort((a, b) => String(a.registeredAt || "").localeCompare(String(b.registeredAt || "")));
  const approved = users
    .filter((u) => u.status !== "pending" && u.status !== "denied" && u.approvedAt && u.bctInstructor && daysSince(u.approvedAt) <= 30)
    .sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)));
  const denied = users.filter((u) => u.status === "denied" && daysSince(u.deniedAt) <= 30);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = users.filter((u) => u.approvedAt && u.bctInstructor && toDate(u.approvedAt) >= monthStart).length;
  const recent = users.filter((u) => u.approvedAt && u.registeredAt && u.bctInstructor).slice(-30);
  const avg = recent.length
    ? (recent.reduce((s, u) => s + Math.max(0, (toDate(u.approvedAt) - toDate(u.registeredAt)) / 864e5), 0) / recent.length).toFixed(1)
    : "—";

  root.innerHTML = `
    <div class="h1">BCT APPROVALS</div>
    <div class="sub">PASSED BCT → INSTRUCTOR TELLS THEM TO SIGN UP → YOU APPROVE = PFC · MARINE</div>
    <div class="stats">
      <div class="stat"><b style="color:var(--bAm)">${pending.length}</b><span>WAITING</span></div>
      <div class="stat"><b style="color:var(--bA)">${denied.length}</b><span>DENIED (30 DAYS)</span></div>
      <div class="stat"><b style="color:var(--bG)">${thisMonth}</b><span>APPROVED THIS MONTH</span></div>
      <div class="stat"><b style="color:#c6d0da">${avg}</b><span>AVG DAYS TO APPROVE</span></div>
    </div>
    <div class="cols">
      <section class="col" style="--cc:var(--bAm)"><div class="colh"><div><h3>① WAITING FOR APPROVAL</h3><small>PASSED BCT · SIGNED UP ON THE WEBSITE</small></div><span class="n">${pending.length}</span></div>
        <div class="list">${
          pending.length
            ? pending
                .map(
                  (u) => `<div class="rc" style="--cc:var(--bAm)"><div class="row"><div class="av">${esc(initials(u))}</div><div style="flex:1;min-width:0"><div class="nm">${esc(fullName(u))}</div>
                  <div class="meta">${u.discordUsername ? "@" + esc(u.discordUsername) : esc(u.email || "NO DISCORD LINK")} · SIGNED UP ${ymd(u.registeredAt)}</div></div>${waitTag(daysSince(u.registeredAt))}</div>
                  <dl class="info"><dt>BCT INSTRUCTOR</dt><dd>${esc(u.bctInstructor || "—")} <span style="color:var(--bDD)">(THEY SAID)</span></dd>
                  <dt>HEARD ABOUT US</dt><dd>${esc(u.recruitSource || "—")}</dd><dt>TIMEZONE</dt><dd>${esc(u.timezone || "—")}</dd></dl>
                  ${canAct ? `<div class="ra"><button class="gold" data-act="approve" data-id="${esc(u.id)}">✓ APPROVE · PFC</button><button class="no" data-act="deny" data-id="${esc(u.id)}">✕ DENY</button></div>` : ""}</div>`,
                )
                .join("")
            : '<div class="empty">NOBODY WAITING</div>'
        }</div></section>
      <section class="col" style="--cc:var(--bG)"><div class="colh"><div><h3>② APPROVED</h3><small>NOW PFC · LAST 30 DAYS</small></div><span class="n">${approved.length}</span></div>
        <div class="list">${
          approved.length
            ? approved
                .map(
                  (u) => `<div class="rc" style="--cc:var(--bG);opacity:.88"><div class="row"><div class="av" style="color:var(--bG)">${esc(rankAbbr(u.rank) || "PFC")}</div><div style="flex:1;min-width:0">
                  <div class="nm">${esc(memberName(u))}</div><div class="meta">${esc((u.platoon || "").toUpperCase())} · ${ymd(u.approvedAt)}</div></div></div>
                  <dl class="info"><dt>BCT INSTRUCTOR</dt><dd>${esc(u.bctInstructor)}</dd><dt>APPROVED BY</dt><dd>${esc(u.approvedBy || "—")}</dd></dl></div>`,
                )
                .join("")
            : '<div class="empty">NONE IN THE LAST 30 DAYS</div>'
        }</div></section>
    </div>
    <div class="foot">DENIED (LAST 30 DAYS): <button data-act="toggle-denied">${denied.length} — ${denied.length ? "VIEW" : "NONE"}</button></div>
    <div class="denied"><div class="list" style="padding:10px 0">${denied
      .map(
        (u) => `<div class="rc" style="--cc:var(--bR)"><div class="row"><div class="av" style="color:var(--bR)">${esc(initials(u))}</div><div style="flex:1;min-width:0"><div class="nm">${esc(fullName(u))}</div>
        <div class="meta">DENIED ${ymd(u.deniedAt)} BY ${esc(u.deniedBy || "—")} · ${esc(u.denyReason || "")}</div></div>
        ${canAct ? `<button class="wait" style="color:var(--bAm);border-color:var(--bAm);background:none;cursor:pointer" data-act="reopen" data-id="${esc(u.id)}">REOPEN</button>` : ""}</div></div>`,
      )
      .join("")}</div></div>`;
}

// ───────── modals ─────────
function modal(html) {
  closeModal();
  const ov = document.createElement("div");
  ov.className = "bctov";
  ov.id = "bctModal";
  ov.innerHTML = `<div class="m" role="dialog" aria-modal="true">${html}</div>`;
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(ov);
  setTimeout(() => ov.querySelector("select,input")?.focus(), 30);
  return ov;
}
function closeModal() {
  document.getElementById("bctModal")?.remove();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

const opts = (list, val) => list.map((v) => `<option ${v === val ? "selected" : ""}>${esc(v)}</option>`).join("");

function openApprove(u) {
  const ins = instructors();
  const insVal = ins.includes(u.bctInstructor) ? u.bctInstructor : ""; // unknown → staff must pick
  const ov = modal(`
    <div class="mh"><div><h2 style="color:#f59e0b">APPROVE — BCT CERTIFICATE</h2><div class="fid">${esc(fullName(u).toUpperCase())}${u.discordUsername ? " · @" + esc(u.discordUsername) : ""}</div></div><button class="x" data-close aria-label="Close">✕</button></div>
    <div class="bd">
      <div class="cert"><div class="seal">BCT</div><div><b>BCT PASSED</b><span>Confirms they passed Basic Combat Training. They join as PFC.</span></div></div>
      <div class="form">
        <div class="f"><label class="l" for="bA-date">GRADUATION DATE</label><input id="bA-date" type="date" value="${esc(u.bctDate || today())}" max="${today()}"></div>
        <div class="f"><label class="l" for="bA-pl">ASSIGN TO PLATOON</label><select id="bA-pl">${opts(PLATOONS, "1st Platoon")}</select></div>
        <div class="f"><label class="l" for="bA-ins">BCT INSTRUCTOR <small>(WHO PASSED THEM)</small></label><select id="bA-ins"><option value="">— SELECT —</option>${opts(ins, insVal)}</select></div>
        <div class="f"><label class="l" for="bA-src">RECRUITMENT SOURCE</label><select id="bA-src"><option value="">— NOT SET —</option>${opts(SOURCES, u.recruitSource)}</select></div>
        <div class="f full"><label class="l" for="bA-note">INSTRUCTOR NOTE <small>(OPTIONAL — SAVED TO SERVICE RECORD)</small></label><input id="bA-note" maxlength="200" placeholder="e.g. Strong on comms, needs work on CQB"></div>
      </div>
      <div class="chg" id="bA-chg"></div>
      <label class="chk"><input type="checkbox" id="bA-post" checked> Post to Discord (approved webhook)</label>
    </div>
    <div class="mf"><span class="hint">STARTS THEIR SERVICE RECORD WITH “BCT PASSED → PFC”</span><div style="display:flex;gap:8px"><button class="btn" data-close style="color:#c6d0da;border-color:#5b6b7c">CANCEL</button><button class="btn" id="bA-go" style="color:#000;background:#f59e0b;border-color:#f59e0b">✓ APPROVE AS PFC</button></div></div>`);
  const $ = (id) => ov.querySelector("#" + id);
  const upd = () => {
    const rows = [["STATUS", "Signed up", "Active"], ["RANK", u.rank || "—", PFC], ["ROLE", u.role === "enlistee" ? "—" : u.role || "—", "Marine"], ["PLATOON", u.platoon || "—", $("bA-pl").value], ["GRADUATION", u.graduation || "—", $("bA-date").value || "—"], ["DISPLAY NAME", "—", memberName({ ...u, rank: PFC })]];
    $("bA-chg").innerHTML = rows.map(([k, o, n]) => `<div><dt>${k}</dt><span class="old">${esc(o)}</span><span style="color:#7d8a99">→</span><span class="new">${esc(n)}</span></div>`).join("");
  };
  ["bA-pl", "bA-date"].forEach((id) => $(id).addEventListener("input", upd));
  upd();
  $("bA-go").addEventListener("click", async () => {
    const f = { date: $("bA-date").value, platoon: $("bA-pl").value, instructor: $("bA-ins").value, source: $("bA-src").value, note: $("bA-note").value.trim(), post: $("bA-post").checked };
    if (!f.date || !f.instructor) return notify("SET A GRADUATION DATE AND PICK THE BCT INSTRUCTOR", 1);
    $("bA-go").disabled = true;
    try {
      const name = await approve(u, f);
      closeModal();
      notify("APPROVED — " + name.toUpperCase());
      await refresh();
    } catch (e) {
      $("bA-go").disabled = false;
      notify("ERROR: " + (e.message || "could not approve"), 1);
    }
  });
}

function openDeny(u) {
  const ov = modal(`
    <div class="mh"><div><h2 style="color:#ff4d4d">DENY</h2><div class="fid">${esc(fullName(u).toUpperCase())}</div></div><button class="x" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="form">
      <div class="f full"><label class="l" for="bD-r">REASON <small>(STAFF ONLY — NOT SENT TO THEM)</small></label><select id="bD-r"><option value="">— SELECT —</option>${opts(DENY_REASONS)}</select></div>
      <div class="f full"><label class="l" for="bD-n">NOTE <small>(OPTIONAL)</small></label><input id="bD-n" maxlength="200"></div>
    </div><label class="chk"><input type="checkbox" id="bD-post" checked> Post to Discord (denied webhook)</label></div>
    <div class="mf"><span class="hint">THEY CAN'T SIGN IN. YOU CAN REOPEN IT FOR 30 DAYS.</span><div style="display:flex;gap:8px"><button class="btn" data-close style="color:#c6d0da;border-color:#5b6b7c">CANCEL</button><button class="btn" id="bD-go" style="color:#ff4d4d;border-color:#ff4d4d">✕ CONFIRM</button></div></div>`);
  const $ = (id) => ov.querySelector("#" + id);
  $("bD-go").addEventListener("click", async () => {
    const f = { reason: $("bD-r").value, note: $("bD-n").value.trim(), post: $("bD-post").checked };
    if (!f.reason) return notify("PICK A REASON", 1);
    $("bD-go").disabled = true;
    try {
      await deny(u, f);
      closeModal();
      notify("DENIED — " + fullName(u).toUpperCase());
      await refresh();
    } catch (e) {
      $("bD-go").disabled = false;
      notify("ERROR: " + (e.message || "could not deny"), 1);
    }
  });
}

async function reopen(u) {
  if (!(await ask({ kind: "warn", title: "MOVE BACK TO WAITING?", body: `${fullName(u)} goes back to "Waiting for approval".`, go: "MOVE BACK" }))) return;
  try {
    await updateDoc(doc(db, "users", u.id), { status: "pending", updatedAt: new Date().toISOString() });
    await audit("ENLISTMENT REOPENED", `${fullName(u)} moved back to BCT Approvals`);
    notify("REOPENED — " + fullName(u).toUpperCase());
    await refresh();
  } catch (e) {
    notify("ERROR: " + e.message, 1);
  }
}

// ───────── wiring ─────────
async function refresh() {
  try {
    if (!me) me = await loadMe();
    await loadUsers();
    render();
  } catch (e) {
    const root = document.getElementById(ROOT_ID);
    if (root) root.innerHTML = `<div class="h1">BCT APPROVALS</div><div class="empty" style="color:#ff4d4d">ERROR: ${esc(e.message)}</div>`;
  }
}

function mount() {
  const panel = document.getElementById("panel-register");
  if (!panel || document.getElementById(ROOT_ID)) return;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  panel.innerHTML = `<div id="${ROOT_ID}"><div class="h1">BCT APPROVALS</div><div class="empty">LOADING...</div></div>`;
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const u = users.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === "approve" && u) openApprove(u);
    if (b.dataset.act === "deny" && u) openDeny(u);
    if (b.dataset.act === "reopen" && u) reopen(u);
    if (b.dataset.act === "toggle-denied") document.querySelector(`#${ROOT_ID} .denied`)?.classList.toggle("open");
  });
  // Refresh every time the panel is opened.
  new MutationObserver(() => {
    if (!panel.classList.contains("hidden")) refresh();
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  if (!panel.classList.contains("hidden")) refresh();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
