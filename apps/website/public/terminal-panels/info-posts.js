/**
 * DISCORD → Info Posts (approved mock 2026-11-10). Access: "info".
 * Permanent posts (info_posts/<id>). UPDATE IN DISCORD → Cortana edits the SAME message (re-posts only if it's gone).
 * Up to 10 embeds per post, fields (reorder ▲▼), banner / thumbnail / footer, and buttons:
 *   accept (give role once) · toggle (add/remove role) · link · ticket (open a ticket type) · reply (private answer)
 * plus an optional role drop-down. History keeps the last 6 versions.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, updateDoc } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, closeModal, db, esc, getMe, memberName, mountPanel, notify, onReady, openModal } from "./_common.js";
import { ago, chanOptions, cortanaJob, discordCss, hex, loadDiscord, md, roleOptions, ukTime } from "./discord-common.js";

const COLORS = [["505", 0x194a77], ["CYAN", 0x00d9ff], ["GREEN", 0x22e07a], ["AMBER", 0xf59e0b], ["RED", 0xff4d4d]];
const BTYPES = { accept: "✅ Accept rules", toggle: "🎭 Role toggle", link: "🔗 Link", ticket: "🎫 Open ticket", reply: "💬 Private reply" };
const BSTYLES = { green: "🟢 Green", blue: "🔵 Blue", grey: "⚪ Grey", red: "🔴 Red" };
const mkEmbed = (o = {}) => ({ title: "", description: "", color: 0x194a77, fields: [], image: "", thumbnail: "logo", footer: "505th Expeditionary Force · updated {date}", ...o });
const mkBtn = (o = {}) => ({ type: "link", label: "", emoji: "", style: "grey", roleId: "", url: "https://", ticketType: "", reply: "", ...o });
const TEMPLATES = {
  rules: () => ({ name: "Server Rules", embeds: [mkEmbed({ title: "📜 Server Rules", description: "By joining the 505th you agree to these rules.", fields: [{ name: "1. Respect everyone", value: "No harassment, racism or hate.", inline: false }, { name: "2. Comms discipline", value: "Push-to-talk on ops.", inline: false }] })], buttons: [mkBtn({ type: "accept", label: "I accept the rules", emoji: "✅", style: "green" })] }),
  roles: () => ({ name: "Pick Your Roles", embeds: [mkEmbed({ title: "🎭 Pick Your Roles", description: "Click to add, click again to remove.", color: 0x00d9ff })], buttons: [mkBtn({ type: "toggle", label: "Fun Ops", emoji: "🎮" })], menu: { placeholder: "Pick your time zone…", roleIds: [], max: 1 } }),
  about: () => ({ name: "About the 505th", embeds: [mkEmbed({ title: "ℹ About the 505th", description: "Who we are and how we operate." })], buttons: [mkBtn({ label: "Website", emoji: "🌐", url: "https://www.505expeditionaryforce.com" })] }),
  links: () => ({ name: "Useful Links", embeds: [mkEmbed({ title: "🔗 Useful Links", fields: [{ name: "Website", value: "https://www.505expeditionaryforce.com", inline: true }] })], buttons: [] }),
  faq: () => ({ name: "FAQ", embeds: [mkEmbed({ title: "❓ FAQ", description: "Click a question — only you see the answer." })], buttons: [mkBtn({ type: "reply", label: "How do I join?", emoji: "❓", reply: "Sign up on the website → Enlist, then open a Recruitment ticket." })] }),
};
const blank = () => ({ name: "", channelId: "", content: "", embeds: [mkEmbed()], buttons: [], menu: null, pin: false, showOnWebsite: false });

let posts = [], types = [], chans = [], roles = [], sel = null, v = null, ei = 0, saved = "", root = null, can = false, busy = false, unsub = null;
const dirty = () => v && JSON.stringify(v) !== saved;
const statusOf = (p) => (p.discord?.missing ? ["MISSING", "er"] : p.discord?.messageId ? ["LIVE", "ok"] : ["DRAFT", "wr"]);

/* ───────── preview ───────── */
function previewEmbed(e) {
  if (!e.title && !e.description && !e.fields.length && !e.image) return "";
  const thumb = e.thumbnail === "logo" ? "url(/images/logo.png)" : /^https:/.test(e.thumbnail) ? `url(${esc(e.thumbnail)})` : "";
  const rows = []; let inl = [];
  for (const f of e.fields) { if (f.inline) { inl.push(f); continue; } if (inl.length) { rows.push(inl); inl = []; } rows.push([f]); }
  if (inl.length) rows.push(inl);
  return `<div class="e" style="--ec:${hex(e.color)}"><div style="display:flex;gap:10px"><div style="flex:1;min-width:0">${e.title ? `<div class="t">${esc(e.title)}</div>` : ""}${e.description ? `<div>${md(e.description)}</div>` : ""}
    ${rows.map((r) => (r.length > 1 ? `<div class="fg">${r.map((f) => `<div class="fl"><b>${esc(f.name)}</b>${md(f.value)}</div>`).join("")}</div>` : `<div class="fl"><b>${esc(r[0].name)}</b>${md(r[0].value)}</div>`)).join("")}</div>
    ${thumb ? `<div class="th" style="background-image:${thumb}"></div>` : ""}</div>${/^https:/.test(e.image) ? `<img class="big" src="${esc(e.image)}" alt="">` : ""}
    ${e.footer ? `<div class="f">${esc(e.footer.replace(/\{date\}/g, new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })))}</div>` : ""}</div>`;
}
function preview() {
  const bt = v.buttons.filter((b) => b.label);
  return `<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div>${v.content ? `<div class="pl">${md(v.content)}</div>` : ""}${v.embeds.map(previewEmbed).join("")}
    ${bt.length ? `<div class="bt">${bt.map((b) => `<span class="${b.type === "link" ? "" : b.style}">${esc(b.emoji)} ${esc(b.label)}${b.type === "link" ? " ↗" : ""}</span>`).join("")}</div>` : ""}
    ${v.menu ? `<div class="sel">${esc(v.menu.placeholder || "Pick…")} ▾</div>` : ""}</div>`;
}

/* ───────── checks ───────── */
function problems() {
  if (!v.name.trim()) return "Give the post a name (only staff see it).";
  if (!v.channelId) return "Pick a channel.";
  if (!v.content.trim() && !v.embeds.some((e) => e.title || e.description || e.fields.length || e.image)) return "The post is empty.";
  for (const [n, e] of v.embeds.entries()) {
    for (const f of e.fields) if (!f.name.trim() || !f.value.trim()) return `Embed ${n + 1}: every field needs a heading and text.`;
    if (e.image && !/^https:\/\/\S+$/.test(e.image)) return `Embed ${n + 1}: image link must start with https://`;
  }
  for (const b of v.buttons) {
    if (!b.label.trim()) return "Every button needs a label.";
    if (b.type === "link" && !/^https:\/\/\S+\.\S+/.test(b.url)) return `"${b.label}": link must start with https://`;
    if ((b.type === "accept" || b.type === "toggle") && !b.roleId) return `"${b.label}": pick the role it gives.`;
    if (b.type === "ticket" && !b.ticketType) return `"${b.label}": pick the ticket type.`;
    if (b.type === "reply" && !b.reply.trim()) return `"${b.label}": write the private reply.`;
  }
  if (v.buttons.length > (v.menu ? 20 : 25)) return "Too many buttons.";
  if (v.menu && !v.menu.roleIds.length) return "Role drop-down: add at least one role (or remove the drop-down).";
  return "";
}

/* ───────── draw ───────── */
function listHtml() {
  return `<div class="ip-list">${posts.map((p) => { const [s, c] = statusOf(p); return `<button class="it ${p.id === sel ? "on" : ""}" data-open="${p.id}"><span class="pill ${c}">${s}</span><span><b>${esc(p.name || "Untitled")}</b><small>${p.channelId ? "#" + esc(chans.find((x) => x.id === p.channelId)?.name || "deleted") : "no channel"} · ${p.updatedAtISO ? ago(p.updatedAtISO) : "—"}</small></span></button>`; }).join("") || '<div class="empty">No info posts yet.</div>'}
    <div class="ip-new"><button class="b" data-x="new">＋ NEW INFO POST</button><select class="fld" data-x="tpl" aria-label="Start from a template"><option value="">⧉ FROM TEMPLATE…</option><option value="rules">📜 Rules</option><option value="roles">🎭 Role picker</option><option value="about">ℹ About</option><option value="links">🔗 Links</option><option value="faq">❓ FAQ</option></select></div></div>`;
}
function editorHtml() {
  const p = posts.find((x) => x.id === sel), e = v.embeds[ei] || v.embeds[0], prob = problems(), [st, sc] = p ? statusOf(p) : ["NEW", "wr"];
  return `<div class="ip-card">
    <div class="ip-hd"><b>${sel ? "EDIT" : "NEW"} · ${esc(v.name || "Untitled")}</b><span class="pill ${sc}">${st === "LIVE" ? "● LIVE" : st}${p?.discord?.channelId ? " · #" + esc(chans.find((c) => c.id === p.discord.channelId)?.name || "") : ""}</span></div>
    ${p?.discord?.error ? `<div class="ip-warn">✕ LAST UPDATE FAILED: ${esc(p.discord.error)}</div>` : ""}${p?.discord?.missing ? '<div class="ip-warn">✕ THIS POST WAS DELETED IN DISCORD — PRESS RE-POST</div>' : ""}
    <div class="ip-2"><div><label class="lbl" for="ipN">NAME (STAFF ONLY)</label><input class="fld" id="ipN" data-k="name" maxlength="100" value="${esc(v.name)}"></div>
      <div><label class="lbl" for="ipC">CHANNEL</label><select class="fld" id="ipC" data-k="channelId">${chanOptions(chans, v.channelId)}</select></div></div>
    <label class="lbl" for="ipT">MESSAGE ABOVE (OPTIONAL)</label><input class="fld" id="ipT" data-k="content" maxlength="1900" value="${esc(v.content)}" placeholder="Plain text above the embeds">
    <span class="lbl">EMBEDS IN THIS POST (${v.embeds.length}/10)</span>
    <div class="chips">${v.embeds.map((x, n) => `<button class="ch ${n === ei ? "on" : ""}" data-ei="${n}">${n + 1}. ${esc((x.title || "Embed").slice(0, 20))}</button>`).join("")}${v.embeds.length < 10 ? '<button class="ch" data-x="addembed">＋ EMBED</button>' : ""}</div>
    ${e ? `<div class="ip-box">
      <div class="ip-2"><div><label class="lbl" for="ipEt">TITLE</label><input class="fld" id="ipEt" data-e="title" maxlength="256" value="${esc(e.title)}"></div>
        <div><span class="lbl">COLOUR</span><div class="chips">${COLORS.map(([l, c]) => `<button class="ch ${e.color === c ? "on" : ""}" data-color="${c}" style="${e.color === c ? `border-color:${hex(c)};color:${hex(c)}` : ""}">${l}</button>`).join("")}</div></div></div>
      <label class="lbl" for="ipEd">DESCRIPTION · **bold** *italic*</label><textarea class="fld" id="ipEd" data-e="description" maxlength="4000" rows="3">${esc(e.description)}</textarea>
      <span class="lbl">FIELDS (${e.fields.length}/25)</span>
      ${e.fields.map((f, n) => `<div class="ip-f"><span class="mv"><button data-fmv="${n}:-1" ${n ? "" : "disabled"} aria-label="Move up">▲</button><button data-fmv="${n}:1" ${n < e.fields.length - 1 ? "" : "disabled"} aria-label="Move down">▼</button></span>
        <input class="fld" data-f="${n}:name" maxlength="256" value="${esc(f.name)}" placeholder="Heading" aria-label="Field heading"><textarea class="fld" data-f="${n}:value" maxlength="1024" rows="1" placeholder="Text" aria-label="Field text">${esc(f.value)}</textarea>
        <label class="inl"><input type="checkbox" data-finl="${n}" ${f.inline ? "checked" : ""}> inline</label><button class="b red" data-frm="${n}" aria-label="Remove field">✕</button></div>`).join("")}
      ${e.fields.length < 25 ? '<button class="b" data-x="addfield">＋ FIELD</button>' : ""}
      <div class="ip-3"><div><label class="lbl" for="ipEi">BANNER (BIG IMAGE)</label><div style="display:flex;gap:6px"><input class="fld" id="ipEi" data-e="image" value="${esc(e.image)}" placeholder="https://…"><button class="b" data-x="gal" data-target="image">🖼</button></div></div>
        <div><span class="lbl">THUMBNAIL</span><div class="chips"><button class="ch ${e.thumbnail === "logo" ? "on" : ""}" data-thumb="logo">505 LOGO</button><button class="ch ${/^https:/.test(e.thumbnail) ? "on" : ""}" data-x="gal" data-target="thumbnail">🖼</button><button class="ch ${e.thumbnail === "none" ? "on" : ""}" data-thumb="none">NONE</button></div></div>
        <div><label class="lbl" for="ipEf">FOOTER · {date}</label><input class="fld" id="ipEf" data-e="footer" maxlength="200" value="${esc(e.footer)}"></div></div>
      ${v.embeds.length > 1 ? `<div style="text-align:right;margin-top:8px"><button class="b red" data-x="rmembed">🗑 REMOVE EMBED ${ei + 1}</button></div>` : ""}</div>` : ""}

    <span class="lbl">BUTTONS (${v.buttons.length}/${v.menu ? 20 : 25} · 5 PER ROW)</span>
    <div class="ip-box">${v.buttons.length ? `<div class="ip-b ip-bh"><span></span><span>TYPE</span><span>EMOJI · LABEL</span><span>DOES</span><span>COLOUR</span><span></span></div>` : ""}
      ${v.buttons.map((b, n) => `<div class="ip-b"><span class="mv"><button data-bmv="${n}:-1" ${n ? "" : "disabled"} aria-label="Move up">▲</button><button data-bmv="${n}:1" ${n < v.buttons.length - 1 ? "" : "disabled"} aria-label="Move down">▼</button></span>
        <select class="fld" data-b="${n}:type" aria-label="Button type">${Object.entries(BTYPES).map(([k, l]) => `<option value="${k}" ${b.type === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span style="display:flex;gap:4px"><input class="fld" style="width:52px;text-align:center" data-b="${n}:emoji" maxlength="64" value="${esc(b.emoji)}" placeholder="🙂" aria-label="Emoji"><input class="fld" data-b="${n}:label" maxlength="80" value="${esc(b.label)}" placeholder="Label" aria-label="Label"></span>
        ${b.type === "link" ? `<input class="fld" data-b="${n}:url" value="${esc(b.url)}" placeholder="https://…" aria-label="Link">`
          : b.type === "ticket" ? `<select class="fld" data-b="${n}:ticketType" aria-label="Ticket type"><option value="">— ticket type —</option>${types.map((t) => `<option value="${t.id}" ${t.id === b.ticketType ? "selected" : ""}>${esc(t.emoji || "")} ${esc(t.name)}</option>`).join("")}</select>`
          : b.type === "reply" ? `<input class="fld" data-b="${n}:reply" maxlength="1900" value="${esc(b.reply)}" placeholder="Answer only the clicker sees" aria-label="Private reply">`
          : `<select class="fld" data-b="${n}:roleId" aria-label="Role">${roleOptions(roles, b.roleId, b.type === "accept" ? "Give role…" : "Add / remove role…", { assignable: true })}</select>`}
        <select class="fld" data-b="${n}:style" ${b.type === "link" ? "disabled" : ""} aria-label="Colour">${b.type === "link" ? "<option>Grey (link)</option>" : Object.entries(BSTYLES).map(([k, l]) => `<option value="${k}" ${b.style === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button class="b red" data-brm="${n}" aria-label="Remove button">✕</button></div>`).join("")}
      ${v.buttons.length < (v.menu ? 20 : 25) ? '<button class="b" data-x="addbtn">＋ BUTTON</button>' : ""}
      <div class="ip-help"><b>✅ Accept rules</b> gives a role once · <b>🎭 Role toggle</b> click = add, again = remove · <b>🔗 Link</b> opens a website · <b>🎫 Open ticket</b> opens that ticket type · <b>💬 Private reply</b> only the clicker sees the answer · Roles with staff powers can't be given out.</div></div>

    <span class="lbl">📋 ROLE DROP-DOWN (OPTIONAL)</span>
    ${v.menu ? `<div class="ip-box"><div class="ip-2"><div><label class="lbl" for="ipMp">PLACEHOLDER</label><input class="fld" id="ipMp" data-m="placeholder" maxlength="150" value="${esc(v.menu.placeholder)}"></div>
      <div><label class="lbl" for="ipMx">HOW MANY CAN THEY PICK</label><input class="fld" type="number" id="ipMx" data-m="max" min="1" max="25" value="${v.menu.max}"></div></div>
      <span class="lbl">ROLES IN THE LIST</span><div class="chips">${v.menu.roleIds.map((r) => `<span class="ch on">@${esc(roles.find((x) => x.id === r)?.name || "deleted")} <button data-mrm="${r}" aria-label="Remove">✕</button></span>`).join("")}
      <select class="fld ip-add" data-x="menuadd">${roleOptions(roles, "", "＋ ADD ROLE", { assignable: true, exclude: v.menu.roleIds })}</select></div>
      <div style="text-align:right;margin-top:8px"><button class="b red" data-x="nomenu">REMOVE DROP-DOWN</button></div></div>` : '<button class="b" data-x="addmenu">＋ ADD ROLE DROP-DOWN</button>'}

    <span class="lbl">ALSO</span><div class="chips"><button class="ch ${v.pin ? "on" : ""}" data-x="pin" aria-pressed="${v.pin}">📌 PIN IN DISCORD</button><button class="ch ${v.showOnWebsite ? "on" : ""}" data-x="web" aria-pressed="${v.showOnWebsite}">🌐 SHOW ON WEBSITE</button></div>
    <div class="ip-ft"><div class="chips">${sel ? `<button class="ch" data-x="hist">🕘 HISTORY (${(p?.history || []).length})</button>` : ""}<button class="ch" data-x="draft" ${busy ? "disabled" : ""}>💾 SAVE DRAFT</button>${sel ? '<button class="ch danger" data-x="del">🗑 DELETE</button>' : ""}</div>
      <span class="ip-err" role="status">${prob ? "▲ " + esc(prob) : dirty() ? "UNSAVED CHANGES" : ""}</span>
      <button class="b gold" data-x="pub" ${prob || busy ? "disabled" : ""}>${busy ? "WORKING…" : p?.discord?.missing ? "RE-POST" : p?.discord?.messageId ? "UPDATE IN DISCORD" : "POST TO DISCORD"}</button></div></div>`;
}
function draw() {
  if (!can) { root.innerHTML = '<div class="panel-title">INFO POSTS</div><div class="empty">You don\'t have Info Posts access.</div>'; return; }
  const focus = document.activeElement?.closest?.("#infoV2") ? document.activeElement.id : null;
  root.innerHTML = `<div class="panel-title">INFO POSTS</div><div class="ip-sub">PERMANENT POSTS · EDIT HERE → CORTANA EDITS THE SAME DISCORD MESSAGE · NEVER RE-POSTED UNLESS IT WAS DELETED</div>
    <div class="ip-g">${listHtml()}${v ? editorHtml() : '<div class="ip-card empty">Pick a post on the left, or make a new one.</div>'}<div>${v ? `<span class="lbl" style="margin-top:0">LIVE PREVIEW</span><div id="ipPrev">${preview()}</div>` : ""}</div></div>`;
  if (focus) root.querySelector("#" + focus)?.focus();
}
const soft = () => { const pv = root.querySelector("#ipPrev"); if (pv) pv.innerHTML = preview(); const er = root.querySelector(".ip-err"), pb = root.querySelector('[data-x="pub"]'), pr = problems(); if (er) er.textContent = pr ? "▲ " + pr : dirty() ? "UNSAVED CHANGES" : ""; if (pb) pb.disabled = !!pr || busy; };

/* ───────── save / publish ───────── */
async function save() {
  const me = await getMe();
  const clean = JSON.parse(JSON.stringify(v));
  const body = { ...clean, updatedAtISO: new Date().toISOString(), updatedByName: memberName(me) };
  if (sel) {
    const old = posts.find((p) => p.id === sel);
    const prev = old ? Object.fromEntries(["name", "channelId", "content", "embeds", "buttons", "menu", "pin", "showOnWebsite", "updatedAtISO", "updatedByName"].map((k) => [k, old[k] ?? null])) : null;
    body.history = [...(prev && JSON.stringify(prev) !== "{}" ? [prev] : []), ...(old?.history || [])].slice(0, 6);
    await updateDoc(doc(db, "info_posts", sel), body);
  } else {
    const ref = await addDoc(collection(db, "info_posts"), { ...body, history: [], createdAtISO: body.updatedAtISO });
    sel = ref.id;
  }
  saved = JSON.stringify(v);
}
async function publish() {
  if (problems() || busy) return;
  busy = true; soft();
  try {
    await save();
    const r = await cortanaJob("info.publish", { postId: sel });
    await audit("discord", "INFO POST UPDATED", `${v.name} → #${chans.find((c) => c.id === v.channelId)?.name || ""}`);
    notify(r ? (r.result?.reposted ? "✓ POSTED IN DISCORD" : "✓ UPDATED IN DISCORD") : "◷ SAVED — CORTANA IS OFFLINE, IT UPDATES DISCORD WHEN BACK", !r);
  } catch (e) { notify("FAILED: " + e.message, 1); }
  busy = false; draw();
}

function pickImage(target) {
  getDocs(collection(db, "media")).then((s) => {
    const imgs = s.docs.map((d) => d.data()).filter((m) => m.type === "image" && m.url && m.enabled !== false);
    openModal(`<div class="hd"><div><h2>PICK AN IMAGE</h2><small>FROM THE WEBSITE GALLERY</small></div><button class="xx" data-close aria-label="Close">✕</button></div><div class="bd"><div class="ip-gal">${imgs.map((m) => `<button data-pick="${esc(m.url)}" aria-label="${esc(m.name || "image")}"><img src="${esc(m.url)}" alt="" loading="lazy"></button>`).join("") || '<div class="empty">No images in the Gallery.</div>'}</div></div>`, { width: 820 });
    document.getElementById("v2Modal").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (!b) return; v.embeds[ei][target] = b.dataset.pick; closeModal(); draw(); });
  }).catch((e) => notify("GALLERY FAILED: " + e.message, 1));
}
function showHistory() {
  const h = posts.find((p) => p.id === sel)?.history || [];
  openModal(`<div class="hd"><div><h2>HISTORY · ${esc(v.name)}</h2><small>LAST 6 SAVED VERSIONS · RESTORE LOADS IT INTO THE EDITOR (NOT SENT UNTIL YOU UPDATE)</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd">${h.length ? h.map((x, n) => `<div class="ip-hist"><span>${esc(ukTime(x.updatedAtISO))} · ${esc(x.updatedByName || "—")} · ${(x.embeds || []).length} embed(s), ${(x.buttons || []).length} button(s)</span><button class="b" data-restore="${n}">RESTORE</button></div>`).join("") : '<div class="empty">No older versions yet.</div>'}</div>`, { width: 640 });
  document.getElementById("v2Modal").addEventListener("click", (e) => {
    const b = e.target.closest("[data-restore]"); if (!b) return;
    const x = h[+b.dataset.restore];
    v = { ...blank(), ...Object.fromEntries(Object.entries(x).filter(([k]) => !["updatedAtISO", "updatedByName"].includes(k))) };
    ei = 0; closeModal(); draw(); notify("VERSION LOADED — PRESS UPDATE IN DISCORD TO USE IT");
  });
}

/* ───────── events ───────── */
async function leaveOk() { return !dirty() || ask({ kind: "warn", title: "DISCARD CHANGES?", body: "You have unsaved changes to this post.", go: "DISCARD", cancel: "KEEP EDITING" }); }
function wire() {
  root.addEventListener("input", (e) => {
    const t = e.target, d = t.dataset;
    if (d.k) v[d.k] = t.value;
    else if (d.e) v.embeds[ei][d.e] = t.value;
    else if (d.f) { const [n, k] = d.f.split(":"); v.embeds[ei].fields[+n][k] = t.value; }
    else if (d.b && t.tagName !== "SELECT") { const [n, k] = d.b.split(":"); v.buttons[+n][k] = t.value; }
    else if (d.m) v.menu[d.m] = d.m === "max" ? Math.max(1, Math.min(25, +t.value || 1)) : t.value;
    else return;
    if (d.e === "title") { const c = root.querySelector(`[data-ei="${ei}"]`); if (c) c.textContent = `${ei + 1}. ${(t.value || "Embed").slice(0, 20)}`; }
    soft();
  });
  root.addEventListener("change", async (e) => {
    const t = e.target, d = t.dataset;
    if (d.k === "channelId") { v.channelId = t.value; return draw(); }
    if (d.b && t.tagName === "SELECT") { const [n, k] = d.b.split(":"); v.buttons[+n][k] = t.value; return draw(); }
    if (d.finl) { v.embeds[ei].fields[+d.finl].inline = t.checked; return soft(); }
    if (d.x === "menuadd" && t.value) { v.menu.roleIds.push(t.value); return draw(); }
    if (d.x === "tpl" && t.value) { if (!(await leaveOk())) return draw(); sel = null; v = { ...blank(), ...TEMPLATES[t.value]() }; saved = ""; ei = 0; return draw(); }
  });
  root.addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const d = t.dataset;
    if (d.open) { if (d.open === sel || !(await leaveOk())) return; const p = posts.find((x) => x.id === d.open); sel = p.id; v = { ...blank(), ...JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !["id", "discord", "history", "updatedAtISO", "updatedByName", "createdAtISO"].includes(k))))) }; saved = JSON.stringify(v); ei = 0; return draw(); }
    if (d.ei) { ei = +d.ei; return draw(); }
    if (d.color) { v.embeds[ei].color = +d.color; return draw(); }
    if (d.thumb) { v.embeds[ei].thumbnail = d.thumb; return draw(); }
    if (d.fmv) { const [n, s] = d.fmv.split(":").map(Number), f = v.embeds[ei].fields, [x] = f.splice(n, 1); f.splice(n + s, 0, x); return draw(); }
    if (d.frm) { v.embeds[ei].fields.splice(+d.frm, 1); return draw(); }
    if (d.bmv) { const [n, s] = d.bmv.split(":").map(Number), [x] = v.buttons.splice(n, 1); v.buttons.splice(n + s, 0, x); return draw(); }
    if (d.brm) { v.buttons.splice(+d.brm, 1); return draw(); }
    if (d.mrm) { v.menu.roleIds = v.menu.roleIds.filter((r) => r !== d.mrm); return draw(); }
    switch (d.x) {
      case "new": if (!(await leaveOk())) return; sel = null; v = blank(); saved = ""; ei = 0; return draw();
      case "addembed": v.embeds.push(mkEmbed({ footer: "" })); ei = v.embeds.length - 1; return draw();
      case "rmembed": if (await ask({ kind: "warn", title: `REMOVE EMBED ${ei + 1}?`, go: "REMOVE", cancel: "KEEP" })) { v.embeds.splice(ei, 1); ei = 0; draw(); } return;
      case "addfield": v.embeds[ei].fields.push({ name: "", value: "", inline: false }); return draw();
      case "addbtn": v.buttons.push(mkBtn()); return draw();
      case "addmenu": v.menu = { placeholder: "Pick…", roleIds: [], max: 1 }; return draw();
      case "nomenu": v.menu = null; return draw();
      case "pin": v.pin = !v.pin; return draw();
      case "web": v.showOnWebsite = !v.showOnWebsite; return draw();
      case "gal": return pickImage(d.target);
      case "hist": return showHistory();
      case "draft": if (!v.name.trim()) return notify("GIVE THE POST A NAME FIRST", 1); busy = true; try { await save(); notify("✓ DRAFT SAVED (NOT SENT TO DISCORD)"); } catch (err) { notify("SAVE FAILED: " + err.message, 1); } busy = false; return draw();
      case "pub": return publish();
      case "del": {
        const p = posts.find((x) => x.id === sel);
        if (!p || !(await ask({ kind: "danger", title: "DELETE INFO POST?", body: "Removed from the website and Cortana deletes the Discord message.", item: p.name, warn: "THIS CANNOT BE UNDONE.", go: "DELETE" }))) return;
        try {
          if (p.discord?.messageId) await cortanaJob("info.delete", { channelId: p.discord.channelId, messageId: p.discord.messageId }, { wait: false });
          await deleteDoc(doc(db, "info_posts", p.id));
          await audit("discord", "INFO POST DELETED", p.name);
          sel = null; v = null; saved = ""; notify("✓ DELETED"); draw();
        } catch (err) { notify("DELETE FAILED: " + err.message, 1); }
      }
    }
  });
}

async function load() {
  ({ chans, roles } = await loadDiscord());
  types = (await getDocs(collection(db, "ticket_types")).catch(() => null))?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? [];
  if (!unsub) unsub = onSnapshot(collection(db, "info_posts"), (s) => {
    posts = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (!busy && !root.contains(document.activeElement)) draw();
  }, () => {});
  draw();
}

const CSS = discordCss("#infoV2") + `
#infoV2 .ip-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#infoV2 .ip-g{display:grid;grid-template-columns:250px minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:start}
#infoV2 .ip-list{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18)}
#infoV2 .ip-list .it{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:10px;align-items:center;width:100%;padding:10px;border-bottom:1px solid rgba(0,217,255,.08);border-left:2px solid transparent}
#infoV2 .ip-list .it.on{background:rgba(0,217,255,.08);border-left-color:#00D9FF}#infoV2 .ip-list .it:focus-visible{outline:2px solid #00D9FF}
#infoV2 .ip-list b{display:block;font-size:14px}#infoV2 .ip-list small{color:#6f8a96;font:11px monospace}
#infoV2 .ip-new{padding:10px;display:grid;gap:6px}
#infoV2 .pill{font:10px monospace;letter-spacing:1px;padding:2px 6px;border:1px solid rgba(0,217,255,.18);white-space:nowrap}#infoV2 .pill.ok{color:#22e07a;border-color:rgba(34,224,122,.4)}#infoV2 .pill.wr{color:#f59e0b;border-color:rgba(245,158,11,.4)}#infoV2 .pill.er{color:#ff4d4d;border-color:rgba(255,77,77,.4)}
#infoV2 .ip-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#infoV2 .ip-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;font:700 12px monospace;letter-spacing:2px}
#infoV2 .ip-warn{background:rgba(255,77,77,.08);border:1px solid rgba(255,77,77,.4);color:#ff4d4d;font:11px monospace;padding:8px;margin-top:8px}
#infoV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:12px 0 6px}
#infoV2 .ip-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}#infoV2 .ip-3{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px}
#infoV2 .ip-box{border:1px solid rgba(0,217,255,.18);padding:10px;margin-top:8px}
#infoV2 .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#infoV2 .ch{all:unset;cursor:pointer;font:11px monospace;padding:5px 9px;border:1px solid rgba(0,217,255,.18);color:#cfe9f2;display:inline-flex;gap:6px;align-items:center}
#infoV2 .ch.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}#infoV2 .ch.danger{color:#ff4d4d}#infoV2 .ch:focus-visible{outline:2px solid #00D9FF}#infoV2 .ch button{all:unset;cursor:pointer;color:#6f8a96}
#infoV2 .ip-add{width:auto;padding:4px 8px;font-size:11px}
#infoV2 .ip-f{display:grid;grid-template-columns:22px 1fr 1.4fr auto auto;gap:6px;align-items:center;margin-bottom:6px}
#infoV2 .ip-b{display:grid;grid-template-columns:22px 140px 1.2fr 1.3fr 110px auto;gap:6px;align-items:center;margin-bottom:6px}
#infoV2 .ip-bh{font:10px monospace;letter-spacing:1px;color:#6f8a96;margin-bottom:2px}
#infoV2 .mv{display:flex;flex-direction:column}#infoV2 .mv button{all:unset;cursor:pointer;font-size:9px;color:#6f8a96;line-height:1.1}#infoV2 .mv button:disabled{opacity:.25;cursor:default}#infoV2 .mv button:focus-visible{outline:1px solid #00D9FF}
#infoV2 .inl{font-size:11px;display:flex;gap:4px;align-items:center;white-space:nowrap}
#infoV2 .ip-help{font:11px/1.8 monospace;color:#6f8a96;margin-top:8px}#infoV2 .ip-help b{color:#cfe9f2;font-weight:400}
#infoV2 .ip-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid rgba(0,217,255,.18)}
#infoV2 .ip-err{color:#f59e0b;font:11px monospace;flex:1;text-align:right}
.ip-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.ip-gal button{all:unset;cursor:pointer;border:2px solid transparent}.ip-gal button:hover,.ip-gal button:focus-visible{border-color:#00D9FF}.ip-gal img{width:100%;height:100px;object-fit:cover;display:block}
.ip-hist{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,217,255,.1);font:12px monospace}
@media(max-width:1300px){#infoV2 .ip-g{grid-template-columns:230px minmax(0,1fr)}#infoV2 .ip-g>div:last-child{grid-column:1/-1}}
@media(max-width:900px){#infoV2 .ip-g,#infoV2 .ip-2,#infoV2 .ip-3{grid-template-columns:1fr}#infoV2 .ip-b{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  addCss("info-v2", CSS);
  onAccess((me) => { can = !!me?.access?.info; if (root) draw(); });
  root = mountPanel("panel-info", "infoV2", () => load().catch((e) => notify("INFO POSTS LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
