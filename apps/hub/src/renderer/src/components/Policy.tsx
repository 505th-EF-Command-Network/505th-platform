import { useEffect, useRef, useState } from "react";
import logo from "../../../../assets/logo.png";
import rcd from "../../../../assets/rcd.png";

/**
 * 505th SOFTWARE USE POLICY & TERMS (release v0.1, approved mock 2026-11-11).
 * Shown before first use and again when the version changes. Must be scrolled to the end before the box unlocks.
 * Acceptance is saved to the account (/api/hub/policy). Keep POLICY_VERSION in step with the website route.
 */
export const POLICY_VERSION = "0.1";

export function PolicyText() {
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-4 font-head text-[13px] font-bold tracking-[2px] text-cyan first:mt-0">{children}</h3>;
  return <div className="text-[12.5px] leading-relaxed text-[#c6d0da]">
    <H>505TH EXPEDITIONARY FORCE — SOFTWARE USE POLICY &amp; TERMS · v{POLICY_VERSION}</H>
    <p>The <b className="text-white">505th Command Network</b> ("the Software") is private software of the <b className="text-white">505th Expeditionary Force</b> ("the 505th"), developed by <b className="text-white">Rev Creative Developer</b> ("RCD"). It is only for members the 505th Commander has given access to.</p>
    <H>1. WHO MAY USE IT</H><p>Only you, with your own Discord sign-in, on your own PC. Access is personal and can't be passed to anyone else.</p>
    <H>2. DO NOT SHARE</H><p>You must <b className="text-white">not</b> share, upload, copy, sell, lend or send the Software, its installer, its download link, or anything shown inside it (member details, rosters, reports, tickets, messages, screenshots or recordings) with <b className="text-white">anyone outside the 505th</b>, or with 505th members who don't have Hub access.</p>
    <div className="my-2 border-l-2 border-bad bg-bad/10 px-3 py-2 text-[#ffb3b3]">⚠ If you break this policy your access is <b>revoked straight away</b>: the Software signs out on every PC and you can't sign in again. The Command staff may take further action under unit rules.</div>
    <H>3. DON'T TAMPER</H><p>Do not copy, change, decompile, reverse-engineer or try to get around the Software's security or access checks.</p>
    <H>4. PRIVACY</H><p>The Software shows personal details of 505th members. Use them only for running the unit. Sign-ins, devices and staff actions are logged in the 505th Audit Log.</p>
    <H>5. NO PROMISES</H><p>The Software is provided "as is" for unit use, without any warranty. RCD and the 505th are not responsible for lost data or problems from using it.</p>
    <H>6. CHANGES</H><p>These terms can change. When they do, you'll be asked to accept them again before you carry on.</p>
    <H>7. COPYRIGHT</H><p><b className="text-white">© 2026 505th Expeditionary Force. All rights reserved.</b> Developed by Rev Creative Developer. The 505th name and logo belong to the 505th Expeditionary Force; the RCD name and logo belong to Rev Creative Developer. Not affiliated with Bohemia Interactive or Microsoft.</p>
    <p className="mt-4 text-[11px] text-dim">— END OF POLICY —</p>
  </div>;
}

/** Full-screen gate: read to the end → tick → I ACCEPT. Decline signs you out. */
export function PolicyGate(p: { onAccepted: () => void }) {
  const [read, setRead] = useState(false);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const b = box.current; if (b && b.scrollHeight <= b.clientHeight + 6) setRead(true); }, []);
  const accept = async () => {
    setBusy(true);
    const r = await window.cn.hub.policyAction({ version: POLICY_VERSION });
    setBusy(false);
    if (r.error) setErr(r.error); else p.onAccepted();
  };
  return (
    <main className="grid h-full place-items-center overflow-auto p-6" aria-label="Software policy">
      <div className="cfm-pop w-[760px] max-w-full border border-cyan/50 bg-panel shadow-[0_20px_60px_rgba(0,0,0,.7),0_0_40px_rgba(0,217,255,.12)]">
        <div className="flex items-center gap-4 border-b border-cyan/15 px-6 py-4" style={{ background: "linear-gradient(90deg,rgba(0,217,255,.07),transparent)" }}>
          <img src={logo} alt="505th" className="h-14 w-14 object-contain" />
          <div className="flex-1"><h1 className="m-0 font-head text-[20px] font-bold tracking-[3px] text-white">POLICY &amp; TERMS</h1><p className="m-0 text-[11px] tracking-[1px] text-dim">PLEASE READ IT ALL — SCROLL TO THE END TO UNLOCK THE BOX</p></div>
          <span className="flex items-center gap-2 text-[9.5px] tracking-[1px] text-dim"><img src={rcd} alt="Rev Creative Developer" className="h-8 w-8 rounded-md" /><span>DEVELOPED BY<b className="block text-[11px] font-semibold tracking-normal text-white">Rev Creative Developer</b></span></span>
        </div>
        <div className="px-6 py-4">
          <div ref={box} tabIndex={0} aria-label="Policy text" onScroll={(e) => { const b = e.currentTarget; if (!read && b.scrollTop + b.clientHeight >= b.scrollHeight - 6) setRead(true); }}
            className="h-[340px] overflow-auto border border-cyan/15 bg-[#05080c] px-4 py-3"><PolicyText /></div>
          <p role="status" className={`my-2 text-[11px] ${read ? "text-ok" : "text-amber"}`}>{read ? "✓ You've read the policy" : "▼ Scroll to the end of the policy to continue"}</p>
          <label className={`flex items-start gap-2.5 text-[13px] ${read ? "" : "opacity-40"}`}>
            <input type="checkbox" disabled={!read} checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan" />I have read and accept the 505th Software Use Policy &amp; Terms.</label>
          {err && <p role="alert" className="mt-2 text-[12px] text-bad">⚠ {err}</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-cyan/15 bg-[#05080c] px-6 py-3">
          <small className="flex-1 text-[9.5px] tracking-[1px] text-dimmer">© 2026 505TH EXPEDITIONARY FORCE · DEVELOPED BY REV CREATIVE DEVELOPER</small>
          <button type="button" onClick={() => void window.cn.auth.logout()} className="border border-cyan/25 px-4 py-1.5 text-[11px] tracking-[2px] text-white">DECLINE &amp; SIGN OUT</button>
          <button type="button" disabled={!ok || busy} onClick={() => void accept()} className="border border-gold bg-gold px-4 py-1.5 text-[11px] font-bold tracking-[2px] text-black disabled:opacity-40">{busy ? "…" : "I ACCEPT ›"}</button>
        </div>
      </div>
    </main>
  );
}
