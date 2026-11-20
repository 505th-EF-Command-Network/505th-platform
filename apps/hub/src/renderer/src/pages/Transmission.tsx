import { useState } from "react";
import { QuickPost } from "./QuickPost";
import { Send } from "./Send";

/**
 * CORTANA COMMAND → TRANSMISSION (approved mock 19 Nov, name picked by Lt Gen Drake) — Send Message + Quick Post in one page.
 * ✉ MESSAGE = Send Message (access "send") · 🖼 PHOTOS = Quick Post (access "qu"). A tab you can't use is hidden.
 */
export function Transmission(p: { access: Record<string, boolean>; start?: "msg" | "pic" }) {
  const canMsg = !!p.access.send, canPic = !!p.access.qu;
  const [tab, setTab] = useState<"msg" | "pic">(p.start === "pic" && canPic ? "pic" : canMsg ? "msg" : "pic");
  const T = (k: "msg" | "pic", l: string, sub: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`border px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[2px] ${tab === k ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 bg-[#070a0f] text-dim hover:text-[#c6d0da]"}`}>
      {l}<small className="mt-1 block text-[10.5px] font-normal tracking-[.5px] opacity-80">{sub}</small></button>);
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">📡 TRANSMISSION</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">POST TO DISCORD AS CORTANA · MESSAGES AND PHOTOS IN ONE PLACE</p>
        {canMsg && canPic && <div role="tablist" className="mt-3.5 flex">{T("msg", "✉ MESSAGE", "Text or embed · GIF · link buttons · schedule")}{T("pic", "🖼 PHOTOS", "Up to 10 images · embed / grid / plain")}</div>}
      </div>
      {tab === "msg" ? <Send bare /> : <QuickPost bare />}
    </div>
  );
}
