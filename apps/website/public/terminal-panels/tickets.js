/**
 * DISCORD → Tickets (approved mock 2026-11-10). Access: "tk" (answer) · "tkrep" or Settings (ticket types).
 * Each TYPE has its own panel channel (Recruitment → #join-505th, Tech Support → #tech-support, add more).
 * Members open tickets in Discord; Cortana copies the chat to tickets/<id>. Staff reply / claim / close / move here
 * (sent through Cortana) or straight in Discord. Staff notes stay on the website.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, updateDoc } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, db, esc, memberName, mountPanel, notify, onReady } from "./_common.js";
import { ago, chanOptions, cortanaJob, loadDiscord, roleOptions, ukTime } from "./discord-common.js";

let tickets = [], types = [], chans = [], roles = [], users = [], cases = [], acc = {}, root = null;
let who = "";
let filter = "open", typeFilter = "", sel = null, draft = "", note = false, editType = null, busy = false, subs = [];
const pad = (n) => String(n).padStart(4, "0");
const typeOf = (id) => types.find((t) => t.id === id);
const blankType = () => ({ name: "", emoji: "", channelId: "", categoryId: "", purpose: "", btnLabel: "", btnEmoji: "", btnStyle: "green", staffRoleIds: [], question: "", color: 0x22e07a });

function kpis() {
  const open = tickets.filter((t) => t.status === "open");
  const month = new Date().toISOString().slice(0, 7);
  const replies = tickets.filter((t) => t.firstReplyMs != null && String(t.openedAtISO).slice(0, 7) === month).map((t) => t.firstReplyMs);
  const avg = replies.length ? replies.reduce((a, b) => a + b, 0) / replies.length / 60000 : null;
  return `<div class="tk-kpi"><div><b style="color:#f59e0b">${open.length}</b><small>OPEN</small></div><div><b style="color:#00D9FF">${open.filter((t) => t.waiting === "staff").length}</b><small>WAITING ON STAFF</small></div>
    <div><b>${avg == null ? "—" : avg < 60 ? Math.round(avg) + "m" : `${Math.floor(avg / 60)}h ${Math.round(avg % 60)}m`}</b><small>AVG FIRST REPLY (MONTH)</small></div><div><b style="color:#22e07a">${tickets.filter((t) => t.status === "closed" && String(t.closedAtISO).slice(0, 7) === month).length}</b><small>CLOSED THIS MONTH</small></div></div>`;
}
function listHtml() {
  const list = tickets.filter((t) => (filter === "closed" ? t.status === "closed" : t.status === "open") && (!typeFilter || t.typeId === typeFilter));
  return `<div class="tk-list"><div class="chips" style="padding:10px"><button class="ch ${filter === "open" && !typeFilter ? "on" : ""}" data-f="open:">OPEN</button>
    ${types.map((t) => `<button class="ch ${typeFilter === t.id ? "on" : ""}" data-f="open:${t.id}">${esc(t.emoji || "")} ${esc(t.name.toUpperCase())}</button>`).join("")}<button class="ch ${filter === "closed" ? "on" : ""}" data-f="closed:">CLOSED</button></div>
    ${list.map((t) => `<button class="it ${t.id === sel ? "on" : ""}" data-open="${t.id}"><span class="pill ${t.status === "closed" ? "" : t.waiting === "staff" ? (t.transcript?.length > 1 ? "cy" : "wr") : "ok"}">${t.status === "closed" ? "CLOSED" : t.waiting === "staff" ? (t.transcript?.length > 1 ? "STAFF" : "NEW") : "MEMBER"}</span>
      <span><b>#${pad(t.number)} · ${esc(t.openerName)}</b><small>${esc(t.typeEmoji || "")} ${esc(t.typeName)} · ${ago(t.lastActivityISO || t.openedAtISO)}${t.claimedByName ? " · " + esc(t.claimedByName) : ""}</small></span></button>`).join("") || '<div class="empty">No tickets here.</div>'}</div>`;
}
function chatHtml() {
  const t = tickets.find((x) => x.id === sel);
  if (!t) return '<div class="tk-card empty">Pick a ticket on the left.</div>';
  const open = t.status === "open";
  return `<div class="tk-card"><div class="tk-hd"><div><b>#${pad(t.number)} · ${esc(t.typeName.toUpperCase())}</b><small>OPENED ${esc(ukTime(t.openedAtISO))} · ${esc(t.openerName)}${t.claimedByName ? " · CLAIMED BY " + esc(t.claimedByName) : ""}${open ? "" : " · CLOSED " + esc(ukTime(t.closedAtISO)) + (t.closedByName ? " BY " + esc(t.closedByName) : "") + (t.closeReason ? " — “" + esc(t.closeReason) + "”" : "")}${t.channelDeleted ? " · CHANNEL DELETED" : ""}</small></div>
    ${acc.tk ? `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${open ? `${t.claimedByName ? "" : '<button class="b" data-x="claim">✋ CLAIM</button>'}<button class="b red" data-x="close">🔒 CLOSE</button>`
      : `<button class="b" data-x="transcript">📑 TRANSCRIPT</button><button class="b" data-x="download">⤓ HTML</button>${t.channelDeleted ? "" : '<button class="b" data-x="reopen">🔓 REOPEN</button><button class="b red" data-x="delete">⛔ DELETE CHANNEL</button>'}`}</div>` : ""}</div>
    <div class="tk-chat" id="tkChat">${(t.transcript || []).map((m) => `<div class="msg ${m.staff ? "staff" : ""} ${m.note ? "note" : ""}"><i>${esc((m.who || "?").slice(0, 2).toUpperCase())}</i><div class="w"><b>${esc(m.who)}</b><small>${esc(ukTime(m.atISO, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }))}${m.note ? " · STAFF NOTE — ONLY STAFF SEE THIS" : ""}</small><div>${esc(m.text).replace(/\n/g, "<br>")}</div>${(m.images || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Attached image" loading="lazy"></a>`).join("")}</div></div>`).join("")}</div>
    ${open && acc.tk ? `<textarea class="fld" id="tkReply" rows="3" maxlength="1900" placeholder="${note ? "Staff note — only staff see it" : `Reply to ${esc(t.openerName)}… (sent into the Discord ticket as Cortana, signed with your name)`}">${esc(draft)}</textarea>
      <div class="tk-ft"><button class="ch ${note ? "on" : ""}" data-x="note" aria-pressed="${note}">🔒 STAFF NOTE</button><button class="b gold" data-x="send" ${busy ? "disabled" : ""}>${busy ? "SENDING…" : note ? "SAVE NOTE" : "SEND REPLY"}</button></div>` : ""}</div>`;
}
/** Same HTML transcript Cortana posts, made in the browser (works even after the channel is deleted). */
function downloadHtml(t) {
  if (!t) return;
  const d = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const rows = (t.transcript || []).map((l) => `<div class="m${l.note ? " n" : ""}"><div class="w"><b>${esc(l.who)}</b>${l.staff ? "<em>STAFF</em>" : ""}${l.note ? '<em class="nt">STAFF NOTE</em>' : ""}<small>${esc(d(l.atISO))}</small></div><div>${esc(l.text).replace(/\n/g, "<br>")}${(l.images || []).map((u) => `<br><a href="${esc(u)}">📎 image</a>`).join("")}</div></div>`).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Ticket #${pad(t.number)}</title><style>body{margin:0;background:#0a0e12;color:#dbe7ee;font:14px/1.5 "Segoe UI",Arial,sans-serif}.w0{max-width:860px;margin:0 auto;padding:24px}h1{color:#00d9ff;font-size:20px;margin:0}.meta{color:#8aa0ab;font-size:13px;margin:6px 0 18px}.m{border-top:1px solid #1d2a31;padding:10px 0}.m.n{background:#1a1505}.w b{color:#fff}.w em{font-style:normal;font-size:10px;letter-spacing:1px;padding:1px 6px;margin-left:6px;border:1px solid #00d9ff;color:#00d9ff}.w em.nt{border-color:#f59e0b;color:#f59e0b}.w small{color:#6f8a96;margin-left:8px;font-size:11px}a{color:#00a8fc}</style></head><body><div class="w0"><h1>505th · Ticket #${pad(t.number)} · ${esc(t.typeName)}</h1><div class="meta">Opened by <b>${esc(t.openerName)}</b> · ${esc(d(t.openedAtISO))}${t.closedAtISO ? ` · closed ${esc(d(t.closedAtISO))} by ${esc(t.closedByName || "")} — “${esc(t.closeReason || "")}”` : ""}</div>${rows}</div></body></html>`;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([html], { type: "text/html" })), download: `transcript-ticket-${pad(t.number)}.html` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function sideHtml() {
  const t = tickets.find((x) => x.id === sel);
  if (!t) return "<div></div>";
  const u = users.find((x) => x.discordId === t.openerId);
  const past = tickets.filter((x) => x.openerId === t.openerId && x.id !== t.id).length;
  const warns = cases.filter((c) => c.discordId === t.openerId && c.action === "warn" && c.active).length;
  return `<div class="tk-card"><b class="tk-h">MEMBER</b><div class="row"><span>DISCORD</span><span>${esc(t.openerName)}</span></div>
    <div class="row"><span>WEBSITE</span>${u ? `<span>${esc(memberName(u))}</span>` : '<span class="pill wr">NOT LINKED</span>'}</div>
<div class="row"><span>PAST TICKETS</span><span>${past}</span></div><div class="row"><span>ACTIVE WARNINGS</span><span>${warns}</span></div>
    ${t.status === "open" && acc.tk ? `<b class="tk-h" style="margin-top:14px">MOVE TO</b><select class="fld" data-x="move"><option value="">— another type —</option>${types.filter((x) => x.id !== t.typeId).map((x) => `<option value="${x.id}">${esc(x.emoji || "")} ${esc(x.name)}</option>`).join("")}</select>` : ""}
    ${!t.channelDeleted && acc.tk ? `<b class="tk-h" style="margin-top:14px">ADD / REMOVE PERSON</b><select class="fld" data-x="who" aria-label="Member"><option value="">— pick a member —</option>${users.filter((x) => /^\d{17,20}$/.test(String(x.discordId || "")) && x.discordId !== t.openerId).map((x) => `<option value="${x.discordId}" ${x.discordId === who ? "selected" : ""}>${esc(memberName(x))}</option>`).join("")}</select>
      <div style="display:flex;gap:6px;margin-top:6px"><button class="b" data-x="padd" ${who ? "" : "disabled"}>➕ ADD</button><button class="b" data-x="prem" ${who ? "" : "disabled"}>➖ REMOVE</button></div>` : ""}
    <p class="tk-sub" style="margin-top:12px">CLOSING REMOVES THE MEMBER AND RENAMES IT CLOSED-${pad(t.number)} · STAFF THEN USE TRANSCRIPT / REOPEN / DELETE · THE CHAT STAYS HERE</p></div>`;
}
function typesHtml() {
  const canTypes = acc.tkrep || acc.set;
  const form = editType ? (() => { const t = editType.v; return `<tr class="tk-form"><td colspan="6"><div class="tk-3">
      <div><label class="lbl" for="ttN">NAME</label><div style="display:flex;gap:6px"><input class="fld" style="width:56px;text-align:center" id="ttE" data-t="emoji" maxlength="64" value="${esc(t.emoji)}" placeholder="🪖" aria-label="Emoji"><input class="fld" id="ttN" data-t="name" maxlength="60" value="${esc(t.name)}" placeholder="e.g. Recruitment"></div></div>
      <div><label class="lbl" for="ttC">PANEL CHANNEL</label><select class="fld" id="ttC" data-t="channelId">${chanOptions(chans, t.channelId, { kinds: ["text"] })}</select></div>
      <div><label class="lbl" for="ttK">TICKETS OPEN IN (CATEGORY)</label><select class="fld" id="ttK" data-t="categoryId">${chanOptions(chans, t.categoryId, { kinds: ["category"], none: "— no category —", needSend: false })}</select></div>
      <div><label class="lbl" for="ttP">WHAT IT'S FOR (ON THE PANEL)</label><textarea class="fld" id="ttP" data-t="purpose" maxlength="1500" rows="4">${esc(t.purpose)}</textarea></div>
      <div><span class="lbl">STAFF WHO SEE IT</span><div class="chips">${t.staffRoleIds.map((r) => `<span class="ch on">@${esc(roles.find((x) => x.id === r)?.name || "deleted")} <button data-trm="${r}" aria-label="Remove">✕</button></span>`).join("")}<select class="fld tk-add" data-x="troleadd">${roleOptions(roles, "", "＋ ROLE", { exclude: t.staffRoleIds })}</select></div></div>
      <div><label class="lbl" for="ttQ">FIRST QUESTION (OPTIONAL)</label><textarea class="fld" id="ttQ" data-t="question" maxlength="1000" rows="4">${esc(t.question)}</textarea></div></div>
      <div class="tk-3" style="margin-top:10px"><div><label class="lbl" for="ttBl">BUTTON TEXT</label><div style="display:flex;gap:6px"><input class="fld" style="width:56px;text-align:center" id="ttBe" data-t="btnEmoji" maxlength="64" value="${esc(t.btnEmoji)}" placeholder="${esc(t.emoji || "🎫")}" aria-label="Button emoji"><input class="fld" id="ttBl" data-t="btnLabel" maxlength="80" value="${esc(t.btnLabel)}" placeholder="Open ${esc(t.name || "")} ticket"></div></div>
      <div><label class="lbl" for="ttBs">BUTTON COLOUR</label><select class="fld" id="ttBs" data-t="btnStyle">${[["green", "Green"], ["blue", "Blue"], ["grey", "Grey"], ["red", "Red"]].map(([k, l]) => `<option value="${k}" ${(t.btnStyle || "green") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><span class="lbl">BUTTON PREVIEW</span><div style="padding-top:4px"><span style="display:inline-block;padding:8px 16px;border-radius:4px;color:#fff;font:600 14px 'gg sans','Segoe UI',sans-serif;background:${({ green: "#248046", blue: "#5865f2", grey: "#4e5058", red: "#da373c" })[t.btnStyle || "green"]}">${esc(t.btnEmoji || t.emoji || "")} ${esc(t.btnLabel || `Open ${t.name || ""} ticket`)}</span></div></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:10px">${editType.id ? '<button class="b red" data-x="tdel">🗑 DELETE TYPE</button>' : "<span></span>"}<div style="display:flex;gap:6px"><button class="b" data-x="tcancel">CANCEL</button><button class="b gold" data-x="tsave" ${busy ? "disabled" : ""}>SAVE + POST PANEL</button></div></div></td></tr>`; })() : "";
  return `<div class="tk-card" style="margin-top:16px;padding:0"><div class="tk-hd" style="padding:12px 14px"><div><b>TICKET TYPES · EACH HAS ITS OWN CHANNEL</b><small>EACH TYPE = ONE PANEL POST IN ITS OWN CHANNEL</small></div>${canTypes && !editType ? '<button class="b gold" data-x="tnew">＋ ADD TICKET TYPE</button>' : ""}</div>
    <table class="tk-tb"><thead><tr><th>TYPE</th><th>PANEL CHANNEL</th><th>WHAT IT'S FOR</th><th>STAFF WHO SEE IT</th><th>TICKETS OPEN IN</th><th></th></tr></thead><tbody>
    ${editType && !editType.id ? form : ""}
    ${types.map((t) => `<tr><td>${esc(t.emoji || "")} <b>${esc(t.name)}</b></td><td>#${esc(chans.find((c) => c.id === t.channelId)?.name || "—")} ${t.panel?.messageId ? '<span class="pill ok">POSTED</span>' : '<span class="pill wr">NOT POSTED</span>'}</td><td>${esc(t.purpose || "")}</td>
      <td>${(t.staffRoleIds || []).map((r) => "@" + esc(roles.find((x) => x.id === r)?.name || "?")).join(" · ") || "—"}</td><td>📁 ${esc(chans.find((c) => c.id === t.categoryId)?.name || "none")}</td><td>${canTypes ? `<button class="b" data-tedit="${t.id}">EDIT</button>` : ""}</td></tr>${editType?.id === t.id ? form : ""}`).join("") || (editType ? "" : '<tr><td colspan="6" class="empty">No ticket types yet — add Recruitment and Tech Support.</td></tr>')}</tbody></table></div>`;
}
function draw() {
  if (!acc.tk) { root.innerHTML = '<div class="panel-title">TICKETS</div><div class="empty">You don\'t have Tickets access.</div>'; return; }
  const keep = document.activeElement?.id;
  const sc = root.querySelector("#tkChat")?.scrollTop;
  root.innerHTML = `<div class="panel-title">TICKETS</div><div class="tk-sub">EACH TICKET TYPE HAS ITS OWN CHANNEL · MEMBERS OPEN THEM IN DISCORD · STAFF ANSWER HERE OR IN DISCORD</div>${kpis()}
    <div class="tk-g">${listHtml()}${chatHtml()}${sideHtml()}</div>${typesHtml()}`;
  const chat = root.querySelector("#tkChat");
  if (chat) chat.scrollTop = sc ?? chat.scrollHeight;
  if (keep) root.querySelector("#" + keep)?.focus();
}
const typing = () => { const a = document.activeElement; return a && root.contains(a) && (a.tagName === "TEXTAREA" || a.tagName === "INPUT"); };

async function run(type, payload, ok) {
  busy = true; draw();
  try { const r = await cortanaJob(type, payload); notify(r ? ok : "◷ CORTANA IS OFFLINE — DONE WHEN IT'S BACK", !r); return true; }
  catch (e) { notify("FAILED: " + e.message, 1); return false; }
  finally { busy = false; draw(); }
}
async function saveType() {
  const t = editType.v;
  if (!t.name.trim() || !t.channelId) return notify("NAME AND PANEL CHANNEL ARE NEEDED", 1);
  if (!t.staffRoleIds.length && !(await ask({ kind: "warn", title: "NO STAFF ROLES?", body: "Only Cortana and staff with Tickets access on the website would see these tickets.", go: "SAVE ANYWAY", cancel: "GO BACK" }))) return;
  busy = true;
  try {
    const body = { ...t, name: t.name.trim(), updatedAtISO: new Date().toISOString() };
    let id = editType.id;
    if (id) await updateDoc(doc(db, "ticket_types", id), body);
    else id = (await addDoc(collection(db, "ticket_types"), body)).id;
    await audit("discord", "TICKET TYPE SAVED", t.name);
    editType = null;
    busy = false;
    await run("ticket.panel", { typeId: id }, `✓ PANEL POSTED IN #${(chans.find((c) => c.id === t.channelId)?.name || "").toUpperCase()}`);
  } catch (e) { busy = false; notify("SAVE FAILED: " + e.message, 1); draw(); }
}

function wire() {
  root.addEventListener("input", (e) => {
    if (e.target.id === "tkReply") draft = e.target.value;
    const k = e.target.dataset.t;
    if (k && editType && e.target.tagName !== "SELECT") editType.v[k] = e.target.value;
  });
  root.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.t && editType) { editType.v[t.dataset.t] = t.value; if (/^(btn|emoji|name)/.test(t.dataset.t)) draw(); return; }
    if (t.dataset.x === "who") { who = t.value; return draw(); }
    if (t.dataset.x === "troleadd" && t.value) { editType.v.staffRoleIds.push(t.value); return draw(); }
    if (t.dataset.x === "move" && t.value) {
      const to = typeOf(t.value);
      if (await ask({ kind: "warn", title: `MOVE TO ${to.name.toUpperCase()}?`, body: "Its staff roles get access to the channel.", go: "MOVE", cancel: "KEEP" })) await run("ticket.move", { ticketId: sel, typeId: t.value }, "✓ MOVED");
      else draw();
    }
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.f) { [filter, typeFilter] = d.f.split(":"); return draw(); }
    if (d.open) { sel = d.open; draft = ""; note = false; return draw(); }
    if (d.tedit) { const t = typeOf(d.tedit); editType = { id: t.id, v: { ...blankType(), ...JSON.parse(JSON.stringify(t)) } }; delete editType.v.id; delete editType.v.panel; return draw(); }
    if (d.trm) { editType.v.staffRoleIds = editType.v.staffRoleIds.filter((r) => r !== d.trm); return draw(); }
    switch (d.x) {
      case "note": note = !note; return draw();
      case "send": {
        const text = draft.trim();
        if (!text) return;
        if (await run("ticket.reply", { ticketId: sel, text, note }, note ? "✓ NOTE SAVED" : "✓ REPLY SENT")) { draft = ""; note = false; draw(); }
        return;
      }
      case "claim": return run("ticket.claim", { ticketId: sel }, "✓ CLAIMED");
      case "close": {
        const t = tickets.find((x) => x.id === sel);
        const reason = await ask({ kind: "reason", title: `CLOSE #${pad(t.number)}?`, body: "The member loses access and the channel becomes closed-" + pad(t.number) + ". Staff then get Transcript / Reopen / Delete.", placeholder: "Reason (optional)", optional: true, go: "CLOSE TICKET", cancel: "KEEP OPEN" });
        if (reason !== null && reason !== false) await run("ticket.close", { ticketId: sel, reason: typeof reason === "string" ? reason : "" }, "✓ TICKET CLOSED");
        return;
      }
      case "reopen": return run("ticket.reopen", { ticketId: sel }, "✓ REOPENED");
      case "transcript": return run("ticket.transcript", { ticketId: sel }, "✓ TRANSCRIPT POSTED");
      case "download": return downloadHtml(tickets.find((x) => x.id === sel));
      case "delete": {
        const t = tickets.find((x) => x.id === sel);
        if (await ask({ kind: "danger", title: `DELETE #closed-${pad(t.number)}?`, body: "Cortana saves the transcript first, then deletes the Discord channel. The record and chat stay here.", go: "DELETE CHANNEL", cancel: "KEEP" })) await run("ticket.delete", { ticketId: sel }, "✓ CHANNEL DELETED");
        return;
      }
      case "padd": case "prem": {
        if (!who) return;
        if (await run(d.x === "padd" ? "ticket.add" : "ticket.remove", { ticketId: sel, userId: who }, d.x === "padd" ? "✓ ADDED" : "✓ REMOVED")) { who = ""; draw(); }
        return;
      }
      case "tnew": editType = { id: null, v: blankType() }; return draw();
      case "tcancel": editType = null; return draw();
      case "tsave": return saveType();
      case "tdel": {
        const t = typeOf(editType.id);
        if (!(await ask({ kind: "danger", title: "DELETE TICKET TYPE?", body: "Its panel post is removed from Discord. Old tickets stay.", item: t.name, go: "DELETE" }))) return;
        if (t.panel?.messageId) await cortanaJob("ticket.panelRemove", { channelId: t.panel.channelId, messageId: t.panel.messageId }, { wait: false }).catch(() => {});
        await deleteDoc(doc(db, "ticket_types", t.id));
        await audit("discord", "TICKET TYPE DELETED", t.name);
        editType = null; notify("✓ DELETED"); return draw();
      }
    }
  });
}

async function load() {
  ({ chans, roles } = await loadDiscord());
  users = (await getDocs(collection(db, "users")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? [];
  if (!subs.length) {
    subs.push(onSnapshot(collection(db, "tickets"), (s) => { tickets = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.lastActivityISO || b.openedAtISO).localeCompare(String(a.lastActivityISO || a.openedAtISO))); if (!sel) sel = tickets.find((t) => t.status === "open")?.id || null; if (!typing() && !busy) draw(); }, () => {}));
    subs.push(onSnapshot(collection(db, "ticket_types"), (s) => { types = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)); if (!typing() && !busy) draw(); }, () => {}));
    if (acc.modw) subs.push(onSnapshot(collection(db, "mod_cases"), (s) => { cases = s.docs.map((d) => d.data()); }, () => {}));
  }
  draw();
}

const CSS = `
#ticketsV2 .tk-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#ticketsV2 .tk-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}#ticketsV2 .tk-kpi div{border:1px solid rgba(0,217,255,.18);padding:10px;background:rgba(0,0,0,.25)}#ticketsV2 .tk-kpi b{font:700 22px monospace;display:block}#ticketsV2 .tk-kpi small{color:#6f8a96;font:10px monospace;letter-spacing:1px}
#ticketsV2 .tk-g{display:grid;grid-template-columns:290px minmax(0,1fr) 280px;gap:16px;align-items:start}
#ticketsV2 .tk-list,#ticketsV2 .tk-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18)}#ticketsV2 .tk-card{padding:14px 16px}
#ticketsV2 .tk-list .it{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:10px;align-items:center;width:100%;padding:10px;border-bottom:1px solid rgba(0,217,255,.08);border-left:2px solid transparent}
#ticketsV2 .tk-list .it.on{background:rgba(0,217,255,.08);border-left-color:#00D9FF}#ticketsV2 .tk-list .it:focus-visible{outline:2px solid #00D9FF}#ticketsV2 .tk-list b{display:block;font-size:14px}#ticketsV2 .tk-list small{color:#6f8a96;font:11px monospace}
#ticketsV2 .pill{font:10px monospace;letter-spacing:1px;padding:2px 6px;border:1px solid rgba(0,217,255,.18);white-space:nowrap;color:#6f8a96}#ticketsV2 .pill.ok{color:#22e07a;border-color:rgba(34,224,122,.4)}#ticketsV2 .pill.wr{color:#f59e0b;border-color:rgba(245,158,11,.4)}#ticketsV2 .pill.cy{color:#00D9FF;border-color:#00D9FF}
#ticketsV2 .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#ticketsV2 .ch{all:unset;cursor:pointer;font:11px monospace;padding:4px 8px;border:1px solid rgba(0,217,255,.18);color:#cfe9f2;display:inline-flex;gap:6px;align-items:center}#ticketsV2 .ch.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}#ticketsV2 .ch:focus-visible{outline:2px solid #00D9FF}#ticketsV2 .ch button{all:unset;cursor:pointer;color:#6f8a96}
#ticketsV2 .tk-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid rgba(0,217,255,.18);padding-bottom:10px}#ticketsV2 .tk-hd b{font:700 14px monospace;letter-spacing:1px;display:block}#ticketsV2 .tk-hd small{color:#6f8a96;font:10px monospace;letter-spacing:1px}
#ticketsV2 .tk-chat{max-height:420px;overflow:auto;padding:6px 0;margin-bottom:10px}
#ticketsV2 .msg{display:flex;gap:10px;padding:8px 0}#ticketsV2 .msg i{width:32px;height:32px;border-radius:50%;background:#1b2a33;flex-shrink:0;display:grid;place-items:center;font:700 11px monospace;font-style:normal;color:#00D9FF}
#ticketsV2 .msg .w{flex:1;min-width:0}#ticketsV2 .msg .w b{font-size:13px}#ticketsV2 .msg .w small{color:#6f8a96;font:10px monospace;margin-left:6px}#ticketsV2 .msg.staff i{background:rgba(0,217,255,.15)}#ticketsV2 .msg.staff b{color:#00D9FF}
#ticketsV2 .msg.note{background:rgba(245,158,11,.06);border-left:2px solid #f59e0b;padding-left:8px}#ticketsV2 .msg img{max-width:260px;max-height:180px;border-radius:4px;margin-top:6px;display:block}
#ticketsV2 .tk-ft{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
#ticketsV2 .tk-h{font:700 12px monospace;letter-spacing:2px;display:block;margin-bottom:6px}
#ticketsV2 .row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(0,217,255,.07);font-size:13px}#ticketsV2 .row span:first-child{color:#6f8a96;font:11px monospace;letter-spacing:1px}
#ticketsV2 .tk-tb{width:100%;border-collapse:collapse;font-size:13px}#ticketsV2 .tk-tb th{text-align:left;font:10px monospace;letter-spacing:1.5px;color:#6f8a96;padding:8px;border-bottom:1px solid rgba(0,217,255,.18)}#ticketsV2 .tk-tb td{padding:8px;border-bottom:1px solid rgba(0,217,255,.07);vertical-align:top}
#ticketsV2 .tk-form td{background:rgba(0,217,255,.05)}#ticketsV2 .tk-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}#ticketsV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:4px 0 6px}#ticketsV2 .tk-add{width:auto;padding:4px 8px;font-size:11px}
@media(max-width:1200px){#ticketsV2 .tk-g{grid-template-columns:260px minmax(0,1fr)}#ticketsV2 .tk-g>div:last-child{grid-column:1/-1}}
@media(max-width:800px){#ticketsV2 .tk-g,#ticketsV2 .tk-kpi,#ticketsV2 .tk-3{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("tickets-v2", CSS);
  onAccess((me) => { acc = me?.access || {}; if (root) draw(); });
  root = mountPanel("panel-tickets", "ticketsV2", () => load().catch((e) => notify("TICKETS LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
