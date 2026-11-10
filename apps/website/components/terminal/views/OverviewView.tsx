import type { Overview } from "@/lib/terminal/data";
import { Empty, Kpi, OP_TYPE, PanelTitle, StatusBadge, Tile, fmtTime } from "../ui";

export default function OverviewView({ data, name }: { data: Overview; name: string }) {
  const k = data.kpi;
  return (
    <>
      <PanelTitle sub={`Welcome back, ${name}.`}>COMMAND OVERVIEW</PanelTitle>
      <div className="mb-6 grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1">
        <Kpi label="ACTIVE PERSONNEL" value={k.active} />
        <Kpi label="PENDING APPROVALS" value={k.pending} tone={k.pending ? "amber" : "cyan"} />
        <Kpi label="OPS THIS MONTH" value={k.opsThisMonth} />
        <Kpi label="AVG ATTENDANCE" value={`${k.avgAttendance}%`} tone={k.avgAttendance >= 60 ? "green" : "amber"} hint="active members" />
        <Kpi label="DENIED SIGN-INS (7D)" value={k.deniedWeek} tone={k.deniedWeek ? "red" : "cyan"} />
        <Kpi label="AFTER-ACTION REPORTS" value={k.aars} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
        <Tile title="PENDING APPROVALS" action={<a href="/terminal/personnel/pending" className="text-[10px] tracking-[2px] text-[#00D9FF]">VIEW ALL ▸</a>}>
          {data.pendingMembers.length ? (
            data.pendingMembers.map((m) => (
              <a key={m.id} href={`/terminal/personnel/${m.id}`} className="mb-1.5 flex items-center gap-3 border border-l-[3px] border-[rgba(0,217,255,0.1)] border-l-[#f59e0b] bg-black/20 px-3 py-2.5 text-xs no-underline hover:bg-[rgba(0,217,255,0.04)]">
                <span className="text-[#e0e0e0]">{m.name}</span>
                <span className="ml-auto text-[10px] text-[#8a98a3]">{m.platoon || "—"}</span>
              </a>
            ))
          ) : (
            <Empty>NO PENDING APPROVALS</Empty>
          )}
        </Tile>

        <Tile title="RECENT OPERATIONS" action={<a href="/terminal/operations/attendance" className="text-[10px] tracking-[2px] text-[#00D9FF]">TRACKER ▸</a>}>
          {data.recentOps.length ? (
            data.recentOps.map((o) => (
              <div key={o.id} className="mb-1.5 flex items-center gap-3 border border-[rgba(0,217,255,0.1)] bg-black/20 px-3 py-2.5 text-xs">
                <span className="w-[78px] shrink-0 text-[#8a98a3]">{o.date}</span>
                <span className="min-w-0 flex-1 truncate text-[#e0e0e0]">{o.title || OP_TYPE[o.type]}</span>
                <span className="text-[9px] tracking-[2px] text-[#00D9FF]">{OP_TYPE[o.type] ?? o.type}</span>
                <span className="w-10 text-right text-[#4ee68a]">{o.attendees}</span>
              </div>
            ))
          ) : (
            <Empty>NO OPERATIONS LOGGED</Empty>
          )}
        </Tile>

        <Tile title="RECENT ACTIVITY" action={<a href="/terminal/security/audit" className="text-[10px] tracking-[2px] text-[#00D9FF]">AUDIT LOG ▸</a>}>
          {data.activity.length ? (
            data.activity.map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-white/5 py-2 text-[11px]">
                <span className="w-[110px] shrink-0 text-[#6B7B87]">{fmtTime(a.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-[#e0e0e0]">{a.actor || "SYSTEM"}</span> <span className="text-[#00D9FF]">{a.action}</span>
                  {a.details && <span className="block truncate text-[#8a98a3]">{a.details}</span>}
                </span>
              </div>
            ))
          ) : (
            <Empty>NO ACTIVITY</Empty>
          )}
        </Tile>

        <Tile title="SECURITY ALERTS" action={<a href="/terminal/security/access" className="text-[10px] tracking-[2px] text-[#00D9FF]">ALL ATTEMPTS ▸</a>}>
          {data.alerts.length ? (
            data.alerts.map((a) => (
              <div key={a.id} className="mb-1.5 flex items-center gap-3 border border-l-[3px] border-[rgba(0,217,255,0.1)] border-l-[#ef4444] bg-black/20 px-3 py-2.5 text-[11px]">
                <span className="w-[110px] shrink-0 text-[#6B7B87]">{fmtTime(a.at)}</span>
                <span className="min-w-0 flex-1 truncate text-[#e0e0e0]">{a.who}</span>
                <StatusBadge status={a.reason} />
              </div>
            ))
          ) : (
            <Empty>NO DENIED SIGN-INS</Empty>
          )}
        </Tile>
      </div>
    </>
  );
}
