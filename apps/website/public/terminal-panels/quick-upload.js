/**
 * DISCORD → Quick Upload (approved mock 2026-11-10). Access: "qu".
 * Drop up to 10 images → uploaded to Cloudinary (folder 505th_discord) → queued as `quick.upload`
 * → Cortana posts them in ONE message (505 embed / grid / plain). Optional: also add to the website Gallery
 * (needs Gallery access). The post is listed in Send Message → Recently sent (delete from there).
 */
import { addDoc, collection, doc, getDoc, getDocs } from "/terminal-shim/firestore.js";
import { onAccess } from "./nav-v2.js";
import { addCss, audit, db, esc, mountPanel, notify, onReady, uploadImage } from "./_common.js";

const MAX = 10, MAX_MB = 8;
const STYLES = [["embed", "505 EMBED (CAPTION + CREDIT)"], ["grid", "GALLERY GRID"], ["plain", "PLAIN IMAGES"]];
let chans = [], ops = [], files = [], acc = {}, root = null, busy = false;
let v = { channelId: "", style: "embed", op: "", caption: "", credit: "", gallery: true };

const isImg = (f) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type);
function addFiles(list) {
  const bad = [];
  for (const f of list) {
    if (files.length >= MAX) { bad.push(`only ${MAX} images per post`); break; }
    if (!isImg(f)) { bad.push(`${f.name}: not an image`); continue; }
    if (f.size > MAX_MB * 1048576) { bad.push(`${f.name}: over ${MAX_MB} MB`); continue; }
    files.push({ f, url: URL.createObjectURL(f), pct: 0, st: "" });
  }
  if (bad.length) notify("SKIPPED — " + bad.join(" · ").toUpperCase(), 1);
  draw();
}
const problem = () => (!files.length ? "Add at least one image." : !v.channelId ? "Pick a channel." : "");

function chanOptions() {
  const list = chans.filter((c) => c.type === "text" || c.type === "announcement").sort((a, b) => (a.position || 0) - (b.position || 0));
  const g = new Map();
  for (const c of list) { const k = c.parentName || "NO CATEGORY"; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  return `<option value="">— pick a channel —</option>${[...g].map(([k, cs]) => `<optgroup label="${esc(k.toUpperCase())}">${cs.map((c) => `<option value="${c.id}" ${c.id === v.channelId ? "selected" : ""} ${c.botCanSend ? "" : "disabled"}># ${esc(c.name)}</option>`).join("")}</optgroup>`).join("")}`;
}

function preview() {
  if (!files.length) return '<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div><div class="pl" style="color:#949ba4">Add images to see the post.</div></div>';
  const imgs = files.slice(0, 4).map((x) => `<img src="${x.url}" alt="">`).join("");
  const grid = `<div class="qg n${Math.min(files.length, 4)}">${imgs}</div>${files.length > 4 ? `<div class="f">+${files.length - 4} more</div>` : ""}`;
  if (v.style === "plain") return `<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div>${v.caption ? `<div class="pl">${esc(v.caption)}</div>` : ""}<div class="pl">${grid}</div></div>`;
  if (v.style === "grid") return `<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div>${v.caption ? `<div class="pl">${esc(v.caption)}</div>` : ""}<div class="e" style="--ec:#00D9FF">${grid}</div></div>`;
  return `<div class="dc"><div class="h"><i></i><b>Cortana</b><span class="ap">APP</span></div><div class="e" style="--ec:#00D9FF"><div class="t">📸 ${esc(v.op || "505th Expeditionary Force")}</div>${v.caption ? `<div>${esc(v.caption)}</div>` : ""}${grid}<div class="f">${esc([v.credit, `${files.length} image${files.length > 1 ? "s" : ""}`, "505th Expeditionary Force"].filter(Boolean).join(" · "))}</div></div></div>`;
}

function draw() {
  if (!acc.qu) { root.innerHTML = '<div class="panel-title">QUICK UPLOAD</div><div class="empty">You don\'t have Quick Upload access.</div>'; return; }
  const p = problem();
  root.innerHTML = `<div class="panel-title">QUICK UPLOAD</div><div class="qu-sub">DROP SCREENSHOTS → CORTANA POSTS THEM IN ONE MESSAGE · CAN ALSO GO TO THE GALLERY</div>
  <div class="qu-g2"><div class="qu-card">
    <label class="qu-drop" tabindex="0" id="quDrop"><input type="file" id="quFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
      ⇪ DROP UP TO ${MAX} IMAGES HERE<br><small>or click to choose · PNG / JPG / WEBP / GIF · max ${MAX_MB} MB each</small></label>
    ${files.length ? `<div class="qu-th">${files.map((x, i) => `<div class="qt ${x.st}"><img src="${x.url}" alt="${esc(x.f.name)}">${x.st === "up" ? `<span class="pc">${x.pct}%</span>` : x.st === "ok" ? '<span class="pc ok">✓</span>' : x.st === "err" ? '<span class="pc er">✕</span>' : ""}${busy ? "" : `<button data-rm="${i}" aria-label="Remove ${esc(x.f.name)}">✕</button>`}</div>`).join("")}</div>` : ""}
    <label class="lbl" for="quCh">POST TO</label><select class="fld" id="quCh" data-k="channelId">${chanOptions()}</select>
    <span class="lbl">STYLE</span><div class="chips" role="radiogroup">${STYLES.map(([k, l]) => `<button class="ch ${v.style === k ? "on" : ""}" role="radio" aria-checked="${v.style === k}" data-style="${k}">${l}</button>`).join("")}</div>
    ${v.style === "embed" ? `<label class="lbl" for="quOp">OPERATION (OPTIONAL)</label><select class="fld" id="quOp" data-k="op"><option value="">— none —</option>${ops.map((o) => `<option ${o.label === v.op ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>` : ""}
    <label class="lbl" for="quCap">CAPTION</label><input class="fld" id="quCap" data-k="caption" maxlength="1000" value="${esc(v.caption)}" placeholder="e.g. Pelican insertion at LZ Bravo">
    ${v.style === "embed" ? `<label class="lbl" for="quCr">CREDIT</label><input class="fld" id="quCr" data-k="credit" maxlength="200" value="${esc(v.credit)}" placeholder="e.g. Photo: Cpl Ravenhawk">` : ""}
    <label class="qu-chk"><input type="checkbox" id="quGal" ${v.gallery && acc.media ? "checked" : ""} ${acc.media ? "" : "disabled"}> Also add to the website Gallery${acc.media ? "" : " (needs Gallery access)"}</label>
    <div class="qu-ft"><span class="qu-err" role="status">${p ? "▲ " + esc(p) : ""}</span><button class="b gold" data-x="post" ${p || busy ? "disabled" : ""}>${busy ? "UPLOADING…" : `POST ${files.length || ""} IMAGE${files.length === 1 ? "" : "S"}`}</button></div>
  </div>
  <div><span class="lbl" style="margin-top:0">LIVE PREVIEW</span><div id="quPrev">${preview()}</div></div></div>`;
}
const redraw = () => { const e = root.querySelector("#quPrev"); if (e) e.innerHTML = preview(); const b = root.querySelector('[data-x="post"]'), p = problem(); if (b) b.disabled = !!p || busy; const er = root.querySelector(".qu-err"); if (er) er.textContent = p ? "▲ " + p : ""; };

async function post() {
  if (problem() || busy) return;
  busy = true;
  draw();
  const urls = [];
  try {
    for (const x of files) {
      x.st = "up";
      draw();
      try {
        const r = await uploadImage(x.f, "505th_discord", (pct) => { x.pct = pct; const el = root.querySelectorAll(".qt .pc")[files.indexOf(x)]; if (el) el.textContent = pct + "%"; });
        x.st = "ok";
        urls.push(r.secure_url);
      } catch (e) {
        x.st = "err";
        throw new Error(`${x.f.name}: ${e.message}`);
      }
    }
    const job = await addDoc(collection(db, "bot_jobs"), { type: "quick.upload", createdAtISO: new Date().toISOString(), payload: { channelId: v.channelId, images: urls, style: v.style, caption: v.caption.trim(), credit: v.credit.trim(), op: v.style === "embed" ? v.op : "" } });
    if (v.gallery && acc.media) {
      for (const [i, u] of urls.entries()) await addDoc(collection(db, "media"), { type: "image", url: u, name: (v.caption || v.op || files[i].f.name).slice(0, 100), description: [v.op, v.credit].filter(Boolean).join(" · "), category: "operations", uploadedAt: new Date().toISOString(), enabled: true }).catch(() => {});
    }
    let r = null;
    const end = Date.now() + 20000;
    while (Date.now() < end) { r = (await getDoc(doc(db, "bot_jobs", job.id)).catch(() => null))?.data(); if (r && (r.status === "done" || r.status === "failed")) break; await new Promise((s) => setTimeout(s, 1000)); }
    const where = chans.find((c) => c.id === v.channelId)?.name || "";
    if (r?.status === "failed") throw new Error(r.error || "Cortana could not post it");
    await audit("discord", "QUICK UPLOAD", `${urls.length} image(s) → #${where}${v.op ? " · " + v.op : ""}`);
    notify(r?.status === "done" ? `✓ POSTED ${urls.length} IMAGE(S) TO #${where.toUpperCase()}` : "◷ UPLOADED — CORTANA POSTS IT WHEN IT'S BACK ONLINE", r?.status !== "done");
    files.forEach((x) => URL.revokeObjectURL(x.url));
    files = [];
    v = { ...v, caption: "", credit: "", op: "" };
  } catch (e) {
    notify("UPLOAD FAILED: " + e.message, 1);
  } finally {
    busy = false;
    draw();
  }
}

function wire() {
  root.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) { v[k] = e.target.value; k === "channelId" ? draw() : redraw(); } });
  root.addEventListener("change", (e) => {
    if (e.target.id === "quFile") { addFiles([...e.target.files]); e.target.value = ""; }
    if (e.target.id === "quGal") v.gallery = e.target.checked;
    if (e.target.dataset.k === "op") { v.op = e.target.value; redraw(); }
  });
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.style) { v.style = t.dataset.style; return draw(); }
    if (t.dataset.rm) { const [x] = files.splice(+t.dataset.rm, 1); URL.revokeObjectURL(x.url); return draw(); }
    if (t.dataset.x === "post") post();
  });
  root.addEventListener("keydown", (e) => { if (e.target.id === "quDrop" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); root.querySelector("#quFile").click(); } });
  root.addEventListener("dragover", (e) => { if (e.target.closest("#quDrop")) { e.preventDefault(); e.target.closest("#quDrop").classList.add("over"); } });
  root.addEventListener("dragleave", (e) => e.target.closest("#quDrop")?.classList.remove("over"));
  root.addEventListener("drop", (e) => { const d = e.target.closest("#quDrop"); if (!d) return; e.preventDefault(); d.classList.remove("over"); if (!busy) addFiles([...e.dataTransfer.files]); });
}

async function load() {
  const [cs, evs] = await Promise.all([getDocs(collection(db, "discord_channels")), getDocs(collection(db, "community_events")).catch(() => null)]);
  chans = cs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const since = Date.now() - 21 * 864e5, until = Date.now() + 7 * 864e5;
  ops = (evs?.docs || []).map((d) => d.data()).filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > since && Date.parse(e.startAtISO) < until)
    .sort((a, b) => b.startAtISO.localeCompare(a.startAtISO))
    .map((e) => ({ label: `${e.title} · ${new Date(e.startAtISO).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" })}`.slice(0, 150) }));
  if (!busy) draw();
}

const CSS = `
#quickV2 .qu-sub{color:#6f8a96;font:11px monospace;letter-spacing:1.5px;margin:-6px 0 14px}
#quickV2 .qu-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
#quickV2 .qu-card{background:rgba(0,0,0,.25);border:1px solid rgba(0,217,255,.18);padding:14px 16px}
#quickV2 .lbl{display:block;font:11px monospace;letter-spacing:1.5px;color:#6f8a96;margin:12px 0 6px}
#quickV2 .qu-drop{display:block;border:1px dashed #00D9FF;padding:26px;text-align:center;color:#cfe9f2;font:12px monospace;letter-spacing:1px;cursor:pointer}
#quickV2 .qu-drop small{color:#6f8a96}#quickV2 .qu-drop.over,#quickV2 .qu-drop:focus-visible{background:rgba(0,217,255,.08);outline:none}
#quickV2 .qu-th{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
#quickV2 .qt{position:relative;height:70px;border:1px solid rgba(0,217,255,.18)}#quickV2 .qt img{width:100%;height:100%;object-fit:cover;display:block}
#quickV2 .qt button{all:unset;cursor:pointer;position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;width:20px;height:20px;text-align:center;font-size:12px}
#quickV2 .qt .pc{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.55);font:700 12px monospace;color:#00D9FF}#quickV2 .qt .pc.ok{color:#22e07a}#quickV2 .qt .pc.er{color:#ff4d4d}
#quickV2 .chips{display:flex;gap:6px;flex-wrap:wrap}
#quickV2 .ch{all:unset;cursor:pointer;font:11px monospace;padding:5px 9px;border:1px solid rgba(0,217,255,.18);color:#cfe9f2}#quickV2 .ch.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.1)}#quickV2 .ch:focus-visible{outline:2px solid #00D9FF}
#quickV2 .qu-chk{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px}
#quickV2 .qu-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px}#quickV2 .qu-err{color:#f59e0b;font:11px monospace}
#quickV2 .dc{background:#313338;border-radius:6px;padding:14px;font-family:"Segoe UI",sans-serif;color:#dbdee1;font-size:14px}
#quickV2 .dc .h{display:flex;gap:8px;align-items:center}#quickV2 .dc .h i{width:36px;height:36px;border-radius:50%;background:#0b1a22 url(/images/logo.png) center/70% no-repeat}#quickV2 .dc .h b{color:#00d9ff;font-weight:500}#quickV2 .dc .ap{background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px}
#quickV2 .dc .pl{margin:4px 0 0 44px}
#quickV2 .dc .e{border-left:4px solid var(--ec);background:#2b2d31;padding:10px 12px;border-radius:4px;margin:6px 0 0 44px;max-width:460px}#quickV2 .dc .e .t{font-weight:700;color:#f2f3f5;margin-bottom:4px}#quickV2 .dc .f{font-size:12px;color:#949ba4;margin-top:8px}
#quickV2 .qg{display:grid;gap:4px;margin-top:8px}#quickV2 .qg img{width:100%;height:100%;object-fit:cover;border-radius:4px;display:block}
#quickV2 .qg.n1{grid-template-columns:1fr}#quickV2 .qg.n1 img{max-height:300px}#quickV2 .qg.n2{grid-template-columns:1fr 1fr;height:180px}#quickV2 .qg.n3{grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;height:220px}#quickV2 .qg.n3 img:first-child{grid-row:1/3}#quickV2 .qg.n4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:240px}
@media(max-width:1000px){#quickV2 .qu-g2{grid-template-columns:1fr}#quickV2 .qu-th{grid-template-columns:repeat(4,1fr)}}
`;

onReady(() => {
  addCss("quick-v2", CSS);
  onAccess((me) => { acc = me?.access || {}; if (root) draw(); });
  root = mountPanel("panel-quick", "quickV2", () => load().catch((e) => notify("QUICK UPLOAD LOAD FAILED: " + e.message, 1)));
  if (root) wire();
});
