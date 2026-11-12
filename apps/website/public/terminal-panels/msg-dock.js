/**
 * DASHBOARD v3 — Messages dock + pop-up chat windows (approved mock 2026-11-11).
 * Dock (right of the Dashboard): open = conversation list, closed = slim rail (unread + faces). Key: M.
 * Click a conversation → a chat window pops up at the bottom (✕ close · — shrink · ⤢ full Messages page). Max 3.
 * Same data and writes as messages-v2.js: conversations/{id} (+ /messages), unreadCounts, typing, readBy, notifications.
 * My Status (users/{uid}.myStatus = { state: online|dnd|invisible|offline, note, untilISO }): DND = no auto pop-ups.
 */
import { addDoc, collection, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "/terminal-shim/firestore.js";
import { addCss, db, esc, hexAvatar, memberName, notify, toDate } from "./_common.js";

export const STATES = { online: ["Online", "#22e07a", "●"], dnd: ["Do not disturb", "#ff4d4d", "●"], invisible: ["Invisible", "#7d8a99", "○"], offline: ["Offline", "#4b5765", "○"] };
/** A member's status as others see it (invisible → offline; expired → online). */
export function statusOf(u, mine = false) {
  const s = u?.myStatus;
  if (!s?.state || (s.untilISO && Date.parse(s.untilISO) < Date.now())) return "online";
  return !mine && s.state === "invisible" ? "offline" : s.state;
}

addCss("mdock", `
.md-dock{border-left:1px solid rgba(0,217,255,.16);background:linear-gradient(180deg,#0a0e14,#080b10);display:flex;align-self:stretch;min-height:640px;position:sticky;top:0}
.md-dock.closed .md-panel{display:none}.md-dock.open{width:400px}
.md-rail{width:64px;flex-shrink:0;border-right:1px solid rgba(0,217,255,.16);display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 0}
.md-tg{all:unset;cursor:pointer;width:42px;height:42px;border:1px solid rgba(0,217,255,.32);display:grid;place-items:center;color:#00D9FF;font-size:17px;position:relative}
.md-bd{position:absolute;top:-6px;right:-6px;background:#ff4d4d;color:#fff;font:700 10px Rajdhani,sans-serif;min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;padding:0 4px}
.md-lbl{font-size:8.5px;letter-spacing:2px;color:#7d8a99;writing-mode:vertical-rl;transform:rotate(180deg)}
.md-who{all:unset;cursor:pointer;position:relative}.md-who .md-bd{top:-4px;right:-8px}
.md-dot{position:absolute;right:-2px;bottom:1px;width:10px;height:10px;border-radius:50%;border:2px solid #0a0e14}
.md-panel{flex:1;display:flex;flex-direction:column;min-width:0;max-height:calc(100vh - 140px)}
.md-ph{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(0,217,255,.16)}.md-ph h3{margin:0;font:700 14px Rajdhani,sans-serif;letter-spacing:3px;color:#fff;flex:1}
.md-seg{display:flex;border:1px solid rgba(0,217,255,.16)}.md-seg button{all:unset;cursor:pointer;padding:4px 8px;font-size:10px;letter-spacing:1px;color:#7d8a99}.md-seg button.on{background:rgba(0,217,255,.12);color:#fff}
.md-x{all:unset;cursor:pointer;color:#7d8a99;padding:2px 6px}.md-x:hover{color:#fff}
.md-q{margin:8px 14px;width:calc(100% - 28px);height:30px;background:#060a0e;border:1px solid rgba(0,217,255,.16);color:#fff;padding:0 10px;font:inherit;font-size:12px}
.md-list{overflow:auto;flex:1}
.md-cv{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid rgba(0,217,255,.06);cursor:pointer;position:relative}
.md-cv:hover{background:rgba(0,217,255,.04)}.md-cv.on{background:rgba(0,217,255,.08);box-shadow:inset 3px 0 0 #00D9FF}
.md-cv b{color:#fff;font-weight:400;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px}.md-cv small{color:#7d8a99;font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.md-cv.un small{color:#d6dde6}.md-cv .r{text-align:right;font-size:10px;color:#7d8a99}.md-u{display:inline-block;background:#00D9FF;color:#041014;font:700 10px Rajdhani,sans-serif;padding:0 6px;margin-top:3px}
.md-cv .md-dot{left:41px;top:34px;right:auto;bottom:auto}
.md-tip{font-size:10px;letter-spacing:1px;color:#7d8a99;padding:10px 14px;margin:0;border-top:1px solid rgba(0,217,255,.16)}
.md-pops{position:fixed;right:20px;bottom:0;display:flex;gap:10px;align-items:flex-end;z-index:800;font-family:'Share Tech Mono',monospace}
.md-pop{width:330px;max-width:calc(100vw - 30px);background:#0a0e14;border:1px solid #00D9FF;border-bottom:0;box-shadow:0 -6px 30px rgba(0,0,0,.6);display:flex;flex-direction:column;height:420px;animation:mdIn .18s ease-out;color:#d6dde6}
.md-cbd{background:#ff4d4d;color:#fff;font:700 11px Rajdhani,sans-serif;min-width:20px;height:20px;border-radius:10px;display:grid;place-items:center;padding:0 5px;flex-shrink:0}
.md-pop.min.unr{border-color:#ff4d4d;animation:mdGlow 1.6s ease-in-out infinite}.md-pop.min.unr .md-ch{background:linear-gradient(90deg,rgba(255,77,77,.22),transparent)}
@keyframes mdGlow{50%{box-shadow:0 -4px 22px rgba(255,77,77,.55)}}@media(prefers-reduced-motion:reduce){.md-pop.min.unr{animation:none}}
.md-pop.min{height:auto}.md-pop.min .md-msgs,.md-pop.min .md-comp,.md-pop.min .md-ty{display:none}
@keyframes mdIn{from{transform:translateY(20px);opacity:0}}@media(prefers-reduced-motion:reduce){.md-pop{animation:none}}
.md-ch{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,217,255,.16);background:linear-gradient(90deg,rgba(0,217,255,.12),transparent);cursor:pointer}
.md-ch b{color:#fff;font-size:12.5px;font-weight:400;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.md-ch small{display:block;font-size:9.5px;letter-spacing:1px}
.md-ch button{all:unset;cursor:pointer;width:24px;height:24px;display:grid;place-items:center;color:#c6d0da;border:1px solid transparent}.md-ch button:hover{border-color:rgba(0,217,255,.32);color:#fff}.md-ch .x:hover{color:#ff4d4d;border-color:#ff4d4d}
.md-msgs{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.md-day{text-align:center;font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin:4px 0}
.md-b{max-width:82%;padding:7px 10px;font-size:12px;line-height:1.45;border:1px solid rgba(0,217,255,.16);background:#0e131b;align-self:flex-start;white-space:pre-wrap;word-break:break-word}
.md-b.me{background:rgba(0,217,255,.1);border-color:rgba(0,217,255,.32);align-self:flex-end}.md-b small{display:block;color:#7d8a99;font-size:9.5px;margin-top:3px}.md-b img{display:block;max-width:240px;max-height:180px;margin-top:4px}
.md-b .who{display:block;color:#00D9FF;font-size:10px;margin-bottom:2px}
.md-ty{font-size:10.5px;color:#7d8a99;padding:0 12px 4px;min-height:14px}
.md-comp{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(0,217,255,.16)}.md-comp textarea{flex:1;resize:none;height:34px;max-height:90px;background:#060a0e;border:1px solid rgba(0,217,255,.32);color:#fff;padding:7px 9px;font:inherit;font-size:12px}
.md-comp button{all:unset;cursor:pointer;padding:0 12px;background:#ffd166;color:#041014;font:700 11px Rajdhani,sans-serif;letter-spacing:2px}
.md-dock button:focus-visible,.md-pops button:focus-visible,.md-cv:focus-visible{outline:2px solid #00D9FF;outline-offset:2px}
@media(max-width:1100px){.md-dock.open{width:320px}}@media(max-width:800px){.md-dock{display:none}}
`);

let uid = null, me = null, users = new Map(), convs = [], online = new Set();
let filter = "", mode = "all";
const pops = new Map(); // convId → { el, unsub, msgs, lastTyping }
const userOf = (id) => users.get(id) || { id, callsign: "?" };
const others = (c) => (c?.participants || []).filter((p) => p !== uid);
const convName = (c) => (c?.name ? c.name : others(c).length === 1 ? memberName(userOf(others(c)[0])) : `Group · ${(c?.participants || []).length}`);
const convPic = (c) => (others(c).length === 1 ? userOf(others(c)[0]) : { callsign: c?.name || "Group" });
const tm = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d)) return "";
  if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return new Date(Date.now() - 864e5).toDateString() === d.toDateString() ? "YDAY" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
};
const unread = (c) => c.unreadCounts?.[uid] || 0;
const dotOf = (u) => {
  const s = statusOf(u);
  const isOn = online.has(u.id) && s !== "offline";
  const [, col] = STATES[isOn ? s : "offline"];
  return `<i class="md-dot" style="background:${col}" title="${isOn ? STATES[s][0] : "Offline"}"></i>`;
};
const myState = () => statusOf(me, true);

// ───────── dock ─────────
let dockEl = null;
let isOpen = (() => { try { return localStorage.getItem("mdOpen") !== "0"; } catch { return true; } })();
export function mountDock(parent) {
  if (dockEl || !parent) return;
  dockEl = document.createElement("aside");
  dockEl.className = `md-dock ${isOpen ? "open" : "closed"}`;
  dockEl.setAttribute("aria-label", "Messages");
  parent.appendChild(dockEl);
  dockEl.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-tg]")) return setOpen(!isOpen);
    if (t.closest("[data-close]")) return setOpen(false);
    if (t.closest("[data-new]")) return window.showPanel?.("panel-msg2");
    const m = t.closest("[data-mode]");
    if (m) { mode = m.dataset.mode; return drawDock(); }
    const c = t.closest("[data-cv]");
    if (c) return openPop(c.dataset.cv);
  });
  dockEl.addEventListener("input", (e) => {
    if (!e.target.classList.contains("md-q")) return;
    filter = e.target.value.toLowerCase();
    drawList();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "m" || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    if (document.getElementById("panel-dashboard")?.classList.contains("hidden")) return;
    setOpen(!isOpen);
  });
  drawDock();
}
function setOpen(v) {
  isOpen = v;
  try { localStorage.setItem("mdOpen", v ? "1" : "0"); } catch { /* blocked */ }
  dockEl.className = `md-dock ${v ? "open" : "closed"}`;
  drawDock();
}
function drawDock() {
  if (!dockEl) return;
  const total = convs.reduce((s, c) => s + unread(c), 0);
  const faces = convs.filter(unread).slice(0, 5).concat(convs.filter((c) => !unread(c)).slice(0, Math.max(0, 4 - convs.filter(unread).length))).slice(0, 5);
  dockEl.innerHTML = `<div class="md-rail"><button class="md-tg" data-tg aria-label="${isOpen ? "Close" : "Open"} messages (M)" aria-expanded="${isOpen}" title="Messages (M)">✉${total ? `<span class="md-bd">${total > 9 ? "9+" : total}</span>` : ""}</button><span class="md-lbl">MESSAGES</span>
      ${faces.map((c) => { const o = others(c); return `<button class="md-who" data-cv="${esc(c.id)}" title="${esc(convName(c))}${unread(c) ? ` — ${unread(c)} unread` : ""}">${hexAvatar(convPic(c), "sm")}${o.length === 1 ? dotOf(userOf(o[0])) : ""}${unread(c) ? `<span class="md-bd">${unread(c)}</span>` : ""}</button>`; }).join("")}
      <span style="flex:1"></span><button class="md-tg" data-new aria-label="New message" title="New message">＋</button></div>
    <div class="md-panel"><div class="md-ph"><h3>MESSAGES</h3><span class="md-seg">${[["all", "ALL"], ["unread", `UNREAD ${total || ""}`], ["groups", "GROUPS"]].map(([k, l]) => `<button data-mode="${k}" class="${mode === k ? "on" : ""}" aria-pressed="${mode === k}">${l}</button>`).join("")}</span><button class="md-x" data-close aria-label="Close messages">⇥</button></div>
      <input class="md-q" placeholder="Search people or messages…" value="${esc(filter)}" aria-label="Search messages"><div class="md-list" role="list"></div>
      <p class="md-tip">Click a conversation → it pops up at the bottom. ✕ closes it. Press M to open / close this dock.</p></div>`;
  drawList();
}
function drawList() {
  const el = dockEl?.querySelector(".md-list");
  if (!el) return;
  const list = convs.filter((c) => (mode !== "unread" || unread(c)) && (mode !== "groups" || others(c).length > 1) && (!filter || convName(c).toLowerCase().includes(filter) || String(c.lastMessage || "").toLowerCase().includes(filter)));
  el.innerHTML = list.map((c) => {
    const o = others(c), un = unread(c);
    const last = c.lastMessage ? (c.lastSenderUid === uid ? "You: " : "") + c.lastMessage : "No messages yet";
    return `<button class="md-cv ${pops.has(c.id) ? "on" : ""} ${un ? "un" : ""}" data-cv="${esc(c.id)}" role="listitem">${hexAvatar(convPic(c), "sm")}${o.length === 1 ? dotOf(userOf(o[0])) : ""}<span style="min-width:0"><b>${esc(convName(c))}</b><small>${esc(last)}</small></span><span class="r">${tm(c.lastMessageAt)}${un ? `<br><span class="md-u">${un}</span>` : ""}</span></button>`;
  }).join("") || `<p class="md-tip" style="border:0">${filter || mode !== "all" ? "NOTHING HERE" : "NO CONVERSATIONS YET — PRESS ＋"}</p>`;
}

// ───────── pop-up chats ─────────
let popBox = null;
function box() {
  if (!popBox) {
    popBox = document.createElement("div");
    popBox.className = "md-pops";
    popBox.setAttribute("aria-label", "Open chats");
    document.body.appendChild(popBox);
  }
  popBox.style.right = dockEl && isOpen && !document.getElementById("panel-dashboard")?.classList.contains("hidden") ? "430px" : "20px";
  return popBox;
}
export function openPop(id) {
  const c = convs.find((x) => x.id === id);
  if (!c) return;
  if (pops.has(id)) { const p = pops.get(id); p.el.classList.remove("min"); markRead(id); p.el.querySelector("textarea").focus(); return; }
  if (pops.size >= 3) closePop(pops.keys().next().value);
  const el = document.createElement("section");
  el.className = "md-pop";
  el.setAttribute("aria-label", `Chat with ${convName(c)}`);
  box().appendChild(el);
  const p = { el, unsub: null, msgs: [], lastTyping: 0 };
  pops.set(id, p);
  drawPop(id);
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b?.classList.contains("x")) return closePop(id);
    if (b?.dataset.a === "min") { el.classList.toggle("min"); return markRead(id); }
    if (b?.dataset.a === "full") { closePop(id); window.showPanel?.("panel-msg2"); return setTimeout(() => window.dispatchEvent(new CustomEvent("msg:open", { detail: { id } })), 300); }
    if (b?.dataset.a === "send") return sendFrom(id);
    if (e.target.closest(".md-ch") && !b && el.classList.contains("min")) { el.classList.remove("min"); markRead(id); el.querySelector("textarea")?.focus(); }
  });
  const ta = el.querySelector("textarea");
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFrom(id); }
    if (e.key === "Escape") closePop(id);
  });
  ta.addEventListener("input", () => {
    if (Date.now() - p.lastTyping < 3000) return;
    p.lastTyping = Date.now();
    updateDoc(doc(db, "conversations", id), { [`typing.${uid}`]: new Date().toISOString() }).catch(() => {});
  });
  p.unsub = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("timestamp", "asc"), limit(100)), (snap) => {
    p.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    drawMsgs(id);
    markRead(id);
  });
  ta.focus();
  drawList();
}
function closePop(id) {
  const p = pops.get(id);
  if (!p) return;
  p.unsub?.();
  p.el.remove();
  pops.delete(id);
  drawList();
}
function drawPop(id) {
  const p = pops.get(id), c = convs.find((x) => x.id === id);
  if (!p || !c) return;
  const o = others(c);
  const one = o.length === 1 ? userOf(o[0]) : null;
  const s = one ? (online.has(one.id) ? statusOf(one) : "offline") : null;
  const sub = one ? `<small style="color:${STATES[s][1]}">${STATES[s][2]} ${STATES[s][0].toUpperCase()}${one.myStatus?.note && s !== "offline" ? " · " + esc(one.myStatus.note) : ""}</small>` : `<small style="color:#7d8a99">GROUP · ${(c.participants || []).length}</small>`;
  const un = unread(c);
  p.el.classList.toggle("unr", un > 0);
  const head = `<div class="md-ch">${hexAvatar(convPic(c), "xs")}<span style="flex:1;min-width:0"><b>${esc(convName(c))}</b>${sub}</span>${un ? `<span class="md-cbd" aria-label="${un} unread">${un > 9 ? "9+" : un}</span>` : ""}<button data-a="min" aria-label="Shrink" title="Shrink">—</button><button data-a="full" aria-label="Open in Messages" title="Open full page">⤢</button><button class="x" aria-label="Close chat" title="Close (Esc)">✕</button></div>`;
  if (!p.el.firstChild) p.el.innerHTML = `${head}<div class="md-msgs" aria-live="polite"></div><div class="md-ty"></div><div class="md-comp"><textarea rows="1" placeholder="Reply…  (Enter to send)" aria-label="Reply"></textarea><button data-a="send">SEND</button></div>`;
  else p.el.querySelector(".md-ch").outerHTML = head;
  const ty = c.typing || {};
  const who = Object.entries(ty).filter(([k, v]) => k !== uid && v && Date.now() - Date.parse(v) < 6000).map(([k]) => memberName(userOf(k)));
  p.el.querySelector(".md-ty").textContent = who.length ? `${who.join(", ")} ${who.length > 1 ? "are" : "is"} typing…` : "";
}
function drawMsgs(id) {
  const p = pops.get(id), c = convs.find((x) => x.id === id);
  if (!p || !c) return;
  const box2 = p.el.querySelector(".md-msgs");
  const group = others(c).length > 1;
  let day = "", html = "";
  for (const m of p.msgs) {
    const d = toDate(m.timestamp) || new Date();
    const ds = d.toDateString();
    if (ds !== day) { day = ds; html += `<div class="md-day">— ${new Date().toDateString() === ds ? "TODAY" : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()} —</div>`; }
    const mine = m.senderUid === uid;
    html += `<div class="md-b ${mine ? "me" : ""}">${group && !mine ? `<span class="who">${esc(memberName(userOf(m.senderUid)))}</span>` : ""}${esc(m.text || "")}${m.imageUrl ? `<img src="${esc(m.imageUrl)}" alt="Image">` : ""}<small>${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></div>`;
  }
  const last = p.msgs.at(-1);
  if (last?.senderUid === uid) html += `<small style="align-self:flex-end;font-size:9px;color:#7d8a99;letter-spacing:1px">${(last.readBy || []).some((r) => r !== uid) ? "SEEN" : "✓ SENT"}</small>`;
  box2.innerHTML = html || '<div class="md-day">NO MESSAGES YET</div>';
  box2.scrollTop = box2.scrollHeight;
}
function markRead(id) {
  const p = pops.get(id), c = convs.find((x) => x.id === id);
  if (!p || !c || p.el.classList.contains("min")) return;
  if (unread(c)) updateDoc(doc(db, "conversations", id), { [`unreadCounts.${uid}`]: 0 }).catch(() => {});
  p.msgs.filter((m) => m.senderUid !== uid && !(m.readBy || []).includes(uid)).forEach((m) => updateDoc(doc(db, "conversations", id, "messages", m.id), { readBy: [...(m.readBy || []), uid] }).catch(() => {}));
}
async function sendFrom(id) {
  const p = pops.get(id), c = convs.find((x) => x.id === id);
  const ta = p?.el.querySelector("textarea");
  const text = ta?.value.trim();
  if (!c || !text) return;
  ta.value = "";
  const now = serverTimestamp();
  try {
    await addDoc(collection(db, "conversations", id, "messages"), { senderUid: uid, text, timestamp: now, readBy: [uid] });
    const upd = { lastMessage: text, lastMessageAt: now, lastSenderUid: uid, [`typing.${uid}`]: null };
    others(c).forEach((o) => (upd[`unreadCounts.${o}`] = increment(1)));
    await updateDoc(doc(db, "conversations", id), upd);
    const who = memberName(me) || "Someone";
    others(c).forEach((o) => addDoc(collection(db, "notifications", o, "items"), { type: "message", read: false, title: `${who} sent you a message`, body: text.slice(0, 60) + (text.length > 60 ? "…" : ""), fromUid: uid, convId: id, createdAt: now }).catch(() => {}));
  } catch (e) {
    ta.value = text;
    notify("MESSAGE NOT SENT — " + (e.message || "error"), true);
  }
}

// ───────── start ─────────
let started = false;
export function startDock(myUid, meDoc, allUsers) {
  if (started) return;
  started = true;
  uid = myUid;
  me = { id: myUid, ...(meDoc || {}) };
  users = new Map(allUsers.map((u) => [u.id, u]));
  const seen = new Map();
  let first = true;
  onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", uid)), (snap) => {
    convs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.lastMessageAt) || 0) - (toDate(a.lastMessageAt) || 0));
    // New message while you're on the Dashboard → pop the chat (not in Do not disturb / Invisible).
    for (const c of convs) {
      const u = unread(c);
      const shrunk = pops.get(c.id)?.el.classList.contains("min");
      if (!first && u > (seen.get(c.id) || 0) && c.lastSenderUid !== uid && (!pops.has(c.id) || shrunk) && myState() === "online") {
        // Dashboard → pop the chat. Any other page → a message card (bottom-right). Tab hidden → browser pop-up.
        if (document.hidden) osNotify(c);
        else if (!shrunk && !document.getElementById("panel-dashboard")?.classList.contains("hidden")) openPop(c.id);
        else toast(c);
      }
      seen.set(c.id, u);
    }
    first = false;
    tabTitle(convs.reduce((n, c) => n + unread(c), 0));
    for (const id of [...toasts.keys()]) if ((pops.has(id) && !pops.get(id).el.classList.contains("min")) || !unread(convs.find((c) => c.id === id) || {})) dropToast(id);
    drawDock();
    for (const id of pops.keys()) { if (!convs.some((c) => c.id === id)) closePop(id); else { drawPop(id); markRead(id); } }
  }, () => {});
  onSnapshot(collection(db, "presence_sessions"), (snap) => {
    const cut = Date.now() - 3 * 60 * 1000;
    online = new Set(snap.docs.map((d) => d.data()).filter((p) => Date.parse(p.updatedAt || 0) > cut).map((p) => p.uid));
    drawDock();
    for (const id of pops.keys()) drawPop(id);
  }, () => {});
}
export function updateUsers(list) {
  users = new Map(list.map((u) => [u.id, u]));
  const m = users.get(uid);
  if (m) me = { id: uid, ...m };
  drawDock();
}
export function refreshPopPosition() { if (popBox) box(); }

/* ───────── New-message pop-out (approved mock 2026-11-12) ─────────
 * Any terminal page: a card slides in bottom-right (name, rank, online dot, first line). REPLY = mini chat, OPEN = Messages page.
 * Gone after 8 s (paused while the mouse is on it). Max 3 cards, then "+N more". Same chat again → its card updates.
 * Do not disturb / Invisible → none (badge + 🔔 only). Tab title shows the unread count. Tab hidden → browser pop-up (allowed once).
 */
addCss("mtoast", `
.mt-stack{position:fixed;right:22px;bottom:22px;z-index:9000;display:flex;flex-direction:column;gap:10px;width:360px;max-width:calc(100vw - 30px)}
.mt{background:#0b0f15;border:1px solid rgba(0,217,255,.4);box-shadow:0 10px 30px rgba(0,0,0,.65),inset 0 0 24px rgba(0,217,255,.08);position:relative;animation:mtIn .3s ease-out}
.mt:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#00D9FF,transparent)}
@keyframes mtIn{from{transform:translateX(40px);opacity:0}}@media(prefers-reduced-motion:reduce){.mt{animation:none}.mt-bar i{transition:none!important}}
.mt-h{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:1px solid rgba(0,217,255,.1);font-size:10px;letter-spacing:2.5px;color:#7d8a99}
.mt-h button{all:unset;margin-left:auto;cursor:pointer;color:#7d8a99;padding:0 4px}.mt-h button:hover,.mt-h button:focus-visible{color:#fff}
.mt-b{display:flex;gap:11px;padding:10px 12px;cursor:pointer}.mt-b .hx{flex-shrink:0;position:relative}
.mt-n{color:#fff;font-weight:700;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mt-n small{color:#4b5765;font-weight:400;margin-left:6px;letter-spacing:0}
.mt-m{color:#aeb9c4;font-size:12.5px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.mt-a{display:flex;gap:6px;padding:0 12px 10px 62px}.mt-a button{all:unset;cursor:pointer;border:1px solid rgba(0,217,255,.25);padding:3px 10px;font-size:10.5px;letter-spacing:1.5px;color:#fff}
.mt-a button.p{border-color:#00D9FF;color:#00D9FF}.mt-a button:hover,.mt-a button:focus-visible{background:rgba(0,217,255,.1)}
.mt-bar{height:3px;background:rgba(0,217,255,.12)}.mt-bar i{display:block;height:100%;background:#00D9FF;width:100%}
.mt-more{background:#0b0f15;border:1px dashed rgba(0,217,255,.25);padding:7px 12px;font-size:11px;letter-spacing:1.5px;color:#7d8a99;text-align:center;cursor:pointer}
`);
const toasts = new Map(); // convId → { el, timer, left, start }
const TOAST_MS = 8000;
let stackEl = null, baseTitle = null;
function stack() {
  if (!stackEl || !stackEl.isConnected) { stackEl = document.createElement("div"); stackEl.className = "mt-stack"; stackEl.setAttribute("aria-live", "polite"); document.body.appendChild(stackEl); }
  return stackEl;
}
function drawMore() {
  const st = stack(), hidden = [...toasts.values()].filter((t) => t.el.hidden).length;
  let m = st.querySelector(".mt-more");
  if (!hidden) return m?.remove();
  if (!m) { m = document.createElement("div"); m.className = "mt-more"; m.setAttribute("role", "button"); m.tabIndex = 0; m.onclick = () => window.showPanel?.("panel-msg2"); st.prepend(m); }
  m.textContent = `+${hidden} MORE MESSAGE${hidden === 1 ? "" : "S"}`;
}
function layout() { const all = [...toasts.values()]; all.forEach((t, i) => (t.el.hidden = i < all.length - 3)); drawMore(); }
function dropToast(id) { const t = toasts.get(id); if (!t) return; clearTimeout(t.timer); t.el.remove(); toasts.delete(id); layout(); }
function arm(id) {
  const t = toasts.get(id); if (!t) return;
  clearTimeout(t.timer); t.start = Date.now();
  const bar = t.el.querySelector(".mt-bar i");
  bar.style.transition = "none"; bar.style.width = `${(t.left / TOAST_MS) * 100}%`; void bar.offsetWidth;
  bar.style.transition = `width ${t.left}ms linear`; bar.style.width = "0%";
  t.timer = setTimeout(() => dropToast(id), t.left);
}
function pause(id) { const t = toasts.get(id); if (!t) return; clearTimeout(t.timer); t.left = Math.max(1500, t.left - (Date.now() - t.start)); const bar = t.el.querySelector(".mt-bar i"); bar.style.transition = "none"; bar.style.width = `${(t.left / TOAST_MS) * 100}%`; }
function toast(c) {
  const id = c.id, n = unread(c), o = others(c), sender = userOf(c.lastSenderUid) || userOf(o[0]);
  const group = o.length > 1;
  const who = group ? `${memberName(sender)} · ${convName(c)}` : convName(c);
  const html = `<div class="mt-h">✉ NEW MESSAGE${n > 1 ? ` · ${n}` : ""}<button data-t="x" aria-label="Close">✕</button></div>
    <div class="mt-b" data-t="reply"><span class="hx">${hexAvatar(group ? sender : convPic(c), "sm")}${!group && o.length === 1 ? dotOf(userOf(o[0])) : ""}</span><div style="min-width:0"><div class="mt-n">${esc(who)}<small>now</small></div><div class="mt-m">${esc(String(c.lastMessage || "Sent an image"))}</div></div></div>
    <div class="mt-a"><button class="p" data-t="reply">↩ REPLY</button><button data-t="open">OPEN</button></div><div class="mt-bar"><i></i></div>`;
  let t = toasts.get(id);
  if (t) { t.el.innerHTML = html; toasts.delete(id); }
  else {
    const el = document.createElement("div"); el.className = "mt"; el.setAttribute("role", "status");
    el.addEventListener("mouseenter", () => pause(id)); el.addEventListener("mouseleave", () => arm(id));
    el.addEventListener("focusin", () => pause(id)); el.addEventListener("focusout", () => arm(id));
    el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-t]")?.dataset.t; if (!a) return;
      dropToast(id);
      if (a === "reply") openPop(id);
      if (a === "open") { window.showPanel?.("panel-msg2"); setTimeout(() => window.dispatchEvent(new CustomEvent("msg:open", { detail: { id } })), 300); }
    });
    t = { el, timer: 0, left: TOAST_MS, start: 0 };
    el.innerHTML = html;
  }
  t.left = TOAST_MS;
  toasts.set(id, t); // re-insert = newest last
  stack().appendChild(t.el);
  layout(); arm(id);
}
function tabTitle(n) {
  if (baseTitle === null) baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
  const want = n ? `(${n > 99 ? "99+" : n}) ${baseTitle}` : baseTitle;
  if (document.title !== want) document.title = want;
}
// Browsers only allow the "Allow notifications?" question after a click, so it's asked once on your first click in the terminal.
if (typeof Notification !== "undefined" && Notification.permission === "default") {
  document.addEventListener("click", () => { try { if (Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* old browser */ } }, { once: true });
}
function osNotify(c) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const o = others(c), sender = userOf(c.lastSenderUid) || userOf(o[0]);
    const n = new Notification(`${memberName(sender)} sent you a message`, { body: String(c.lastMessage || "Sent an image").slice(0, 120), tag: `msg-${c.id}`, icon: "/images/logo.png" });
    n.onclick = () => { window.focus(); openPop(c.id); n.close(); };
  } catch { /* blocked */ }
}
