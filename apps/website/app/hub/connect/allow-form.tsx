"use client";

import { useState, useTransition } from "react";
import { allowHub } from "./actions";
import type { ConnectParams } from "./params";

/** Allow / Cancel. On Allow the browser opens cn505://… and Windows hands it to the Command Network app. */
export function AllowForm({ params }: { params: ConnectParams }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) return <p className="mt-8 font-mono text-[12px] tracking-[2px] text-[#7d8a99]">CANCELLED. YOU CAN CLOSE THIS TAB.</p>;
  if (url)
    return (
      <div className="mt-8 space-y-4 text-left" role="status">
        <p className="font-bold tracking-[2px] text-[#22e07a]">✓ DONE — SWITCH BACK TO THE COMMAND NETWORK APP.</p>
        <p className="text-[0.95rem] text-[#c9d3de]">If your browser asks, choose <strong>Open 505th Command Network</strong>. Nothing happened?</p>
        <a href={url} className="inline-block border border-[rgba(0,217,255,0.45)] px-5 py-2.5 font-mono text-[12px] tracking-[2px] text-[#00D9FF] no-underline">OPEN THE APP AGAIN</a>
        <p className="font-mono text-[11px] text-[#7d8a99]">This link works once and expires in 5 minutes.</p>
      </div>
    );
  return (
    <div className="mt-8 space-y-3">
      {error && <p role="alert" className="border-l-[3px] border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] px-3 py-2.5 text-left text-[0.95rem] text-[#E8EEF2]">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { const r = await allowHub(params); if (r.ok) { setUrl(r.url); window.location.href = r.url; } else setError(r.error); })}
        className="flex min-h-[52px] w-full items-center justify-center border border-[#00D9FF] bg-[#00D9FF] font-bold tracking-[3px] text-black disabled:opacity-60"
      >
        {pending ? "ALLOWING…" : "ALLOW COMMAND NETWORK APP"}
      </button>
      <button type="button" onClick={() => setCancelled(true)} className="flex min-h-[44px] w-full items-center justify-center border border-[rgba(0,217,255,0.3)] font-mono text-[12px] tracking-[2px] text-[#c9d3de]">
        CANCEL
      </button>
    </div>
  );
}
