/**
 * 505th Command Terminal — MEMBER ACTIONS (approved mock 2026-11-11).
 *
 * One shared module for the Roster ⋯ menu and the Personnel File:
 *   Promote · Transfer · Warn · Medals & Ribbons · Edit Stats · Backfill Dates
 *   Service record entry edit / delete (reason → Audit Log).
 *
 * Same rules as the old ctxAction / quickActionSubmit code:
 *   - rank change adds promotionHistory, sets graduation on first E2
 *   - transfer adds platoonHistory and resets joinedPlatoon
 *   - webhooks promote / platoon / warning, member notifications, audit entries
 *   - retired files are frozen; only the Commander can act on the Commander
 */
import { doc, getDoc, updateDoc } from "/terminal-shim/firestore.js";
import {
  db, esc, memberName, RANK_LIST, PLATOON_ORDER, rankOrder, today,
  getMe, getUsers, audit, notifyMember, notify, addCss, openModal, closeModal, ask, tell,
} from "./_common.js";

const EDIT_ROLES = new Set(["commander", "officer", "developer", "staff_nco"]);
const MEDALS = [
  ["Medal of Honor Medal.png", "Medal of Honor"], ["Navy Cross Medal.png", "Navy Cross"], ["Air Force Cross Medal.png", "Air Force Cross"],
  ["Silver Medal.png", "Silver Star"], ["Bronze Star Medal.png", "Bronze Star"], ["Navy Achievement Medal.png", "Navy Achievement Medal"],
  ["Air Force Achivement Medal.png", "Air Force Achievement Medal"], ["POW Medal.png", "POW Medal"],
];
const SEVERITY = [["VERBAL", "#f59e0b"], ["WRITTEN", "#fb923c"], ["FINAL", "#ff4d4d"]];
const LISTS = { promo: "promotionHistory", platoon: "platoonHistory", warn: "warningHistory", commend: "commendationHistory", ribbon: "ribbonHistory" };
const KIND_LABEL = { promo: "PROMOTION", platoon: "TRANSFER", warn: "WARNING", commend: "MEDAL", ribbon: "RIBBON" };

const fire = (key, data) => { try { window.fireWebhook?.(key, data); } catch (_) {} };
const nowISO = () => new Date().toISOString();

/** Fresh copy of the member, so two staff editing at once do not overwrite each other's history. */
async function fresh(uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? { id: uid, ...s.data() } : null;
}
/** Can the signed-in member act on this file? Returns an error string or "". */
async function blocked(u) {
  const me = await getMe();
  if (!EDIT_ROLES.has(me?.role)) return "You do not have authority to edit personnel files.";
  if (u.role === "commander" && me.role !== "commander") return "Only the Commander can change the Commander's file.";
  if (u.role === "retired_veteran") return "This file is retired and frozen.";
  return "";
}
async function byName() {
  const me = await getMe();
  return memberName(me) || me?.callsign || "Unknown";
}
const done = (cb) => { closeModal(); try { cb?.(); } catch (_) {} };

// ───────── shared window chrome ─────────
function win(title, color, body, goLabel, { goClass = "gold", width = 560 } = {}) {
  addCss("maCss", CSS);
  return openModal(`<div class="ma" style="--k:${color}"><div class="ma-h"><b>${title}</b><button class="ma-x" data-close aria-label="Close">✕</button></div>
    <div class="ma-b">${body}</div>
    <div class="ma-f"><span class="ma-err" role="alert"></span><button class="b" data-close>CANCEL</button><button class="b ${goClass}" data-go>${goLabel}</button></div></div>`, { width, color });
}
const err = (ov, m) => { const e = ov.querySelector(".ma-err"); if (e) e.textContent = m || ""; };
const val = (ov, sel) => (ov.querySelector(sel)?.value ?? "").trim();
const who = (u) => `<div class="ma-who">${esc(memberName(u))}<small>${esc(u.rank || "No rank")} · ${esc(u.platoon || "No platoon")}</small></div>`;

// ───────── PROMOTE ─────────
export async function promote(uid, cb) {
  const u = await fresh(uid);
  if (!u) return;
  const no = await blocked(u);
  if (no) return tell("CANNOT PROMOTE", no, "error");
  const cur = u.rank || "";
  const ranks = RANK_LIST.slice().sort((a, b) => rankOrder(b) - rankOrder(a));
  let pick = "";
  const ov = win("▲ PROMOTE / CHANGE RANK", "#22e07a", `${who(u)}
    <label>NEW RANK</label><div class="ma-ranks">${ranks.map((r) => `<button type="button" class="ma-chip ${r === cur ? "cur" : ""}" data-r="${esc(r)}" ${r === cur ? "disabled" : ""}>${esc(r)}${r === cur ? " · NOW" : ""}</button>`).join("")}</div>
    <div class="ma-row"><div><label for="maD">DATE</label><input id="maD" type="date" value="${today()}"></div><div class="ma-dir" aria-live="polite"></div></div>
    <label for="maN">REASON / NOTE</label><input id="maN" maxlength="200" placeholder="e.g. Completed NCO course">
    <label class="ma-ck"><input type="checkbox" id="maPT"> RESET PROMOTION TRACKER (PT) TO 0</label>
    <label class="ma-ck"><input type="checkbox" id="maNt" checked> NOTIFY THE MEMBER + POST TO DISCORD</label>`, "PROMOTE");
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]");
    if (!b) return;
    pick = b.dataset.r;
    ov.querySelectorAll("[data-r]").forEach((x) => x.classList.toggle("on", x === b));
    const up = rankOrder(pick) < rankOrder(cur);
    ov.querySelector(".ma-dir").innerHTML = `<b style="color:${up ? "#22e07a" : "#ff4d4d"}">${esc(cur || "—")} → ${esc(pick)} ${up ? "▲" : "▼ DEMOTION"}</b>`;
    ov.querySelector("[data-go]").textContent = up ? "PROMOTE" : "CHANGE RANK";
  });
  ov.querySelector("[data-go]").onclick = async () => {
    if (!pick) return err(ov, "Pick the new rank.");
    const date = val(ov, "#maD") || today(), note = val(ov, "#maN"), by = await byName();
    const entry = { date, fromRank: cur || "—", toRank: pick, note: note || "Rank changed", addedBy: by, addedAt: nowISO(), auto: false };
    const data = { rank: pick, promotionHistory: [...(u.promotionHistory || []), entry], updatedAt: nowISO() };
    if (pick.startsWith("E2") && !u.graduation) data.graduation = date;
    if (ov.querySelector("#maPT").checked) data.promotionTracker = 0;
    try { await updateDoc(doc(db, "users", uid), data); } catch (x) { return err(ov, "Save failed: " + x.message); }
    const name = memberName(u);
    if (ov.querySelector("#maNt").checked) {
      fire("promote", { name, fromRank: entry.fromRank, toRank: pick, note: entry.note, by });
      notifyMember(uid, "promotion", "Your rank has changed", "New rank: " + pick);
    }
    audit("manpower", "RANK CHANGED", `${name}: ${entry.fromRank} → ${pick}${note ? " (" + note + ")" : ""}`);
    notify("RANK CHANGED: " + name);
    done(cb);
  };
}

// ───────── TRANSFER ─────────
export async function transfer(uid, cb) {
  const u = await fresh(uid);
  if (!u) return;
  const no = await blocked(u);
  if (no) return tell("CANNOT TRANSFER", no, "error");
  const all = await getUsers().catch(() => []);
  const count = (p) => all.filter((x) => x.platoon === p && x.status !== "pending" && x.status !== "denied").length;
  let pick = "";
  const ov = win("⇄ TRANSFER", "#00D9FF", `${who(u)}
    <label>NEW PLATOON</label><div class="ma-grid">${PLATOON_ORDER.map((p) => `<button type="button" class="ma-chip ${p === u.platoon ? "cur" : ""}" data-p="${esc(p)}" ${p === u.platoon ? "disabled" : ""}>${esc(p.toUpperCase())}<small>${count(p)} MEMBERS${p === u.platoon ? " · NOW" : ""}</small></button>`).join("")}</div>
    <div class="ma-row"><div><label for="maD">DATE</label><input id="maD" type="date" value="${today()}"></div><div><label for="maS">SQUAD (OPTIONAL)</label><input id="maS" maxlength="40" value="${esc(u.squad || "")}"></div></div>
    <label for="maN">REASON / NOTE</label><input id="maN" maxlength="200">
    <p class="ma-hint">Platoon service date resets to the transfer date.</p>
    <label class="ma-ck"><input type="checkbox" id="maNt" checked> NOTIFY THE MEMBER + POST TO DISCORD</label>`, "TRANSFER");
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]");
    if (!b) return;
    pick = b.dataset.p;
    ov.querySelectorAll("[data-p]").forEach((x) => x.classList.toggle("on", x === b));
  });
  ov.querySelector("[data-go]").onclick = async () => {
    if (!pick) return err(ov, "Pick the new platoon.");
    const date = val(ov, "#maD") || today(), note = val(ov, "#maN"), by = await byName();
    const entry = { date, from: u.platoon || "—", to: pick, note: note || "Transferred", addedBy: by, addedAt: nowISO(), auto: false };
    const data = { platoon: pick, joinedPlatoon: date, squad: val(ov, "#maS"), platoonHistory: [...(u.platoonHistory || []), entry], updatedAt: nowISO() };
    try { await updateDoc(doc(db, "users", uid), data); } catch (x) { return err(ov, "Save failed: " + x.message); }
    const name = memberName(u);
    if (ov.querySelector("#maNt").checked) {
      fire("platoon", { name, from: entry.from, to: pick, note: entry.note, by });
      notifyMember(uid, "transfer", "You have been transferred to a new platoon", `${entry.from} → ${pick}`);
    }
    audit("manpower", "TRANSFER", `${name}: ${entry.from} → ${pick}${note ? " (" + note + ")" : ""}`);
    notify("TRANSFERRED: " + name + " → " + pick);
    done(cb);
  };
}

// ───────── WARN ─────────
export async function warn(uid, cb) {
  const u = await fresh(uid);
  if (!u) return;
  const no = await blocked(u);
  if (no) return tell("CANNOT WARN", no, "error");
  const n = (u.warningHistory || []).length + 1;
  let sev = "VERBAL";
  const ov = win("⚠ WARN", "#f59e0b", `${who(u)}
    ${n > 1 ? `<div class="ma-alert">THIS WILL BE WARNING #${n} ON THIS FILE.</div>` : ""}
    <label>SEVERITY</label><div class="ma-grid3">${SEVERITY.map(([s, c]) => `<button type="button" class="ma-chip ${s === sev ? "on" : ""}" style="--c:${c}" data-s="${s}">${s}</button>`).join("")}</div>
    <div class="ma-row"><div><label for="maD">DATE</label><input id="maD" type="date" value="${today()}"></div><div><label for="maE">EXPIRES (OPTIONAL)</label><input id="maE" type="date"></div></div>
    <label for="maN">REASON (REQUIRED)</label><textarea id="maN" rows="3" maxlength="400"></textarea>
    <label class="ma-ck"><input type="checkbox" id="maNt" checked> NOTIFY THE MEMBER + POST TO DISCORD</label>`, "FILE WARNING", { goClass: "gold" });
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]");
    if (!b) return;
    sev = b.dataset.s;
    ov.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b));
  });
  ov.querySelector("[data-go]").onclick = async () => {
    const reason = val(ov, "#maN");
    if (reason.length < 3) return err(ov, "A reason is required.");
    const by = await byName();
    const entry = { date: val(ov, "#maD") || today(), severity: sev, note: reason, addedBy: by, addedAt: nowISO() };
    const exp = val(ov, "#maE");
    if (exp) entry.expires = exp;
    try { await updateDoc(doc(db, "users", uid), { warningHistory: [...(u.warningHistory || []), entry], updatedAt: nowISO() }); } catch (x) { return err(ov, "Save failed: " + x.message); }
    const name = memberName(u);
    if (ov.querySelector("#maNt").checked) {
      fire("warning", { name, severity: sev, reason, by });
      notifyMember(uid, "warning", `You have received a ${sev.toLowerCase()} warning`, reason);
    }
    audit("manpower", "WARNING FILED", `${name}: ${sev} warning #${n} — ${reason}`);
    notify("WARNING FILED: " + name);
    done(cb);
  };
}

// ───────── MEDALS & RIBBONS (list · edit · delete · award) ─────────
export async function medals(uid, cb) {
  const u = await fresh(uid);
  if (!u) return;
  const no = await blocked(u);
  if (no) return tell("CANNOT EDIT AWARDS", no, "error");
  const name = memberName(u);
  const rows = [
    ...(u.commendationHistory || []).map((e, i) => ({ t: "commend", i, e })),
    ...(u.ribbonHistory || []).map((e, i) => ({ t: "ribbon", i, e })),
  ].sort((a, b) => String(b.e.date || "").localeCompare(String(a.e.date || "")));
  let img = MEDALS[0][0];
  const ov = win("★ MEDALS & RIBBONS", "#a78bfa", `${who(u)}
    <label>ON RECORD (${rows.length})</label>
    <ul class="ma-list">${rows.map((r) => `<li><span class="ma-tag" style="color:${r.t === "commend" ? "#a78bfa" : "#2dd4bf"}">${KIND_LABEL[r.t]}</span>
      ${r.e.medalImg ? `<img src="/images/medal_emojis/${encodeURIComponent(r.e.medalImg)}" alt="">` : ""}<b>${esc(r.e.title || r.e.name || "Award")}</b><span class="d">${esc(r.e.date || "—")}</span>
      <button class="ma-ic" data-ed="${r.t}:${r.i}" aria-label="Edit">✎</button><button class="ma-ic r" data-del="${r.t}:${r.i}" aria-label="Delete">🗑</button></li>`).join("") || '<li class="none">NOTHING ON RECORD YET.</li>'}</ul>
    <label>AWARD A MEDAL</label><div class="ma-medals">${MEDALS.map(([f, t]) => `<button type="button" class="ma-med ${f === img ? "on" : ""}" data-m="${esc(f)}" title="${esc(t)}"><img src="/images/medal_emojis/${encodeURIComponent(f)}" alt=""><small>${esc(t.toUpperCase())}</small></button>`).join("")}</div>
    <div class="ma-row"><div><label for="maT">TITLE</label><input id="maT" maxlength="80" value="${esc(MEDALS[0][1])}"></div><div><label for="maD">DATE</label><input id="maD" type="date" value="${today()}"></div></div>
    <label for="maN">CITATION</label><textarea id="maN" rows="2" maxlength="400"></textarea>
    <p class="ma-hint">Ribbons for many members at once: Roster → ★ RIBBON.</p>`, "AWARD MEDAL", { width: 620 });
  ov.addEventListener("click", async (e) => {
    const m = e.target.closest("[data-m]");
    if (m) {
      img = m.dataset.m;
      ov.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === m));
      ov.querySelector("#maT").value = MEDALS.find(([f]) => f === img)?.[1] || "";
      return;
    }
    const ed = e.target.closest("[data-ed]")?.dataset.ed, del = e.target.closest("[data-del]")?.dataset.del;
    if (ed) { const [t, i] = ed.split(":"); closeModal(); return editEntry(uid, t, +i, () => medals(uid, cb)); }
    if (del) { const [t, i] = del.split(":"); closeModal(); return deleteEntry(uid, t, +i, () => medals(uid, cb)); }
  });
  ov.querySelector("[data-go]").onclick = async () => {
    const title = val(ov, "#maT");
    if (!title) return err(ov, "A title is required.");
    const by = await byName(), note = val(ov, "#maN");
    const entry = { date: val(ov, "#maD") || today(), title, note, medalImg: img, addedBy: by, addedAt: nowISO() };
    const latest = await fresh(uid);
    try { await updateDoc(doc(db, "users", uid), { commendationHistory: [...(latest.commendationHistory || []), entry], updatedAt: nowISO() }); } catch (x) { return err(ov, "Save failed: " + x.message); }
    notifyMember(uid, "commendation", "You have been awarded: " + title, note || "");
    audit("manpower", "MEDAL AWARDED", `${name}: ${title}${note ? " — " + note : ""}`);
    notify("★ AWARDED: " + title + " → " + name);
    done(cb);
  };
}

// ───────── EDIT STATS ─────────
export async function stats(uid, cb) {
  const u = await fresh(uid);
  if (!u) return;
  const no = await blocked(u);
  if (no) return tell("CANNOT EDIT STATS", no, "error");
  const f = (id, label, v, max) => `<div><label for="${id}">${label}</label><input id="${id}" type="number" min="0" ${max ? `max="${max}"` : ""} value="${Number(v) || 0}"><small class="ma-was">NOW ${Number(v) || 0}</small></div>`;
  const ov = win("✎ EDIT STATS", "#00D9FF", `${who(u)}
    <div class="ma-row4">${f("maA", "ATT PIPS (0–3)", u.attendance, 3)}${f("maP", "PROMOTION TRACKER", u.promotionTracker)}${f("maO", "OPS ATTENDED", u.opsAttended)}${f("maE", "OPS ELIGIBLE", u.opsEligible)}</div>
    <label for="maN">REASON (REQUIRED · SAVED IN THE AUDIT LOG)</label><input id="maN" maxlength="200">
    <p class="ma-hint">Ops attended cannot be more than ops eligible.</p>`, "SAVE STATS");
  ov.querySelector("[data-go]").onclick = async () => {
    const reason = val(ov, "#maN");
    if (reason.length < 3) return err(ov, "A reason is required.");
    const n = (s) => Math.max(0, parseInt(val(ov, s), 10) || 0);
    const att = Math.min(3, n("#maA")), pt = n("#maP"), oa = n("#maO"), oe = Math.max(oa, n("#maE"));
    try { await updateDoc(doc(db, "users", uid), { attendance: att, promotionTracker: pt, opsAttended: oa, opsEligible: oe, updatedAt: nowISO() }); } catch (x) { return err(ov, "Save failed: " + x.message); }
    const name = memberName(u);
    audit("battalion_ops", "ROSTER STATS EDITED", `${name}: att ${u.attendance || 0}→${att}/3, PT ${u.promotionTracker || 0}→${pt}, ops ${u.opsAttended || 0}/${u.opsEligible || 0}→${oa}/${oe} — ${reason}`);
    notify("STATS UPDATED — " + name);
    done(cb);
  };
}

// ───────── BACKFILL PLATOON DATES ─────────
export async function backfill(cb) {
  const me = await getMe();
  if (!EDIT_ROLES.has(me?.role)) return tell("INSUFFICIENT AUTHORITY", "You cannot edit personnel files.", "error");
  const all = (await getUsers()).filter((u) => u.platoon && !u.joinedPlatoon && u.status !== "pending" && u.status !== "denied" && u.role !== "retired_veteran");
  const guess = (u) => String(u.graduation || u.joinedAt || today()).slice(0, 10);
  const ov = win("⟲ BACKFILL PLATOON DATES", "#2dd4bf", all.length
    ? `<p class="ma-hint">${all.length} member(s) have a platoon but no platoon service date. Best guess: BCT date, else join date. Clear a date to skip that member.</p>
      <ul class="ma-list">${all.sort((a, b) => memberName(a).localeCompare(memberName(b))).map((u) => `<li><b>${esc(memberName(u))}</b><span class="d">${esc(u.platoon)}</span><input type="date" data-uid="${esc(u.id)}" value="${guess(u)}" aria-label="Platoon date for ${esc(memberName(u))}"></li>`).join("")}</ul>`
    : '<p class="ma-hint">NO MISSING PLATOON SERVICE DATES — NOTHING TO BACKFILL.</p>', "SAVE DATES", { width: 620 });
  const go = ov.querySelector("[data-go]");
  if (!all.length) go.disabled = true;
  go.onclick = async () => {
    let n = 0;
    go.disabled = true;
    try {
      for (const inp of ov.querySelectorAll("input[data-uid]")) {
        if (!inp.value) continue;
        await updateDoc(doc(db, "users", inp.dataset.uid), { joinedPlatoon: inp.value, updatedAt: nowISO() });
        n++;
      }
    } catch (x) { go.disabled = false; return err(ov, "Backfill failed: " + x.message); }
    audit("battalion_ops", "PLATOON DATES BACKFILLED", `${n} member(s) — via Backfill tool`);
    notify("BACKFILLED: " + n + " MEMBER(S)");
    done(cb);
  };
}

// ───────── SERVICE RECORD: edit / delete one entry ─────────
const FIELDS = {
  promo: [["date", "DATE", "date"], ["fromRank", "FROM RANK"], ["toRank", "TO RANK"], ["note", "NOTE"]],
  platoon: [["date", "DATE", "date"], ["from", "FROM"], ["to", "TO"], ["note", "NOTE"]],
  warn: [["date", "DATE", "date"], ["severity", "SEVERITY"], ["note", "REASON"], ["expires", "EXPIRES", "date"]],
  commend: [["date", "DATE", "date"], ["title", "TITLE"], ["note", "CITATION"]],
  ribbon: [["date", "DATE", "date"], ["title", "TITLE"], ["note", "NOTE"]],
};
const summary = (t, e) => (t === "promo" ? `${e.fromRank || "—"} → ${e.toRank || "—"}` : t === "platoon" ? `${e.from || "—"} → ${e.to || "—"}` : t === "warn" ? `${e.severity || ""} ${e.note || ""}` : e.title || e.name || "");

export async function editEntry(uid, type, i, cb) {
  const u = await fresh(uid);
  const list = u?.[LISTS[type]] || [];
  const e = list[i];
  if (!e) return tell("NOT FOUND", "That entry no longer exists. It may have been changed by someone else.", "error");
  const no = await blocked(u);
  if (no) return tell("CANNOT EDIT", no, "error");
  const ov = win(`✎ EDIT ${KIND_LABEL[type]}`, "#ffd166", `${who(u)}
    <div class="ma-row">${FIELDS[type].map(([k, l, ty]) => `<div class="${k === "note" ? "wide" : ""}"><label for="maF_${k}">${l}</label><input id="maF_${k}" data-k="${k}" ${ty ? `type="${ty}"` : ""} maxlength="400" value="${esc(String(e[k] ?? "").slice(0, ty === "date" ? 10 : 400))}"></div>`).join("")}</div>
    <label for="maWhy">REASON FOR THE CHANGE (REQUIRED · AUDIT LOG)</label><input id="maWhy" maxlength="200">`, "SAVE ENTRY");
  ov.querySelector("[data-go]").onclick = async () => {
    const why = val(ov, "#maWhy");
    if (why.length < 3) return err(ov, "A reason is required.");
    const next = { ...e };
    const changed = [];
    ov.querySelectorAll("[data-k]").forEach((inp) => {
      const k = inp.dataset.k, v = inp.value.trim();
      if (String(e[k] ?? "").slice(0, inp.type === "date" ? 10 : 400) !== v) { changed.push(`${k}: ${e[k] ?? "—"} → ${v || "—"}`); next[k] = v; }
    });
    if (!changed.length) return err(ov, "Nothing changed.");
    next.editedBy = await byName();
    next.editedAt = nowISO();
    const latest = await fresh(uid);
    const arr = [...(latest[LISTS[type]] || [])];
    if (JSON.stringify(arr[i]) !== JSON.stringify(e)) return err(ov, "Someone else changed this record. Close and open it again.");
    arr[i] = next;
    try { await updateDoc(doc(db, "users", uid), { [LISTS[type]]: arr, updatedAt: nowISO() }); } catch (x) { return err(ov, "Save failed: " + x.message); }
    audit("manpower", "SERVICE RECORD EDITED", `${memberName(u)}: ${KIND_LABEL[type]} (${e.date || "—"}) — ${changed.join("; ")} — reason: ${why}`);
    notify(KIND_LABEL[type] + " ENTRY UPDATED");
    done(cb);
  };
}

export async function deleteEntry(uid, type, i, cb) {
  const u = await fresh(uid);
  const e = u?.[LISTS[type]]?.[i];
  if (!e) return tell("NOT FOUND", "That entry no longer exists.", "error");
  const no = await blocked(u);
  if (no) return tell("CANNOT DELETE", no, "error");
  const reason = await ask({ kind: "reason", title: `DELETE ${KIND_LABEL[type]}?`, body: "The entry is removed from the service record. The reason is saved in the Audit Log.", item: `${e.date || "—"} · ${summary(type, e)}`, go: "DELETE" });
  if (reason == null) return;
  const latest = await fresh(uid);
  const arr = [...(latest[LISTS[type]] || [])];
  if (JSON.stringify(arr[i]) !== JSON.stringify(e)) return tell("RECORD CHANGED", "Someone else changed this record. Open it again.", "error");
  arr.splice(i, 1);
  try { await updateDoc(doc(db, "users", uid), { [LISTS[type]]: arr, updatedAt: nowISO() }); } catch (x) { return tell("DELETE FAILED", x.message, "error"); }
  audit("manpower", "SERVICE RECORD ENTRY DELETED", `${memberName(u)}: ${KIND_LABEL[type]} (${e.date || "—"}) ${summary(type, e)} — reason: ${reason}`);
  notify(KIND_LABEL[type] + " ENTRY DELETED");
  try { cb?.(); } catch (_) {}
}

/** Add a service record entry by hand (Personnel File timeline “＋”). */
export function addEntry(uid, type, cb) {
  if (type === "promo") return promote(uid, cb);
  if (type === "platoon") return transfer(uid, cb);
  if (type === "warn") return warn(uid, cb);
  return medals(uid, cb);
}

/** One entry point for the Roster ⋯ menu. */
export function run(action, uid, cb) {
  const fn = { promote, transfer, warn, medals, stats }[action];
  if (fn) return fn(uid, cb);
  if (action === "backfill") return backfill(cb);
}
window.memberActions = { run, promote, transfer, warn, medals, stats, backfill, editEntry, deleteEntry, addEntry };

const CSS = `
.ma{border-top:2px solid var(--k)}
.ma-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--l)}.ma-h b{color:var(--k);font:700 14px Rajdhani,sans-serif;letter-spacing:3px}
.ma-x{all:unset;cursor:pointer;color:var(--d);padding:2px 6px}.ma-x:hover,.ma-x:focus-visible{color:#fff;outline:1px solid var(--l2)}
.ma-b{padding:14px 16px;max-height:70vh;overflow:auto}
.ma-b label{display:block;margin:12px 0 5px;font-size:10px;letter-spacing:2px;color:var(--a)}
.ma-b input:not([type=checkbox]),.ma-b textarea{width:100%;box-sizing:border-box;padding:8px 9px;background:rgba(0,0,0,.55);border:1px solid var(--l2);color:#e0e6ee;font:12px 'Share Tech Mono',monospace}
.ma-b input:focus,.ma-b textarea:focus{outline:none;border-color:var(--k)}
.ma-who{font:700 16px Rajdhani,sans-serif;letter-spacing:1.5px;color:#fff}.ma-who small{display:block;font:11px 'Share Tech Mono',monospace;color:var(--d);letter-spacing:1px}
.ma-row{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.ma-row .wide{grid-column:1/-1}.ma-row4{display:grid;grid-template-columns:repeat(4,1fr);gap:0 10px}
.ma-dir{align-self:end;padding-bottom:8px;font-size:12px}
.ma-ranks{display:flex;flex-wrap:wrap;gap:5px;max-height:170px;overflow:auto;padding:2px}
.ma-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.ma-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ma-chip{all:unset;cursor:pointer;box-sizing:border-box;padding:7px 9px;border:1px solid var(--l);font-size:10.5px;letter-spacing:1px;color:#c9d3de;text-align:center}
.ma-chip small{display:block;color:var(--d);font-size:9px;margin-top:2px}
.ma-chip:hover,.ma-chip:focus-visible{border-color:var(--l2);color:#fff}.ma-chip.on{border-color:var(--c,var(--k));color:var(--c,var(--k));background:rgba(255,255,255,.04)}
.ma-chip.cur,.ma-chip:disabled{opacity:.45;cursor:default}
.ma-ck{display:flex!important;align-items:center;gap:8px;color:#c9d3de!important;cursor:pointer}
.ma-hint{color:var(--d);font-size:11px;margin:8px 0 0;line-height:1.5}.ma-was{color:var(--dd);font-size:9.5px;letter-spacing:1px}
.ma-alert{margin-top:10px;padding:8px 10px;border:1px solid #f59e0b;color:#f59e0b;font-size:11px;letter-spacing:1px}
.ma-list{list-style:none;margin:0;padding:0;border:1px solid var(--l);max-height:220px;overflow:auto}
.ma-list li{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--l);font-size:12px}.ma-list li:last-child{border-bottom:0}
.ma-list li b{flex:1;color:#e6edf5;font-weight:400}.ma-list .d{color:var(--d);font-size:11px}.ma-list img{width:22px;height:22px;object-fit:contain}.ma-list .none{color:var(--d);justify-content:center}
.ma-list input[type=date]{width:150px!important}
.ma-tag{font-size:9px;letter-spacing:1.5px;min-width:62px}
.ma-ic{all:unset;cursor:pointer;padding:2px 6px;border:1px solid var(--l);color:#ffd166}.ma-ic.r{color:#ff4d4d}.ma-ic:hover,.ma-ic:focus-visible{border-color:currentColor}
.ma-medals{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ma-med{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border:1px solid var(--l)}.ma-med img{width:30px;height:30px;object-fit:contain}
.ma-med small{font-size:8.5px;letter-spacing:1px;color:#c9d3de;text-align:center}.ma-med.on,.ma-med:focus-visible{border-color:#a78bfa;background:rgba(167,139,250,.08)}
.ma-f{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--l)}.ma-err{flex:1;color:#ff4d4d;font-size:11px;letter-spacing:1px}
@media (max-width:640px){.ma-row,.ma-row4,.ma-grid{grid-template-columns:1fr 1fr}.ma-medals{grid-template-columns:repeat(2,1fr)}}
`;
