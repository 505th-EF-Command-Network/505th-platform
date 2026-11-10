/**
 * ❓ HELP (approved mock 2026-11-10): every Command Terminal page explained + interactive guided tours.
 *  - HELP page (sidebar → HELP): search, groups, a card per page (only pages you can open), how-to article, FAQ.
 *  - A "?" button by each page title opens that page's help in a side panel.
 *  - "▶ SHOW ME" runs a guided tour on the real page: spotlight + steps (Next / Back / Skip, ← → Enter Esc).
 *    Tours never save or send anything — they only open forms and point at things.
 * All visual + text, no sound.
 */
import { onAccess } from "./nav-v2.js";
import { addCss, esc, mountPanel, onReady } from "./_common.js";

/* ───────── content ───────── */
// who: shown to the reader · key: access item needed to open the page (null = everyone)
const H = {
  "panel-dashboard": { g: "GETTING STARTED", t: "Dashboard", who: "Everyone", key: null, s: "Your home screen: unit status, upcoming ops, your tasks and live widgets.",
    how: ["Press CUSTOMISE to add, remove or move widgets.", "Click a widget (Notes, Projects) to open it.", "Your layout is saved to your account."] },
  "panel-register": { g: "MANPOWER", t: "BCT Approvals", who: "Recruiter+", key: "bct", s: "Approve or deny people who signed up, after Basic Training.",
    how: ["Open a pending recruit.", "Check their details and Discord.", "Approve (they become a member) or Deny with a reason."] },
  "panel-active": { g: "MANPOWER", t: "Personnel Files", who: "Staff NCO+", key: "pers", s: "Every member's file: rank, platoon, squad, service record, medals, warnings.",
    how: ["Search or pick a platoon tab.", "Click a member card to open their file.", "✎ EDIT changes rank, platoon, squad — Discord roles follow automatically (Role Sync).", "☰ RECORD shows promotions, transfers, warnings and medals."],
    tips: ["A rank change here adds a Promotion History entry by itself."],
    tour: [
      { sel: "#pf2 .tabs", h: "PLATOON TABS", p: "Filter the files by platoon, Reserves or Awaiting BCT." },
      { sel: "#pf2 .search", h: "SEARCH", p: "Type a name, callsign or Discord name." },
      { sel: "#pf2 article.card", h: "A MEMBER", p: "Each card shows rank, status, role and platoon. Click it to open the full file." },
      { sel: "#pf2 [data-act=edit]", h: "EDIT", p: "Change rank, platoon or squad. Cortana swaps the Discord roles within a second." },
      { sel: "#pf2 [data-act=record]", h: "SERVICE RECORD", p: "Promotions, transfers, warnings and medals — added automatically when things change." },
    ] },
  "panel-roster": { g: "MANPOWER", t: "Roster", who: "NCO+", key: "roster", s: "The live battalion roster by platoon and squad." },
  "panel-unitcards": { g: "MANPOWER", t: "Order of Battle", who: "Staff NCO+", key: "oob", s: "Unit structure cards shown on the website." },
  "panel-recruit-source": { g: "MANPOWER", t: "Recruit Stats", who: "NCO+", key: "rstat", s: "Where recruits come from and how many join." },
  "panel-attendance": { g: "OPERATIONS", t: "Attendance", who: "NCO+", key: "att", s: "Tick who turned up to an op. Staff NCO+ locks it when done.",
    how: ["Open the op (events linked to Attendance show sign-ups as SIGNED UP).", "Tick who actually attended, Excused or No-show.", "Staff NCO+ presses LOCK."] },
  "panel-att-history": { g: "OPERATIONS", t: "Attendance History", who: "NCO+", key: "att", s: "Past ops and each member's attendance." },
  "panel-aar": { g: "OPERATIONS", t: "AAR", who: "NCO+", key: "aar", s: "Write and read After Action Reports." },
  "panel-gallery": { g: "OPERATIONS", t: "Gallery", who: "NCO+", key: "media", s: "Upload screenshots for the website gallery." },
  "panel-videos": { g: "OPERATIONS", t: "Videos", who: "NCO+", key: "media", s: "Add YouTube videos to the website." },
  "panel-events": { g: "OPERATIONS", t: "Events", who: "NCO+", key: "ev", s: "Create an op once — Cortana posts the 505th sign-up in Discord, pings, locks at start and logs attendance.",
    how: ["Click ＋ NEW EVENT.", "Pick where it happens, then the operation type, title, date and time.", "Pick the sign-up channel (squad channels ping only that squad) and the buttons.", "Press CREATE — Cortana posts it in Discord within a second."],
    tips: ["Sign-ups appear live. At the start going members are pinged and the buttons lock 🔒; 30 min later it's logged to #mission-log.", "Use ✓ END EVENT if an op finishes early."],
    warn: "DELETE removes the Discord post and sign-ups — it can't be undone.",
    tour: [
      { sel: '#evV2 [data-act="new"]', h: "CREATE AN OPERATION", p: "Click <b>＋ NEW EVENT</b> to start. The form opens on this page." },
      { sel: "#evV2 .wiz-form", click: '#evV2 [data-act="new"]', h: "STEP BY STEP", p: "The form goes in steps: where it happens → details (type, name, date, time) → sign-up channel and buttons → check." },
      { sel: "#evV2 .wiz-pv", h: "LIVE PREVIEW", p: "This shows the Discord sign-up post exactly as members will see it." },
      { sel: '#evV2 [data-act="next"]', h: "NEXT", p: "Fill in each step and press <b>NEXT</b>. Nothing is posted until the last step's <b>CREATE</b>." },
      { sel: "#evV2 .list", click: '#evV2 [data-act="list"]', h: "YOUR EVENTS", p: "Sign-ups arrive here live. Click an event to see who's going, edit, end, cancel or delete it." },
      { sel: "#evV2 .h1", h: "DONE ✓", p: "Press <b>?</b> on any page for its help and tour again." },
    ] },
  "panel-tickets": { g: "DISCORD", t: "Tickets", who: "Recruiter+", key: "tk", s: "Answer Recruitment and Tech Support tickets from members.",
    how: ["Pick a ticket on the left (NEW = nobody has answered).", "Type a reply — Cortana sends it into the Discord ticket, signed with your name.", "🔒 STAFF NOTE = only staff see it.", "✋ CLAIM it, ⇄ move it, or 🔒 CLOSE it (the channel is deleted after 24 h; the chat stays here)."],
    tour: [
      { sel: "#ticketsV2 .tk-kpi", h: "AT A GLANCE", p: "Open tickets, how many wait on staff, average first reply and closed this month." },
      { sel: "#ticketsV2 .tk-list", h: "TICKET LIST", p: "Filter by type or closed. NEW = nobody has answered yet." },
      { sel: "#ticketsV2 .tk-card", h: "THE CHAT", p: "Everything said in the Discord ticket, live — including images." },
      { sel: "#tkReply", h: "REPLY", p: "Cortana posts your reply in the ticket, signed with your name. Tick 🔒 STAFF NOTE for a note only staff see." },
      { sel: "#ticketsV2 .tk-tb", h: "TICKET TYPES", p: "Each type (Recruitment, Tech Support…) has its own Discord channel with a button. Add more here." },
    ] },
  "panel-send": { g: "DISCORD", t: "Send Message", who: "NCO+", key: "send", s: "Post or edit a message as Cortana — text or a 505th embed.",
    how: ["Pick the channel.", "TEXT or EMBED; add title, message, colour, image, link buttons.", "Pick pings (@everyone asks you to confirm).", "SEND AS CORTANA — or set a time to schedule it.", "Recently sent: open, ✎ edit or 🗑 delete."],
    tour: [
      { sel: "#sendV2 #smCh-ukp, #sendV2 #smCh", h: "CHANNEL", p: "Pick where Cortana posts. Channels Cortana can't post in are greyed out." },
      { sel: "#sendV2 [data-kind]", up: 1, h: "TEXT OR EMBED", p: "Embed = the 505th style box with title, colour and image." },
      { sel: '#sendV2 [data-x="everyone"]', up: 1, h: "PINGS", p: "None, @everyone (asks you to confirm) or any roles." },
      { sel: "#smPrev", h: "LIVE PREVIEW", p: "Exactly how it will look in Discord." },
      { sel: '#sendV2 [data-x="send"]', h: "SEND", p: "Cortana posts it. Edit or delete it later from Recently sent." },
    ] },
  "panel-quick": { g: "DISCORD", t: "Quick Upload", who: "Staff NCO+", key: "qu", s: "Drop screenshots and Cortana posts them in one message.",
    tour: [
      { sel: "#quDrop", h: "DROP IMAGES", p: "Drag up to 10 screenshots here, or click to choose." },
      { sel: "#quickV2 [data-style]", up: 1, h: "STYLE", p: "505 embed (caption + credit), gallery grid, or plain images." },
      { sel: "#quPrev", h: "PREVIEW", p: "How the post will look in Discord." },
      { sel: '#quickV2 [data-x="post"]', h: "POST", p: "Uploads the images, then Cortana posts them. Tick “Also add to the Gallery” to show them on the website." },
    ] },
  "panel-info": { g: "DISCORD", t: "Info Posts", who: "Staff NCO+", key: "info", s: "Permanent posts (rules, info, role picker, FAQ). Cortana edits the same message every time.",
    how: ["Pick a post or ＋ NEW (or start from a template).", "Edit embeds, fields, image and buttons.", "UPDATE IN DISCORD — the same message is edited, never re-posted.", "MISSING means it was deleted in Discord: press RE-POST."],
    tour: [
      { sel: "#infoV2 .ip-list", h: "YOUR POSTS", p: "LIVE, DRAFT or MISSING. Start a new one or use a template." },
      { sel: "#infoV2 .ip-card", h: "THE EDITOR", p: "Up to 10 embeds, fields (▲▼ to reorder), banner, thumbnail and footer." },
      { sel: "#infoV2 .ip-help", h: "BUTTONS", p: "Accept rules, role toggle, link, open a ticket, or a private answer only the clicker sees." },
      { sel: "#ipPrev", h: "PREVIEW", p: "Exactly how it will look in Discord." },
      { sel: '#infoV2 [data-x="pub"]', h: "UPDATE IN DISCORD", p: "Cortana edits the same message — members never see a re-post." },
    ] },
  "panel-mod": { g: "DISCORD", t: "Moderation", who: "NCO+ (kick / ban: Officer+)", key: "modw", s: "Warn, timeout, kick or ban. Every action is a numbered case.",
    how: ["Type a member's name (or paste a Discord ID).", "Pick the action and write the reason (the member sees it).", "Staff note = private.", "3 warnings in 30 days = automatic 24 h timeout."],
    tour: [
      { sel: "#mdWho", h: "MEMBER", p: "Type a name — pick from the list. Paste a Discord ID for people without a website account." },
      { sel: "#modV2 .md-seg", h: "ACTION", p: "Warn, Timeout, Kick or Ban. Kick and Ban need Officer access." },
      { sel: "#mdR", h: "REASON", p: "The member sees this (and gets it by DM if ticked)." },
      { sel: "#modV2 .md-tb", h: "CASES", p: "Every action is a numbered case. Lift timeouts, unban or clear warnings here." },
    ] },
  "panel-modlist": { g: "DISCORD", t: "Modlist", who: "Dev / Command", key: "set", s: "Import the Arma 3 Launcher preset and Cortana posts what was added and removed.",
    tour: [
      { sel: "#mlDrop", h: "IMPORT", p: "Drop the preset .html (Arma 3 Launcher → Mods → Preset → Export)." },
      { sel: "#mlNote", h: "EXTRA MESSAGE", p: "Optional note, e.g. update before Saturday's op." },
      { sel: '#modlistV2 [data-x="post"]', h: "POST", p: "Cortana posts the added / removed lists, the full list and a preset file to download." },
    ] },
  "panel-projects": { g: "WORKSPACE", t: "Project Tracker", who: "Staff NCO+", key: "proj", s: "Staff projects and tasks." },
  "panel-notes": { g: "WORKSPACE", t: "Notes", who: "Staff NCO+", key: "notes", s: "Private or shared notes. Share with people or groups — they get a 🔔 alert." },
  "panel-website": { g: "WORKSPACE", t: "Website", who: "Staff NCO+", key: "web", s: "Edit the public website pages." },
  "panel-officers": { g: "SECURITY", t: "Officer Management", who: "Staff NCO+", key: "om", s: "Who can open which page — per person on top of their role." },
  "panel-network": { g: "SECURITY", t: "Network Status", who: "Staff NCO+", key: "net", s: "Live health of the website, Cortana, database, Discord and instant updates.",
    tour: [
      { sel: "#netV2 .nt-banner", h: "OVERALL", p: "Green = all fine, amber = degraded, red = outage — and what's wrong." },
      { sel: "#netV2 .nt-4", h: "EACH SYSTEM", p: "Website, Cortana, database and instant updates — all live." },
      { sel: "#netV2 .nt-btns", h: "CONTROL", p: "Developers / Command: restart Cortana, re-sync channels and roles, re-register commands." },
    ] },
  "panel-auditv2": { g: "SECURITY", t: "Audit Log", who: "Officer+", key: "audit", s: "Every action: who did what, and when." },
  "panel-cmd-cortana": { g: "COMMAND", t: "Cortana Setup", who: "Dev / Command", key: "set", s: "Channels, roles, pings, welcome and logs for Cortana. Changes apply live.",
    tour: [
      { sel: "#cSetup nav", h: "SECTIONS", p: "✓ set up · ▲ needs setup · ✕ Cortana can't post. Start at Server Check." },
      { sel: "#cSetup .cs-st", h: "SYNC", p: "Channels and roles come from Discord automatically. ⟳ RE-SYNC fetches them again." },
      { sel: "#cSetup [data-save]", h: "SAVE", p: "Nothing changes until you press SAVE. Every change goes to the audit log." },
    ] },
  "panel-cmd-rolesync": { g: "COMMAND", t: "Discord Role Sync", who: "Dev / Command", key: "set", s: "Rank, unit, squad and status kept the same on Discord and the website — both ways.",
    tour: [
      { sel: '#rsyncV2 [data-x="enabled"]', h: "ON / OFF", p: "When on, changes on either side follow within a second." },
      { sel: "#rsyncV2 .rs-tabs", h: "GROUPS", p: "Ranks, units, squads and status — one Discord role each." },
      { sel: "#rsyncV2 .rs-tb", h: "MATCH ROLES", p: "Pick the Discord role for each value. ⚡ AUTO-MATCH fills them by name." },
      { sel: '#rsyncV2 [data-x="all"]', h: "CHECK EVERYONE", p: "Makes everyone's Discord roles match their personnel file." },
    ] },
  "panel-cmd-settings": { g: "COMMAND", t: "Settings", who: "Dev / Command", key: "set", s: "Webhooks, terminal role → Discord role map and system settings." },
  "panel-cmd-promote": { g: "COMMAND", t: "Command Promotions", who: "Dev / Command", key: "set", s: "Promote staff to officer and command roles." },
  "panel-cmd-staff": { g: "COMMAND", t: "Command Staff", who: "Dev / Command", key: "set", s: "Who's in Command, Developers, Officers and Senior NCOs." },
  "panel-bot": { g: "COMMAND", t: "Bot Server", who: "Dev / Command", key: "bot", s: "Cortana's process and logs." },
};
const GROUPS = ["GETTING STARTED", "MANPOWER", "OPERATIONS", "DISCORD", "WORKSPACE", "SECURITY", "COMMAND"];
const CMDS = [["Everyone", "/modlist · /coinflip · /ping · /status · /help"], ["Staff NCO+", "/warn · /timeout · /purge"], ["Officer+", "/kick · /ban (confirm first)"],
  ["Posting", "/announce (form) · /say · /poll"], ["Developers / Command", "/auxmod (Added / Changed / Fixed / Removed) · /modlist with a preset · /restart"]];
const FAQ = [["Why can't I see a page?", "Your access doesn't include it. Ask a Staff NCO or above (Security → Officer Management)."],
  ["My Discord rank didn't change", "Your Discord must be linked on your personnel file, and Role Sync must be on."],
  ["Cortana is offline?", "Security → Network Status shows what's wrong."],
  ["Something looks broken", "Open a Tech Support ticket in Discord."]];

/* ───────── tour engine ───────── */
let tour = null;
const ui = {};
function el(sel, up = 0) {
  let e = null;
  for (const s of sel.split(/\s*,\s*/)) { e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null || x.getClientRects().length); if (e) break; }
  for (let n = 0; e && n < up; n++) e = e.parentElement;
  return e;
}
function place() {
  if (!tour) return;
  const st = tour.steps[tour.i], t = st.sel ? el(st.sel, st.up) : null;
  ui.n.textContent = `STEP ${tour.i + 1} OF ${tour.steps.length}`;
  ui.bar.style.width = ((tour.i + 1) / tour.steps.length) * 100 + "%";
  ui.h.textContent = st.h;
  ui.p.innerHTML = st.p;
  ui.back.hidden = tour.i === 0;
  ui.next.textContent = tour.i === tour.steps.length - 1 ? "FINISH ✓" : "NEXT →";
  if (t) {
    t.scrollIntoView({ block: "center", behavior: "instant" });
    const r = t.getBoundingClientRect(), pad = 6;
    Object.assign(ui.spot.style, { display: "block", left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    let top = r.bottom + 14, left = Math.min(Math.max(12, r.left), innerWidth - 352);
    if (top + 200 > innerHeight) top = Math.max(12, r.top - 214);
    Object.assign(ui.tip.style, { top: top + "px", left: left + "px", transform: "" });
  } else { // element not on screen (empty list…): centred, no spotlight
    Object.assign(ui.spot.style, { display: "block", left: "50%", top: "50%", width: "0px", height: "0px" });
    Object.assign(ui.tip.style, { top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
  }
  ui.next.focus();
}
async function go(i) {
  if (!tour) return;
  tour.i = i;
  const st = tour.steps[i];
  if (st.click) { const c = el(st.click); if (c) { c.click(); await new Promise((r) => setTimeout(r, 250)); } }
  place();
}
export function startTour(panelId) {
  const h = H[panelId];
  if (!h?.tour) return;
  closeSide();
  if (typeof window.showPanel === "function" && document.getElementById(panelId)?.classList.contains("hidden")) window.showPanel(panelId);
  tour = { panelId, steps: h.tour, i: 0, back: document.activeElement };
  ui.wrap.hidden = false;
  setTimeout(() => go(0), 300);
}
function endTour() {
  if (!tour) return;
  const end = tour.steps.find((s) => s.click) ? el('#evV2 [data-act="list"]') : null; // leave forms the way we found them
  if (end && tour.panelId === "panel-events" && !document.querySelector("#evV2 .wiz")?.hidden) end.click();
  ui.wrap.hidden = true;
  ui.spot.style.display = "none";
  tour.back?.focus?.();
  tour = null;
}

/* ───────── "?" side panel ───────── */
let acc = {};
const canSee = (h) => !h.key || acc[h.key] || (h.key === "modw" && acc.modk);
function article(id, h) {
  return `<div class="hl-crumb">${esc(h.g)} › ${esc(h.t.toUpperCase())}<span class="hl-who">${esc(h.who)}</span></div><h3>${esc(h.t.toUpperCase())}</h3><p>${esc(h.s)}</p>
    ${h.how ? `<h4>HOW TO</h4><ol>${h.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${(h.tips || []).map((x) => `<div class="hl-tip">💡 ${esc(x)}</div>`).join("")}${h.warn ? `<div class="hl-warn">▲ ${esc(h.warn)}</div>` : ""}
    <div class="hl-btns">${h.tour ? `<button class="b gold" data-tour="${id}">▶ SHOW ME HOW</button>` : ""}<button class="b" data-open="${id}">OPEN ${esc(h.t.toUpperCase())} →</button></div>`;
}
function openSide(id) {
  const h = H[id];
  if (!h) return;
  ui.side.innerHTML = `<button class="xx" data-close aria-label="Close help">✕</button>${article(id, h)}`;
  ui.side.hidden = false;
  ui.side.querySelector("[data-tour], [data-open]")?.focus();
}
function closeSide() { if (ui.side) ui.side.hidden = true; }

/** Put a "?" by each page title that has help. */
function addQ(panel) {
  const h = H[panel.id];
  if (!h || panel.querySelector(".hl-q")) return;
  const title = panel.querySelector(".panel-title, .h1");
  if (!title) return;
  const b = document.createElement("button");
  b.className = "hl-q";
  b.type = "button";
  b.textContent = "?";
  b.setAttribute("aria-label", `Help: ${h.t}`);
  b.dataset.help = panel.id;
  title.appendChild(b);
}

/* ───────── HELP page ───────── */
let q = "", sel = "panel-events", grp = "";
function page(root) {
  const items = Object.entries(H).filter(([, h]) => canSee(h) && (!grp || h.g === grp) && (!q || `${h.t} ${h.s} ${(h.how || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const cur = H[sel] && canSee(H[sel]) ? sel : items[0]?.[0];
  root.innerHTML = `<div class="panel-title">HELP</div><div class="hl-sub">WHAT EVERY PAGE DOES · WHO CAN USE IT · HOW-TO STEPS · ▶ SHOW ME = GUIDED TOUR ON THE REAL PAGE</div>
  <div class="hl-lay"><div class="hl-side"><input class="fld" id="hlQ" value="${esc(q)}" placeholder="⌕ Search help…" aria-label="Search help">
    ${["", ...GROUPS].map((g) => `<button class="${g === grp ? "on" : ""}" data-grp="${g}">${g || "📚 ALL PAGES"}</button>`).join("")}<button data-grp="__cmd" class="${grp === "__cmd" ? "on" : ""}">⌘ CORTANA COMMANDS</button><button data-grp="__faq" class="${grp === "__faq" ? "on" : ""}">❓ FAQ</button>
    <p class="hl-n">ONLY SHOWS PAGES YOU CAN OPEN</p></div>
  <div>${grp === "__cmd" ? `<div class="hl-card">${CMDS.map(([w, c]) => `<div class="hl-row"><b>${esc(w)}</b><span>${esc(c)}</span></div>`).join("")}<p class="hl-n" style="margin-top:10px">STAFF ANSWERS ARE PRIVATE · KICK / BAN / RESTART ASK YOU TO CONFIRM</p></div>`
    : grp === "__faq" ? `<div class="hl-card">${FAQ.map(([a, b], n) => `<details ${n ? "" : "open"}><summary>${esc(a)}</summary><p>${esc(b)}</p></details>`).join("")}</div>`
    : GROUPS.filter((g) => items.some(([, h]) => h.g === g)).map((g) => `<div class="hl-g"><div class="hl-gh">${g}</div><div class="hl-cards">${items.filter(([, h]) => h.g === g).map(([id, h]) => `<button class="hl-c ${id === cur ? "on" : ""}" data-sel="${id}"><b>${esc(h.t)}${h.tour ? ' <span class="hl-tb">▶ TOUR</span>' : ""}</b><span>${esc(h.s)}</span><em>${esc(h.who)}</em></button>`).join("")}</div></div>`).join("") || '<div class="empty">Nothing matches.</div>'}</div>
  <div>${cur && !grp.startsWith("__") ? `<div class="hl-card hl-art">${article(cur, H[cur])}</div>` : ""}</div></div>`;
}

const CSS = `
.hl-q{all:unset;cursor:pointer;display:inline-grid;place-items:center;width:22px;height:22px;margin-left:10px;border:1px solid #00D9FF;color:#00D9FF;border-radius:50%;font:700 12px monospace;vertical-align:middle;letter-spacing:0}
.hl-q:hover,.hl-q:focus-visible{background:rgba(0,217,255,.15);outline:none}
.hl-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);z-index:10040;background:#07131b;border-left:1px solid #00D9FF;box-shadow:-12px 0 30px rgba(0,0,0,.6);padding:20px 22px;overflow:auto;color:#cfe9f2;font:14px/1.5 "Rajdhani","Segoe UI",sans-serif}
.hl-panel .xx{all:unset;cursor:pointer;position:absolute;top:12px;right:14px;color:#6f8a96;font-size:18px}
.hl-crumb{font:10px monospace;letter-spacing:1.5px;color:#6f8a96;display:flex;justify-content:space-between;gap:8px;padding-right:24px}.hl-who{border:1px solid rgba(0,217,255,.18);padding:1px 6px}
.hl-panel h3,.hl-art h3{font:700 15px monospace;letter-spacing:2px;color:#00D9FF;margin:8px 0 4px}.hl-panel h4,.hl-art h4{font:700 12px monospace;letter-spacing:2px;margin:16px 0 6px}
.hl-panel ol,.hl-art ol{margin:0;padding-left:18px;line-height:1.8}
.hl-tip{background:rgba(0,217,255,.06);border-left:3px solid #00D9FF;padding:8px 12px;font-size:13px;margin-top:10px}.hl-warn{background:rgba(245,158,11,.06);border-left:3px solid #f59e0b;padding:8px 12px;font-size:13px;margin-top:8px}
.hl-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.hl-tour[hidden]{display:none}
.hl-spot{position:fixed;z-index:10070;border:2px solid #00D9FF;box-shadow:0 0 0 9999px rgba(2,5,8,.78),0 0 18px rgba(0,217,255,.5);transition:all .25s ease;pointer-events:none;display:none}
.hl-tipbox{position:fixed;z-index:10071;width:340px;max-width:calc(100vw - 24px);background:#07131b;border:1px solid #00D9FF;box-shadow:0 12px 30px rgba(0,0,0,.6);padding:14px 16px;color:#cfe9f2;font:14px/1.5 "Rajdhani","Segoe UI",sans-serif}
.hl-tipbox .n{font:10px monospace;letter-spacing:2px;color:#6f8a96}.hl-tipbox .bar{height:3px;background:#0c1a22;margin:6px 0 10px}.hl-tipbox .bar i{display:block;height:100%;background:#00D9FF;transition:width .25s}
.hl-tipbox h3{font:700 14px monospace;letter-spacing:1.5px;color:#00D9FF;margin:0 0 6px}.hl-tipbox p{margin:0 0 12px}
.hl-tipbox .ft{display:flex;justify-content:space-between;gap:6px}.hl-tipbox .ft>span{display:flex;gap:6px}
.hl-block{position:fixed;inset:0;z-index:10069}
.hl-tipbox .b,.hl-panel .b,#helpV2 .hl-btns .b{all:unset;box-sizing:border-box;cursor:pointer;padding:7px 14px;border:1px solid rgba(0,217,255,.35);background:rgba(0,217,255,.06);color:#00D9FF;font:700 11px "Share Tech Mono",monospace;letter-spacing:1.5px}
.hl-tipbox .b:hover,.hl-panel .b:hover,#helpV2 .hl-btns .b:hover{background:rgba(0,217,255,.15);border-color:#00D9FF}
.hl-tipbox .b.gold,.hl-panel .b.gold,#helpV2 .hl-btns .b.gold{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.08)}
.hl-tipbox .b.gold:hover,.hl-panel .b.gold:hover,#helpV2 .hl-btns .b.gold:hover{background:rgba(245,158,11,.18)}
.hl-tipbox .b:focus-visible,.hl-panel .b:focus-visible,#helpV2 .hl-btns .b:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
.hl-tipbox .b[hidden]{display:none}
@media(prefers-reduced-motion:reduce){.hl-spot,.hl-tipbox .bar i{transition:none}}
#helpV2 .hl-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#helpV2 .hl-lay{display:grid;grid-template-columns:220px minmax(0,1fr) 380px;gap:18px;align-items:start}
#helpV2 .hl-side{border-right:1px solid rgba(0,217,255,.18);padding-right:12px;display:grid;gap:2px}#helpV2 .hl-side .fld{margin-bottom:10px}
#helpV2 .hl-side button{all:unset;cursor:pointer;padding:8px 10px;font:700 11px monospace;letter-spacing:1.5px;color:#6f8a96;border-left:2px solid transparent}#helpV2 .hl-side button.on{color:#00D9FF;border-left-color:#00D9FF;background:rgba(0,217,255,.08)}#helpV2 .hl-side button:focus-visible{outline:2px solid #00D9FF}
#helpV2 .hl-n{color:#6f8a96;font:10px monospace;letter-spacing:1px;margin:12px 0 0}
#helpV2 .hl-g{margin-bottom:16px}#helpV2 .hl-gh{font:700 11px monospace;letter-spacing:3px;color:#00D9FF;margin-bottom:8px}
#helpV2 .hl-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
#helpV2 .hl-c{all:unset;cursor:pointer;box-sizing:border-box;background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:12px 14px;display:grid;gap:6px}
#helpV2 .hl-c:hover,#helpV2 .hl-c.on{border-color:#00D9FF}#helpV2 .hl-c:focus-visible{outline:2px solid #00D9FF}
#helpV2 .hl-c b{font:700 13px monospace;letter-spacing:1px}#helpV2 .hl-c span{font-size:13px}#helpV2 .hl-c em{font:normal 10px monospace;letter-spacing:1px;color:#6f8a96}
#helpV2 .hl-tb{font:10px monospace;color:#22e07a;border:1px solid rgba(34,224,122,.4);padding:0 4px;margin-left:4px}
#helpV2 .hl-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#helpV2 .hl-row{display:grid;grid-template-columns:180px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,217,255,.08)}#helpV2 .hl-row b{font:700 12px monospace;letter-spacing:1px}
#helpV2 details{border-bottom:1px solid rgba(0,217,255,.18);padding:9px 0}#helpV2 summary{cursor:pointer}#helpV2 details p{color:#6f8a96;margin:6px 0 0}
@media(max-width:1200px){#helpV2 .hl-lay{grid-template-columns:1fr}#helpV2 .hl-side{border-right:0}}
`;

onReady(() => {
  addCss("help-v2", CSS);
  // Tour UI (one for the whole terminal).
  ui.wrap = document.createElement("div");
  ui.wrap.className = "hl-tour";
  ui.wrap.hidden = true;
  ui.wrap.innerHTML = `<div class="hl-block"></div><div class="hl-spot"></div><div class="hl-tipbox" role="dialog" aria-live="polite" aria-labelledby="hlTH"><div class="n"></div><div class="bar"><i></i></div><h3 id="hlTH"></h3><p></p>
    <div class="ft"><button class="b" data-t="skip">SKIP TOUR</button><span><button class="b" data-t="back">← BACK</button><button class="b gold" data-t="next">NEXT →</button></span></div></div>`;
  document.body.appendChild(ui.wrap);
  Object.assign(ui, { spot: ui.wrap.querySelector(".hl-spot"), tip: ui.wrap.querySelector(".hl-tipbox"), n: ui.wrap.querySelector(".n"), bar: ui.wrap.querySelector(".bar i"), h: ui.wrap.querySelector("h3"), p: ui.wrap.querySelector("p"), back: ui.wrap.querySelector('[data-t="back"]'), next: ui.wrap.querySelector('[data-t="next"]') });
  ui.wrap.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]")?.dataset.t;
    if (t === "skip") endTour();
    if (t === "back" && tour?.i > 0) go(tour.i - 1);
    if (t === "next") tour.i < tour.steps.length - 1 ? go(tour.i + 1) : endTour();
  });
  document.addEventListener("keydown", (e) => {
    if (tour) {
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); ui.next.click(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ui.back.hidden || ui.back.click(); }
      else if (e.key === "Escape") { e.preventDefault(); endTour(); }
    } else if (e.key === "Escape" && ui.side && !ui.side.hidden) closeSide();
  }, true);
  addEventListener("resize", () => tour && place());

  // "?" side panel.
  ui.side = document.createElement("aside");
  ui.side.className = "hl-panel v2";
  ui.side.hidden = true;
  ui.side.setAttribute("aria-label", "Page help");
  document.body.appendChild(ui.side);

  document.addEventListener("click", (e) => {
    const q1 = e.target.closest(".hl-q");
    if (q1) { e.preventDefault(); e.stopPropagation(); return openSide(q1.dataset.help); }
    const t = e.target.closest("[data-tour]");
    if (t) return startTour(t.dataset.tour);
    const o = e.target.closest(".hl-panel [data-open], #helpV2 [data-open]");
    if (o) { closeSide(); return window.showPanel?.(o.dataset.open); }
    if (e.target.closest(".hl-panel [data-close]")) closeSide();
  }, true);

  // Add "?" to page titles as pages render.
  const scan = () => document.querySelectorAll(".main-content > .panel").forEach(addQ);
  new MutationObserver(() => scan()).observe(document.querySelector(".main-content") || document.body, { childList: true, subtree: true });
  scan();

  onAccess((me) => { acc = me?.access || {}; if (root) page(root); });
  const root = mountPanel("panel-help", "helpV2", () => page(root));
  if (root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-grp],[data-sel]");
      if (!b) return;
      if (b.dataset.grp !== undefined) grp = b.dataset.grp;
      if (b.dataset.sel) sel = b.dataset.sel;
      page(root);
    });
    root.addEventListener("input", (e) => { if (e.target.id === "hlQ") { q = e.target.value; page(root); const i = root.querySelector("#hlQ"); i.focus(); i.setSelectionRange(q.length, q.length); } });
  }
});
