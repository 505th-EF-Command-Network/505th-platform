"use client";
import { useMemo, useState } from "react";
import type { RosterRow } from "@/lib/terminal/data";
import { Empty, PanelTitle, RoleBadge, StatusBadge, Tile } from "../ui";

const STATUSES = ["ALL", "ACTIVE", "PENDING", "LOA", "RESERVE", "SUSPENDED", "LEFT_UNIT"];

export default function RosterView({ rows, title = "ROSTER & SERVICE RECORDS", initialStatus = "ACTIVE" }: { rows: RosterRow[]; title?: string; initialStatus?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (status === "ALL" || r.status === status) && (!s || `${r.name} ${r.platoon} ${r.roleLabel}`.toLowerCase().includes(s)));
  }, [rows, q, status]);
  const field = "min-h-10 border border-[rgba(0,217,255,0.35)] bg-black/60 px-3 text-[12px] text-[#e0e0e0] outline-none focus:border-[#00D9FF]";

  return (
    <>
      <PanelTitle sub={`${shown.length} of ${rows.length} records`}>{title}</PanelTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[9px] tracking-[2px] text-[#ccc]">
          SEARCH
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, platoon or role" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[9px] tracking-[2px] text-[#ccc]">
          STATUS
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} cursor-pointer`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Tile>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[rgba(0,217,255,0.35)] text-[9px] tracking-[2px] text-[rgba(0,217,255,0.85)]">
                <th className="px-3 py-2 font-normal">OPERATOR</th>
                <th className="px-3 py-2 font-normal">ROLE</th>
                <th className="px-3 py-2 font-normal">PLATOON</th>
                <th className="px-3 py-2 font-normal">ATTENDANCE</th>
                <th className="px-3 py-2 font-normal">STATUS</th>
                <th className="px-3 py-2 font-normal">DISCORD</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-[rgba(0,217,255,0.03)]">
                  <td className="px-3 py-2.5">
                    <a href={`/terminal/personnel/${r.id}`} className="text-[#e0e0e0] no-underline hover:text-[#00D9FF]">
                      {r.name}
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <RoleBadge role={r.role} label={r.roleLabel} />
                  </td>
                  <td className="px-3 py-2.5 text-[#bbb]">{r.platoon || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 bg-white/10">
                        <span className="block h-full" style={{ width: `${Math.min(100, r.attendance)}%`, background: r.attendance >= 60 ? "#4ee68a" : "#f59e0b" }} />
                      </span>
                      <span className="text-[#bbb]">{r.attendance}%</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">{r.hasDiscord ? <span className="text-[#4ee68a]">LINKED</span> : <span className="text-[#f59e0b]">NOT LINKED</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <Empty>NO MATCHING RECORDS</Empty>}
        </div>
      </Tile>
    </>
  );
}
