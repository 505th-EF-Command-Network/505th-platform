/**
 * WEBSITE EDITOR + COMMS LIBRARY (approved mocks 2026-11-10).
 *  - #panel-website: visual editor for settings/page_content (SAME keys and value
 *    shapes as the original: "<page>__<slot>" → {url} for photos, {value} for text/video).
 *  - #panel-comms-library: the `comms_media` photos, with where each one is used.
 * Changes are kept as a draft and go live with one "PUBLISH CHANGES".
 */
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, closeModal, db, esc, getMe, memberName, mountPanel, notify, onReady, openModal, ukDate, uploadImage } from "./_common.js";
import { ask, tell } from "./_common.js";

/* Same slot list as PAGE_SLOTS in the original terminal. */
const UNIT = (name, prefix, card, cards, url) => ({ name, prefix, card, cards, url });
const PAGES = {
  home: { name: "Home Page", home: true, url: "/home" },
  "about-505th": UNIT("505th Expeditionary Force", "marine", "Marine Card", "MARINE CARDS", "/about-505th"),
  "about-alpha": UNIT("Alpha Company", "op", "Operation Card", "OPERATION CARDS", "/about-alpha-company"),
  "about-stalker": UNIT("JTF Force Recon", "equip", "Equipment Card", "EQUIPMENT CARDS", "/about-stalker"),
  "about-corpsman": UNIT("Hospital Corpsman", "equip", "Equipment Card", "EQUIPMENT CARDS", "/about-corpsman"),
  "about-54th": UNIT("54th Air Wing", "air", "Air Asset Card", "AIR ASSET CARDS", "/about-54th-air-wing"),
};
const IMG_SLOT = /^(enlist_photo|slider_\d|marine_\d|op_\d|equip_\d|air_\d)$/;
function slots(page) {
  if (page === "home") return ["enlist_photo", "hero_video", "hero_video_description"];
  const p = PAGES[page].prefix, o = ["slider_header", "cards_header"];
  for (const i of [1, 2, 3]) o.push(`slider_${i}`, `slider_${i}_title`, `slider_${i}_desc`);
  for (const i of [1, 2, 3]) o.push(`${p}_${i}`, `${p}_${i}_title`, `${p}_${i}_desc`);
  return o;
}
const ALL_KEYS = Object.keys(PAGES).flatMap((p) => slots(p).map((s) => `${p}__${s}`));
const SLOT_LABEL = (key) => {
  const [page, slot] = key.split("__");
  const P = PAGES[page];
  if (slot === "enlist_photo") return "Home · Ready To Enlist";
  const m = slot.match(/^(slider|marine|op|equip|air)_(\d)$/);
  if (m) return `${P.name.replace("505th Expeditionary Force", "505th")} · ${m[1] === "slider" ? "Slider" : P.card.replace(" Card", "")} ${m[2]}`;
  return `${P.name} · ${slot}`;
};

let saved = {}; // page_content as stored
let draft = {}; // working copy
let lib = []; // comms_media
let gallery = []; // media (images)
let cur = "home";
let loadedAt = null;

const clone = (x) => JSON.parse(JSON.stringify(x));
const val = (o) => (o && (o.url || o.value || o.text)) || "";
const isImg = (key) => IMG_SLOT.test(key.split("__")[1]);
const changed = (key) => val(draft[key]) !== val(saved[key]);
const changedKeys = () => ALL_KEYS.filter(changed);
const filled = (key) => !!String(val(draft[key])).trim();

async function loadContent() {
  const s = await getDoc(doc(db, "settings", "page_content"));
  saved = s.exists() ? s.data() : {};
  if (!loadedAt || !changedKeys().length) draft = clone(saved);
  loadedAt = new Date();
}
async function loadLib() {
  const [c, g] = await Promise.all([getDocs(collection(db, "comms_media")), getDocs(collection(db, "media"))]);
  lib = c.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  gallery = g.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.type === "image" && m.enabled !== false);
}
/** url → [slot labels] from the PUBLISHED content. */
function usage() {
  const m = new Map();
  for (const k of ALL_KEYS) {
    const u = saved[k]?.url;
    if (u) m.set(u, [...(m.get(u) || []), SLOT_LABEL(k)]);
  }
  return m;
}

/* ─────────────────────────────── WEBSITE EDITOR ─────────────────────────────── */
function pageStats(p) {
  const s = slots(p).map((x) => `${p}__${x}`);
  return { f: s.filter(filled).length, n: s.length, ch: s.filter(changed).length };
}
const imgSlot = (key, label) => {
  const u = val(draft[key]);
  return `<button class="wimg ${changed(key) ? "chg" : ""}" data-pick="${key}" aria-label="Change ${esc(label)}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : '<span class="em">+ ADD PHOTO</span>'}<span class="ov2">🖼 CHANGE PHOTO</span></button>`;
};
const txt = (key, cls, ph) => `<div class="${cls} ${changed(key) ? "chg" : ""}" contenteditable="true" data-key="${key}" data-ph="${esc(ph)}" spellcheck="true">${esc(val(draft[key]))}</div>`;
const ytId = (u) => (String(u || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1];

function renderEditor() {
  const root = document.getElementById("webV2");
  if (!root) return;
  root.querySelector(".pages").innerHTML = Object.entries(PAGES)
    .map(([k, p]) => {
      const st = pageStats(k);
      return `<button class="pg ${k === cur ? "on" : ""}" data-page="${k}">${st.ch ? '<span class="dot">●</span>' : ""}<b>${esc(p.name.toUpperCase())}</b><small>${st.f}/${st.n} FILLED${st.ch ? ` · ${st.ch} UNSAVED` : ""}</small><span class="bar2"><i style="width:${(st.f / st.n) * 100}%"></i></span></button>`;
    })
    .join("");
  const P = PAGES[cur], k = cur;
  let h = "";
  if (P.home) {
    const vid = val(draft["home__hero_video"]), id = ytId(vid);
    h = `<div class="sec"><div class="sech"><span>READY TO ENLIST CARD</span><b>${filled("home__enlist_photo") ? "✓ SET" : "○ EMPTY"}</b></div><div class="secb" style="max-width:440px">${imgSlot("home__enlist_photo", "Ready To Enlist photo")}<p class="hint">Recruitment banner on the home page.</p></div></div>
      <div class="sec"><div class="sech"><span>SEE US IN ACTION — VIDEO</span><b>${vid ? "✓ SET" : "○ EMPTY"}</b></div><div class="secb vid">
        <div class="vp">${id ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt=""><span>▶</span>` : "<span>▶</span>"}</div>
        <div><label class="lbl" for="wVid">YOUTUBE OR TWITCH LINK</label><input class="fld ${changed("home__hero_video") ? "chg" : ""}" id="wVid" data-key="home__hero_video" value="${esc(vid)}">
        <label class="lbl">TEXT BELOW THE VIDEO</label>${txt("home__hero_video_description", "d", "Video description…")}</div></div></div>`;
  } else {
    const card = (base, i, label) => `<div class="wc">${imgSlot(`${k}__${base}_${i}`, `${label} ${i} photo`)}<div class="ct">${txt(`${k}__${base}_${i}_title`, "t", `${label} ${i} title…`)}${txt(`${k}__${base}_${i}_desc`, "d", "Description…")}</div></div>`;
    h = `<div class="sec"><div class="sech"><span>① PHOTO SLIDER</span><b>${[1, 2, 3].filter((i) => filled(`${k}__slider_${i}`)).length}/3 PHOTOS</b></div><div class="secb">${txt(`${k}__slider_header`, "hdr", "SLIDER HEADER…")}<div class="cards">${[1, 2, 3].map((i) => card("slider", i, "Slide")).join("")}</div></div></div>
      <div class="sec"><div class="sech"><span>② ${P.cards}</span><b>${[1, 2, 3].filter((i) => filled(`${k}__${P.prefix}_${i}`)).length}/3 PHOTOS</b></div><div class="secb">${txt(`${k}__cards_header`, "hdr", "CARDS HEADER…")}<div class="cards">${[1, 2, 3].map((i) => card(P.prefix, i, P.card)).join("")}</div></div></div>`;
  }
  const st = pageStats(cur);
  root.querySelector(".ed").innerHTML = `<div class="edh"><div><h2>${esc(P.name.toUpperCase())}</h2><span class="hint">${st.f}/${st.n} FILLED${saved.__lastPublishedBy ? ` · LAST PUBLISHED BY ${esc(saved.__lastPublishedBy)} · ${ukDate(saved.__lastPublishedAt)}` : ""}</span></div><a class="b" href="${P.url}" target="_blank" rel="noopener">↗ VIEW LIVE PAGE</a></div>${h}
    <p class="hint">Empty text = the public page keeps its built-in default. Photos come from the Comms Library, the Gallery or a new upload.</p>`;
  renderBar();
}
function renderBar() {
  const n = changedKeys().length;
  const bar = document.querySelector("#webV2 .savebar");
  if (!bar) return;
  bar.classList.toggle("show", n > 0);
  bar.querySelector(".dn").textContent = `${n} UNSAVED CHANGE${n === 1 ? "" : "S"} — VISITORS STILL SEE THE OLD VERSION`;
  document.querySelectorAll("#webV2 .pg").forEach((b) => {
    const st = pageStats(b.dataset.page);
    b.querySelector("small").textContent = `${st.f}/${st.n} FILLED${st.ch ? ` · ${st.ch} UNSAVED` : ""}`;
    const dot = b.querySelector(".dot");
    if (st.ch && !dot) b.insertAdjacentHTML("afterbegin", '<span class="dot">●</span>');
    if (!st.ch && dot) dot.remove();
  });
}

async function publish() {
  const keys = changedKeys();
  if (!keys.length) return;
  const btn = document.querySelector("#webV2 [data-act=publish]");
  btn.disabled = true;
  try {
    // Re-read so we never overwrite someone else's published change to other slots.
    const s = await getDoc(doc(db, "settings", "page_content"));
    const latest = s.exists() ? s.data() : {};
    const me = await getMe();
    for (const k of keys) latest[k] = clone(draft[k] || {});
    latest.__lastPublishedBy = memberName(me);
    latest.__lastPublishedAt = new Date().toISOString();
    await setDoc(doc(db, "settings", "page_content"), latest);
    const pages = [...new Set(keys.map((k) => PAGES[k.split("__")[0]].name))];
    await audit("public_comms", "WEBSITE PUBLISHED", `${keys.length} change${keys.length === 1 ? "" : "s"} — ${pages.join(", ")}`);
    saved = clone(latest);
    draft = clone(latest);
    notify(`✓ PUBLISHED ${keys.length} CHANGE${keys.length === 1 ? "" : "S"} — LIVE ON THE PUBLIC PAGES`);
    renderEditor();
  } catch (e) {
    notify("PUBLISH FAILED: " + e.message, 1);
  } finally {
    btn.disabled = false;
  }
}

/* Photo picker: Comms Library / Gallery / Upload. */
function openPicker(key) {
  const has = !!val(draft[key]);
  let tab = "lib";
  openModal(
    `<div class="hd"><div><h2>${esc(SLOT_LABEL(key).toUpperCase())}</h2><small>PICK A PHOTO</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="tabs3"><button class="on" data-tab="lib">☰ COMMS LIBRARY</button><button data-tab="gal">▣ GALLERY</button><button data-tab="up">⇪ UPLOAD NEW</button></div><div class="pk"></div></div>
    <div class="ft">${has ? '<button class="b red" data-x="rm">REMOVE PHOTO</button>' : "<span></span>"}<button class="b" data-close>CANCEL</button></div>`,
    { width: 820 },
  );
  const box = document.getElementById("v2Modal");
  const draw = () => {
    box.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const list = tab === "lib" ? lib : gallery;
    box.querySelector(".pk").innerHTML =
      tab === "up"
        ? '<label class="drop" tabindex="0">DROP A PHOTO HERE OR <u>CHOOSE FILE</u><small>ADDED TO THE COMMS LIBRARY TOO · WIDE PHOTOS (16:9) LOOK BEST · UP TO 10 MB</small><input type="file" accept="image/*" hidden></label><div class="ups"></div>'
        : list.length
          ? `<div class="lib">${list.map((m) => `<button data-url="${esc(m.url)}" data-mid="${esc(m.id)}" title="${esc(m.name || "")}"><img src="${esc(m.url)}" alt="" loading="lazy"><small>${esc(m.name || "Untitled")}</small></button>`).join("")}</div>`
          : `<div class="empty">${tab === "lib" ? "THE COMMS LIBRARY IS EMPTY — UPLOAD A PHOTO" : "NO VISIBLE GALLERY IMAGES"}</div>`;
  };
  const set = (url, mediaId) => {
    draft[key] = url ? { url, ...(mediaId ? { mediaId } : {}) } : {};
    closeModal();
    renderEditor();
    notify(url ? "PHOTO SET — PUBLISH TO APPLY" : "PHOTO REMOVED — PUBLISH TO APPLY");
  };
  const upload = async (file) => {
    if (!file?.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return notify("IMAGES UP TO 10 MB ONLY", 1);
    const st = box.querySelector(".ups");
    st.textContent = "UPLOADING… 0%";
    try {
      const r = await uploadImage(file, "505th_comms", (p) => (st.textContent = `UPLOADING… ${p}%`));
      const me = await getMe();
      const ref = await addDoc(collection(db, "comms_media"), { url: r.secure_url, name: file.name.replace(/\.[^.]+$/, ""), uploadedAt: new Date().toISOString(), uploadedBy: memberName(me) });
      lib.unshift({ id: ref.id, url: r.secure_url, name: file.name.replace(/\.[^.]+$/, ""), uploadedAt: new Date().toISOString() });
      set(r.secure_url, ref.id);
    } catch (e) {
      st.textContent = "";
      notify("UPLOAD FAILED: " + e.message, 1);
    }
  };
  box.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) return (tab = t.dataset.tab), draw();
    const p = e.target.closest("[data-url]");
    if (p) return set(p.dataset.url, tab === "lib" ? p.dataset.mid : null);
    if (e.target.closest("[data-x=rm]")) set(null);
  });
  box.addEventListener("change", (e) => e.target.type === "file" && upload(e.target.files[0]));
  box.addEventListener("dragover", (e) => e.target.closest(".drop") && e.preventDefault());
  box.addEventListener("drop", (e) => {
    if (!e.target.closest(".drop")) return;
    e.preventDefault();
    upload(e.dataTransfer.files[0]);
  });
  draw();
}

/* ─────────────────────────────── COMMS LIBRARY ─────────────────────────────── */
let lf = "", lq = "", lsort = "new";
const lsel = new Set();
const broken = new Set();

function renderLib() {
  const root = document.getElementById("libV2");
  if (!root) return;
  const use = usage();
  const uses = (m) => use.get(m.url) || [];
  let l = lib.filter((m) => String(m.name || "").toLowerCase().includes(lq.toLowerCase()) && (!lf || (lf === "used" ? uses(m).length : lf === "unused" ? !uses(m).length && !broken.has(m.id) : broken.has(m.id))));
  l.sort((a, b) => (lsort === "name" ? String(a.name).localeCompare(String(b.name)) : lsort === "old" ? String(a.uploadedAt).localeCompare(String(b.uploadedAt)) : String(b.uploadedAt).localeCompare(String(a.uploadedAt))));
  root.querySelector(".kp").innerHTML = `<div><b>${lib.length}</b><span>PHOTOS</span></div><div><b style="color:#22e07a">${lib.filter((m) => uses(m).length).length}</b><span>IN USE ON WEBSITE</span></div><div><b style="color:#f59e0b">${lib.filter((m) => !uses(m).length && !broken.has(m.id)).length}</b><span>NOT USED</span></div><div><b style="color:#ff4d4d">${broken.size}</b><span>BROKEN LINKS</span></div>`;
  root.querySelector(".chips").innerHTML = [["", "ALL"], ["used", "✓ IN USE"], ["unused", "○ NOT USED"], ["broken", "⚠ BROKEN"]].map(([k, t]) => `<button class="${lf === k ? "on" : ""}" data-lf="${k}">${t}</button>`).join("");
  root.querySelector(".grid").innerHTML =
    l
      .map((m) => {
        const u = uses(m), bad = broken.has(m.id);
        return `<div class="ph ${lsel.has(m.id) ? "sel" : ""}"><label class="ck" title="${u.length ? "In use — swap it out on the page first" : "Select"}"><input type="checkbox" data-lsel="${m.id}" ${lsel.has(m.id) ? "checked" : ""} ${u.length ? "disabled" : ""} aria-label="Select ${esc(m.name || "photo")}"></label>
        <button class="im" data-lopen="${m.id}" aria-label="Open ${esc(m.name || "photo")}"><img src="${esc(m.url)}" alt="" loading="lazy" data-limg="${m.id}">${bad ? '<span class="bad">⚠ IMAGE NOT FOUND</span>' : ""}<span class="tag ${bad ? "xb" : u.length ? "u" : "n"}">${bad ? "BROKEN" : u.length ? `✓ IN USE · ${u.length}` : "NOT USED"}</span></button>
        <div class="bd2"><b>${esc(m.name || "Untitled")}</b><small>${ukDate(m.uploadedAt)} · ${esc(m.uploadedBy || "—")}</small>${u.length ? `<div class="uses">${u.map((x) => `<a data-goto="${esc(x)}">${esc(x)}</a>`).join("")}</div>` : ""}</div></div>`;
      })
      .join("") || '<div class="empty">NO PHOTOS MATCH</div>';
  root.querySelectorAll("img[data-limg]").forEach((img) =>
    img.addEventListener("error", () => !broken.has(img.dataset.limg) && (broken.add(img.dataset.limg), renderLib()), { once: true }),
  );
  root.querySelector(".bulk").classList.toggle("show", lsel.size > 0);
  root.querySelector(".bulk .bn").textContent = `${lsel.size} SELECTED`;
}

async function delPhotos(ids) {
  const use = usage();
  const ok = ids.filter((id) => !(use.get(lib.find((m) => m.id === id)?.url) || []).length);
  if (ok.length !== ids.length) return notify("PHOTOS IN USE CAN'T BE DELETED — SWAP THEM OUT ON THE PAGE FIRST", 1);
  if (!(await ask({ kind: ok.length > 5 ? "big" : "danger", title: `DELETE ${ok.length} PHOTO${ok.length === 1 ? "" : "S"}?`, body: "They are removed from the photo library.", warn: "THIS CANNOT BE UNDONE.", go: "DELETE" }))) return;
  try {
    const names = ok.map((id) => lib.find((m) => m.id === id)?.name || id);
    await Promise.all(ok.map((id) => deleteDoc(doc(db, "comms_media", id))));
    await audit("public_comms", "COMMS PHOTOS DELETED", names.slice(0, 10).join(", "));
    ok.forEach((id) => lsel.delete(id));
    lib = lib.filter((m) => !ok.includes(m.id));
    closeModal();
    renderLib();
    notify(`✓ ${ok.length} DELETED`);
  } catch (e) {
    notify("DELETE FAILED: " + e.message, 1);
  }
}

function openPhoto(id) {
  const m = lib.find((x) => x.id === id);
  if (!m) return;
  const u = usage().get(m.url) || [];
  openModal(
    `<div class="hd"><div><h2>${esc((m.name || "Untitled").toUpperCase())}</h2><small>COMMS LIBRARY</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><div class="dv"><img src="${esc(m.url)}" alt="" class="big"><div>
      <label class="lbl" for="lnm">NAME</label><input class="fld" id="lnm" maxlength="120" value="${esc(m.name || "")}">
      <label class="lbl">USED ON THE WEBSITE</label>${u.length ? `<div class="uses">${u.map((x) => `<a>${esc(x)}</a>`).join("")}</div>` : '<div class="hint" style="margin:0">NOT USED ON ANY PAGE</div>'}
      <label class="lbl">DETAILS</label><div class="hint" style="margin:0;line-height:1.9">UPLOADED ${ukDate(m.uploadedAt)}<br>BY ${esc(m.uploadedBy || "—")}</div>
      <div style="display:flex;gap:6px;margin-top:12px"><button class="b sm" data-x="copy">⧉ COPY LINK</button></div></div></div></div>
    <div class="ft">${u.length ? '<span class="hint" style="margin:0">🔒 IN USE — SWAP IT OUT ON THE PAGE BEFORE DELETING</span>' : '<button class="b red" data-x="del">🗑 DELETE</button>'}<div style="display:flex;gap:8px"><button class="b" data-close>CANCEL</button><button class="b gold" data-x="save">SAVE</button></div></div>`,
    { width: 820 },
  );
  document.getElementById("v2Modal").addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "copy") return navigator.clipboard?.writeText(m.url).then(() => notify("✓ LINK COPIED"));
    if (x === "del") return delPhotos([id]);
    if (x === "save") {
      const name = document.getElementById("lnm").value.trim() || "Untitled";
      try {
        await updateDoc(doc(db, "comms_media", id), { name });
        m.name = name;
        closeModal();
        renderLib();
        notify("✓ RENAMED");
      } catch (err) {
        notify("SAVE FAILED: " + err.message, 1);
      }
    }
  });
}

function openUpload() {
  const queue = [];
  openModal(
    `<div class="hd"><div><h2>UPLOAD PHOTOS</h2><small>COMMS LIBRARY</small></div><button class="xx" data-close aria-label="Close">✕</button></div>
    <div class="bd"><label class="drop" tabindex="0">DROP PHOTOS HERE OR <u>CHOOSE FILES</u><small>JPG / PNG / WEBP · UP TO 10 MB EACH · WIDE (16:9) LOOKS BEST ON THE SITE</small><input type="file" accept="image/*" multiple hidden></label><div class="q"></div></div>
    <div class="ft"><span class="hint qs" style="margin:0"></span><div style="display:flex;gap:8px"><button class="b" data-x="close">CLOSE</button><button class="b gold" data-x="go">UPLOAD</button></div></div>`,
    { width: 680 },
  );
  const box = document.getElementById("v2Modal");
  const draw = () =>
    (box.querySelector(".q").innerHTML = queue
      .map((f, i) => `<div class="qi ${f.st}"><img src="${f.prev}" alt=""><input class="fld" data-qn="${i}" value="${esc(f.name)}" ${f.st === "ok" || f.st === "up" ? "disabled" : ""} aria-label="Name"><span class="qp"><i style="width:${f.pct}%"></i></span><span class="hint" style="margin:0">${f.st === "ok" ? "✓ DONE" : f.st === "up" ? f.pct + "%" : f.st === "err" ? "✕ FAILED" : "READY"}</span></div>`)
      .join(""));
  const add = (files) => {
    for (const f of files) {
      if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) {
        notify(`${f.name}: IMAGES UP TO 10 MB ONLY`, 1);
        continue;
      }
      queue.push({ file: f, name: f.name.replace(/\.[^.]+$/, ""), prev: URL.createObjectURL(f), st: "wait", pct: 0 });
    }
    draw();
  };
  let busy = false;
  box.addEventListener("change", (e) => e.target.type === "file" && add(e.target.files));
  box.addEventListener("input", (e) => e.target.dataset.qn != null && (queue[+e.target.dataset.qn].name = e.target.value));
  box.addEventListener("dragover", (e) => e.target.closest(".drop") && e.preventDefault());
  box.addEventListener("drop", (e) => {
    if (!e.target.closest(".drop")) return;
    e.preventDefault();
    add(e.dataTransfer.files);
  });
  box.addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]")?.dataset.x;
    if (x === "close" && !busy) return closeModal(), renderLib();
    if (x !== "go" || busy) return;
    const todo = queue.filter((f) => f.st === "wait" || f.st === "err");
    if (!todo.length) return notify("ADD SOME PHOTOS FIRST", 1);
    busy = true;
    const me = await getMe();
    let ok = 0;
    for (const f of todo) {
      f.st = "up";
      draw();
      try {
        const r = await uploadImage(f.file, "505th_comms", (p) => ((f.pct = p), draw()));
        const rec = { url: r.secure_url, name: f.name.trim() || "Untitled", uploadedAt: new Date().toISOString(), uploadedBy: memberName(me) };
        const ref = await addDoc(collection(db, "comms_media"), rec);
        lib.unshift({ id: ref.id, ...rec });
        f.st = "ok";
        f.pct = 100;
        ok++;
      } catch {
        f.st = "err";
      }
      draw();
    }
    busy = false;
    box.querySelector(".qs").textContent = `${ok}/${todo.length} UPLOADED`;
    if (ok) await audit("public_comms", "COMMS PHOTOS UPLOADED", `${ok} photo(s)`);
    notify(ok === todo.length ? `✓ ${ok} PHOTO${ok === 1 ? "" : "S"} ADDED` : `${todo.length - ok} FAILED — TRY AGAIN`, ok !== todo.length);
  });
}

/* ─────────────────────────────────── CSS ─────────────────────────────────── */
const CSS = `
#webV2 .pages{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0 18px}
#webV2 .pg{border:1px solid var(--l);background:var(--p);cursor:pointer;text-align:left;font:inherit;color:inherit;position:relative;padding:0;display:flex;flex-direction:column}
#webV2 .pg.on{border-color:var(--a);box-shadow:0 0 0 1px var(--a)}#webV2 .pg b{display:block;font-family:Rajdhani,sans-serif;font-size:13px;letter-spacing:1px;color:#fff;padding:12px 10px 2px}#webV2 .pg small{display:block;font-size:9px;letter-spacing:1px;color:var(--d);padding:0 10px 10px}
#webV2 .bar2{height:3px;background:rgba(255,255,255,.08);margin-top:auto}#webV2 .bar2 i{display:block;height:100%;background:var(--g)}#webV2 .dot{position:absolute;top:6px;right:8px;color:var(--am);font-size:12px}
#webV2 .edh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}#webV2 .edh h2{font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#fff;margin:0;font-size:20px}#webV2 a.b{text-decoration:none}
#webV2 .sec{border:1px solid var(--l);background:var(--p);margin-bottom:16px}
#webV2 .sech{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--l);background:rgba(0,217,255,.03)}#webV2 .sech span{font-size:9.5px;letter-spacing:2.5px;color:var(--d)}#webV2 .sech b{font-size:9.5px;letter-spacing:1.5px;color:var(--g);font-weight:400}
#webV2 .secb{padding:16px}
#webV2 [contenteditable]{border:1px dashed transparent;outline:0;cursor:text}#webV2 [contenteditable]:hover{border-color:var(--l2)}#webV2 [contenteditable]:focus{border-color:var(--a);background:rgba(0,217,255,.04)}#webV2 [contenteditable]:empty::before{content:attr(data-ph);color:var(--dd)}
#webV2 .hdr{font-family:Rajdhani,sans-serif;font-size:26px;font-weight:700;letter-spacing:4px;color:#fff;text-align:center;padding:6px}
#webV2 .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
#webV2 .wc{border:1px solid var(--l);background:#070a0f;display:flex;flex-direction:column}
#webV2 .wimg{aspect-ratio:16/9;position:relative;background:#0e131b;cursor:pointer;overflow:hidden;border:0;padding:0;width:100%;display:block}
#webV2 .wimg img{width:100%;height:100%;object-fit:cover;display:block}#webV2 .wimg .em{position:absolute;inset:0;display:grid;place-items:center;color:var(--dd);font-size:11px;letter-spacing:2px;border:1px dashed var(--l2)}
#webV2 .wimg .ov2{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;place-items:center;color:#fff;font-size:11px;letter-spacing:2px}#webV2 .wimg:hover .ov2,#webV2 .wimg:focus-visible .ov2{display:grid}
#webV2 .ct{padding:10px}#webV2 .ct .t{font-family:Rajdhani,sans-serif;font-weight:700;font-size:16px;color:#fff;letter-spacing:1px;padding:2px 4px}#webV2 .d{font-size:12px;color:#aeb9c4;line-height:1.55;margin-top:4px;padding:2px 4px;min-height:36px}
#webV2 .chg{box-shadow:inset 3px 0 0 var(--am)}
#webV2 .vid{display:grid;grid-template-columns:1.3fr 1fr;gap:16px}#webV2 .vp{aspect-ratio:16/9;background:#000;display:grid;place-items:center;color:#fff;font-size:34px;border:1px solid var(--l);position:relative;overflow:hidden}#webV2 .vp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.7}#webV2 .vp span{position:relative}
#webV2 .lbl,#libV2 .lbl,.v2m .lbl{display:block;font-size:9.5px;letter-spacing:2.5px;color:#aeb9c4;margin:14px 0 7px}
#webV2 .fld,.v2m .fld{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:8px 10px;font:inherit;font-size:12px;outline:0;color:#d6dde6}
#webV2 .hint,#libV2 .hint,.v2m .hint{font-size:10px;letter-spacing:.5px;color:#7d8a99;line-height:1.7;margin-top:10px}
#webV2 .savebar{position:sticky;bottom:12px;display:none;gap:8px;align-items:center;border:1px solid var(--am);background:#141006;color:var(--am);padding:10px 14px;font-size:11px;letter-spacing:2px;z-index:5}#webV2 .savebar.show{display:flex}
.v2m .tabs3{display:flex;gap:4px;margin-bottom:12px}.v2m .tabs3 button{background:none;border:1px solid rgba(0,217,255,.18);color:#7d8a99;padding:7px 12px;font:inherit;font-size:10.5px;letter-spacing:2px;cursor:pointer}.v2m .tabs3 button.on{color:#00D9FF;border-color:#00D9FF}
.v2m .lib{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-height:52vh;overflow:auto}.v2m .lib button{aspect-ratio:16/10;border:2px solid transparent;cursor:pointer;padding:0;position:relative;background:#0e131b}.v2m .lib button:hover,.v2m .lib button:focus-visible{border-color:#00D9FF}.v2m .lib img{width:100%;height:100%;object-fit:cover}.v2m .lib small{position:absolute;left:4px;bottom:3px;font-size:9px;color:#fff;background:rgba(0,0,0,.65);padding:1px 4px;max-width:90%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.v2m .drop{display:block;border:1px dashed rgba(0,217,255,.35);padding:30px;text-align:center;color:#00D9FF;font-size:12px;letter-spacing:2px;cursor:pointer}.v2m .drop small{display:block;color:#7d8a99;font-size:9.5px;margin-top:6px}.v2m .ups{margin-top:10px;font-size:11px;color:#00D9FF;letter-spacing:1.5px}
.v2m .q{margin-top:12px;display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto}.v2m .qi{display:grid;grid-template-columns:56px 1fr 120px 70px;gap:8px;align-items:center}.v2m .qi img{width:56px;height:36px;object-fit:cover}.v2m .qp{height:5px;background:rgba(255,255,255,.08)}.v2m .qp i{display:block;height:100%;background:#00D9FF}.v2m .qi.ok .qp i{background:#22e07a}
.v2m .dv{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}.v2m .big{width:100%;border:1px solid rgba(0,217,255,.18)}
.v2m .uses,#libV2 .uses{display:flex;flex-wrap:wrap;gap:4px}.v2m .uses a,#libV2 .uses a{font-size:9.5px;letter-spacing:1px;color:#22e07a;border:1px solid rgba(34,224,122,.4);padding:1px 6px;cursor:pointer}
#libV2 .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}#libV2 .kp>div{border:1px solid var(--l);background:var(--p2);padding:12px;text-align:center}#libV2 .kp b{display:block;font-family:Rajdhani,sans-serif;font-size:24px;color:var(--a)}#libV2 .kp span{font-size:9px;letter-spacing:2px;color:var(--d)}
#libV2 .ftr{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}#libV2 .chips{display:flex;gap:4px}#libV2 .chips button{border:1px solid var(--l);background:none;color:var(--d);padding:7px 12px;font:inherit;font-size:10.5px;letter-spacing:1.5px;cursor:pointer}#libV2 .chips button.on{border-color:var(--a);color:var(--a);background:rgba(0,217,255,.06)}
#libV2 .bulk{position:sticky;top:8px;z-index:5;display:none;gap:8px;align-items:center;border:1px solid var(--r);background:#1a0909;color:var(--r);padding:10px 14px;font-size:11px;letter-spacing:2px;margin-bottom:10px}#libV2 .bulk.show{display:flex}
#libV2 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
#libV2 .ph{border:1px solid var(--l);background:var(--p);position:relative;display:flex;flex-direction:column}#libV2 .ph.sel{border-color:var(--r);box-shadow:0 0 0 1px var(--r)}
#libV2 .im{aspect-ratio:16/10;position:relative;cursor:pointer;border:0;padding:0;width:100%;display:block;background:#1a0d0d}#libV2 .im img{width:100%;height:100%;object-fit:cover;display:block}
#libV2 .bad{position:absolute;inset:0;display:grid;place-items:center;color:var(--r);font-size:11px;letter-spacing:2px;background:#1a0d0d}
#libV2 .tag{position:absolute;top:8px;right:8px;font-size:9px;letter-spacing:1.5px;padding:2px 7px}#libV2 .tag.u{background:var(--g);color:#000}#libV2 .tag.n{background:rgba(0,0,0,.7);color:var(--am);border:1px solid var(--am)}#libV2 .tag.xb{background:var(--r);color:#000}
#libV2 .ck{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);padding:3px 4px;line-height:0;z-index:2}#libV2 .ck input{width:16px;height:16px;accent-color:#ff4d4d;cursor:pointer}#libV2 .ck input:disabled{cursor:not-allowed;opacity:.35}
#libV2 .bd2{padding:9px 10px;display:flex;flex-direction:column;gap:5px}#libV2 .bd2 b{font-family:Rajdhani,sans-serif;font-size:14.5px;color:#fff}#libV2 .bd2 small{font-size:9.5px;color:var(--d);letter-spacing:1px}
@media(max-width:1100px){#webV2 .pages{grid-template-columns:repeat(3,1fr)}#webV2 .cards,#webV2 .vid,.v2m .dv{grid-template-columns:1fr}#libV2 .kp{grid-template-columns:1fr 1fr}}
`;

onReady(() => {
  addCss("websiteV2", CSS);

  const web = mountPanel("panel-website", "webV2", async () => {
    try {
      await Promise.all([loadContent(), loadLib()]);
      renderEditor();
    } catch (e) {
      notify("WEBSITE LOAD FAILED: " + e.message, 1);
    }
  });
  if (web) {
    web.innerHTML = `<div class="h1">WEBSITE</div><div class="sub">EDIT WHAT VISITORS SEE ON THE PUBLIC PAGES — CLICK A PHOTO OR ANY TEXT TO CHANGE IT</div>
      <div class="pages"></div><div class="ed"><div class="empty">LOADING...</div></div>
      <div class="savebar"><span class="dn"></span><span style="flex:1"></span><button class="b" data-act="discard">DISCARD</button><button class="b gold" data-act="publish">PUBLISH CHANGES</button></div>`;
    web.addEventListener("click", async (e) => {
      const pg = e.target.closest("[data-page]");
      if (pg) return (cur = pg.dataset.page), renderEditor();
      const pk = e.target.closest("[data-pick]");
      if (pk) return openPicker(pk.dataset.pick);
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "publish") return publish();
      if (act === "discard" && (await ask({ kind: "danger", title: "DISCARD CHANGES?", body: "All unpublished changes are thrown away.", warn: "THIS CANNOT BE UNDONE.", go: "DISCARD" }))) (draft = clone(saved)), renderEditor();
    });
    web.addEventListener("input", (e) => {
      const k = e.target.dataset.key;
      if (!k) return;
      const v = e.target.isContentEditable ? e.target.innerText.replace(/\n+$/, "") : e.target.value;
      draft[k] = { ...(draft[k] || {}), value: v };
      if ("text" in draft[k]) delete draft[k].text;
      e.target.classList.toggle("chg", changed(k));
      renderBar();
      if (k === "home__hero_video") {
        const id = ytId(v), vp = web.querySelector(".vp");
        if (vp) vp.innerHTML = id ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt=""><span>▶</span>` : "<span>▶</span>";
      }
    });
    web.addEventListener("keydown", (e) => e.key === "Enter" && e.target.matches?.(".hdr,.t") && e.preventDefault());
    // Paste as plain text into editable text.
    web.addEventListener("paste", (e) => {
      if (!e.target.isContentEditable) return;
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    });
    addEventListener("beforeunload", (e) => changedKeys().length && e.preventDefault());
  }

  const lp = mountPanel("panel-comms-library", "libV2", async () => {
    try {
      await Promise.all([loadContent(), loadLib()]);
      renderLib();
    } catch (e) {
      notify("COMMS LIBRARY LOAD FAILED: " + e.message, 1);
    }
  });
  if (lp) {
    lp.innerHTML = `<div class="bar"><div><div class="h1">COMMS LIBRARY</div><div class="sub" style="margin:4px 0 0">PHOTOS FOR THE PUBLIC WEBSITE PAGES — SEPARATE FROM THE GALLERY</div></div><span class="sp"></span><button class="b gold" data-act="up">⇪ UPLOAD PHOTOS</button></div>
      <div class="kp"></div>
      <div class="ftr"><input class="srch" data-f="q" placeholder="SEARCH NAME..." aria-label="Search" style="min-width:240px"><div class="chips"></div><span style="flex:1"></span>
        <select class="srch" data-f="sort" aria-label="Sort"><option value="new">NEWEST FIRST</option><option value="old">OLDEST FIRST</option><option value="name">NAME A–Z</option></select></div>
      <div class="bulk"><span class="bn"></span><span style="flex:1"></span><button class="b" data-act="clear">CLEAR</button><button class="b red" data-act="bdel">🗑 DELETE SELECTED</button></div>
      <div class="grid"><div class="empty">LOADING...</div></div>
      <p class="hint">• <b>IN USE</b> shows which website page and slot uses each photo — click it to open that page in the Website editor.<br>• Photos in use can't be deleted until they're swapped out on the page.<br>• Uploads use signed Cloudinary uploads, the same as the Gallery.</p>`;
    lp.addEventListener("click", (e) => {
      if (e.target.closest("[data-lsel]")) return;
      const f = e.target.closest("[data-lf]");
      if (f) return (lf = f.dataset.lf), renderLib();
      const o = e.target.closest("[data-lopen]");
      if (o) return openPhoto(o.dataset.lopen);
      const g = e.target.closest("[data-goto]");
      if (g) {
        const name = g.dataset.goto.split(" · ")[0];
        const page = Object.entries(PAGES).find(([, p]) => p.name === name || p.name.replace("505th Expeditionary Force", "505th") === name || (name === "Home" && p.home));
        if (page) cur = page[0];
        return window.showPanel("panel-website");
      }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "up") return openUpload();
      if (act === "clear") return lsel.clear(), renderLib();
      if (act === "bdel") return delPhotos([...lsel]);
    });
    lp.addEventListener("change", (e) => {
      if (e.target.dataset.lsel) return e.target.checked ? lsel.add(e.target.dataset.lsel) : lsel.delete(e.target.dataset.lsel), renderLib();
      if (e.target.dataset.f === "sort") (lsort = e.target.value), renderLib();
    });
    lp.addEventListener("input", (e) => {
      if (e.target.dataset.f !== "q") return;
      lq = e.target.value;
      renderLib();
    });
  }
});
