import { getUnitCards, type Slot } from "@/lib/units/cards";

/**
 * Public unit cards — design B (approved mock 2026-11-11), used on the 5 career pages.
 * Server-rendered from Terminal → Order of Battle (settings/unit_cards) + live member rank/name.
 * Platoon header with how full it is · leader cards with hex rank badges · squad cards with dots and rank tags.
 */
const dotCls = (s: Slot) => (s.status === "filled" ? "f" : s.status === "open" ? "o" : "c");

function Leader({ s }: { s: Slot }) {
  const c = dotCls(s);
  return (
    <div className="ucb-ldr">
      <div className={`ucb-hex ${c}`} aria-hidden="true">{c === "f" ? s.rank || "★" : c === "o" ? "+" : "—"}</div>
      <div>
        <div className="ucb-r">{s.slot.toUpperCase()}</div>
        <div className={`ucb-n ${c}`}>{c === "f" ? `${s.rank ? s.rank + " " : ""}${s.name}` : c === "o" ? "Open" : "Closed"}</div>
      </div>
    </div>
  );
}

function Row({ s, lead }: { s: Slot; lead?: boolean }) {
  const c = dotCls(s);
  return (
    <div className={`ucb-sl ${c}${lead ? " sql" : ""}`}>
      <span className="ucb-dot" aria-hidden="true" />
      <span className="ucb-who">{c === "f" ? s.name : c === "o" ? "Open" : "Closed"}</span>
      {c === "f" ? <span className="ucb-rk">{s.rank || "—"}{lead ? " · SQL" : ""}</span> : <span className="ucb-role">{lead ? "SQUAD LEAD" : s.slot.toUpperCase()}</span>}
    </div>
  );
}

export default async function UnitCards({ id }: { id: string }) {
  const data = await getUnitCards(id).catch(() => null);
  if (!data) return null;
  const { cfg, sections } = data;
  const vis = sections.filter((s) => !s.hidden);
  return (
    <div className="ucb" style={{ "--ac": cfg.accent } as React.CSSProperties}>
      <div className="ucb-legend" aria-hidden="true"><span><i className="f" />FILLED</span><span><i className="o" />OPEN</span><span><i className="c" />CLOSED</span></div>
      {vis.map((sec) => {
        const closed = sec.total === 0;
        return (
          <section className="ucb-pl" key={sec.title} aria-label={sec.title}>
            <div className="ucb-plh">
              <b>{cfg.bcStyle ? "COMMAND STAFF" : sec.title.toUpperCase()}</b>
              <span className="ucb-fill">{closed ? "NOT RECRUITING" : `${sec.filled} / ${sec.total} FILLED`}<i><u style={{ width: `${sec.total ? (sec.filled / sec.total) * 100 : 0}%` }} /></i></span>
            </div>
            {sec.staff.length > 0 && <div className="ucb-lead">{sec.staff.map((s, i) => <Leader key={i} s={s} />)}</div>}
            {sec.squads.length > 0 && (
              <div className="ucb-sqs">
                {sec.squads.map((q) => {
                  const f = q.slots.filter((x) => x.status === "filled").length, o = q.slots.filter((x) => x.status === "open").length;
                  return (
                    <div className="ucb-sq" key={q.name}>
                      <div className="ucb-sqh"><b>{q.name.toUpperCase()}</b><small>{q.slots.every((x) => x.status === "closed") ? "CLOSED" : `${f}/${q.slots.length} · ${o} OPEN`}</small></div>
                      {q.slots.map((s, i) => <Row key={i} s={s} lead={i === 0} />)}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {vis.some((s) => s.filled < s.total) && (
        <div className="ucb-join">
          <span>Want an <b>OPEN</b> slot? Ask your Platoon Sergeant, or open a Recruitment ticket in Discord.</span>
          <a href="/enlist">JOIN THE 505TH →</a>
        </div>
      )}
    </div>
  );
}
