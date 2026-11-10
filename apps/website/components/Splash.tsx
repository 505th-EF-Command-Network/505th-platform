"use client";

/**
 * Splash at "/" — Idea A "Orbital Drop" intro, then the ORIGINAL index.html
 * boot sequence (same 8 lines at 200ms, 3s loading bar, same status texts),
 * then Home. After [ENTER]: a plain 0.6s fade (no zoom / flash).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LINES: { text: string; ok?: string }[] = [
  { text: "UNSC TACTICAL NETWORK v4.2.1" },
  { text: "INITIALIZING SECURE CONNECTION..." },
  { text: "LOADING 505TH EXPEDITIONARY FORCE DATABASE..." },
  { text: "VERIFYING CREDENTIALS..." },
  { text: "AUTHENTICATION: ", ok: "VERIFIED" },
  { text: "SECURITY CLEARANCE: ", ok: "GRANTED" },
  { text: "LOADING PERSONNEL DATABASE..." },
  { text: "ACCESSING COMMAND TERMINAL..." },
];

function statusFor(p: number) {
  if (p >= 95) return "READY";
  if (p >= 75) return "FINALIZING...";
  if (p >= 50) return "LOADING ASSETS...";
  if (p >= 25) return "ESTABLISHING CONNECTION...";
  return "STAND BY...";
}

export default function Splash() {
  const router = useRouter();
  const [stage, setStage] = useState<"intro" | "leaving" | "boot" | "done">("intro");
  const [lines, setLines] = useState(0);
  const [pct, setPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fade, setFade] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    router.prefetch("/home");
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, [router]);

  const startBoot = useCallback(() => {
    setStage("boot");
    for (let i = 1; i <= LINES.length; i++) later(200 * i, () => setLines(i));
    later(200 * LINES.length + 500, () => {
      setLoading(true);
      const start = performance.now();
      const tick = () => {
        const p = Math.min(100, ((performance.now() - start) / 3000) * 100);
        setPct(p);
        if (p < 100) later(50, tick);
        else {
          later(1000, () => setFade(true));
          later(2000, () => {
            setStage("done");
            // full page load: each page brings its own stylesheet (as on the live site)
            window.location.assign("/home");
          });
        }
      };
      tick();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const enter = useCallback(() => {
    if (stage !== "intro") return;
    setStage("leaving");
    later(600, startBoot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, startBoot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") enter();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enter]);

  const status = statusFor(pct);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050709] bg-[radial-gradient(1px_1px_at_20px_30px,#fff,transparent),radial-gradient(1px_1px_at_120px_80px,rgba(0,217,255,0.8),transparent),radial-gradient(1.5px_1.5px_at_60px_150px,rgba(255,255,255,0.6),transparent)] bg-size-[200px_200px,260px_260px,180px_180px] text-[#E8EEF2] animate-[sp-drift_60s_linear_infinite]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_60px,rgba(0,217,255,0.035)_60px,rgba(0,217,255,0.035)_61px),repeating-linear-gradient(90deg,transparent,transparent_60px,rgba(0,217,255,0.035)_60px,rgba(0,217,255,0.035)_61px)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />

      {/* ── Idea A: Orbital Drop ── */}
      {(stage === "intro" || stage === "leaving") && (
        <>
          <p className="absolute inset-x-0 top-6 text-center font-mono text-xs tracking-[4px] text-[#A8B5BF] animate-[sp-up_0.6s_ease_3.4s_both]">
            CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY
          </p>
          <div
            className={`relative flex flex-col items-center gap-[18px] p-8 text-center transition-opacity duration-[600ms] ${stage === "leaving" ? "opacity-0" : "opacity-100"}`}
          >
            <div className="relative flex h-[260px] w-[260px] items-center justify-center max-[480px]:h-[220px] max-[480px]:w-[220px]">
              <svg viewBox="0 0 260 260" aria-hidden="true" className="absolute inset-0 h-full w-full">
                <circle cx="130" cy="130" r="122" fill="none" stroke="#00D9FF" strokeWidth="2" strokeDasharray="1260" className="animate-[sp-ring_1.4s_ease-out_both]" />
                <circle cx="130" cy="130" r="112" fill="none" stroke="rgba(0,217,255,.25)" strokeWidth="1" strokeDasharray="4 6" />
              </svg>
              <img
                src="/images/logo.png"
                alt="505th Expeditionary Force logo"
                className="h-[200px] w-[200px] max-[480px]:h-[168px] max-[480px]:w-[168px] [animation:sp-reveal_1.1s_cubic-bezier(.6,0,.2,1)_.9s_both,sp-glow_3s_ease-in-out_2.2s_infinite]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-5 top-1/2 h-0.5 bg-[linear-gradient(90deg,transparent,#00D9FF,transparent)] shadow-[0_0_12px_#00D9FF] animate-[sp-scan_1.1s_ease-in-out_0.9s_both]"
              />
            </div>
            <h1 className="whitespace-nowrap [clip-path:inset(0_100%_0_0)] border-r-[3px] border-[#00D9FF] text-[clamp(1.4rem,4vw,3.2rem)] font-bold tracking-[5px] text-[#00D9FF] [text-shadow:0_0_18px_rgba(0,217,255,0.5)] [animation:sp-type_1.2s_steps(27)_2.1s_forwards,sp-caret_.8s_step-end_2.1s_3] max-[480px]:text-[1.25rem] max-[480px]:tracking-[1.5px]">
              505TH EXPEDITIONARY FORCE
            </h1>
            <p className="text-[1.35rem] text-[#A8B5BF] animate-[sp-up_0.7s_ease_3.3s_both]">Where Legends Are Forged in Battle</p>
            <button
              type="button"
              onClick={enter}
              className="mt-[22px] min-h-[52px] cursor-pointer border-2 border-[#00D9FF] bg-[rgba(74,93,35,0.35)] px-11 py-3.5 text-[1.15rem] font-bold tracking-[6px] text-[#E8EEF2] [clip-path:polygon(10px_0,100%_0,100%_calc(100%-10px),calc(100%-10px)_100%,0_100%,0_10px)] [animation:sp-up_.6s_ease_3.8s_both,sp-pulse_2s_ease-in-out_4.4s_infinite] hover:bg-[#00D9FF] hover:text-[#050709] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E8EEF2]"
              style={{ fontFamily: "inherit" }}
            >
              [ ENTER ]
            </button>
            <p className="font-mono text-xs tracking-[2px] text-[#6B7B87] animate-[sp-up_0.6s_ease_4s_both]">CLICK · TAP · OR PRESS ENTER</p>
          </div>
        </>
      )}

      {/* ── Original index.html boot sequence ── */}
      {(stage === "boot" || stage === "done") && (
        <div className="absolute inset-0 z-[4] flex items-center justify-center bg-linear-to-b from-[#0A0E12] to-[#050709] animate-[sp-fade-in_0.5s_ease_both]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,217,255,0.03)_40%,rgba(0,217,255,0.03)_42%,transparent_42%),repeating-linear-gradient(0deg,transparent,transparent_50px,rgba(0,217,255,0.03)_50px,rgba(0,217,255,0.03)_51px),repeating-linear-gradient(90deg,transparent,transparent_50px,rgba(0,217,255,0.03)_50px,rgba(0,217,255,0.03)_51px)] bg-size-[100px_100px,100%_100%,100%_100%] max-[480px]:bg-size-[50px_50px,100%_100%,100%_100%]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] opacity-40 bg-[radial-gradient(circle,transparent_30%,rgba(74,93,35,0.1)_30%,rgba(74,93,35,0.1)_31%,transparent_31%),radial-gradient(circle,transparent_50%,rgba(0,217,255,0.05)_50%,rgba(0,217,255,0.05)_52%,transparent_52%)] animate-[sp-rotate_60s_linear_infinite] max-[768px]:h-[600px] max-[768px]:w-[600px] max-[480px]:h-[400px] max-[480px]:w-[400px]"
          />
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15),rgba(0,0,0,0.15)_1px,transparent_1px,transparent_2px)]" />

          <div
            role="status"
            aria-live="polite"
            className={`relative z-20 w-[90%] max-w-[800px] p-8 text-center transition-opacity duration-1000 max-[480px]:p-4 ${fade ? "opacity-0" : "opacity-100"}`}
          >
            <div className="my-8 text-left text-base font-medium tracking-[1.5px] max-[768px]:text-[0.9rem] max-[480px]:text-[0.8rem] max-[480px]:tracking-[1px]">
              {LINES.map((l, i) => {
                const shown = i < lines;
                const typing = i === lines - 1 && lines < LINES.length;
                return (
                  <div
                    key={l.text}
                    className={`mb-3 text-[#A8B5BF] max-[480px]:mb-2 ${shown ? "animate-[sp-line_0.3s_ease-out_forwards]" : "opacity-0"} ${
                      typing ? "after:ml-[5px] after:text-[#00D9FF] after:content-['█'] after:animate-[sp-cursor_0.8s_step-end_infinite]" : ""
                    }`}
                  >
                    <span className="mr-2 text-[#00D9FF]">&gt;</span>
                    {l.text}
                    {l.ok && <span className="font-bold text-[#00FF41] [text-shadow:0_0_10px_#00FF41]">{l.ok}</span>}
                  </div>
                );
              })}
            </div>

            <div className={`my-12 ${loading ? "animate-[sp-fade-in_0.5s_ease-out_forwards]" : "opacity-0"}`}>
              <div className="mb-4 text-[1.1rem] font-bold tracking-[4px] text-[#00D9FF] max-[480px]:text-[0.9rem] max-[480px]:tracking-[3px]">LOADING SYSTEM</div>
              <div className="relative h-6 w-full overflow-hidden border-2 border-[#00D9FF] bg-[rgba(0,217,255,0.1)] max-[768px]:h-5 max-[480px]:h-[18px]">
                <div
                  className="relative h-full bg-linear-to-r from-[#4A5D23] to-[#00D9FF] shadow-[0_0_20px_rgba(0,217,255,0.5)] transition-[width] duration-300 after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] after:content-[''] after:animate-[sp-shimmer_2s_infinite]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-4 text-2xl font-bold tracking-[3px] text-[#00D9FF] max-[768px]:text-[1.3rem] max-[480px]:text-[1.1rem]">{Math.floor(pct)}%</div>
            </div>
            <div
              className={`mt-8 text-base font-semibold tracking-[3px] max-[480px]:text-[0.85rem] max-[480px]:tracking-[2px] ${loading ? "animate-[sp-fade-in_0.5s_ease-out_forwards]" : "opacity-0"} ${
                pct >= 95 ? "text-[#00FF41] [text-shadow:0_0_10px_#00FF41]" : "text-[#A8B5BF]"
              }`}
            >
              {status}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
