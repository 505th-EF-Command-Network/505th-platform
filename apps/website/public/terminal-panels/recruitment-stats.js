/**
 * RECRUITMENT STATS v2 (was Recruitment Source; approved mock 2026-11-09) — replaces #panel-recruit-source.
 * Read-only. Uses users.recruitSource (tagged at approval), approvedAt / joinedAt
 * and bctInstructor. Same source list and colours as the original.
 */
import { addCss, esc, getUsers, isMember, memberName, mountPanel, notify, onReady, toDate, ukDate } from "./_common.js";

const ROOT = "rsV2";
const SOURCES = ["Reddit", "Steam Community", "Disboard", "Discord", "Word of Mouth", "Other"];
const COLORS = { Reddit: "#FF4500", "Steam Community": "#66c0f4", Disboard: "#5865F2", Discord: "#7289da", "Word of Mouth": "#22e07a", Other: "#aeb9c4" };
let users = [];
let filter = "";

const joined = (u) => toDate(u.approvedAt) || toDate(u.joinedAt) || toDate(u.graduation) || toDate(u.createdAt);
const instructor = (u) => {
  const id = u.bctInstructor;
  if (!id) return "—";
  const i = users.find((x) => x.id === id || x.callsign === id);
  return i ? memberName(i) : String(id);
};

async function load() {
  users = (await getUsers()).filter(isMember);
  render();
}

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  const tagged = users.filter((u) => u.recruitSource);
  const counts = Object.fromEntries(SOURCES.map((s) => [s, 0]));
  for (const u of tagged) counts[u.recruitSource] = (counts[u.recruitSource] || 0) + 1;
  const total = tagged.length;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const now = new Date();
  const thisMonth = tagged.filter((u) => {
    const d = joined(u);
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const max = Math.max(1, ...Object.values(counts));

  // last 6 months (oldest → newest)
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString("en-GB", { month: "short" }).toUpperCase() };
  });
  for (const mo of months) mo.n = users.filter((u) => (!filter || u.recruitSource === filter) && ((d) => d && d.getFullYear() === mo.y && d.getMonth() === mo.m)(joined(u))).length;
  const mMax = Math.max(1, ...months.map((x) => x.n));

  const recent = tagged
    .filter((u) => !filter || u.recruitSource === filter)
    .sort((a, b) => (joined(b)?.getTime() || 0) - (joined(a)?.getTime() || 0))
    .slice(0, 25);

  root.querySelector(".body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><b>${total}</b><span>RECRUITS TAGGED</span></div>
      <div class="kpi"><b>${thisMonth}</b><span>THIS MONTH</span></div>
      <div class="kpi"><b style="color:${COLORS[top?.[0]] || "#00D9FF"}">${total && top?.[1] ? Math.round((top[1] / total) * 100) + "%" : "—"}</b><span>TOP: ${esc((total && top?.[1] ? top[0] : "—").toUpperCase())}</span></div>
      <div class="kpi"><b style="color:#f59e0b">${users.length - total}</b><span>NOT TAGGED</span></div>
    </div>
    <div class="grid2">
      <div class="card"><div class="ch">SOURCE BREAKDOWN <small>ALL TIME · CLICK TO FILTER</small></div>
        ${
          total
            ? Object.entries(counts)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([s, n]) => `<button class="src ${filter === s ? "on" : ""}" data-src="${esc(s)}" aria-pressed="${filter === s}">
                    <div class="sr"><span>${esc(s)}</span><span><b style="color:${COLORS[s] || "#00D9FF"}">${Math.round((n / total) * 100)}%</b> ${n} recruit${n === 1 ? "" : "s"}</span></div>
                    <div class="track"><i style="width:${Math.round((n / max) * 100)}%;background:${COLORS[s] || "#00D9FF"}"></i></div></button>`)
                .join("")
            : '<div class="empty">NO SOURCE DATA YET — TAG SOURCES WHEN APPROVING RECRUITS</div>'
        }</div>
      <div class="card"><div class="ch">RECRUITS PER MONTH <small>LAST 6 MONTHS${filter ? " · " + esc(filter.toUpperCase()) : ""}</small></div>
        <div class="bars">${months.map((mo) => `<div class="bc"><span class="bn">${mo.n}</span><div class="bv" style="height:${Math.max(2, Math.round((mo.n / mMax) * 100))}%"></div><span class="bl">${mo.label}</span></div>`).join("")}</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><div class="ch">RECENT RECRUITS <small>${filter ? esc(filter.toUpperCase()) + ' · <button class="clr" data-src="">✕ CLEAR FILTER</button>' : "ALL SOURCES"}</small></div>
      <table class="t"><thead><tr><th>NAME</th><th>SOURCE</th><th>BCT INSTRUCTOR</th><th>APPROVED</th></tr></thead><tbody>
      ${
        recent.length
          ? recent.map((u) => `<tr><td class="nm">${esc(memberName(u))}</td><td style="color:${COLORS[u.recruitSource] || "#aeb9c4"}">${esc(u.recruitSource)}</td><td>${esc(instructor(u))}</td><td class="dt">${joined(u) ? ukDate(joined(u)) : "—"}</td></tr>`).join("")
          : '<tr><td colspan="4" class="empty">NO TAGGED RECRUITS YET</td></tr>'
      }</tbody></table></div>`;
}

const CSS = `
#${ROOT} .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
#${ROOT} .kpi{border:1px solid var(--l);background:var(--p);padding:12px 14px}
#${ROOT} .kpi b{display:block;font-family:Rajdhani,sans-serif;font-size:26px;color:var(--a)}
#${ROOT} .kpi span{font-size:9.5px;letter-spacing:2px;color:var(--d)}
#${ROOT} .grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}
#${ROOT} .card{border:1px solid var(--l);background:var(--p);padding:14px}
#${ROOT} .ch{font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;font-size:13px;color:var(--a);margin-bottom:12px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
#${ROOT} .ch small{font-family:'Share Tech Mono',monospace;font-weight:400;font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
#${ROOT} .src{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;padding:6px 8px;margin-bottom:6px;cursor:pointer;font:inherit;color:inherit}
#${ROOT} .src:hover,#${ROOT} .src.on{border-color:var(--l2);background:rgba(0,217,255,.04)}
#${ROOT} .sr{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;color:#d6dde6}
#${ROOT} .sr b{margin-right:8px}
#${ROOT} .track{height:7px;background:rgba(255,255,255,.06)}#${ROOT} .track i{display:block;height:100%;opacity:.85}
#${ROOT} .bars{display:flex;align-items:flex-end;gap:10px;height:170px;padding-top:10px}
#${ROOT} .bc{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}
#${ROOT} .bv{width:100%;max-width:42px;background:linear-gradient(#00D9FF,rgba(0,217,255,.35))}
#${ROOT} .bn{font-size:11px;color:#fff}#${ROOT} .bl{font-size:9.5px;letter-spacing:1.5px;color:var(--d)}
#${ROOT} .t{width:100%;border-collapse:collapse;font-size:12px}
#${ROOT} .t th{text-align:left;font-size:9.5px;letter-spacing:2px;color:var(--d);font-weight:400;padding:6px 8px;border-bottom:1px solid var(--l)}
#${ROOT} .t td{padding:8px;border-bottom:1px solid rgba(255,255,255,.04)}
#${ROOT} .t .nm{font-family:Rajdhani,sans-serif;font-weight:700;font-size:13.5px;color:#fff}
#${ROOT} .t .dt{color:var(--d)}
#${ROOT} .clr{background:none;border:none;color:var(--am);font:inherit;cursor:pointer;letter-spacing:1px}
@media(max-width:900px){#${ROOT} .kpis{grid-template-columns:1fr 1fr}#${ROOT} .grid2{grid-template-columns:1fr}}
`;

onReady(() => {
  const root = mountPanel("panel-recruit-source", ROOT, () => load().catch((e) => notify("RECRUITMENT STATS LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `<div class="h1">RECRUITMENT STATS</div><div class="sub">WHERE NEW MARINES HEAR ABOUT THE 505TH — TAGGED AT BCT APPROVAL</div><div class="body"><div class="empty">LOADING...</div></div>`;
  root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-src]");
    if (!s) return;
    filter = filter === s.dataset.src ? "" : s.dataset.src;
    render();
  });
});
