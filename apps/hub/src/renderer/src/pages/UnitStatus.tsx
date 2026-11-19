import { useCallback, useEffect, useState } from "react";

/**
 * STATUS → UNIT STATUS (same as the website COMMAND → Unit Status). Access "cmd_status".
 * Sets the unit's operational status, recruitment open/closed and a banner message (shown on the website).
 * Optional: alert all staff · post in Discord #announcements (Cortana).
 */
type S = { opStatus: string; statusMessage: string; recruitmentOpen: boolean; updatedByName: string; updatedAtISO: string | null; history: { opStatus: string; statusMessage: string; recruitmentOpen: boolean; by: string; at: string }[] };
const OPS: [string, string, string, string][] = [["Active", "ACTIVE", "Full operations", "#22e07a"], ["Stand Down", "STAND DOWN", "Reduced operations", "#7d8a99"], ["On Op", "ON OP", "Active deployment", "#f59e0b"], ["Training Cycle", "TRAINING", "Training cycle", "#00D9FF"], ["Maintenance", "MAINTENANCE", "Admin period", "#a78bfa"]];
const op = (v: string) => OPS.find((x) => x[0] === v) ?? (["", v || "NOT SET", "", "#7d8a99"] as const);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function UnitStatus() {
  const [s, setS] = useState<S | null>(null);
  const [v, setV] = useState({ opStatus: "Active", statusMessage: "", recruitmentOpen: true, alert: true, discord: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => {
    try { const r = await window.cn.hub.unitStatus(); if (!r || "error" in r) return setError(String((r as { error?: string } | null)?.error ?? "No answer")); setS(r); setError(null); setV((o) => ({ ...o, opStatus: r.opStatus, statusMessage: r.statusMessage, recruitmentOpen: r.recruitmentOpen })); }
    catch { setError("This page needs an app restart"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (error && !s) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!s) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const o = op(v.opStatus), changed = v.opStatus !== s.opStatus || v.statusMessage.trim() !== s.statusMessage || v.recruitmentOpen !== s.recruitmentOpen;
  const save = async () => {
    setBusy(true); const r = await window.cn.hub.unitStatusAction(v); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : ["✓ UNIT STATUS SAVED", true]); if (!r.error) void load();
  };
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Unit Status">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">◉ UNIT STATUS</h1>
      <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">SHOWN ON THE WEBSITE · LAST SET BY {s.updatedByName || "—"} · {when(s.updatedAtISO)}</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="border border-cyan/15 bg-panel p-4">
          <span className="mb-2 block text-[10px] tracking-[1.5px] text-dim">OPERATIONAL STATUS</span>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">{OPS.map(([k, l, d, c]) => <button key={k} type="button" aria-pressed={v.opStatus === k} onClick={() => setV({ ...v, opStatus: k })}
            className="border p-2.5 text-left" style={v.opStatus === k ? { borderColor: c, background: `${c}1a` } : { borderColor: "#ffffff1a" }}><b className="block text-[11.5px] tracking-[1.5px]" style={{ color: c }}>{l}</b><small className="text-[10.5px] text-dim">{d}</small></button>)}</div>
          <span className="mb-2 mt-4 block text-[10px] tracking-[1.5px] text-dim">RECRUITMENT</span>
          <button type="button" aria-pressed={v.recruitmentOpen} onClick={() => setV({ ...v, recruitmentOpen: !v.recruitmentOpen })} className={`border px-4 py-2 text-[11px] font-semibold tracking-[1.5px] ${v.recruitmentOpen ? "border-ok/60 bg-ok/10 text-ok" : "border-bad/60 bg-bad/10 text-bad"}`}>
            {v.recruitmentOpen ? "● OPEN — SIGN-UP PAGE ON" : "○ CLOSED — SIGN-UP PAGE OFF"}</button>
          <label htmlFor="usMsg" className="mb-1.5 mt-4 block text-[10px] tracking-[1.5px] text-dim">STATUS MESSAGE (OPTIONAL — BANNER + ALERT)</label>
          <textarea id="usMsg" rows={3} maxLength={300} value={v.statusMessage} onChange={(e) => setV({ ...v, statusMessage: e.target.value })} className="w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan" />
          <div className="mt-1 text-right text-[10px] text-dimmer">{v.statusMessage.length}/300</div>
          <span className="mb-1.5 block text-[10px] tracking-[1.5px] text-dim">PREVIEW — WEBSITE BANNER</span>
          <div className="flex items-center gap-3 border-l-4 bg-[#070a0f] px-3 py-2 text-[12.5px]" style={{ borderColor: o[3] }}><b className="tracking-[1.5px]" style={{ color: o[3] }}>◉ {o[1]}</b><span className="flex-1 text-[#c6d0da]">{v.statusMessage.trim() || "—"}</span><span className="text-[10.5px] text-dim">RECRUITMENT {v.recruitmentOpen ? "OPEN" : "CLOSED"}</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[12.5px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.alert} onChange={(e) => setV({ ...v, alert: e.target.checked })} /> Also send as alert to all staff</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.discord} onChange={(e) => setV({ ...v, discord: e.target.checked })} /> Post in Discord #announcements</label>
            <span className="flex-1" />
            <button type="button" disabled={busy || !changed} onClick={() => void save()} className="border border-[#9cbf4a] bg-[#9cbf4a] px-4 py-2 text-[11px] font-semibold tracking-[1.5px] text-black disabled:opacity-40">{busy ? "SAVING…" : "SAVE STATUS"}</button></div>
        </section>
        <section className="border border-cyan/15 bg-panel"><h3 className="m-0 border-b border-white/5 px-3.5 py-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">HISTORY (LAST 25)</h3>
          {!s.history.length && <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NO CHANGES YET</p>}
          {s.history.map((h, i) => { const ho = op(h.opStatus); return <div key={i} className="border-b border-white/5 px-3.5 py-2 text-[12px]">
            <b className="text-[10.5px] tracking-[1.5px]" style={{ color: ho[3] }}>{ho[1]}</b> <span className="text-dim">· recruitment {h.recruitmentOpen ? "open" : "closed"}</span>
            {h.statusMessage && <div className="text-[#c6d0da]">{h.statusMessage}</div>}<small className="block text-[10.5px] text-dimmer">{h.by} · {when(h.at)}</small></div>; })}
        </section>
      </div>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
