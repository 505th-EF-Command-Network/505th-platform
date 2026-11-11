/**
 * ORDER OF BATTLE v2 (was Unit Cards; approved mock 2026-11-09) — replaces #panel-unitcards.
 * Same data as the original: settings/unit_cards, one entry per slot
 * ({status:'open'|'closed'|'filled', name, userId}) plus __SECTION_HIDDEN__ flags.
 * Structure and key format are copied 1:1 from the original so the public
 * Order of Battle page keeps working.
 */
import { doc, getDoc, setDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, db, esc, getUsers, isMember, memberName, mountPanel, notify, onReady, rankAbbr } from "./_common.js";

const ROOT = "obV2";
// Copied from UNIT_CARD_STRUCTURE in the original page.
const STRUCTURE = {
  "Battalion Command": { accent: "#C9A227", sections: { "Command Staff": ["O9 / Lieutenant General", "O8 / Major General", "O7 / Brigadier General", "O6 / Colonel", "O5 / Lieutenant Colonel", "O4 / Major", "O3 / Captain", "O2 / First Lieutenant", "O1 / Second Lieutenant"] } },
  "Alpha Company": {
    accent: "#8aad44",
    sections: {
      "1st Platoon — Killjoy": ["Platoon Commander", "Platoon Sergeant", "KJ 1-1 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "KJ 1-2 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "KJ 1-3 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8"],
      "2nd Platoon": ["Platoon Commander", "Platoon Sergeant", "Alpha 2-1 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "Bravo 2-2 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "Charlie 2-3 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8"],
      "3rd Platoon": ["Platoon Commander", "Platoon Sergeant", "Alpha 3-1 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "Bravo 3-2 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8", "Charlie 3-3 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Marine 7", "Marine 8"],
    },
  },
  "JSOTF-23": { accent: "#a47de0", sections: { "1st Plt — Marine Recon": ["Platoon Commander", "Platoon Sergeant", "Stalker 1-0 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6", "Stalker 2-0 SQL", "Marine 1", "Marine 2", "Marine 3", "Marine 4", "Marine 5", "Marine 6"] } },
  "54th Air Wing": { accent: "#00c4b7", sections: { "Wing Staff": ["Wing Commander", "Deputy Wing Commander"], "Alpha Squadron": ["Squadron CO", "Squadron XO", "Pilot 1", "Pilot 2", "Pilot 3", "Pilot 4"], "Bravo Squadron": ["Squadron CO", "Squadron XO", "Pilot 1", "Pilot 2", "Pilot 3", "Pilot 4"] } },
  "Support Company": { accent: "#e05a4a", sections: { "Hospital Corpsman": ["Hospital Overseer", "Hospital Supervisor", "Head of Training", "Corpsman 1", "Corpsman 2", "Corpsman 3", "Corpsman 4", "Corpsman 5", "Corpsman 6"] } },
};
const slotKey = (unit, section, slot, squad) => `${unit}__${section}__${squad ? `${squad}__${slot}` : slot}`.split(" ").join("_");
const hiddenKey = (unit, section) => ("__SECTION_HIDDEN__" + unit + "__" + section).split(" ").join("_");

/** Same staff / squad grouping as the original renderer. */
function groupSlots(slots) {
  const staff = [], squads = [];
  let cur = null;
  for (const s of slots) {
    if (s.endsWith("SQL")) {
      cur = { name: s.replace(/ SQL$/, "").trim(), slots: [s] };
      squads.push(cur);
    } else if (cur) cur.slots.push(s);
    else staff.push(s);
  }
  return { staff, squads };
}

let data = {};
let saved = {};
let users = [];
let unit = "Battalion Command";
let popKey = null;

const dirtyKeys = () => [...new Set([...Object.keys(data), ...Object.keys(saved)])].filter((k) => JSON.stringify(data[k] ?? null) !== JSON.stringify(saved[k] ?? null));

async function load() {
  const [snap, us] = await Promise.all([getDoc(doc(db, "settings", "unit_cards")), getUsers()]);
  data = snap.exists() ? snap.data() : {};
  saved = JSON.parse(JSON.stringify(data));
  users = us.filter(isMember).sort((a, b) => memberName(a).localeCompare(memberName(b)));
  render();
}

function unitStats(u) {
  let f = 0, o = 0, n = 0;
  for (const [section, slots] of Object.entries(STRUCTURE[u].sections)) {
    const { staff, squads } = groupSlots(slots);
    const keys = [...staff.map((s) => slotKey(u, section, s, "")), ...squads.flatMap((q) => q.slots.map((s) => slotKey(u, section, s, q.name)))];
    for (const k of keys) {
      n++;
      const st = data[k]?.status || "open";
      if (st === "filled") f++;
      else if (st === "open") o++;
    }
  }
  return { f, o, n };
}

// Public page each unit card is shown on (approved mock 2026-11-11: editor + live public preview).
const PAGES = {
  "Battalion Command": ["505th Expeditionary Force", "/about-505th"], "Alpha Company": ["Alpha Company", "/about-alpha-company"],
  "JSOTF-23": ["JTF-23 Force Recon", "/about-stalker"], "Support Company": ["Hospital Corpsman", "/about-corpsman"], "54th Air Wing": ["54th Air Wing", "/about-54th-air-wing"],
};
const ORDER = ["Battalion Command", "Alpha Company", "JSOTF-23", "Support Company", "54th Air Wing"];
const userById = (id) => users.find((u) => u.id === id);
const rankOf = (u) => (u ? rankAbbr(u.rank || "") : "");
const nameOf = (u) => (u ? memberName(u).replace(/^\S+\s/, (m) => (rankOf(u) && m.trim() === rankOf(u) ? "" : m)) : "");

function rowHtml(u, section, s, squad) {
  const k = slotKey(u, section, s, squad);
  const v = data[k] || { status: "open", name: "", userId: "" };
  const st = v.status || "open";
  const dirty = JSON.stringify(data[k] ?? null) !== JSON.stringify(saved[k] ?? null);
  const opts = `<option value="">— pick a member —</option>${!v.userId && v.name ? `<option value="__typed" selected>★ ${esc(v.name)} (typed name, not linked)</option>` : ""}${users.map((x) => `<option value="${esc(x.id)}" ${x.id === v.userId ? "selected" : ""}>${esc(memberName(x))}</option>`).join("")}`;
  return `<div class="row${dirty ? " dirty" : ""}"><span class="sl" title="${esc(s)}">${esc(s)}</span>
    <div class="seg" role="group" aria-label="${esc(s)} status">${["open", "filled", "closed"].map((t) => `<button type="button" class="${t}${st === t ? " on" : ""}" aria-pressed="${st === t}" data-k="${esc(k)}" data-st="${t}">${t.toUpperCase()}</button>`).join("")}</div>
    <div class="mem">${st === "filled" ? `<select class="fld" data-mk="${esc(k)}" aria-label="Member for ${esc(s)}">${opts}</select>` : `<span class="na">${st === "open" ? "— open, recruiting —" : "— closed —"}</span>`}</div></div>`;
}

/** Public preview — same look as the career page (design B). */
function previewHtml(u) {
  const cfg = STRUCTURE[u];
  const slot = (section, s, squad) => {
    const v = data[slotKey(u, section, s, squad)] || {};
    const st = v.status === "filled" || v.status === "closed" ? v.status : "open";
    const m = userById(v.userId);
    return { s, st, rank: st === "filled" ? rankOf(m) : "", name: st === "filled" ? (m ? nameOf(m) : v.name || "") : "" };
  };
  let h = "";
  for (const [section, slots] of Object.entries(cfg.sections)) {
    if (data[hiddenKey(u, section)] === true) { h += `<div class="pv-hid">“${esc(section)}” is hidden — visitors don't see it</div>`; continue; }
    const { staff, squads } = groupSlots(slots);
    const all = [...staff.map((s) => slot(section, s, "")), ...squads.flatMap((q) => q.slots.map((s) => slot(section, s, q.name)))];
    const f = all.filter((x) => x.st === "filled").length, t = all.filter((x) => x.st !== "closed").length;
    h += `<div class="pv-pl"><div class="pv-plh"><b>${esc(u === "Battalion Command" ? "COMMAND STAFF" : section.toUpperCase())}</b><span>${t ? `${f} / ${t} FILLED` : "NOT RECRUITING"}<i><u style="width:${t ? (f / t) * 100 : 0}%"></u></i></span></div>
      ${staff.length ? `<div class="pv-lead">${staff.map((s) => { const x = slot(section, s, ""); const c = x.st[0]; return `<div class="pv-ldr"><div class="pv-hex ${c}">${c === "f" ? esc(x.rank || "★") : c === "o" ? "+" : "—"}</div><div><div class="pv-r">${esc(s.toUpperCase())}</div><div class="pv-n ${c}">${c === "f" ? esc(`${x.rank ? x.rank + " " : ""}${x.name}`) : c === "o" ? "Open" : "Closed"}</div></div></div>`; }).join("")}</div>` : ""}
      ${squads.length ? `<div class="pv-sqs">${squads.map((q) => `<div class="pv-sq"><div class="pv-sqh">${esc(q.name.toUpperCase())}</div>${q.slots.map((s, i) => { const x = slot(section, s, q.name); const c = x.st[0]; return `<div class="pv-sl ${c}${i === 0 ? " sql" : ""}"><span class="d"></span><span class="w">${c === "f" ? esc(x.name) : c === "o" ? "Open" : "Closed"}</span>${c === "f" ? `<span class="rk">${esc(x.rank || "—")}</span>` : ""}</div>`; }).join("")}</div>`).join("")}</div>` : ""}</div>`;
  }
  return h;
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  root.querySelector(".units").innerHTML = ORDER.map((u) => {
    const s = unitStats(u);
    return `<button class="ut ${u === unit ? "on" : ""}" style="--ac:${STRUCTURE[u].accent}" data-unit="${esc(u)}"><i></i>${esc(PAGES[u][0].toUpperCase())}<small>${s.f}/${s.f + s.o}</small></button>`;
  }).join("");
  const cfg = STRUCTURE[unit];
  root.querySelector(".edT").textContent = PAGES[unit][0].toUpperCase();
  root.querySelector(".edS").textContent = "PUBLIC CARD: " + unit.toUpperCase();
  root.querySelector(".pvurl").textContent = "505expeditionaryforce.com" + PAGES[unit][1];
  root.querySelector(".sects").innerHTML = Object.entries(cfg.sections).map(([section, slots]) => {
    const hk = hiddenKey(unit, section);
    const hidden = data[hk] === true;
    const { staff, squads } = groupSlots(slots);
    return `<div class="sect" style="--ac:${cfg.accent}"><div class="sh"><b>${esc(section)}</b><button type="button" class="tog${hidden ? " off" : ""}" role="switch" aria-checked="${!hidden}" data-hide="${esc(hk)}"><span></span>${hidden ? "HIDDEN" : "SHOWN"}</button></div>
      <div class="sq">${staff.map((s) => rowHtml(unit, section, s, "")).join("")}${squads.map((q) => `<div class="sqn">${esc(q.name.toUpperCase())}</div>${q.slots.map((s) => rowHtml(unit, section, s, q.name)).join("")}`).join("")}</div></div>`;
  }).join("");
  const pv = root.querySelector(".pv");
  pv.style.setProperty("--ac", cfg.accent);
  pv.innerHTML = previewHtml(unit);
  const n = dirtyKeys().length;
  const bar = root.querySelector(".savebar");
  bar.classList.toggle("show", n > 0);
  bar.querySelector(".dn").textContent = `${n} UNSAVED CHANGE${n === 1 ? "" : "S"}`;
}

/** Set one slot. Filled keeps / asks for a member; open + closed clear the member. */
function setSlot(k, st, uid) {
  const v = data[k] || { status: "open", name: "", userId: "" };
  if (st !== "filled") data[k] = { status: st, name: "", userId: "" };
  else {
    const id = uid === undefined ? v.userId : uid === "__typed" ? "" : uid;
    const m = userById(id);
    data[k] = { status: "filled", userId: id || "", name: m ? memberName(m) : id === "" && uid === "__typed" ? v.name : v.name || "" };
  }
  render();
}

async function save() {
  const changed = dirtyKeys();
  if (!changed.length) return;
  try {
    await setDoc(doc(db, "settings", "unit_cards"), data);
    const lines = changed.map((k) => {
      const nd = data[k], od = saved[k];
      const [page, ...rest] = k.split("__");
      if (k.startsWith("__SECTION_HIDDEN__")) return `${k.replace("__SECTION_HIDDEN__", "")}: ${nd ? "hidden" : "visible"}`;
      if (nd?.status !== od?.status) return `${page}/${rest.join("/")}: status ${od?.status || "?"} → ${nd?.status || "?"}`;
      return `${page}/${rest.join("/")}: ${od?.name || "empty"} → ${nd?.name || "empty"}`;
    });
    await audit("public_comms", "ORDER OF BATTLE SAVED", lines.slice(0, 20).join("; ") + (lines.length > 20 ? ` (+${lines.length - 20} more)` : ""));
    saved = JSON.parse(JSON.stringify(data));
    notify("✓ ORDER OF BATTLE SAVED — PUBLIC PAGE UPDATED");
    render();
  } catch (e) {
    notify("SAVE FAILED: " + e.message, 1);
  }
}

const CSS = `
#${ROOT} .units{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
#${ROOT} .ut{display:flex;gap:8px;align-items:center;border:1px solid rgba(0,217,255,.18);background:none;padding:8px 12px;font:700 12px 'Share Tech Mono',monospace;letter-spacing:1.5px;color:#6f8a96;cursor:pointer}
#${ROOT} .ut i{width:10px;height:10px;background:var(--ac)}#${ROOT} .ut small{font-size:10px;opacity:.8}
#${ROOT} .ut.on{color:#fff;border-color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,transparent)}#${ROOT} .ut:focus-visible{outline:2px solid #00D9FF}
#${ROOT} .lay{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:1100px){#${ROOT} .lay{grid-template-columns:1fr}}
#${ROOT} .card{border:1px solid rgba(0,217,255,.18);background:rgba(0,0,0,.25)}
#${ROOT} .ch{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(0,217,255,.18)}#${ROOT} .ch b{font:700 12px 'Share Tech Mono',monospace;letter-spacing:2px;color:#00D9FF}#${ROOT} .ch small{font:10px 'Share Tech Mono',monospace;color:#6f8a96;letter-spacing:1px}
#${ROOT} .sect{border-bottom:1px solid rgba(0,217,255,.08)}
#${ROOT} .sh{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,217,255,.04)}#${ROOT} .sh b{flex:1;font:700 13px Rajdhani,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--ac)}
#${ROOT} .tog{display:flex;gap:6px;align-items:center;background:none;border:0;cursor:pointer;font:10px 'Share Tech Mono',monospace;letter-spacing:1px;color:#6f8a96}
#${ROOT} .tog span{width:30px;height:16px;border:1px solid #22e07a;background:rgba(34,224,122,.2);position:relative}#${ROOT} .tog span:after{content:"";position:absolute;right:2px;top:2px;width:10px;height:10px;background:#22e07a}
#${ROOT} .tog.off span{border-color:#6f8a96;background:none}#${ROOT} .tog.off span:after{left:2px;right:auto;background:#6f8a96}#${ROOT} .tog:focus-visible{outline:2px solid #00D9FF}
#${ROOT} .sq{padding:4px 14px 8px}#${ROOT} .sqn{font:700 11px 'Share Tech Mono',monospace;letter-spacing:2px;color:var(--ac);margin:10px 0 2px}
#${ROOT} .row{display:grid;grid-template-columns:150px 228px minmax(0,1fr);gap:12px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.03);position:relative}
#${ROOT} .row.dirty:before{content:"●";position:absolute;left:-11px;color:#f59e0b;font-size:9px}
#${ROOT} .row .sl{font-weight:600;color:#e0e0e0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .seg{display:flex;gap:4px}#${ROOT} .seg button{flex:1;cursor:pointer;text-align:center;font:700 10px 'Share Tech Mono',monospace;letter-spacing:1px;padding:6px 8px;color:#6f8a96;border:1px solid rgba(0,217,255,.2);background:#061018}
#${ROOT} .seg button:hover{border-color:rgba(0,217,255,.5);color:#cfe9f2}#${ROOT} .seg button:focus-visible{outline:2px solid #00D9FF}
#${ROOT} .seg button.on.open{background:rgba(0,217,255,.15);color:#00D9FF;border-color:#00D9FF}#${ROOT} .seg button.on.filled{background:rgba(138,173,68,.22);color:#b0d860;border-color:#8aad44}#${ROOT} .seg button.on.closed{background:#1b2328;color:#c4ccd2;border-color:#55626a}
#${ROOT} .mem .na{font-size:12px;color:#4d6470}
@media(max-width:620px){#${ROOT} .row{grid-template-columns:1fr;gap:6px;padding:10px 0}}
#${ROOT} .ft{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;font:10px 'Share Tech Mono',monospace;color:#6f8a96;letter-spacing:1px}
#${ROOT} .pvw{background:#050709;padding:16px}
#${ROOT} .pvbar{font:10px 'Share Tech Mono',monospace;letter-spacing:1px;color:#6f8a96;margin-bottom:12px;border:1px solid rgba(0,217,255,.18);padding:3px 8px;background:#0a1216}
#${ROOT} .pv{--ac:#8aad44}
#${ROOT} .pv-hid{font:11px 'Share Tech Mono',monospace;color:#6f8a96;text-align:center;border:1px dashed rgba(0,217,255,.18);padding:8px;margin:8px 0}
#${ROOT} .pv-pl{border:1px solid color-mix(in srgb,var(--ac) 30%,transparent);margin-bottom:12px}
#${ROOT} .pv-plh{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 14%,transparent),transparent)}
#${ROOT} .pv-plh b{font:700 13px 'Share Tech Mono',monospace;letter-spacing:2px;color:var(--ac)}#${ROOT} .pv-plh span{font:10px 'Share Tech Mono',monospace;color:#8a9aa6}#${ROOT} .pv-plh i{display:inline-block;width:70px;height:5px;background:#162027;margin-left:6px;vertical-align:middle}#${ROOT} .pv-plh u{display:block;height:100%;background:var(--ac)}
#${ROOT} .pv-lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;padding:8px 12px}
#${ROOT} .pv-ldr{display:flex;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.07);padding:6px 8px;background:#0a1216}
#${ROOT} .pv-hex{width:30px;height:33px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);display:grid;place-items:center;font:700 9px 'Share Tech Mono',monospace;flex:0 0 auto}
#${ROOT} .pv-hex.f{background:var(--ac);color:#fff}#${ROOT} .pv-hex.o{background:rgba(0,217,255,.14);color:#00D9FF}#${ROOT} .pv-hex.c{background:#1b2328;color:#55626a}
#${ROOT} .pv-r{font:9px 'Share Tech Mono',monospace;color:#8a9aa6}#${ROOT} .pv-n{font-weight:700;font-size:12px}#${ROOT} .pv-n.o{color:rgba(0,217,255,.65);font-style:italic}#${ROOT} .pv-n.c{color:#6b7880}
#${ROOT} .pv-sqs{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;padding:0 12px 10px}
#${ROOT} .pv-sq{border:1px solid rgba(255,255,255,.08);background:#0a1216}#${ROOT} .pv-sqh{font:700 10px 'Share Tech Mono',monospace;letter-spacing:1.5px;color:var(--ac);padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
#${ROOT} .pv-sl{display:grid;grid-template-columns:12px 1fr auto;gap:6px;align-items:center;padding:3px 8px;font-size:12px}
#${ROOT} .pv-sl .d{width:7px;height:7px;border-radius:50%}#${ROOT} .pv-sl.f .d{background:var(--ac)}#${ROOT} .pv-sl.o .d{border:1px dashed #00D9FF}#${ROOT} .pv-sl.c .d{background:#2a343b}
#${ROOT} .pv-sl.o .w{color:rgba(0,217,255,.6);font-style:italic}#${ROOT} .pv-sl.c .w{color:#55626a}#${ROOT} .pv-sl .rk{font:700 9px 'Share Tech Mono',monospace;border:1px solid color-mix(in srgb,var(--ac) 45%,transparent);padding:0 4px}
#${ROOT} .pv-sl.sql{background:color-mix(in srgb,var(--ac) 7%,transparent)}
#${ROOT} .savebar{position:sticky;bottom:10px;display:none;align-items:center;justify-content:space-between;gap:10px;border:1px solid #f59e0b;background:#141006;padding:10px 14px;font-size:11px;letter-spacing:2px;color:#f59e0b;margin-top:10px;z-index:5}
#${ROOT} .savebar.show{display:flex}
`;

onReady(() => {
  const root = mountPanel("panel-unitcards", ROOT, () => load().catch((e) => notify("ORDER OF BATTLE LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">ORDER OF BATTLE</div>
    <div class="bar" style="margin-top:10px"><span class="sub" style="margin:0">SETS THE UNIT CARDS ON THE PUBLIC CAREER PAGES · LIVE PREVIEW ON THE RIGHT</span><span class="sp"></span><button class="b" data-act="public">↗ VIEW PUBLIC PAGE</button></div>
    <div class="units"></div>
    <div class="lay"><div class="card"><div class="ch"><b class="edT">EDIT</b><small class="edS"></small></div><div class="sects"><div class="empty">LOADING...</div></div>
      <div class="ft"><span>FILLED + MEMBER = RANK &amp; NAME STAY IN SYNC WITH PERSONNEL FILES</span></div></div>
      <div class="card"><div class="ch"><b>PUBLIC PAGE PREVIEW</b><small>WHAT VISITORS SEE</small></div><div class="pvw"><div class="pvbar">🌐 <span class="pvurl"></span></div><div class="pv"></div></div></div></div>
    <div class="savebar"><span class="dn"></span><div style="display:flex;gap:8px"><button class="b" data-act="discard">DISCARD</button><button class="b gold" data-act="save">SAVE · UPDATE PUBLIC PAGE</button></div></div>`;
  root.addEventListener("click", (e) => {
    const ut = e.target.closest("[data-unit]");
    if (ut) { unit = ut.dataset.unit; return render(); }
    const sb = e.target.closest("[data-st]");
    if (sb) return setSlot(sb.dataset.k, sb.dataset.st);
    const hk = e.target.closest("[data-hide]");
    if (hk) { data[hk.dataset.hide] = !(data[hk.dataset.hide] === true); return render(); }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save") return save();
    if (act === "discard") { data = JSON.parse(JSON.stringify(saved)); return render(); }
    if (act === "public") return window.open(PAGES[unit][1], "_blank", "noopener");
  });
  root.addEventListener("change", (e) => {
    const m = e.target.closest("select[data-mk]");
    if (m) setSlot(m.dataset.mk, "filled", m.value);
  });
  addEventListener("beforeunload", (e) => {
    if (dirtyKeys().length) e.preventDefault();
  });
});
