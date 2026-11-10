/**
 * ORDER OF BATTLE v2 (was Unit Cards; approved mock 2026-11-09) — replaces #panel-unitcards.
 * Same data as the original: settings/unit_cards, one entry per slot
 * ({status:'open'|'closed'|'filled', name, userId}) plus __SECTION_HIDDEN__ flags.
 * Structure and key format are copied 1:1 from the original so the public
 * Order of Battle page keeps working.
 */
import { doc, getDoc, setDoc } from "/terminal-shim/firestore.js";
import { addCss, audit, db, esc, getUsers, isMember, memberName, mountPanel, notify, onReady } from "./_common.js";

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

function slotHtml(u, section, s, squad) {
  const k = slotKey(u, section, s, squad);
  const v = data[k] || { status: "open", name: "", userId: "" };
  const st = v.status || "open";
  const who = st === "filled" ? v.name || "—" : st === "open" ? "OPEN — RECRUITING" : "CLOSED";
  const dirty = JSON.stringify(data[k] ?? null) !== JSON.stringify(saved[k] ?? null);
  return `<button class="slot ${st} ${dirty ? "dirty" : ""}" data-key="${esc(k)}" data-pos="${esc(s)}"><span class="pos">${esc(s.toUpperCase())}</span><span class="who">${esc(who)}</span></button>`;
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  root.querySelector(".units").innerHTML = Object.keys(STRUCTURE)
    .map((u) => {
      const s = unitStats(u);
      return `<button class="ut ${u === unit ? "on" : ""}" data-unit="${esc(u)}">${esc(u.toUpperCase())}<small>${s.f} FILLED · ${s.o} OPEN</small></button>`;
    })
    .join("");
  const cfg = STRUCTURE[unit];
  root.querySelector(".sects").innerHTML = Object.entries(cfg.sections)
    .map(([section, slots]) => {
      const hk = hiddenKey(unit, section);
      const hidden = data[hk] === true;
      const { staff, squads } = groupSlots(slots);
      const filled = [...staff.map((s) => slotKey(unit, section, s, "")), ...squads.flatMap((q) => q.slots.map((s) => slotKey(unit, section, s, q.name)))].filter((k) => data[k]?.status === "filled").length;
      return `<div class="sect" style="--ac:${cfg.accent}">
        <div class="sect-h"><h3>${esc(section.toUpperCase())}</h3><div class="meta">${filled}/${slots.length} FILLED
          <button class="vis ${hidden ? "off" : ""}" data-hide="${esc(hk)}">${hidden ? "◌ HIDDEN ON PUBLIC PAGE" : "◉ VISIBLE ON PUBLIC PAGE"}</button></div></div>
        ${
          hidden
            ? '<div class="hidnote">THIS PLATOON IS HIDDEN ON THE PUBLIC ORDER OF BATTLE PAGE.</div>'
            : `${staff.length ? `<div class="squad"><div class="slots">${staff.map((s) => slotHtml(unit, section, s, "")).join("")}</div></div>` : ""}
               ${squads.map((q) => `<div class="squad"><h4>${esc(q.name.toUpperCase())}<span>${q.slots.filter((s) => data[slotKey(unit, section, s, q.name)]?.status === "filled").length}/${q.slots.length} FILLED</span></h4><div class="slots">${q.slots.map((s) => slotHtml(unit, section, s, q.name)).join("")}</div></div>`).join("")}`
        }</div>`;
    })
    .join("");
  const n = dirtyKeys().length;
  const bar = root.querySelector(".savebar");
  bar.classList.toggle("show", n > 0);
  bar.querySelector(".dn").textContent = `${n} UNSAVED CHANGE${n === 1 ? "" : "S"}`;
}

function openPop(btn) {
  closePop();
  popKey = btn.dataset.key;
  const v = data[popKey] || { status: "open", name: "", userId: "" };
  const p = document.createElement("div");
  p.className = "obpop";
  p.id = "obPop";
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Edit slot");
  let st = v.status || "open";
  const draw = () => {
    p.innerHTML = `<div class="t">${esc(btn.dataset.pos.toUpperCase())}</div>
      <label>STATUS</label><div class="seg">${["filled", "open", "closed"].map((s) => `<button data-st="${s}" class="${s === st ? "on " + s : ""}">${s.toUpperCase()}</button>`).join("")}</div>
      <label for="obM">MEMBER</label><select id="obM" ${st !== "filled" ? "disabled" : ""}><option value="">— SELECT —</option>${users.map((u) => `<option value="${esc(u.id)}" ${u.id === v.userId ? "selected" : ""}>${esc(memberName(u))}</option>`).join("")}${!v.userId && v.name ? `<option value="" selected>★ ${esc(v.name)} (no user link)</option>` : ""}</select>
      <div class="pa"><button class="b" data-pa="cancel">CANCEL</button><button class="b gold" data-pa="apply">APPLY</button></div>`;
  };
  draw();
  document.body.appendChild(p);
  const r = btn.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(r.left, innerWidth - 280)) + "px";
  p.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - p.offsetHeight - 8)) + "px";
  p.addEventListener("click", (e) => {
    e.stopPropagation();
    const sb = e.target.closest("[data-st]");
    if (sb) {
      st = sb.dataset.st;
      const keepSel = p.querySelector("#obM").value;
      draw();
      if (keepSel) p.querySelector("#obM").value = keepSel;
      return;
    }
    const pa = e.target.closest("[data-pa]")?.dataset.pa;
    if (pa === "cancel") return closePop();
    if (pa === "apply") {
      const uid = p.querySelector("#obM").value;
      if (st === "filled" && !uid && !(v.name && !v.userId)) return notify("PICK A MEMBER", 1);
      const u = users.find((x) => x.id === uid);
      data[popKey] = st === "filled" ? { status: "filled", userId: uid || "", name: u ? memberName(u) : v.name || "" } : { status: st, name: "", userId: "" };
      closePop();
      render();
    }
  });
  p.querySelector("button")?.focus();
}
function closePop() {
  document.getElementById("obPop")?.remove();
  popKey = null;
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#obPop") && !e.target.closest(".slot")) closePop();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && closePop());

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
#${ROOT} .ut{border:1px solid var(--l);background:var(--p);padding:8px 14px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2.5px;font-size:12px;color:var(--d);cursor:pointer;text-align:left}
#${ROOT} .ut.on{color:var(--a);border-color:var(--a)}
#${ROOT} .ut small{display:block;font-family:'Share Tech Mono',monospace;font-weight:400;font-size:9px;letter-spacing:1px;color:var(--d);margin-top:2px}
#${ROOT} .legend3{display:flex;gap:16px;flex-wrap:wrap;font-size:9.5px;letter-spacing:1.5px;color:var(--d);margin:6px 0 12px}
#${ROOT} .legend3 i{display:inline-block;width:10px;height:10px;border:1px solid;margin-right:5px;vertical-align:-1px}
#${ROOT} .sect{border:1px solid var(--l);background:var(--p);margin-bottom:14px}
#${ROOT} .sect-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--l);border-left:3px solid var(--ac);background:rgba(255,255,255,.015)}
#${ROOT} .sect-h h3{margin:0;font-family:Rajdhani,sans-serif;letter-spacing:3px;font-size:14px;color:var(--ac)}
#${ROOT} .sect-h .meta{font-size:9.5px;letter-spacing:1.5px;color:var(--d);display:flex;gap:10px;align-items:center}
#${ROOT} .vis{border:1px solid var(--l2);background:none;color:var(--a);font:inherit;font-size:9.5px;letter-spacing:1.5px;padding:3px 8px;cursor:pointer}
#${ROOT} .vis.off{color:var(--am);border-color:rgba(245,158,11,.5)}
#${ROOT} .hidnote{padding:12px 14px;font-size:10px;letter-spacing:1.5px;color:var(--am)}
#${ROOT} .squad{padding:12px 14px;border-bottom:1px solid rgba(0,217,255,.05)}
#${ROOT} .squad h4{margin:0 0 8px;font-family:Rajdhani,sans-serif;letter-spacing:2.5px;font-size:11.5px;color:var(--ac);opacity:.85;display:flex;justify-content:space-between}
#${ROOT} .squad h4 span{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--d);letter-spacing:1px}
#${ROOT} .slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
#${ROOT} .slot{border:1px solid;padding:9px 10px;cursor:pointer;background:var(--p2);text-align:left;position:relative;font:inherit;color:inherit}
#${ROOT} .slot .pos{display:block;font-size:9px;letter-spacing:1.5px;color:var(--d)}
#${ROOT} .slot .who{display:block;font-size:12.5px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT} .slot.filled{border-color:rgba(34,224,122,.45)}#${ROOT} .slot.filled .who{color:#fff}
#${ROOT} .slot.open{border-color:rgba(0,217,255,.45);border-style:dashed}#${ROOT} .slot.open .who{color:var(--a)}
#${ROOT} .slot.closed{border-color:#26303b;opacity:.6}#${ROOT} .slot.closed .who{color:var(--dd)}
#${ROOT} .slot.dirty::after{content:"●";position:absolute;top:6px;right:8px;color:var(--am);font-size:10px}
#${ROOT} .slot:focus-visible{outline:2px solid var(--a)}
#${ROOT} .savebar{position:sticky;bottom:10px;display:none;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--am);background:#141006;padding:10px 14px;font-size:11px;letter-spacing:2px;color:var(--am);margin-top:10px;z-index:5}
#${ROOT} .savebar.show{display:flex}
.obpop{position:fixed;z-index:9990;background:#0b0f15;border:1px solid rgba(0,217,255,.35);padding:12px;width:270px;box-shadow:0 12px 40px rgba(0,0,0,.6);font-family:'Share Tech Mono',monospace;color:#d6dde6}
.obpop .t{font-size:11px;letter-spacing:1.5px;color:#fff}
.obpop label{display:block;font-size:9.5px;letter-spacing:2px;color:#aeb9c4;margin:10px 0 5px}
.obpop .seg{display:flex;gap:4px}
.obpop .seg button{flex:1;border:1px solid rgba(0,217,255,.18);background:none;padding:6px 0;font:inherit;font-size:10px;letter-spacing:1.5px;color:#7d8a99;cursor:pointer}
.obpop .seg button.on{color:#000}.obpop .seg .filled{background:#22e07a}.obpop .seg .open{background:#00D9FF}.obpop .seg .closed{background:#7d8a99}
.obpop select{width:100%;background:#070a0f;border:1px solid rgba(0,217,255,.35);padding:7px;font:inherit;font-size:12px;outline:0;color:#d6dde6}
.obpop select:disabled{opacity:.4}
.obpop .pa{display:flex;gap:6px;margin-top:12px}.obpop .pa .b{flex:1;background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;padding:7px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;cursor:pointer}
.obpop .pa .b.gold{background:#f59e0b;border-color:#f59e0b;color:#000}
`;

onReady(() => {
  const root = mountPanel("panel-unitcards", ROOT, () => load().catch((e) => notify("ORDER OF BATTLE LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">ORDER OF BATTLE</div>
    <div class="bar" style="margin-top:10px"><span class="sub" style="margin:0">POSITION SLOTS SHOWN ON THE PUBLIC ORDER OF BATTLE PAGE — CLICK A SLOT TO CHANGE IT</span><span class="sp"></span><button class="b" data-act="public">↗ VIEW PUBLIC PAGE</button></div>
    <div class="units"></div>
    <div class="legend3"><span><i style="border-color:#22e07a"></i>FILLED</span><span><i style="border-color:#00D9FF;border-style:dashed"></i>OPEN — RECRUITING</span><span><i style="border-color:#26303b"></i>CLOSED</span><span><span style="color:#f59e0b">●</span> UNSAVED</span></div>
    <div class="sects"><div class="empty">LOADING...</div></div>
    <div class="savebar"><span class="dn"></span><div style="display:flex;gap:8px"><button class="b" data-act="discard">DISCARD</button><button class="b gold" data-act="save">SAVE CHANGES</button></div></div>`;
  root.addEventListener("click", (e) => {
    const ut = e.target.closest("[data-unit]");
    if (ut) {
      unit = ut.dataset.unit;
      return render();
    }
    const sl = e.target.closest(".slot");
    if (sl) {
      e.stopPropagation();
      return openPop(sl);
    }
    const hk = e.target.closest("[data-hide]");
    if (hk) {
      data[hk.dataset.hide] = !(data[hk.dataset.hide] === true);
      return render();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save") return save();
    if (act === "discard") {
      data = JSON.parse(JSON.stringify(saved));
      return render();
    }
    if (act === "public") return window.open("/about-alpha-company", "_blank", "noopener");
  });
  addEventListener("beforeunload", (e) => {
    if (dirtyKeys().length) e.preventDefault();
  });
});
