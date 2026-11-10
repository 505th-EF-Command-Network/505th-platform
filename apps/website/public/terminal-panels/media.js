/**
 * INTEL ARCHIVE v2 — GALLERY + VIDEOS (approved mocks 2026-11-09).
 * Replaces #panel-gallery and #panel-videos. Same `media` collection and fields
 * as the original ({type,url,name,description,category,uploadedAt,enabled}),
 * so the public gallery / videos pages keep working.
 *  - Gallery: signed Cloudinary uploads (server signs, secret stays on server).
 *  - Videos: YouTube links only. No uploads.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, closeModal, db, esc, mountPanel, notify, onReady, openModal, ukDate, uploadImage } from "./_common.js";
import { ask, tell } from "./_common.js";

const CATS = ["operations", "training", "events", "screenshots"];
const state = {
  image: { items: [], cat: "", vis: "", q: "", sel: new Set(), broken: new Set() },
  video: { items: [], cat: "", vis: "", q: "" },
};

const ytId = (url) => {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function load(type) {
  const snap = await getDocs(collection(db, "media"));
  state[type].items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.type === type)
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  render(type);
}

function filtered(type) {
  const s = state[type];
  return s.items.filter(
    (m) =>
      (!s.cat || (m.category || "operations") === s.cat) &&
      (!s.vis || (s.vis === "on" ? m.enabled !== false : s.vis === "off" ? m.enabled === false : s.broken?.has(m.id))) &&
      String(m.name || "").toLowerCase().includes(s.q.toLowerCase()),
  );
}

function toolbar(type) {
  const s = state[type];
  const vis = s.items.filter((m) => m.enabled !== false).length;
  return `<div class="mtools">
    <input class="in" data-f="q" placeholder="SEARCH TITLE..." value="${esc(s.q)}" aria-label="Search">
    <div class="chips">${["", ...CATS].map((c) => `<button class="chip ${s.cat === c ? "on" : ""}" data-cat="${c}">${c ? c.toUpperCase() : "ALL"}</button>`).join("")}</div>
    <select class="in" data-f="vis" aria-label="Visibility">
      <option value="">ALL (${s.items.length})</option><option value="on" ${s.vis === "on" ? "selected" : ""}>VISIBLE (${vis})</option>
      <option value="off" ${s.vis === "off" ? "selected" : ""}>HIDDEN (${s.items.length - vis})</option>
      ${type === "image" ? `<option value="broken" ${s.vis === "broken" ? "selected" : ""}>⚠ BROKEN (${s.broken.size})</option>` : ""}
    </select></div>`;
}

function render(type) {
  const root = document.getElementById(type === "image" ? "galV2" : "vidV2");
  if (!root) return;
  const s = state[type];
  const list = filtered(type);
  root.querySelector(".count").innerHTML = `${s.items.filter((m) => m.enabled !== false).length} VISIBLE <span>/ ${s.items.length} TOTAL</span>`;
  root.querySelector(".tb").innerHTML = toolbar(type);
  if (type === "image") {
    const n = s.sel.size;
    root.querySelector(".bulk").classList.toggle("show", n > 0);
    root.querySelector(".bulk .bn").textContent = `${n} SELECTED`;
    root.querySelector(".grid").innerHTML = list.length
      ? list
          .map((m) => {
            const off = m.enabled === false, bad = s.broken.has(m.id), on = s.sel.has(m.id);
            return `<div class="mc ${off ? "off" : ""} ${on ? "sel" : ""}" data-id="${m.id}">
              <label class="ck" title="Select"><input type="checkbox" data-sel="${m.id}" ${on ? "checked" : ""} aria-label="Select ${esc(m.name || "image")}"></label>
              ${bad ? '<span class="flag">⚠ BROKEN IMAGE</span>' : off ? '<span class="flag h">HIDDEN</span>' : ""}
              <button class="th" data-edit="${m.id}" aria-label="Edit ${esc(m.name || "image")}"><img src="${esc(m.url)}" loading="lazy" alt="${esc(m.name || "")}" data-img="${m.id}"></button>
              <div class="mb"><div class="mn">${esc(m.name || "Untitled")}</div><div class="mm"><span class="cat">${esc((m.category || "operations").toUpperCase())}</span>${ukDate(m.uploadedAt)}</div></div></div>`;
          })
          .join("")
      : '<div class="empty">NO IMAGES MATCH</div>';
    root.querySelectorAll("img[data-img]").forEach((img) =>
      img.addEventListener("error", () => {
        if (!s.broken.has(img.dataset.img)) {
          s.broken.add(img.dataset.img);
          render("image");
        }
      }, { once: true }),
    );
  } else {
    root.querySelector(".grid").innerHTML = list.length
      ? list
          .map((m) => {
            const id = ytId(m.url), off = m.enabled === false;
            return `<div class="mc vc ${off ? "off" : ""}">
              ${off ? '<span class="flag h">HIDDEN</span>' : ""}${!id ? '<span class="flag">⚠ NOT YOUTUBE</span>' : ""}
              <a class="th" href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="Open ${esc(m.name || "video")} on YouTube">${id ? `<img src="${ytThumb(id)}" loading="lazy" alt="">` : '<div class="nov">NO PREVIEW</div>'}<span class="play">▶</span></a>
              <div class="mb"><div class="mn">${esc(m.name || "Untitled")}</div><div class="mm"><span class="cat">${esc((m.category || "operations").toUpperCase())}</span>${ukDate(m.uploadedAt)}</div>
              <div class="ma"><button class="b sm" data-edit="${m.id}">EDIT</button><button class="b sm" data-tog="${m.id}">${off ? "SHOW" : "HIDE"}</button><button class="b sm red" data-del="${m.id}">DELETE</button></div></div></div>`;
          })
          .join("")
      : '<div class="empty">NO VIDEOS MATCH</div>';
  }
}

// ── edit drawer (both types) ─────────────────────────────────────────
function openEdit(type, id) {
  const m = state[type].items.find((x) => x.id === id);
  if (!m) return;
  openModal(
    `<div class="h1" style="font-size:18px">EDIT ${type === "image" ? "IMAGE" : "VIDEO"}</div>
    <div class="medit">
      <div class="prev">${type === "image" ? `<img src="${esc(m.url)}" alt="">` : ytId(m.url) ? `<img src="${ytThumb(ytId(m.url))}" alt="">` : ""}</div>
      <div>
        <label class="lb" for="meN">TITLE</label><input class="in" id="meN" value="${esc(m.name || "")}" maxlength="120">
        <label class="lb" for="meD">DESCRIPTION</label><textarea class="in" id="meD" rows="3" maxlength="500">${esc(m.description || "")}</textarea>
        <label class="lb" for="meC">CATEGORY</label><select class="in" id="meC">${CATS.map((c) => `<option value="${c}" ${(m.category || "operations") === c ? "selected" : ""}>${c.toUpperCase()}</option>`).join("")}</select>
        ${type === "video" ? `<label class="lb" for="meU">YOUTUBE LINK</label><input class="in" id="meU" value="${esc(m.url || "")}">` : ""}
        <label class="lb"><input type="checkbox" id="meV" ${m.enabled !== false ? "checked" : ""}> VISIBLE ON PUBLIC SITE</label>
      </div></div>
    <div class="mact"><button class="b red" data-x="del">DELETE</button><span style="flex:1"></span><button class="b" data-x="close">CANCEL</button><button class="b gold" data-x="save">SAVE</button></div>`,
    { width: 760, pad: true },
  );
  const box = document.querySelector(".v2m");
  box.addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close") return closeModal();
    if (x === "del") {
      closeModal();
      return del(type, [id]);
    }
    if (x !== "save") return;
    const patch = {
      name: box.querySelector("#meN").value.trim() || "Untitled",
      description: box.querySelector("#meD").value.trim(),
      category: box.querySelector("#meC").value,
      enabled: box.querySelector("#meV").checked,
    };
    if (type === "video") {
      const u = box.querySelector("#meU").value.trim();
      if (!ytId(u)) return notify("ENTER A VALID YOUTUBE LINK", 1);
      patch.url = u;
    }
    try {
      await updateDoc(doc(db, "media", id), patch);
      await audit("intel", `${type === "image" ? "IMAGE" : "VIDEO"} EDITED`, patch.name);
      notify("✓ SAVED");
      closeModal();
      load(type);
    } catch (err) {
      notify("SAVE FAILED: " + err.message, 1);
    }
  });
}

async function setVisible(type, ids, enabled) {
  try {
    await Promise.all(ids.map((id) => updateDoc(doc(db, "media", id), { enabled })));
    await audit("intel", enabled ? "MEDIA SHOWN" : "MEDIA HIDDEN", `${ids.length} ${type}(s)`);
    notify(enabled ? `✓ ${ids.length} VISIBLE ON SITE` : `✓ ${ids.length} HIDDEN FROM SITE`);
    if (type === "image") state.image.sel.clear();
    load(type);
  } catch (e) {
    notify("ERROR: " + e.message, 1);
  }
}

async function del(type, ids) {
  if (!(await ask({ kind: ids.length > 5 ? "big" : "danger", title: `DELETE ${ids.length} ${type === "image" ? "IMAGE" : "VIDEO"}${ids.length > 1 ? "S" : ""}?`, body: "They are removed from the gallery and the website.", warn: "THIS CANNOT BE UNDONE.", go: "DELETE" }))) return;
  try {
    const names = ids.map((id) => state[type].items.find((m) => m.id === id)?.name || id);
    await Promise.all(ids.map((id) => deleteDoc(doc(db, "media", id))));
    await audit("intel", "MEDIA DELETED", names.slice(0, 10).join(", "));
    notify(`✓ ${ids.length} DELETED`);
    if (type === "image") state.image.sel.clear();
    load(type);
  } catch (e) {
    notify("ERROR: " + e.message, 1);
  }
}

// ── gallery upload queue ─────────────────────────────────────────────
function openUpload() {
  const queue = [];
  openModal(
    `<div class="h1" style="font-size:18px">UPLOAD IMAGES</div>
    <label class="drop" id="upDrop" tabindex="0">DROP IMAGES HERE OR <u>CHOOSE FILES</u><small>JPG / PNG / WEBP · UP TO 10 MB EACH · STORED ON CLOUDINARY</small>
      <input type="file" id="upF" accept="image/*" multiple hidden></label>
    <div class="row2"><div><label class="lb" for="upC">CATEGORY (ALL FILES)</label><select class="in" id="upC">${CATS.map((c) => `<option value="${c}">${c.toUpperCase()}</option>`).join("")}</select></div>
      <div><label class="lb"><input type="checkbox" id="upV" checked> VISIBLE ON PUBLIC SITE</label></div></div>
    <div class="q" id="upQ"></div>
    <div class="mact"><span class="uqs" id="upS"></span><span style="flex:1"></span><button class="b" data-x="close">CLOSE</button><button class="b gold" data-x="go">UPLOAD</button></div>`,
    { width: 720, pad: true },
  );
  const box = document.querySelector(".v2m");
  const drawQ = () =>
    (box.querySelector("#upQ").innerHTML = queue
      .map((f, i) => `<div class="qi ${f.st}"><img src="${f.prev}" alt=""><input class="in" data-qn="${i}" value="${esc(f.name)}" ${f.st !== "wait" && f.st !== "err" ? "disabled" : ""} aria-label="Title">
        <div class="qp"><i style="width:${f.pct}%"></i></div><span class="qst">${f.st === "wait" ? "READY" : f.st === "up" ? f.pct + "%" : f.st === "ok" ? "✓ DONE" : "✕ " + esc(f.err)}</span>
        ${f.st === "wait" || f.st === "err" ? `<button class="b sm" data-qx="${i}" aria-label="Remove">✕</button>` : ""}</div>`)
      .join(""));
  const add = (files) => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 10 * 1024 * 1024) {
        notify(`${f.name}: OVER 10 MB`, 1);
        continue;
      }
      queue.push({ file: f, name: f.name.replace(/\.[^.]+$/, ""), prev: URL.createObjectURL(f), st: "wait", pct: 0 });
    }
    drawQ();
  };
  const drop = box.querySelector("#upDrop");
  box.querySelector("#upF").addEventListener("change", (e) => add(e.target.files));
  drop.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && box.querySelector("#upF").click());
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => (e.preventDefault(), drop.classList.remove("over"), add(e.dataTransfer.files)));
  box.addEventListener("input", (e) => {
    const i = e.target.dataset.qn;
    if (i != null) queue[i].name = e.target.value;
  });
  let busy = false;
  box.addEventListener("click", async (e) => {
    const qx = e.target.closest("[data-qx]");
    if (qx) {
      queue.splice(+qx.dataset.qx, 1);
      return drawQ();
    }
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close" && !busy) {
      closeModal();
      return load("image");
    }
    if (x !== "go" || busy) return;
    const todo = queue.filter((f) => f.st === "wait" || f.st === "err");
    if (!todo.length) return notify("ADD SOME IMAGES FIRST", 1);
    busy = true;
    const category = box.querySelector("#upC").value, enabled = box.querySelector("#upV").checked;
    let ok = 0;
    for (const f of todo) {
      f.st = "up";
      f.pct = 0;
      drawQ();
      try {
        const r = await uploadImage(f.file, "505th_gallery", (p) => ((f.pct = p), drawQ()));
        await addDoc(collection(db, "media"), { type: "image", url: r.secure_url, name: f.name.trim() || "Untitled", description: "", category, uploadedAt: new Date().toISOString(), enabled });
        f.st = "ok";
        f.pct = 100;
        ok++;
      } catch (err) {
        f.st = "err";
        f.err = err.message.toUpperCase().slice(0, 40);
      }
      drawQ();
    }
    busy = false;
    box.querySelector("#upS").textContent = `${ok}/${todo.length} UPLOADED`;
    if (ok) await audit("intel", "IMAGES UPLOADED", `${ok} image(s) — ${category}`);
    notify(ok === todo.length ? `✓ ${ok} IMAGE${ok > 1 ? "S" : ""} UPLOADED` : `${todo.length - ok} FAILED — RETRY OR REMOVE`, ok !== todo.length);
  });
}

// ── add video (YouTube only) ─────────────────────────────────────────
function openAddVideo() {
  openModal(
    `<div class="h1" style="font-size:18px">ADD YOUTUBE VIDEO</div>
    <label class="lb" for="avU">YOUTUBE LINK</label><input class="in" id="avU" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off">
    <div class="avp" id="avP"><span>PASTE A LINK — TITLE AND THUMBNAIL FILL IN AUTOMATICALLY</span></div>
    <label class="lb" for="avN">TITLE</label><input class="in" id="avN" maxlength="120">
    <label class="lb" for="avD">DESCRIPTION</label><textarea class="in" id="avD" rows="2" maxlength="500"></textarea>
    <div class="row2"><div><label class="lb" for="avC">CATEGORY</label><select class="in" id="avC">${CATS.map((c) => `<option value="${c}">${c.toUpperCase()}</option>`).join("")}</select></div>
      <div><label class="lb"><input type="checkbox" id="avV" checked> VISIBLE ON PUBLIC SITE</label></div></div>
    <div class="mact"><span style="flex:1"></span><button class="b" data-x="close">CANCEL</button><button class="b gold" data-x="add">ADD VIDEO</button></div>`,
    { width: 640, pad: true },
  );
  const box = document.querySelector(".v2m");
  const u = box.querySelector("#avU");
  let last = "";
  u.addEventListener("input", async () => {
    const id = ytId(u.value);
    const p = box.querySelector("#avP");
    if (!id) return (p.innerHTML = u.value.trim() ? '<span style="color:#ff4d4d">NOT A YOUTUBE LINK</span>' : "<span>PASTE A LINK — TITLE AND THUMBNAIL FILL IN AUTOMATICALLY</span>");
    if (id === last) return;
    last = id;
    p.innerHTML = `<img src="${ytThumb(id)}" alt=""><span>LOOKING UP TITLE...</span>`;
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`);
      const d = await r.json();
      if (!box.querySelector("#avN").value.trim()) box.querySelector("#avN").value = d.title || "";
      p.innerHTML = `<img src="${ytThumb(id)}" alt=""><span>✓ ${esc(d.author_name || "YOUTUBE")}</span>`;
    } catch {
      p.innerHTML = `<img src="${ytThumb(id)}" alt=""><span>COULD NOT FETCH TITLE — TYPE IT BELOW</span>`;
    }
  });
  box.addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close") return closeModal();
    if (x !== "add") return;
    const id = ytId(u.value), name = box.querySelector("#avN").value.trim();
    if (!id) return notify("ENTER A VALID YOUTUBE LINK", 1);
    if (!name) return notify("ENTER A VIDEO TITLE", 1);
    if (state.video.items.some((m) => ytId(m.url) === id)) return notify("THIS VIDEO IS ALREADY IN THE ARCHIVE", 1);
    try {
      await addDoc(collection(db, "media"), {
        type: "video", url: `https://www.youtube.com/watch?v=${id}`, name, description: box.querySelector("#avD").value.trim(),
        category: box.querySelector("#avC").value, uploadedAt: new Date().toISOString(), enabled: box.querySelector("#avV").checked,
      });
      await audit("intel", "VIDEO ADDED", name);
      notify("✓ VIDEO ADDED");
      closeModal();
      load("video");
    } catch (err) {
      notify("ERROR: " + err.message, 1);
    }
  });
}

const CSS = `
.mv2 .count{font-size:11px;letter-spacing:2px;color:var(--g)}.mv2 .count span{color:var(--d)}
.mv2 .mtools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.mv2 .mtools .in{width:auto;min-width:200px}
.mv2 .chips{display:flex;gap:4px;flex-wrap:wrap}
.mv2 .chip{border:1px solid var(--l);background:none;color:var(--d);font:inherit;font-size:10px;letter-spacing:1.5px;padding:6px 10px;cursor:pointer}
.mv2 .chip.on{color:var(--a);border-color:var(--a)}
.mv2 .grid{columns:4 230px;column-gap:12px}
.mv2.vid .grid{columns:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.mv2 .mc{break-inside:avoid;margin-bottom:12px;border:1px solid var(--l);background:var(--p);position:relative}
.mv2 .mc.off{opacity:.5}.mv2 .mc.sel{border-color:var(--a);box-shadow:0 0 0 1px var(--a)}
.mv2 .th{display:block;width:100%;padding:0;border:0;background:#000;cursor:pointer;position:relative}
.mv2 .th img{display:block;width:100%;height:auto}
.mv2.vid .th img{aspect-ratio:16/9;object-fit:cover}
.mv2 .play{position:absolute;inset:0;margin:auto;width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;display:grid;place-items:center;font-size:18px}
.mv2 .nov{aspect-ratio:16/9;display:grid;place-items:center;color:var(--d);font-size:10px;letter-spacing:2px}
.mv2 .ck{position:absolute;top:8px;left:8px;z-index:3;background:rgba(0,0,0,.7);padding:3px 4px;line-height:0}
.mv2 .ck input{width:16px;height:16px;accent-color:#00D9FF;cursor:pointer}
.mv2 .flag{position:absolute;top:8px;right:8px;z-index:3;background:#ff4d4d;color:#000;font-size:9px;letter-spacing:1.5px;padding:2px 6px}
.mv2 .flag.h{background:#f59e0b}
.mv2 .mb{padding:8px 10px}.mv2 .mn{font-family:Rajdhani,sans-serif;font-weight:700;font-size:13.5px;color:#fff}
.mv2 .mm{display:flex;gap:8px;align-items:center;font-size:9.5px;color:var(--d);margin-top:4px;letter-spacing:1px}
.mv2 .cat{border:1px solid var(--l2);color:var(--a);padding:1px 5px;letter-spacing:1.5px}
.mv2 .ma{display:flex;gap:6px;margin-top:8px}
.mv2 .b.sm{padding:4px 9px;font-size:10px}.mv2 .b.red,.v2m .b.red{color:#ff4d4d;border-color:rgba(255,77,77,.5)}
.mv2 .bulk{position:sticky;bottom:10px;z-index:5;display:none;gap:8px;align-items:center;border:1px solid var(--a);background:#06141a;padding:10px 14px;font-size:11px;letter-spacing:2px;color:var(--a);margin-top:10px}
.mv2 .bulk.show{display:flex}
.v2m .lb{display:block;font-size:9.5px;letter-spacing:2px;color:var(--d);margin:12px 0 5px}
.v2m .medit{display:grid;grid-template-columns:240px 1fr;gap:16px;margin-top:12px}.v2m .medit .prev img{width:100%;border:1px solid var(--l)}
.v2m .mact{display:flex;gap:8px;align-items:center;margin-top:16px}
.v2m .drop{display:block;border:1px dashed var(--l2);padding:28px;text-align:center;font-size:12px;letter-spacing:2px;color:var(--a);cursor:pointer;margin-top:12px}
.v2m .drop.over{background:rgba(0,217,255,.07);border-color:var(--a)}
.v2m .drop small{display:block;margin-top:6px;color:var(--d);font-size:9.5px}
.v2m .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end}
.v2m .q{max-height:300px;overflow:auto;margin-top:12px}
.v2m .qi{display:grid;grid-template-columns:48px 1fr 90px 70px auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.v2m .qi img{width:48px;height:36px;object-fit:cover}.v2m .qp{height:5px;background:rgba(255,255,255,.08)}.v2m .qp i{display:block;height:100%;background:#00D9FF}
.v2m .qi.ok .qp i{background:#22e07a}.v2m .qi.err .qst{color:#ff4d4d}.v2m .qst{font-size:9.5px;letter-spacing:1px;color:var(--d)}
.v2m .uqs{font-size:10.5px;letter-spacing:1.5px;color:var(--g)}
.v2m .avp{display:flex;gap:10px;align-items:center;margin-top:8px;font-size:10px;letter-spacing:1.5px;color:var(--d)}.v2m .avp img{width:120px;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--l)}
@media(max-width:700px){.v2m .medit,.v2m .row2{grid-template-columns:1fr}}
`;

function mount(type) {
  const panel = type === "image" ? "panel-gallery" : "panel-videos";
  const rootId = type === "image" ? "galV2" : "vidV2";
  const root = mountPanel(panel, rootId, () => load(type).catch((e) => notify("MEDIA LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  root.classList.add("mv2");
  if (type === "video") root.classList.add("vid");
  root.innerHTML = `
    <div class="bar"><div><div class="h1">${type === "image" ? "GALLERY" : "VIDEOS"}</div>
      <div class="sub" style="margin:4px 0 0">${type === "image" ? "PHOTOS SHOWN ON THE PUBLIC GALLERY PAGE — CLICK A PHOTO TO EDIT" : "YOUTUBE VIDEOS SHOWN ON THE PUBLIC VIDEOS PAGE"}</div></div>
      <span class="sp"></span><span class="count"></span><button class="b gold" data-act="add">${type === "image" ? "⇪ UPLOAD IMAGES" : "+ ADD YOUTUBE LINK"}</button></div>
    <div class="tb"></div><div class="grid"><div class="empty">LOADING...</div></div>
    ${type === "image" ? '<div class="bulk"><span class="bn"></span><span style="flex:1"></span><button class="b" data-bulk="show">SHOW</button><button class="b" data-bulk="hide">HIDE</button><button class="b red" data-bulk="del">DELETE</button><button class="b" data-bulk="clear">CLEAR</button></div>' : ""}`;
  const s = state[type];
  root.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    s[f] = e.target.value;
    if (f === "q") {
      const pos = e.target.selectionStart;
      render(type);
      const el = root.querySelector('[data-f="q"]');
      el.focus();
      el.setSelectionRange(pos, pos);
    } else render(type);
  });
  root.addEventListener("change", (e) => {
    const id = e.target.dataset.sel;
    if (!id) return;
    e.target.checked ? s.sel.add(id) : s.sel.delete(id);
    render(type);
  });
  root.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-cat]")) return ((s.cat = t.closest("[data-cat]").dataset.cat), render(type));
    if (t.closest("[data-act='add']")) return type === "image" ? openUpload() : openAddVideo();
    if (t.closest("[data-edit]")) return openEdit(type, t.closest("[data-edit]").dataset.edit);
    if (t.closest("[data-tog]")) {
      const id = t.closest("[data-tog]").dataset.tog;
      return setVisible(type, [id], s.items.find((m) => m.id === id)?.enabled === false);
    }
    if (t.closest("[data-del]")) return del(type, [t.closest("[data-del]").dataset.del]);
    const bk = t.closest("[data-bulk]")?.dataset.bulk;
    if (bk === "clear") return (s.sel.clear(), render(type));
    if (bk === "show" || bk === "hide") return setVisible(type, [...s.sel], bk === "show");
    if (bk === "del") return del(type, [...s.sel]);
  });
}

onReady(() => {
  addCss("mediaV2", CSS);
  mount("image");
  mount("video");
});
