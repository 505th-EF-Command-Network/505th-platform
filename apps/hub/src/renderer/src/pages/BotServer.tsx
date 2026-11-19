import { useCallback, useEffect, useState } from "react";
import { Network } from "./Network";

/**
 * COMMAND CENTRE → BOT SERVER (approved mock 18 Nov). Access "bot".
 * Cortana_V2 only: status, Restart / Update & Restart / Stop Cortana, Restart / Shut down the home server PC
 * (Control Password + reason + type the word, 60 s countdown with CANCEL). Tabs: LOGS · ERRORS · MONITORS (was Cortana Settings).
 */
type Pc = { state: string; kind?: string; by?: string; reason?: string; untilISO?: string } | null;
type B = {
  canControl: boolean; hasPassword: boolean; lockedUntilISO: string; online: boolean; lastSeenISO: string; startedAtISO: string;
  version: { commit: string; subject: string; behind: number }; pc: Pc;
  control: { action: string; by: string; state: string; steps: { label?: string; state?: string }[] } | null;
  cpu: number | null; memoryMb: number | null; pingMs: number | null; logs: string[]; errors: string[];
};
type Act = "restart" | "update" | "shutdown" | "pcrestart" | "pcshutdown";
const REASONS = ["Maintenance / server work", "Bot misbehaving / spamming", "Security concern", "Other"];
const ACTS: Record<Act, { label: string; word?: string; tone: string; text: string }> = {
  restart: { label: "↻ RESTART CORTANA", tone: "#00D9FF", text: "Cortana restarts (about 20 s offline)." },
  update: { label: "⤓ UPDATE & RESTART", tone: "#22e07a", text: "Gets the newest code from GitHub, then restarts Cortana." },
  shutdown: { label: "■ STOP CORTANA", word: "SHUTDOWN", tone: "#ff4d4d", text: "Cortana stops and stays off until someone starts it on the home server." },
  pcrestart: { label: "⟲ RESTART PC", word: "RESTART", tone: "#f59e0b", text: "The home server PC restarts in 60 seconds. Cortana comes back by itself." },
  pcshutdown: { label: "⏻ SHUT DOWN PC", word: "SHUTDOWN", tone: "#ff4d4d", text: "The home server PC turns OFF in 60 seconds. Someone must switch it on again." },
};
const up = (iso: string) => { const s = (Date.now() - Date.parse(iso)) / 1000; if (!iso || !(s > 0)) return "—"; const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };

export function BotServer() {
  const [d, setD] = useState<B | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"logs" | "errors" | "mon">("logs");
  const [dlg, setDlg] = useState<Act | null>(null);
  const [f, setF] = useState({ password: "", reason: "", details: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [, tick] = useState(0);
  const load = useCallback(async () => { try { const r = await window.cn.hub.bot(); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as B); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  const fast = !!d && (d.pc?.state === "countdown" || d.control?.state === "running" || d.control?.state === "restarting");
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && document.documentElement.dataset.page === "panel-bot") void load(); }, fast ? 3000 : 15000);
    return () => clearInterval(t);
  }, [load, fast]);
  useEffect(() => { if (d?.pc?.state !== "countdown") return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [d?.pc?.state]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const left = d.pc?.state === "countdown" && d.pc.untilISO ? Math.max(0, Math.ceil((Date.parse(d.pc.untilISO) - Date.now()) / 1000)) : null;
  const open = (a: Act) => { setF({ password: "", reason: "", details: "", confirm: "" }); setDlg(a); };
  const run = async (body: Record<string, unknown>) => {
    setBusy(true); const r = await window.cn.hub.botAction(body); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : [String(r.msg ?? "Done").toUpperCase(), true]);
    if (!r.error) { setDlg(null); setF({ password: "", reason: "", details: "", confirm: "" }); }
    void load();
  };
  const A = dlg ? ACTS[dlg] : null, needReason = dlg === "shutdown" || dlg === "pcshutdown" || dlg === "pcrestart";
  const ready = !!f.password && (!needReason || (!!f.reason && (f.reason !== "Other" || !!f.details.trim()) && f.confirm === A?.word));
  const k = (l: string, v: string, c = "#fff") => <div className="border border-white/10 bg-[#070a0f] px-3 py-2"><small className="block text-[10px] tracking-[1.5px] text-dim">{l}</small><b className="text-[20px]" style={{ color: c }}>{v}</b></div>;
  const lines = tab === "errors" ? d.errors : d.logs;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Bot Server">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">▣ BOT SERVER</h1>
      <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">HOME BOT PC · CORTANA_V2 · {d.version.commit ? `v ${d.version.commit.slice(0, 7)}` : ""}{d.version.behind ? ` · ${d.version.behind} UPDATE${d.version.behind > 1 ? "S" : ""} WAITING` : " · UP TO DATE"}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {k("CORTANA_V2", d.online ? "ONLINE" : "OFFLINE", d.online ? "#22e07a" : "#ff4d4d")}{k("UPTIME", d.online ? up(d.startedAtISO) : "—")}{k("CPU", d.cpu == null ? "—" : `${Math.round(d.cpu)}%`)}{k("MEMORY", d.memoryMb == null ? "—" : `${d.memoryMb} MB`)}{k("PING", d.pingMs == null ? "—" : `${d.pingMs} ms`)}
      </div>

      {left != null && <div role="alert" className="mt-4 border border-bad/50 bg-bad/5 p-4 text-center">
        <span className="text-[10px] tracking-[2px] text-dim">HOME SERVER {d.pc?.kind === "restart" ? "RESTARTING" : "SHUTTING DOWN"} IN</span>
        <b className="block font-head text-[44px] text-bad">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
        <span className="text-[12px] text-[#c6d0da]">{d.pc?.reason} · by {d.pc?.by}</span>
        <div className="mt-3"><button type="button" disabled={busy} onClick={() => void run({ action: "pccancel" })} className={`${btn} border-cyan text-cyan`}>CANCEL</button></div></div>}
      {d.control && d.control.state !== "done" && <div className="mt-4 border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-[12px]"><b className="tracking-[1.5px] text-cyan">{d.control.action.toUpperCase()} · {d.control.state.toUpperCase()}</b> <span className="text-dim">by {d.control.by}</span>
        <div className="mt-1 text-dim">{d.control.steps.map((s, i) => <span key={i} className="mr-3">{s.state === "done" ? "✓" : s.state === "failed" ? "✕" : "…"} {s.label}</span>)}</div></div>}

      {d.canControl ? <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => open("restart")} disabled={!d.online} className={`${btn} border-cyan/50 text-cyan`}>{ACTS.restart.label}</button>
        {d.version.behind > 0 && <button type="button" onClick={() => open("update")} disabled={!d.online} className={`${btn} border-ok/50 text-ok`}>{ACTS.update.label}</button>}
        <button type="button" onClick={() => open("shutdown")} disabled={!d.online} className={`${btn} border-bad/50 text-bad`}>{ACTS.shutdown.label}</button>
        <span className="flex-1" />
        <button type="button" onClick={() => open("pcrestart")} disabled={!d.online || left != null} className={`${btn} border-amber/60 text-amber`}>{ACTS.pcrestart.label}</button>
        <button type="button" onClick={() => open("pcshutdown")} disabled={!d.online || left != null} className={`${btn} border-bad/60 text-bad`}>{ACTS.pcshutdown.label}</button>
      </div> : <p className="mt-4 text-[11px] text-dim">View only — the Commander or a Developer controls Cortana.</p>}
      {d.canControl && !d.hasPassword && <p className="mt-2 text-[11px] text-amber">▲ No Control Password set yet — the server owner sets it on the website (Cortana Control).</p>}

      <div className="mt-5 flex items-center gap-1.5" role="tablist">
        {([["logs", "LOGS"], ["errors", `ERRORS (${d.errors.length})`], ["mon", "MONITORS"]] as const).map(([t, l]) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`${btn} ${tab === t ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}
        <span className="flex-1" />
        {tab !== "mon" && d.canControl && <button type="button" disabled={busy || !lines.length} onClick={() => void run({ action: "clear", which: tab })} className={`${btn} border-bad/40 text-bad`}>CLEAR</button>}
      </div>
      {tab === "mon" ? <div className="-mx-6 mt-1"><Network /></div>
        : <pre className="mt-2 h-[360px] overflow-auto whitespace-pre-wrap border border-white/10 bg-[#03060a] p-3 font-mono text-[11.5px] leading-[1.6] text-[#9fb0c0]" aria-label={tab === "errors" ? "Errors" : "Logs"}>
          {lines.length ? [...lines].reverse().map((l, i) => <div key={i} className={/✕/.test(l) ? "text-bad" : /⚠/.test(l) ? "text-amber" : ""}>{l}</div>) : <span className="text-dimmer">{tab === "errors" ? "No errors. 👍" : "No log lines yet (saved every 15 s)."}</span>}</pre>}

      {dlg && A && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70" role="dialog" aria-modal="true" aria-label={A.label} onKeyDown={(e) => e.key === "Escape" && setDlg(null)}>
        <form className="w-[440px] border bg-panel p-5" style={{ borderColor: A.tone }} onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void run({ action: dlg, ...f }); }}>
          <h2 className="m-0 font-head text-[18px] tracking-[3px]" style={{ color: A.tone }}>{A.label}</h2>
          <p className="mt-1 text-[12.5px] text-[#c6d0da]">{A.text}</p>
          {needReason && <><label htmlFor="bsR" className="mb-1 mt-3 block text-[10px] tracking-[1.5px] text-dim">REASON</label>
            <select id="bsR" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={inp}><option value="">— pick —</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            <label htmlFor="bsD" className="mb-1 mt-3 block text-[10px] tracking-[1.5px] text-dim">DETAILS{f.reason === "Other" ? " (REQUIRED)" : " (OPTIONAL)"}</label>
            <input id="bsD" maxLength={300} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} className={inp} /></>}
          <label htmlFor="bsP" className="mb-1 mt-3 block text-[10px] tracking-[1.5px] text-dim">CONTROL PASSWORD</label>
          <input id="bsP" type="password" autoComplete="off" autoFocus value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inp} />
          {A.word && <><label htmlFor="bsC" className="mb-1 mt-3 block text-[10px] tracking-[1.5px] text-dim">TYPE {A.word} TO CONFIRM</label>
            <input id="bsC" autoComplete="off" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value.toUpperCase() })} className={inp} /></>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setDlg(null)} className={`${btn} border-white/20 text-dim`}>CANCEL</button>
            <button type="submit" disabled={!ready || busy} className={btn} style={{ color: A.tone, borderColor: A.tone }}>{busy ? "SENDING…" : "CONFIRM"}</button></div>
        </form></div>}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
