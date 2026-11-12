import { useCallback, useEffect, useRef, useState } from "react";
import type { NetBeat, NetData, NetDetail, NetMonitor } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * SECURITY → NETWORK STATUS in the app (approved mock 2026-11-12, Uptime-Kuma style). Same data + rules as the website page.
 * LIVE: reloads when Cortana writes net_status (505th Net topic, about once a minute). If the Net is down it checks every 30 s → "● POLLING".
 * Change monitors: Developer + Commander. Check now + incident notes: anyone with "net" access.
 */
const COL = ["#22e07a", "#f59e0b", "#ff4d4d"];
const ST: Record<string, [string, string]> = { up: ["UP", "#22e07a"], slow: ["SLOW", "#f59e0b"], down: ["DOWN", "#ff4d4d"], paused: ["PAUSED", "#7d8a99"], stale: ["NO DATA", "#7d8a99"], pending: ["WAITING", "#7d8a99"] };
const RANGES = ["1H", "24H", "7D", "30D", "90D"];
const hm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dt = (iso: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");
const dur = (a: string, b?: string) => { const m = Math.max(1, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`; };
const btn = "border border-line px-3 py-1 text-[10.5px] tracking-[1.5px] text-cyan hover:bg-cyan/10 disabled:opacity-40";

function Pill({ m }: { m: NetMonitor }) {
  const [l, c] = m.status === "down" ? ["DOWN", "#ff4d4d"] : m.status === "paused" ? ["PAUSED", "#4b5765"] : m.status === "stale" ? ["NO DATA", "#4b5765"] : [m.up30 != null ? `${m.up30}%` : "—", m.status === "slow" ? "#f59e0b" : "#22e07a"];
  return <span className="min-w-[50px] rounded-[9px] px-1.5 text-center text-[10px] font-bold" style={{ background: c, color: c === "#4b5765" ? "#fff" : "#000" }}>{l}</span>;
}
function Bars({ last, n, h, w }: { last: NetBeat[]; n: number; h: number; w?: boolean }) {
  const v = last.slice(-n), pad = Array<null>(Math.max(0, n - v.length)).fill(null);
  return <span className={`flex ${w ? "flex-1 gap-[3px] overflow-hidden" : "gap-[2px]"}`} aria-hidden>{[...pad, ...v].map((b, i) => (
    <i key={i} title={b ? `${hm(b[0] * 60000)} · ${["UP", "SLOW", "DOWN"][b[2]]}${b[1] >= 0 ? ` · ${b[1]} ms` : ""}` : undefined}
      className={`${w ? "min-w-[4px] max-w-[12px] flex-1 rounded-[3px]" : "w-[4px] rounded-[2px]"} ${w && i === n - 1 ? "motion-safe:animate-[ntIn_.4s_ease-out]" : ""}`} style={{ height: h, background: b ? COL[b[2]] : "#1d2630" }} />))}</span>;
}
function Chart({ pts }: { pts?: NetBeat[] }) {
  if (!pts?.length) return <div className="py-16 text-center text-[11px] tracking-[2px] text-dim">NO CHECKS IN THIS RANGE YET</div>;
  const W = 900, H = 210, P = 34, v = pts.map((p) => p[1]).filter((x) => x >= 0), max = Math.max(100, ...v) * 1.15;
  const t0 = pts[0]![0], t1 = pts[pts.length - 1]![0] || t0 + 1;
  const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 8), y = (ms: number) => H - 20 - (ms / max) * (H - 32);
  let d = "", prev = false;
  for (const p of pts) { if (p[1] < 0) { prev = false; continue; } d += (prev ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); prev = true; }
  const first = pts.find((p) => p[1] >= 0)?.[0] ?? t0;
  const lbl = (t: number) => (t1 - t0 > 2880 ? new Date(t * 60000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : hm(t * 60000));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label="Response time chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => { const ms = Math.round(max * f); return <g key={f}><line x1={P} x2={W} y1={y(ms)} y2={y(ms)} stroke="#00d9ff14" /><text x={P - 4} y={y(ms) + 3} fill="#4b5765" fontSize="9" textAnchor="end">{ms}</text></g>; })}
      {pts.filter((p) => p[2] === 2).map((p) => <rect key={p[0]} x={x(p[0]) - 2} y={8} width={4} height={H - 28} fill="#ff4d4d33" />)}
      {d && <path d={`${d}L${x(t1).toFixed(1)},${H - 20}L${x(first).toFixed(1)},${H - 20}Z`} fill="#22e07a14" />}
      <path d={d} fill="none" stroke="#22e07a" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => { const t = t0 + (t1 - t0) * f; return <text key={f} x={x(t)} y={H - 4} fill="#4b5765" fontSize="9" textAnchor="middle">{lbl(t)}</text>; })}
    </svg>
  );
}

export function Network() {
  const [d, setD] = useState<NetData | null>(null);
  const [det, setDet] = useState<NetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [range, setRange] = useState("24H");
  const [q, setQ] = useState("");
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [edit, setEdit] = useState<NetMonitor | "new" | null>(null);
  const [, tick] = useState(0);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const last = useRef(0), selR = useRef<string | null>(null), rangeR = useRef("24H");
  selR.current = sel; rangeR.current = range;

  const loadDet = useCallback(async (id: string | null, r: string) => {
    if (!id) return setDet(null);
    const x = await window.cn.hub.network(id, r).catch(() => null);
    if (x && !("error" in x)) setDet(x);
  }, []);
  const load = useCallback(async () => {
    try {
      const r = await window.cn.hub.network();
      if (!r || "error" in r) return setError(r?.error ?? "No answer");
      setD(r); setError(null); last.current = Date.now();
      const id = selR.current && r.monitors.some((m) => m.id === selR.current) ? selR.current : r.monitors[0]?.id ?? null;
      if (id !== selR.current) setSel(id);
      await loadDet(id, rangeR.current);
    } catch { setError("This page needs an app restart"); }
  }, [loadDet]);

  useEffect(() => {
    void load();
    void window.cn.net.get().then((s: unknown) => setLive(s === "live" || (s as { state?: string })?.state === "live")).catch(() => {});
    const offS = window.cn.net.onState((s: unknown) => setLive((s as { state?: string })?.state === "live" || s === "live"));
    let t: ReturnType<typeof setTimeout> | undefined;
    const offT = window.cn.net.onTopic((x) => { if (x === "net_status" || x === "net_monitors" || x === "net_events") { clearTimeout(t); t = setTimeout(() => void load(), 400); } });
    const poll = setInterval(() => { if (Date.now() - last.current > 30_000) void load(); }, 30_000);
    const sec = setInterval(() => tick((n) => n + 1), 1000);
    return () => { offS(); offT(); clearTimeout(t); clearInterval(poll); clearInterval(sec); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const act = async (b: Record<string, unknown>) => {
    const r = await window.cn.hub.networkAction(b);
    setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]);
    if (r.id) setSel(r.id);
    if (!r.error && b.action !== "check") void load();
    return !r.error;
  };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const ms = d.monitors, m = ms.find((x) => x.id === sel);
  const c = (s: string) => ms.filter((x) => x.status === s).length;
  const u30 = ms.filter((x) => x.up30 != null && !x.paused), all = u30.length ? (u30.reduce((a, x) => a + (x.up30 ?? 0), 0) / u30.length).toFixed(2) + "%" : "—";
  const ago = Math.round((Date.now() - last.current) / 1000);
  const [sl, sc] = m ? ST[m.status] ?? ST.pending! : ["", ""];
  const inc = det?.incidents ?? [];
  const groups: [string, NetMonitor[]][] = [];
  for (const x of ms.filter((y) => y.name.toLowerCase().includes(q.toLowerCase()))) { const g = groups.find((y) => y[0] === x.group); if (g) g[1].push(x); else groups.push([x.group, [x]]); }
  const card = "border border-line bg-panel px-4 py-3";

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto p-5">
      <style>{"@keyframes ntIn{from{transform:scaleY(.2);opacity:.3}}"}</style>
      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <div><h1 className="font-head text-[22px] font-bold tracking-[3px] text-cyan">◉ NETWORK STATUS</h1>
          <p className="text-[10px] tracking-[2px] text-dim">EVERY 505TH SERVICE · CHECKED EVERY MINUTE BY CORTANA · 90-DAY HISTORY</p></div>
        <span className="flex-1" />
        <span className="text-[10.5px] tracking-[2px]" style={{ color: !d.cortanaChecking ? "#ff4d4d" : live ? "#22e07a" : "#f59e0b" }}>
          {!d.cortanaChecking ? "✕ CORTANA ISN'T CHECKING" : live ? "● LIVE" : "● POLLING"} · {ago < 2 ? "updated now" : `updated ${ago}s ago`}</span>
        {d.canEdit && <button type="button" className={btn} onClick={() => setEdit("new")}>＋ ADD MONITOR</button>}
        <button type="button" className={btn} onClick={() => void act({ action: "check" })}>↻ CHECK NOW</button>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2.5">
        {([[c("up"), "UP", "#22e07a"], [c("down") + c("stale"), "DOWN / NO DATA", "#ff4d4d"], [c("slow"), "SLOW", "#f59e0b"], [all, "UPTIME · 30 DAYS · ALL", "#00D9FF"]] as const).map(([v, l, col]) => (
          <div key={l} className="border border-line bg-panel px-3 py-2"><b className="block font-head text-[23px]" style={{ color: col }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr] gap-3">
        <div className="flex min-h-[400px] flex-col border border-line bg-panel">
          <div className="overflow-auto">{groups.map(([g, list]) => (
            <div key={g}><div className="px-3 pb-1 pt-2.5 text-[9.5px] tracking-[2px] text-dim">{g}</div>
              {list.map((x) => (
                <button key={x.id} type="button" aria-current={x.id === sel} onClick={() => { setSel(x.id); setDet(null); void loadDet(x.id, range); }}
                  className={`flex w-full items-center gap-2 border-l-[3px] px-3 py-2 text-left ${x.id === sel ? "border-cyan bg-cyan/10" : "border-transparent hover:bg-cyan/5"}`}>
                  <Pill m={x} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-[12.5px] font-normal text-white">{x.name}</b>
                    {x.third && <small className="mr-1 rounded-[7px] bg-[#5865f2] px-1.5 text-[9px] text-white">3RD-PARTY</small>}{x.muted && <small className="text-[9px]">🔕</small>}</span>
                  <Bars last={x.last} n={14} h={16} />
                </button>))}
            </div>))}</div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {!m ? <div className={card}>PICK A MONITOR</div> : <>
            <div className={card}><div className="flex items-start gap-3"><div className="min-w-0">
              <h2 className="font-head text-[23px] font-bold tracking-[2px] text-white">{m.name}</h2>
              <div className="text-[12px] text-dim">{m.target || m.info || m.type.toUpperCase()}{m.info && m.target ? ` · ${m.info}` : ""}</div>
              {d.canEdit && <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className={btn} onClick={() => void act({ action: "pause", id: m.id, on: !m.paused })}>{m.paused ? "▶ RESUME" : "⏸ PAUSE"}</button>
                <button type="button" className={btn} onClick={() => setEdit(m)}>✎ EDIT</button>
                <button type="button" className={btn} onClick={() => void act({ action: "mute", id: m.id, on: !m.muted })}>{m.muted ? "🔔 ALERTS ON" : "🔕 MUTE ALERTS"}</button>
                {!m.builtin && <button type="button" className={`${btn} !border-bad/50 !text-bad`} onClick={async () => { if (await askBox(`DELETE ${m.name.toUpperCase()}?\n\nThe monitor and its history are removed.`, { tone: "danger", go: "🗑 DELETE" })) { setSel(null); void act({ action: "delete", id: m.id }); } }}>🗑 DELETE</button>}
              </div>}</div>
              <span className="ml-auto border border-line px-1.5 text-[9.5px] tracking-[1.5px] text-dim">{m.type.toUpperCase()}</span></div></div>
            <div className={card}><div className="flex items-center gap-4"><Bars last={m.last} n={60} h={30} w />
              <span className="whitespace-nowrap rounded-[20px] px-4 py-0.5 font-head text-[21px] font-bold tracking-[2px]" style={{ background: sc, color: sc === "#7d8a99" ? "#fff" : "#000" }}>{sl}</span></div>
              <div className="mt-1.5 text-[11px] text-dim">{m.paused ? "Paused — not checked" : `Checked every 60 seconds · last check ${m.checkedAtISO ? hm(Date.parse(m.checkedAtISO)) : "—"}`}
                {m.status === "down" && m.downSinceISO && <b className="text-bad"> · down for {dur(m.downSinceISO)}{m.muted ? " (alerts muted)" : " — alert sent after 3 checks"}</b>}
                {m.error && m.status === "down" && <><br /><span className="text-[#ffb3b3]">{m.error}</span></>}</div></div>
            <div className={`${card} grid grid-cols-5 text-center`}>
              {([["RESPONSE", "current", m.ms != null ? `${m.ms} ms` : "—"], ["AVG. RESPONSE", "24-hour", m.avg24 != null ? `${m.avg24} ms` : "—"], ["UPTIME", "24-hour", m.up24 != null ? `${m.up24}%` : "—"], ["UPTIME", "30-day", m.up30 != null ? `${m.up30}%` : "—"],
                m.certValidToISO ? ["CERT EXP.", dt(m.certValidToISO).split(",")[0], `${Math.round((Date.parse(m.certValidToISO) - Date.now()) / 864e5)} days`] : ["INCIDENTS", "30-day", String(inc.filter((i) => Date.now() - Date.parse(i.startedAtISO) < 30 * 864e5).length)]] as const).map(([a, b, v], i) => (
                <div key={i}><b className="block font-head text-[14px] tracking-[1.5px] text-white">{a}</b><small className="block text-[10px] text-dim">({b})</small><span className="mt-1 block text-[13px] text-cyan">{v}</span></div>))}
            </div>
            <div className={card}><div role="radiogroup" aria-label="Chart range" className="mb-1.5 flex justify-end gap-1">
              {RANGES.map((r) => <button key={r} type="button" role="radio" aria-checked={r === range} onClick={() => { setRange(r); void loadDet(m.id, r); }} className={`border px-2 py-0.5 text-[10px] tracking-[1px] ${r === range ? "border-cyan text-cyan" : "border-line text-dim"}`}>{r}</button>)}</div>
              <div className="h-[220px]"><Chart pts={det?.points} /></div></div>
            <div className={card}><div className="font-head text-[13px] font-bold tracking-[3px] text-cyan">INCIDENTS</div>
              {inc.length ? <table className="mt-1.5 w-full text-[12px]"><thead><tr className="text-left text-[9.5px] tracking-[2px] text-dim">{["STARTED", "ENDED", "LENGTH", "ERROR", "NOTE"].map((h) => <th key={h} className="border-b border-line px-2 py-1.5 font-normal">{h}</th>)}</tr></thead>
                <tbody>{inc.map((i) => <tr key={i.id} className="border-b border-white/[.03]"><td className="px-2 py-1.5">{dt(i.startedAtISO)}</td><td className="px-2">{i.endedAtISO ? dt(i.endedAtISO) : <b className="text-bad">ONGOING</b>}</td><td className="px-2">{dur(i.startedAtISO, i.endedAtISO || undefined)}</td><td className="px-2 text-[#ffb3b3]">{i.error}</td>
                  <td className="px-2">{i.note && `${i.note} `}<button type="button" className="text-cyan" onClick={() => setNote({ id: i.id, text: i.note })}>{i.note ? "✎" : "＋ add note"}</button></td></tr>)}</tbody></table>
                : <p className="mt-1.5 text-dim">No incidents ✓</p>}</div>
            {m.id === "cortana" && <p className="text-[11px] text-dim">Cortana restart / re-sync / re-register commands: on the website for now.</p>}
          </>}
        </div>
      </div>
      {edit && <EditBox m={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSave={act} />}
      {note && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && setNote(null)}>
        <div role="dialog" aria-modal="true" aria-label="Incident note" className="w-[min(420px,100%)] border border-cyan/40 bg-panel p-4">
          <h2 className="font-head text-[18px] font-bold tracking-[2px] text-cyan">INCIDENT NOTE</h2>
          <p className="mb-2 text-[11px] text-dim">e.g. "Vercel outage" or "server restart". Leave empty to clear.</p>
          <input autoFocus maxLength={300} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setNote(null); if (e.key === "Enter") { void act({ action: "note", incidentId: note.id, note: note.text }); setNote(null); } }} aria-label="Note" className="w-full border border-line bg-[#070a0f] px-2.5 py-1.5 text-[12px] outline-none focus:border-cyan" />
          <div className="mt-3 flex justify-end gap-2"><button type="button" className={btn} onClick={() => setNote(null)}>CANCEL</button><button type="button" className={`${btn} !border-[#c9a227] !text-[#c9a227]`} onClick={() => { void act({ action: "note", incidentId: note.id, note: note.text }); setNote(null); }}>SAVE</button></div>
        </div></div>}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2 text-[12px] tracking-[1px] ${toast[1] ? "border-ok/50 bg-[#06130c] text-ok" : "border-bad/50 bg-[#1a0808] text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function EditBox({ m, onClose, onSave }: { m: NetMonitor | null; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [type, setType] = useState(m?.type ?? "http");
  const [name, setName] = useState(m?.name ?? "");
  const [target, setTarget] = useState(m?.target ?? "");
  const [slow, setSlow] = useState(m?.slowMs ?? 2500);
  const showAddr = !m || type === "http" || type === "game";
  const fld = "w-full border border-line bg-[#070a0f] px-2.5 py-1.5 text-[12px] outline-none focus:border-cyan";
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const save = async () => { const b = { name, slowMs: slow, ...(showAddr ? { target } : {}) }; if (await onSave(m ? { action: "edit", id: m.id, ...b } : { action: "add", type, ...b })) onClose(); };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={m ? "Edit monitor" : "Add monitor"} className="w-[min(480px,100%)] border border-cyan/40 bg-panel">
        <div className="flex items-center border-b border-line px-4 py-3"><h2 className="font-head text-[18px] font-bold tracking-[2px] text-cyan">{m ? "✎ EDIT MONITOR" : "＋ ADD MONITOR"}</h2><span className="flex-1" /><button type="button" aria-label="Close" className={btn} onClick={onClose}>✕</button></div>
        <div className="flex flex-col gap-1.5 px-4 py-3 text-[10px] tracking-[1.5px] text-dim">
          {!m && <><label htmlFor="nmT">TYPE</label><select id="nmT" value={type} onChange={(e) => setType(e.target.value)} className={fld}><option value="http">Website / API (https://…)</option><option value="game">Arma 3 / Steam game server</option></select></>}
          <label htmlFor="nmN">NAME</label><input id="nmN" autoFocus maxLength={50} value={name} onChange={(e) => setName(e.target.value)} className={fld} />
          {showAddr && <><label htmlFor="nmA">ADDRESS <small>{type === "game" ? "host:queryPort — the game port + 1" : "must start with https://"}</small></label>
            <input id="nmA" maxLength={200} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={type === "game" ? "203.0.113.10:2303" : "https://"} className={fld} /></>}
          <label htmlFor="nmS">COUNT AS SLOW OVER (MS)</label><input id="nmS" type="number" min={50} max={30000} value={slow} onChange={(e) => setSlow(Number(e.target.value))} className={fld} />
        </div>
        <div className="flex items-center gap-2 border-t border-line px-4 py-3"><span className="flex-1 text-[10.5px] text-dim">Down for 3 checks in a row → Discord + 🔔 alert (unless muted).</span>
          <button type="button" className={btn} onClick={onClose}>CANCEL</button><button type="button" className={`${btn} !border-[#c9a227] !text-[#c9a227]`} onClick={() => void save()}>{m ? "SAVE" : "ADD"}</button></div>
      </div>
    </div>
  );
}
