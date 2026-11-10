/**
 * MESSAGES v2 — built to the approved mock (shell-v2, 2026-11-10).
 * Full page: conversation list (hex pictures, online dots, unread counts, search, + NEW)
 * and chat (header with FILE button, day dividers, bubbles with hex, SEEN, typing, attach image).
 * Same data as the original: conversations/{id} + conversations/{id}/messages.
 * The ✉ top-bar button opens this page; the original side panel is hidden.
 */
import { onAuthStateChanged } from "/terminal-shim/auth.js";
import { addDoc, collection, deleteDoc, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "/terminal-shim/firestore.js";
import { addCss, auth, db, esc, getMe, getUsers, hexAvatar, isMember, memberName, notify, onReady, toDate, uploadImage } from "./_common.js";
import { ask, tell } from "./_common.js";

const PANEL = "panel-msg2";
const ROLE_L = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER", marine: "MARINE", enlistee: "ENLISTEE" };
const TYPING_MS = 6000;

addCss("msg2", `
#msgPanel{display:none!important}
#m2{font-family:'Share Tech Mono',monospace;color:#d6dde6}
#m2 .b{background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;padding:8px 14px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11.5px;cursor:pointer}
#m2 .b.gold{background:#f59e0b;border-color:#f59e0b;color:#000}#m2 .b.sm{padding:4px 9px;font-size:10px}
#m2 .in{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;font-size:12px;outline:0;color:#d6dde6;font-family:inherit}
#m2 .in:focus{border-color:#00D9FF}
.m2w{display:grid;grid-template-columns:320px 1fr;border:1px solid rgba(0,217,255,.18);height:calc(100vh - 190px);min-height:480px}
.m2l{border-right:1px solid rgba(0,217,255,.18);display:flex;flex-direction:column;background:#0b0f15;min-height:0}
.m2lh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px}.m2lh b{font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}
#m2 .m2l>.in{margin:0 12px 8px;width:calc(100% - 24px)}
.m2list{overflow:auto;flex:1}
.m2cv{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;width:100%;padding:10px 14px;border:0;border-left:2px solid transparent;background:none;color:inherit;text-align:left;cursor:pointer;font-family:inherit;position:relative}
.m2cv:hover{background:rgba(255,255,255,.02)}.m2cv.on{border-left-color:#00D9FF;background:rgba(0,217,255,.05)}
.m2cvt{min-width:0}.m2cvt b{display:block;font-family:Rajdhani,sans-serif;font-size:14px;color:#fff}.m2cvt small{font-size:10.5px;color:#7d8a99;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m2cv.un .m2cvt small{color:#d6dde6}
.m2cvr{text-align:right}.m2cvr small{display:block;font-size:9.5px;color:#7d8a99}
.m2bd{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 4px;background:#00D9FF;color:#000;font-size:9.5px;font-style:normal;font-family:Rajdhani,sans-serif;font-weight:700;margin-top:3px}
.m2dot{position:absolute;left:39px;top:31px;width:9px;height:9px;background:#22e07a;border-radius:50%;border:2px solid #0b0f15}
.m2c{display:flex;flex-direction:column;min-width:0;min-height:0}
.m2ch{display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(0,217,255,.18)}.m2ch b{display:block;font-family:Rajdhani,sans-serif;font-size:15px;color:#fff}.m2ch small{font-size:9.5px;letter-spacing:1.5px;color:#7d8a99}.m2ch small.ok{color:#22e07a}
.m2back{display:none}
.m2b{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.m2day{text-align:center;font-size:9.5px;letter-spacing:2.5px;color:#7d8a99}
.m2msg{display:flex;gap:10px;align-items:flex-start;max-width:70%}.m2msg.me{align-self:flex-end}.m2msg>div{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.m2msg.me>div{align-items:flex-end}
.m2mm{display:flex;gap:8px;align-items:baseline;margin-bottom:3px}.m2msg.me .m2mm{justify-content:flex-end}.m2mm b{font-family:Rajdhani,sans-serif;color:#fff;font-size:13.5px}.m2mm small{font-size:9.5px;color:#7d8a99}
.m2bub{display:inline-block;background:#0e131b;border:1px solid rgba(0,217,255,.18);padding:8px 12px;font-size:12.5px;line-height:1.5;margin-bottom:4px;text-align:left;white-space:pre-wrap;word-break:break-word;max-width:100%}
.m2msg.me .m2bub{background:rgba(0,217,255,.1);border-color:rgba(0,217,255,.35)}
.m2bub img{display:block;max-width:280px;max-height:220px;margin-top:4px;border:1px solid rgba(0,217,255,.18)}
.m2seen{align-self:flex-end;font-size:9px;letter-spacing:1.5px;color:#7d8a99;display:flex;gap:6px;align-items:center}
.m2typing{font-size:10.5px;color:#7d8a99;display:flex;gap:8px;align-items:center}
.m2comp{display:grid;grid-template-columns:auto 1fr auto;gap:8px;padding:10px 12px;border-top:1px solid rgba(0,217,255,.18)}.m2comp textarea{resize:none;max-height:120px}
.m2ib{width:38px;height:38px;border:1px solid rgba(0,217,255,.18);background:none;color:#c6d0da;font-size:15px;cursor:pointer}.m2ib:hover{border-color:#00D9FF;color:#00D9FF}
.m2none{flex:1;display:grid;place-items:center;color:#7d8a99;font-size:11px;letter-spacing:3px;text-align:center}
.m2new{position:fixed;inset:0;z-index:600;background:rgba(2,4,7,.75);display:grid;place-items:center}.m2new[hidden]{display:none}
.m2nb{width:min(460px,94vw);max-height:80vh;display:flex;flex-direction:column;background:#0b0f15;border:1px solid rgba(0,217,255,.35);padding:16px;gap:10px;font-family:'Share Tech Mono',monospace}
.m2nb h3{margin:0;font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF}
.m2pick{overflow:auto;flex:1;border:1px solid rgba(0,217,255,.18)}
.m2pk{display:flex;gap:10px;align-items:center;width:100%;padding:8px 10px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.04);color:#d6dde6;text-align:left;cursor:pointer;font:inherit;font-size:12px}
.m2pk.on{background:rgba(0,217,255,.08);color:#00D9FF}.m2pk small{margin-left:auto;font-size:9.5px;color:#7d8a99;letter-spacing:1px}
#m2 button:focus-visible,.m2nb button:focus-visible{outline:2px solid #00D9FF;outline-offset:1px}
@media(max-width:1000px){.m2w{grid-template-columns:1fr}.m2w.open .m2l{display:none}.m2w:not(.open) .m2c{display:none}.m2back{display:inline-block}}
`);

let uid = null;
let me = null;
let users = new Map();
let convs = [];
let active = null;
let msgs = [];
let unsubMsgs = null;
let online = new Set();
let filter = "";
let picked = new Set();
let lastTyping = 0;

const $ = (s) => document.querySelector(s);
const userOf = (id) => users.get(id) || { id, callsign: "?" };
const others = (c) => (c?.participants || []).filter((p) => p !== uid);
const convName = (c) => (c?.name ? c.name : others(c).length === 1 ? memberName(userOf(others(c)[0])) : `Group · ${(c?.participants || []).length}`);
const convPic = (c) => (others(c).length === 1 ? userOf(others(c)[0]) : { callsign: c?.name || "Group" });
const tm = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d)) return "";
  const today = new Date().toDateString() === d.toDateString();
  const yday = new Date(Date.now() - 864e5).toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : yday ? "YDAY" : Date.now() - d < 6 * 864e5 ? d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase() : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
};
const dayLabel = (d) => {
  if (new Date().toDateString() === d.toDateString()) return "TODAY";
  if (new Date(Date.now() - 864e5).toDateString() === d.toDateString()) return "YESTERDAY";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
};
const unreadTotal = () => convs.reduce((s, c) => s + (c.unreadCounts?.[uid] || 0), 0);

function setBadge() {
  const n = unreadTotal();
  const ob = document.getElementById("msgUnreadBadge"); // the top bar mirrors this badge
  if (ob) { ob.textContent = n > 9 ? "9+" : String(n); ob.style.display = n ? "block" : "none"; }
}

/* ───────── list ───────── */
function drawList() {
  const el = $("#m2List");
  if (!el) return;
  const list = convs.filter((c) => !filter || convName(c).toLowerCase().includes(filter) || String(c.lastMessage || "").toLowerCase().includes(filter));
  el.innerHTML = list.length
    ? list.map((c) => {
        const un = c.unreadCounts?.[uid] || 0;
        const o = others(c);
        const on = o.length === 1 && online.has(o[0]);
        const last = c.lastMessage ? (c.lastSenderUid === uid ? "You: " : "") + c.lastMessage : "No messages yet";
        return `<button class="m2cv ${c.id === active?.id ? "on" : ""} ${un ? "un" : ""}" data-id="${c.id}">${hexAvatar(convPic(c), "sm")}${on ? '<i class="m2dot" aria-label="Online"></i>' : ""}<span class="m2cvt"><b>${esc(convName(c))}</b><small>${esc(last)}</small></span><span class="m2cvr"><small>${tm(c.lastMessageAt)}</small>${un ? `<i class="m2bd" aria-label="${un} unread">${un > 9 ? "9+" : un}</i>` : ""}</span></button>`;
      }).join("")
    : `<p class="m2none" style="padding:30px">${filter ? "NOTHING FOUND" : "NO CONVERSATIONS YET<br><br>PRESS + NEW"}</p>`;
}

/* ───────── chat ───────── */
function drawHead() {
  const h = $("#m2Head");
  if (!active) { h.innerHTML = ""; return; }
  const o = others(active);
  const one = o.length === 1 ? userOf(o[0]) : null;
  const sub = one
    ? `<small class="${online.has(one.id) ? "ok" : ""}">${online.has(one.id) ? "● ONLINE" : "○ OFFLINE"}${ROLE_L[one.role] ? " · " + ROLE_L[one.role] : ""}${one.platoon ? " · " + esc(String(one.platoon).toUpperCase()) : ""}</small>`
    : `<small>${o.map((p) => esc(memberName(userOf(p)))).join(", ")}</small>`;
  h.innerHTML = `<button class="b sm m2back" id="m2Back" aria-label="Back to conversations">←</button>${hexAvatar(convPic(active), "sm")}<div style="min-width:0"><b>${esc(convName(active))}</b>${sub}</div><span style="flex:1"></span>${one ? `<button class="b sm" id="m2File">FILE</button>` : ""}<button class="b sm" id="m2Del" title="Remove this conversation from your list">✕</button>`;
}

function drawMsgs() {
  const box = $("#m2Body");
  if (!active) { box.innerHTML = '<div class="m2none">PICK A CONVERSATION<br><br>OR PRESS + NEW</div>'; return; }
  if (!msgs.length) { box.innerHTML = '<div class="m2none">NO MESSAGES YET — SAY SOMETHING</div>'; drawTyping(); return; }
  let html = "";
  let lastDay = "";
  let prev = null;
  msgs.forEach((m, i) => {
    const d = toDate(m.timestamp) || new Date();
    const dl = dayLabel(d);
    if (dl !== lastDay) { html += `<div class="m2day">${dl}</div>`; lastDay = dl; prev = null; }
    const mine = m.senderUid === uid;
    const u = mine ? me : userOf(m.senderUid);
    const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const bub = `<div class="m2bub">${esc(m.text || "")}${m.imageUrl && /^https:\/\/res\.cloudinary\.com\//.test(m.imageUrl) ? `<a href="${esc(m.imageUrl)}" target="_blank" rel="noopener"><img src="${esc(m.imageUrl)}" alt="Image"></a>` : ""}</div>`;
    const grouped = prev && prev.senderUid === m.senderUid && d - (toDate(prev.timestamp) || 0) < 5 * 60000;
    if (grouped) {
      // add the bubble to the previous message group
      html = html.replace(/<!--g-->(?![\s\S]*<!--g-->)/, bub + "<!--g-->");
    } else {
      html += mine
        ? `<div class="m2msg me"><div><div class="m2mm"><small>${t}</small><b>You</b></div>${bub}<!--g--></div>${hexAvatar(u || {}, "sm")}</div>`
        : `<div class="m2msg">${hexAvatar(u, "sm")}<div><div class="m2mm"><b>${esc(memberName(u))}</b><small>${t}</small></div>${bub}<!--g--></div></div>`;
    }
    prev = m;
  });
  const last = msgs[msgs.length - 1];
  if (last.senderUid === uid) {
    const readers = (last.readBy || []).filter((r) => r !== uid);
    html += readers.length
      ? `<div class="m2seen">SEEN ${readers.map((r) => hexAvatar(userOf(r), "xs")).join("")}</div>`
      : `<div class="m2seen">✓ SENT</div>`;
  }
  html += '<div id="m2Typing"></div>';
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = html;
  drawTyping();
  if (atBottom || box.dataset.conv !== active.id) box.scrollTop = box.scrollHeight;
  box.dataset.conv = active.id;
}

function drawTyping() {
  const el = $("#m2Typing");
  if (!el || !active) return;
  const ty = active.typing || {};
  const who = Object.entries(ty).filter(([k, v]) => k !== uid && Date.now() - Date.parse(v || 0) < TYPING_MS).map(([k]) => userOf(k));
  el.innerHTML = who.length ? `<div class="m2typing">${hexAvatar(who[0], "xs")} ${esc(who.map((u) => memberName(u)).join(", "))} ${who.length > 1 ? "are" : "is"} typing…</div>` : "";
}

async function markRead() {
  if (!active) return;
  if (active.unreadCounts?.[uid]) updateDoc(doc(db, "conversations", active.id), { [`unreadCounts.${uid}`]: 0 }).catch(() => {});
  msgs.filter((m) => m.senderUid !== uid && !(m.readBy || []).includes(uid)).forEach((m) =>
    updateDoc(doc(db, "conversations", active.id, "messages", m.id), { readBy: [...(m.readBy || []), uid] }).catch(() => {}));
}

function openConv(id) {
  active = convs.find((c) => c.id === id) || null;
  if (unsubMsgs) unsubMsgs();
  msgs = [];
  $("#m2W").classList.toggle("open", !!active);
  drawHead(); drawList(); drawMsgs();
  $("#m2In").placeholder = active ? `Message ${convName(active)}…  (Enter to send · Shift+Enter new line)` : "Pick a conversation";
  $("#m2In").disabled = !active;
  if (!active) return;
  unsubMsgs = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("timestamp", "asc"), limit(200)), (snap) => {
    msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    drawMsgs();
    if (isShown()) markRead();
  });
  $("#m2In").focus();
}

async function send(text, imageUrl) {
  if (!active || (!text && !imageUrl)) return;
  const c = active;
  const now = serverTimestamp();
  try {
    await addDoc(collection(db, "conversations", c.id, "messages"), { senderUid: uid, text: text || "", ...(imageUrl ? { imageUrl } : {}), timestamp: now, readBy: [uid] });
    const upd = { lastMessage: text || "📷 Image", lastMessageAt: now, lastSenderUid: uid, [`typing.${uid}`]: null };
    others(c).forEach((p) => (upd[`unreadCounts.${p}`] = increment(1)));
    await updateDoc(doc(db, "conversations", c.id), upd);
    const who = memberName(me) || "Someone";
    others(c).forEach((p) => addDoc(collection(db, "notifications", p, "items"), { type: "message", read: false, title: `${who} sent you a message`, body: (text || "📷 Image").slice(0, 60) + ((text || "").length > 60 ? "…" : ""), fromUid: uid, convId: c.id, createdAt: now }).catch(() => {}));
  } catch (e) {
    notify("MESSAGE NOT SENT — " + (e.message || "error"), true);
  }
}

function typing() {
  if (!active || Date.now() - lastTyping < 3000) return;
  lastTyping = Date.now();
  updateDoc(doc(db, "conversations", active.id), { [`typing.${uid}`]: new Date().toISOString() }).catch(() => {});
}

/* ───────── new chat ───────── */
function drawPick() {
  const q = $("#m2NQ").value.toLowerCase();
  const list = [...users.values()].filter((u) => u.id !== uid && isMember(u) && (!q || memberName(u).toLowerCase().includes(q) || String(u.callsign || "").toLowerCase().includes(q))).sort((a, b) => memberName(a).localeCompare(memberName(b)));
  $("#m2Pick").innerHTML = list.map((u) => `<button class="m2pk ${picked.has(u.id) ? "on" : ""}" data-u="${u.id}" aria-pressed="${picked.has(u.id)}">${hexAvatar(u, "xs")}${esc(memberName(u))}<small>${picked.has(u.id) ? "✓ PICKED" : ROLE_L[u.role] || ""}</small></button>`).join("") || '<p class="m2none" style="padding:20px">NOBODY FOUND</p>';
  $("#m2GName").style.display = picked.size > 1 ? "" : "none";
  $("#m2Go").disabled = !picked.size;
}
async function createConv() {
  const ids = [...picked];
  if (!ids.length) return;
  if (ids.length === 1) {
    const ex = convs.find((c) => c.participants?.length === 2 && c.participants.includes(ids[0]));
    if (ex) { $("#m2New").hidden = true; return openConv(ex.id); }
  }
  const participants = [uid, ...ids];
  const unreadCounts = Object.fromEntries(participants.map((p) => [p, 0]));
  try {
    const ref = await addDoc(collection(db, "conversations"), { participants, name: ids.length === 1 ? null : $("#m2GName").value.trim() || "Group Chat", lastMessage: null, lastMessageAt: serverTimestamp(), unreadCounts, createdBy: uid, createdAt: serverTimestamp() });
    $("#m2New").hidden = true;
    convs.unshift({ id: ref.id, participants, unreadCounts, name: ids.length === 1 ? null : $("#m2GName").value.trim() || "Group Chat" });
    openConv(ref.id);
  } catch (e) {
    notify("COULD NOT START THE CHAT", true);
  }
}

/* ───────── mount ───────── */
const isShown = () => !document.getElementById(PANEL)?.classList.contains("hidden");

function mount() {
  if (document.getElementById(PANEL)) return;
  const host = document.querySelector(".main-content");
  const p = document.createElement("div");
  p.className = "panel hidden";
  p.id = PANEL;
  p.innerHTML = `<div class="panel-title">MESSAGES</div><div id="m2"><div class="m2w" id="m2W">
    <div class="m2l"><div class="m2lh"><b>MESSAGES</b><button class="b sm gold" id="m2NewBtn">+ NEW</button></div><input class="in" id="m2Q" placeholder="SEARCH…" aria-label="Search conversations"><div class="m2list" id="m2List"></div></div>
    <div class="m2c"><div class="m2ch" id="m2Head"></div><div class="m2b" id="m2Body" aria-live="polite"></div>
      <div class="m2comp"><button class="m2ib" id="m2Att" aria-label="Attach image">⇪</button><textarea class="in" id="m2In" rows="1" disabled></textarea><button class="b gold" id="m2Send" aria-label="Send">➤</button><input type="file" id="m2Img" accept="image/*" hidden></div></div>
  </div></div>`;
  host.appendChild(p);
  document.body.insertAdjacentHTML("beforeend", `<div class="m2new" id="m2New" hidden><div class="m2nb" role="dialog" aria-label="New message"><h3>NEW MESSAGE</h3><input class="in" id="m2NQ" placeholder="Find members…" aria-label="Find members" style="width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;color:#d6dde6;font-family:inherit"><div class="m2pick" id="m2Pick"></div><input id="m2GName" placeholder="Group name (optional)" style="display:none;width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;color:#d6dde6;font-family:inherit"><div style="display:flex;gap:8px;justify-content:flex-end"><button class="b" id="m2NCancel" style="background:none;border:1px solid rgba(255,255,255,.25);color:#d6dde6;padding:8px 14px;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px">CANCEL</button><button id="m2Go" style="background:#f59e0b;border:1px solid #f59e0b;color:#000;padding:8px 14px;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px">START CHAT</button></div></div></div>`);

  $("#m2List").onclick = (e) => { const b = e.target.closest(".m2cv"); if (b) openConv(b.dataset.id); };
  $("#m2Q").oninput = (e) => { filter = e.target.value.toLowerCase(); drawList(); };
  $("#m2Head").onclick = async (e) => {
    if (e.target.closest("#m2Back")) { active = null; $("#m2W").classList.remove("open"); drawList(); return; }
    if (e.target.closest("#m2File")) { const o = others(active)[0]; window.showPanel?.("panel-active"); setTimeout(() => window.dispatchEvent(new CustomEvent("pf:open", { detail: o })), 400); return; }
    if (e.target.closest("#m2Del")) {
      if (!(await ask({ kind: "danger", title: "REMOVE CONVERSATION?", body: "It is removed from your list. The others keep it.", item: convName(active), go: "REMOVE" }))) return;
      const c = active, rest = others(c);
      try {
        rest.length ? await updateDoc(doc(db, "conversations", c.id), { participants: rest }) : await deleteDoc(doc(db, "conversations", c.id));
        convs = convs.filter((x) => x.id !== c.id);
        openConv(null);
      } catch { notify("COULD NOT REMOVE", true); }
    }
  };
  const inp = $("#m2In");
  inp.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#m2Send").click(); } };
  inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px"; typing(); };
  $("#m2Send").onclick = () => { const t = inp.value.trim(); if (!t) return; inp.value = ""; inp.style.height = "auto"; send(t); };
  $("#m2Att").onclick = () => active && $("#m2Img").click();
  $("#m2Img").onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) return notify("IMAGES UP TO 5 MB ONLY", true);
    try {
      notify("UPLOADING IMAGE…");
      const r = await uploadImage(f, "505th_msg");
      await send(inp.value.trim(), r.secure_url);
      inp.value = "";
    } catch (err) { notify("UPLOAD FAILED — " + err.message, true); }
  };
  $("#m2NewBtn").onclick = () => { picked = new Set(); $("#m2NQ").value = ""; $("#m2GName").value = ""; drawPick(); $("#m2New").hidden = false; $("#m2NQ").focus(); };
  $("#m2NQ").oninput = drawPick;
  $("#m2Pick").onclick = (e) => { const b = e.target.closest("[data-u]"); if (!b) return; picked.has(b.dataset.u) ? picked.delete(b.dataset.u) : picked.add(b.dataset.u); drawPick(); };
  $("#m2NCancel").onclick = () => ($("#m2New").hidden = true);
  $("#m2Go").onclick = createConv;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#m2New").hidden = true; });

  // Mark read when the page is opened; keep typing labels fresh.
  new MutationObserver(() => { if (isShown()) { markRead(); drawList(); } }).observe(p, { attributes: true, attributeFilter: ["class"] });
  setInterval(drawTyping, 2000);
  drawMsgs();
}

/** Open the messages page (used by the top bar ✉ button and message alerts). */
let backTo = "panel-dashboard";
window.openMessagesV2 = (convId) => {
  if (!convId && isShown()) return window.showPanel?.(backTo); // ✉ again = close, back to where you were
  const cur = [...document.querySelectorAll(".main-content .panel")].find((x) => !x.classList.contains("hidden"));
  if (cur && cur.id !== PANEL) backTo = cur.id;
  window.showPanel?.(PANEL);
  if (convId) openConv(convId);
};

onReady(() => {
  onAuthStateChanged(auth, async (u) => {
    if (!u || uid) return;
    uid = u.uid;
    mount();
    const [us, m] = await Promise.all([getUsers().catch(() => []), getMe().catch(() => null)]);
    users = new Map(us.map((x) => [x.id, x]));
    me = m ? { id: uid, ...m } : { id: uid };
    onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", uid)), (snap) => {
      convs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.lastMessageAt) || 0) - (toDate(a.lastMessageAt) || 0));
      if (active) { active = convs.find((c) => c.id === active.id) || null; drawHead(); drawTyping(); }
      drawList();
      setBadge();
      if (active && isShown()) markRead();
    });
    onSnapshot(collection(db, "presence_sessions"), (snap) => {
      const cut = Date.now() - 3 * 60 * 1000;
      online = new Set(snap.docs.map((d) => d.data()).filter((p) => Date.parse(p.updatedAt || 0) > cut).map((p) => p.uid));
      drawList();
      if (active) drawHead();
    });
  });
});
