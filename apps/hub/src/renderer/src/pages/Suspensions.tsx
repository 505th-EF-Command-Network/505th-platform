import { useCallback, useEffect, useMemo, useState } from "react";
import { askBox } from "../components/Confirm";

/**
 * COMMAND CENTRE → MODERATION → SUSPENSIONS (approved mock 19 Nov). Commander / Developer or the "Suspensions" grant.
 * Suspended = can't sign in to the website or the Hub. Optional Discord timeout + DM (Cortana). Timed ones end by themselves.
 * Same rules as the website (/api/hub/suspensions → lib/terminal/suspend-core.ts).
 */
type Active = { uid: string; name: string; role: string; platoon: string; reason: string; by: string; atISO: string; untilISO: string | null; discord: boolean };
type Past = { id: string; name: string; reason: string; days: number | null; atISO: string; endedAtISO: string; endedBy: string; how: string };
type D = { active: Active[]; past: Past[]; members: { uid: string; name: string; role: string; linked: boolean }[] };
const ROLE: Record<string, string> = { commander: "Commander", developer: "Developer", officer: "Officer", staff_nco: "Staff NCO", nco: "NCO", recruiter: "Recruiter", marine: "Marine", enlistee: "Enlistee" };
const LENGTHS: [number, string][] = [[1, "1 DAY"], [3, "3 DAYS"], [7, "7 DAYS"], [30, "30 DAYS"], [0, "NO END"]];
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
const left = (iso: string | null) => { if (!iso) return null; const d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return d <= 0 ? "ENDING" : d === 1 ? "IN 1 DAY" : `IN ${d} DAYS`; };

export function Suspensions() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ uid: "", q: "", days: 7, reason: "", discord: true, dm: true });
  const [ext, setExt] = useState<Active | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => { try { const r = await window.cn.hub.suspensions(); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as D); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const off = window.cn.net.onTopic((x) => { if ((x === "users" || x === "suspensions") && document.documentElement.dataset.page === "panel-cmd-suspend") void load(); }); return off; }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  const found = useMemo(() => (d?.members ?? []).filter((m) => v.q && m.name.toLowerCase().includes(v.q.toLowerCase())).slice(0, 8), [d, v.q]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim";
  const run = async (body: Record<string, unknown>) => { setBusy(true); const r = await window.cn.hub.suspensionsAction(body); setBusy(false); setToast(r.error ? [r.error.toUpperCase(), false] : [String(r.msg).toUpperCase(), true]); void load(); return !r.error; };
  const sel = d.members.find((m) => m.uid === v.uid);
  const soon = d.active.filter((a) => a.untilISO && Date.parse(a.untilISO) - Date.now() < 7 * 864e5).length;
  const k = (n: number, l: string, c: string) => <div className="border border-white/10 bg-[#070a0f] px-3 py-2"><b className="block text-[22px]" style={{ color: c }}>{n}</b><small className="text-[10px] tracking-[1.5px] text-dim">{l}</small></div>;
  const doSuspend = async () => {
    if (!sel) return setToast(["PICK A MEMBER", false]);
    if (v.reason.trim().length < 3) return setToast(["A REASON IS REQUIRED — THEY SEE IT", false]);
    if (!(await askBox(`Suspend ${sel.name} ${v.days ? `for ${v.days} day${v.days === 1 ? "" : "s"}` : "until restored"}?\nThey are signed out of the website and the Hub straight away.`, { tone: "warn", go: "SUSPEND" }))) return;
    if (await run({ action: "suspend", uid: v.uid, days: v.days, reason: v.reason, discord: v.discord && sel.linked, dm: v.dm })) setV({ uid: "", q: "", days: 7, reason: "", discord: true, dm: true });
  };

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Suspensions">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⏸ SUSPENSIONS</h1>
      <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">BLOCKS WEBSITE + HUB SIGN-IN · OPTIONAL DISCORD TIMEOUT · TIMED ONES END BY THEMSELVES</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{k(d.active.length, "ACTIVE", "#f59e0b")}{k(soon, "ENDS IN 7 DAYS", "#fff")}{k(d.active.filter((a) => !a.untilISO).length, "NO END DATE", "#ff4d4d")}{k(d.past.length, "PAST (90 DAYS)", "#7d8a99")}</div>

      <section className="mt-4 overflow-auto border border-cyan/15 bg-panel">
        <table className="w-full border-collapse text-[12.5px]"><thead><tr className="text-left text-[9.5px] tracking-[1.5px] text-dim">{["MEMBER", "REASON", "BY", "STARTED", "ENDS", "DISCORD", ""].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>{d.active.map((a) => <tr key={a.uid} className="border-t border-white/5">
            <td className="px-3 py-2"><b className="font-normal text-white">{a.name}</b><small className="block text-[10.5px] text-dim">{ROLE[a.role] ?? a.role}{a.platoon ? ` · ${a.platoon}` : ""}</small></td>
            <td className="max-w-[260px] px-3 text-[#c6d0da]">{a.reason || "—"}</td><td className="px-3 text-dim">{a.by || "—"}</td><td className="px-3 text-dim">{day(a.atISO)}</td>
            <td className="px-3">{a.untilISO ? <span className="border border-amber/40 px-1.5 text-[10px] tracking-[1px] text-amber">{left(a.untilISO)}</span> : <span className="border border-bad/40 px-1.5 text-[10px] tracking-[1px] text-bad">NO END</span>}</td>
            <td className="px-3">{a.discord ? <span className="border border-ok/40 px-1.5 text-[10px] tracking-[1px] text-ok">TIMED OUT</span> : <span className="text-dimmer">—</span>}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" disabled={busy} onClick={() => setExt(a)} className={`${btn} border-cyan/30 text-cyan`}>EXTEND</button>{" "}
              <button type="button" disabled={busy} onClick={async () => { if (await askBox(`Restore ${a.name}?\nThey can sign in again${a.discord ? " and the Discord timeout is lifted" : ""}.`, { tone: "info", go: "RESTORE" })) void run({ action: "restore", uid: a.uid }); }} className={`${btn} border-ok/50 text-ok`}>RESTORE</button></td></tr>)}
            {!d.active.length && <tr><td colSpan={7} className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NOBODY IS SUSPENDED</td></tr>}</tbody></table></section>

      {ext && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70" role="dialog" aria-modal="true" aria-label="Extend suspension" onKeyDown={(e) => e.key === "Escape" && setExt(null)}>
        <div className="w-[400px] border border-cyan/40 bg-panel p-5"><h2 className="m-0 font-head text-[17px] tracking-[3px] text-cyan">EXTEND · {ext.name.toUpperCase()}</h2>
          <p className="mt-1 text-[12px] text-dim">Now {ext.untilISO ? `ends ${day(ext.untilISO)}` : "until restored"}. Add:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{LENGTHS.map(([n, l]) => <button key={n} type="button" disabled={busy} onClick={async () => { if (await run({ action: "extend", uid: ext.uid, days: n })) setExt(null); }} className={`${btn} border-cyan/30 text-[#c6d0da]`}>{n ? `+ ${l}` : "NO END"}</button>)}</div>
          <div className="mt-4 text-right"><button type="button" onClick={() => setExt(null)} className={`${btn} border-white/20 text-dim`}>CANCEL</button></div></div></div>}

      <section className="mt-4 border border-cyan/15 bg-panel p-4" aria-label="Suspend a member">
        <h3 className="m-0 text-[10px] tracking-[3px] text-[#9cbf4a]">SUSPEND A MEMBER</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="suQ" className={lbl}>MEMBER</label>
            {sel ? <div className="flex items-center gap-2 border border-cyan/40 bg-cyan/5 px-2.5 py-1.5 text-[12.5px]"><span className="flex-1 text-white">{sel.name} <small className="text-dim">· {ROLE[sel.role] ?? sel.role}</small></span><button type="button" aria-label="Change member" onClick={() => setV({ ...v, uid: "", q: "" })} className="text-dim hover:text-white">✕</button></div>
              : <><input id="suQ" value={v.q} onChange={(e) => setV({ ...v, q: e.target.value })} placeholder="Type a name…" className={inp} autoComplete="off" />
                {found.length > 0 && <div className="border border-t-0 border-white/10">{found.map((m) => <button key={m.uid} type="button" onClick={() => setV({ ...v, uid: m.uid, q: "" })} className="block w-full px-2.5 py-1.5 text-left text-[12.5px] text-[#c6d0da] hover:bg-cyan/5">{m.name} <small className="text-dim">· {ROLE[m.role] ?? m.role}</small></button>)}</div>}</>}
            <span className={lbl}>LENGTH</span>
            <div className="flex flex-wrap gap-1.5">{LENGTHS.map(([n, l]) => <button key={n} type="button" aria-pressed={v.days === n} onClick={() => setV({ ...v, days: n })} className={`${btn} ${v.days === n ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>
          </div>
          <div>
            <label htmlFor="suR" className={lbl}>REASON (REQUIRED · AUDIT LOG · THEY SEE IT)</label>
            <textarea id="suR" rows={3} maxLength={400} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={inp} />
            <label className="mt-2.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.discord && !!sel?.linked} disabled={!!sel && !sel.linked} onChange={(e) => setV({ ...v, discord: e.target.checked })} /> Also time them out in Discord (Cortana · max 28 days){sel && !sel.linked && <small className="text-amber">— not linked to Discord</small>}</label>
            <label className="mt-1.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.dm} onChange={(e) => setV({ ...v, dm: e.target.checked })} /> Tell them (DM from Cortana)</label>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !sel} onClick={() => void doSuspend()} className={`${btn} border-bad/60 text-bad`}>{busy ? "WORKING…" : "⏸ SUSPEND"}</button></div>
      </section>

      <section className="mt-4 border border-cyan/15 bg-panel"><h3 className="m-0 border-b border-white/5 px-3.5 py-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">PAST SUSPENSIONS (90 DAYS)</h3>
        {d.past.map((p) => <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 px-3.5 py-2 text-[12.5px]"><b className="w-[180px] font-normal text-white">{p.name}</b>
          <span className="min-w-0 flex-1 text-[#c6d0da]">{p.days ? `${p.days} day${p.days === 1 ? "" : "s"}` : "No end"} · {p.reason}</span>
          <small className="text-[11px] text-dim">{p.how === "time served" ? `Ended ${day(p.endedAtISO)} (time served)` : `Restored early ${day(p.endedAtISO)} by ${p.endedBy}`}</small></div>)}
        {!d.past.length && <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NONE IN THE LAST 90 DAYS</p>}</section>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
