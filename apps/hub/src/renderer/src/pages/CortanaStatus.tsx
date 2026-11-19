import { useCallback, useEffect, useState } from "react";

/**
 * COMMAND CENTRE → SETTINGS → CORTANA STATUS (approved mock 18 Nov). Access "set".
 * Top: the status line under Cortana's name in Discord (Watching / Playing / Listening to / Competing in + text).
 * Then health: ping, jobs waiting, errors 24 h, missing Discord permissions, last jobs.
 */
type S = { online: boolean; lastHeartbeatISO: string; pingMs: number | null; jobsQueued: number; errors24h: number; missingPerms: string[]; intents: { members?: boolean; messageContent?: boolean };
  botTag: string; avatarUrl: string; guildName: string; memberCount: number | null; version: string; activityType: string; activityText: string;
  jobs: { id: string; type: string; status: string; error: string; atISO: string }[] };
const TYPES: [string, string][] = [["watching", "Watching"], ["playing", "Playing"], ["listening", "Listening to"], ["competing", "Competing in"]];
const PERMS = ["View Channels", "Send Messages", "Embed Links", "Attach Files", "Manage Messages", "Manage Channels", "Manage Roles", "Manage Events", "Timeout Members", "Kick Members", "Ban Members", "Mention @everyone"];
const hm = (iso: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

export function CortanaStatus() {
  const [s, setS] = useState<S | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ activityType: "watching", activityText: "" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async (first = false) => {
    try { const r = await window.cn.hub.cortanaStatus(); if (!r || "error" in r) return setError(String((r as { error?: string } | null)?.error ?? "No answer"));
      const x = r as S; setS(x); setError(null); if (first) setV({ activityType: x.activityType, activityText: x.activityText }); }
    catch { setError("This page needs an app restart"); }
  }, []);
  useEffect(() => { void load(true); }, [load]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden && document.documentElement.dataset.page === "panel-cortana-status") void load(); }, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (error && !s) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!s) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const inp = "border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const changed = v.activityType !== s.activityType || v.activityText.trim() !== s.activityText;
  const save = async () => { setBusy(true); const r = await window.cn.hub.cortanaStatusAction(v); setBusy(false); setToast(r.error ? [r.error.toUpperCase(), false] : ["✓ SAVED — DISCORD UPDATES IN A FEW SECONDS", true]); if (!r.error) void load(); };
  const k = (l: string, val: string, c = "#fff") => <div className="border border-white/10 bg-[#070a0f] px-3 py-2"><small className="block text-[10px] tracking-[1.5px] text-dim">{l}</small><b className="text-[20px]" style={{ color: c }}>{val}</b></div>;
  const tl = TYPES.find(([t]) => t === v.activityType)?.[1] ?? "Watching";
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Cortana Status">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">◉ CORTANA STATUS</h1>
      <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">IS CORTANA HEALTHY? · DISCORD STATUS LINE · PERMISSIONS · JOBS · {s.guildName.toUpperCase()}{s.version ? ` · v${s.version}` : ""}</p>

      <section className="mt-4 border border-cyan/15 bg-panel p-4">
        <h3 className="m-0 mb-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">STATUS LINE · SHOWN UNDER CORTANA'S NAME IN DISCORD</h3>
        <div className="flex flex-wrap gap-2"><select aria-label="Activity type" value={v.activityType} onChange={(e) => setV({ ...v, activityType: e.target.value })} className={`${inp} w-[150px]`}>{TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select>
          <input aria-label="Status text" maxLength={128} value={v.activityText} onChange={(e) => setV({ ...v, activityText: e.target.value })} className={`${inp} min-w-[220px] flex-1`} />
          <button type="button" disabled={busy || !changed || !v.activityText.trim()} onClick={() => void save()} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>{busy ? "SAVING…" : "SAVE"}</button></div>
        <div className="mt-3 flex w-max items-center gap-2.5 rounded-md bg-[#2b2d31] px-3 py-2">
          {s.avatarUrl ? <img src={s.avatarUrl} alt="" className="h-8 w-8 rounded-full" /> : <span className="h-8 w-8 rounded-full bg-cyan/20" />}
          <div><b className="text-[14px] text-white">{s.botTag.split("#")[0]}</b> <span className="rounded bg-[#5865f2] px-1 text-[10px] text-white">APP</span>
            <div className="text-[12px] text-[#b5bac1]">{tl} <b>{v.activityText || "…"}</b></div></div></div>
        <p className="mb-0 mt-2 text-[11px] text-dim">{v.activityText.length}/128 · no restart needed.</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {k("CORTANA", s.online ? "ONLINE" : "OFFLINE", s.online ? "#22e07a" : "#ff4d4d")}{k("PING", s.pingMs == null ? "—" : `${s.pingMs} ms`)}{k("JOBS WAITING", String(s.jobsQueued), s.jobsQueued > 5 ? "#f59e0b" : "#fff")}
        {k("ERRORS 24H", String(s.errors24h), s.errors24h ? "#f59e0b" : "#22e07a")}{k("MISSING PERMS", String(s.missingPerms.length), s.missingPerms.length ? "#ff4d4d" : "#22e07a")}</div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="border border-cyan/15 bg-panel p-4"><h3 className="m-0 mb-2 text-[10px] tracking-[3px] text-[#9cbf4a]">DISCORD PERMISSIONS</h3>
          <div className="grid grid-cols-2 gap-x-4 text-[12.5px]">{PERMS.map((p) => { const miss = s.missingPerms.includes(p); return <div key={p} className="flex border-b border-white/5 py-1"><span className="flex-1">{p}</span><b className={miss ? "text-bad" : "text-ok"}>{miss ? "✕ MISSING" : "✓"}</b></div>; })}
            <div className="flex border-b border-white/5 py-1"><span className="flex-1">Members intent</span><b className={s.intents.members ? "text-ok" : "text-bad"}>{s.intents.members ? "✓" : "✕ OFF"}</b></div>
            <div className="flex border-b border-white/5 py-1"><span className="flex-1">Message Content intent</span><b className={s.intents.messageContent ? "text-ok" : "text-bad"}>{s.intents.messageContent ? "✓" : "✕ OFF"}</b></div></div>
          {s.missingPerms.length > 0 && <p className="mb-0 mt-2 text-[11px] text-amber">Fix in Discord → Server Settings → Roles → Cortana.</p>}</section>
        <section className="border border-cyan/15 bg-panel"><h3 className="m-0 border-b border-white/5 px-3.5 py-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">LAST JOBS</h3>
          {s.jobs.map((j) => <div key={j.id} className="flex items-center gap-3 border-b border-white/5 px-3.5 py-1.5 text-[12.5px]"><span className="flex-1 font-mono text-[12px]">{j.type}</span>
            <span className={`border px-1.5 text-[9.5px] tracking-[1px] ${j.status === "done" ? "border-ok/40 text-ok" : j.status === "failed" ? "border-bad/40 text-bad" : "border-amber/40 text-amber"}`} title={j.error || undefined}>{j.status.toUpperCase()}</span>
            <span className="w-11 text-right text-[11px] text-dim">{hm(j.atISO)}</span></div>)}
          {!s.jobs.length && <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NO JOBS YET</p>}</section>
      </div>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
