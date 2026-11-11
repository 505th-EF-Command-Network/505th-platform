import { askBox } from "../components/Confirm";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { BctData, BctPerson } from "../../../preload/api";

/**
 * BCT APPROVALS in the app — same as the Terminal's bct-approvals.js:
 * 4 stats · ① Waiting for approval · ② Approved (30 days) · denied list with REOPEN ·
 * APPROVE = BCT certificate window (date, platoon, instructor, source, note, change preview) · DENY = reason (staff only).
 */
const PFC = "E2 / Private First Class";
const days = (iso: string) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5)) : 0);
const ymd = (iso: string) => (iso ? iso.slice(0, 10) : "—");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const inp = "w-full border border-cyan/35 bg-[#070a0f] px-2.5 py-2 text-[12px] text-[#d6dde6] outline-none focus:border-cyan [color-scheme:dark]";
const Wait = ({ d }: { d: number }) => { const c = d > 14 ? "#ff4d4d" : d > 7 ? "#f59e0b" : "#22e07a"; return <span className="whitespace-nowrap border px-1.5 py-0.5 text-[9.5px] tracking-[1.5px]" style={{ color: c, borderColor: c }}>{d}D WAITING</span>; };

export function Bct() {
  const [d, setD] = useState<BctData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDenied, setShowDenied] = useState(false);
  const [win, setWin] = useState<{ kind: "approve" | "deny"; u: BctPerson } | null>(null);
  const [toast, setToast] = useState<[string, boolean] | null>(null);

  const load = useCallback(async () => { const r = await window.cn.hub.bct(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "users") { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const act = async (body: Record<string, unknown>) => { const r = await window.cn.hub.bctAction(body); setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]); await load(); return r; };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const dl = (rows: [string, React.ReactNode][]) => <dl className="m-0 mt-2.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-[10.5px]">{rows.map(([k, v]) => [<dt key={k} className="tracking-[1.5px] text-dimmer">{k}</dt>, <dd key={k + "v"} className="m-0 text-right text-[#c6d0da]">{v}</dd>])}</dl>;
  const col = (n: string, t: string, sub: string, c: string, count: number, body: React.ReactNode) => (
    <section className="border border-cyan/15 bg-[#0b1016]" style={{ borderTop: `2px solid ${c}` }}>
      <div className="flex items-center justify-between border-b border-cyan/15 px-3 py-2.5"><div><h3 className="m-0 font-head text-[14px] tracking-[2.5px] text-white">{n} {t}</h3><small className="text-[9.5px] tracking-[1.5px] text-dim">{sub}</small></div><b className="font-head text-[20px]" style={{ color: c }}>{count}</b></div>
      <div className="grid gap-2 p-2.5">{body}</div></section>);
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="BCT Approvals">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">BCT APPROVALS</h1>
      <p className="mb-3 mt-1 text-[11px] tracking-[2px] text-dim">PASSED BCT → INSTRUCTOR TELLS THEM TO SIGN UP → YOU APPROVE = PFC · MARINE</p>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {([[d.pending.length, "WAITING", "#f59e0b"], [d.denied.length, "DENIED (30 DAYS)", "#00D9FF"], [d.thisMonth, "APPROVED THIS MONTH", "#22e07a"], [d.avg, "AVG DAYS TO APPROVE", "#c6d0da"]] as [string | number, string, string][]).map(([v, l, c]) => (
          <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {col("①", "WAITING FOR APPROVAL", "PASSED BCT · SIGNED UP ON THE WEBSITE", "#f59e0b", d.pending.length, d.pending.length ? d.pending.map((u, i) => (
          <div key={u.id} className="rise tile border border-cyan/15 bg-[#0e151a] p-3" style={{ borderLeft: "2px solid #f59e0b", animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-center gap-2.5"><span className="grid h-[38px] w-[38px] shrink-0 place-items-center border border-cyan/25 bg-[#0a1018] font-head font-bold text-cyan">{u.initials}</span>
              <div className="min-w-0 flex-1"><div className="text-[13.5px] text-white">{u.fullName}</div><div className="break-all text-[9.5px] tracking-[1px] text-dim">{u.discordUsername ? "@" + u.discordUsername : u.email || "NO DISCORD LINK"} · SIGNED UP {ymd(u.registeredAt)}</div></div>
              <Wait d={days(u.registeredAt)} /></div>
            {dl([["BCT INSTRUCTOR", <>{u.bctInstructor || "—"} <span className="text-dimmer">(THEY SAID)</span></>], ["HEARD ABOUT US", u.recruitSource || "—"], ["TIMEZONE", u.timezone || "—"]])}
            {d.canAct && <div className="mt-2.5 flex gap-1.5">
              <button type="button" onClick={() => setWin({ kind: "approve", u })} className="flex-1 border border-amber bg-amber py-2 font-head text-[11px] font-bold tracking-[2px] text-black">✓ APPROVE · PFC</button>
              <button type="button" onClick={() => setWin({ kind: "deny", u })} className="flex-1 border border-bad/45 py-2 font-head text-[11px] font-bold tracking-[2px] text-bad hover:bg-bad/5">✕ DENY</button></div>}
          </div>)) : <p className="py-8 text-center text-[10px] tracking-[3px] text-dimmer">NOBODY WAITING</p>)}
        {col("②", "APPROVED", "NOW PFC · LAST 30 DAYS", "#22e07a", d.approved.length, d.approved.length ? d.approved.map((u, i) => (
          <div key={u.id} className="rise border border-cyan/15 bg-[#0e151a] p-3 opacity-90" style={{ borderLeft: "2px solid #22e07a", animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-center gap-2.5"><span className="grid h-[38px] w-[38px] shrink-0 place-items-center border border-cyan/25 bg-[#0a1018] font-head text-[12px] font-bold text-ok">{u.name.split(" ")[0] || "PFC"}</span>
              <div className="min-w-0"><div className="text-[13.5px] text-white">{u.name}</div><div className="text-[9.5px] tracking-[1px] text-dim">{u.platoon.toUpperCase()} · {ymd(u.approvedAt)}</div></div></div>
            {dl([["BCT INSTRUCTOR", u.bctInstructor], ["APPROVED BY", u.approvedBy || "—"]])}
          </div>)) : <p className="py-8 text-center text-[10px] tracking-[3px] text-dimmer">NONE IN THE LAST 30 DAYS</p>)}
      </div>
      <div className="mt-3.5 text-[10px] tracking-[2px] text-dim">DENIED (LAST 30 DAYS): <button type="button" onClick={() => setShowDenied(!showDenied)} className="tracking-[2px] text-cyan underline">{d.denied.length} — {d.denied.length ? (showDenied ? "HIDE" : "VIEW") : "NONE"}</button></div>
      {showDenied && <div className="mt-2.5 grid gap-2">{d.denied.map((u) => (
        <div key={u.id} className="flex items-center gap-2.5 border border-cyan/15 bg-[#0e151a] p-3" style={{ borderLeft: "2px solid #ff4d4d" }}>
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center border border-cyan/25 font-head font-bold text-bad">{u.initials}</span>
          <div className="min-w-0 flex-1"><div className="text-[13.5px] text-white">{u.fullName}</div><div className="text-[9.5px] tracking-[1px] text-dim">DENIED {ymd(u.deniedAt)} BY {u.deniedBy || "—"} · {u.denyReason}</div></div>
          {d.canAct && <button type="button" onClick={async () => { if (await askBox(`MOVE BACK TO WAITING?\n\n${u.fullName} goes back to "Waiting for approval".`)) void act({ action: "reopen", id: u.id }); }} className="border border-amber px-2 py-1 text-[9.5px] tracking-[1.5px] text-amber">REOPEN</button>}
        </div>))}</div>}
      {win?.kind === "approve" && <Approve d={d} u={win.u} onClose={() => setWin(null)} go={async (f) => { const r = await act({ action: "approve", id: win.u.id, ...f }); if (r.ok) setWin(null); }} />}
      {win?.kind === "deny" && <Deny d={d} u={win.u} onClose={() => setWin(null)} go={async (f) => { const r = await act({ action: "deny", id: win.u.id, ...f }); if (r.ok) setWin(null); }} />}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function Modal(p: { title: string; color: string; sub: string; onClose: () => void; children: React.ReactNode; foot: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [p]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#020407c7] p-5 backdrop-blur-[3px]" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label={p.title} className="rise max-h-[calc(100vh-40px)] w-[min(560px,100%)] overflow-auto border border-cyan/35 bg-[#0b0f15] shadow-[0_20px_80px_rgba(0,0,0,.6)]">
        <div className="flex items-center justify-between border-b border-cyan/20 px-5 py-3.5"><div><h2 className="m-0 font-head text-[16px] font-bold tracking-[4px]" style={{ color: p.color }}>{p.title}</h2><div className="mt-0.5 text-[10px] tracking-[2px] text-dim">{p.sub}</div></div>
          <button type="button" onClick={p.onClose} aria-label="Close" className="h-[30px] w-[30px] border border-cyan/35 text-[#9fb3c4]">✕</button></div>
        <div className="px-5 py-4">{p.children}</div>
        <div className="flex items-center justify-between gap-2.5 border-t border-cyan/20 bg-[#090c11] px-5 py-3">{p.foot}</div>
      </div>
    </div>);
}
const L = ({ id, t, s }: { id: string; t: string; s?: string }) => <label htmlFor={id} className="mb-1.5 block text-[9.5px] tracking-[2.5px] text-[#aeb9c4]">{t}{s && <small className="tracking-[1px] text-dimmer"> {s}</small>}</label>;

function Approve(p: { d: BctData; u: BctPerson; onClose: () => void; go: (f: Record<string, unknown>) => Promise<void> }) {
  const { u, d } = p;
  const [f, setF] = useState({ date: u.bctDate || today(), platoon: "1st Platoon", instructor: d.instructors.includes(u.bctInstructor) ? u.bctInstructor : "", source: d.sources.includes(u.recruitSource) ? u.recruitSource : "", note: "", post: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rows: [string, string, string][] = [["STATUS", "Signed up", "Active"], ["RANK", u.rank || "—", PFC], ["ROLE", u.role === "enlistee" ? "—" : u.role || "—", "Marine"], ["PLATOON", u.platoon || "—", f.platoon], ["GRADUATION", u.graduation || "—", f.date || "—"], ["DISPLAY NAME", "—", u.pfcName]];
  return (
    <Modal title="APPROVE — BCT CERTIFICATE" color="#f59e0b" sub={`${u.fullName.toUpperCase()}${u.discordUsername ? " · @" + u.discordUsername : ""}`} onClose={p.onClose}
      foot={<><span className="text-[9.5px] tracking-[1.5px] text-dim">STARTS THEIR SERVICE RECORD WITH "BCT PASSED → PFC"</span><div className="flex gap-2">
        <button type="button" onClick={p.onClose} className="border border-[#5b6b7c] px-4 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-[#c6d0da]">CANCEL</button>
        <button type="button" disabled={busy} onClick={async () => { if (!f.date || !f.instructor) return setErr("Set a graduation date and pick the BCT instructor."); setBusy(true); await p.go(f); setBusy(false); }}
          className="whitespace-nowrap border border-amber bg-amber px-4 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-black disabled:opacity-60">✓ APPROVE AS PFC</button></div></>}>
      <div className="flex items-center gap-3.5 border border-amber/45 p-3.5" style={{ background: "linear-gradient(135deg,rgba(245,158,11,.08),transparent 60%)" }}>
        <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border-2 border-amber font-head text-[12px] font-bold text-amber">BCT</div>
        <div><b className="block font-head text-[14px] tracking-[3px] text-amber">BCT PASSED</b><span className="text-[10px] tracking-[1px] text-dim">Confirms they passed Basic Combat Training. They join as PFC.</span></div></div>
      <div className="mt-3.5 grid grid-cols-2 gap-x-3.5 gap-y-3">
        <div><L id="bA-date" t="GRADUATION DATE" /><input id="bA-date" type="date" value={f.date} max={today()} onChange={(x) => setF({ ...f, date: x.target.value })} className={inp} /></div>
        <div><L id="bA-pl" t="ASSIGN TO PLATOON" /><select id="bA-pl" value={f.platoon} onChange={(x) => setF({ ...f, platoon: x.target.value })} className={inp}>{d.platoons.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><L id="bA-ins" t="BCT INSTRUCTOR" s="(WHO PASSED THEM)" /><select id="bA-ins" value={f.instructor} onChange={(x) => setF({ ...f, instructor: x.target.value })} className={inp}><option value="">— SELECT —</option>{d.instructors.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><L id="bA-src" t="RECRUITMENT SOURCE" /><select id="bA-src" value={f.source} onChange={(x) => setF({ ...f, source: x.target.value })} className={inp}><option value="">— NOT SET —</option>{d.sources.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="col-span-2"><L id="bA-note" t="INSTRUCTOR NOTE" s="(OPTIONAL — SAVED TO SERVICE RECORD)" /><input id="bA-note" maxLength={200} value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} placeholder="e.g. Strong on comms, needs work on CQB" className={inp} /></div>
      </div>
      <div className="mt-3.5 border border-cyan/20 bg-[#070a0f]">{rows.map(([k, o, n]) => (
        <div key={k} className="grid items-center gap-2 border-b border-cyan/5 px-3 py-2 text-[11px] last:border-0" style={{ gridTemplateColumns: "110px 1fr auto 1fr" }}><dt className="text-[9px] tracking-[2px] text-dimmer">{k}</dt><span className="text-dim">{o}</span><span className="text-dim">→</span><span className="text-ok">{n}</span></div>))}</div>
      <label className="mt-3 flex items-center gap-2 text-[10.5px]"><input type="checkbox" checked={f.post} onChange={(x) => setF({ ...f, post: x.target.checked })} className="accent-cyan" /> Post to Discord (approved webhook)</label>
      {err && <p className="mb-0 mt-2 text-[12px] text-bad">⚠ {err}</p>}
    </Modal>);
}

function Deny(p: { d: BctData; u: BctPerson; onClose: () => void; go: (f: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ reason: "", note: "", post: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="DENY" color="#ff4d4d" sub={p.u.fullName.toUpperCase()} onClose={p.onClose}
      foot={<><span className="text-[9.5px] tracking-[1.5px] text-dim">THEY CAN'T SIGN IN. YOU CAN REOPEN IT FOR 30 DAYS.</span><div className="flex gap-2">
        <button type="button" onClick={p.onClose} className="border border-[#5b6b7c] px-4 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-[#c6d0da]">CANCEL</button>
        <button type="button" disabled={busy} onClick={async () => { if (!f.reason) return setErr("Pick a reason."); setBusy(true); await p.go(f); setBusy(false); }} className="border border-bad px-4 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-bad disabled:opacity-60">✕ CONFIRM</button></div></>}>
      <div className="grid gap-3">
        <div><L id="bD-r" t="REASON" s="(STAFF ONLY — NOT SENT TO THEM)" /><select id="bD-r" value={f.reason} onChange={(x) => setF({ ...f, reason: x.target.value })} className={inp}><option value="">— SELECT —</option>{p.d.denyReasons.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><L id="bD-n" t="NOTE" s="(OPTIONAL)" /><input id="bD-n" maxLength={200} value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} className={inp} /></div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[10.5px]"><input type="checkbox" checked={f.post} onChange={(x) => setF({ ...f, post: x.target.checked })} className="accent-cyan" /> Post to Discord (denied webhook)</label>
      {err && <p className="mb-0 mt-2 text-[12px] text-bad">⚠ {err}</p>}
    </Modal>);
}
