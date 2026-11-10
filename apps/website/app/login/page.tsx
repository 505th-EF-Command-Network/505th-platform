import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import "@/styles/tw/boot.css";

export const metadata: Metadata = { title: "Sign in — 505th Command Network" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled in Discord.",
  state: "Sign-in expired or was tampered with. Please try again.",
  discord: "Discord could not be reached. Please try again in a moment.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; out?: string }> }) {
  const { error, next, out } = await searchParams;
  if (await getViewer()) redirect("/boot");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/boot";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-[#0A0E12] to-[#050709] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />
      <img src="/images/logo.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />

      <section
        aria-labelledby="login-title"
        className="relative w-full max-w-[460px] border border-[rgba(0,217,255,0.35)] bg-[rgba(20,27,31,0.88)] p-9 text-center shadow-[0_0_60px_rgba(0,217,255,0.12)] [clip-path:polygon(18px_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%,0_18px)] animate-[bt-up_0.5s_ease_both] max-[480px]:p-6"
      >
        <img src="/images/logo.png" alt="505th Expeditionary Force" className="mx-auto mb-4 h-24 w-24 drop-shadow-[0_0_14px_rgba(0,217,255,0.5)]" />
        <p className="font-mono text-[11px] tracking-[3px] text-[#6B7B87]">UNSC TACTICAL NETWORK</p>
        <h1 id="login-title" className="mt-1 text-[1.6rem] font-bold tracking-[4px] text-[#00D9FF] [text-shadow:0_0_14px_rgba(0,217,255,0.45)]">
          COMMAND NETWORK SIGN-IN
        </h1>

        {out && !error && (
          <div role="status" className="mt-5 border border-[rgba(34,224,122,0.45)] bg-[rgba(34,224,122,0.06)] px-3 py-2.5 font-mono text-[11px] tracking-[2px] text-[#22e07a]">
            ✓ SIGNED OUT SAFELY{out === "all" ? " — ON ALL YOUR DEVICES" : ""}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 border-l-[3px] border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] px-3 py-2.5 text-left text-[0.95rem] font-semibold text-[#E8EEF2]">
            <span className="block font-mono text-[10px] tracking-[2px] text-[#ff6b6b]">⚠ SIGN-IN FAILED</span>
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </div>
        )}

        <a
          href={`/api/auth/discord?next=${encodeURIComponent(target)}`}
          className="mt-7 flex min-h-[52px] items-center justify-center gap-3 border border-[#7b86ff] bg-[#5865F2] text-[1rem] font-bold tracking-[3px] text-white no-underline transition hover:shadow-[0_0_18px_rgba(88,101,242,0.55)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00D9FF]"
        >
          <svg viewBox="0 0 71 55" aria-hidden="true" className="h-[18px] w-6 fill-white">
            <path d="M60 4.6A58 58 0 0 0 45.6 0l-1.8 3.7a54 54 0 0 0-16.2 0L25.8 0A58 58 0 0 0 11.4 4.6C2.3 18.1-.2 31.3 1 44.3a58 58 0 0 0 17.7 9l3.8-5.2a38 38 0 0 1-6-2.9l1.5-1.1a41.7 41.7 0 0 0 35.6 0l1.5 1.1a38 38 0 0 1-6 2.9l3.8 5.2a58 58 0 0 0 17.7-9C72 29.2 68 16.1 60 4.6zM23.7 36.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2z" />
          </svg>
          LOGIN WITH DISCORD
        </a>

        <ul className="mt-5 space-y-1.5 text-left text-[0.95rem] leading-[1.5] text-[#E8EEF2]">
          <li><span className="text-[#00D9FF]">◈</span> You must be in the 505th Discord server.</li>
          <li><span className="text-[#00D9FF]">◈</span> Passed BCT? Your instructor tells you to sign up — sign in with Discord and you&apos;ll be asked for your enlistment details.</li>
        </ul>
        <p className="mt-3 text-[0.9rem] leading-[1.5] text-[#A8B5BF]">
          We only read your Discord name, avatar and whether you are in the 505th server. We never see your Discord password.
        </p>
        <a href="/home" className="mt-6 inline-block font-mono text-[11px] tracking-[2px] text-[#6B7B87] hover:text-[#00D9FF]">
          ◂ RETURN TO HOME
        </a>
      </section>
    </main>
  );
}
