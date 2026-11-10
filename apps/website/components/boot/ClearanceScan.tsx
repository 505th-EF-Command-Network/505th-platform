"use client";

/**
 * Idea D "Clearance Scan" — the boot screen before the Command Terminal.
 * One layout and timing for all three outcomes (decided 2026-11-09):
 *   GRANTED  green  → SYSTEM MESSAGE → split doors → `dest` (Terminal for staff, profile for members)
 *   PENDING  amber  → CLEARANCE PENDING + progress steps + 30s auto re-check
 *   DENIED   red    → SECURITY ALERT + reason (attempt is logged for staff)
 */
import { useEffect, useRef, useState } from "react";
import { DISCORD_INVITE } from "@/components/nav-data";

export type ScanProps = {
  result: "GRANTED" | "PENDING" | "DENIED";
  reason: "NONE" | "NOT_IN_DISCORD" | "NO_RECORD" | "PENDING_APPROVAL" | "LOW_CLEARANCE" | "INACTIVE";
  /** [Discord server, roster record, clearance] — true ok, false failed, null not reached */
  checks: [boolean, boolean | null, boolean | null];
  name: string;
  operator: string;
  tag: string;
  avatar: string | null;
  discordId: string;
  incident: string | null;
  time: string;
  /** Where GRANTED goes: "/terminal" (Recruiter and above) or "/profile" (members). */
  dest: "/terminal" | "/profile";
};

const C = { ok: "#4ee68a", amber: "#FFD700", red: "#ff6b6b", cyan: "#00D9FF", dim: "#3C4A54" };

const REASONS: Record<ScanProps["reason"], { code: string; text: string; actions: { label: string; href: string; kind: "pri" | "sec" | "ghost"; ext?: boolean }[] }> = {
  NONE: { code: "STATUS 200 // WELCOME BACK", text: "", actions: [] },
  PENDING_APPROVAL: {
    code: "STATUS 202 // ENLISTMENT RECEIVED",
    text: "Your enlistment has been received and is waiting for staff approval. Cortana will message you on Discord when you're approved, so there's no need to keep checking.",
    actions: [{ label: "CHECK AGAIN NOW", href: "/boot", kind: "sec" }, { label: "RETURN TO HOME", href: "/home", kind: "ghost" }],
  },
  NOT_IN_DISCORD: {
    code: "ERR-401 // NOT IN 505TH DISCORD",
    text: "This Discord account is not a member of the 505th Expeditionary Force server.",
    actions: [{ label: "JOIN OUR DISCORD", href: DISCORD_INVITE, kind: "pri", ext: true }, { label: "RETURN TO LOGIN", href: "/login", kind: "ghost" }],
  },
  NO_RECORD: {
    code: "ERR-403 // NO SERVICE RECORD",
    text: "You're in our Discord, but you're not on the unit roster yet. Finish recruitment in Discord, then try again.",
    actions: [{ label: "HOW TO ENLIST", href: DISCORD_INVITE, kind: "pri", ext: true }, { label: "RETURN TO LOGIN", href: "/login", kind: "ghost" }],
  },
  LOW_CLEARANCE: {
    code: "ERR-403 // INSUFFICIENT CLEARANCE",
    text: "The Command Terminal is for Recruiters and above. You can still use your member profile.",
    actions: [{ label: "MY PROFILE", href: "/profile", kind: "pri" }, { label: "RETURN TO HOME", href: "/home", kind: "ghost" }],
  },
  INACTIVE: {
    code: "ERR-423 // RECORD INACTIVE",
    text: "This service record is marked LEFT UNIT or SUSPENDED. Contact a staff member in Discord if you think this is wrong.",
    actions: [{ label: "CONTACT STAFF", href: DISCORD_INVITE, kind: "sec", ext: true }, { label: "RETURN TO HOME", href: "/home", kind: "ghost" }],
  },
};

const BTN = {
  pri: "border-[#6B8235] bg-[#4A5D23] text-[#E8EEF2] hover:shadow-[0_0_16px_rgba(107,130,53,0.5)]",
  sec: "border-[rgba(0,217,255,0.5)] text-[#00D9FF] hover:bg-[rgba(0,217,255,0.1)]",
  ghost: "border-[#2a343b] text-[#A8B5BF] hover:border-[#6B7B87] hover:text-[#E8EEF2]",
};

const LABELS: [string, string, string][] = [
  ["DISCORD IDENTITY", "DISCORD IDENTITY VERIFIED", "NOT IN 505TH DISCORD"],
  ["ROSTER RECORD", "ROSTER RECORD FOUND", "NO ROSTER RECORD FOUND"],
  ["COMMAND PERMISSIONS", "COMMAND PERMISSIONS LOADED", "INSUFFICIENT CLEARANCE"],
];

export default function ClearanceScan(p: ScanProps) {
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const tone = p.result === "GRANTED" ? C.ok : p.result === "PENDING" ? C.amber : C.red;
  const glow = p.result === "GRANTED" ? "rgba(78,230,138,.35)" : p.result === "PENDING" ? "rgba(255,215,0,.35)" : "rgba(255,107,107,.35)";
  const tint = p.result === "GRANTED" ? "rgba(78,230,138,.07)" : p.result === "PENDING" ? "rgba(255,215,0,.06)" : "rgba(255,107,107,.07)";
  // index of the check that decides the outcome
  const decisive = p.result === "PENDING" ? 1 : p.checks.findIndex((c) => c === false);
  const lastCheck = decisive < 0 ? 2 : decisive;
  const decidedAt = lastCheck + 2; // step at which the outcome shows
  const winAt = decidedAt + 1;
  const decided = step >= decidedAt;
  const win = step >= winAt;
  const split = p.result === "GRANTED" && step >= winAt + 1;

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStep(0);
    [500, 1100, 1700, 2300, 2900].forEach((ms, i) => later(ms, () => setStep(i + 1)));
    if (p.result === "GRANTED") {
      later(2900 + 2700, () => setStep(99));
      later(2900 + 3500, () => window.location.assign(p.dest));
    }
    if (p.result === "PENDING") later(2900 + 30000, () => window.location.reload());
  };
  useEffect(() => {
    run();
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (win) document.getElementById("scan-first-action")?.focus();
  }, [win]);

  const rows = LABELS.map(([pending, ok, bad], i) => {
    if (i > lastCheck) return { icon: "·", label: pending, col: C.dim, spin: false, res: decided ? (p.result === "PENDING" ? "LOCKED" : "SKIPPED") : "" };
    if (step >= i + 2) {
      if (p.result === "PENDING" && i === 1) return { icon: "◌", label: "ENLISTMENT AWAITING STAFF REVIEW", col: C.amber, spin: true, res: "PENDING" };
      if (i === decisive) return { icon: "✕", label: p.reason === "INACTIVE" && i === 1 ? "RECORD INACTIVE" : bad, col: C.red, spin: false, res: "FAILED" };
      return { icon: "✓", label: ok, col: C.ok, spin: false, res: "OK" };
    }
    if (step >= i + 1) return { icon: "◌", label: `${pending}...`, col: C.cyan, spin: true, res: "SCANNING" };
    return { icon: "·", label: pending, col: C.dim, spin: false, res: "" };
  });

  const R = REASONS[p.reason];
  const big = p.result === "GRANTED" ? "ACCESS GRANTED" : p.result === "PENDING" ? "ACCESS PENDING" : "ACCESS DENIED";
  const title = p.result === "GRANTED" ? "SYSTEM MESSAGE" : p.result === "PENDING" ? "CLEARANCE PENDING" : "SECURITY ALERT";
  const cmdResult =
    p.result === "GRANTED" ? "✓ CLEARANCE CONFIRMED  [STATUS 200]" : p.result === "PENDING" ? "◌ APPLICATION IN REVIEW  [STATUS 202]" : `✕ CLEARANCE CHECK FAILED  [${R.code.split(" //")[0]}]`;
  const reasonText = p.result === "GRANTED" ? `Welcome back, ${p.name}. Opening ${p.dest === "/terminal" ? "the Command Terminal" : "your profile"}...` : R.text;
  const statusText = decided ? big : "VERIFYING";

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-[#0A0E12] to-[#050709]">
      {/* split doors (granted only) */}
      {split && (
        <div className="absolute inset-0 z-30 flex" aria-hidden="true">
          <div className="flex-1 border-r border-[rgba(0,217,255,0.35)] bg-linear-to-b from-[#0A0E12] to-[#050709] animate-[bt-split-l_0.8s_cubic-bezier(.7,0,.3,1)_forwards]" />
          <div className="flex-1 border-l border-[rgba(0,217,255,0.35)] bg-linear-to-b from-[#0A0E12] to-[#050709] animate-[bt-split-r_0.8s_cubic-bezier(.7,0,.3,1)_forwards]" />
        </div>
      )}

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-shadow duration-500 ${decided && p.result !== "GRANTED" ? "animate-[bt-edge_2s_ease-in-out_infinite]" : ""}`}
        style={{ boxShadow: decided ? `inset 0 0 180px 10px ${p.result === "DENIED" ? "rgba(255,59,59,.22)" : p.result === "PENDING" ? "rgba(255,215,0,.12)" : "rgba(78,230,138,.10)"}` : "none" }}
      />

      <div className="relative z-10 flex justify-between border-b border-[rgba(0,217,255,0.12)] px-[22px] py-3.5 font-mono text-xs tracking-[2px] text-[#6B7B87] max-[600px]:text-[0.6rem]">
        <span>
          505TH // <span className="text-[#00D9FF]">COMMAND TERMINAL</span>
        </span>
        <span>
          STATUS: <span style={{ color: decided ? tone : C.cyan }}>{statusText}</span>
        </span>
      </div>

      <img src="/images/logo.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />

      {/* logo row */}
      <div className={`relative z-10 mt-6 flex items-center justify-center gap-[22px] px-4 transition-opacity duration-400 animate-[bt-up_0.6s_ease_both] ${win ? "opacity-25" : ""}`}>
        <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center border border-dashed border-[rgba(0,217,255,0.45)] bg-[rgba(0,217,255,0.04)] text-center font-mono text-[10px] leading-[1.4] tracking-[1.5px] text-[#6B7B87] max-[600px]:hidden">
          [UNSC
          <br />
          EMBLEM]
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-[13px] font-bold tracking-[6px] text-[#A8B5BF] max-[600px]:text-[10px] max-[600px]:tracking-[3px]">UNITED NATIONS SPACE COMMAND</div>
          <div className="h-px w-40" style={{ background: `linear-gradient(90deg,transparent,${decided ? tone : C.cyan},transparent)` }} />
          <div className="text-[15px] font-bold tracking-[5px] text-[#00D9FF] [text-shadow:0_0_12px_rgba(0,217,255,0.45)] max-[600px]:text-[12px] max-[600px]:tracking-[3px]">505TH EXPEDITIONARY FORCE</div>
        </div>
        <img src="/images/logo.png" alt="505th Expeditionary Force" className="h-[84px] w-[84px] shrink-0 object-contain drop-shadow-[0_0_12px_rgba(0,217,255,0.45)] max-[600px]:h-14 max-[600px]:w-14" />
      </div>

      {/* scan card */}
      <main className="relative z-10 flex items-center justify-center px-4 py-10">
        <div
          className={`relative grid w-full max-w-[760px] grid-cols-[220px_1fr] items-center gap-10 border bg-[rgba(20,27,31,0.85)] p-10 transition-opacity duration-400 [clip-path:polygon(18px_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%,0_18px)] max-[720px]:grid-cols-1 max-[720px]:justify-items-center max-[720px]:gap-6 max-[720px]:p-6 ${win ? "opacity-25" : ""}`}
          style={{ borderColor: decided ? `${tone}66` : "rgba(0,217,255,.35)", boxShadow: `0 0 60px ${decided ? `${tone}1a` : "rgba(0,217,255,.12)"}` }}
        >
          <div className="relative h-[250px] w-[220px] animate-[bt-hex-in_0.7s_cubic-bezier(.2,.9,.3,1.2)_both] max-[720px]:h-[170px] max-[720px]:w-[150px]">
            <div className="absolute inset-0 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" style={{ background: decided ? tone : C.cyan }} />
            <div className="absolute inset-[3px] flex items-center justify-center overflow-hidden bg-[#1C2529] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
              {p.avatar ? (
                <img src={p.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-[13px] tracking-[2px] text-[#6B7B87]">NO AVATAR</span>
              )}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 h-[3px] [animation-direction:alternate] [animation-iteration-count:infinite] [animation-name:bt-scan] [animation-timing-function:ease-in-out]"
                style={{
                  background: decided ? tone : C.cyan,
                  boxShadow: `0 0 16px ${decided ? tone : C.cyan}`,
                  animationDuration: decided ? (p.result === "DENIED" ? ".45s" : p.result === "PENDING" ? "2.4s" : "1.2s") : "1.2s",
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3.5 max-[720px]:w-full">
            <div className="font-mono text-xs tracking-[3px] text-[#A8B5BF]">UNSC TACTICAL NETWORK // IDENTITY VERIFICATION</div>
            {step >= 1 && (
              <div className="animate-[bt-up_0.5s_ease_both]">
                <div className="text-[2.2rem] font-bold leading-[1.1] tracking-[3px] max-[720px]:text-[1.6rem]">{p.name}</div>
                <div className="mt-1.5 inline-block border px-2.5 py-[3px] text-[0.9rem] font-bold tracking-[3px]" style={{ borderColor: decided ? tone : "#6B7B87", color: decided ? tone : "#6B7B87" }}>
                  {decided ? (p.result === "PENDING" ? "STATUS: AWAITING APPROVAL" : p.result === "DENIED" ? "CLEARANCE: DENIED" : p.tag) : "CLEARANCE: CHECKING"}
                </div>
              </div>
            )}
            <ul className="mt-2 flex flex-col gap-2.5 font-mono text-[15px] max-[720px]:text-[13px]" aria-live="polite">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-3" style={{ color: r.col }}>
                  <span className={`inline-block w-[18px] text-center ${r.spin ? "animate-[bt-spin_1s_linear_infinite]" : ""}`}>{r.icon}</span>
                  <span className="flex-1">{r.label}</span>
                  <span className="text-[11px] tracking-[1.5px]">{r.res}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      {/* terminal pop-up */}
      {win && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="scan-title"
            aria-describedby="scan-reason"
            className="max-h-[calc(100vh-40px)] w-full max-w-[560px] origin-center overflow-y-auto border bg-[#050709] font-mono animate-[bt-win_0.28s_steps(6)_both]"
            style={{ borderColor: tone, boxShadow: `0 0 0 1px rgba(0,0,0,.6), 0 0 50px ${glow}` }}
          >
            <div className="flex items-center gap-2 px-2.5 py-[5px] text-[11px] font-bold tracking-[2px] text-[#050709]" style={{ background: tone }}>
              <span aria-hidden="true">{p.result === "DENIED" ? "⚠" : "◈"}</span>
              <span id="scan-title" className="flex-1">
                {title}
              </span>
              <span aria-hidden="true">_ □ ✕</span>
            </div>
            <div className="px-5 py-[18px]">
              <div className="text-[11px] tracking-[1px] text-[#A8B5BF]">&gt; verify_clearance --operator {p.operator}</div>
              <div className="mb-3 mt-1 text-[11px] tracking-[1px]" style={{ color: tone }}>
                {cmdResult}
              </div>
              <div className="flex items-center gap-1 text-[30px] tracking-[6px] max-[480px]:text-[22px] max-[480px]:tracking-[4px]" style={{ color: tone, textShadow: `0 0 14px ${glow}` }}>
                <span className="inline-block whitespace-nowrap [clip-path:inset(0_100%_0_0)] animate-[bt-type_0.7s_steps(14)_0.3s_forwards]">{big}</span>
                <span className="animate-[bt-blink_0.8s_step-end_infinite]" aria-hidden="true">
                  █
                </span>
              </div>
              <div id="scan-reason" className="mt-3.5 border-l-[3px] px-3 py-2.5 opacity-0 animate-[bt-up_0.3s_ease_1.1s_forwards]" style={{ borderColor: tone, background: tint }}>
                <div className="mb-1 text-[10px] tracking-[2px]" style={{ color: tone }}>
                  {R.code}
                </div>
                <div className="font-[Rajdhani,sans-serif] text-base font-semibold leading-[1.4] text-[#E8EEF2]">{reasonText}</div>
              </div>

              {p.result === "PENDING" && (
                <>
                  <ol aria-label="Enlistment progress" className="mt-4 flex text-[10px] tracking-[1.2px] opacity-0 animate-[bt-up_0.3s_ease_1.25s_forwards]">
                    {[["APPLIED", "ok"], ["DISCORD", "ok"], ["STAFF REVIEW", "now"], ["APPROVED", ""]].map(([label, st], i) => (
                      <li key={label} className="relative flex flex-1 flex-col items-center gap-1.5" style={{ color: st === "ok" ? C.ok : st === "now" ? C.amber : "#4b5a65" }}>
                        {i > 0 && (
                          <span aria-hidden="true" className="absolute right-1/2 top-[5px] h-px w-full" style={{ background: st === "ok" ? C.ok : st === "now" ? `linear-gradient(90deg,${C.ok},${C.amber})` : "#2a343b" }} />
                        )}
                        <span
                          aria-hidden="true"
                          className={`relative h-[11px] w-[11px] rotate-45 border ${st === "now" ? "animate-[bt-pulse_1.4s_ease-in-out_infinite]" : ""}`}
                          style={{ borderColor: "currentColor", background: st === "ok" ? C.ok : st === "now" ? "rgba(255,215,0,.25)" : "#050709" }}
                        />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3.5 flex items-center gap-2.5 text-[10px] tracking-[1.5px] text-[#6B7B87] opacity-0 animate-[bt-up_0.3s_ease_1.35s_forwards]">
                    <span>AUTO RE-CHECK</span>
                    <span className="h-[3px] flex-1 overflow-hidden bg-[#1c2529]">
                      <span className="block h-full origin-left bg-[#FFD700] animate-[bt-drain_30s_linear_forwards]" />
                    </span>
                    <span>30s</span>
                  </div>
                </>
              )}

              <dl className="mt-3.5 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-0.5 text-[11px] text-[#4b5a65] opacity-0 animate-[bt-up_0.3s_ease_1.4s_forwards]">
                <dt className="text-[#6B7B87]">OPERATOR</dt>
                <dd>
                  {p.name} · {p.discordId}
                </dd>
                <dt className="text-[#6B7B87]">TIME</dt>
                <dd>{p.time} UTC</dd>
                <dt className="text-[#6B7B87]">LOG</dt>
                <dd>{p.result === "DENIED" ? `#${p.incident} · failed attempt logged for staff review` : p.result === "PENDING" ? "Pending request recorded for staff" : "Sign-in recorded"}</dd>
              </dl>
              {R.actions.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2.5 opacity-0 animate-[bt-up_0.3s_ease_1.6s_forwards]">
                {R.actions.map((a, i) => (
                  <a
                    key={a.label}
                    id={i === 0 ? "scan-first-action" : undefined}
                    href={a.href}
                    {...(a.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={`flex min-h-[46px] min-w-[150px] flex-1 items-center justify-center border font-[Rajdhani,sans-serif] text-[13px] font-bold tracking-[2.5px] no-underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D9FF] ${BTN[a.kind]}`}
                  >
                    {a.label}
                  </a>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
