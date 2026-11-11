import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistData } from "../../../preload/api";
import { FileWindow } from "./Personnel";

/**
 * ATTENDANCE HISTORY in the app — same as the Terminal's attendance-history.js:
 * month tabs (avg % + ops) · saved / late-update / rebuilt tags · ↻ REBUILD · ⋯ MORE (snapshot now · backfill missing)
 * · "has no record" warnings with BUILD IT NOW · 5 stats · find / platoon / no-shows only · sortable table + vs last month.
 * App extras: rows slide in + hover glow · click a name → Personnel File.
 */
const PLATOONS = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", ""];
const plOrder = (p: string) => { const i = PLATOONS.indexOf(p); return i < 0 ? 99 : i; };
const rc = (p: number | null) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
const label = (id: string) => { const d = new Date(`${id}-01T12:00:00`); return isNaN(+d) ? id : d.toLocaleString("en-GB", { month: "short", year: "numeric" }).toUpperCase(); };
const when = (v: string) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).toUpperCase() : "—");
const avg = (ms: { eligible: number; rate: number }[]) => { const x = ms.filter((m) => m.eligible > 0); return x.length ? Math.round(x.reduce((s, m) => s + m.rate, 0) / x.length) : 0; };
type K = "name" | "pl" | "att" | "missed" | "rate" | "delta";

export function History(p: { me: string }) {
  const [d, setD] = useState<HistData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pl, setPl] = useState("");
  const [noShows, setNoShows] = useState(false);
  const [sortK, setSortK] = useState<K>("rate");
  const [dir, setDir] = useState(-1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await window.cn.hub.history(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "attendance_history" || x === "attendance_events") { clearTimeout(t); t = setTimeout(() => void load(), 400); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const run = async (body: Record<string, unknown>, ask?: string) => {
    if (ask && !await askBox(ask)) return;
    setMore(false); setBusy(true);
    const r = await window.cn.hub.historyAction(body);
    setBusy(false); setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]); void load();
  };
  const cur = d?.months.find((m) => m.id === sel) ?? d?.months[0] ?? null;
  const i = d && cur ? d.months.indexOf(cur) : -1;
  const prev = d && i >= 0 ? d.months[i + 1] : undefined;
  const prevRate = useMemo(() => new Map((prev?.members ?? []).map((x) => [x.uid, x.rate])), [prev]);
  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;

  const ms = cur?.members ?? [];
  const a = avg(ms), pa = prev ? avg(prev.members) : null;
  const plats = [...new Set(ms.map((x) => x.platoon || ""))].sort((x, y) => plOrder(x) - plOrder(y));
  const key: Record<K, (x: (typeof ms)[number]) => number | string> = { name: (x) => x.name, pl: (x) => plOrder(x.platoon), att: (x) => x.attended, missed: (x) => x.missed, rate: (x) => x.rate, delta: (x) => (prevRate.has(x.uid) ? x.rate - prevRate.get(x.uid)! : -999) };
  const list = ms.filter((x) => (!pl || x.platoon === pl) && x.name.toLowerCase().includes(q.toLowerCase()) && (!noShows || (x.eligible > 0 && !x.attended)))
    .sort((x, y) => { const A = key[sortK](x), B = key[sortK](y); return (A > B ? 1 : A < B ? -1 : 0) * dir; });
  const th = (k: K, l: string) => <th key={k} onClick={() => { setDir(sortK === k ? -dir : k === "name" || k === "pl" ? 1 : -1); setSortK(k); }} aria-sort={sortK === k ? (dir > 0 ? "ascending" : "descending") : undefined}
    className="cursor-pointer border-b border-cyan/15 px-2.5 py-2 text-left font-normal hover:text-white">{l}{sortK === k ? (dir > 0 ? " ▲" : " ▼") : ""}</th>;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Attendance History">
      <div className="mb-3 flex items-center gap-2">
        <div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">ATTENDANCE HISTORY</h1><p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">MONTHLY RECORDS — CORTANA SAVES EACH MONTH AT 00:00 ON THE 1ST</p></div>
        <div className="flex-1" />
        <div className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(!more)} className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-white">⋯ MORE</button>
          {more && <div role="menu" className="absolute right-0 top-10 z-20 w-[270px] border border-cyan/40 bg-panel py-1 shadow-[0_14px_34px_rgba(0,0,0,.6)]">
            <button type="button" role="menuitem" onClick={() => void run({ action: "snapshot" })} className="block w-full px-3 py-2 text-left text-[12.5px] text-white hover:bg-cyan/10">▲ Snapshot current month now<small className="block text-[10.5px] text-dim">Saves this month so far</small></button>
            <button type="button" role="menuitem" onClick={() => void run({ action: "backfill" }, "BACKFILL MISSING MONTHS?\n\nBuilds a history record for every month that has locked events but no snapshot yet. Existing months are not changed.")} className="block w-full px-3 py-2 text-left text-[12.5px] text-white hover:bg-cyan/10">▶ Backfill all missing months<small className="block text-[10.5px] text-dim">Rebuilds months from locked events</small></button>
          </div>}
        </div>
      </div>
      {d.missing.map((m) => <div key={m} role="alert" className="mb-2 flex items-center gap-2.5 border border-bad bg-bad/10 px-3 py-2 text-[11.5px]"><span className="flex-1"><b className="font-normal text-bad">⚠ {label(m)} HAS NO HISTORY RECORD</b> — it has locked events.</span>
        <button type="button" disabled={busy} onClick={() => void run({ action: "rebuild", month: m })} className="border border-cyan/40 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">↻ BUILD IT NOW</button></div>)}
      {!cur ? <p className="py-16 text-center text-[11px] tracking-[2px] text-dimmer">NO HISTORY YET — CORTANA SAVES EACH MONTH AT 00:00 ON THE 1ST</p> : <>
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{d.months.map((m) => { const x = avg(m.members); return (
          <button key={m.id} type="button" aria-pressed={m.id === cur.id} onClick={() => setSel(m.id)} className={`whitespace-nowrap border px-3 py-1.5 text-[11px] tracking-[1.5px] ${m.id === cur.id ? "border-cyan text-cyan" : "border-cyan/15 bg-[#0b1016] text-dim"}`}>
            {label(m.id)}<small className="mt-0.5 block text-[9px]" style={{ color: rc(x) }}>{x}% · {m.totalOps} OPS</small></button>); })}</div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] tracking-[1px]">
          <span className="border border-ok px-1.5 py-0.5 text-ok">✓ SAVED {when(cur.snapshotAt)}{cur.savedBy ? ` · ${cur.savedBy.toUpperCase()}` : ""}</span>
          {cur.lateUpdate && <span className="border border-cyan px-1.5 py-0.5 text-cyan">↻ UPDATED {when(cur.lateUpdate.at)} — "{cur.lateUpdate.title}" {cur.lateUpdate.action} by {cur.lateUpdate.by}</span>}
          {cur.rebuiltAt && <span className="border border-cyan px-1.5 py-0.5 text-cyan">↻ REBUILT {when(cur.rebuiltAt)}</span>}
          <span className="border border-cyan/20 px-1.5 py-0.5 text-dim">{cur.totalOps} LOCKED OPS</span><div className="flex-1" />
          <button type="button" disabled={busy} title={`Recount ${label(cur.id)} from its locked events (ATT pips and PT are not changed)`} onClick={() => void run({ action: "rebuild", month: cur.id })} className="border border-cyan/30 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">{busy ? "◷ WORKING…" : `↻ REBUILD ${label(cur.id)}`}</button>
        </div>
        <div className="mb-3 grid grid-cols-5 gap-2">
          {([[cur.totalOps, "OPS", "#00d9ff", null], [`${a}%`, "UNIT AVG", rc(a), pa], [ms.filter((x) => x.eligible > 0 && x.attended >= x.eligible).length, "FULL ATTENDANCE", "#22e07a", null], [ms.filter((x) => x.eligible > 0 && !x.attended).length, "NO-SHOWS", "#ff4d4d", null], [cur.memberCount || ms.length, "MEMBERS", "#c6d0da", null]] as [string | number, string, string, number | null][]).map(([v, l, c, p0]) => (
            <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}{p0 != null && <span style={{ color: a >= p0 ? "#22e07a" : "#ff4d4d" }}> {a >= p0 ? "▲" : "▼"} {Math.abs(a - p0)}%</span>}</span></div>))}
        </div>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="FIND MARINE…" aria-label="Find member" className="w-[200px] border border-cyan/25 bg-black/45 px-3 py-2 text-[12px] text-white outline-none focus:border-cyan" />
          <select value={pl} onChange={(e) => setPl(e.target.value)} aria-label="Platoon" className="border border-cyan/25 bg-[#05080b] px-2 py-2 text-[12px] text-white"><option value="">ALL PLATOONS</option>{plats.map((x) => <option key={x} value={x}>{x || "No platoon"}</option>)}</select>
          <div className="flex-1" /><label className="flex items-center gap-1.5 text-[10px] tracking-[1.5px] text-dim"><input type="checkbox" checked={noShows} onChange={(e) => setNoShows(e.target.checked)} className="accent-bad" /> NO-SHOWS ONLY</label>
        </div>
        <table className="w-full border-collapse border border-cyan/15 text-[13px]">
          <thead><tr className="text-[10px] tracking-[2px] text-cyan">{th("name", "NAME")}{th("pl", "PLATOON")}{th("att", "ATTENDED")}{th("missed", "MISSED")}{th("rate", "RATE")}{th("delta", `VS ${prev ? label(prev.id) : "LAST MONTH"}`)}</tr></thead>
          <tbody>{list.map((x, n) => { const dd = prevRate.has(x.uid) ? x.rate - prevRate.get(x.uid)! : null; return (
            <tr key={x.uid} className="rise rrow" style={{ animationDelay: `${Math.min(n, 40) * 0.015}s` }}>
              <td className="border-b border-cyan/10 px-2.5 py-1.5"><button type="button" onClick={() => setFile(x.uid)} className="text-white hover:text-cyan">{x.name}</button>{x.eligible > 0 && !x.attended && <span className="ml-1.5 border border-bad/50 px-1 text-[8.5px] tracking-[1.5px] text-bad">NO SHOW</span>}<span className="block text-[10px] text-dim">{x.rank}</span></td>
              <td className="border-b border-cyan/10 px-2.5"><span className="border border-[#3b4a5a] px-1.5 py-px text-[10px] text-[#9fb3c4]">{x.platoon || "—"}</span></td>
              <td className="border-b border-cyan/10 px-2.5 text-ok">{x.attended}</td><td className="border-b border-cyan/10 px-2.5" style={{ color: x.missed ? "#ff4d4d" : "#4b5765" }}>{x.missed}</td>
              <td className="border-b border-cyan/10 px-2.5"><div className="flex min-w-[160px] items-center gap-2"><div className="h-1.5 flex-1 bg-[#1a2330]"><i className="grow-x block h-full" style={{ width: `${Math.min(100, x.rate)}%`, background: rc(x.rate) }} /></div><b className="w-11 text-right font-head text-[14px]" style={{ color: rc(x.rate) }}>{x.rate}%</b></div></td>
              <td className="border-b border-cyan/10 px-2.5 text-[10px] tracking-[1px]" style={{ color: dd == null ? "#4b5765" : dd > 0 ? "#22e07a" : dd < 0 ? "#ff4d4d" : "#7d8a99" }}>{dd == null ? "NEW" : dd > 0 ? `▲ +${dd}%` : dd < 0 ? `▼ ${dd}%` : "— 0%"}</td>
            </tr>); })}
            {!list.length && <tr><td colSpan={6} className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NOBODY MATCHES</td></tr>}</tbody>
        </table></>}
      {file && <FileWindow id={file} me={p.me} onClose={() => setFile(null)} />}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
