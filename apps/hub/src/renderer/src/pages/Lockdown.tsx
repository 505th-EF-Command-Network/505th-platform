import { useCallback, useEffect, useMemo, useState } from "react";
import { askBox } from "../components/Confirm";

/**
 * COMMAND CENTRE → MODERATION → DISCORD LOCKDOWN (approved mock 19 Nov). Commander / Developer or Kick-Ban access.
 * Levels: slow mode · lock channels · full lockdown (+ pause invites). Cortana saves every channel's permissions first and puts
 * them back exactly when it ends (timer or LIFT NOW). Private / staff channels are never touched.
 */
type Cur = { level: string; slowSec: number; invites: boolean; reason: string; by: string; startedAtISO: string; untilISO: string | null; channels: number; channelNames: string[]; steps: string[] };
type Hist = { id: string; level: string; slowSec?: number; invites: boolean; channels: number; reason: string; by: string; startedAtISO: string; minutes: number; how: string };
type D = { current: Cur | null; channels: { id: string; name: string; type: string; parentName: string }[]; history: Hist[]; cortanaOnline: boolean };
const LV: Record<string, [string, string, string]> = {
  slow: ["🐢 SLOW MODE", "#00D9FF", "Everyone can post once every 30 s / 1 min / 5 min"],
  lock: ["🔒 LOCK CHANNELS", "#f59e0b", "Members can read but not post. Staff can."],
  full: ["⛔ FULL LOCKDOWN", "#ff4d4d", "Lock + hide public channels + stop voice. Invites paused."],
};
const DUR: [number, string][] = [[15, "15 MIN"], [30, "30 MIN"], [60, "1 HOUR"], [0, "UNTIL I LIFT IT"]];
const SLOW: [number, string][] = [[30, "30 SEC"], [60, "1 MIN"], [300, "5 MIN"]];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const blank = { level: "lock", slowSec: 30, invites: false, mode: "all" as "all" | "pick", picked: [] as string[], minutes: 15, reason: "", announce: true, notice: "⚠ Server temporarily locked — we're dealing with a problem. Back soon.", alertStaff: true, confirm: "" };

export function Lockdown() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [, tick] = useState(0);
  const load = useCallback(async () => { try { const r = await window.cn.hub.lockdown(); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as D); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const off = window.cn.net.onTopic((x) => { if (x === "lockdown" || x === "lockdown_history") void load(); }); return off; }, [load]);
  useEffect(() => { if (!d?.current) return; const t = setInterval(() => { tick((n) => n + 1); if (!document.hidden && document.documentElement.dataset.page === "panel-lockdown") void load(); }, d.current.untilISO ? 1000 : 15000); return () => clearInterval(t); }, [d?.current, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  const groups = useMemo(() => [...new Set((d?.channels ?? []).map((c) => c.parentName || "NO CATEGORY"))], [d]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim";
  const card = "border border-cyan/15 bg-panel p-4";
  const run = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true); const r = await window.cn.hub.lockdownAction(body); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : [r.queued ? "SENT — CORTANA IS WORKING ON IT" : okMsg, !r.error]); void load(); return !r.error;
  };
  const c = d.current;

  if (c) {
    const left = c.untilISO ? Math.max(0, Math.ceil((Date.parse(c.untilISO) - Date.now()) / 1000)) : null;
    const [lbl0, col] = LV[c.level] ?? LV.lock!;
    return (
      <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Discord Lockdown">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⛔ DISCORD LOCKDOWN</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">RAID OR EMERGENCY · CORTANA PUTS EVERY PERMISSION BACK EXACTLY AFTER</p>
        <section role="alert" className="mt-4 border p-5 text-center" style={{ borderColor: col, background: `${col}0f` }}>
          <b className="text-[14px] tracking-[3px]" style={{ color: col }}>{lbl0}{c.level === "slow" ? ` · ${c.slowSec} S` : ""} · {c.channels} CHANNELS{c.invites ? " · INVITES PAUSED" : ""}</b>
          <div className="my-1.5 font-head text-[34px] font-bold text-white">{left == null ? "UNTIL LIFTED" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`}</div>
          <div className="text-[12.5px] text-[#c6d0da]">{c.reason} · by {c.by} · since {when(c.startedAtISO)}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={busy} onClick={() => void run({ action: "extend", minutes: 15 }, "+15 MIN")} className={`${btn} border-cyan/50 text-cyan`}>＋ 15 MIN</button>
            {c.level !== "full" && <button type="button" disabled={busy} onClick={async () => { if (await askBox("Make it a FULL LOCKDOWN?\nPublic channels are hidden, voice is stopped and invites are paused.", { tone: "danger", go: "MAKE FULL", typeToConfirm: "LOCKDOWN" })) void run({ action: "upgrade" }, "NOW FULL LOCKDOWN"); }} className={`${btn} border-amber/60 text-amber`}>MAKE IT FULL LOCKDOWN</button>}
            <button type="button" disabled={busy} onClick={async () => { if (await askBox("Lift the lockdown now?\nCortana puts every channel back exactly as it was.", { tone: "info", go: "LIFT NOW" })) void run({ action: "lift" }, "✓ LOCKDOWN LIFTED"); }} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>{busy ? "WORKING…" : "✓ LIFT NOW"}</button>
          </div>
        </section>
        <section className={`${card} mt-4`}><h3 className="m-0 mb-2 text-[10px] tracking-[3px] text-[#9cbf4a]">WHAT CORTANA DID</h3>
          {(c.steps ?? []).map((s, i) => <div key={i} className="border-b border-white/5 py-1.5 text-[12.5px]">{s.startsWith("⚠") ? <span className="text-amber">{s}</span> : <>✓ {s}</>}</div>)}
          <p className="mb-0 mt-2.5 text-[11.5px] text-dim">When it ends (timer or LIFT NOW) Cortana puts every channel back exactly as it was, then posts "Server unlocked" if a notice was posted.</p>
          {c.channelNames?.length > 0 && <p className="mb-0 mt-2 text-[11px] text-dimmer">Channels: {c.channelNames.map((n) => `#${n}`).join(" · ")}{c.channels > c.channelNames.length ? " …" : ""}</p>}</section>
        {toast && <Toast t={toast} />}
      </main>);
  }

  const L = LV[v.level]!;
  const count = v.mode === "all" ? d.channels.length : v.picked.length;
  const what = `${v.level === "slow" ? "🐢 SLOW" : v.level === "full" ? "⛔ FULL LOCKDOWN" : "🔒 LOCK"} ${v.level === "full" ? "" : `${count} CHANNELS `}${v.minutes ? `FOR ${DUR.find(([m]) => m === v.minutes)?.[1]}` : "UNTIL LIFTED"}${v.invites && v.level !== "full" ? " + PAUSE INVITES" : ""}`;
  const ready = d.cortanaOnline && v.reason.trim().length >= 3 && count > 0 && (v.level !== "full" || v.confirm.trim().toUpperCase() === "LOCKDOWN");
  const go = async () => {
    if (!ready) return;
    if (!(await askBox(`${what}?\nReason: ${v.reason}`, { tone: "danger", go: "START" }))) return;
    if (await run({ action: "start", level: v.level, slowSec: v.slowSec, invites: v.level === "full" || v.invites, minutes: v.minutes, reason: v.reason, channelIds: v.mode === "pick" ? v.picked : [], announce: v.announce, notice: v.notice, alertStaff: v.alertStaff, confirm: v.confirm }, "⛔ LOCKDOWN STARTED")) setV(blank);
  };
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Discord Lockdown">
      <div className="flex items-end gap-3"><div className="flex-1"><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⛔ DISCORD LOCKDOWN</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">RAID OR EMERGENCY · CORTANA LOCKS CHANNELS AND PUTS EVERY PERMISSION BACK EXACTLY AFTER</p></div>
        <span className="border border-ok/40 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-ok">● SERVER NORMAL</span></div>
      {!d.cortanaOnline && <p className="mt-3 border border-bad/50 bg-bad/5 px-3 py-2 text-[12px] text-bad">⚠ Cortana is offline — a lockdown can't start until she's back.</p>}

      <section className={`${card} mt-4`}><h3 className="m-0 mb-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">1 · LEVEL</h3>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Object.entries(LV).map(([k, [l, c2, desc]]) => <button key={k} type="button" aria-pressed={v.level === k} onClick={() => setV({ ...v, level: k, confirm: "" })} className="border p-2.5 text-left" style={v.level === k ? { borderColor: c2, background: `${c2}14` } : { borderColor: "#ffffff1a" }}>
            <b className="block text-[11.5px] tracking-[1.5px]" style={{ color: c2 }}>{l}</b><small className="text-[11px] text-dim">{desc}</small></button>)}
          <button type="button" aria-pressed={v.invites || v.level === "full"} disabled={v.level === "full"} onClick={() => setV({ ...v, invites: !v.invites })} className="border p-2.5 text-left disabled:opacity-60" style={v.invites || v.level === "full" ? { borderColor: "#a78bfa", background: "#a78bfa14" } : { borderColor: "#ffffff1a" }}>
            <b className="block text-[11.5px] tracking-[1.5px] text-[#a78bfa]">✋ PAUSE INVITES</b><small className="text-[11px] text-dim">No new joins. Tick on top of any level</small></button>
        </div>
        {v.level === "slow" && <><span className={lbl}>ONE MESSAGE EVERY</span><div className="flex gap-1.5">{SLOW.map(([s, l]) => <button key={s} type="button" aria-pressed={v.slowSec === s} onClick={() => setV({ ...v, slowSec: s })} className={`${btn} ${v.slowSec === s ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div></>}
        {v.level === "lock" && <p className="mb-0 mt-2.5 text-[12px] text-dim">Members can still read. Only staff can post.</p>}
        {v.level === "full" && <><p className="mb-0 mt-2.5 border border-bad/40 px-3 py-2 text-[12px] text-[#f3b3b3]">Public channels hidden, voice stopped, only staff see the server. Invites are paused too.</p>
          <label htmlFor="ldC" className={lbl}>TYPE LOCKDOWN TO CONFIRM</label><input id="ldC" autoComplete="off" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value.toUpperCase() })} className={`${inp} max-w-[240px]`} /></>}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className={card}><h3 className="m-0 mb-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">2 · WHICH CHANNELS</h3>
          <div className="flex flex-wrap items-center gap-1.5"><button type="button" aria-pressed={v.mode === "all"} onClick={() => setV({ ...v, mode: "all" })} className={`${btn} ${v.mode === "all" ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>ALL PUBLIC ({d.channels.length})</button>
            <button type="button" aria-pressed={v.mode === "pick"} onClick={() => setV({ ...v, mode: "pick" })} className={`${btn} ${v.mode === "pick" ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>PICK… {v.mode === "pick" ? `(${v.picked.length})` : ""}</button>
            <span className="text-[11px] text-dim">Staff / private channels always stay open</span></div>
          {v.mode === "pick" && <div className="mt-2.5 max-h-[220px] overflow-auto border border-white/10 p-2 text-[12px]">{groups.map((g) => <div key={g} className="mb-1.5"><b className="block text-[9.5px] font-normal tracking-[1.5px] text-dim">{g.toUpperCase()}</b>
            <div className="grid grid-cols-2 gap-x-3">{d.channels.filter((c2) => (c2.parentName || "NO CATEGORY") === g).map((c2) => <label key={c2.id} className="flex items-center gap-1.5 py-0.5"><input type="checkbox" checked={v.picked.includes(c2.id)} onChange={(e) => setV({ ...v, picked: e.target.checked ? [...v.picked, c2.id] : v.picked.filter((x) => x !== c2.id) })} />{c2.type === "voice" || c2.type === "stage" ? "🔊" : "#"} {c2.name}</label>)}</div></div>)}</div>}
        </section>
        <section className={card}><h3 className="m-0 mb-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">3 · HOW LONG + WHY</h3>
          <div className="flex flex-wrap gap-1.5">{DUR.map(([m, l]) => <button key={m} type="button" aria-pressed={v.minutes === m} onClick={() => setV({ ...v, minutes: m })} className={`${btn} ${v.minutes === m ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>
          <label htmlFor="ldR" className={lbl}>REASON (REQUIRED · AUDIT LOG + MOD LOG)</label><input id="ldR" maxLength={300} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={inp} placeholder="e.g. Raid — spam accounts joining" />
          <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.announce} onChange={(e) => setV({ ...v, announce: e.target.checked })} /> Post a notice in #announcements</label>
          {v.announce && <input aria-label="Notice" maxLength={500} value={v.notice} onChange={(e) => setV({ ...v, notice: e.target.value })} className={`${inp} mt-1.5`} />}
          <label className="mt-2 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.alertStaff} onChange={(e) => setV({ ...v, alertStaff: e.target.checked })} /> Alert all staff (Hub + website)</label>
        </section>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className="flex-1 text-[11px] text-dim">{v.reason.trim().length < 3 ? "▲ A reason is required" : "Commander / Developer / anyone with Kick-Ban access · needs Cortana online"}</span>
        <button type="button" disabled={!ready || busy} onClick={() => void go()} className="border px-4 py-2.5 text-[11px] font-bold tracking-[1.5px] disabled:opacity-40" style={{ color: L[1], borderColor: L[1] }}>{busy ? "WORKING…" : what}</button></div>

      <section className="mt-4 border border-cyan/15 bg-panel"><h3 className="m-0 border-b border-white/5 px-3.5 py-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">HISTORY</h3>
        <table className="w-full border-collapse text-[12.5px]"><thead><tr className="text-left text-[9.5px] tracking-[1.5px] text-dim">{["WHEN", "LEVEL", "BY", "REASON", "LASTED"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>{d.history.map((h) => { const [l, c2] = LV[h.level] ?? ["?", "#7d8a99"]; return <tr key={h.id} className="border-t border-white/5"><td className="px-3 py-2 text-dim">{when(h.startedAtISO)}</td>
            <td className="px-3"><span className="border px-1.5 text-[10px] tracking-[1px]" style={{ color: c2, borderColor: `${c2}66` }}>{l.replace(/^\S+\s/, "")}{h.level === "slow" && h.slowSec ? ` ${h.slowSec}S` : ""}</span></td>
            <td className="px-3">{h.by}</td><td className="px-3 text-[#c6d0da]">{h.reason}</td><td className="px-3 text-dim">{h.minutes} min · {h.how}</td></tr>; })}
            {!d.history.length && <tr><td colSpan={5} className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NO LOCKDOWNS YET</td></tr>}</tbody></table></section>
      {toast && <Toast t={toast} />}
    </main>
  );
}
const Toast = ({ t }: { t: [string, boolean] }) => <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${t[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{t[0]}</div>;
