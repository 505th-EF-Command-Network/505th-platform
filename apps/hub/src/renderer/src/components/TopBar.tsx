import { useEffect, useRef, useState } from "react";
import type { NetState, Summary } from "../../../preload/api";
import { STATE, countdown, ukTime, type StateKey } from "../ui";
import logo from "../../../../assets/logo.png";

/** Top bar (approved mock): logo · breadcrumb · next op · system status · UK clock · alerts · me + status menu. */
export function TopBar(p: { data: Summary | null; net: NetState; page: string; onStatus: (s: StateKey) => void; onSignOut: () => void }) {
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setMenu(false); };
    addEventListener("mousedown", close); addEventListener("keydown", close);
    return () => { removeEventListener("mousedown", close); removeEventListener("keydown", close); };
  }, [menu]);

  const me = p.data?.me;
  const st = (me?.status.state ?? "online") as StateKey;
  const op = p.data?.ops[0];
  const unread = p.data?.alerts.filter((a) => !a.read).length ?? 0;
  const sysOk = !!p.data?.system.cortana.online && p.net.state === "live";
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-cyan/20 bg-gradient-to-b from-[#0b1016] to-[#080b10] px-4">
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="" className="h-9 w-9 object-contain" />
        <b className="font-head text-[16px] font-bold tracking-[4px] text-cyan">COMMAND NETWORK<span className="animate-pulse">_</span></b>
      </div>
      <div className="ml-2 border-l border-cyan/20 pl-4 text-[11px] tracking-[2px] text-dimmer">NETWORK / <span className="text-cyan">{p.page.toUpperCase()}</span></div>
      <div className="flex-1" />
      {op && (
        <div className="pill" title={op.title}>
          <i className="dot" style={{ background: "#f59e0b" }} />NEXT OP <b className="text-amber">{countdown(Date.parse(op.startAtISO) - now).replace(/:\d\d$/, "")}</b>
        </div>
      )}
      <div className="pill" title={sysOk ? "Cortana online · 505th Net live" : "Something is down"}>
        <i className="dot" style={{ background: sysOk ? "#22e07a" : "#ff4d4d" }} />{sysOk ? "CORTANA · NET" : "SYSTEM ISSUE"}
      </div>
      <div className="pill"><b className="text-white">{ukTime(now)}</b><small className="text-dimmer">UK</small></div>
      <button type="button" className="relative grid h-[34px] w-[38px] place-items-center border border-cyan/25 text-[15px] text-cyan" aria-label={`Alerts, ${unread} unread`}>
        🔔{unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 font-head text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <div ref={box} className="relative">
        <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu"
          className="flex h-[42px] items-center gap-2.5 border border-transparent px-2 hover:border-cyan/25">
          <span className="relative grid h-9 w-9 place-items-center bg-gradient-to-br from-[#183040] to-[#0b2028] font-head text-[12px] font-bold text-gold [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]">
            {(me?.name ?? "").replace(/^\S+\s/, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ME"}
          </span>
          <i className="-ml-4 mt-6 h-[11px] w-[11px] rounded-full border-2 border-[#080b10]" style={{ background: STATE[st].color }} />
          <span className="text-left"><b className="block font-head text-[13px] font-bold tracking-[2px] text-white">{me?.name.toUpperCase() ?? "…"}</b>
            <small className="text-[10px] tracking-[1.5px]" style={{ color: STATE[st].color }}>{STATE[st].label}</small></span>
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-[48px] z-20 w-[250px] border border-cyan/35 bg-panel py-1.5 shadow-[0_14px_34px_rgba(0,0,0,.6)]">
            <div className="px-3.5 pb-1 pt-2 text-[10px] tracking-[2px] text-dimmer">MY STATUS</div>
            {(["online", "dnd", "invisible"] as const).map((k) => (
              <button key={k} role="menuitemradio" aria-checked={st === k} type="button" onClick={() => { setMenu(false); p.onStatus(k); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] tracking-[1px] hover:bg-cyan/10 ${st === k ? "text-cyan" : "text-[#d6dde6]"}`}>
                <i className="h-[9px] w-[9px] rounded-full" style={{ background: STATE[k].color }} />{STATE[k].label}
              </button>
            ))}
            <hr className="my-1 border-cyan/10" />
            <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onSignOut(); }} className="flex w-full px-3.5 py-2 text-left text-[12.5px] tracking-[1px] text-[#d6dde6] hover:bg-bad/10 hover:text-bad">⏻ SIGN OUT</button>
          </div>
        )}
      </div>
    </header>
  );
}
