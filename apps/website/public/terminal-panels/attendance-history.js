/**
 * ATTENDANCE HISTORY v2 (approved mock 2026-11-09) — replaces #panel-att-history.
 * Reads the monthly snapshots in `attendance_history` (written by month-end
 * reset). Snapshot / Backfill use the original functions.
 */
import { collection, getDocs } from "/terminal-shim/firestore.js";
import { addCss, db, esc, mountPanel, notify, onReady, platoonOrder, rateColor } from "./_common.js";

const ROOT = "ahV2";
let months = []; // [{id, month, totalOps, members:[...]}] newest first
let sel = null;
let q = "";
let pl = "";
let noShows = false;
let sortK = "rate";
let sortDir = -1;

async function load() {
  const snap = await getDocs(collection(db, "attendance_history"));
  months = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.id.localeCompare(a.id));
  if (!sel || !months.some((m) => m.id === sel)) sel = months[0]?.id || null;
  render();
}

const label = (id) => {
  const d = new Date(id + "-01T00:00:00");
  return isNaN(d) ? id : d.toLocaleString("en-GB", { month: "short", year: "numeric" }).toUpperCase();
};
const avg = (m) => {
  const ms = (m?.members || []).filter((x) => x.eligible > 0);
  return ms.length ? Math.round(ms.reduce((s, x) => s + (x.rate || 0), 0) / ms.length) : 0;
};

function render() {
  const root = document.getElementById(ROOT);
  if (!root) return;
  if (!months.length) {
    root.querySelector(".body").innerHTML = '<div class="empty">NO HISTORY YET — HISTORY IS SAVED AT MONTH-END RESET</div>';
    return;
  }
  const i = months.findIndex((m) => m.id === sel);
  const m = months[i];
  const prev = months[i + 1];
  const prevRate = new Map((prev?.members || []).map((x) => [x.uid, x.rate || 0]));
  const a = avg(m), pa = prev ? avg(prev) : null;
  const ms = m.members || [];
  const plats = [...new Set(ms.map((x) => x.platoon || ""))].sort((x, y) => platoonOrder(x) - platoonOrder(y));
  let list = ms.filter((x) => (!pl || x.platoon === pl) && String(x.name || "").toLowerCase().includes(q.toLowerCase()) && (!noShows || (x.eligible > 0 && !x.attended)));
  const key = {
    name: (x) => String(x.name || ""), pl: (x) => platoonOrder(x.platoon), att: (x) => x.attended || 0,
    missed: (x) => x.missed || 0, rate: (x) => x.rate || 0, delta: (x) => (prevRate.has(x.uid) ? (x.rate || 0) - prevRate.get(x.uid) : -999),
  }[sortK];
  list = [...list].sort((x, y) => {
    const A = key(x), B = key(y);
    return (A > B ? 1 : A < B ? -1 : 0) * sortDir;
  });

  root.querySelector(".body").innerHTML = `
    <div class="months">${months
      .map((x) => `<button class="mo ${x.id === sel ? "on" : ""}" data-m="${esc(x.id)}">${label(x.id)}<small style="color:${rateColor(avg(x))}">${avg(x)}% · ${x.totalOps || 0} OPS</small></button>`)
      .join("")}</div>
    <div class="kp">
      <div class="k"><b style="color:var(--a)">${m.totalOps || 0}</b><span>OPS</span></div>
      <div class="k"><b style="color:${rateColor(a)}">${a}%</b><span>UNIT AVG ${pa == null ? "" : `<span style="color:${a >= pa ? "var(--g)" : "var(--r)"}">${a >= pa ? "▲" : "▼"} ${Math.abs(a - pa)}%</span>`}</span></div>
      <div class="k"><b style="color:var(--g)">${ms.filter((x) => x.eligible > 0 && x.attended >= x.eligible).length}</b><span>FULL ATTENDANCE</span></div>
      <div class="k"><b style="color:var(--r)">${ms.filter((x) => x.eligible > 0 && !x.attended).length}</b><span>NO-SHOWS</span></div>
      <div class="k"><b style="color:#c6d0da">${m.memberCount || ms.length}</b><span>MEMBERS</span></div>
    </div>
    <div class="bar">
      <input class="srch hq" placeholder="FIND MARINE..." value="${esc(q)}" style="width:200px" aria-label="Find member">
      <select class="srch hpl" aria-label="Platoon"><option value="">ALL PLATOONS</option>${plats.map((p) => `<option ${pl && p === pl ? "selected" : ""} value="${esc(p)}">${esc(p || "No platoon")}</option>`).join("")}</select>
      <span class="sp"></span>
      <label style="font-size:10px;letter-spacing:1.5px;color:var(--d);display:flex;gap:6px;align-items:center"><input type="checkbox" class="hns" ${noShows ? "checked" : ""} style="accent-color:#ff4d4d"> NO-SHOWS ONLY</label>
    </div>
    <div class="wrapx"><table class="t"><thead><tr>
      <th data-k="name">NAME</th><th data-k="pl">PLATOON</th><th data-k="att">ATTENDED</th><th data-k="missed">MISSED</th><th data-k="rate">RATE</th><th data-k="delta">VS ${prev ? label(prev.id) : "LAST MONTH"}</th>
    </tr></thead><tbody>${
      list
        .map((x) => {
          const r = x.rate || 0;
          const d = prevRate.has(x.uid) ? r - prevRate.get(x.uid) : null;
          return `<tr><td><span style="color:#fff">${esc(x.name || "—")}</span>${x.eligible > 0 && !x.attended ? '<span class="ns">NO SHOW</span>' : ""}<span class="s2">${esc(x.rank || "")}</span></td>
            <td><span class="pchip">${esc(x.platoon || "—")}</span></td><td style="color:var(--g)">${x.attended || 0}</td>
            <td style="color:${x.missed ? "var(--r)" : "var(--dd)"}">${x.missed || 0}</td>
            <td><div class="rbar"><div class="tr"><i style="width:${Math.min(100, r)}%;background:${rateColor(r)}"></i></div><b style="color:${rateColor(r)}">${r}%</b></div></td>
            <td class="delta" style="color:${d == null ? "var(--dd)" : d > 0 ? "var(--g)" : d < 0 ? "var(--r)" : "var(--d)"}">${d == null ? "NEW" : d > 0 ? "▲ +" + d + "%" : d < 0 ? "▼ " + d + "%" : "— 0%"}</td></tr>`;
        })
        .join("") || '<tr><td colspan="6"><div class="empty">NOBODY MATCHES</div></td></tr>'
    }</tbody></table></div>`;
  root.querySelectorAll("th[data-k]").forEach((th) => {
    th.classList.toggle("s", th.dataset.k === sortK);
    th.classList.toggle("up", th.dataset.k === sortK && sortDir > 0);
  });
}

const CSS = `
#${ROOT} .months{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:6px 0 4px}
#${ROOT} .mo{border:1px solid var(--l);background:var(--p);padding:7px 12px;font:inherit;font-size:11px;letter-spacing:1.5px;color:var(--d);cursor:pointer;white-space:nowrap}
#${ROOT} .mo.on{color:var(--a);border-color:var(--a)}
#${ROOT} .mo small{display:block;font-size:9px;margin-top:2px}
#${ROOT} .rbar{display:flex;align-items:center;gap:8px;min-width:160px}
#${ROOT} .rbar .tr{flex:1;height:6px;background:#1a2330}#${ROOT} .rbar i{display:block;height:100%}
#${ROOT} .rbar b{font-family:Rajdhani,sans-serif;font-size:14px;width:44px;text-align:right}
#${ROOT} .delta{font-size:10px;letter-spacing:1px}
#${ROOT} .ns{font-size:8.5px;letter-spacing:1.5px;color:var(--r);border:1px solid rgba(255,77,77,.5);padding:1px 5px;margin-left:6px}
`;

onReady(() => {
  const root = mountPanel("panel-att-history", ROOT, () => load().catch((e) => notify("HISTORY LOAD FAILED: " + e.message, 1)));
  if (!root) return;
  addCss(ROOT, CSS);
  root.innerHTML = `
    <div class="h1">ATTENDANCE HISTORY</div>
    <div class="bar" style="margin-top:10px"><span class="sub" style="margin:0">MONTHLY RECORDS — SAVED AUTOMATICALLY AT MONTH-END RESET</span><span class="sp"></span>
      <div class="more"><button class="b" data-act="more" aria-haspopup="true">⋯ MORE</button>
        <div class="menu"><button data-act="snap">▲ Snapshot current month now<small>Saves this month so far</small></button>
          <button data-act="backfill">▶ Backfill all missing months<small>Rebuilds months from locked events</small></button></div></div></div>
    <div class="body"><div class="empty">LOADING...</div></div>`;
  root.addEventListener("click", async (e) => {
    const th = e.target.closest("th[data-k]");
    if (th) {
      sortDir = sortK === th.dataset.k ? -sortDir : th.dataset.k === "name" || th.dataset.k === "pl" ? 1 : -1;
      sortK = th.dataset.k;
      return render();
    }
    const mo = e.target.closest("[data-m]");
    if (mo) {
      sel = mo.dataset.m;
      return render();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    const menu = root.querySelector(".menu");
    if (act === "more") return menu.classList.toggle("open");
    menu.classList.remove("open");
    if (act === "snap") {
      await window.snapshotCurrentMonth?.();
      return load();
    }
    if (act === "backfill") {
      await window.backfillAttendanceHistory?.();
      return load();
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.classList.contains("hq")) {
      q = e.target.value;
      render();
      const el = root.querySelector(".hq");
      el.focus();
      el.setSelectionRange(q.length, q.length);
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.classList.contains("hpl")) {
      pl = e.target.value;
      render();
    }
    if (e.target.classList.contains("hns")) {
      noShows = e.target.checked;
      render();
    }
  });
});
