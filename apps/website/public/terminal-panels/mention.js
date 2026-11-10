/**
 * @ MENTIONS — type "@" in a message box on the Discord pages (Send Message, Tickets, Info Posts, Quick Upload)
 * and a dark list of members + roles appears. Pick one → <@id> / <@&id> is inserted (Discord's mention code).
 * Previews show it as @Name. Cortana pings only the people / roles in the text (never @everyone from text).
 * Keys: ↑ ↓ to move · Enter / Tab to pick · Esc to close.
 */
import { collection, getDocs } from "/terminal-shim/firestore.js";
import { addCss, db, esc, memberName, onReady, rankAbbr } from "./_common.js";

const ROOTS = "#sendV2, #ticketsV2, #infoV2, #quickV2";
let list = null; // [{kind:"user"|"role", id, name, sub, color}]
let loading = null;
window.__mn = window.__mn || {}; // id → display name, used by previews (discord-common md)

async function load() {
  if (list) return list;
  if (!loading) loading = (async () => {
    const [us, rs] = await Promise.all([getDocs(collection(db, "users")).catch(() => null), getDocs(collection(db, "discord_roles")).catch(() => null)]);
    const users = (us?.docs || []).map((d) => d.data()).filter((u) => /^\d{17,20}$/.test(String(u.discordId || "")) && u.status !== "denied")
      .map((u) => ({ kind: "user", id: String(u.discordId), name: memberName(u), sub: [rankAbbr(u.rank), u.platoon].filter(Boolean).join(" · ") }));
    const roles = (rs?.docs || []).map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => (b.position || 0) - (a.position || 0)).map((r) => ({ kind: "role", id: r.id, name: r.name, color: r.color && r.color !== "#000000" ? r.color : "" }));
    list = [...users, ...roles];
    for (const x of list) window.__mn[x.id] = (x.kind === "role" ? "@" : "@") + x.name;
    return list;
  })();
  return loading;
}

let pop = null; // { el, dd, start, items, hi }
function close() { pop?.dd.remove(); pop = null; }

function render() {
  const { dd, items, hi } = pop;
  dd.innerHTML = items.length
    ? items.map((x, n) => `<div class="o ${n === hi ? "hi" : ""}" role="option" aria-selected="${n === hi}" data-n="${n}">${x.kind === "role" ? `<span class="dot" style="background:${x.color || "#99aab5"}"></span><b>@${esc(x.name)}</b><span class="mn-k">ROLE</span>` : `<span class="mn-a">@</span><b>${esc(x.name)}</b><span class="mn-k">${esc(x.sub || "MEMBER")}</span>`}</div>`).join("")
    : '<div class="none">No match</div>';
  dd.querySelector(".hi")?.scrollIntoView({ block: "nearest" });
}

function place(el) {
  const r = el.getBoundingClientRect();
  const top = r.bottom + 4 + 260 > innerHeight ? Math.max(8, r.top - 264) : r.bottom + 4;
  Object.assign(pop.dd.style, { left: Math.min(r.left, innerWidth - 330) + "px", top: top + "px", width: "320px" });
}

function pick(n) {
  const x = pop.items[n];
  if (!x) return close();
  const el = pop.el, v = el.value, caret = el.selectionStart;
  const code = x.kind === "role" ? `<@&${x.id}>` : `<@${x.id}>`;
  el.value = v.slice(0, pop.start) + code + " " + v.slice(caret);
  const at = pop.start + code.length + 1;
  close();
  el.focus();
  el.setSelectionRange(at, at);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function check(el) {
  if (!el.isConnected) return close();
  const caret = el.selectionStart ?? 0;
  const m = el.value.slice(0, caret).match(/(^|\s)@([^\s@<>]{0,32})$/);
  if (!m) return close();
  const all = await load();
  const q = m[2].toLowerCase();
  const items = all.filter((x) => !q || x.name.toLowerCase().includes(q) || (x.sub || "").toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q))).slice(0, 30);
  if (!pop || pop.el !== el) {
    close();
    const dd = document.createElement("div");
    dd.className = "ukp-dd mn-dd";
    dd.setAttribute("role", "listbox");
    dd.setAttribute("aria-label", "Mention someone");
    dd.addEventListener("mousedown", (e) => { e.preventDefault(); const o = e.target.closest("[data-n]"); if (o) pick(+o.dataset.n); });
    document.body.appendChild(dd);
    pop = { el, dd, start: 0, items: [], hi: 0 };
  }
  pop.start = caret - m[2].length - 1;
  pop.items = items;
  pop.hi = Math.min(pop.hi, Math.max(0, items.length - 1));
  place(el);
  render();
}

const isBox = (t) => t && t.matches?.("textarea.fld, input.fld:not([type]), input.fld[type=text]") && t.closest(ROOTS);

onReady(() => {
  addCss("mention", `
.mn-dd .o b{font-weight:600;color:#cfe9f2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mn-dd .o.hi b{color:#00D9FF}
.mn-dd .mn-a{width:20px;height:20px;border-radius:50%;background:rgba(0,217,255,.15);color:#00D9FF;display:grid;place-items:center;font:700 11px monospace;flex-shrink:0}
.mn-dd .mn-k{margin-left:auto;padding-left:10px;font:10px monospace;letter-spacing:1px;color:#6f8a96;white-space:nowrap}
.mn-tip{font:10px monospace;letter-spacing:1px;color:#6f8a96}`);
  document.addEventListener("input", (e) => { if (isBox(e.target)) void check(e.target); });
  document.addEventListener("focusin", (e) => { if (isBox(e.target)) void load(); });
  document.addEventListener("keydown", (e) => {
    if (!pop || e.target !== pop.el) return;
    if (e.key === "ArrowDown") { e.preventDefault(); pop.hi = Math.min(pop.items.length - 1, pop.hi + 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); pop.hi = Math.max(0, pop.hi - 1); render(); }
    else if ((e.key === "Enter" || e.key === "Tab") && pop.items.length) { e.preventDefault(); e.stopPropagation(); pick(pop.hi); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);
  document.addEventListener("focusout", (e) => { if (pop && e.target === pop.el) setTimeout(() => pop && document.activeElement !== pop.el && close(), 120); });
  document.addEventListener("scroll", (e) => { if (pop && !pop.dd.contains(e.target)) close(); }, true);
  addEventListener("resize", close);
});
