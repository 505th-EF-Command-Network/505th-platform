import { useEffect, useState } from "react";
import type { UpdateState } from "../../../preload/api";
import { fire } from "../settings";
import { askBox } from "./Confirm";

/**
 * R3: "UPDATE READY" bar under the top bar + a desktop pop-up the first time a new version is seen.
 * UPDATE NOW → download (progress), safety check, install silently, restart. LATER hides it until the next app start.
 */
export function UpdateBanner() {
  const [s, setS] = useState<UpdateState | null>(null);
  const [later, setLater] = useState(false);
  const [notes, setNotes] = useState(false);
  useEffect(() => {
    void window.cn.update.get().then(setS);
    const a = window.cn.update.onState(setS);
    const b = window.cn.update.onNew((i) => fire("rank", { id: "update", title: `⤓ Update ready — v${i.latest}`, body: (i.notes ?? []).slice(0, 2).join(" · ") || "A new version of the Command Network is ready.", icon: "⤓", color: "#c9a227", actions: [{ id: "open", label: "OPEN" }] }));
    return () => { a(); b(); };
  }, []);
  if (!s || (later && s.state === "available")) return null;
  const info = "info" in s ? s.info : undefined;
  if (s.state !== "available" && s.state !== "downloading" && s.state !== "installing" && !(s.state === "error" && info)) return null;
  const go = async () => { if (await askBox(`INSTALL v${info?.latest}?\n\nThe Hub downloads the update, checks it, installs it and opens again. It takes about a minute.`)) void window.cn.update.install(); };
  return (
    <div role="status" className="relative z-20 border-b border-gold/50 bg-gradient-to-r from-gold/15 to-transparent px-4 py-1.5 text-[12px]">
      <div className="flex items-center gap-3">
        <span className="text-[16px]">⤓</span>
        {s.state === "available" && <><b className="font-head tracking-[2px] text-gold">UPDATE READY · v{info!.latest}</b><span className="text-dim">{info!.sizeMB ? `${info!.sizeMB} MB` : ""}</span>
          {!!info!.notes?.length && <button type="button" aria-expanded={notes} onClick={() => setNotes(!notes)} className="text-[11px] tracking-[1px] text-cyan hover:underline">WHAT'S NEW</button>}
          <span className="flex-1" /><button type="button" onClick={() => setLater(true)} className="border border-cyan/25 px-3 py-0.5 text-[10.5px] tracking-[1.5px] text-white">LATER</button>
          <button type="button" onClick={() => void go()} className="border border-gold bg-gold px-3 py-0.5 text-[10.5px] font-bold tracking-[1.5px] text-black">UPDATE NOW</button></>}
        {s.state === "downloading" && <><b className="font-head tracking-[2px] text-gold">DOWNLOADING v{info!.latest}… {s.percent}%</b>
          <span className="h-1.5 flex-1 bg-white/10"><i className="block h-full bg-gold transition-all" style={{ width: `${s.percent}%` }} /></span></>}
        {s.state === "installing" && <b className="font-head tracking-[2px] text-ok">✓ CHECKED · INSTALLING v{info!.latest} — THE HUB WILL OPEN AGAIN IN A MOMENT</b>}
        {s.state === "error" && <><b className="font-head tracking-[2px] text-bad">⚠ UPDATE FAILED</b><span className="flex-1 text-[#ffb3b3]">{s.message}</span>
          <button type="button" onClick={() => void window.cn.update.install()} className="border border-gold px-3 py-0.5 text-[10.5px] tracking-[1.5px] text-gold">TRY AGAIN</button></>}
      </div>
      {notes && s.state === "available" && <ul className="mb-1 ml-8 mt-1 list-disc pl-4 text-[11.5px] text-[#c6d0da]">{info!.notes!.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}

/** About page: version line + CHECK FOR UPDATES. */
export function UpdateCheck() {
  const [s, setS] = useState<UpdateState | null>(null);
  useEffect(() => { void window.cn.update.get().then(setS); return window.cn.update.onState(setS); }, []);
  const when = s && "checkedAt" in s && s.checkedAt ? new Date(s.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  const label = !s ? "" : s.state === "checking" ? "CHECKING…" : s.state === "available" ? `⤓ v${s.info.latest} READY — SEE THE BAR AT THE TOP` : s.state === "downloading" ? `DOWNLOADING ${s.percent}%` : s.state === "installing" ? "INSTALLING…" : s.state === "error" ? `⚠ ${s.message}` : `✓ UP TO DATE${when ? ` · CHECKED ${when}` : ""}`;
  const col = !s ? "#7d8a99" : s.state === "available" ? "#c9a227" : s.state === "error" ? "#ff4d4d" : s.state === "idle" && when ? "#22e07a" : "#7d8a99";
  return <span className="flex flex-wrap items-center gap-2"><span className="border px-2 text-[10.5px] tracking-[1.5px]" style={{ color: col, borderColor: `${col}88` }}>{label || "CHECKS EVERY 4 HOURS"}</span>
    <button type="button" disabled={s?.state === "checking" || s?.state === "downloading" || s?.state === "installing"} onClick={() => void window.cn.update.check()} className="border border-cyan bg-cyan/10 px-2.5 py-0.5 text-[10.5px] tracking-[1.5px] text-cyan disabled:opacity-40">↻ CHECK FOR UPDATES</button></span>;
}
