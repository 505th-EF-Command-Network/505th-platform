/** Shared Command Terminal building blocks (corner-bracket tiles, KPIs, badges). */
import type { ReactNode } from "react";

export function PanelTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4 border-b border-[rgba(0,217,255,0.4)] pb-2">
      <h1 className="font-[Rajdhani,sans-serif] text-xl font-bold tracking-[3px] text-[#00D9FF] [text-shadow:0_0_10px_rgba(0,217,255,0.5)]">{children}</h1>
      {sub && <p className="mt-1 text-[11px] tracking-[1px] text-[#8a98a3]">{sub}</p>}
    </div>
  );
}

/** Tile with corner brackets — the refined Terminal look. */
export function Tile({ title, children, action, className = "" }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`relative border border-[rgba(0,217,255,0.3)] bg-[rgba(8,10,14,0.8)] p-4 ${className}`}>
      <i aria-hidden="true" className="absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2 border-[#00D9FF]" />
      <i aria-hidden="true" className="absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2 border-[#00D9FF]" />
      <i aria-hidden="true" className="absolute -bottom-px -left-px h-2.5 w-2.5 border-b-2 border-l-2 border-[#00D9FF]" />
      <i aria-hidden="true" className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-[#00D9FF]" />
      {title && (
        <div className="mb-3 flex items-center border-b border-[rgba(0,217,255,0.3)] pb-1.5">
          <h2 className="font-[Rajdhani,sans-serif] text-[13px] font-bold tracking-[3px] text-[#00D9FF]">{title}</h2>
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone = "cyan", hint }: { label: string; value: ReactNode; tone?: "cyan" | "amber" | "red" | "green"; hint?: string }) {
  const c = { cyan: "#00D9FF", amber: "#f59e0b", red: "#ef4444", green: "#4ee68a" }[tone];
  return (
    <Tile className="text-center">
      <div className="font-[Rajdhani,sans-serif] text-[34px] font-bold leading-none" style={{ color: c, textShadow: `0 0 15px ${c}66` }}>
        {value}
      </div>
      <div className="mt-1.5 text-[9px] tracking-[3px] text-[#bbb]">{label}</div>
      {hint && <div className="mt-1 text-[9px] tracking-[1px] text-[#6B7B87]">{hint}</div>}
    </Tile>
  );
}

const ROLE_COLOUR: Record<string, string> = {
  commander: "#f59e0b",
  developer: "#a78bfa",
  staff_nco: "#2DD4BF",
  nco: "#34d399",
  marine: "#94a3b8",
  enlistee: "#64748b",
  retired_veteran: "#888",
};

export function RoleBadge({ role, label }: { role: string; label: string }) {
  const c = ROLE_COLOUR[role] ?? "#999";
  return (
    <span className="inline-block whitespace-nowrap border px-2 py-0.5 font-[Rajdhani,sans-serif] text-xs font-bold tracking-[2px]" style={{ color: c, borderColor: c }}>
      {label.toUpperCase()}
    </span>
  );
}

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE: "#00FF41",
  PENDING: "#f59e0b",
  LOA: "#60a5fa",
  RESERVE: "#94a3b8",
  SUSPENDED: "#ef4444",
  LEFT_UNIT: "#6B7B87",
  GRANTED: "#4ee68a",
  DENIED: "#ef4444",
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOUR[status] ?? "#999";
  return (
    <span className="inline-block whitespace-nowrap border px-1.5 text-[9px] tracking-[2px]" style={{ color: c, borderColor: c }}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[11px] tracking-[3px] text-[#999]">{children}</p>;
}

export const fmtDate = (s: string | null | undefined) => (s ? s.slice(0, 10) : "—");
export const fmtTime = (s: string | null | undefined) => (s ? s.replace("T", " ").slice(0, 16) : "—");

export const OP_TYPE: Record<string, string> = { main_op: "MAIN OP", patrol: "PATROL", training: "TRAINING", fun_op: "FUN OP", other: "OTHER" };
