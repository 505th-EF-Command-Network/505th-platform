import type { Metadata } from "next";
import "@/styles/tw/boot.css";

export const metadata: Metadata = { title: "404 — Signal Lost — 505th Expeditionary Force", robots: { index: false } };

/** Site-wide 404 in the 505th terminal style. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-[#0A0E12] to-[#050709] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_50px,rgba(0,217,255,0.03)_50px,rgba(0,217,255,0.03)_51px),repeating-linear-gradient(90deg,transparent,transparent_50px,rgba(0,217,255,0.03)_50px,rgba(0,217,255,0.03)_51px)]" />
      <img src="/images/logo.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />

      <div className="relative w-full max-w-[560px] border border-[#00D9FF] bg-[#050709] font-mono shadow-[0_0_0_1px_rgba(0,0,0,.6),0_0_50px_rgba(0,217,255,0.25)] animate-[bt-win_0.28s_steps(6)_both]">
        <div className="flex items-center gap-2 bg-[#00D9FF] px-2.5 py-[5px] text-[11px] font-bold tracking-[2px] text-[#050709]">
          <span aria-hidden="true">◈</span>
          <span className="flex-1">NAVIGATION ERROR</span>
          <span aria-hidden="true">_ □ ✕</span>
        </div>
        <div className="px-5 py-5">
          <div className="text-[11px] tracking-[1px] text-[#A8B5BF]">&gt; locate_page --path [REQUESTED]</div>
          <div className="mb-3 mt-1 text-[11px] tracking-[1px] text-[#00D9FF]">◌ NO SIGNAL  [ERR-404]</div>
          <h1 className="flex items-center gap-1 text-[30px] tracking-[6px] text-[#00D9FF] [text-shadow:0_0_14px_rgba(0,217,255,0.45)] max-[480px]:text-[22px] max-[480px]:tracking-[4px]">
            <span className="inline-block whitespace-nowrap [clip-path:inset(0_100%_0_0)] animate-[bt-type_0.7s_steps(11)_0.3s_forwards]">SIGNAL LOST</span>
            <span aria-hidden="true" className="animate-[bt-blink_0.8s_step-end_infinite]">
              █
            </span>
          </h1>
          <div className="mt-3.5 border-l-[3px] border-[#00D9FF] bg-[rgba(0,217,255,0.06)] px-3 py-2.5 opacity-0 animate-[bt-up_0.3s_ease_1s_forwards]">
            <div className="mb-1 text-[10px] tracking-[2px] text-[#00D9FF]">ERR-404 // PAGE NOT FOUND</div>
            <p className="font-[Rajdhani,sans-serif] text-base font-semibold leading-[1.4] text-[#E8EEF2]">
              This page doesn&apos;t exist or has been moved. Check the link, or head back to base.
            </p>
          </div>
          <div className="mt-[18px] flex flex-wrap gap-2.5 opacity-0 animate-[bt-up_0.3s_ease_1.2s_forwards]">
            <a
              href="/home"
              className="flex min-h-[46px] min-w-[150px] flex-1 items-center justify-center border border-[#6B8235] bg-[#4A5D23] font-[Rajdhani,sans-serif] text-[13px] font-bold tracking-[2.5px] text-[#E8EEF2] no-underline hover:shadow-[0_0_16px_rgba(107,130,53,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D9FF]"
            >
              RETURN TO HOME
            </a>
            <a
              href="/resources-handbook"
              className="flex min-h-[46px] min-w-[150px] flex-1 items-center justify-center border border-[rgba(0,217,255,0.5)] font-[Rajdhani,sans-serif] text-[13px] font-bold tracking-[2.5px] text-[#00D9FF] no-underline hover:bg-[rgba(0,217,255,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D9FF]"
            >
              RESOURCES
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
