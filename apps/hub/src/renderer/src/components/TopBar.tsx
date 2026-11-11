import { useEffect, useMemo, useRef, useState } from "react";
import type { NetState, Overview, Summary } from "../../../preload/api";
import { countdown, ukTime } from "../ui";
import { NAV_LINKS } from "./SideNav";
import logo from "../../../../assets/logo.png";

/**
 * Top bar (approved mock 2026-11-11): logo · breadcrumb · Ctrl K jump-to · NEXT OP card (live countdown + sign-up bar)
 * · Cortana ping + 505th Net · UK clock · refresh · messages · alerts dropdown (mark read). Your name lives in the side-nav card.
 */
const ALERT_ICON: Record<string, [string, string]> = {
  promotion: ["▲", "#22e07a"], transfer: ["⇄", "#00d9ff"], commendation: ["★", "#a78bfa"], medal: ["★", "#a78bfa"], warning: ["⚠", "#ff4d4d"], event: ["⚑", "#f59e0b"],
  bct: ["✚", "#f59e0b"], note: ["@", "#00d9ff"], message: ["✉", "#00d9ff"], sitrep: ["✉", "#f59e0b"], staff: ["★", "#f59e0b"], access: ["🔑", "#00d9ff"],
};
const ago = (v: unknown) => {
  const t = typeof v === "string" ? Date.parse(v) : v && typeof v === "object" && "$date" in (v as object) ? Date.parse(String((v as { $date: string }).$date)) : NaN;
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? "now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function TopBar(p: { sum: Summary; ov: Overview | null; net: NetState; page: string; onPage: (id: string) => void; onRefresh: () => void; access: Record<string, boolean> }) {
  const [now, setNow] = useState(Date.now());
  const [bell, setBell] = useState(false);
  const [pal, setPal] = useState(false);
  const [spin, setSpin] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(true); } if (e.key === "Escape") { setPal(false); setBell(false); } };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (!bell) return;
    const c = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-bell]")) setBell(false); };
    addEventListener("mousedown", c);
    return () => removeEventListener("mousedown", c);
  }, [bell]);

  const op = p.sum.ops[0];
  const unread = p.sum.alerts.filter((a) => !a.read);
  const c = p.sum.system.cortana;
  const live = p.net.state === "live";
  const ms = op ? Date.parse(op.startAtISO) - now : 0;
  return (
    <header className="topscan relative flex h-[58px] shrink-0 items-center gap-2.5 border-b border-cyan/20 bg-gradient-to-b from-[#0a1119] to-[#070b10] px-3.5 shadow-[0_8px_24px_-12px_rgba(0,217,255,.25)]">
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="" className="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(0,217,255,.35)]" />
        <b className="font-head text-[12px] font-bold leading-[1.15] tracking-[4px] text-cyan">COMMAND<br /><span className="text-white">NETWORK</span><span className="animate-pulse">_</span></b>
      </div>
      <div className="ml-1 flex gap-2 border-l border-cyan/20 pl-3 text-[11px] tracking-[2px] text-dimmer">NETWORK <span className="opacity-40">/</span><span className="text-cyan">{p.page.toUpperCase()}</span></div>
      <button type="button" onClick={() => setPal(true)} className="ml-2 flex w-[290px] items-center gap-2 border border-cyan/20 bg-black/40 px-2.5 py-[7px] text-left text-[12px] text-dim hover:border-cyan/50">
        <span className="text-cyan">⌕</span>Jump to a page or action…<kbd className="ml-auto border border-cyan/20 px-1.5 text-[9.5px]">Ctrl K</kbd></button>
      <div className="flex-1" />
      {op && (
        <button type="button" onClick={() => p.onPage("panel-events")} title={op.title} className="grid min-w-[210px] grid-cols-[1fr_auto] items-center gap-x-3 border border-amber/40 bg-amber/5 px-2.5 py-1 text-left hover:border-amber">
          <span className="text-[9px] tracking-[2px] text-amber">{ms <= 0 ? "● LIVE NOW" : "NEXT OP"}</span>
          <b className="row-span-2 font-head text-[18px] tracking-[1px] text-amber">{ms <= 0 ? "LIVE" : countdown(ms)}</b>
          <span className="max-w-[150px] truncate text-[11.5px] tracking-[1px] text-white">{op.title.toUpperCase()}</span>
          <i className="col-span-2 mt-0.5 block h-[2px] bg-amber/15"><i className="block h-full bg-ok" style={{ width: `${Math.min(100, op.signedUp * 4)}%` }} /></i>
        </button>
      )}
      <div className="flex items-center gap-2.5 border px-2.5 py-1" style={{ borderColor: c.online && live ? "rgb(34 224 122 / .35)" : "rgb(255 77 77 / .5)", background: c.online && live ? "rgb(34 224 122 / .04)" : "rgb(255 77 77 / .06)" }}
        title={c.online ? "Cortana online" : "Cortana offline"}>
        <i className={`h-2 w-2 rounded-full ${c.online ? "animate-pulse bg-ok" : "bg-bad"}`} />
        <span className="leading-tight"><b className="block text-[10.5px] font-normal tracking-[2px] text-white">CORTANA</b><small className="text-[10px] text-dim">{c.online ? (c.pingMs != null ? `${c.pingMs} ms` : "online") : "offline"}</small></span>
        <i className="h-6 w-px bg-cyan/20" />
        <span className="leading-tight"><b className="block text-[10.5px] font-normal tracking-[2px] text-white">NET</b><small className="text-[10px]" style={{ color: live ? "#22e07a" : p.net.state === "connecting" ? "#f59e0b" : "#ff4d4d" }}>{live ? "LIVE" : p.net.state === "connecting" ? "…" : "OFF"}</small></span>
        <i className="h-6 w-px bg-cyan/20" />
        {(() => { const ok = c.online && live, part = c.online || live; const col = ok ? "#22e07a" : part ? "#f59e0b" : "#ff4d4d";
          return <span className="leading-tight" role="status" title={ok ? "Hub is live: Cortana online and live sync connected" : `${c.online ? "" : "Cortana offline. "}${live ? "" : "Live sync off — the Hub refreshes every minute instead."}`}>
            <b className="block text-[10.5px] font-normal tracking-[2px] text-white">HUB <span style={{ color: col }}>● {ok ? "LIVE" : part ? "PARTIAL" : "OFFLINE"}</span></b>
            <small className="text-[10px] tracking-[1px]" style={{ color: col }}>{ok ? "OPERATIONAL" : part ? "DEGRADED" : "NO CONNECTION"}</small></span>; })()}
      </div>
      <div className="px-1 text-right leading-tight"><b className="block font-head text-[17px] tracking-[1px] text-white">{ukTime(now)}</b><small className="text-[9.5px] tracking-[1.5px] text-dim">UK · {ukTime(now, { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}</small></div>
      <button type="button" aria-label="Refresh" title="Refresh" onClick={() => { setSpin(true); p.onRefresh(); setTimeout(() => setSpin(false), 800); }} className="grid h-9 w-9 place-items-center border border-cyan/20 text-[15px] text-[#c6d0da] hover:border-cyan hover:shadow-[0_0_12px_-3px_#00d9ff]">
        <span className={spin ? "animate-spin" : ""}>↻</span></button>
      <button type="button" aria-label="Messages" title="Messages (coming soon)" onClick={() => p.onPage("panel-msg2")} className="grid h-9 w-9 place-items-center border border-cyan/20 text-[14px] text-[#c6d0da] hover:border-cyan">✉</button>
      <div data-bell className="relative">
        <button type="button" aria-label={`Alerts, ${unread.length} unread`} aria-expanded={bell} onClick={() => setBell(!bell)} className="relative grid h-9 w-9 place-items-center border border-cyan/20 text-[14px] hover:border-cyan">
          🔔{unread.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-bad px-1 text-[10px] text-white">{unread.length > 9 ? "9+" : unread.length}</span>}</button>
        {bell && (
          <div role="dialog" aria-label="Alerts" className="rise absolute right-0 top-[44px] z-50 w-[370px] border border-cyan/40 bg-[#0a1018] shadow-[0_20px_50px_rgba(0,0,0,.75)]">
            <div className="flex items-center gap-2 border-b border-cyan/15 px-3 py-2.5 text-[11px] tracking-[2px]"><b className="font-normal text-cyan">ALERTS</b><span className="text-dim">{unread.length} unread</span><div className="flex-1" />
              {unread.length > 0 && <button type="button" onClick={() => void window.cn.hub.readAlerts({ all: true }).then(p.onRefresh)} className="text-[11px] tracking-normal text-cyan hover:underline">Mark all read</button>}</div>
            <div className="max-h-[420px] overflow-auto">
              {p.sum.alerts.length ? p.sum.alerts.map((a) => { const [ic, col] = ALERT_ICON[a.type] ?? ["◆", "#7d8a99"]; return (
                <button key={a.id} type="button" onClick={() => { if (!a.read) void window.cn.hub.readAlerts({ ids: [a.id] }).then(p.onRefresh); }}
                  className={`flex w-full gap-2.5 border-b border-cyan/5 px-3 py-2.5 text-left text-[12.5px] hover:bg-cyan/5 ${a.read ? "" : "bg-cyan/[.05]"}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center border" style={{ color: col, borderColor: col }}>{ic}</span>
                  <span className="min-w-0 flex-1"><b className={`block font-normal ${a.read ? "text-[#aeb9c4]" : "text-white"}`}>{a.title}</b><small className="block truncate text-[11px] text-dim">{a.body}{a.body && ago(a.at) ? " · " : ""}{ago(a.at)}</small></span>
                  {!a.read && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan" />}
                </button>); }) : <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NOTHING HERE</p>}
            </div>
          </div>)}
      </div>
      {pal && <Palette access={p.access} onClose={() => setPal(false)} onPage={(id) => { setPal(false); p.onPage(id); }} />}
    </header>
  );
}

function Palette(p: { access: Record<string, boolean>; onClose: () => void; onPage: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  const items = useMemo(() => {
    const pages: [string, string, string][] = [["dashboard", "■ Dashboard", "PAGES"], ...NAV_LINKS.filter((l) => !l.key || p.access[l.key]).map((l): [string, string, string] => [l.id, `${l.icon} ${l.label}${l.app ? "" : " · soon"}`, "PAGES"])];
    const acts: [string, string, string][] = [["panel-events", "📅 Create event", "ACTIONS"], ["panel-attendance", "▣ Take attendance", "ACTIONS"], ["panel-aar", "✦ Write AAR", "ACTIONS"], ["panel-register", "✚ Approve BCT", "ACTIONS"], ["panel-roster", "★ Award medal / ribbon", "ACTIONS"]];
    const s = q.toLowerCase();
    return [...pages, ...acts.filter(([id]) => NAV_LINKS.find((l) => l.id === id && (!l.key || p.access[l.key])))].filter(([, l]) => !s || l.toLowerCase().includes(s));
  }, [q, p.access]);
  let last = "";
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 pt-[12vh] backdrop-blur-[3px]" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-label="Jump to" className="rise mx-auto w-[600px] border border-cyan bg-[#0a1018] shadow-[0_0_40px_rgba(0,217,255,.2)]">
        <div className="flex items-center gap-2.5 border-b border-cyan/15 px-3.5 py-3 text-cyan">⌕
          <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Jump to a page or action…" aria-label="Jump to"
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(i + 1, items.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(i - 1, 0)); } if (e.key === "Enter" && items[i]) p.onPage(items[i]![0]); }}
            className="flex-1 bg-transparent text-[15px] text-white outline-none" /><kbd className="border border-cyan/20 px-1.5 text-[9.5px] text-dim">ESC</kbd></div>
        <div className="max-h-[50vh] overflow-auto pb-1.5">
          {items.map(([id, l, g], n) => { const head = g !== last; last = g; return (
            <div key={g + id + l}>{head && <div className="px-3.5 pb-1 pt-2 text-[9.5px] tracking-[3px] text-dim">{g}</div>}
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => p.onPage(id)} className={`block w-full border-l-2 px-3.5 py-2 text-left text-[13px] ${n === i ? "border-cyan bg-cyan/10 text-white" : "border-transparent text-[#c6d0da]"}`}>{l}</button></div>); })}
          {!items.length && <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NOTHING MATCHES</p>}
        </div>
      </div>
    </div>
  );
}
