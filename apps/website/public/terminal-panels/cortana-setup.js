/**
 * COMMAND → Cortana Setup (approved mock 2026-11-10). Commander / Developer only ("set").
 *
 * Every channel / role list comes from Cortana's Discord sync (discord_channels / discord_roles,
 * real IDs). Staff pick by name; IDs are saved to settings/cortana. Cortana reads it live — no restart.
 * First visit: settings are auto-filled by matching names; nothing is saved until SAVE.
 */
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, closeModal, cortanaStatus, db, esc, getMe, memberName, mountPanel, notify, onReady, openModal } from "./_common.js";
import { cortanaJob } from "./discord-common.js";

const DOC = () => doc(db, "settings", "cortana");
const OFFICIAL_SIGNUP = ["killjoy-1-1", "killjoy-1-2", "jtf-23", "hm", "pilots", "event-schedule"];
const TABS = [
  ["check", "SERVER CHECK"], ["events", "EVENTS"], ["voice", "VOICE & STAGE"], ["welcome", "WELCOME"], ["info", "INFO POSTS"],
  ["ann", "ANNOUNCEMENTS"], ["aux", "AUX MOD UPDATES"], ["tickets", "TICKETS"], ["logs", "LOGS"],
];

let posts = [], ttypes = [];
let chans = [], roles = [], cfg = null, saved = "", tab = "check", root = null, canEdit = false, autoNote = null;
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const chan = (id) => chans.find((c) => c.id === id);
const role = (id) => roles.find((r) => r.id === id);
const isText = (c) => c.type === "text" || c.type === "announcement";
const byName = (list, name) => { const n = norm(name); return list.find((x) => norm(x.name) === n) || (n.length > 2 ? list.find((x) => norm(x.name).endsWith(n)) : null) || null; };
const dirty = () => JSON.stringify(cfg) !== saved;

/* ───────── defaults + auto-fill ───────── */
function blank() {
  return {
    signupChannels: [], eventChannelId: "", eventListChannelId: "", missionLogChannelId: "", eventPingRoleIds: [], channelPings: {}, discordEventsSignups: true,
    voiceChannels: [], stageChannels: [],
    welcome: { on: false, channelId: "", roleId: "", dm: false, text: "Welcome to the 505th, {user}!\nRead the rules, then sign up on the website to start Basic Training." },
    announce: { channelId: "", ping: "everyone", minRole: "officer" },
    aux: { channelId: "", pingRoleId: "", template: "📦 Aux Mod {version} is out!\n{changes}\nUpdate via the launcher: {link}" },
    logs: { modLogId: "", joinLeaveId: "", messageLogId: "", auditId: "" },
  };
}
/** Fill empty settings by matching channel / role names. Returns [found, tried]. */
function autoFill(c) {
  let found = 0, tried = 0;
  const text = chans.filter(isText);
  const pick = (cur, list, ...names) => { if (cur) return cur; tried++; for (const n of names) { const h = byName(list, n); if (h) { found++; return h.id; } } return ""; };
  if (!c.signupChannels.length) { tried++; c.signupChannels = OFFICIAL_SIGNUP.map((n) => byName(text, n)?.id).filter(Boolean); if (c.signupChannels.length) found++; }
  c.eventChannelId = pick(c.eventChannelId, text, "event-schedule", "events", "operations");
  c.eventListChannelId = pick(c.eventListChannelId, text, "event-schedule", "events");
  c.missionLogChannelId = pick(c.missionLogChannelId, text, "mission-log");
  if (!c.eventPingRoleIds.length) c.eventPingRoleIds = ["everyone"];
  for (const id of c.signupChannels) if (!(id in c.channelPings)) { const r = byName(roles, chan(id)?.name || ""); if (r) c.channelPings[id] = r.id; }
  if (!c.voiceChannels.length) c.voiceChannels = chans.filter((x) => x.type === "voice").slice(0, 8).map((x) => x.id);
  if (!c.stageChannels.length) c.stageChannels = chans.filter((x) => x.type === "stage").map((x) => x.id);
  c.welcome.channelId = pick(c.welcome.channelId, text, "welcome", "arrivals");
  c.announce.channelId = pick(c.announce.channelId, text, "announcements");
  c.aux.channelId = pick(c.aux.channelId, text, "aux-mod-updates", "mod-updates", "aux-mod");
  c.logs.modLogId = pick(c.logs.modLogId, text, "mod-log", "moderation-log");
  c.logs.joinLeaveId = pick(c.logs.joinLeaveId, text, "join-leave", "joins");
  c.logs.auditId = pick(c.logs.auditId, text, "staff-audit", "audit-log");
  return [found, tried];
}

/* ───────── clean test data (switch-over prep) ───────── */
async function cleanTest() {
  const all = (c) => getDocs(collection(db, c)).then((q) => q.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => null);
  const [evs, tks, cs, ms] = await Promise.all(["community_events", "tickets", "mod_cases", "discord_messages"].map(all));
  const n = (x) => (x ? x.length : "?");
  const events = (evs || []).sort((a, b) => String(b.startAtISO || "").localeCompare(String(a.startAtISO || "")));
  const day = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "no date");
  const ov = openModal(`<div class="cl">
    <div class="cl-h"><b>🧹 CLEAN TEST DATA</b><button class="b" data-close aria-label="Close">✕</button></div>
    <p class="cl-n">Tick what to remove. Database only — the Discord messages stay. Members, ranks, settings, info posts and ticket types are never touched.</p>
    <div class="cl-g"><b>EVENTS · ${events.length}</b><span><button class="b" data-cl="all">TICK ALL</button> <button class="b" data-cl="none">NONE</button></span></div>
    <div class="cl-list">${events.map((e) => `<label class="cl-r"><input type="checkbox" data-ev="${esc(e.id)}"><span><b>${esc(e.title || "(no title)")}</b><small>${esc(day(e.startAtISO))} · ${esc(String(e.status || "upcoming").toUpperCase())} · ${(e.signups || []).length} sign-ups</small></span></label>`).join("") || '<p class="cl-n">No events.</p>'}</div>
    <div class="cl-g"><b>EVERYTHING IN</b></div>
    <label class="cl-r"><input type="checkbox" data-k="tickets" checked><span><b>Tickets · ${n(tks)}</b><small>All ticket records + chats (ticket types stay)</small></span></label>
    <label class="cl-r"><input type="checkbox" data-k="cases" checked><span><b>Moderation cases · ${n(cs)}</b><small>All warnings / timeouts / kicks / bans on record</small></span></label>
    <label class="cl-r"><input type="checkbox" data-k="messages" checked><span><b>Sent messages list · ${n(ms)}</b><small>Send Message → Recently sent (the Discord messages stay)</small></span></label>
    <label class="cl-r"><input type="checkbox" data-k="counters" checked><span><b>Reset numbers</b><small>Next ticket = #0001 · next case = #1</small></span></label>
    <div class="cl-f"><button class="b" data-close>CANCEL</button><button class="b red" data-cl="go">CLEAN…</button></div></div>`, { color: "rgba(255,77,77,.45)", title: "#ff4d4d", width: 640, pad: true });
  addCss("cs-clean", `.cl{display:grid;gap:10px;font-family:'Share Tech Mono',monospace;color:#cfe9f2}.cl-h{display:flex;justify-content:space-between;align-items:center}.cl-h b{color:#ff4d4d;letter-spacing:2px}
.cl-n{color:#6f8a96;font-size:12px;margin:0}.cl-g{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;letter-spacing:2px;color:#00D9FF}
.cl-list{max-height:260px;overflow:auto;border:1px solid rgba(0,217,255,.18)}.cl-r{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid rgba(0,217,255,.08);cursor:pointer}
.cl-r input{accent-color:#ff4d4d;width:16px;height:16px;margin-top:2px}.cl-r b{display:block;font-size:13px}.cl-r small{color:#6f8a96;font-size:11px}.cl-f{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}`);
  ov.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cl]");
    if (!b) return;
    if (b.dataset.cl === "all" || b.dataset.cl === "none") return ov.querySelectorAll("[data-ev]").forEach((c) => (c.checked = b.dataset.cl === "all"));
    const eventIds = [...ov.querySelectorAll("[data-ev]:checked")].map((c) => c.dataset.ev);
    const k = Object.fromEntries([...ov.querySelectorAll("[data-k]")].map((c) => [c.dataset.k, c.checked]));
    const parts = [eventIds.length ? `${eventIds.length} events` : "", k.tickets ? `${n(tks)} tickets` : "", k.cases ? `${n(cs)} cases` : "", k.messages ? `${n(ms)} sent messages` : "", k.counters ? "reset numbers" : ""].filter(Boolean);
    if (!parts.length) return notify("NOTHING TICKED", 1);
    closeModal();
    if (!(await ask({ kind: "big", title: "CLEAN TEST DATA?", body: `Removes: ${parts.join(" · ")}.`, warn: "THIS CANNOT BE UNDONE.", go: "CLEAN" }))) return;
    try {
      const r = await cortanaJob("cleanup.testdata", { eventIds, ...k }, { ms: 30000 });
      notify(r ? `✓ CLEANED — ${parts.join(" · ").toUpperCase()}` : "◷ CORTANA IS OFFLINE — DONE WHEN IT'S BACK", !r);
    } catch (err) { notify("CLEAN FAILED: " + err.message, 1); }
  });
}

/* ───────── status per tab ───────── */
function chk(id, need = true) {
  if (!id) return need ? "warn" : "ok";
  const c = chan(id);
  if (!c) return "bad";
  return isText(c) && !c.botCanSend ? "bad" : "ok";
}
function tabState(t) {
  const w = (...s) => (s.includes("bad") ? "bad" : s.includes("warn") ? "warn" : "ok");
  switch (t) {
    case "events": return w(cfg.signupChannels.length ? "ok" : "warn", ...cfg.signupChannels.map((x) => chk(x)), chk(cfg.eventChannelId), chk(cfg.eventListChannelId), chk(cfg.missionLogChannelId), ...cfg.eventPingRoleIds.map((r) => (r === "everyone" || role(r) ? "ok" : "bad")));
    case "voice": return w(...[...cfg.voiceChannels, ...cfg.stageChannels].map((x) => (chan(x) ? "ok" : "bad")));
    case "welcome": return cfg.welcome.on ? w(chk(cfg.welcome.channelId), cfg.welcome.roleId && !role(cfg.welcome.roleId) ? "bad" : "ok") : "off";
    case "ann": return chk(cfg.announce.channelId);
    case "aux": return chk(cfg.aux.channelId);
    case "logs": return w(chk(cfg.logs.modLogId, false), chk(cfg.logs.joinLeaveId, false), chk(cfg.logs.messageLogId, false), chk(cfg.logs.auditId, false));
    case "info": return posts.length ? w(...posts.map((p) => (p.discord?.missing ? "bad" : p.channelId ? chk(p.channelId) : "warn"))) : "warn";
    case "tickets": return ttypes.length ? w(...ttypes.map((t) => (!t.panel?.messageId ? "warn" : chk(t.channelId)))) : "warn";
    default: return "ok";
  }
}
const MARK = { ok: ['✓', "var(--g)"], warn: ["▲", "var(--a)"], bad: ["✕", "var(--r)"], off: ["○", "var(--m)"], later: ["—", "var(--m)"] };

/* ───────── pickers ───────── */
function chanOptions(cur, kinds = ["text", "announcement"], none = "— pick a channel —") {
  const list = chans.filter((c) => kinds.includes(c.type)).sort((a, b) => (a.position || 0) - (b.position || 0));
  const groups = new Map();
  for (const c of list) { const g = c.parentName || "NO CATEGORY"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
  const missing = cur && !chan(cur) ? `<option value="${esc(cur)}" selected>✕ deleted channel</option>` : "";
  return `<option value="">${esc(none)}</option>${missing}${[...groups].map(([g, cs]) => `<optgroup label="${esc(g.toUpperCase())}">${cs.map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${c.type === "voice" ? "🔊" : c.type === "stage" ? "🎙" : "#"} ${esc(c.name)}${isText(c) && !c.botCanSend ? " (Cortana can't post)" : ""}</option>`).join("")}</optgroup>`).join("")}`;
}
function roleOptions(cur, none = "— no role —", extra = "") {
  const list = roles.filter((r) => !r.managed).sort((a, b) => (b.position || 0) - (a.position || 0));
  return `<option value="">${esc(none)}</option>${extra}${list.map((r) => `<option value="${r.id}" ${r.color && r.color !== "#000000" ? `data-color="${r.color}"` : ""} ${r.id === cur ? "selected" : ""}>@${esc(r.name)}</option>`).join("")}`;
}
function note(id, kind = "chan") {
  if (!id) return "";
  const x = kind === "chan" ? chan(id) : role(id);
  if (!x) return `<small class="cs-n bad">✕ ${kind === "chan" ? "CHANNEL" : "ROLE"} MISSING IN DISCORD — PICK ANOTHER</small>`;
  if (kind === "chan" && isText(x) && !x.botCanSend) return `<small class="cs-n bad">✕ CORTANA CAN'T POST HERE — GIVE IT "VIEW" + "SEND MESSAGES"</small>`;
  return `<small class="cs-n">ID ${esc(id)}</small>`;
}
const sel = (path, html, extra = "") => `<select class="fld" data-p="${path}" ${canEdit ? "" : "disabled"} ${extra}>${html}</select>`;
const row = (label, inner, sub = "") => `<div class="cs-row"><label>${label}${sub ? `<small>${sub}</small>` : ""}</label><div>${inner}</div></div>`;
const tog = (path, on) => `<button class="cs-tog ${on ? "on" : ""}" data-tog="${path}" role="switch" aria-checked="${on}" ${canEdit ? "" : "disabled"}><span></span></button>`;
function chipList(path, ids, kind) {
  const list = ids.map((id) => {
    const x = kind === "role" ? (id === "everyone" ? { name: "everyone", color: "#f59e0b" } : role(id)) : chan(id);
    const color = kind === "role" && x?.color && x.color !== "#000000" ? x.color : "";
    const label = x ? (kind === "role" ? "@" : x.type === "voice" ? "🔊 " : x.type === "stage" ? "🎙 " : "# ") + x.name : "✕ deleted";
    return `<span class="cs-chip ${x ? "" : "bad"}" ${color ? `style="border-color:${color};color:${color}"` : ""}>${esc(label)}${canEdit ? `<button data-rm="${path}" data-id="${id}" aria-label="Remove ${esc(label)}">✕</button>` : ""}</span>`;
  }).join("");
  return `<div class="cs-chips">${list || '<span class="cs-n">None picked</span>'}</div>`;
}
function adder(path, kind, kinds) {
  if (!canEdit) return "";
  const opts = kind === "role"
    ? roleOptions("", "＋ ADD ROLE", path === "eventPingRoleIds" ? '<option value="everyone">@everyone</option>' : "")
    : chanOptions("", kinds, "＋ ADD CHANNEL");
  return `<select class="fld cs-add" data-add="${path}">${opts}</select>`;
}

/* ───────── tabs ───────── */
function body() {
  const c = cfg;
  if (tab === "check") {
    const probs = TABS.filter(([k]) => ["warn", "bad"].includes(tabState(k)));
    return `<h2>SERVER CHECK</h2><p class="sub">Cortana checks it can see and post in everything it needs.</p>
      ${autoNote ? `<div class="cs-card" style="border-color:rgba(34,224,122,.4)"><h3 style="color:var(--g)">⚡ AUTO-FILL DONE <span class="cs-pill ok">${autoNote[0]} OF ${autoNote[1]} FOUND</span></h3><p>Cortana matched settings by name. Check each tab, then press SAVE. Nothing is saved until you do.</p></div>` : ""}
      <div class="cs-grid3"><div class="cs-mini" id="csOnline"><b>…</b><small>Checking Cortana</small></div>
      <div class="cs-mini"><b style="color:${chans.length ? "var(--g)" : "var(--a)"}">${chans.length ? "✓ SYNCED" : "▲ NOT SYNCED"}</b><small>${chans.length} channels · ${roles.length} roles</small></div>
      <div class="cs-mini"><b style="color:${chans.filter(isText).every((x) => x.botCanSend) ? "var(--g)" : "var(--a)"}">${chans.filter((x) => isText(x) && x.botCanSend).length}/${chans.filter(isText).length} TEXT</b><small>Channels Cortana can post in</small></div></div>
      <div class="cs-card" style="margin-top:14px"><h3>PROBLEMS FOUND <span class="cs-pill ${probs.length ? "wr" : "ok"}">${probs.length}</span></h3>
      ${probs.length ? probs.map(([k, l]) => `<p>${MARK[tabState(k)][0]} <a href="#" data-tab="${k}">${l}</a></p>`).join("") : "<p>None — everything Cortana needs is set up.</p>"}</div>
      ${canEdit ? `<div class="cs-card"><h3>⤓ IMPORT FROM OLD CORTANA</h3><p>Switch-over night only (Cortana running on the real 505th server). Brings in the old Rules, Info, Unit Info, Stalker and Notification Roles posts as Info Posts — they keep the old messages, so UPDATE IN DISCORD edits them in place — and fills empty settings (logs, mission log, events, mod updates, announcements). Never overwrites anything.</p><button class="b" data-x="legacy">⤓ IMPORT FROM OLD CORTANA</button></div>
      <div class="cs-card" style="border-color:rgba(255,77,77,.35)"><h3 style="color:var(--r)">🧹 CLEAN TEST DATA</h3><p>Before the switch-over: remove test events, tickets, moderation cases and the sent-messages list, and start ticket # and case # again at 1. You choose exactly what goes. Database only — nothing in Discord is deleted. Members, ranks, settings, info posts and ticket types are never touched.</p><button class="b red" data-x="clean">🧹 CLEAN TEST DATA…</button></div>` : ""}`;
  }
  if (tab === "events") {
    const pings = c.signupChannels.map((id) => `<span># ${esc(chan(id)?.name || "deleted")}</span>${sel(`channelPings.${id}`, roleOptions(c.channelPings[id] || "", "Use default ping"))}`).join("");
    return `<h2>EVENTS</h2><p class="sub">Where sign-ups go, and who gets pinged.</p>
      <div class="cs-card"><h3>SIGN-UP CHANNELS <span class="cs-pill">${c.signupChannels.length}</span></h3><p>The channel buttons in the Create Event wizard. Saved by ID — renaming in Discord never breaks it.</p>
      ${chipList("signupChannels", c.signupChannels, "chan")}${adder("signupChannels", "chan", ["text", "announcement"])}</div>
      <div class="cs-card"><h3>POSTS &amp; PINGS</h3>
      ${row("DEFAULT SIGN-UP CHANNEL", sel("eventChannelId", chanOptions(c.eventChannelId)) + note(c.eventChannelId), "Discord-made events post here")}
      ${row("UPCOMING EVENTS LIST", sel("eventListChannelId", chanOptions(c.eventListChannelId)) + note(c.eventListChannelId))}
      ${row("MISSION LOG", sel("missionLogChannelId", chanOptions(c.missionLogChannelId)) + note(c.missionLogChannelId))}
      ${row("DEFAULT PING ON NEW EVENT", chipList("eventPingRoleIds", c.eventPingRoleIds, "role") + adder("eventPingRoleIds", "role") + (c.eventPingRoleIds.includes("everyone") ? '<small class="cs-n wr">▲ @everyone pings the whole server on every new sign-up post</small>' : ""), "pick more than one")}
      ${c.signupChannels.length ? row("SQUAD CHANNEL PING", `<div class="cs-map">${pings}</div><small class="cs-n">A post in that channel pings ONLY its role (not the default ping). "Use default ping" = the default above.</small>`) : ""}
      ${row("DISCORD-MADE EVENTS GET SIGN-UPS", tog("discordEventsSignups", c.discordEventsSignups !== false))}</div>`;
  }
  if (tab === "voice")
    return `<h2>VOICE &amp; STAGE</h2><p class="sub">Shown as a pick list in the Create Event wizard.</p>
      <div class="cs-card"><h3>VOICE CHANNELS <span class="cs-pill">${c.voiceChannels.length}</span></h3>${chipList("voiceChannels", c.voiceChannels, "chan")}${adder("voiceChannels", "chan", ["voice"])}</div>
      <div class="cs-card"><h3>STAGE CHANNELS <span class="cs-pill">${c.stageChannels.length}</span></h3>${chipList("stageChannels", c.stageChannels, "chan")}${adder("stageChannels", "chan", ["stage"])}</div>`;
  if (tab === "welcome") {
    const prev = esc(c.welcome.text).replace(/\{user\}/g, '<span class="mn">@NewMarine</span>').replace(/\{server\}/g, "505th Expeditionary Force").replace(/\n/g, "<br>");
    return `<h2>WELCOME</h2><p class="sub">What a new member sees when they join the Discord.</p>
      <div class="cs-two"><div class="cs-card"><h3>SETTINGS</h3>
      ${row("ON", tog("welcome.on", c.welcome.on))}
      ${row("CHANNEL", sel("welcome.channelId", chanOptions(c.welcome.channelId, ["text", "announcement"], "— pick any channel —")) + note(c.welcome.channelId))}
      ${row("GIVE ROLE ON JOIN", sel("welcome.roleId", roleOptions(c.welcome.roleId)) + note(c.welcome.roleId, "role"))}
      ${row("ALSO SEND A DM", tog("welcome.dm", c.welcome.dm))}
      <label class="cs-lbl" for="csWt">MESSAGE · {user} {server}</label><textarea class="fld" id="csWt" data-p="welcome.text" maxlength="1500" ${canEdit ? "" : "disabled"}>${esc(c.welcome.text)}</textarea></div>
      <div><div class="cs-lbl">LIVE PREVIEW</div><div class="dc"><div class="h"><i></i><b>Cortana</b></div><div class="e">${prev}</div></div>
      <p class="cs-n" style="margin-top:10px">Cortana needs the "Server Members" intent on (Discord Developer Portal → Bot) to see people joining.</p></div></div>`;
  }
  if (tab === "info")
    return `<h2>INFO POSTS</h2><p class="sub">Rules, info, role pickers and FAQ. Made and edited on DISCORD → Info Posts.</p><div class="cs-card">
      ${posts.length ? posts.sort((a, b) => String(a.name).localeCompare(b.name)).map((p) => { const st = p.discord?.missing ? ["MISSING", "bad"] : p.discord?.messageId ? ["LIVE", "ok"] : ["DRAFT", "warn"]; return row(esc(p.name || "(no name)"), `<span>#${esc(chan(p.channelId)?.name || "—")}</span> <b style="color:${MARK[st[1]][1]}">${MARK[st[1]][0]} ${st[0]}</b>`); }).join("") : '<p class="cs-n">No info posts yet. Use SERVER CHECK → IMPORT FROM OLD CORTANA, or make one on the Info Posts page.</p>'}
      <div style="margin-top:12px"><button class="b" data-go="panel-info">OPEN INFO POSTS →</button></div></div>`;
  if (tab === "ann")
    return `<h2>ANNOUNCEMENTS</h2><p class="sub">Post from the website — Cortana sends it.</p><div class="cs-card">
      ${row("CHANNEL", sel("announce.channelId", chanOptions(c.announce.channelId)) + note(c.announce.channelId))}
      ${row("DEFAULT PING", sel("announce.ping", roleOptions(c.announce.ping === "everyone" || c.announce.ping === "here" ? "" : c.announce.ping, "No ping", `<option value="everyone" ${c.announce.ping === "everyone" ? "selected" : ""}>@everyone</option><option value="here" ${c.announce.ping === "here" ? "selected" : ""}>@here</option>`)) + (c.announce.ping === "everyone" ? '<small class="cs-n wr">▲ @everyone pings the whole server — the post shows a confirm pop-up first</small>' : ""))}
      ${row("WHO CAN POST", sel("announce.minRole", ["officer", "developer", "commander"].map((r) => `<option value="${r}" ${c.announce.minRole === r ? "selected" : ""}>${r === "officer" ? "Officer and above" : r === "developer" ? "Developer and above" : "Commander only"}</option>`).join("")))}</div>`;
  if (tab === "aux") {
    const prev = esc(c.aux.template).replace(/\{version\}/g, "v2.4.0").replace(/\{changes\}/g, "• New armour variants<br>• Pelican fixes").replace(/\{link\}/g, '<span style="color:#00a8fc">link</span>').replace(/\n/g, "<br>");
    return `<h2>AUX MOD UPDATES</h2><p class="sub">Changelog posts when a new version ships.</p><div class="cs-two"><div class="cs-card">
      ${row("CHANNEL", sel("aux.channelId", chanOptions(c.aux.channelId)) + note(c.aux.channelId))}
      ${row("PING ROLE", sel("aux.pingRoleId", roleOptions(c.aux.pingRoleId, "No ping")))}
      <label class="cs-lbl" for="csAt">TEMPLATE · {version} {changes} {link}</label><textarea class="fld" id="csAt" data-p="aux.template" maxlength="1500" ${canEdit ? "" : "disabled"}>${esc(c.aux.template)}</textarea></div>
      <div><div class="cs-lbl">LIVE PREVIEW</div><div class="dc"><div class="h"><i></i><b>Cortana</b></div>${c.aux.pingRoleId && role(c.aux.pingRoleId) ? `<span class="mn">@${esc(role(c.aux.pingRoleId).name)}</span>` : ""}<div class="e">${prev}</div></div></div></div>`;
  }
  if (tab === "tickets") return `<h2>TICKETS</h2><p class="sub">Each ticket type has its own channel with an "open ticket" button. Set up on DISCORD → Tickets.</p><div class="cs-card">
      ${ttypes.length ? ttypes.sort((a, b) => String(a.name).localeCompare(b.name)).map((t) => { const st = t.panel?.messageId ? ["POSTED", chk(t.channelId)] : ["NOT POSTED", "warn"]; return row(`${esc(t.emoji || "")} ${esc(t.name)}`, `<span>#${esc(chan(t.channelId)?.name || "—")}</span> <b style="color:${MARK[st[1]][1]}">${MARK[st[1]][0]} ${st[0]}</b>`); }).join("") : '<p class="cs-n">No ticket types yet. Add Recruitment and Tech Support on the Tickets page.</p>'}
      <div style="margin-top:12px"><button class="b" data-go="panel-tickets">OPEN TICKETS →</button></div></div>`;
  return `<h2>LOGS</h2><p class="sub">Where Cortana writes its logs. Leave empty to turn a log off.</p><div class="cs-card">
    ${row("MODERATION LOG", sel("logs.modLogId", chanOptions(c.logs.modLogId, undefined, "— off —")) + note(c.logs.modLogId))}
    ${row("JOIN / LEAVE LOG", sel("logs.joinLeaveId", chanOptions(c.logs.joinLeaveId, undefined, "— off —")) + note(c.logs.joinLeaveId))}
    ${row("MESSAGE LOG (DELETED / EDITED)", sel("logs.messageLogId", chanOptions(c.logs.messageLogId, undefined, "— off —")) + note(c.logs.messageLogId))}
    ${row("WEBSITE AUDIT TO DISCORD", sel("logs.auditId", chanOptions(c.logs.auditId, undefined, "— off —")) + note(c.logs.auditId))}</div>`;
}

function draw() {
  const scroll = root.querySelector("main")?.scrollTop || 0;
  const probs = TABS.filter(([k]) => ["warn", "bad"].includes(tabState(k))).length;
  root.innerHTML = `<div class="cs-top"><div><div class="panel-title" style="margin:0">CORTANA SETUP</div><small>CONFIGURE CORTANA v2 · CHANGES APPLY LIVE · NO RESTART · COMMANDER / DEVELOPER ONLY</small></div>
    <div class="cs-st"><span class="cs-pill ${chans.length ? "ok" : "wr"}">${chans.length} CHANNELS · ${roles.length} ROLES</span>${probs ? `<span class="cs-pill wr">▲ ${probs} NEED SETUP</span>` : '<span class="cs-pill ok">✓ ALL SET</span>'}
    <button class="b" data-sync>⟳ RE-SYNC</button></div></div>
    <div class="cs-lay"><nav role="tablist">${TABS.map(([k, l], i) => { const [m, col] = MARK[tabState(k)]; return `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}" data-tab="${k}"><b>${i + 1}</b>${l}<em style="color:${col}">${m}</em></button>`; }).join("")}</nav>
    <main>${body()}
    <div class="cs-ft"><span class="cs-n">${cfg.updatedByName ? `LAST SAVED ${esc(new Date(cfg.updatedAtISO).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))} BY ${esc(cfg.updatedByName)}` : "NOT SAVED YET"} · CHANGES GO TO THE AUDIT LOG</span>
    ${canEdit ? `<div style="display:flex;gap:8px"><button class="b" data-discard ${dirty() ? "" : "disabled"}>DISCARD</button><button class="b gold" data-save ${dirty() ? "" : "disabled"}>${dirty() ? "SAVE" : "SAVED"}</button></div>` : ""}</div></main></div>`;
  const m = root.querySelector("main");
  if (m) m.scrollTop = scroll;
  if (tab === "check") cortanaStatus().then((s) => { const el = root.querySelector("#csOnline"); if (el) el.innerHTML = s.online ? `<b style="color:var(--g)">✓ ONLINE</b><small>Ping ${s.pingMs ?? "—"} ms</small>` : '<b style="color:var(--r)">✕ OFFLINE</b><small>Start Cortana — settings still save</small>'; });
}

/* ───────── data ───────── */
const setPath = (path, v) => { const ks = path.split("."); let o = cfg; while (ks.length > 1) { const k = ks.shift(); o[k] ??= {}; o = o[k]; } o[ks[0]] = v; };
const getPath = (path) => path.split(".").reduce((o, k) => o?.[k], cfg);

async function load() {
  const [cs, rs, s] = await Promise.all([getDocs(collection(db, "discord_channels")), getDocs(collection(db, "discord_roles")), getDoc(DOC())]);
  [posts, ttypes] = await Promise.all(["info_posts", "ticket_types"].map((c) => getDocs(collection(db, c)).then((q) => q.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => [])));
  chans = cs.docs.map((d) => ({ id: d.id, ...d.data() }));
  roles = rs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const b = blank();
  const d = s.exists() ? s.data() : null;
  cfg = d ? { ...b, ...d, welcome: { ...b.welcome, ...d.welcome }, announce: { ...b.announce, ...d.announce }, aux: { ...b.aux, ...d.aux }, logs: { ...b.logs, ...d.logs }, channelPings: { ...(d.channelPings || {}) } } : b;
  saved = d ? JSON.stringify(cfg) : "";
  // A role that no longer exists in Discord = no role. Clear it (shows as unsaved so SAVE fixes Cortana too).
  if (roles.length) {
    const gone = [];
    if (cfg.welcome.roleId && !role(cfg.welcome.roleId)) { cfg.welcome.roleId = ""; gone.push("Welcome role"); }
    if (cfg.aux.pingRoleId && !role(cfg.aux.pingRoleId)) { cfg.aux.pingRoleId = ""; gone.push("Aux ping role"); }
    if (cfg.announce.ping && !["everyone", "here"].includes(cfg.announce.ping) && !role(cfg.announce.ping)) { cfg.announce.ping = ""; gone.push("Announcement ping"); }
    if (gone.length) setTimeout(() => notify(`${gone.join(" · ").toUpperCase()}: OLD ROLE GONE FROM DISCORD — SET TO NONE. PRESS SAVE.`), 400);
  }
  autoNote = d ? null : chans.length ? autoFill(cfg) : null;
  draw();
}

async function save() {
  if (cfg.announce.ping === "everyone" && !JSON.parse(saved || "{}").announce?.ping?.includes("everyone")) {
    if (!(await ask({ kind: "warn", title: "@EVERYONE BY DEFAULT?", body: "Announcements will ping the whole server unless changed per post.", go: "YES, SAVE", cancel: "GO BACK" }))) return;
  }
  const me = await getMe();
  const out = { ...cfg, updatedBy: me?.uid || "", updatedByName: me ? memberName(me) : "", updatedAtISO: new Date().toISOString() };
  await setDoc(DOC(), out);
  const before = JSON.parse(saved || "{}");
  const changed = Object.keys(out).filter((k) => !["updatedBy", "updatedByName", "updatedAtISO"].includes(k) && JSON.stringify(out[k]) !== JSON.stringify(before[k]));
  await audit("discord", "CORTANA SETUP SAVED", changed.join(", ") || "first save");
  cfg = out;
  saved = JSON.stringify(cfg);
  autoNote = null;
  notify("✓ CORTANA SETUP SAVED — CORTANA USES IT NOW");
  draw();
}

/* ───────── events ───────── */
function wire() {
  root.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) { e.preventDefault(); tab = t.dataset.tab; return draw(); }
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); return window.showPanel?.(go.dataset.go); }
    const rm = e.target.closest("[data-rm]");
    if (rm) { const p = rm.dataset.rm; setPath(p, getPath(p).filter((x) => x !== rm.dataset.id)); if (p === "signupChannels") delete cfg.channelPings[rm.dataset.id]; return draw(); }
    const tg = e.target.closest("[data-tog]");
    if (tg) { setPath(tg.dataset.tog, !getPath(tg.dataset.tog)); return draw(); }
    if (e.target.closest("[data-save]")) return save().catch((err) => notify("SAVE FAILED: " + err.message, 1));
    if (e.target.closest('[data-x="clean"]')) return cleanTest().catch((err) => notify("FAILED: " + err.message, 1));
    if (e.target.closest('[data-x="legacy"]')) {
      if (!(await ask({ kind: "warn", title: "IMPORT FROM OLD CORTANA?", body: "Adds the old posts as Info Posts and fills EMPTY settings only. Safe to run twice.", go: "IMPORT", cancel: "CANCEL" }))) return;
      try {
        const me = await getMe();
        const ref = await addDoc(collection(db, "bot_jobs"), { type: "legacy.import", requestedBy: me?.uid || "", createdAtISO: new Date().toISOString(), payload: {} });
        let d = null;
        for (let n = 0; n < 20 && !(d && (d.status === "done" || d.status === "failed")); n++) { await new Promise((r) => setTimeout(r, 1000)); d = (await getDoc(doc(db, "bot_jobs", ref.id))).data(); }
        if (d?.status === "failed") throw new Error(d.error || "failed");
        notify(d?.status === "done" ? `✓ IMPORTED ${d.result?.posts ?? 0} POSTS + ${d.result?.filled ?? 0} SETTINGS — CHECK INFO POSTS` : "◷ CORTANA IS OFFLINE", d?.status !== "done");
        await load();
      } catch (err) { notify("IMPORT FAILED: " + err.message, 1); }
      return;
    }
    if (e.target.closest("[data-discard]")) { if (await ask({ kind: "warn", title: "DISCARD CHANGES?", body: "Go back to the last saved setup.", go: "DISCARD", cancel: "KEEP EDITING" })) load(); return; }
    if (e.target.closest("[data-sync]")) {
      const b = e.target.closest("[data-sync]");
      b.disabled = true; b.textContent = "SYNCING…";
      try {
        const me = await getMe();
        await addDoc(collection(db, "bot_jobs"), { type: "sync.now", status: "pending", attempts: 0, requestedBy: me?.uid || "", createdAtISO: new Date().toISOString(), payload: {} });
        await new Promise((r) => setTimeout(r, 6000));
        const keep = JSON.stringify(cfg);
        await load();
        if (keep !== saved) { cfg = JSON.parse(keep); draw(); }
        notify("✓ CHANNELS + ROLES RE-SYNCED");
      } catch (err) { notify("RE-SYNC FAILED: " + err.message, 1); draw(); }
    }
  });
  root.addEventListener("change", (e) => {
    const a = e.target.closest("[data-add]");
    if (a && a.value) { const p = a.dataset.add; const cur = getPath(p) || []; if (!cur.includes(a.value)) setPath(p, [...cur, a.value]); return draw(); }
    const s = e.target.closest("select[data-p]");
    if (s) {
      const p = s.dataset.p;
      if (p.startsWith("channelPings.")) { const id = p.slice(13); if (s.value) cfg.channelPings[id] = s.value; else delete cfg.channelPings[id]; }
      else setPath(p, s.value);
      return draw();
    }
  });
  root.addEventListener("input", (e) => {
    const x = e.target.closest("textarea[data-p]");
    if (!x) return;
    setPath(x.dataset.p, x.value);
    const btn = root.querySelector("[data-save]");
    if (btn) { btn.disabled = !dirty(); btn.textContent = dirty() ? "SAVE" : "SAVED"; }
    const d = root.querySelector("[data-discard]");
    if (d) d.disabled = !dirty();
  });
  window.addEventListener("beforeunload", (e) => { if (cfg && dirty()) e.preventDefault(); });
}

const CSS = `
#cSetup{--g:#22e07a;--a:#f59e0b;--r:#ff4d4d;--m:#6f8a96;--b:rgba(0,217,255,.18)}
#cSetup .cs-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--b)}
#cSetup .cs-top small{color:var(--m);font:11px monospace;letter-spacing:2px}
#cSetup .cs-st{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#cSetup .cs-pill{font:11px monospace;letter-spacing:1px;padding:4px 10px;border:1px solid var(--b);color:#cfe9f2}
#cSetup .cs-pill.ok{color:var(--g);border-color:rgba(34,224,122,.4)}#cSetup .cs-pill.wr{color:var(--a);border-color:rgba(245,158,11,.4)}
#cSetup .cs-lay{display:grid;grid-template-columns:230px 1fr;min-height:60vh}
#cSetup nav{border-right:1px solid var(--b);padding:12px 0}
#cSetup nav button{all:unset;display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:10px 16px;cursor:pointer;font:600 12px monospace;letter-spacing:1.5px;color:var(--m);border-left:2px solid transparent}
#cSetup nav button:hover,#cSetup nav button:focus-visible{color:#cfe9f2;background:rgba(0,217,255,.05);outline:none}
#cSetup nav button.on{color:#00D9FF;border-left-color:#00D9FF;background:rgba(0,217,255,.08)}
#cSetup nav b{width:22px;height:22px;display:grid;place-items:center;border:1px solid currentColor;font-size:11px}
#cSetup nav em{margin-left:auto;font-style:normal}
#cSetup main{padding:18px 24px;max-width:980px;max-height:75vh;overflow:auto}
#cSetup h2{font:700 15px monospace;letter-spacing:3px;color:#00D9FF;margin:0 0 4px}#cSetup .sub{color:var(--m);margin:0 0 16px}
#cSetup .cs-card{background:rgba(0,0,0,.25);border:1px solid var(--b);padding:14px 16px;margin-bottom:14px}
#cSetup .cs-card h3{margin:0 0 6px;font:700 12px monospace;letter-spacing:2px;display:flex;gap:10px;align-items:center}#cSetup .cs-card h3 span{margin-left:auto}
#cSetup .cs-card p{margin:0 0 8px;color:var(--m);font-size:13px}#cSetup .cs-card a{color:#00D9FF}
#cSetup .cs-row{display:grid;grid-template-columns:210px 1fr;gap:12px;align-items:start;padding:9px 0;border-top:1px solid rgba(0,217,255,.07)}
#cSetup .cs-row:first-of-type{border-top:0}#cSetup .cs-row label{font:12px monospace;letter-spacing:1px;color:var(--m);padding-top:8px}
#cSetup .cs-row label small{display:block;font-size:10px;opacity:.8;letter-spacing:.5px}
#cSetup .cs-n{display:block;font:11px monospace;color:var(--m);margin-top:4px}#cSetup .cs-n.bad{color:var(--r)}#cSetup .cs-n.wr{color:var(--a)}
#cSetup .cs-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
#cSetup .cs-chip{font:12px monospace;padding:5px 8px;border:1px solid #00D9FF;color:#00D9FF;background:rgba(0,217,255,.08);display:inline-flex;gap:6px;align-items:center}
#cSetup .cs-chip.bad{border-color:var(--r);color:var(--r)}#cSetup .cs-chip button{all:unset;cursor:pointer;color:var(--m);padding:0 2px}#cSetup .cs-chip button:hover{color:var(--r)}
#cSetup .cs-add{max-width:320px}
#cSetup .cs-map{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;font:12px monospace}
#cSetup .cs-tog{all:unset;cursor:pointer;width:40px;height:20px;border:1px solid var(--m);position:relative;margin-top:6px}
#cSetup .cs-tog span{position:absolute;left:2px;top:2px;width:14px;height:14px;background:var(--m);transition:left .15s}
#cSetup .cs-tog.on{border-color:var(--g);background:rgba(34,224,122,.2)}#cSetup .cs-tog.on span{left:22px;background:var(--g)}
#cSetup .cs-tog:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
#cSetup .cs-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}#cSetup textarea{min-height:120px;font-family:monospace;width:100%}
#cSetup .cs-lbl{display:block;font:12px monospace;color:var(--m);letter-spacing:1px;margin:10px 0 6px}
#cSetup .cs-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#cSetup .cs-mini{border:1px solid var(--b);padding:12px;background:rgba(0,0,0,.25)}#cSetup .cs-mini b{font:700 12px monospace;letter-spacing:1px;display:block}#cSetup .cs-mini small{color:var(--m)}
#cSetup .dc{background:#313338;border-radius:6px;padding:14px;font-family:"Segoe UI",sans-serif;color:#dbdee1;font-size:14px}
#cSetup .dc .h{display:flex;gap:8px;align-items:center;margin-bottom:6px}#cSetup .dc .h i{width:32px;height:32px;border-radius:50%;background:#0b1a22 url(/images/logo.png) center/70% no-repeat}#cSetup .dc .h b{color:#00d9ff;font-weight:500}
#cSetup .dc .e{border-left:4px solid #194A77;background:#2b2d31;padding:10px 12px;border-radius:4px;margin-top:6px}
#cSetup .mn{background:rgba(88,101,242,.3);color:#c9cdfb;padding:0 2px;border-radius:3px}
#cSetup .cs-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid var(--b)}
@media(max-width:900px){#cSetup .cs-lay{grid-template-columns:1fr}#cSetup nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--b)}#cSetup nav button{white-space:nowrap;border-left:0}#cSetup .cs-two,#cSetup .cs-grid3{grid-template-columns:1fr}#cSetup .cs-row{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("cortana-setup", CSS);
  onAccess((me) => { canEdit = !!me?.access?.set; if (cfg) draw(); });
  root = mountPanel("panel-cmd-cortana", "cSetup", () => {
    if (!cfg || !dirty()) load().catch((e) => notify("CORTANA SETUP LOAD FAILED: " + e.message, 1));
  });
  if (root) wire();
});
