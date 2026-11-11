import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecruitData } from "../../../preload/api";

/**
 * RECRUITMENT STATS in the app — same as the Terminal's recruitment-stats.js (approved mock 2026-11-11):
 * 4 KPIs · source breakdown (click to filter) · recruits per month (6 months) · recent recruits table.
 */
const COLORS: Record<string, string> = { Reddit: "#FF4500", "Steam Community": "#66c0f4", Disboard: "#5865F2", Discord: "#7289da", "Word of Mouth": "#22e07a", Other: "#aeb9c4" };
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }).toUpperCase() : "—");

export function Recruit() {
  const [d, setD] = useState<RecruitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const load = useCallback(async () => { const r = await window.cn.hub.recruit(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "users") { clearTimeout(t); t = setTimeout(() => void load(), 600); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  const s = useMemo(() => {
    if (!d) return null;
    const tagged = d.members.filter((m) => m.source);
    const counts = new Map<string, number>(d.sources.map((x) => [x, 0]));
    for (const m of tagged) counts.set(m.source, (counts.get(m.source) ?? 0) + 1);
    const now = new Date();
    const inMonth = (iso: string, y: number, mo: number) => { if (!iso) return false; const x = new Date(iso); return x.getFullYear() === y && x.getMonth() === mo; };
    const months = [...Array(6)].map((_, i) => { const x = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { label: x.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
      n: d.members.filter((m) => (!filter || m.source === filter) && inMonth(m.joined, x.getFullYear(), x.getMonth())).length }; });
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { tagged, counts: [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]), max: Math.max(1, ...counts.values()), months, mMax: Math.max(1, ...months.map((m) => m.n)), top,
      thisMonth: tagged.filter((m) => inMonth(m.joined, now.getFullYear(), now.getMonth())).length,
      recent: tagged.filter((m) => !filter || m.source === filter).sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 25) };
  }, [d, filter]);
  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d || !s) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const total = s.tagged.length;
  const card = "border border-cyan/15 bg-panel p-3.5";
  const head = (t: string, sub: React.ReactNode) => <div className="mb-3 flex flex-wrap justify-between gap-2 font-head text-[13px] font-bold tracking-[3px] text-cyan">{t}<small className="font-mono text-[9.5px] font-normal tracking-[1.5px] text-dim">{sub}</small></div>;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Recruitment Stats">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">RECRUITMENT STATS</h1>
      <p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">WHERE NEW MARINES HEAR ABOUT THE 505TH — TAGGED AT BCT APPROVAL</p>
      <div className="my-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {([[String(total), "RECRUITS TAGGED", "#00d9ff"], [String(s.thisMonth), "THIS MONTH", "#00d9ff"],
          [total && s.top?.[1] ? Math.round((s.top[1] / total) * 100) + "%" : "—", `TOP: ${(total && s.top?.[1] ? s.top[0] : "—").toUpperCase()}`, COLORS[s.top?.[0] ?? ""] ?? "#00d9ff"],
          [String(d.members.length - total), "NOT TAGGED", "#f59e0b"]] as const).map(([v, l, c]) => (
          <div key={l} className="tile border border-cyan/15 bg-panel px-3.5 py-3"><b className="block font-head text-[26px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>))}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        <section className={card}>{head("SOURCE BREAKDOWN", "ALL TIME · CLICK TO FILTER")}
          {total ? s.counts.map(([src, n]) => (
            <button key={src} type="button" aria-pressed={filter === src} onClick={() => setFilter(filter === src ? "" : src)}
              className={`mb-1.5 block w-full border px-2 py-1.5 text-left ${filter === src ? "border-cyan/40 bg-cyan/5" : "border-transparent hover:border-cyan/25"}`}>
              <div className="mb-1 flex justify-between text-[12px] text-[#d6dde6]"><span>{src}</span><span><b className="mr-2" style={{ color: COLORS[src] }}>{Math.round((n / total) * 100)}%</b>{n} recruit{n === 1 ? "" : "s"}</span></div>
              <div className="h-[7px] bg-white/5"><i className="grow-x block h-full opacity-85" style={{ width: `${Math.round((n / s.max) * 100)}%`, background: COLORS[src] }} /></div>
            </button>))
            : <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NO SOURCE DATA YET — TAG SOURCES WHEN APPROVING RECRUITS</p>}
        </section>
        <section className={card}>{head("RECRUITS PER MONTH", `LAST 6 MONTHS${filter ? " · " + filter.toUpperCase() : ""}`)}
          <div className="flex h-[170px] items-end gap-2.5 pt-2.5">{s.months.map((m) => (
            <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-[11px] text-white">{m.n}</span>
              <div className="grow-y w-full max-w-[42px]" style={{ height: `${Math.max(2, Math.round((m.n / s.mMax) * 100))}%`, background: "linear-gradient(#00D9FF,rgba(0,217,255,.35))" }} />
              <span className="text-[9.5px] tracking-[1.5px] text-dim">{m.label}</span></div>))}</div>
        </section>
      </div>
      <section className={`${card} mt-3.5`}>{head("RECENT RECRUITS", filter ? <>{filter.toUpperCase()} · <button type="button" onClick={() => setFilter("")} className="tracking-[1px] text-amber">✕ CLEAR FILTER</button></> : "ALL SOURCES")}
        <table className="w-full border-collapse text-[12px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim">{["NAME", "SOURCE", "BCT INSTRUCTOR", "APPROVED"].map((h) => <th key={h} className="border-b border-cyan/15 px-2 py-1.5 text-left font-normal">{h}</th>)}</tr></thead>
          <tbody>{s.recent.length ? s.recent.map((m) => (
            <tr key={m.id} className="rrow"><td className="border-b border-white/5 p-2 font-head text-[13.5px] font-bold text-white">{m.name}</td><td className="border-b border-white/5 p-2" style={{ color: COLORS[m.source] }}>{m.source}</td>
              <td className="border-b border-white/5 p-2">{m.instructor || "—"}</td><td className="border-b border-white/5 p-2 text-dim">{day(m.joined)}</td></tr>))
            : <tr><td colSpan={4} className="p-6 text-center text-[11px] tracking-[2px] text-dimmer">NO TAGGED RECRUITS YET</td></tr>}</tbody></table>
      </section>
    </main>
  );
}
