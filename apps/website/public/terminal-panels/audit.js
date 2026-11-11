/**
 * AUDIT LOG v3 (approved mock 2026-11-11) — #panel-auditv2 (Security → Audit Log).
 * One feed for the Website, the Discord server (Cortana) and the Hub, with a detail panel
 * (before / after, deleted pictures / GIFs / clips, bulk deletes).
 * Data: /api/terminal/audit. Settings: settings/audit. Clean-up / Clear: Cortana jobs
 * "audit.cleanup" / "audit.clear" (they save a .txt to Archives first and leave a locked record).
 */
import { collection, doc, getDocs, setDoc } from "/terminal-shim/firestore.js";
import { addCss, audit as writeAudit, closeModal, db, esc, mountPanel, notify, onReady, openModal } from "./_common.js";
import { cortanaJob } from "./discord-common.js";

const ROOT = "auditV2";
const SRC = { website: ["WEB", "WEBSITE", "#00D9FF"], discord: ["DC", "DISCORD", "#8e98ff"], hub: ["HUB", "HUB", "#2dd4bf"], cortana: ["CORTANA", "CORTANA", "#a78bfa"] };
const CATS = {
  messages: "MESSAGES", members: "MEMBERS", moderation: "MODERATION", roles: "ROLES", voice: "VOICE", server: "SERVER",
  manpower: "MANPOWER", operations: "OPERATIONS", workspace: "WORKSPACE", discord: "DISCORD SETUP", security: "SECURITY", command: "COMMAND", hub: "HUB",
};
const RECORD = ["messages", "members", "moderation", "roles", "voice", "server"];
const ICON = [
  [/BULK DELETE/, "🗑", "#ff4d4d"], [/MESSAGE DELETED/, "🗑", "#ff4d4d"], [/EDITED/, "✎", "#f59e0b"], [/AVATAR/, "🖼", "#00D9FF"], [/RENAMED/, "✎", "#00D9FF"],
  [/^JOINED/, "➕", "#22e07a"], [/^LEFT/, "➖", "#7d8a99"], [/KICK/, "👢", "#ff4d4d"], [/UNBAN/, "↺", "#22e07a"], [/BAN/, "⛔", "#ff4d4d"], [/TIMEOUT/, "🔇", "#f59e0b"],
  [/WARN/, "⚠", "#f59e0b"], [/ROLE/, "◆", "#a78bfa"], [/VOICE/, "🎙", "#7d8a99"], [/CLEARED|CLEAN-UP|DELETED/, "🔒", "#ffd166"], [/LOCK/, "🔒", "#22e07a"], [/./, "•", "#00D9FF"],
];
const icon = (a) => ICON.find(([r]) => r.test(a)).slice(1);

let all = [], meta = {}, archives = null, chans = [];
let view = "log", src = "", cat = "", q = "", days = 7, openId = null;

async function load() {
  const r = await fetch("/api/terminal/audit", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    body().innerHTML = `<div class="empty">🔒 ${r.status === 403 ? "YOU DON'T HAVE AUDIT LOG ACCESS" : "COULD NOT LOAD THE AUDIT LOG"}</div>`;
    return;
  }
  all = j.entries.map((e) => ({ ...e, atMs: e.at ? Date.parse(e.at) || 0 : 0 }));
  meta = j;
  if (!openId || !all.some((x) => x.id === openId)) openId = shown()[0]?.id ?? null;
  render();
}
const body = () => document.querySelector(`#${ROOT} .body`);

function shown() {
  const now = Date.now(), ql = q.toLowerCase();
  return all.filter((x) => (!src || x.source === src) && (!cat || x.cat === cat) && (days >= 9999 || now - x.atMs <= days * 864e5) && `${x.action} ${x.details} ${x.by} ${x.target ?? ""} ${x.channel ?? ""}`.toLowerCase().includes(ql));
}
const fmtT = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }).toUpperCase();
const fmtFull = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).toUpperCase() : "—");
const badge = (s) => { const [k, , c] = SRC[s] || SRC.website; return `<span class="sb" style="color:${c};border-color:${c}88">${k}</span>`; };
const thumb = (m) => {
  const big = m.kind === "clip" ? `<video src="${esc(m.url)}" muted preload="metadata"></video>` : m.kind === "file" ? `<span>FILE</span>` : `<img src="${esc(m.url)}" alt="" loading="lazy">`;
  return `<a class="th" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" title="${esc(m.name)}">${big}<em>${m.kind === "clip" ? "▶ " : ""}${esc(m.kind.toUpperCase())} · ${esc(m.name)}</em></a>`;
};

// ───────── render ─────────
function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  root.querySelector(".acts2").innerHTML = `<button class="b" data-act="csv">⇩ EXPORT CSV</button>${meta.canSettings ? '<button class="b" data-act="clean">⚙ CLEAN-UP</button>' : ""}<button class="b ${view === "arch" ? "on" : ""}" data-act="arch">▤ ARCHIVES</button><button class="b ${view === "what" ? "on" : ""}" data-act="what">? WHAT'S RECORDED</button>${meta.canClear ? '<button class="b red" data-act="clear">🗑 CLEAR…</button>' : ""}<button class="b" data-act="refresh" aria-label="Refresh">↻</button>`;
  if (view === "arch") return renderArchives();
  if (view === "what") return renderWhat();
  const list = shown();
  const cnt = (s) => all.filter((x) => !s || x.source === s).length;
  const lc = meta.lastCleanup;
  const catsHere = Object.keys(CATS).filter((c) => all.some((x) => x.cat === c && (!src || x.source === src)));
  let rows = "", last = "";
  for (const x of list.slice(0, 800)) {
    const d = x.atMs ? fmtDay(x.atMs) : "UNKNOWN DATE";
    if (d !== last) (rows += `<div class="day">${d}</div>`), (last = d);
    const [ic, col] = icon(x.action);
    const media = (x.media || []).length ? `<div class="thumbs">${x.media.slice(0, 4).map(thumb).join("")}</div>` : "";
    const diff = x.before != null || x.after != null ? `<div class="diff"><span class="o">${esc(x.before ?? "")}</span> → <span class="n">${esc(x.after ?? "")}</span></div>` : "";
    rows += `<button type="button" class="row ${openId === x.id ? "on" : ""} ${x.locked ? "lk" : ""}" data-row="${esc(x.id)}" aria-pressed="${openId === x.id}"><span class="t">${x.atMs ? fmtT(x.atMs) : "—"}</span>
      <span class="ic" style="color:${col}">${ic} ${esc(x.action)}</span><span class="w"><b>${esc(x.by)}</b> <small>${esc(x.details)}</small>${diff}${media}</span>${badge(x.source)}</button>`;
  }
  body().innerHTML = `
    ${lc ? `<div class="banner"><span><b>✓ ${lc.kind === "clear" ? "LOG CLEARED" : "CLEAN-UP"} ${esc(fmtFull(lc.at))}</b> by ${esc(lc.by)} — ${lc.count} entries removed${lc.media ? ` · ${lc.media} pictures/clips` : ""}${lc.name ? ` · saved to <u>${esc(lc.name)}</u>` : " · not saved"}
      <small>${meta.settings?.auto === false ? "Automatic monthly clean-up is OFF" : `Next: 1st of next month · keeps ${meta.settings?.keepMonths || 3} month(s)`}</small></span>${lc.archiveId ? `<a class="b sm" href="/api/terminal/audit?archive=${esc(lc.archiveId)}">⇩ DOWNLOAD TXT</a>` : ""}</div>` : ""}
    <div class="srcs">${[["", "ALL", "#fff"], ["website", "WEBSITE", "#00D9FF"], ["discord", "DISCORD", "#8e98ff"], ["hub", "HUB", "#2dd4bf"]].map(([k, l, c]) => `<button type="button" class="${src === k ? "on" : ""}" data-src="${k}" aria-pressed="${src === k}"><b>${k ? badge(k) : ""} ${l}</b><span style="color:${c}">${cnt(k)}</span></button>`).join("")}</div>
    <div class="ftr"><input class="fld" data-f="q" value="${esc(q)}" placeholder="Search name, channel, text…" aria-label="Search">
      <select class="fld" data-f="days" aria-label="Date range">${[[1, "Today"], [7, "Last 7 days"], [30, "Last 30 days"], [9999, "Everything"]].map(([v, l]) => `<option value="${v}" ${v === days ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button type="button" class="chip ${!cat ? "on" : ""}" data-cat="">ALL</button>${catsHere.map((c) => `<button type="button" class="chip ${cat === c ? "on" : ""}" data-cat="${c}">${CATS[c]}<small>${all.filter((x) => x.cat === c && (!src || x.source === src)).length}</small></button>`).join("")}</div>
    ${src === "discord" && !all.some((x) => x.source === "discord") ? '<div class="note">◷ Discord entries arrive once the new Cortana is running (pull + pm2 restart).</div>' : ""}
    ${src === "hub" && !all.some((x) => x.source === "hub") ? '<div class="note">◷ Hub entries arrive once the 505th Hub is built.</div>' : ""}
    <div class="lay"><div class="feed" role="list">${rows || '<div class="empty">NO ENTRIES MATCH</div>'}${list.length > 800 ? '<div class="empty">FIRST 800 SHOWN — NARROW THE SEARCH</div>' : ""}</div>
      <aside class="side" aria-live="polite">${detail(all.find((x) => x.id === openId))}</aside></div>
    <p class="k" style="margin-top:10px">${meta.canClean ? "" : "Discord message text and pictures are private: Officer and above only. "}Locked 🔒 records (clean-up, clear, deletions) can never be removed.</p>`;
}

function detail(x) {
  if (!x) return '<div class="empty">PICK AN ENTRY</div>';
  const [ic] = icon(x.action);
  const e = x.extra || {};
  const kv = [
    ["WHEN", fmtFull(x.at)], ["SOURCE", (SRC[x.source] || SRC.website)[1]], ["TYPE", CATS[x.cat] || x.cat.toUpperCase()], ["BY", x.by], x.target && ["MEMBER", x.target], x.channel && ["CHANNEL", x.channel],
    e.reason && ["REASON", e.reason], e.count && ["MESSAGES", e.count], e.accountAgeDays != null && ["ACCOUNT AGE", `${e.accountAgeDays} day(s)${e.accountAgeDays < 7 ? " ⚠ NEW" : ""}`],
    e.invite && ["INVITE", `${e.invite.code}${e.invite.by ? ` (by ${e.invite.by})` : ""}`], e.until && ["UNTIL", fmtFull(e.until)],
    e.added?.length && ["ADDED", e.added.join(", ")], e.removed?.length && ["REMOVED", e.removed.join(", ")], e.roles?.length && ["ROLES HELD", e.roles.join(", ")],
  ].filter(Boolean);
  let more = "";
  if (x.private) more += '<p class="k">🔒 Message text and pictures: Officer and above only.</p>';
  if (x.content) more += `<div class="msg">${esc(x.content)}</div>`;
  if (x.before != null || x.after != null) more += `<div class="msg"><small>BEFORE</small><span class="o">${esc(x.before ?? "")}</span></div><div class="msg"><small>AFTER</small><span class="n">${esc(x.after ?? "")}</span></div>`;
  if (e.oldAvatar || e.newAvatar) more += `<div class="av">${e.oldAvatar ? `<img src="${esc(e.oldAvatar)}" alt="Old picture">` : "<i></i>"} → ${e.newAvatar ? `<img src="${esc(e.newAvatar)}" alt="New picture">` : "<i></i>"}</div>`;
  if (x.media?.length) more += `<div class="thumbs">${x.media.map(thumb).join("")}</div>`;
  if (x.mediaRemoved) more += '<p class="k">Pictures / clips were removed by clean-up.</p>';
  if (x.bulk?.length) more += `<div class="bulk">${x.bulk.map((b) => `<div><small>${b.at ? fmtT(Date.parse(b.at)) : ""}</small><b>${esc(b.author)}</b> ${esc(b.content || "")}${b.media?.length ? `<div class="thumbs">${b.media.map(thumb).join("")}</div>` : ""}</div>`).join("")}</div>`;
  if (e.messageUrl) more += `<p><a class="b sm" href="${esc(e.messageUrl)}" target="_blank" rel="noopener noreferrer">OPEN IN DISCORD ↗</a></p>`;
  return `<div class="hd"><span class="k">DETAIL</span><b>${ic} ${esc(x.action)}${x.locked ? " 🔒" : ""}</b></div><div class="bd">
    <div class="kv">${kv.map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join("")}</div><p class="det">${esc(x.details)}</p>${more}
    ${x.bulk?.length ? '<div class="bar"><button class="b sm" data-act="bulktxt">⇩ SAVE AS .TXT</button></div>' : ""}</div>`;
}

async function renderArchives() {
  body().innerHTML = '<div class="empty">LOADING ARCHIVES…</div>';
  if (!archives) archives = (await fetch("/api/terminal/audit?archives=1", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))).archives || [];
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  body().innerHTML = `<div class="bar"><div class="h2">▤ ARCHIVES</div><span class="k">.txt copies saved before each clean-up or clear. Download any time.</span><span class="sp"></span><button class="b sm" data-act="log">← BACK TO LOG</button></div>
    <table class="t"><thead><tr><th>FILE</th><th>WHAT</th><th>ENTRIES</th><th>PERIOD</th><th>SAVED</th><th></th></tr></thead><tbody>${
      archives.map((a) => `<tr><td style="color:${a.kind === "clear" ? "#ff4d4d" : "#00D9FF"}">${esc(a.name)}</td><td>${esc(a.label || "")}${a.reason ? `<div class="k">"${esc(a.reason)}"</div>` : ""}</td><td>${a.count}</td>
        <td class="k">${a.from ? esc(String(a.from).slice(0, 10)) : "—"} → ${a.to ? esc(String(a.to).slice(0, 10)) : "—"}</td><td class="k">${esc(fmtFull(a.createdAtISO))} · ${esc(a.by || "")}</td>
        <td><a class="b sm" href="/api/terminal/audit?archive=${esc(a.id)}">⇩ TXT · ${kb(a.bytes || 0)}</a></td></tr>`).join("") || '<tr><td colspan="6" class="empty">NO ARCHIVES YET — ONE IS SAVED EACH TIME THE LOG IS CLEANED UP</td></tr>'
    }</tbody></table>`;
}

function renderWhat() {
  const box = (t, c, items) => `<div class="card"><b>${t}</b><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>${c ? `<span class="k">${c}</span>` : ""}</div>`;
  body().innerHTML = `<div class="bar"><div class="h2">? WHAT'S RECORDED</div><span class="sp"></span><button class="b sm" data-act="log">← BACK TO LOG</button></div><div class="g3">
    ${box(`${badge("discord")} DISCORD — MESSAGES`, "Pictures are kept only if Cloudinary is set up for Cortana.", ["Message deleted (text + pictures, GIFs, clips, files)", "Message edited (before → after)", "Bulk delete / purge (every message listed)"])}
    ${box(`${badge("discord")} DISCORD — MEMBERS`, "", ["Joined (account age, invite used)", "Left (time in server, roles held)", "Nickname / Discord name changed", "Profile picture changed (old → new)", "Roles added / removed", "Voice join / leave / move"])}
    ${box(`${badge("discord")} DISCORD — MODERATION & SERVER`, "", ["Warn (case number)", "Timeout / timeout removed", "Kick · Ban · Unban", "Channels / roles created, changed, deleted", "Invites created / deleted"])}
    ${box(`${badge("website")} WEBSITE — COMMAND TERMINAL`, "", ["Personnel: role, rank, platoon, promotion, warnings", "Attendance: events, lock / unlock, monthly reset", "AARs, events, media, posts", "Settings and access changes"])}
    ${box(`${badge("hub")} 505TH HUB`, "Arrives once the Hub is built.", ["Sign in / sign out (which PC)", "Status changes", "Actions done from the Hub"])}
    ${box(`${badge("cortana")} CORTANA`, "", ["Monthly reset and clean-up", "Restarts and failed jobs", "Role sync"])}</div>
    <p class="k">Messages sent before Cortana started can't be recovered — recording starts from when Cortana is running.</p>`;
}

// ───────── clean-up settings ─────────
async function openClean() {
  const S = { auto: true, keepMonths: 3, mediaMonths: 1, saveTxt: true, postTxt: false, postChannelId: "", record: {}, ignoreChannels: [], ...(meta.settings || {}) };
  if (!chans.length) chans = ((await getDocs(collection(db, "discord_channels")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })) || []).filter((c) => c.type === 0 || c.type === "text" || c.kind === "text" || !c.type).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const opt = (v, l, cur) => `<button type="button" class="chip ${String(cur) === String(v) ? "on" : ""}" data-v="${v}">${l}</button>`;
  const sw = (k, l) => `<label class="sw"><input type="checkbox" data-k="${k}" ${S[k] ? "checked" : ""}> ${l}</label>`;
  const ov = openModal(
    `<div class="hd"><div><h2>⚙ AUDIT LOG CLEAN-UP</h2><small>COMMANDER / OFFICER / DEVELOPER</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd au3">
      <span class="lbl">AUTOMATIC MONTHLY CLEAN-UP</span>${sw("auto", "ON — 1st of every month, 00:10 UK (Cortana)")}
      <span class="lbl">KEEP ENTRIES FOR</span><div class="row2" data-g="keepMonths">${[1, 3, 6, 12].map((n) => opt(n, `${n} MONTH${n > 1 ? "S" : ""}`, S.keepMonths)).join("")}</div>
      <span class="lbl">KEEP PICTURES / CLIPS FOR <small>(THEY TAKE SPACE)</small></span><div class="row2" data-g="mediaMonths">${opt(1, "1 MONTH", S.mediaMonths)}${opt(3, "3 MONTHS", S.mediaMonths)}${opt("same", "SAME AS ENTRIES", S.mediaMonths)}</div>
      <span class="lbl">BEFORE DELETING</span>${sw("saveTxt", "Save a .txt copy to ARCHIVES")}${sw("postTxt", "Also post the .txt to a Discord channel")}
      <select class="fld" id="acPost" aria-label="Channel for the .txt"><option value="">— pick channel —</option>${chans.map((c) => `<option value="${esc(c.id)}" ${S.postChannelId === c.id ? "selected" : ""}>#${esc(c.name)}</option>`).join("")}</select>
      <span class="lbl">RECORD THESE DISCORD TYPES</span><div class="row2" id="acRec">${RECORD.map((c) => `<button type="button" class="chip ${S.record?.[c] === false ? "" : "on"}" data-rec="${c}" aria-pressed="${S.record?.[c] !== false}">${CATS[c]}</button>`).join("")}</div>
      <span class="lbl">IGNORE CHANNELS <small>(NOTHING RECORDED THERE)</small></span><select class="fld" id="acIgn" multiple size="5" aria-label="Ignored channels">${chans.map((c) => `<option value="${esc(c.id)}" ${(S.ignoreChannels || []).includes(c.id) ? "selected" : ""}>#${esc(c.name)}</option>`).join("")}</select>
      <p class="hint">Ctrl + click to pick several. Locked records are never deleted.</p>
    </div>
    <div class="ft"><button class="b red" id="acNow">RUN CLEAN-UP NOW…</button><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" id="acSave">SAVE</button></div></div>`,
    { width: 620 },
  );
  ov.addEventListener("click", (e) => {
    const v = e.target.closest("[data-v]");
    if (v) { v.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === v)); return; }
    const rc = e.target.closest("[data-rec]");
    if (rc) { rc.classList.toggle("on"); rc.setAttribute("aria-pressed", rc.classList.contains("on")); }
  });
  const collect = () => {
    const pick = (g) => ov.querySelector(`[data-g="${g}"] .chip.on`)?.dataset.v;
    return {
      auto: ov.querySelector('[data-k="auto"]').checked, keepMonths: Number(pick("keepMonths")), mediaMonths: pick("mediaMonths") === "same" ? "same" : Number(pick("mediaMonths")),
      saveTxt: ov.querySelector('[data-k="saveTxt"]').checked, postTxt: ov.querySelector('[data-k="postTxt"]').checked, postChannelId: ov.querySelector("#acPost").value || null,
      record: Object.fromEntries([...ov.querySelectorAll("[data-rec]")].map((b) => [b.dataset.rec, b.classList.contains("on")])),
      ignoreChannels: [...ov.querySelector("#acIgn").selectedOptions].map((o) => o.value),
    };
  };
  ov.querySelector("#acSave").addEventListener("click", async () => {
    const v = collect();
    if (v.postTxt && !v.postChannelId) return notify("PICK A CHANNEL FOR THE .TXT", 1);
    try {
      await setDoc(doc(db, "settings", "audit"), v, { merge: true });
      await writeAudit("security", "AUDIT SETTINGS CHANGED", `Clean-up ${v.auto ? "on" : "off"} · keep ${v.keepMonths} month(s) · pictures ${v.mediaMonths} · txt ${v.saveTxt ? "yes" : "no"}${v.postTxt ? " + Discord" : ""}`);
      closeModal();
      notify("✓ CLEAN-UP SETTINGS SAVED");
      load();
    } catch (e) {
      notify("SAVE FAILED: " + e.message, 1);
    }
  });
  ov.querySelector("#acNow").addEventListener("click", () => {
    const v = collect();
    const cut = new Date(); cut.setMonth(cut.getMonth() - v.keepMonths);
    const n = all.filter((x) => !x.locked && x.atMs && x.atMs < cut.getTime()).length;
    confirmRun({ title: "RUN CLEAN-UP NOW?", what: `${n} entr${n === 1 ? "y" : "ies"} older than ${cut.toLocaleDateString("en-GB")} (${v.keepMonths} month(s)) will be removed${v.saveTxt ? " — saved to Archives first" : " — NOT saved"}. Uses the SAVED settings.`, word: "CLEAN", job: "audit.cleanup", payload: {} });
  });
}

// ───────── clear ─────────
function openClear() {
  const ov = openModal(
    `<div class="hd"><div><h2 style="color:#ff4d4d">🗑 CLEAR LOG</h2><small>COMMANDER / DEVELOPER ONLY</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd au3">
      <span class="lbl">WHAT TO CLEAR</span>
      <div class="g2"><select class="fld" id="clS" aria-label="Source"><option value="">Every source</option><option value="website">Website only</option><option value="discord">Discord only</option><option value="hub">Hub only</option></select>
        <select class="fld" id="clC" aria-label="Type"><option value="">Every type</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
        <label class="k">FROM<input class="fld" type="date" id="clF"></label><label class="k">TO<input class="fld" type="date" id="clT"></label></div>
      <div class="danger" id="clN"></div>
      <label class="sw"><input type="checkbox" id="clTxt" checked> Save .txt to ARCHIVES first (recommended)</label>
      <label class="lbl" for="clR">REASON *</label><input class="fld" id="clR" maxlength="300" placeholder="e.g. fresh start after server move">
      <label class="lbl" for="clW">TYPE <b style="color:#ff4d4d;font-weight:400">CLEAR</b> TO CONFIRM</label><input class="fld" id="clW" autocomplete="off">
    </div>
    <div class="ft"><span></span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b red" id="clGo" disabled>🗑 CLEAR LOG</button></div></div>`,
    { color: "rgba(255,77,77,.6)", title: "#ff4d4d", width: 600 },
  );
  const $ = (s) => ov.querySelector(s);
  const count = () => {
    const s = $("#clS").value, c = $("#clC").value, f = $("#clF").value ? Date.parse($("#clF").value) : 0, t = $("#clT").value ? Date.parse($("#clT").value) + 864e5 : Infinity;
    const n = all.filter((x) => !x.locked && (!s || x.source === s) && (!c || x.cat === c) && x.atMs >= f && x.atMs < t).length;
    $("#clN").innerHTML = `This removes <b>${n} entr${n === 1 ? "y" : "ies"}</b>${(s || "") === "" || s === "discord" ? " and their pictures/clips" : ""}. A locked record stays: <span style="color:#ff4d4d">"LOG CLEARED — ${n} entries by you · reason"</span>.`;
    $("#clGo").disabled = !(n && $("#clR").value.trim().length >= 3 && $("#clW").value === "CLEAR");
  };
  ov.addEventListener("input", count);
  ov.addEventListener("change", count);
  count();
  $("#clGo").addEventListener("click", () =>
    runJob("audit.clear", { source: $("#clS").value || null, cat: $("#clC").value || null, from: $("#clF").value || null, to: $("#clT").value || null, reason: $("#clR").value.trim(), saveTxt: $("#clTxt").checked }, $("#clGo")),
  );
}

function confirmRun(o) {
  const ov = openModal(
    `<div class="hd"><div><h2 style="color:#ff4d4d">${o.title}</h2><small>DONE BY CORTANA</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="danger">${esc(o.what)}</div><label class="lbl" for="crW">TYPE <b style="color:#ff4d4d;font-weight:400">${o.word}</b> TO CONFIRM</label><input class="fld" id="crW" autocomplete="off"></div>
    <div class="ft"><span></span><div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b red" id="crGo" disabled>RUN</button></div></div>`,
    { color: "rgba(255,77,77,.6)", title: "#ff4d4d", width: 540 },
  );
  ov.querySelector("#crW").addEventListener("input", (e) => (ov.querySelector("#crGo").disabled = e.target.value !== o.word));
  ov.querySelector("#crGo").addEventListener("click", (e) => runJob(o.job, o.payload, e.target));
}

async function runJob(type, payload, btn) {
  btn.disabled = true;
  btn.textContent = "◷ CORTANA WORKING…";
  try {
    const r = await cortanaJob(type, payload, { wait: true, ms: 120000 });
    if (!r) throw new Error("No answer from Cortana — is it online? It will still run when it is back.");
    const res = r.result || {};
    notify(`✓ ${res.removed ?? 0} ENTRIES REMOVED${res.archiveId ? " — SAVED TO ARCHIVES" : ""}`);
    closeModal();
    archives = null;
    load();
  } catch (e) {
    notify(e.message.toUpperCase(), 1);
    btn.disabled = false;
    btn.textContent = "RUN";
  }
}

// ───────── downloads ─────────
function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportCsv() {
  const list = shown();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  download(`505th-audit-${new Date().toISOString().slice(0, 10)}.csv`, ["Time,Source,Type,Action,By,Member,Channel,Details", ...list.map((x) => [x.at, x.source, x.cat, x.action, x.by, x.target, x.channel, x.details].map(cell).join(","))].join("\r\n"), "text/csv");
  notify(`⇩ EXPORTED ${list.length} ENTRIES`);
}
function bulkTxt() {
  const x = all.find((y) => y.id === openId);
  if (!x?.bulk) return;
  const lines = [`505th — BULK DELETE · ${x.channel || ""} · ${fmtFull(x.at)} · by ${x.by}${x.extra?.reason ? ` · "${x.extra.reason}"` : ""}`, "-".repeat(80),
    ...x.bulk.map((b) => `${b.at ? new Date(b.at).toLocaleString("en-GB", { timeZone: "Europe/London" }) : ""}  ${b.author}: ${b.content || ""}${(b.media || []).map((m) => ` [${m.kind} ${m.url}]`).join("")}`)];
  download(`purge-${String(x.channel || "channel").replace(/[^\w-]/g, "")}-${String(x.at).slice(0, 10)}.txt`, lines.join("\n"));
}

const CSS = `
#${ROOT} .acts2{display:flex;gap:6px;flex-wrap:wrap}#${ROOT} .b.on{background:rgba(0,217,255,.12)}#${ROOT} .b.sm{padding:4px 9px;font-size:10px}#${ROOT} a.b{text-decoration:none}
#${ROOT} .h2{font:700 15px Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}#${ROOT} .k{font-size:10.5px;letter-spacing:1px;color:var(--d)}
#${ROOT} .banner{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(34,224,122,.45);background:rgba(34,224,122,.05);margin:12px 0;font-size:12px}#${ROOT} .banner>span{flex:1}#${ROOT} .banner b{color:var(--g);font-weight:400}#${ROOT} .banner small{display:block;color:var(--d);font-size:10.5px}
#${ROOT} .srcs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 10px}#${ROOT} .srcs button{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid var(--l);background:var(--p);padding:10px 12px;display:flex;justify-content:space-between;align-items:center}
#${ROOT} .srcs button.on{border-color:var(--a);box-shadow:inset 0 -2px 0 var(--a)}#${ROOT} .srcs b{font:700 14px Rajdhani,sans-serif;letter-spacing:2px;color:#fff}#${ROOT} .srcs span{font:700 20px Rajdhani,sans-serif}
#${ROOT} .sb{font:9px 'Share Tech Mono',monospace;letter-spacing:1px;padding:1px 5px;border:1px solid;align-self:center;white-space:nowrap}
#${ROOT} .ftr{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}#${ROOT} .ftr .fld{width:auto;min-width:160px}#${ROOT} .ftr [data-f=q]{min-width:240px}
#${ROOT} .chip{all:unset;cursor:pointer;padding:5px 10px;border:1px solid var(--l);font-size:10.5px;letter-spacing:1px;color:var(--d)}#${ROOT} .chip.on{color:#fff;border-color:var(--a);background:rgba(0,217,255,.1)}#${ROOT} .chip small{opacity:.7;margin-left:4px}
#${ROOT} .chip:focus-visible,#${ROOT} .row:focus-visible,#${ROOT} .srcs button:focus-visible{outline:2px solid var(--a);outline-offset:2px}
#${ROOT} .note{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.05);color:#f5c26b;padding:10px 14px;font-size:11.5px;margin-bottom:10px}
#${ROOT} .lay{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;align-items:start}
#${ROOT} .feed{border:1px solid var(--l);background:var(--p);max-height:calc(100vh - 330px);overflow:auto}
#${ROOT} .day{padding:6px 12px;font-size:10px;letter-spacing:2px;color:var(--a);border-bottom:1px solid var(--l);background:#0a0e14;position:sticky;top:0;z-index:1}
#${ROOT} .row{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:44px 140px minmax(0,1fr) auto;gap:10px;align-items:start;padding:9px 12px;border-bottom:1px solid rgba(0,217,255,.07);cursor:pointer;font-size:12px}
#${ROOT} .row:hover{background:rgba(0,217,255,.03)}#${ROOT} .row.on{background:rgba(0,217,255,.07);box-shadow:inset 3px 0 0 var(--a)}#${ROOT} .row.lk .ic{color:#ffd166!important}
#${ROOT} .row .t{color:var(--d);font-size:11px}#${ROOT} .ic{font-size:9.5px;letter-spacing:1px;padding:2px 6px;border:1px solid currentColor;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .row .w{min-width:0}#${ROOT} .row .w b{color:#fff;font-weight:400}#${ROOT} .row .w small{display:block;color:var(--d);font-size:11px;margin-top:2px;word-break:break-word}
#${ROOT} .diff{margin-top:5px;border-left:2px solid var(--l);padding-left:8px;font-size:11.5px}#${ROOT} .o{color:#ff8a8a;text-decoration:line-through}#${ROOT} .n{color:#7ff0b0}
#${ROOT} .thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}#${ROOT} .th{width:96px;height:64px;border:1px solid var(--l);display:grid;place-items:center;background:#0e131b;position:relative;overflow:hidden;color:var(--d);font-size:10px;text-decoration:none}
#${ROOT} .th img,#${ROOT} .th video{width:100%;height:100%;object-fit:cover}#${ROOT} .th em{position:absolute;bottom:0;left:0;right:0;font-style:normal;font-size:8.5px;color:#fff;background:rgba(0,0,0,.65);padding:1px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .side{border:1px solid var(--a);background:var(--p);position:sticky;top:10px;max-height:calc(100vh - 330px);overflow:auto}#${ROOT} .side .hd{padding:12px 14px;border-bottom:1px solid var(--l)}#${ROOT} .side .hd b{display:block;color:#fff;font:700 16px Rajdhani,sans-serif;letter-spacing:2px}#${ROOT} .side .bd{padding:12px 14px}
#${ROOT} .kv{display:grid;grid-template-columns:100px 1fr;gap:4px 10px;font-size:11.5px;margin-bottom:8px}#${ROOT} .kv span:nth-child(odd){color:var(--d);font-size:9.5px;letter-spacing:1.5px}#${ROOT} .kv span:nth-child(even){word-break:break-word}
#${ROOT} .det{color:#c6d0da;font-size:12px;word-break:break-word}
#${ROOT} .msg{border:1px solid var(--l);background:#0e131b;padding:8px 10px;margin:6px 0;font-size:12px;white-space:pre-wrap;word-break:break-word}#${ROOT} .msg small{display:block;color:var(--d);font-size:9.5px;letter-spacing:1.5px}
#${ROOT} .av{display:flex;align-items:center;gap:10px;margin:8px 0}#${ROOT} .av img,#${ROOT} .av i{width:48px;height:48px;border-radius:50%;border:1px solid var(--l);background:#1a2330;display:inline-block}
#${ROOT} .bulk{max-height:320px;overflow:auto;border:1px solid var(--l);margin:8px 0}#${ROOT} .bulk>div{padding:6px 10px;border-bottom:1px solid rgba(0,217,255,.07);font-size:11.5px;word-break:break-word}#${ROOT} .bulk small{color:var(--d);margin-right:6px}#${ROOT} .bulk b{color:#fff;font-weight:400}
#${ROOT} .t{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--l);background:var(--p)}#${ROOT} .t th{text-align:left;font-size:9.5px;letter-spacing:2px;color:var(--d);font-weight:400;padding:9px 10px;border-bottom:1px solid var(--l)}#${ROOT} .t td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
#${ROOT} .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}#${ROOT} .card{border:1px solid var(--l);background:var(--p);padding:14px}#${ROOT} .card b{color:#fff;letter-spacing:1px;font-weight:400}#${ROOT} .card ul{margin:8px 0;padding-left:16px;font-size:11.5px;color:#c6d0da;line-height:1.7}
.v2m .au3 .lbl{display:block;margin-top:12px}.v2m .au3 .row2{display:flex;gap:6px;flex-wrap:wrap}.v2m .au3 .chip{all:unset;cursor:pointer;padding:5px 10px;border:1px solid rgba(0,217,255,.18);font-size:10.5px;letter-spacing:1px;color:#7d8a99}.v2m .au3 .chip.on{color:#fff;border-color:#00D9FF;background:rgba(0,217,255,.1)}
.v2m .au3 .sw{display:flex;gap:8px;align-items:center;font-size:12px;margin:4px 0;cursor:pointer}.v2m .au3 .sw input{accent-color:#22e07a;width:16px;height:16px}.v2m .au3 select[multiple]{height:auto}
.v2m .danger{border:1px solid rgba(255,77,77,.35);background:rgba(255,77,77,.05);padding:10px 12px;font-size:12px;line-height:1.6;margin-top:12px}.v2m .danger b{color:#fff;font-weight:400}.v2m .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v2m .hint{font-size:10px;color:#7d8a99;margin-top:8px}
@media(max-width:1000px){#${ROOT} .lay,#${ROOT} .g3{grid-template-columns:1fr}#${ROOT} .srcs{grid-template-columns:1fr 1fr}#${ROOT} .side,#${ROOT} .feed{position:static;max-height:none}#${ROOT} .row{grid-template-columns:40px 1fr auto}#${ROOT} .row .ic{grid-column:2}}
`;

onReady(() => {
  const root = mountPanel("panel-auditv2", ROOT, () => load().catch((e) => notify("AUDIT LOG LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `<div class="bar"><div><div class="h1">AUDIT LOG</div><div class="sub" style="margin:4px 0 0">WEBSITE · DISCORD · HUB — ONE FEED</div></div><span class="sp"></span><div class="acts2"></div></div><div class="body"><div class="empty">LOADING…</div></div>`;
  root.addEventListener("click", (e) => {
    const t = e.target;
    const s = t.closest("[data-src]");
    if (s) return (src = s.dataset.src), (cat = ""), render();
    const c = t.closest("[data-cat]");
    if (c) return (cat = c.dataset.cat), render();
    const row = t.closest("[data-row]");
    if (row && !t.closest("a")) return (openId = row.dataset.row), render();
    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "csv") return exportCsv();
    if (act === "clean") return openClean();
    if (act === "clear") return openClear();
    if (act === "arch") return (view = view === "arch" ? "log" : "arch"), render();
    if (act === "what") return (view = view === "what" ? "log" : "what"), render();
    if (act === "log") return (view = "log"), render();
    if (act === "refresh") return (archives = null), load();
    if (act === "bulktxt") return bulkTxt();
  });
  root.addEventListener("change", (e) => {
    if (e.target.dataset.f === "days") (days = +e.target.value), render();
  });
  root.addEventListener("input", (e) => {
    if (e.target.dataset.f !== "q") return;
    q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = root.querySelector('[data-f="q"]');
    el.focus();
    el.setSelectionRange(pos, pos);
  });
});
