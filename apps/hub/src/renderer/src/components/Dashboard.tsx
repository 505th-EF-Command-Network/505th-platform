import { useEffect, useState } from "react";
import type { Summary } from "../../../preload/api";
import { STATE, countdown, ukTime, type StateKey } from "../ui";

const ALERT_ICON: Record<string, [string, string]> = {
  promotion: ["▲", "#22e07a"], transfer: ["⇄", "#00d9ff"], commendation: ["★", "#a78bfa"], warning: ["⚠", "#ff4d4d"], event: ["⚑", "#f59e0b"],
  bct: ["✚", "#f59e0b"], note: ["@", "#00d9ff"], message: ["✉", "#00d9ff"], sitrep: ["✉", "#f59e0b"], staff: ["★", "#f59e0b"], access: ["🔑", "#00d9ff"],
};

/** App Dashboard (approved mock 2026-11-11): greeting, KPI row, next op countdown, 8-week bars, alerts, My Status. */
export function Dashboard(p: { data: Summary; onStatus: (s: StateKey) => void; onPage: (id: string) => void }) {
  const { me, ops, alerts } = p.data;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const pct = me.opsEligible ? Math.round((me.opsAttended / me.opsEligible) * 100) : null;
  const pctC = pct == null ? "#4b5765" : pct >= 75 ? "#22e07a" : pct >= 50 ? "#f59e0b" : "#ff4d4d";
  const hour = Number(ukTime(now, { hour: "2-digit", hour12: false }));
  const greet = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  const unread = alerts.filter((a) => !a.read);
  const op = ops[0];
  const st = (me.status.state ?? "online") as StateKey;
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const list = filter === "unread" ? unread : alerts;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Dashboard">
      <div className="rise mb-4 flex items-end gap-4">
        <div>
          <small className="text-[12px] tracking-[1.5px] text-dim">{ukTime(now, { weekday: "long", day: "numeric", month: "long" }).toUpperCase()} · {greet}</small>
          <h1 className="m-0 font-head text-[26px] font-bold tracking-[3px] text-white">WELCOME BACK, {me.name.replace(/^\S+\s/, "").replace(/"/g, "").toUpperCase()}</h1>
        </div>
        <div className="flex-1" />
        <small className="text-[12px] tracking-[1.5px] text-dim">{unread.length ? `${unread.length} THING${unread.length === 1 ? "" : "S"} NEED YOU` : "ALL CLEAR"}</small>
      </div>

      <div className="mb-3.5 grid grid-cols-4 gap-3">
        <div className="kpi rise" style={{ animationDelay: "0s" }}>
          <small>MY ATTENDANCE</small><b>{pct == null ? "—" : `${pct}%`}</b>
          <svg className="absolute bottom-2.5 right-3 h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,217,255,.12)" strokeWidth="7" />
            <circle cx="32" cy="32" r="28" fill="none" stroke={pctC} strokeWidth="7" strokeLinecap="round" strokeDasharray="176" className="ring" style={{ ["--o" as string]: 176 - (176 * (pct ?? 0)) / 100 }} />
          </svg>
        </div>
        <div className="kpi rise" style={{ animationDelay: ".08s" }}>
          <small>THIS MONTH</small><b>{me.attendance} / 3</b>
          <span className="absolute right-3 top-3 text-[11px] text-amber">{me.attendance >= 3 ? "+1 PT AT RESET" : `${3 - me.attendance} MORE = +1 PT`}</span>
        </div>
        <div className="kpi rise" style={{ animationDelay: ".16s" }}>
          <small>PROMOTION TRACKER</small><b className="!text-[#ffd166]">{me.pt} PT</b>
          <span className="absolute right-3 top-3 text-[11px] text-dim">OPS {me.opsAttended} / {me.opsEligible}</span>
        </div>
        <div className="kpi rise" style={{ animationDelay: ".24s" }}>
          <small>NEEDS ACTION</small><b style={{ color: unread.length ? "#ff4d4d" : "#22e07a" }}>{unread.length}</b>
          <span className="absolute right-3 top-3 text-[11px] text-dim">UNREAD ALERTS</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-[1.4fr_1fr] gap-3">
        <section className="card rise" style={{ animationDelay: ".3s" }} aria-label="Next op">
          <h3>NEXT OP <button type="button" onClick={() => p.onPage("panel-events")}>EVENTS ▸</button></h3>
          {op ? (
            <div className="flex items-center gap-4 p-4">
              <div className="font-head text-[34px] font-bold tracking-[2px] text-amber">{countdown(Date.parse(op.startAtISO) - now)}
                <small className="block font-mono text-[11px] font-normal tracking-[2px] text-dim">{op.title.toUpperCase()} · {ukTime(op.startAtISO, { weekday: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()} UK</small></div>
              <div className="ml-auto text-right text-[12px] leading-7 text-dim">{op.signedUp} SIGNED UP<br />YOU: {op.mine ? <span className="text-ok">✓ {op.mine.toUpperCase()}</span> : <span>NOT SIGNED UP</span>}</div>
            </div>
          ) : <p className="p-4 text-[12px] text-dim">NO OPS SCHEDULED.</p>}
          {ops.slice(1).map((o) => (
            <div key={o.id} className="flex border-t border-cyan/10 px-4 py-2 text-[12px]"><span className="text-white">{o.title}</span>
              <span className="ml-auto text-dim">{ukTime(o.startAtISO, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {o.mine ? "✓" : "—"}</span></div>
          ))}
        </section>
        <section className="card rise" style={{ animationDelay: ".36s" }} aria-label="My status">
          <h3>◐ MY STATUS</h3>
          <div className="grid grid-cols-3 gap-2 p-4">
            {(["online", "dnd", "invisible"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={st === k} onClick={() => p.onStatus(k)}
                className="border px-2 py-3 text-[11.5px] tracking-[1.5px]"
                style={{ borderColor: st === k ? STATE[k].color : "rgba(0,217,255,.18)", color: st === k ? STATE[k].color : "#c9d3de", background: st === k ? "rgba(255,255,255,.04)" : "transparent" }}>
                ● {STATE[k].label}
              </button>
            ))}
          </div>
          <p className="px-4 pb-4 text-[11.5px] leading-relaxed text-dim">DND: no pop-ups. Invisible: you look offline. Same status as the website and Cortana.</p>
        </section>
      </div>

      <section className="card rise" style={{ animationDelay: ".42s" }} aria-label="Alerts">
        <h3>ALERTS
          <span className="ml-auto flex gap-1.5">{(["all", "unread"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`border px-2.5 py-0.5 text-[10.5px] ${filter === f ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{f === "all" ? "ALL" : `UNREAD ${unread.length}`}</button>
          ))}</span>
        </h3>
        <ul className="m-0 list-none p-0">
          {list.length ? list.map((a) => {
            const [ic, c] = ALERT_ICON[a.type] ?? ["◆", "#7d8a99"];
            return (
              <li key={a.id} className={`flex items-center gap-3 border-b border-cyan/10 px-4 py-2.5 text-[13px] ${a.read ? "" : "bg-cyan/5"}`}>
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center border" style={{ color: c, borderColor: c }}>{ic}</span>
                <span className="min-w-0"><b className={`block font-normal ${a.read ? "text-[#c9d3de]" : "text-white"}`}>{a.title}</b><small className="block truncate text-[11px] text-dimmer">{a.body}</small></span>
              </li>
            );
          }) : <li className="px-4 py-6 text-center text-[12px] tracking-[2px] text-dimmer">NOTHING HERE</li>}
        </ul>
      </section>
    </main>
  );
}
