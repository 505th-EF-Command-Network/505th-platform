/**
 * COMMAND (approved mock 2026-11-10) — Commander / Developer by default ("Settings" access).
 * The old orange Command Panel popup becomes pages:
 *   UNIT:   Unit Status · SITREP · Command Staff · Command Promotions · Suspensions
 *   SYSTEM: Overall Status · Bot Server · Settings (Discord, Webhooks, Cortana, Website, Discord Role Map)
 * Same data as the original panel: unit_config/status, fragos, users.suspended, settings/*.
 * Discord actions are queued in bot_jobs for Cortana v2.
 */
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, cortanaStatus, audit, closeModal, db, esc, getMe, getUsers, hexAvatar, isMember, memberName, mountPanel, notify, notifyMember, onReady, openModal, rankOrder, ukDate } from "./_common.js";
import { ask, tell } from "./_common.js";

const OPS = [["Active", "ACTIVE", "Full operations", "#22e07a"], ["Stand Down", "STAND DOWN", "Reduced operations", "#7d8a99"], ["On Op", "ON OP", "Active deployment", "#f59e0b"], ["Training Cycle", "TRAINING", "Training cycle", "#00D9FF"], ["Maintenance", "MAINTENANCE", "Admin period", "#a78bfa"]];
const RL = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER", marine: "MARINE", enlistee: "ENLISTEE", retired_veteran: "RETIRED / VETERAN" };
const VIS = [["all_staff", "ALL STAFF (NCO+)", "#00D9FF"], ["officers_only", "OFFICERS ONLY", "#a78bfa"], ["commander_only", "COMMANDER ONLY", "#f59e0b"]];
const WEBHOOKS = [["registration", "NEW SIGN-UP", "When a new member signs up after BCT"], ["approved", "BCT APPROVED", "When staff approve / deny"], ["promote", "PROMOTIONS", "Promotions and awards"], ["warning", "WARNINGS", "Warnings on a member's file"], ["platoon", "PLATOON TRANSFERS", "Platoon changes"], ["aar", "AAR SUBMITTED", "When an AAR is published"], ["attendance", "ATTENDANCE LOCKED", "When an op is locked"]];
const MAP_ROLES = ["commander", "officer", "developer", "staff_nco", "nco", "recruiter", "marine", "retired_veteran"];
const nowISO = () => new Date().toISOString();
const queue = (type, payload) => addDoc(collection(db, "bot_jobs"), { type, payload, status: "pending", createdAtISO: nowISO(), attempts: 0 });

let users = [];
async function loadUsers(force) {
  if (!users.length || force) users = await getUsers();
  return users;
}
const online = async () => {
  const s = await getDocs(collection(db, "presence_sessions"));
  const cut = Date.now() - 2 * 60000;
  return new Set(s.docs.map((d) => d.data()).filter((p) => Date.parse(p.updatedAt || 0) > cut).map((p) => p.uid));
};
const lastSeen = (u) => u.lastSeen || u.lastLogin || u.lastActive || null;
const ago = (iso) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${m}M` : m < 1440 ? `${Math.round(m / 60)}H` : `${Math.round(m / 1440)}D`;
};

/* ───────────────────────────── command strip ───────────────────────────── */
let status = {};
async function loadStatus() {
  const s = await getDoc(doc(db, "unit_config", "status"));
  status = s.exists() ? s.data() : {};
  strip();
}
function strip() {
  const el = document.getElementById("cmdStrip");
  if (!el) return;
  const o = OPS.find((x) => x[0] === status.opStatus) || ["", "NOT SET", "", "#7d8a99"];
  const open = status.recruitmentOpen !== false;
  el.innerHTML = `<b style="color:${o[3]}">◉ UNIT: ${o[1]}</b><b style="color:${open ? "#22e07a" : "#ff4d4d"}">${open ? "● RECRUITING" : "○ RECRUITMENT CLOSED"}</b><b id="cmdStripCort" style="color:#7d8a99">CORTANA: ○ …</b>`;
  cortanaStatus().then((c) => {
    const b = document.getElementById("cmdStripCort");
    if (b) { b.style.color = c.online ? "#22e07a" : c.lastHeartbeatISO ? "#ff4d4d" : "#7d8a99"; b.textContent = c.online ? `CORTANA: ● ONLINE · ${c.pingMs} MS` : c.lastHeartbeatISO ? "CORTANA: ✕ OFFLINE" : "CORTANA: ○ NOT RUNNING"; }
  });
}

/* ───────────────────────────────── UNIT STATUS ──────────────────────────── */
let st = null; // working copy
function renderStatus() {
  const root = document.getElementById("cmdStatusV2");
  if (!root || !st) return;
  const o = OPS.find((x) => x[0] === st.opStatus) || OPS[0];
  const open = st.recruitmentOpen !== false;
  root.querySelector(".body").innerHTML = `
    <div class="cd"><span class="lbl" style="margin-top:0">OPERATIONAL STATUS</span>
      <div class="opg">${OPS.map(([v, l, d, c]) => `<button class="opb ${v === st.opStatus ? "on" : ""}" style="--c:${c}" data-op="${v}" aria-pressed="${v === st.opStatus}"><b>${l}</b><small>${d}</small></button>`).join("")}</div>
      <div class="g2" style="margin-top:16px">
        <div><span class="lbl">RECRUITMENT</span><button class="gate" data-act="gate" style="color:${open ? "#22e07a" : "#ff4d4d"};border-color:${open ? "#22e07a" : "#ff4d4d"}">${open ? "● RECRUITMENT OPEN — CLICK TO CLOSE" : "○ RECRUITMENT CLOSED — CLICK TO OPEN"}</button>
          <p class="hint">Closed = the sign-up page is locked and the website shows "Recruitment closed".</p></div>
        <div><label class="lbl" for="usMsg">STATUS MESSAGE <small>(OPTIONAL — BANNER + ALERT)</small></label><textarea class="fld" id="usMsg" rows="4" maxlength="300">${esc(st.statusMessage || "")}</textarea>
          <label class="ckl"><input type="checkbox" id="usAlert" checked> ALSO SEND AS ALERT TO ALL STAFF</label>
          <label class="ckl"><input type="checkbox" id="usDisc"> ALSO POST IN DISCORD #announcements (CORTANA v2)</label></div></div>
      <span class="lbl">PREVIEW — WEBSITE BANNER</span><div class="banner" style="--c:${o[3]}"><b>◉ ${o[1]}</b><span id="usPrev">${esc(st.statusMessage || "—")}</span><span style="flex:1"></span><span class="dim">${open ? "RECRUITING" : "RECRUITMENT CLOSED"}</span></div>
      <div class="act"><span class="hint" style="margin:0">${status.updatedByName ? `LAST CHANGED BY ${esc(status.updatedByName)}${status.updatedAtISO ? " · " + ukDate(status.updatedAtISO) : ""}` : ""}</span><span style="flex:1"></span><button class="b gold" data-act="save">SAVE STATUS</button></div></div>
    <span class="lbl">HISTORY</span>
    <table class="t"><tbody>${(status.history || [])
      .slice()
      .reverse()
      .map((h) => {
        const ho = OPS.find((x) => x[0] === h.opStatus) || ["", h.opStatus, "", "#7d8a99"];
        return `<tr><td class="dim">${ukDate(h.at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td><span class="pill" style="--c:${ho[3]}">${esc(ho[1])}</span></td><td>${h.recruitmentOpen === false ? "Recruitment closed · " : ""}${esc(h.statusMessage || "—")}</td><td>${esc(h.by || "—")}</td></tr>`;
      })
      .join("") || '<tr><td class="empty">NO CHANGES YET</td></tr>'}</tbody></table>`;
}
async function saveStatus() {
  const me = await getMe();
  const msg = document.getElementById("usMsg").value.trim();
  const rec = { opStatus: st.opStatus, statusMessage: msg, recruitmentOpen: st.recruitmentOpen !== false, updatedBy: me?.uid || "", updatedByName: memberName(me), updatedAtISO: nowISO() };
  try {
    const history = [...(status.history || []), { ...rec, by: rec.updatedByName, at: rec.updatedAtISO }].slice(-25);
    await setDoc(doc(db, "unit_config", "status"), { ...rec, history }, { merge: true });
    await audit("command", "UNIT STATUS UPDATED", `${rec.opStatus}${msg ? " — " + msg : ""} · recruitment ${rec.recruitmentOpen ? "open" : "closed"}`);
    if (document.getElementById("usAlert").checked && typeof window.cmdBroadcastNotif === "function")
      await window.cmdBroadcastNotif("warning", "COMMAND STATUS UPDATE", `${rec.opStatus}${msg ? " — " + msg : ""} · ${rec.updatedByName}`, ["commander", "officer", "developer", "staff_nco", "nco", "recruiter"]);
    if (document.getElementById("usDisc").checked) await queue("message.send", { channel: "announcements", content: `**Unit status: ${rec.opStatus}**${msg ? "\n" + msg : ""}` });
    notify("✓ UNIT STATUS SAVED");
    await loadStatus();
    st = { ...status };
    renderStatus();
  } catch (e) {
    notify("SAVE FAILED: " + e.message, 1);
  }
}

/* ─────────────────────────────────── SITREP ─────────────────────────────── */
let fragos = [];
async function loadSitrep() {
  const s = await getDocs(collection(db, "fragos"));
  fragos = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAtISO || b.createdAt?.seconds || "").localeCompare(String(a.createdAtISO || a.createdAt?.seconds || "")));
  renderSitrep();
}
let vis = "all_staff";
function renderSitrep() {
  const root = document.getElementById("cmdSitrepV2");
  if (!root) return;
  root.querySelector(".list").innerHTML =
    fragos
      .map((f) => {
        const v = VIS.find((x) => x[0] === f.visibility) || VIS[0];
        const at = f.createdAtISO || (f.createdAt?.toDate ? f.createdAt.toDate().toISOString() : null);
        return `<div class="sr ${f.pinned ? "pin" : ""}"><div class="srh"><b>${f.pinned ? "📌 " : ""}${esc(f.title || "UNTITLED")}</b><span class="pill" style="--c:${v[2]}">${v[1].replace(" (NCO+)", "")}</span></div><p>${esc(f.body || "")}</p>
          <div class="srf"><small>${esc(f.authorName || "—")}${at ? " · " + ukDate(at) : ""}</small><span style="flex:1"></span><button class="b sm" data-pin="${f.id}">${f.pinned ? "UNPIN" : "📌 PIN"}</button><button class="b sm red" data-fdel="${f.id}" aria-label="Delete">✕</button></div></div>`;
      })
      .join("") || '<div class="empty">NO SITREPS YET</div>';
  root.querySelectorAll("[data-vis]").forEach((b) => b.classList.toggle("on", b.dataset.vis === vis));
}
async function sendSitrep() {
  const root = document.getElementById("cmdSitrepV2");
  const title = root.querySelector("#srT").value.trim(), body = root.querySelector("#srB").value.trim();
  if (!title || !body) return notify("TITLE AND REPORT REQUIRED", 1);
  const me = await getMe();
  try {
    const pinned = root.querySelector("#srPin").checked;
    if (pinned) await Promise.all(fragos.filter((f) => f.pinned).map((f) => updateDoc(doc(db, "fragos", f.id), { pinned: false })));
    await addDoc(collection(db, "fragos"), { title, body, visibility: vis, pinned, authorUid: me?.uid || "", authorName: memberName(me), createdAtISO: nowISO(), createdAt: new Date() });
    await audit("command", "SITREP TRANSMITTED", `${title} (${VIS.find((x) => x[0] === vis)[1]})`);
    if (root.querySelector("#srAlert").checked && typeof window.cmdBroadcastNotif === "function") {
      const roles = vis === "commander_only" ? ["commander", "developer"] : vis === "officers_only" ? ["commander", "developer", "officer"] : ["commander", "officer", "developer", "staff_nco", "nco"];
      await window.cmdBroadcastNotif("info", "NEW SITREP", title, roles);
    }
    root.querySelector("#srT").value = "";
    root.querySelector("#srB").value = "";
    notify("✓ SITREP TRANSMITTED");
    window.loadDashSitrep?.();
    loadSitrep();
  } catch (e) {
    notify("TRANSMIT FAILED: " + e.message, 1);
  }
}

/* ──────────────────────────────── COMMAND STAFF ─────────────────────────── */
async function renderStaff() {
  const root = document.getElementById("cmdStaffV2");
  if (!root) return;
  const [us, on] = await Promise.all([loadUsers(true), online().catch(() => new Set())]);
  const tiers = [["COMMAND", ["commander"], "#f59e0b"], ["DEVELOPERS", ["developer"], "#22e07a"], ["OFFICERS", ["officer"], "#a78bfa"], ["SENIOR NCOs", ["staff_nco"], "#00D9FF"]];
  const all = us.filter((u) => isMember(u) && tiers.some(([, r]) => r.includes(u.role)));
  const onN = all.filter((u) => on.has(u.id)).length;
  root.querySelector(".body").innerHTML =
    `<div class="cs-sum"><span><b>${all.length}</b> IN THE CHAIN OF COMMAND</span><span class="ok"><b>${onN}</b> ONLINE NOW</span></div>` +
    tiers
      .map(([t, roles, c]) => {
        const ppl = us.filter((u) => roles.includes(u.role) && isMember(u)).sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
        return `<section class="cs-tier" style="--c:${c}" aria-label="${t}"><div class="cs-th"><b>${t}</b><span>${ppl.length}</span></div><div class="cs-grid">${
          ppl
            .map((u) => `<button class="cs-pc" data-user="${esc(u.id)}" aria-label="${esc(memberName(u))} — open personnel file">${hexAvatar(u, "md")}<span class="cs-tx"><b>${esc(memberName(u))}</b><small>${esc(String(u.rank || "").split("/").pop().trim().toUpperCase() || RL[u.role])}${u.platoon ? " · " + esc(String(u.platoon).toUpperCase()) : ""}</small></span><i class="${on.has(u.id) ? "on" : ""}">${on.has(u.id) ? "● ONLINE" : "○ OFFLINE"}</i></button>`)
            .join("") || `<div class="cs-none">NO ${t} ASSIGNED</div>`
        }</div></section>`;
      })
      .join("");
}

/* ─────────────────────────────── PROMOTIONS ─────────────────────────────── */
let assignable = [];
async function renderPromote() {
  const root = document.getElementById("cmdPromoteV2");
  if (!root) return;
  const [us, acc] = await Promise.all([loadUsers(true), fetch("/api/terminal/access", { cache: "no-store" }).then((r) => r.json())]);
  assignable = acc.assignable || [];
  const me = acc.me;
  const list = us.filter((u) => isMember(u) && ["nco", "staff_nco", "officer", "developer", "commander"].includes(u.role)).sort((a, b) => ["commander", "officer", "developer", "staff_nco", "nco"].indexOf(a.role) - ["commander", "officer", "developer", "staff_nco", "nco"].indexOf(b.role) || rankOrder(a.rank) - rankOrder(b.rank));
  root.querySelector("tbody").innerHTML = list
    .map((u) => {
      const locked = u.id === me.uid ? "YOU" : !assignable.includes(u.role) ? (u.role === "commander" ? "🔒 COMMANDER ONLY" : "&nbsp;") : "";
      return `<tr><td><b>${esc(memberName(u))}</b></td><td class="dim">${esc(u.rank || "—")}</td><td><span class="pill r-${u.role}">${RL[u.role]}</span></td>
        <td>${locked ? `<span class="dim">${locked}</span>` : `<select class="fld sm" data-newrole="${esc(u.id)}" aria-label="New role for ${esc(memberName(u))}"><option value="">— NO CHANGE —</option>${["staff_nco", "officer", "developer", "commander", "nco"].filter((r) => r !== u.role && assignable.includes(r)).map((r) => `<option value="${r}">${RL[r]}</option>`).join("")}</select>`}</td>
        <td class="ra">${locked ? "" : `<button class="b sm" data-apply="${esc(u.id)}">APPLY</button>`}</td></tr>`;
    })
    .join("");
}
function confirmPromote(uid) {
  const u = users.find((x) => x.id === uid);
  const sel = document.querySelector(`[data-newrole="${CSS.escape(uid)}"]`);
  const to = sel?.value;
  if (!u || !to) return notify("PICK A NEW ROLE FIRST", 1);
  const name = memberName(u);
  openModal(
    `<div class="hd"><div><h2 style="color:#f59e0b">CONFIRM COMMAND ROLE CHANGE</h2><small>${esc(name)}: ${RL[u.role]} → ${RL[to]}</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><p style="font-size:12px;line-height:1.7;margin:0 0 12px">${["officer", "developer", "commander"].includes(to) ? "This gives command-tier access." : "This changes their terminal access."} Logged as ⚠ sensitive.</p>
      <label class="lbl" for="cpN">TYPE <b style="color:#fff">${esc(u.callsign || u.lastName || name)}</b> TO CONFIRM</label><input class="fld" id="cpN" autocomplete="off"></div>
    <div class="ft"><span></span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" id="cpGo" disabled>CONFIRM</button></div></div>`,
    { color: "rgba(245,158,11,.6)", title: "#f59e0b", width: 520 },
  );
  const want = String(u.callsign || u.lastName || name).trim().toLowerCase();
  const inp = document.getElementById("cpN"), go = document.getElementById("cpGo");
  inp.addEventListener("input", () => (go.disabled = inp.value.trim().toLowerCase() !== want));
  go.addEventListener("click", async () => {
    go.disabled = true;
    try {
      await updateDoc(doc(db, "users", uid), { role: to });
      await audit("security", "ROLE CHANGED", `${name}: ${RL[u.role]} → ${RL[to]} (Command Promotions)`);
      await notifyMember(uid, "promotion", "Your role has changed", `New role: ${RL[to]}`).catch(() => {});
      closeModal();
      notify("✓ ROLE CHANGED");
      renderPromote();
    } catch (e) {
      notify("FAILED: " + e.message, 1);
      go.disabled = false;
    }
  });
}

/* ─────────────────────────────── SUSPENSIONS ────────────────────────────── */
let spick = "", sq = "";
async function renderSuspend(force) {
  const root = document.getElementById("cmdSuspendV2");
  if (!root) return;
  const us = await loadUsers(force);
  // Timed suspensions that have ended: restore them now.
  const expired = us.filter((u) => u.suspended === true && u.suspendedUntil && Date.parse(u.suspendedUntil) <= Date.now());
  for (const u of expired) {
    await updateDoc(doc(db, "users", u.id), { suspended: false, restoredAtISO: nowISO(), restoredBy: "auto (time served)" }).catch(() => {});
    u.suspended = false;
    await audit("command", "ACCOUNT REINSTATE", `${memberName(u)} — suspension ended`).catch(() => {});
  }
  const cand = us.filter((u) => isMember(u) && u.role !== "commander" && !u.suspended && memberName(u).toLowerCase().includes(sq.toLowerCase())).slice(0, 8);
  root.querySelector(".pick").innerHTML = sq
    ? cand.map((u) => `<button class="pk ${u.id === spick ? "on" : ""}" data-spick="${esc(u.id)}">${esc(memberName(u))}<small>${RL[u.role] || ""}</small></button>`).join("") || '<span class="dim">NO MATCH</span>'
    : spick
      ? `<button class="pk on" data-spick="${esc(spick)}">${esc(memberName(us.find((u) => u.id === spick)))}</button>`
      : "";
  const sus = us.filter((u) => u.suspended === true);
  root.querySelector(".list").innerHTML =
    sus
      .map((u) => {
        const left = u.suspendedUntil ? Math.max(0, Math.ceil((Date.parse(u.suspendedUntil) - Date.now()) / 86400000)) : null;
        return `<div class="sr"><div class="srh"><b>${esc(memberName(u))}</b><span class="pill" style="--c:#ff4d4d">${left == null ? "UNTIL RESTORED" : `${left} DAY${left === 1 ? "" : "S"} LEFT`}</span></div><p>${esc(u.suspendReason || "No reason recorded")}</p>
          <div class="srf"><small>${esc(u.suspendedByName || "—")}${u.suspendedAtISO ? " · " + ukDate(u.suspendedAtISO) : ""}</small><span style="flex:1"></span><button class="b sm" data-restore="${esc(u.id)}">↺ RESTORE NOW</button></div></div>`;
      })
      .join("") || '<div class="empty">NOBODY IS SUSPENDED</div>';
}
async function suspend() {
  const root = document.getElementById("cmdSuspendV2");
  const u = users.find((x) => x.id === spick);
  const reason = root.querySelector("#suR").value.trim();
  if (!u) return notify("PICK A MEMBER", 1);
  if (reason.length < 3) return notify("GIVE A REASON — THEY SEE IT ON THE ACCESS DENIED SCREEN", 1);
  const days = +root.querySelector("#suL").value;
  if (!(await ask({ kind: "warn", title: "SUSPEND MEMBER?", body: `They are signed out everywhere and can't sign in${days ? ` for ${days} days` : " until restored"}.`, item: memberName(u), go: "SUSPEND" }))) return;
  const me = await getMe();
  try {
    await updateDoc(doc(db, "users", u.id), { suspended: true, suspendReason: reason, suspendedUntil: days ? new Date(Date.now() + days * 86400000).toISOString() : null, suspendedAtISO: nowISO(), suspendedBy: me?.uid || "", suspendedByName: memberName(me) });
    await audit("command", "ACCOUNT SUSPEND", `${memberName(u)} — ${days ? days + " days" : "until restored"} — ${reason}`);
    if (root.querySelector("#suNot").checked) await notifyMember(u.id, "warning", "Your account has been suspended", reason).catch(() => {});
    if (root.querySelector("#suDisc").checked && u.discordId) await queue("moderation.timeout", { userId: u.discordId, minutes: Math.min(days || 7, 28) * 1440, reason });
    if (typeof window.cmdBroadcastNotif === "function") await window.cmdBroadcastNotif("warning", "ACCOUNT SUSPENDED", `${memberName(u)} has been suspended by ${memberName(me)}.`, ["commander", "officer", "developer", "staff_nco", "nco"]);
    spick = "";
    sq = "";
    root.querySelector("#suQ").value = "";
    root.querySelector("#suR").value = "";
    notify("⛔ SUSPENDED — SIGNED OUT EVERYWHERE");
    renderSuspend(true);
  } catch (e) {
    notify("FAILED: " + e.message, 1);
  }
}
async function restore(uid) {
  const u = users.find((x) => x.id === uid);
  if (!u || !(await ask({ kind: "ok", title: "RESTORE MEMBER?", body: "They can sign in again.", item: memberName(u), go: "RESTORE" }))) return;
  const me = await getMe();
  try {
    await updateDoc(doc(db, "users", uid), { suspended: false, restoredAtISO: nowISO(), restoredBy: memberName(me) });
    await audit("command", "ACCOUNT REINSTATE", memberName(u));
    await notifyMember(uid, "info", "Your account has been restored", "You can sign in again.").catch(() => {});
    notify("✓ RESTORED");
    renderSuspend(true);
  } catch (e) {
    notify("FAILED: " + e.message, 1);
  }
}

/* ─────────────────────────────── OVERALL STATUS ─────────────────────────── */
async function renderOverall() {
  const root = document.getElementById("cmdOverallV2");
  if (!root) return;
  const t0 = performance.now();
  const [us, ev, jobs, att, aars] = await Promise.all([
    loadUsers(true), getDocs(collection(db, "community_events")), getDocs(collection(db, "bot_jobs")), getDocs(collection(db, "attendance_events")), getDocs(collection(db, "aars")),
  ]);
  const dbMs = Math.round(performance.now() - t0);
  const cort = await cortanaStatus();
  const wk = Date.now() - 7 * 86400000;
  const pending = jobs.docs.filter((d) => d.data().status === "pending").length;
  const up = ev.docs.filter((d) => d.data().status !== "cancelled" && Date.parse(d.data().startAtISO) > Date.now()).length;
  const svc = [
    ["WEBSITE", "ok", "● ONLINE", "YOU'RE USING IT"],
    ["DATABASE (MONGODB)", dbMs < 1500 ? "ok" : "warn", dbMs < 1500 ? "● ONLINE" : "▲ SLOW", `${dbMs} ms FOR 5 QUERIES`],
    cort.online ? ["CORTANA v2", "ok", "● ONLINE", `${cort.pingMs} MS PING · QUEUED JOBS: ${pending}`] : cort.lastHeartbeatISO ? ["CORTANA v2", "bad", "✕ OFFLINE", `LAST SEEN ${new Date(cort.lastHeartbeatISO).toLocaleString("en-GB")} · QUEUED: ${pending}`] : ["CORTANA v2", "off", "○ NOT RUNNING YET", `QUEUED DISCORD JOBS: ${pending}`],
    ["FIREBASE (OLD SITE)", "warn", "▲ STILL LIVE", "KEEP UNTIL CUT-OVER IS APPROVED"],
    ["505TH HUB", "off", "○ NOT CONNECTED", "DESKTOP APP NOT BUILT YET"],
  ];
  root.querySelector(".body").innerHTML = `
    <div class="kp"><div><b>${us.filter((u) => u.status === "active").length}</b><span>ACTIVE MEMBERS</span></div><div><b>${us.filter((u) => u.status === "pending").length}</b><span>WAITING FOR BCT APPROVAL</span></div><div><b>${up}</b><span>UPCOMING EVENTS</span></div><div><b style="color:${us.some((u) => u.suspended) ? "#ff4d4d" : "#00D9FF"}">${us.filter((u) => u.suspended).length}</b><span>SUSPENDED</span></div></div>
    <div class="svc">${svc.map(([n, c, s, d]) => `<div class="sc ${c}"><div class="sh"><b>${n}</b><span>${s}</span></div><div class="sm2">${d}</div></div>`).join("")}</div>
    <div class="cd" style="margin-top:14px"><span class="lbl" style="margin-top:0">LAST 7 DAYS</span>
      <div class="kvr"><span>NEW SIGN-UPS</span><b>${us.filter((u) => Date.parse(u.createdAt || u.registeredAt || 0) > wk).length}</b></div>
      <div class="kvr"><span>OPS LOGGED</span><b>${att.docs.filter((d) => Date.parse(d.data().date || 0) > wk).length}</b></div>
      <div class="kvr"><span>AARS SUBMITTED</span><b>${aars.docs.filter((d) => Date.parse(d.data().submittedAt || 0) > wk).length}</b></div>
      <div class="kvr"><span>BCT APPROVALS</span><b>${us.filter((u) => Date.parse(u.approvedAt || 0) > wk).length}</b></div></div>
    <p class="hint">Uptime history and website visits appear once Cortana v2 and the status sampler are running (same as RCD Hub).</p>`;
}

/* ───────────────────────────────── BOT SERVER ───────────────────────────── */
async function renderBot() {
  const root = document.getElementById("cmdBotV2");
  if (!root) return;
  const [s, cort] = await Promise.all([getDocs(collection(db, "bot_jobs")), cortanaStatus()]);
  const jobs = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));
  root.querySelector(".body").innerHTML = `
    ${(() => {
      const c = cort;
      const up = c.startedAtISO ? Math.floor((Date.now() - Date.parse(c.startedAtISO)) / 60000) : null;
      const g = (v, col) => `<b style="color:${c.online ? col : "#4b5765"}">${c.online && v != null ? v : "—"}</b>`;
      return `${c.online ? "" : `<div class="note">${c.lastHeartbeatISO ? `✕ Cortana is OFFLINE — last seen ${esc(new Date(c.lastHeartbeatISO).toLocaleString("en-GB"))}${c.stopReason ? ` (${esc(c.stopReason)})` : ""}.` : "◷ Cortana v2 hasn't started yet. Start it on the server (see apps/cortana/README.md)."} Restart / shut down buttons and the live log come in a later Cortana update.</div>`}
      <div class="kp"><div><b style="color:${c.online ? "#22e07a" : c.lastHeartbeatISO ? "#ff4d4d" : "#4b5765"}">${c.online ? "ONLINE" : "OFFLINE"}</b><span>STATUS</span></div><div>${g(up != null ? `${Math.floor(up / 1440)}d ${Math.floor((up % 1440) / 60)}h ${up % 60}m` : null, "#fff")}<span>UPTIME</span></div><div>${g(c.cpuPercent != null ? c.cpuPercent + "%" : null, "#22e07a")}<span>CPU</span></div><div>${g(c.memoryMb != null ? c.memoryMb + " MB" : null, "#fff")}<span>MEMORY</span></div></div>
      ${c.botTag ? `<p class="hint">${esc(c.botTag)} · ${esc(c.guildName || "")}${c.memberCount ? ` · ${c.memberCount} members` : ""} · v${esc(c.version || "")}${c.supervised ? " · running under PM2" : " · not under PM2"}</p>` : ""}`;
    })()}
    <div class="cd"><span class="lbl" style="margin-top:0">QUEUED FOR CORTANA (${jobs.filter((j) => j.status === "pending").length} WAITING)</span>
      <table class="t"><tbody>${jobs.slice(0, 40).map((j) => `<tr><td>${esc(j.type)}</td><td class="dim">${esc(JSON.stringify(j.payload || {}).slice(0, 80))}</td><td><span class="pill" style="--c:${j.status === "pending" ? "#f59e0b" : j.status === "failed" ? "#ff4d4d" : "#22e07a"}">${esc(String(j.status).toUpperCase())}</span></td><td class="dim">${ukDate(j.createdAtISO, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td></tr>`).join("") || '<tr><td class="empty">NOTHING QUEUED</td></tr>'}</tbody></table></div>`;
}

/* ────────────────────────────────── SETTINGS ────────────────────────────── */
let stab = "discord";
let S = {};
async function loadSettings() {
  const ids = ["site", "webhooks", "cortana", "audit", "discord_role_map"];
  const snaps = await Promise.all(ids.map((i) => getDoc(doc(db, "settings", i))));
  S = Object.fromEntries(ids.map((i, n) => [i, snaps[n].exists() ? snaps[n].data() : {}]));
  S.discord_role_map.map ||= {};
  renderSettings();
}
const mask = (u) => (u ? "•••••••••••••••" + String(u).slice(-4) : "");
function renderSettings() {
  const root = document.getElementById("cmdSettingsV2");
  if (!root) return;
  root.querySelectorAll("[data-stab]").forEach((b) => b.classList.toggle("on", b.dataset.stab === stab));
  const rm = S.discord_role_map;
  const body = {
    discord: `<label class="lbl" for="sInv" style="margin-top:0">DISCORD INVITE LINK (WEBSITE "JOIN DISCORD" BUTTONS)</label><div class="g2" style="grid-template-columns:1fr auto"><input class="fld" id="sInv" value="${esc(S.site.discord_invite || "")}" placeholder="https://discord.gg/..."><a class="b" href="${esc(S.site.discord_invite || "#")}" target="_blank" rel="noopener">TEST LINK</a></div>
      <div class="act"><span style="flex:1"></span><button class="b gold" data-save="discord">SAVE</button></div>`,
    hooks: `<p class="hint" style="margin-top:0">Where the terminal posts notices. Saved links show as ••••• — paste a new one to replace it; leave empty to keep. <b style="color:#f59e0b">The old links were in the old site's code — replace them all.</b></p>
      ${WEBHOOKS.map(([k, l, d]) => `<div class="hk"><div><b>${l}</b><small>${d}</small></div><input class="fld" data-hook="${k}" placeholder="${S.webhooks[k] ? mask(S.webhooks[k]) + "  (SET — PASTE TO REPLACE)" : "NOT SET — PASTE A DISCORD WEBHOOK LINK"}" autocomplete="off"><span class="pill" style="--c:${S.webhooks[k] ? "#22e07a" : "#4b5765"}">${S.webhooks[k] ? "SET" : "EMPTY"}</span>${S.webhooks[k] ? `<button class="b sm red" data-hookclear="${k}">CLEAR</button>` : "<span></span>"}</div>`).join("")}
      <div class="act"><span style="flex:1"></span><button class="b gold" data-save="hooks">SAVE</button></div>`,
    cortana: `<div class="kvr"><span>STATUS</span><b style="color:#7d8a99">○ NOT RUNNING (CORTANA v2 PENDING)</b></div>
      <div class="g2">${[["memberLog", "MEMBER JOIN / LEAVE LOG"], ["modLog", "MODERATION LOG"], ["messageLog", "MESSAGE LOG (DELETED / EDITED)"], ["welcome", "WELCOME MESSAGE"]].map(([k, l]) => `<div><label class="lbl">${l}</label><input class="fld" data-cort="${k}Channel" value="${esc(S.cortana[k + "Channel"] || "")}" placeholder="channel name, or empty = off"></div>`).join("")}</div>
      <span class="lbl">PRESENCE</span><div class="g2"><select class="fld" data-cort="activityType">${["watching", "playing", "listening", "competing"].map((t) => `<option ${S.cortana.activityType === t ? "selected" : ""}>${t}</option>`).join("")}</select><input class="fld" data-cort="activityText" value="${esc(S.cortana.activityText || "over the 505th")}"></div>
      <p class="hint">Channel lists become dropdowns once Cortana v2 syncs the Discord channels.</p>
      <div class="act"><span style="flex:1"></span><button class="b gold" data-save="cortana">SAVE</button></div>`,
    site: `<span class="lbl" style="margin-top:0">SIGN-UP PAGE</span><p class="hint" style="margin:0">Follows the recruitment switch in COMMAND → UNIT STATUS (currently <b style="color:${status.recruitmentOpen !== false ? "#22e07a" : "#ff4d4d"}">${status.recruitmentOpen !== false ? "OPEN" : "CLOSED"}</b>).</p>
      <label class="lbl" for="sRet">AUDIT LOG RETENTION</label><select class="fld" id="sRet" style="max-width:280px">${[30, 90, 180, 365, 0].map((d) => `<option value="${d}" ${(S.audit.retentionDays ?? 90) === d ? "selected" : ""}>${d ? d + " DAYS" : "FOREVER"}</option>`).join("")}</select>
      <div class="act"><span style="flex:1"></span><button class="b gold" data-save="site">SAVE</button></div>`,
    roles: `<p class="hint" style="margin-top:0">Each terminal role can give <b style="color:#fff">several Discord roles</b>. Cortana adds them when someone gets the role and removes them when they lose it. Roles with admin permissions or above Cortana's own role are refused by Cortana (same safety check as RCD Guardian).</p>
      <table class="t rm"><thead><tr><th>TERMINAL ROLE</th><th>DISCORD ROLES GIVEN</th></tr></thead><tbody>${MAP_ROLES.map((r) => `<tr><td><b>${RL[r]}</b></td><td><div class="rch">${(rm.map[r] || []).map((d, i) => `<span class="rc">@${esc(d)}<button data-rmdel="${r}:${i}" aria-label="Remove @${esc(d)} from ${RL[r]}">✕</button></span>`).join("")}<input class="addr" data-rmadd="${r}" placeholder="+ ADD ROLE (type, Enter)" aria-label="Add Discord role to ${RL[r]}"></div></td></tr>`).join("")}</tbody></table>
      <label class="ckl"><input type="checkbox" data-rmopt="removeOld" ${rm.removeOld !== false ? "checked" : ""}> REMOVE THE OLD ROLE'S DISCORD ROLES WHEN SOMEONE IS PROMOTED / DEMOTED</label>
      <label class="ckl"><input type="checkbox" data-rmopt="rankRoles" ${rm.rankRoles ? "checked" : ""}> ALSO GIVE RANK ROLES (e.g. @Sergeant) FROM THEIR RANK</label>
      <p class="hint">Type the Discord role name exactly. Once Cortana v2 syncs your server, this becomes a pick-list of real roles.</p>
      <div class="act"><span class="hint" style="margin:0">${Object.values(rm.map).reduce((a, l) => a + l.length, 0)} DISCORD ROLES MAPPED</span><span style="flex:1"></span><button class="b gold" data-save="roles">SAVE</button></div>`,
  }[stab];
  root.querySelector(".tb").innerHTML = body;
}
async function saveSettings(which) {
  const root = document.getElementById("cmdSettingsV2");
  try {
    if (which === "discord") {
      const v = root.querySelector("#sInv").value.trim();
      if (v && !/^https:\/\/(discord\.gg|discord\.com\/invite)\//.test(v)) return notify("THAT DOESN'T LOOK LIKE A DISCORD INVITE LINK", 1);
      await setDoc(doc(db, "settings", "site"), { discord_invite: v }, { merge: true });
      await audit("command", "SETTINGS SAVED", "Discord invite link changed");
    }
    if (which === "hooks") {
      const data = {};
      for (const el of root.querySelectorAll("[data-hook]")) {
        const v = el.value.trim();
        if (!v) continue;
        if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(v)) return notify(`${el.dataset.hook.toUpperCase()}: NOT A DISCORD WEBHOOK LINK`, 1);
        data[el.dataset.hook] = v;
      }
      if (!Object.keys(data).length) return notify("NOTHING TO SAVE — PASTE A NEW LINK FIRST", 1);
      await setDoc(doc(db, "settings", "webhooks"), data, { merge: true });
      await audit("command", "WEBHOOKS SAVED", `Replaced: ${Object.keys(data).join(", ")}`);
    }
    if (which === "cortana") {
      const data = {};
      root.querySelectorAll("[data-cort]").forEach((el) => (data[el.dataset.cort] = el.value.trim().replace(/^#/, "") || null));
      await setDoc(doc(db, "settings", "cortana"), data, { merge: true });
      await audit("command", "SETTINGS SAVED", "Cortana settings");
    }
    if (which === "site") {
      await setDoc(doc(db, "settings", "audit"), { retentionDays: +root.querySelector("#sRet").value }, { merge: true });
      await audit("command", "SETTINGS SAVED", `Audit retention: ${+root.querySelector("#sRet").value || "forever"} days`);
    }
    if (which === "roles") {
      await setDoc(doc(db, "settings", "discord_role_map"), S.discord_role_map);
      await audit("command", "SETTINGS SAVED", "Discord role map");
    }
    notify("✓ SAVED");
    loadSettings();
  } catch (e) {
    notify("SAVE FAILED: " + e.message, 1);
  }
}

/* ─────────────────────────────────── CSS ─────────────────────────────────── */
const CSS2 = `
#cmdStrip{display:flex;gap:18px;align-items:center;padding:7px 18px;border-bottom:1px solid rgba(0,217,255,.18);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;background:#07090d}#cmdStrip b{font-weight:400}
.cmdv2 .cd{border:1px solid var(--l);background:var(--p);padding:16px}
.cmdv2 .lbl{display:block;font-size:9.5px;letter-spacing:2.5px;color:#aeb9c4;margin:14px 0 7px}.cmdv2 .lbl small{color:var(--dd)}
.cmdv2 .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;font:inherit;font-size:12px;outline:0;color:#d6dde6}.cmdv2 .fld.sm{width:auto;padding:4px;font-size:10.5px}.cmdv2 textarea.fld{resize:vertical;line-height:1.5}
.cmdv2 .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cmdv2 .split{display:grid;grid-template-columns:1.1fr 1fr;gap:16px;align-items:start;margin-top:14px}
.cmdv2 .act{display:flex;gap:8px;align-items:center;margin-top:16px}.cmdv2 .hint{font-size:10px;letter-spacing:.5px;color:var(--d);line-height:1.7;margin-top:8px}.cmdv2 .dim{color:var(--d);font-size:10.5px;letter-spacing:1px}
.cmdv2 .ckl{display:flex;gap:8px;align-items:center;font-size:10.5px;letter-spacing:1.2px;color:var(--d);margin-top:8px}
.cmdv2 .opg{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.cmdv2 .opb{border:1px solid var(--l);background:none;padding:14px 8px;cursor:pointer;text-align:center;font:inherit;color:var(--d)}
.cmdv2 .opb b{display:block;font-family:Rajdhani,sans-serif;font-size:15px;letter-spacing:2px}.cmdv2 .opb small{font-size:9.5px;letter-spacing:1px}.cmdv2 .opb.on{border-color:var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 8%,transparent)}
.cmdv2 .gate{width:100%;padding:16px;border:1px solid;background:none;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:16px}
.cmdv2 .banner{border:1px solid var(--c);background:color-mix(in srgb,var(--c) 8%,#07090d);padding:10px 14px;display:flex;gap:12px;align-items:center;font-size:12px}.cmdv2 .banner b{color:var(--c);letter-spacing:2px;font-family:Rajdhani,sans-serif;font-size:14px;white-space:nowrap}
.cmdv2 .pill{font-size:9.5px;letter-spacing:1.5px;border:1px solid var(--c,#7d8a99);color:var(--c,#7d8a99);padding:2px 7px;white-space:nowrap}
.cmdv2 .r-commander{--c:#f59e0b}.cmdv2 .r-officer,.cmdv2 .r-developer{--c:#a78bfa}.cmdv2 .r-staff_nco{--c:#00D9FF}.cmdv2 .r-nco{--c:#38bdf8}
.cmdv2 .t{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--l);background:var(--p)}.cmdv2 .t th{text-align:left;font-size:9.5px;letter-spacing:2px;color:var(--d);font-weight:400;padding:9px 12px;border-bottom:1px solid var(--l)}.cmdv2 .t td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04)}.cmdv2 .t td b{font-family:Rajdhani,sans-serif;color:#fff;font-size:14px}.cmdv2 .ra{text-align:right}
.cmdv2 .seg{display:flex;gap:4px}.cmdv2 .seg button{flex:1;background:none;border:1px solid var(--l);color:var(--d);padding:8px;font:inherit;font-size:10px;letter-spacing:1.5px;cursor:pointer}.cmdv2 .seg button.on{border-color:var(--a);color:var(--a);background:rgba(0,217,255,.06)}
.cmdv2 .sr{border:1px solid var(--l);background:var(--p);padding:12px 14px;margin-bottom:8px}.cmdv2 .sr.pin{border-left:3px solid var(--a)}.cmdv2 .srh{display:flex;justify-content:space-between;gap:8px;align-items:center}.cmdv2 .srh b{font-family:Rajdhani,sans-serif;font-size:15px;color:#fff}.cmdv2 .sr p{margin:6px 0;font-size:12px;color:#c6d0da;line-height:1.5;white-space:pre-wrap}.cmdv2 .srf{display:flex;gap:6px;align-items:center}.cmdv2 .sr small{font-size:9.5px;color:var(--d);letter-spacing:1px}
.cmdv2 .sub{margin-bottom:16px}
.cmdv2 .cs-sum{display:flex;gap:24px;font-size:10px;letter-spacing:2px;color:var(--d);margin-bottom:14px}.cmdv2 .cs-sum b{font-family:Rajdhani,sans-serif;font-size:18px;color:#fff;margin-right:6px}.cmdv2 .cs-sum .ok b{color:var(--g)}
.cmdv2 .cs-tier{border:1px solid var(--l);border-left:3px solid var(--c);background:var(--p);margin-bottom:12px}
.cmdv2 .cs-th{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--l)}.cmdv2 .cs-th b{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:13px;color:var(--c)}.cmdv2 .cs-th span{font-size:10px;color:var(--d);border:1px solid var(--l);padding:0 6px}
.cmdv2 .cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;padding:12px 14px}
.cmdv2 .cs-pc{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;border:1px solid var(--l);background:#0e131b;padding:10px 12px;cursor:pointer;text-align:left;font:inherit;color:inherit}
.cmdv2 .cs-pc:hover,.cmdv2 .cs-pc:focus-visible{border-color:var(--c);outline:0}.cmdv2 .cs-pc .hx{grid-row:1/3}
.cmdv2 .cs-tx{min-width:0}.cmdv2 .cs-tx b{display:block;font-family:Rajdhani,sans-serif;font-size:15px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cmdv2 .cs-tx small{display:block;font-size:9.5px;letter-spacing:1.5px;color:var(--d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmdv2 .cs-pc i{font-style:normal;font-size:9.5px;letter-spacing:1.5px;color:var(--d)}.cmdv2 .cs-pc i.on{color:var(--g)}
.cmdv2 .cs-none{grid-column:1/-1;font-size:10px;letter-spacing:2px;color:var(--d);border:1px dashed var(--l);padding:12px;text-align:center}
.cmdv2 .ppl{display:flex;gap:10px;flex-wrap:wrap}.cmdv2 .pc{border:1px solid var(--l);border-top:2px solid var(--c);background:var(--p);padding:12px 14px;min-width:210px;cursor:pointer;text-align:left;font:inherit;color:inherit}.cmdv2 .pc b{display:block;font-family:Rajdhani,sans-serif;font-size:16px;color:#fff}.cmdv2 .pc small{font-size:9.5px;letter-spacing:1.5px;color:var(--d)}.cmdv2 .pc i{display:block;font-style:normal;font-size:9.5px;color:var(--d);margin-top:6px;letter-spacing:1px}.cmdv2 .pc i.on{color:var(--g)}
.cmdv2 .warn,.cmdv2 .note{border:1px solid rgba(245,158,11,.5);background:rgba(245,158,11,.06);color:#f5c26b;padding:10px 14px;font-size:11.5px;margin-bottom:14px;line-height:1.6}
.cmdv2 .pick{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cmdv2 .pk{border:1px solid var(--l);background:none;color:#d6dde6;padding:6px 10px;font:inherit;font-size:11.5px;cursor:pointer}.cmdv2 .pk small{display:block;font-size:9px;color:var(--d)}.cmdv2 .pk.on{border-color:var(--r);color:var(--r)}
.cmdv2 .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.cmdv2 .kp>div{border:1px solid var(--l);background:var(--p2);padding:12px;text-align:center}.cmdv2 .kp b{display:block;font-family:Rajdhani,sans-serif;font-size:24px;color:var(--a)}.cmdv2 .kp span{font-size:9px;letter-spacing:2px;color:var(--d)}
.cmdv2 .svc{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cmdv2 .sc{border:1px solid var(--l);border-left:3px solid var(--sc);background:var(--p);padding:14px}.cmdv2 .sc.ok{--sc:#22e07a}.cmdv2 .sc.warn{--sc:#f59e0b}.cmdv2 .sc.off{--sc:#4b5765}.cmdv2 .sc.bad{--sc:#ff4d4d}
.cmdv2 .sh{display:flex;justify-content:space-between;font-size:10.5px;letter-spacing:1.5px;gap:8px}.cmdv2 .sh b{font-family:Rajdhani,sans-serif;font-size:15px;color:#fff;letter-spacing:2px}.cmdv2 .sh span{color:var(--sc);white-space:nowrap}.cmdv2 .sm2{font-size:10px;color:var(--d);letter-spacing:1px;margin-top:6px}
.cmdv2 .kvr{display:flex;justify-content:space-between;font-size:11.5px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}.cmdv2 .kvr span{color:var(--d);letter-spacing:1.5px;font-size:10px}.cmdv2 .kvr b{font-weight:400;color:#fff}
.cmdv2 .tabs2{display:flex;gap:4px;margin:14px 0 12px;flex-wrap:wrap}.cmdv2 .tabs2 button{background:none;border:1px solid var(--l);color:var(--d);padding:8px 14px;font:inherit;font-size:10.5px;letter-spacing:2px;cursor:pointer}.cmdv2 .tabs2 button.on{color:var(--am);border-color:var(--am)}
.cmdv2 .hk{display:grid;grid-template-columns:220px 1fr auto auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)}.cmdv2 .hk b{display:block;font-size:11.5px;letter-spacing:1.5px;color:#fff;font-weight:400}.cmdv2 .hk small{font-size:9.5px;color:var(--d)}
.cmdv2 a.b{text-decoration:none}
.cmdv2 .rch{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.cmdv2 .rc{display:inline-flex;gap:6px;align-items:center;border:1px solid #5865F2;color:#a5b0ff;padding:3px 4px 3px 8px;font-size:11px;background:rgba(88,101,242,.1)}.cmdv2 .rc button{background:none;border:0;color:inherit;cursor:pointer;font-size:11px;padding:0 3px}
.cmdv2 .addr{background:#070a0f;border:1px dashed rgba(0,217,255,.35);color:#00D9FF;font:inherit;font-size:10.5px;padding:4px 8px;min-width:190px;outline:0}
@media(max-width:1100px){.cmdv2 .split,.cmdv2 .g2,.cmdv2 .svc,.cmdv2 .kp,.cmdv2 .opg{grid-template-columns:1fr 1fr}.cmdv2 .tier{grid-template-columns:1fr}.cmdv2 .hk{grid-template-columns:1fr}}
`;

function mount(panel, id, title, sub, inner, onShow) {
  const root = mountPanel(panel, id, () => Promise.resolve(onShow()).catch((e) => notify(`${title} LOAD FAILED: ` + e.message, 1)));
  if (!root) return null;
  root.classList.add("cmdv2");
  root.innerHTML = `<div class="h1">${title}</div><div class="sub">${sub}</div>${inner}`;
  return root;
}

onReady(() => {
  addCss("commandV2", CSS2);
  // Command strip (only shown to people with Command access, under the top bar).
  import("./nav-v2.js").then(({ onAccess }) =>
    onAccess((me) => {
      if (!me.access.set) return;
      const top = document.querySelector(".top-bar");
      if (top && !document.getElementById("cmdStrip")) {
        top.insertAdjacentHTML("afterend", '<div id="cmdStrip"></div>');
        loadStatus().catch(() => {});
      }
    }),
  );

  const us = mount("panel-cmd-status", "cmdStatusV2", "UNIT STATUS", "WHAT THE WHOLE UNIT SEES — WEBSITE BANNER, DASHBOARD AND ALERTS", '<div class="body"><div class="empty">LOADING...</div></div>', async () => {
    await loadStatus();
    st = { ...status, opStatus: status.opStatus || "Active" };
    renderStatus();
  });
  us?.addEventListener("click", (e) => {
    const op = e.target.closest("[data-op]");
    if (op) return (st.opStatus = op.dataset.op), (st.statusMessage = document.getElementById("usMsg").value), renderStatus();
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "gate") return (st.recruitmentOpen = st.recruitmentOpen === false), (st.statusMessage = document.getElementById("usMsg").value), renderStatus();
    if (a === "save") saveStatus();
  });
  us?.addEventListener("input", (e) => e.target.id === "usMsg" && (document.getElementById("usPrev").textContent = e.target.value.trim() || "—"));

  const sr = mount("panel-cmd-sitrep", "cmdSitrepV2", "SITREP", "INTERNAL SITUATION REPORTS FROM COMMAND — STAFF SEE THE LATEST ON THEIR DASHBOARD",
    `<div class="split"><div class="cd"><span class="lbl" style="margin-top:0">NEW SITREP</span><input class="fld" id="srT" maxlength="120" placeholder="TITLE — e.g. Week 46 command intent">
      <span class="lbl">WHO CAN READ IT</span><div class="seg">${VIS.map(([k, l]) => `<button data-vis="${k}">${l}</button>`).join("")}</div>
      <label class="lbl" for="srB">REPORT</label><textarea class="fld" id="srB" rows="8" maxlength="4000" placeholder="Situation · Mission · Execution · Admin · Command"></textarea>
      <div class="g2"><label class="ckl"><input type="checkbox" id="srPin" checked> PIN ON DASHBOARD</label><label class="ckl"><input type="checkbox" id="srAlert" checked> ALERT READERS</label></div>
      <div class="act"><span style="flex:1"></span><button class="b gold" data-act="send">✉ TRANSMIT SITREP</button></div></div>
      <div><span class="lbl" style="margin-top:0">TRANSMITTED</span><div class="list"></div></div></div>`, loadSitrep);
  sr?.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-vis]");
    if (v) return (vis = v.dataset.vis), renderSitrep();
    if (e.target.closest("[data-act=send]")) return sendSitrep();
    const p = e.target.closest("[data-pin]");
    if (p) {
      const f = fragos.find((x) => x.id === p.dataset.pin);
      if (!f.pinned) await Promise.all(fragos.filter((x) => x.pinned).map((x) => updateDoc(doc(db, "fragos", x.id), { pinned: false })));
      await updateDoc(doc(db, "fragos", f.id), { pinned: !f.pinned }).catch((err) => notify(err.message, 1));
      return loadSitrep();
    }
    const d = e.target.closest("[data-fdel]");
    if (d && (await ask({ kind: "danger", title: "DELETE SITREP?", body: "It is removed from the dashboard for everyone.", warn: "THIS CANNOT BE UNDONE.", go: "DELETE SITREP" }))) {
      try {
        const f = fragos.find((x) => x.id === d.dataset.fdel);
        await deleteDoc(doc(db, "fragos", d.dataset.fdel));
        await audit("command", "SITREP DELETED", f?.title || d.dataset.fdel);
        window.loadDashSitrep?.();
      } catch (err) {
        notify("DELETE FAILED: " + err.message, 1);
      }
      loadSitrep();
    }
  });

  const cs = mount("panel-cmd-staff", "cmdStaffV2", "COMMAND STAFF", "COMMAND, DEVELOPERS, OFFICERS AND SENIOR NCOS — WHO IS IN THE CHAIN OF COMMAND", '<div class="body"><div class="empty">LOADING...</div></div><p class="hint">Click a person to open their personnel file. Access per person is set in SECURITY → OFFICER MANAGEMENT.</p>', renderStaff);
  cs?.addEventListener("click", (e) => {
    const u = e.target.closest("[data-user]");
    if (u && typeof window.openEditUser === "function") window.openEditUser(u.dataset.user);
    else if (u) window.showPanel("panel-active");
  });

  const pr = mount("panel-cmd-promote", "cmdPromoteV2", "COMMAND PROMOTIONS", "ASSIGN COMMAND-TIER ROLES — OFFICER, DEVELOPER, COMMANDER",
    '<div class="warn">⚠ These roles get full terminal access. Only the Commander can make or remove a Commander. Every change is logged as ⚠ sensitive.</div><table class="t"><thead><tr><th>MEMBER</th><th>RANK</th><th>CURRENT ROLE</th><th>NEW ROLE</th><th></th></tr></thead><tbody><tr><td class="empty">LOADING...</td></tr></tbody></table>', renderPromote);
  pr?.addEventListener("click", (e) => {
    const a = e.target.closest("[data-apply]");
    if (a) confirmPromote(a.dataset.apply);
  });

  const su = mount("panel-cmd-suspend", "cmdSuspendV2", "SUSPENSIONS", "SUSPEND A MEMBER — SIGNS THEM OUT EVERYWHERE AND BLOCKS SIGN-IN UNTIL RESTORED",
    `<div class="split"><div class="cd"><label class="lbl" for="suQ" style="margin-top:0">SUSPEND A MEMBER</label><input class="fld" id="suQ" placeholder="SEARCH MEMBER..." autocomplete="off"><div class="pick"></div>
      <label class="lbl" for="suR">REASON * (THEY SEE THIS ON THE ACCESS DENIED SCREEN)</label><textarea class="fld" id="suR" rows="3" maxlength="300"></textarea>
      <div class="g2"><div><label class="lbl" for="suL">LENGTH</label><select class="fld" id="suL"><option value="0">UNTIL RESTORED</option><option value="7">7 DAYS</option><option value="14">14 DAYS</option><option value="30">30 DAYS</option></select></div>
        <div><span class="lbl">ALSO</span><label class="ckl"><input type="checkbox" id="suDisc"> TIMEOUT IN DISCORD (CORTANA v2)</label><label class="ckl"><input type="checkbox" id="suNot" checked> NOTIFY THEM</label></div></div>
      <div class="act"><span style="flex:1"></span><button class="b red" data-act="sus">⛔ SUSPEND</button></div></div>
      <div><span class="lbl" style="margin-top:0">CURRENTLY SUSPENDED</span><div class="list"></div></div></div>`, () => renderSuspend(true));
  su?.addEventListener("input", (e) => {
    if (e.target.id !== "suQ") return;
    sq = e.target.value;
    renderSuspend(false);
  });
  su?.addEventListener("click", (e) => {
    const p = e.target.closest("[data-spick]");
    if (p) return (spick = p.dataset.spick), (sq = ""), (document.getElementById("suQ").value = memberName(users.find((u) => u.id === spick))), renderSuspend(false);
    if (e.target.closest("[data-act=sus]")) return suspend();
    const r = e.target.closest("[data-restore]");
    if (r) restore(r.dataset.restore);
  });

  mount("panel-overall", "cmdOverallV2", "OVERALL STATUS", "THE WHOLE 505TH COMMAND NETWORK AT A GLANCE", '<div class="body"><div class="empty">LOADING...</div></div>', renderOverall);
  mount("panel-bot", "cmdBotV2", "BOT SERVER", "CORTANA PROCESS — STATUS, LOG, RELOAD AND RESTART", '<div class="body"><div class="empty">LOADING...</div></div>', renderBot);

  const se = mount("panel-cmd-settings", "cmdSettingsV2", "SETTINGS", "COMMANDER / DEVELOPER ONLY — WEBHOOK LINKS ARE NEVER SHOWN IN FULL",
    `<div class="tabs2">${[["discord", "DISCORD"], ["hooks", "WEBHOOKS"], ["cortana", "CORTANA"], ["site", "WEBSITE"], ["roles", "DISCORD ROLE MAP"]].map(([k, l]) => `<button data-stab="${k}">${l}</button>`).join("")}</div><div class="cd tb"><div class="empty">LOADING...</div></div>`,
    async () => {
      await loadStatus();
      await loadSettings();
    });
  se?.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-stab]");
    if (t) return (stab = t.dataset.stab), renderSettings();
    const s = e.target.closest("[data-save]");
    if (s) return saveSettings(s.dataset.save);
    const hc = e.target.closest("[data-hookclear]");
    if (hc && (await ask({ kind: "warn", title: `CLEAR ${hc.dataset.hookclear.toUpperCase()} WEBHOOK?`, body: "Notices stop being posted there.", go: "CLEAR" }))) {
      const data = { ...S.webhooks };
      delete data[hc.dataset.hookclear];
      return setDoc(doc(db, "settings", "webhooks"), data).then(() => audit("command", "WEBHOOKS SAVED", `Cleared: ${hc.dataset.hookclear}`)).then(loadSettings).catch((err) => notify(err.message, 1));
    }
    const rd = e.target.closest("[data-rmdel]");
    if (rd) {
      const [r, i] = rd.dataset.rmdel.split(":");
      S.discord_role_map.map[r].splice(+i, 1);
      return renderSettings();
    }
  });
  se?.addEventListener("keydown", (e) => {
    const r = e.target.dataset?.rmadd;
    if (!r || e.key !== "Enter") return;
    e.preventDefault();
    const v = e.target.value.trim().replace(/^@/, "");
    if (!v) return;
    const l = (S.discord_role_map.map[r] ||= []);
    if (!l.includes(v)) l.push(v);
    renderSettings();
    document.querySelector(`[data-rmadd="${r}"]`)?.focus();
  });
  se?.addEventListener("change", (e) => {
    const o = e.target.dataset?.rmopt;
    if (o) S.discord_role_map[o] = e.target.checked;
  });
});
