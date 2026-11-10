import type { ServiceRecord } from "@/lib/terminal/data";
import { Empty, Kpi, PanelTitle, RoleBadge, StatusBadge, Tile, fmtDate } from "../ui";

const TONE: Record<string, string> = { promo: "#00D9FF", platoon: "#a78bfa", award: "#f59e0b", warn: "#ef4444" };

export default function ServiceRecordView({ r, back }: { r: ServiceRecord; back?: { href: string; label: string } }) {
  const rows: [string, string][] = [
    ["FULL NAME", [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ")],
    ["CALLSIGN", r.callsign || "—"],
    ["RANK", r.rank || "—"],
    ["PLATOON", r.platoon || "—"],
    ["JOINED PLATOON", r.joinedPlatoon || "—"],
    ["ENLISTED", fmtDate(r.joinedAt)],
    ["APPROVED", fmtDate(r.approvedAt)],
    ["RECRUITED VIA", r.recruitSource || "—"],
    ["DISCORD", r.hasDiscord ? r.discordUsername || "LINKED" : "NOT LINKED"],
  ];
  return (
    <>
      {back && (
        <a href={back.href} className="mb-3 inline-block text-[11px] tracking-[2px] text-[#8a98a3] no-underline hover:text-[#00D9FF]">
          ◂ {back.label}
        </a>
      )}
      <PanelTitle sub="Service record">{r.name}</PanelTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RoleBadge role={r.role} label={r.roleLabel} />
        <StatusBadge status={r.status} />
      </div>
      <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        <Kpi label="ATTENDANCE" value={`${r.attendance.percent}%`} tone={r.attendance.percent >= 60 ? "green" : "amber"} hint={`${r.attendance.opsAttended}/${r.attendance.opsEligible} ops`} />
        <Kpi label="PROMOTIONS" value={r.counts.promotions} />
        <Kpi label="AWARDS" value={r.counts.commendations + r.counts.ribbons} tone="amber" />
        <Kpi label="WARNINGS" value={r.counts.warnings} tone={r.counts.warnings ? "red" : "cyan"} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 max-[1000px]:grid-cols-1">
        <Tile title="DETAILS">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[9px] tracking-[2px] text-[rgba(0,217,255,0.85)] leading-5">{k}</dt>
                <dd className="text-[#e0e0e0]">{v}</dd>
              </div>
            ))}
          </dl>
        </Tile>
        <Tile title="SERVICE HISTORY">
          {r.history.length ? (
            <ol className="relative ml-2 list-none border-l border-[rgba(0,217,255,0.25)]">
              {r.history.map((h, i) => (
                <li key={i} className="relative mb-3 pl-4">
                  <span aria-hidden="true" className="absolute -left-[5px] top-1.5 h-2 w-2 rotate-45" style={{ background: TONE[h.tone] }} />
                  <div className="text-[10px] tracking-[1px] text-[#6B7B87]">{h.date || "—"}</div>
                  <div className="text-[12px]" style={{ color: TONE[h.tone] }}>
                    {h.title}
                  </div>
                  {h.note && <div className="text-[11px] text-[#bbb]">{h.note}</div>}
                  {h.by && <div className="text-[10px] text-[#6B7B87]">by {h.by}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <Empty>NO HISTORY YET</Empty>
          )}
        </Tile>
      </div>
    </>
  );
}
