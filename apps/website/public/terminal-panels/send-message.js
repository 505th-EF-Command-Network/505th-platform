/**
 * DISCORD → Send Message (approved mock 2026-11-10). Access: "send".
 * Compose plain text or a 505th embed, pick channel + pings, live Discord preview.
 * Queued as bot_jobs message.send / message.edit / message.delete; Cortana posts as itself.
 * Sent messages are listed from discord_messages (written by Cortana only) with Edit / Delete.
 */
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, ask, audit, closeModal, db, esc, mountPanel, notify, onReady, openModal } from "./_common.js";

const COLORS = [["505 BLUE", 0x194a77], ["CYAN", 0x00d9ff], ["GREEN", 0x22e07a], ["AMBER", 0xf59e0b], ["RED", 0xff4d4d]];
const hex = (n) => "#" + Number(n).toString(16).padStart(6, "0");
const blank = () => ({ channelId: "", kind: "embed", content: "", title: "", description: "", color: 0x194a77, image: "", thumbnail: true, buttons: [], everyone: false, roles: [], runAt: "" });

let chans = [], roles = [], sent = [], media = [], v = blank(), editing = null, root = null, can = false, unsub = null, busy = false;
const chan = (id) => chans.find((c) => c.id === id);
const role = (id) => roles.find((r) => r.id === id);

/* ───────── markdown-ish preview (bold, italic, code, newlines) ───────── */
const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");

function chanOptions(cur) {
  const list = chans.filter((c) => (c.type === "text" || c.type === "announcement")).sort((a, b) => (a.position || 0) - (b.position || 0));
  const g = new Map();
  for (const c of list) { const k = c.parentName || "NO CATEGORY"; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  return `<option value="">— pick a channel —</option>${[...g].map(([k, cs]) => `<optgroup label="${esc(k.toUpperCase())}">${cs.map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""} ${c.botCanSend ? "" : "disabled"}># ${esc(c.name)}${c.botCanSend ? "" : " (Cortana can't post)"}</option>`).join("")}</optgroup>`).join("")}`;
}

function preview() {
  const pings = [v.everyone ? "@everyone" : "", ...v.roles.map((r) => "@" + (role(r)?.name || "role"))].filter(Boolean);
  const emb = v.kind === "embed" && (v.title || v.description || v.image);
  return `<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div>
    ${pings.length && !editing ? `<div class="pl">${pings.map((p) => `<span class="mn">${esc(p)}</span>`).join(" ")}</div>` : ""}
    ${v.content ? `<div class="pl">${md(v.content)}</div>` : ""}
    ${emb ? `<div class="e" style="--ec:${hex(v.color)}"><div style="display:flex;gap:10px"><div style="flex:1;min-width:0">${v.title ? `<div class="t">${esc(v.title)}</div>` : ""}${v.description ? `<div>${md(v.description)}</div>` : ""}</div>${v.thumbnail ? '<div class="th"></div>' : ""}</div>${v.image ? `<img src="${esc(v.image)}" alt="">` : ""}<div class="f">505th Expeditionary Force · sent by you</div></div>` : ""}
    ${v.buttons.filter((b) => b.label).length ? `<div class="bt">${v.buttons.filter((b) => b.label).map((b) => `<span>${esc(b.label)} ↗</span>`).join("")}</div>` : ""}
    ${!v.content && !emb ? '<div class="pl" style="color:#949ba4">Nothing to send yet.</div>' : ""}</div>`;
}

function problems() {
  if (!editing && !v.channelId) return "Pick a channel.";
  if (v.kind === "text" && !v.content.trim()) return "Type a message.";
  if (v.kind === "embed" && !v.title.trim() && !v.description.trim() && !v.image) return "Add a title, message or image.";
  if (v.image && !/^https:\/\//.test(v.image)) return "Image link must start with https://";
  for (const b of v.buttons) if (b.label || b.url) { if (!b.label.trim()) return "A button needs a label."; if (!/^https:\/\/\S+$/.test(b.url)) return `Button "${b.label}" needs an https:// link.`; }
  if (v.runAt && Date.parse(v.runAt) < Date.now() - 60000) return "Schedule time is in the past.";
  return "";
}

function draw() {
  if (!can) { root.innerHTML = '<div class="panel-title">SEND MESSAGE</div><div class="empty">You don\'t have Send Message access.</div>'; return; }
  const p = problems();
  const roleOpts = roles.filter((r) => !r.managed && !v.roles.includes(r.id)).sort((a, b) => (b.position || 0) - (a.position || 0)).map((r) => `<option value="${r.id}" ${r.color && r.color !== "#000000" ? `data-color="${r.color}"` : ""}>@${esc(r.name)}</option>`).join("");
  root.innerHTML = `<div class="panel-title">SEND MESSAGE</div><div class="sm-sub">POST OR EDIT A MESSAGE AS CORTANA · PLAIN TEXT OR EMBED · LIVE PREVIEW</div>
  <div class="sm-g2"><div class="sm-card">
    ${editing ? `<div class="sm-edit">✎ EDITING A MESSAGE IN #${esc(editing.channelName || "")} · PINGS ARE NOT SENT AGAIN <button class="b" data-x="stopedit">CANCEL EDIT</button></div>` : `
    <label class="lbl" for="smCh">CHANNEL</label><select class="fld" id="smCh" data-k="channelId">${chanOptions(v.channelId)}</select>
    ${!chans.length ? '<p class="hint">No channels yet — Cortana syncs them when it starts.</p>' : ""}`}
    <span class="lbl">TYPE</span><div class="chips" role="radiogroup">${[["text", "TEXT"], ["embed", "EMBED"]].map(([k, l]) => `<button class="ch ${v.kind === k ? "on" : ""}" role="radio" aria-checked="${v.kind === k}" data-kind="${k}">${l}</button>`).join("")}</div>
    ${editing ? "" : `<span class="lbl">PING</span><div class="chips">
      <button class="ch ${!v.everyone && !v.roles.length ? "on" : ""}" data-x="noping">NONE</button>
      <button class="ch ${v.everyone ? "on warn" : ""}" data-x="everyone" aria-pressed="${v.everyone}">@everyone</button>
      ${v.roles.map((r) => `<span class="ch on">@${esc(role(r)?.name || "role")} <button data-rmrole="${r}" aria-label="Remove role">✕</button></span>`).join("")}
      <select class="fld sm-add" data-x="addrole"><option value="">＋ ROLE</option>${roleOpts}</select></div>`}
    <label class="lbl" for="smC">${v.kind === "embed" ? "TEXT ABOVE THE EMBED (OPTIONAL)" : "MESSAGE · **bold** *italic*"}</label><textarea class="fld" id="smC" data-k="content" maxlength="1900" rows="${v.kind === "embed" ? 2 : 6}">${esc(v.content)}</textarea>
    ${v.kind === "embed" ? `
      <label class="lbl" for="smT">TITLE</label><input class="fld" id="smT" data-k="title" maxlength="256" value="${esc(v.title)}">
      <label class="lbl" for="smD">MESSAGE · **bold** *italic*</label><textarea class="fld" id="smD" data-k="description" maxlength="4000" rows="6">${esc(v.description)}</textarea>
      <div class="sm-2"><div><span class="lbl">COLOUR</span><div class="chips">${COLORS.map(([l, c]) => `<button class="ch ${v.color === c ? "on" : ""}" data-color="${c}" style="${v.color === c ? `border-color:${hex(c)};color:${hex(c)}` : ""}">${l}</button>`).join("")}</div></div>
      <div><span class="lbl">505 LOGO (SMALL, TOP RIGHT)</span><button class="ch ${v.thumbnail ? "on" : ""}" data-x="thumb" aria-pressed="${v.thumbnail}">${v.thumbnail ? "ON" : "OFF"}</button></div></div>
      <label class="lbl" for="smI">IMAGE (OPTIONAL)</label><div style="display:flex;gap:6px"><input class="fld" id="smI" data-k="image" value="${esc(v.image)}" placeholder="https://… or pick from the Gallery"><button class="b" data-x="gallery">🖼 GALLERY</button>${v.image ? '<button class="b" data-x="noimg" aria-label="Remove image">✕</button>' : ""}</div>` : ""}
    <span class="lbl">LINK BUTTONS (OPTIONAL · UP TO 5)</span>
    ${v.buttons.map((b, i) => `<div class="sm-btn"><input class="fld" data-b="${i}:label" maxlength="80" value="${esc(b.label)}" placeholder="Label" aria-label="Button label"><input class="fld" data-b="${i}:url" value="${esc(b.url)}" placeholder="https://…" aria-label="Button link"><button class="b" data-rmb="${i}" aria-label="Remove button">✕</button></div>`).join("")}
    ${v.buttons.length < 5 ? '<button class="b" data-x="addbtn">＋ BUTTON</button>' : ""}
    ${editing ? "" : `<label class="lbl" for="smR">⏰ SCHEDULE (OPTIONAL · UK TIME)</label><input class="fld" type="datetime-local" id="smR" data-k="runAt" value="${esc(v.runAt)}" style="max-width:260px">`}
    <div class="sm-ft"><span class="sm-err" role="status">${p ? "▲ " + esc(p) : ""}</span><div style="display:flex;gap:8px"><button class="b" data-x="clear">CLEAR</button>
      <button class="b gold" data-x="send" ${p || busy ? "disabled" : ""}>${busy ? "SENDING…" : editing ? "SAVE EDIT" : v.runAt ? "SCHEDULE" : "SEND AS CORTANA"}</button></div></div>
  </div>
  <div><span class="lbl" style="margin-top:0">LIVE PREVIEW</span><div id="smPrev">${preview()}</div>
    <div class="sm-card" style="margin-top:16px;padding:0"><div class="sm-hd">RECENTLY SENT</div>
    ${sent.length ? `<table class="sm-tb"><thead><tr><th>MESSAGE</th><th>CHANNEL</th><th>BY</th><th>WHEN</th><th></th></tr></thead><tbody>${sent.slice(0, 15).map((m) => `<tr><td>${esc((m.embed?.title || m.content || "(image)").slice(0, 50))}</td><td>#${esc(m.channelName || "")}</td><td>${esc(m.sentByName || "")}</td><td>${esc(new Date(m.sentAtISO).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))}</td>
      <td style="white-space:nowrap">${m.jumpUrl ? `<a class="b" href="${esc(m.jumpUrl)}" target="_blank" rel="noopener" aria-label="Open in Discord">↗</a> ` : ""}${m.kind === "upload" ? "" : `<button class="b" data-edit="${m.id}">EDIT</button> `}<button class="b red" data-del="${m.id}" aria-label="Delete">🗑</button></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Nothing sent from the website yet.</div>'}</div></div></div>`;
}
const redrawPreview = () => {
  const el = root.querySelector("#smPrev");
  if (el) el.innerHTML = preview();
  const p = problems(), s = root.querySelector('[data-x="send"]'), e = root.querySelector(".sm-err");
  if (s) s.disabled = !!p || busy;
  if (e) e.textContent = p ? "▲ " + p : "";
};

async function waitJob(id, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const d = (await getDoc(doc(db, "bot_jobs", id)).catch(() => null))?.data();
    if (d && (d.status === "done" || d.status === "failed")) return d;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function send() {
  if (problems() || busy) return;
  if (!editing && v.everyone && !(await ask({ kind: "warn", title: "PING @EVERYONE?", body: "This notifies every member of the Discord server.", go: "YES, PING EVERYONE", cancel: "GO BACK" }))) return;
  const body = {
    content: v.content,
    embed: v.kind === "embed" ? { title: v.title.trim(), description: v.description, color: v.color, image: v.image.trim(), thumbnail: v.thumbnail } : null,
    buttons: v.buttons.filter((b) => b.label.trim()).map((b) => ({ label: b.label.trim(), url: b.url.trim() })),
  };
  busy = true;
  redrawPreview();
  try {
    const job = await addDoc(collection(db, "bot_jobs"), editing
      ? { type: "message.edit", createdAtISO: new Date().toISOString(), payload: { recordId: editing.id, ...body } }
      : { type: "message.send", createdAtISO: new Date().toISOString(), ...(v.runAt ? { runAtISO: new Date(v.runAt).toISOString() } : {}), payload: { channelId: v.channelId, ping: { everyone: v.everyone, roles: v.roles }, ...body } });
    const where = editing ? editing.channelName : chan(v.channelId)?.name;
    if (v.runAt && !editing) {
      await audit("discord", "MESSAGE SCHEDULED", `#${where} · ${new Date(v.runAt).toLocaleString("en-GB")}`);
      notify("✓ SCHEDULED — CORTANA SENDS IT AT THAT TIME");
    } else {
      const r = await waitJob(job.id);
      if (!r) notify("◷ CORTANA IS OFFLINE — IT WILL BE SENT WHEN CORTANA IS BACK", 1);
      else if (r.status === "failed") throw new Error(r.error || "Cortana could not send it");
      else notify(editing ? "✓ MESSAGE UPDATED IN DISCORD" : "✓ SENT TO #" + String(where || "").toUpperCase());
      await audit("discord", editing ? "MESSAGE EDITED" : "MESSAGE SENT", `#${where} · ${(body.embed?.title || body.content).slice(0, 80)}`);
    }
    v = blank();
    editing = null;
  } catch (e) {
    notify("SEND FAILED: " + e.message, 1);
  } finally {
    busy = false;
    draw();
  }
}

async function pickGallery() {
  if (!media.length) media = (await getDocs(collection(db, "media"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.type === "image" && m.url && m.enabled !== false);
  openModal(`<div class="hd"><div><h2>PICK AN IMAGE</h2><small>FROM THE WEBSITE GALLERY</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="sm-gal">${media.length ? media.map((m) => `<button data-pick="${esc(m.url)}" aria-label="${esc(m.name || "image")}"><img src="${esc(m.url)}" alt="" loading="lazy"></button>`).join("") : '<div class="empty">No images in the Gallery yet.</div>'}</div></div>`, { width: 820 });
  document.getElementById("v2Modal").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    v.image = b.dataset.pick;
    closeModal();
    draw();
  });
}

function wire() {
  root.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) { v[k] = e.target.value; if (k === "channelId") return draw(); return redrawPreview(); }
    const b = e.target.dataset.b;
    if (b) { const [i, f] = b.split(":"); v.buttons[+i][f] = e.target.value; redrawPreview(); }
  });
  root.addEventListener("change", (e) => {
    if (e.target.dataset.x === "addrole" && e.target.value) { v.roles.push(e.target.value); draw(); }
  });
  root.addEventListener("click", async (e) => {
    const t = e.target.closest("button,[data-x]");
    if (!t) return;
    if (t.dataset.kind) { v.kind = t.dataset.kind; return draw(); }
    if (t.dataset.color) { v.color = +t.dataset.color; return draw(); }
    if (t.dataset.rmrole) { v.roles = v.roles.filter((r) => r !== t.dataset.rmrole); return draw(); }
    if (t.dataset.rmb) { v.buttons.splice(+t.dataset.rmb, 1); return draw(); }
    if (t.dataset.edit) {
      const m = sent.find((x) => x.id === t.dataset.edit);
      if (!m) return;
      editing = m;
      v = { ...blank(), channelId: m.channelId, kind: m.embed ? "embed" : "text", content: m.content || "", title: m.embed?.title || "", description: m.embed?.description || "", color: m.embed?.color ?? 0x194a77, image: m.embed?.image || "", thumbnail: m.embed?.thumbnail !== false, buttons: (m.buttons || []).map((b) => ({ ...b })) };
      root.scrollIntoView({ behavior: "smooth" });
      return draw();
    }
    if (t.dataset.del) {
      const m = sent.find((x) => x.id === t.dataset.del);
      if (!m || !(await ask({ kind: "danger", title: "DELETE MESSAGE?", body: "Cortana deletes it from Discord.", item: m.embed?.title || m.content?.slice(0, 60) || "message", go: "DELETE" }))) return;
      await addDoc(collection(db, "bot_jobs"), { type: "message.delete", createdAtISO: new Date().toISOString(), payload: { recordId: m.id } });
      await audit("discord", "MESSAGE DELETED", `#${m.channelName} · ${(m.embed?.title || m.content || "").slice(0, 80)}`);
      return notify("✓ DELETING FROM DISCORD");
    }
    switch (t.dataset.x) {
      case "noping": v.everyone = false; v.roles = []; return draw();
      case "everyone": v.everyone = !v.everyone; return draw();
      case "thumb": v.thumbnail = !v.thumbnail; return draw();
      case "gallery": return pickGallery().catch((err) => notify("GALLERY FAILED: " + err.message, 1));
      case "noimg": v.image = ""; return draw();
      case "addbtn": v.buttons.push({ label: "", url: "https://" }); return draw();
      case "stopedit": editing = null; v = blank(); return draw();
      case "clear": if (await ask({ kind: "warn", title: "CLEAR?", body: "Start a new message.", go: "CLEAR", cancel: "KEEP" })) { editing = null; v = blank(); draw(); } return;
      case "send": return send();
    }
  });
}

async function load() {
  const [cs, rs] = await Promise.all([getDocs(collection(db, "discord_channels")), getDocs(collection(db, "discord_roles"))]);
  chans = cs.docs.map((d) => ({ id: d.id, ...d.data() }));
  roles = rs.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!unsub) unsub = onSnapshot(collection(db, "discord_messages"), (s) => {
    sent = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.sentAtISO).localeCompare(String(a.sentAtISO)));
    if (!busy && !root.contains(document.activeElement)) draw();
    else { const tb = root.querySelector(".sm-tb"); if (!tb && sent.length) draw(); }
  }, () => {});
  draw();
}

const CSS = `
#sendV2 .sm-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#sendV2 .sm-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
#sendV2 .sm-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#sendV2 .sm-hd{padding:10px 14px;font:700 12px monospace;letter-spacing:2px}
#sendV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:12px 0 6px}
#sendV2 .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#sendV2 .ch{all:unset;cursor:pointer;font:11px monospace;padding:5px 9px;border:1px solid rgba(0,217,255,.18);color:#cfe9f2;display:inline-flex;gap:6px;align-items:center}
#sendV2 .ch.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}#sendV2 .ch.warn{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.1)}
#sendV2 .ch:focus-visible{outline:2px solid #00D9FF}#sendV2 .ch button{all:unset;cursor:pointer;color:#6f8a96}
#sendV2 .sm-add{width:auto;padding:4px 8px;font-size:11px}
#sendV2 .sm-2{display:grid;grid-template-columns:1fr auto;gap:12px}
#sendV2 .sm-btn{display:grid;grid-template-columns:1fr 1.6fr auto;gap:6px;margin-bottom:6px}
#sendV2 .sm-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap}
#sendV2 .sm-err{color:#f59e0b;font:11px monospace}
#sendV2 .sm-edit{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.35);color:#f59e0b;font:11px monospace;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
#sendV2 .sm-tb{width:100%;border-collapse:collapse;font-size:13px}#sendV2 .sm-tb th{text-align:left;font:10px monospace;letter-spacing:1.5px;color:#6f8a96;padding:8px;border-bottom:1px solid rgba(0,217,255,.18)}#sendV2 .sm-tb td{padding:8px;border-bottom:1px solid rgba(0,217,255,.07)}
#sendV2 .dc{background:#313338;border-radius:6px;padding:14px;font-family:"Segoe UI",sans-serif;color:#dbdee1;font-size:14px;line-height:1.4}
#sendV2 .dc .h{display:flex;gap:8px;align-items:center}#sendV2 .dc .h i{width:36px;height:36px;border-radius:50%;background:#0b1a22 url(/images/logo.png) center/70% no-repeat}#sendV2 .dc .h b{color:#00d9ff;font-weight:500}#sendV2 .dc .ap{background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px}
#sendV2 .dc .pl{margin:2px 0 0 44px}#sendV2 .mn{background:rgba(88,101,242,.3);color:#c9cdfb;padding:0 2px;border-radius:3px}
#sendV2 .dc .e{border-left:4px solid var(--ec);background:#2b2d31;padding:10px 12px;border-radius:4px;margin:6px 0 0 44px;max-width:460px}
#sendV2 .dc .e .t{font-weight:700;color:#f2f3f5;margin-bottom:4px}#sendV2 .dc .e .f{font-size:12px;color:#949ba4;margin-top:8px}
#sendV2 .dc .e .th{width:60px;height:60px;border-radius:4px;background:#0b1a22 url(/images/logo.png) center/85% no-repeat;flex-shrink:0}
#sendV2 .dc .e img{max-width:100%;border-radius:4px;margin-top:8px;display:block}
#sendV2 .dc code{background:#1e1f22;padding:0 3px;border-radius:3px}
#sendV2 .dc .bt{display:flex;gap:6px;margin:8px 0 0 44px;flex-wrap:wrap}#sendV2 .dc .bt span{background:#4e5058;color:#fff;padding:6px 12px;border-radius:4px;font-size:13px}
.sm-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.sm-gal button{all:unset;cursor:pointer;border:2px solid transparent}.sm-gal button:hover,.sm-gal button:focus-visible{border-color:#00D9FF}.sm-gal img{width:100%;height:100px;object-fit:cover;display:block}
@media(max-width:1000px){#sendV2 .sm-g2{grid-template-columns:1fr}}
`;

onReady(() => {
  addCss("send-v2", CSS);
  onAccess((me) => { can = !!me?.access?.send; if (root && chans) draw(); });
  root = mountPanel("panel-send", "sendV2", () => load().catch((e) => notify("SEND MESSAGE LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
