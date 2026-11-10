import type { AarRow, AttemptRow, AuditRow, OpRow } from "@/lib/terminal/data";
import { Empty, OP_TYPE, PanelTitle, StatusBadge, Tile, fmtDate, fmtTime } from "../ui";

const th = "px-3 py-2 font-normal";
const td = "px-3 py-2.5";
const head = "border-b border-[rgba(0,217,255,0.35)] text-[9px] tracking-[2px] text-[rgba(0,217,255,0.85)]";
const row = "border-b border-white/5 hover:bg-[rgba(0,217,255,0.03)]";

function Table({ cols, children, empty, min = 640 }: { cols: string[]; children: React.ReactNode; empty: boolean; min?: number }) {
  return (
    <Tile>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12px]" style={{ minWidth: min }}>
          <thead>
            <tr className={head}>
              {cols.map((c) => (
                <th key={c} className={th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
        {empty && <Empty>NO RECORDS</Empty>}
      </div>
    </Tile>
  );
}

export function AttendanceView({ ops }: { ops: OpRow[] }) {
  return (
    <>
      <PanelTitle sub={`${ops.length} operations logged`}>ATTENDANCE TRACKER</PanelTitle>
      <Table cols={["DATE", "OPERATION", "TYPE", "ATTENDED", "EXCUSED", "STATE"]} empty={!ops.length}>
        {ops.map((o) => (
          <tr key={o.id} className={row}>
            <td className={`${td} text-[#bbb]`}>{o.date}</td>
            <td className={`${td} text-[#e0e0e0]`}>{o.title || "—"}</td>
            <td className={`${td} text-[10px] tracking-[2px] text-[#00D9FF]`}>{OP_TYPE[o.type] ?? o.type}</td>
            <td className={`${td} text-[#4ee68a]`}>{o.attendees}</td>
            <td className={`${td} text-[#f59e0b]`}>{o.excused}</td>
            <td className={`${td} text-[10px] tracking-[2px] ${o.locked ? "text-[#6B7B87]" : "text-[#4ee68a]"}`}>{o.locked ? "LOCKED" : "OPEN"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

export function AarsView({ aars }: { aars: AarRow[] }) {
  return (
    <>
      <PanelTitle sub={`${aars.length} reports on file`}>AFTER-ACTION REPORTS</PanelTitle>
      <Table cols={["DATE", "OPERATION", "TYPE", "RESULT", "CASUALTIES", "FILED BY"]} empty={!aars.length}>
        {aars.map((a) => (
          <tr key={a.id} className={row}>
            <td className={`${td} text-[#bbb]`}>{fmtDate(a.date)}</td>
            <td className={`${td} text-[#e0e0e0]`}>{a.title}</td>
            <td className={`${td} text-[#bbb]`}>{a.operationType || "—"}</td>
            <td className={`${td} text-[#bbb]`}>{a.result || "—"}</td>
            <td className={`${td} text-[#bbb]`}>{a.casualties ?? "—"}</td>
            <td className={`${td} text-[#bbb]`}>{a.author || "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

const REASON: Record<string, string> = {
  NONE: "—",
  NOT_IN_DISCORD: "Not in Discord",
  NO_RECORD: "No roster record",
  PENDING_APPROVAL: "Awaiting approval",
  LOW_CLEARANCE: "Low clearance",
  INACTIVE: "Left / suspended",
};

export function AccessView({ attempts }: { attempts: AttemptRow[] }) {
  return (
    <>
      <PanelTitle sub="Every Command Terminal sign-in check (latest 200)">ACCESS ATTEMPTS</PanelTitle>
      <Table cols={["TIME (UTC)", "DISCORD USER", "RESULT", "REASON"]} empty={!attempts.length} min={560}>
        {attempts.map((a) => (
          <tr key={a.id} className={row}>
            <td className={`${td} text-[#bbb]`}>{fmtTime(a.at)}</td>
            <td className={`${td} text-[#e0e0e0]`}>{a.who}</td>
            <td className={td}>
              <StatusBadge status={a.result} />
            </td>
            <td className={`${td} text-[#bbb]`}>{REASON[a.reason] ?? a.reason}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

export function AuditView({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      <PanelTitle sub="Latest 200 entries, newest first">AUDIT LOG</PanelTitle>
      <Table cols={["TIME (UTC)", "WHO", "SECTION", "ACTION", "DETAILS"]} empty={!rows.length} min={760}>
        {rows.map((a) => (
          <tr key={a.id} className={row}>
            <td className={`${td} whitespace-nowrap text-[#bbb]`}>{fmtTime(a.at)}</td>
            <td className={`${td} text-[#e0e0e0]`}>{a.actor || "SYSTEM"}</td>
            <td className={`${td} text-[10px] tracking-[1px] text-[#00D9FF]`}>{a.section.toUpperCase()}</td>
            <td className={`${td} text-[#e0e0e0]`}>{a.action}</td>
            <td className={`${td} max-w-[420px] text-[#8a98a3]`}>{a.details}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
