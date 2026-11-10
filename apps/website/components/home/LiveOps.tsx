"use client";

import { useEffect, useState } from "react";

/**
 * Homepage banner (approved mock 2026-11-10): ● LIVE NOW + the next 3 operations.
 * Data: /api/public/ops (public details only). Refreshes every minute; countdowns tick every second.
 * Hidden when nothing is live or coming up in the next 14 days.
 */
type Op = { title: string; type: string; typeKey: string; startAtISO: string; endAtISO: string };
const COLOUR: Record<string, string> = { main_op: "#ff3b3b", patrol: "#22e07a", training: "#00D9FF", fun_op: "#a78bfa", other: "#9fb3c4" };
const DISCORD = "https://discord.gg/uh8ax8MhNb";

const ukDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "2-digit", month: "short" }).toUpperCase().replace(",", "");
const ukTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

function Countdown({ to, now, colour }: { to: string; now: number; colour: string }) {
  const left = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const parts: [number, string][] = [[Math.floor(left / 86400), "D"], [Math.floor((left % 86400) / 3600), "H"], [Math.floor((left % 3600) / 60), "M"], [left % 60, "S"]];
  return (
    <div className="lo-cd" style={{ ["--c" as string]: colour }} aria-label={`Starts in ${parts.map(([v, k]) => v + k).join(" ")}`}>
      {parts.map(([v, k]) => (
        <div key={k} aria-hidden="true">{String(v).padStart(2, "0")}<small>{k}</small></div>
      ))}
    </div>
  );
}

export default function LiveOps() {
  const [data, setData] = useState<{ live: Op | null; next: Op[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    const load = () => fetch("/api/public/ops").then((r) => r.json()).then((d) => !stop && setData(d)).catch(() => {});
    load();
    const a = setInterval(load, 60_000);
    const b = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop = true; clearInterval(a); clearInterval(b); };
  }, []);

  if (!data || (!data.live && !data.next.length)) return null;
  const l = data.live;
  const pct = l ? Math.min(100, Math.max(0, ((now - Date.parse(l.startAtISO)) / (Date.parse(l.endAtISO) - Date.parse(l.startAtISO))) * 100)) : 0;

  return (
    <section className="lo" aria-label="Operations">
      {l && (
        <div className="lo-live" role="status">
          <span className="lo-pill"><i className="lo-dot" aria-hidden="true" />LIVE NOW</span>
          <span className="lo-ty" style={{ ["--t" as string]: COLOUR[l.typeKey] ?? COLOUR.other }}>{l.type}</span>
          <div className="lo-t">
            <b>{l.title.toUpperCase()}</b>
            <small>STARTED {ukTime(l.startAtISO)} UK · ENDS {ukTime(l.endAtISO)}</small>
          </div>
          <div className="lo-prog" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          <a className="lo-btn solid" href={DISCORD} target="_blank" rel="noopener noreferrer">
            <img src="/images/discord-mark-white.png" alt="" className="lo-dlogo" />JOIN US ON DISCORD
          </a>
        </div>
      )}
      {data.next.length > 0 && (
        <>
          <div className="lo-nh">◷ NEXT OPERATIONS</div>
          <div className="lo-next" style={{ gridTemplateColumns: `repeat(${Math.min(data.next.length, 3)}, 1fr)` }}>
            {data.next.map((o) => {
              const c = COLOUR[o.typeKey] ?? COLOUR.other;
              return (
                <div key={o.startAtISO + o.title} className="lo-nc" style={{ ["--t" as string]: c }}>
                  <span className="lo-ty">{o.type}</span>
                  <b>{o.title.toUpperCase()}</b>
                  <small>{ukDay(o.startAtISO)} · {ukTime(o.startAtISO)} UK</small>
                  <Countdown to={o.startAtISO} now={now} colour={c} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
