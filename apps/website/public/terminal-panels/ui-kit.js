/**
 * Terminal UI kit (approved mock 2026-11-10 — "no white boxes").
 * 1. Dark style for every .fld input / textarea / select inside v2 pages (.v2).
 * 2. Every <select class="fld"> is turned into a dark custom picker: search box (long lists), groups from <optgroup>,
 *    ✓ on the picked item, greyed items keep their reason, role colour dot from data-color.
 *    The real <select> stays (hidden) and still gets the value + "input"/"change" events, so page code is unchanged.
 * Keyboard: Enter/Space/↓ open · ↑↓ move · Enter pick · Esc close · type to search. Screen readers: listbox / option roles.
 */
import { addCss, onReady } from "./_common.js";

const CSS = `
.v2 .fld{width:100%;box-sizing:border-box;background:#061018;border:1px solid rgba(0,217,255,.22);color:#cfe9f2;padding:9px 12px;font:14px "Rajdhani","Segoe UI",sans-serif;border-radius:0;outline:none;transition:border-color .15s,box-shadow .15s;color-scheme:dark}
.v2 .fld::placeholder{color:#4d6470}.v2 .fld:hover{border-color:rgba(0,217,255,.4)}
.v2 .fld:focus,.v2 .ukp-btn:focus-visible{border-color:#00D9FF;box-shadow:0 0 0 1px #00D9FF,0 0 12px rgba(0,217,255,.15)}
.v2 textarea.fld{resize:vertical;line-height:1.5;font-family:inherit}
.v2 .fld:disabled{opacity:.45;cursor:not-allowed}
.v2 input[type=checkbox],.v2 input[type=radio]{accent-color:#00D9FF;width:16px;height:16px;cursor:pointer}
.v2 select.fld option,.v2 select.fld optgroup{background:#07131b;color:#cfe9f2}
.ukp{position:relative;width:100%}.ukp.inline{display:inline-block;width:auto;min-width:170px}
.ukp>select{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;left:0;top:0}
.ukp-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 34px 8px 12px;background:#061018;border:1px solid rgba(0,217,255,.22);color:#cfe9f2;font:14px "Rajdhani","Segoe UI",sans-serif;cursor:pointer;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ukp.inline .ukp-btn{min-height:30px;padding:4px 30px 4px 10px;font:11px monospace;letter-spacing:1px}
.ukp-btn:hover{border-color:rgba(0,217,255,.4)}.ukp-btn:after{content:"";position:absolute;right:13px;top:50%;width:7px;height:7px;border-right:2px solid #00D9FF;border-bottom:2px solid #00D9FF;transform:translateY(-70%) rotate(45deg)}
.ukp.open .ukp-btn{border-color:#00D9FF}.ukp.open .ukp-btn:after{transform:translateY(-20%) rotate(-135deg)}
.ukp-btn[aria-disabled=true]{opacity:.45;cursor:not-allowed}.ukp-btn .ph{color:#4d6470}.ukp-btn .tx{overflow:hidden;text-overflow:ellipsis}
.ukp-dd{position:fixed;z-index:10060;background:#07131b;border:1px solid #00D9FF;box-shadow:0 12px 30px rgba(0,0,0,.6);max-height:300px;overflow:auto;min-width:200px}
.ukp-dd .s{padding:8px;border-bottom:1px solid rgba(0,217,255,.18);position:sticky;top:0;background:#07131b}
.ukp-dd .s input{width:100%;box-sizing:border-box;background:#061018;border:1px solid rgba(0,217,255,.22);color:#cfe9f2;padding:6px 10px 6px 28px;font:13px "Rajdhani","Segoe UI",sans-serif;outline:none}
.ukp-dd .s input:focus{border-color:#00D9FF}.ukp-dd .s:before{content:"⌕";position:absolute;left:18px;top:50%;transform:translateY(-52%);color:#00D9FF}
.ukp-dd .g{font:10px monospace;letter-spacing:2px;color:#6f8a96;padding:8px 12px 4px;display:flex;align-items:center;gap:6px}.ukp-dd .g:after{content:"";flex:1;height:1px;background:rgba(0,217,255,.18)}
.ukp-dd .o{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;font:14px "Rajdhani","Segoe UI",sans-serif;color:#cfe9f2}
.ukp-dd .o.hi{background:rgba(0,217,255,.12)}.ukp-dd .o[aria-selected=true]{color:#00D9FF}.ukp-dd .o[aria-selected=true]:after{content:"✓";margin-left:auto;padding-left:10px}
.ukp-dd .o[aria-disabled=true]{opacity:.42;cursor:not-allowed}.ukp-dd .o .why{margin-left:auto;font:10px monospace;letter-spacing:.5px;color:#f59e0b;padding-left:10px;white-space:nowrap}
.ukp-dd .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}.ukp-dd .none{padding:12px;color:#6f8a96;font:12px monospace}
`;

let openP = null;
const WHY = /\s*\((Cortana can't [^)]+|.*staff powers.*)\)\s*$/i;

function labelOf(opt) {
  const m = opt.textContent.match(WHY);
  return { text: m ? opt.textContent.replace(WHY, "") : opt.textContent, why: m ? m[1] : "" };
}
function syncBtn(w) {
  const sel = w._sel, btn = w._btn, o = sel.options[sel.selectedIndex];
  const { text } = o ? labelOf(o) : { text: "" };
  const empty = !o || o.value === "";
  const color = o?.dataset.color;
  btn.innerHTML = `${color ? `<span class="dot" style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>` : ""}<span class="tx ${empty ? "ph" : ""}"></span>`;
  btn.querySelector(".tx").textContent = text || "—";
  btn.setAttribute("aria-disabled", sel.disabled ? "true" : "false");
  btn.setAttribute("aria-label", (sel.getAttribute("aria-label") || sel.labels?.[0]?.textContent || "Choose") + ": " + (text || "none"));
}
function close(focusBtn = false) {
  if (!openP) return;
  const { w, dd } = openP;
  dd.remove();
  w.classList.remove("open");
  w._btn.setAttribute("aria-expanded", "false");
  if (focusBtn) w._btn.focus();
  openP = null;
}
function pick(w, value) {
  const sel = w._sel;
  if (sel.value !== value) {
    sel.value = value;
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (document.body.contains(w)) syncBtn(w);
  close(document.body.contains(w));
}
function open(w) {
  if (w._sel.disabled) return;
  close();
  const sel = w._sel, dd = document.createElement("div");
  dd.className = "ukp-dd";
  dd.setAttribute("role", "listbox");
  const id = "ukp" + Math.random().toString(36).slice(2, 8);
  dd.id = id;
  const many = sel.options.length > 8;
  dd.innerHTML = many ? '<div class="s"><input type="text" placeholder="Search…" aria-label="Search the list"></div><div class="l"></div>' : '<div class="l"></div>';
  const list = dd.querySelector(".l");
  const items = [];
  const render = (q = "") => {
    q = q.trim().toLowerCase();
    list.innerHTML = "";
    items.length = 0;
    let lastGroup = null;
    for (const o of sel.options) {
      const { text, why } = labelOf(o);
      if (q && !text.toLowerCase().includes(q)) continue;
      const g = o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : null;
      if (g && g !== lastGroup) { const gh = document.createElement("div"); gh.className = "g"; gh.textContent = g; list.appendChild(gh); }
      lastGroup = g;
      const el = document.createElement("div");
      el.className = "o";
      el.setAttribute("role", "option");
      el.id = id + "-" + items.length;
      el.setAttribute("aria-selected", o.selected && o.value !== "" ? "true" : "false");
      if (o.disabled) el.setAttribute("aria-disabled", "true");
      el.innerHTML = `${o.dataset.color ? `<span class="dot" style="background:${o.dataset.color}"></span>` : ""}<span class="t"></span>${why ? '<span class="why"></span>' : ""}`;
      el.querySelector(".t").textContent = text;
      if (why) el.querySelector(".why").textContent = why.toUpperCase();
      el.addEventListener("mousedown", (e) => { e.preventDefault(); if (!o.disabled) pick(w, o.value); });
      list.appendChild(el);
      items.push({ el, o });
    }
    if (!items.length) list.innerHTML = '<div class="none">Nothing matches.</div>';
    hi = Math.max(0, items.findIndex((x) => x.o.selected));
    paint();
  };
  let hi = 0;
  const paint = () => items.forEach((x, n) => { x.el.classList.toggle("hi", n === hi); if (n === hi) { x.el.scrollIntoView({ block: "nearest" }); w._btn.setAttribute("aria-activedescendant", x.el.id); } });
  const move = (d) => { if (!items.length) return; let n = hi; for (let k = 0; k < items.length; k++) { n = (n + d + items.length) % items.length; if (!items[n].o.disabled) break; } hi = n; paint(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); const x = items[hi]; if (x && !x.o.disabled) pick(w, x.o.value); }
    else if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); close(e.key === "Escape"); }
  };
  document.body.appendChild(dd);
  const r = w._btn.getBoundingClientRect(), below = window.innerHeight - r.bottom;
  dd.style.left = r.left + "px";
  dd.style.width = Math.max(r.width, 220) + "px";
  if (below < 220 && r.top > below) { dd.style.bottom = window.innerHeight - r.top + "px"; dd.style.maxHeight = Math.min(300, r.top - 10) + "px"; }
  else { dd.style.top = r.bottom + "px"; dd.style.maxHeight = Math.min(300, below - 10) + "px"; }
  w.classList.add("open");
  w._btn.setAttribute("aria-expanded", "true");
  w._btn.setAttribute("aria-controls", id);
  openP = { w, dd, onKey };
  render();
  const s = dd.querySelector(".s input");
  if (s) { s.addEventListener("input", () => render(s.value)); s.addEventListener("keydown", onKey); setTimeout(() => s.focus(), 0); }
}

function enhance(sel) {
  if (sel.dataset.ukp || sel.multiple || !sel.closest(".v2")) return;
  sel.dataset.ukp = "1";
  const w = document.createElement("div");
  w.className = "ukp" + (sel.style.width === "auto" || /\b(sm-add|ip-add|tk-add|cs-add|inline)\b/.test(sel.className) ? " inline" : "");
  if (sel.style.maxWidth) w.style.maxWidth = sel.style.maxWidth;
  sel.parentNode.insertBefore(w, sel);
  w.appendChild(sel);
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ukp-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  if (sel.id) { btn.id = sel.id + "-ukp"; for (const l of document.querySelectorAll(`label[for="${CSS.escape(sel.id)}"]`)) l.htmlFor = btn.id; }
  w.appendChild(btn);
  w._sel = sel;
  w._btn = btn;
  syncBtn(w);
  btn.addEventListener("click", () => (openP?.w === w ? close(true) : open(w)));
  btn.addEventListener("keydown", (e) => {
    if (openP?.w === w) return openP.onKey(e);
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(w); }
  });
  sel.addEventListener("change", () => syncBtn(w));
}
const scan = (root) => root.querySelectorAll?.("select.fld:not([data-ukp])").forEach(enhance);

onReady(() => {
  addCss("ui-kit", CSS);
  scan(document);
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.("select.fld")) enhance(n); else scan(n); }
    if (openP && !document.body.contains(openP.w)) close();
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("mousedown", (e) => { if (openP && !openP.dd.contains(e.target) && !openP.w.contains(e.target)) close(); }, true);
  window.addEventListener("resize", () => close());
  document.addEventListener("scroll", (e) => { if (openP && !openP.dd.contains(e.target)) close(); }, true);
});
