import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { AllowForm } from "./allow-form";
import { connectPath, parseConnect } from "./params";
import "@/styles/tw/boot.css";

export const metadata: Metadata = { title: "Connect the Command Network app — 505th" };
export const dynamic = "force-dynamic";

/** The Command Network app opens this page in the normal browser to sign in (RCD Hub design). */
export default async function HubConnectPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const p = parseConnect(await searchParams);
  const v = await getViewer();
  if (p && !v) redirect(`/login?next=${encodeURIComponent(connectPath(p))}`);

  const box = (title: string, body: React.ReactNode, color = "#00D9FF") => (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#0A0E12] to-[#050709] px-4 py-10">
      <section aria-labelledby="hc-title" className="w-full max-w-[480px] border border-[rgba(0,217,255,0.35)] bg-[rgba(20,27,31,0.92)] p-9 text-center">
        <img src="/images/logo.png" alt="505th Expeditionary Force" className="mx-auto mb-4 h-20 w-20" />
        <h1 id="hc-title" className="text-[1.4rem] font-bold tracking-[4px]" style={{ color }}>{title}</h1>
        {body}
      </section>
    </main>
  );

  if (!p) return box("INVALID LINK", <p className="mt-4 text-[#c9d3de]">This sign-in link is broken or expired. Start again from the Command Network app.</p>, "#ff6b6b");
  if (!v || v.terminal.result !== "GRANTED" || !v.member)
    return box("NO ACCESS", <p className="mt-4 text-[#c9d3de]">The Command Network app is for members with Command Terminal access.</p>, "#ff6b6b");

  return box(
    "CONNECT THE APP",
    <>
      <p className="mt-4 text-[1rem] text-[#E8EEF2]">Signed in as <strong>{v.member.displayName}</strong>.</p>
      <p className="mt-2 text-[0.95rem] text-[#c9d3de]">
        Allow the <strong>505th Command Network</strong> app on <strong className="text-[#00D9FF]">{p.device}</strong> to use your account?
      </p>
      <ul className="mt-4 space-y-1 text-left text-[0.9rem] text-[#c9d3de]">
        <li><span className="text-[#00D9FF]">◈</span> It gets the same access you have in the Terminal — nothing more.</li>
        <li><span className="text-[#00D9FF]">◈</span> You can sign it out any time. Losing Terminal access signs it out.</li>
      </ul>
      <AllowForm params={p} />
    </>,
  );
}
