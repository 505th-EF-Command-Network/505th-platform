import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttEvent, AttRoll, Attendance as AttData } from "../../../preload/api";
import { memberName, rankOrder } from "./Personnel";

/**
 * ATTENDANCE TRACKER in the app — same as the Terminal's attendance-tracker.js:
 * TRACKER / NEW EVENT / HISTORY · online-now strip · 5 stats · op list by month · roll call by platoon
 * (click THIS OP to cycle ✓ → E → –, excused reason, tick all signed up, clear) · rename / delete · LOCK / UNLOCK (Staff NCO+).
 * Every rule is checked again on the server. App extras: rows slide in, hover glow, live updates.
 */
const TYPE: Record<string, [string, string]> = { main_op: ["OPERATIONS", "#00D9FF"], patrol: ["PATROL", "#22e07a"], training: ["TRAINING", "#f59e0b"], fun_op: ["FUN OP", "#a78bfa"] };
const PLATOONS = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", ""];
const plOrder = (p: string) => { const i = PLATOONS.indexOf(p); return i < 0 ? 99 : i; };
const rateC = (p: number | null) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
const rateOf = (u: AttRoll) => (u.opsEligible ? Math.round((u.opsAttended / u.opsEligible) * 100) : null);
const stateOf = (e: AttEvent, uid: string) => (e.attendees.includes(uid) ? "p" : e.excused.includes(uid) ? "e" : "a");
const pgOf = (u: AttRoll) => /^([OE]\d+)/.exec(u.rank)?.[1] ?? "";
const fmtD = (d: string, o: Intl.DateTimeFormatOptions) => { const x = new Date(`${d}T12:00:00`); return isNaN(+x) ? "—" : x.toLocaleDateString("en-GB", o).toUpperCase(); };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const inp = "border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-cyan [color-scheme:dark]";

export function Attendance(p: { onPage: (id: string) => void }) {
  const [d, setD] = useState<AttData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"t" | "n">("t");
  const [cur, setCur] = useState<string | null>(null);
  const [eq, setEq] = useState("");
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<"ALL" | "P" | "A" | "S">("ALL");
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [busy, setBusy] = useState(false);
  const [head, setHead] = useState<{ title: string; date: string; type: string } | null>(null);
  const [nf, setNf] = useState({ mode: "discord", ce: "", title: "", date: today(), type: "main_op", tickGoing: true });

  const load = useCallback(async () => {
    const r = await window.cn.hub.attendance();
    if ("error" in r) setError(r.error); else { setD(r); setError(null); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (["attendance_events", "users", "community_events", "presence_sessions"].includes(x)) { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (d && !cur && d.events[0]) setCur(d.events[0].id); }, [d, cur]);

  const run = async (body: Record<string, unknown>, quiet = false) => {
    setBusy(true);
    const r = await window.cn.hub.attendanceAction(body);
    setBusy(false);
    if (r.error) setToast([r.error, false]); else if (!quiet && r.msg) setToast([r.msg.toUpperCase(), true]);
    await load();
    return r;
  };
  /** Click THIS OP: ✓ → E → – (saved straight away, like the Terminal). */
  const cycle = (e: AttEvent, uid: string) => {
    if (e.locked) return setToast(["EVENT IS LOCKED — UNLOCK TO CORRECT", false]);
    const s = stateOf(e, uid), next = s === "a" ? "p" : s === "p" ? "e" : "a";
    setD((o) => o && { ...o, events: o.events.map((x) => x.id !== e.id ? x : { ...x, attendees: next === "p" ? [...x.attendees, uid] : x.attendees.filter((y) => y !== uid), excused: next === "e" ? [...x.excused, uid] : x.excused.filter((y) => y !== uid) }) });
    void window.cn.hub.attendanceAction({ action: "set", id: e.id, uid, state: next }).then((r) => { if (r.error) { setToast([r.error, false]); void load(); } });
  };

  const roll = useMemo(() => (d ? [...d.roll].sort((a, b) => plOrder(a.platoon) - plOrder(b.platoon) || rankOrder(a.rank) - rankOrder(b.rank)) : []), [d]);
  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;

  const e = d.events.find((x) => x.id === cur) ?? null;
  const ym = today().slice(0, 7);
  const tA = roll.reduce((s, u) => s + u.opsAttended, 0), tE = roll.reduce((s, u) => s + u.opsEligible, 0);
  const all = tE ? Math.round((tA / tE) * 100) : 0;
  const ml = d.events.filter((x) => x.locked && x.date.startsWith(ym));
  const mRate = ml.length && roll.length ? Math.round((ml.reduce((s, x) => s + x.attendees.length, 0) / (ml.length * roll.length)) * 100) : null;
  const open = d.events.filter((x) => !x.locked).length;
  const byId = new Map(roll.map((u) => [u.id, u]));
  const chip = (on: boolean) => `border px-3 py-1.5 text-[11px] tracking-[1.5px] ${on ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim hover:border-cyan/50"}`;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Attendance Tracker">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">ATTENDANCE TRACKER</h1>
        <div className="flex-1" />
        <button type="button" aria-pressed={tab === "t"} onClick={() => setTab("t")} className={chip(tab === "t")}>▣ TRACKER</button>
        <button type="button" aria-pressed={tab === "n"} onClick={() => setTab("n")} className={chip(tab === "n")}>＋ NEW EVENT</button>
        <button type="button" onClick={() => p.onPage("panel-att-history")} className={chip(false)}>▤ HISTORY</button>
      </div>
      <div aria-live="polite" className="mb-3 flex flex-wrap items-center gap-2 border border-cyan/15 bg-[#0b1016] px-3 py-1.5 text-[11px]">
        <span className="tracking-[2px] text-dim">ONLINE NOW</span>
        {d.online.map((id) => byId.get(id)).filter(Boolean).map((u) => <span key={u!.id} className="border border-ok/40 px-1.5 text-ok">● {memberName(u!)}</span>)}
        {!d.online.length && <span className="text-dimmer">—</span>}
        <div className="flex-1" /><span className="text-ok">✓ SAVES AUTOMATICALLY</span>
      </div>

      {tab === "n" ? (
        <section className="rise max-w-[760px] border border-cyan/15 bg-[#0b1016] p-4">
          <b className="font-head tracking-[3px] text-cyan">＋ NEW ATTENDANCE EVENT</b>
          <div className="mt-3 flex gap-1.5">
            <button type="button" aria-pressed={nf.mode === "discord"} onClick={() => setNf({ ...nf, mode: "discord" })} className={chip(nf.mode === "discord")}>FROM A DISCORD EVENT</button>
            <button type="button" aria-pressed={nf.mode === "blank"} onClick={() => setNf({ ...nf, mode: "blank", ce: "" })} className={chip(nf.mode === "blank")}>BLANK</button>
          </div>
          {nf.mode === "discord" && <>
            <label htmlFor="nf_ce" className="mb-1 mt-3 block text-[10px] tracking-[2px] text-dim">PICK EVENT</label>
            <select id="nf_ce" value={nf.ce} className={`${inp} w-full`} onChange={(x) => { const c = d.discord.find((y) => y.id === x.target.value); setNf({ ...nf, ce: x.target.value, title: c?.title ?? nf.title, date: c ? new Date(c.startAtISO).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) : nf.date, type: c && TYPE[c.type] ? c.type : nf.type }); }}>
              <option value="">{d.discord.length ? "— pick —" : "No Discord events without an attendance sheet"}</option>
              {d.discord.map((c) => <option key={c.id} value={c.id}>{c.title} — {new Date(c.startAtISO).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/London" })} · {c.going} attending</option>)}
            </select>
          </>}
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div><label htmlFor="nf_t" className="mb-1 block text-[10px] tracking-[2px] text-dim">TITLE</label><input id="nf_t" maxLength={120} value={nf.title} onChange={(x) => setNf({ ...nf, title: x.target.value })} className={`${inp} w-full`} /></div>
            <div><label htmlFor="nf_d" className="mb-1 block text-[10px] tracking-[2px] text-dim">DATE</label><input id="nf_d" type="date" value={nf.date} onChange={(x) => setNf({ ...nf, date: x.target.value })} className={`${inp} w-full`} /></div>
            <div><label htmlFor="nf_y" className="mb-1 block text-[10px] tracking-[2px] text-dim">TYPE</label><select id="nf_y" value={nf.type} onChange={(x) => setNf({ ...nf, type: x.target.value })} className={`${inp} w-full`}>{Object.entries(TYPE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          {nf.mode === "discord" && nf.ce && <label className="mt-3 flex items-center gap-2 text-[12px] text-[#c6d0da]"><input type="checkbox" checked={nf.tickGoing} onChange={(x) => setNf({ ...nf, tickGoing: x.target.checked })} className="accent-cyan" /> Tick the {d.discord.find((c) => c.id === nf.ce)?.going ?? 0} people who signed up "Going" as present to start with</label>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setTab("t")} className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-dim">CANCEL</button>
            <button type="button" disabled={busy} onClick={async () => { const r = await run({ action: "create", ce: nf.mode === "discord" && nf.ce ? nf.ce : undefined, title: nf.title, date: nf.date, type: nf.type, tickGoing: nf.tickGoing }); if (r.ok) { setCur(r.id ?? null); setTab("t"); setNf({ mode: "discord", ce: "", title: "", date: today(), type: "main_op", tickGoing: true }); } }}
              className="border border-gold bg-gold px-4 py-2 text-[11px] font-bold tracking-[1.5px] text-black disabled:opacity-40">CREATE</button>
          </div>
        </section>
      ) : <>
        <div className="mb-3 grid grid-cols-5 gap-2">
          {([[`${all}%`, "UNIT RATE (ALL TIME)", rateC(all)], [ml.length, "OPS THIS MONTH", "#fff"], [mRate == null ? "—" : `${mRate}%`, "THIS MONTH", rateC(mRate)],
            [roll.filter((u) => u.attendance >= 3).length, "MEMBERS AT 3/3", "#fff"], [open, "NOT LOCKED", open ? "#f59e0b" : "#fff"]] as [string | number, string, string][]).map(([v, l, c]) => (
            <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>
          ))}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "300px 1fr" }}>
          <aside className="self-start border border-cyan/15 bg-[#0b1016]">
            <div className="p-2"><input value={eq} onChange={(x) => setEq(x.target.value)} placeholder="Search ops…" aria-label="Search events" className={`${inp} w-full`} /></div>
            <div className="max-h-[calc(100vh-330px)] overflow-auto">
              {(() => { let last = ""; return d.events.filter((x) => x.title.toLowerCase().includes(eq.toLowerCase())).map((x) => {
                const mon = fmtD(x.date, { month: "long", year: "numeric" }); const showMon = mon !== last; last = mon;
                const [tl, tc] = TYPE[x.type] ?? [x.type.toUpperCase(), "#9fb3c4"];
                const pr = roll.length ? Math.round((x.attendees.length / roll.length) * 100) : 0;
                return (<div key={x.id}>
                  {showMon && <div className="px-3 pb-1 pt-2.5 text-[10px] tracking-[2px] text-dim">{mon}</div>}
                  <button type="button" onClick={() => { setCur(x.id); setHead(null); }} aria-current={x.id === cur}
                    className={`flex w-full items-center gap-2 border-l-[3px] px-3 py-2 text-left hover:bg-cyan/5 ${x.id === cur ? "border-cyan bg-cyan/10" : "border-transparent"}`}>
                    <span className="min-w-0 flex-1"><b className="block truncate text-[13px] text-white">{x.title}</b>
                      <small className="text-[10.5px] text-dim">{fmtD(x.date, { weekday: "short", day: "2-digit" })} · <span style={{ color: tc }}>{tl}</span>{x.linked ? ` · ${x.linked.signups.filter((s) => s.going).length} SIGNED UP` : ""}</small></span>
                    <small className="text-[11px]" style={{ color: x.locked ? rateC(pr) : "#22e07a" }}>{x.locked ? `${pr}%` : "OPEN"}</small>
                  </button></div>); }); })()}
              {!d.events.length && <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NO EVENTS YET</p>}
            </div>
          </aside>
          <section className="min-w-0 border border-cyan/15 bg-[#0b1016]">
            {!e ? <p className="py-16 text-center text-[11px] tracking-[2px] text-dimmer">PICK AN EVENT, OR ＋ NEW EVENT TO START ROLL CALL</p> : (() => {
              const [tl, tc] = TYPE[e.type] ?? [e.type.toUpperCase(), "#9fb3c4"];
              const cnt = { p: 0, e: 0, a: 0 };
              roll.forEach((u) => cnt[stateOf(e, u.id)]++);
              const turn = roll.length ? Math.round((cnt.p / roll.length) * 100) : 0;
              const su = new Map((e.linked?.signups ?? []).map((s) => [s.uid, s]));
              const going = new Set((e.linked?.signups ?? []).filter((s) => s.going).map((s) => s.uid));
              const prior = d.events.filter((x) => x.locked && x.id !== e.id && x.date <= e.date).slice(0, 3);
              const shown = roll.filter((u) => { if (!memberName(u).toLowerCase().includes(q.toLowerCase())) return false; const s = stateOf(e, u.id); return flt === "ALL" || (flt === "P" && s === "p") || (flt === "A" && s !== "p") || (flt === "S" && going.has(u.id)); });
              let n = 0;
              return (<>
                <div className="flex items-start gap-2 border-b border-cyan/15 px-4 py-3">
                  {head && !e.locked ? (
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <div><label className="mb-1 block text-[10px] tracking-[2px] text-dim">TITLE</label><input value={head.title} maxLength={120} onChange={(x) => setHead({ ...head, title: x.target.value })} className={`${inp} w-full`} /></div>
                      <div><label className="mb-1 block text-[10px] tracking-[2px] text-dim">DATE</label><input type="date" value={head.date} onChange={(x) => setHead({ ...head, date: x.target.value })} className={`${inp} w-full`} /></div>
                      <div><label className="mb-1 block text-[10px] tracking-[2px] text-dim">TYPE</label><select value={head.type} onChange={(x) => setHead({ ...head, type: x.target.value })} className={`${inp} w-full`}>{Object.entries(TYPE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
                      <div className="col-span-3 flex justify-end gap-2"><button type="button" onClick={() => setHead(null)} className="border border-cyan/25 px-3 py-1.5 text-[11px] text-dim">CANCEL</button>
                        <button type="button" disabled={busy} onClick={async () => { const r = await run({ action: "edit", id: e.id, ...head }); if (r.ok) setHead(null); }} className="border border-gold bg-gold px-3 py-1.5 text-[11px] font-bold text-black">SAVE</button></div>
                    </div>
                  ) : (<>
                    <div className="min-w-0 flex-1"><h2 className="m-0 font-head text-[20px] font-bold tracking-[1px] text-white">{e.title}</h2>
                      <span className="text-[10.5px] tracking-[1px] text-dim">{fmtD(e.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} · <span style={{ color: tc }}>{tl}</span>{e.createdBy ? ` · CREATED BY ${e.createdBy.toUpperCase()}` : ""}{e.linked && <span className="text-ok"> · LINKED TO DISCORD EVENT ✓</span>}</span></div>
                    {!e.locked && <button type="button" onClick={() => setHead({ title: e.title, date: e.date, type: e.type })} className="border border-cyan/25 px-2.5 py-1.5 text-[10.5px] tracking-[1.5px] text-white hover:border-cyan">✎ RENAME / DATE</button>}
                    <button type="button" disabled={e.locked || busy} title={e.locked ? "Unlock first" : undefined} onClick={async () => { if (await askBox(`DELETE EVENT?\n\n${e.title}\n\nThe roll call for this event is removed. Stats are recounted.`)) void run({ action: "delete", id: e.id }).then((r) => r.ok && setCur(null)); }}
                      className="border border-bad/50 px-2.5 py-1.5 text-[10.5px] tracking-[1.5px] text-bad disabled:opacity-30">🗑 DELETE</button>
                  </>)}
                </div>
                <div className="grid grid-cols-4 border-b border-cyan/15 text-center">
                  {([[cnt.p, "✓ PRESENT", "#22e07a"], [cnt.e, "E EXCUSED", "#f59e0b"], [cnt.a, "– ABSENT", "#fff"], [`${turn}%`, "TURNOUT", rateC(turn)]] as [string | number, string, string][]).map(([v, l, c]) => (
                    <div key={l} className="border-r border-cyan/10 py-2.5 last:border-0"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
                  <input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Find member…" aria-label="Find member" className={`${inp} w-[180px] py-1.5`} />
                  {([["ALL", `ALL ${roll.length}`], ["P", "PRESENT"], ["A", "ABSENT"], ...(e.linked ? [["S", `SIGNED UP ${going.size}`]] : [])] as [typeof flt, string][]).map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={flt === k} onClick={() => setFlt(k)} className={chip(flt === k)} style={k === "S" && flt !== k ? { color: "#a78bfa" } : undefined}>{l}</button>))}
                  <div className="flex-1" />
                  {e.linked && <button type="button" disabled={e.locked || busy} onClick={() => void run({ action: "tickgoing", id: e.id })} className="border border-cyan/25 px-2.5 py-1.5 text-[10.5px] tracking-[1.5px] text-white disabled:opacity-30">✓ TICK ALL SIGNED UP ({going.size})</button>}
                  <button type="button" disabled={e.locked || busy} onClick={async () => { if (await askBox("Clear everyone back to absent?")) void run({ action: "clear", id: e.id }); }} className="border border-cyan/25 px-2.5 py-1.5 text-[10.5px] tracking-[1.5px] text-white disabled:opacity-30">CLEAR ALL</button>
                </div>
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr className="text-left text-[10px] tracking-[2px] text-cyan">{["MEMBER", "SQUAD", "DISCORD SIGN-UP", "LAST 3 OPS", "THIS OP"].map((h) => <th key={h} className="border-y border-cyan/15 px-3 py-2 font-normal">{h}</th>)}</tr></thead>
                  <tbody>
                    {PLATOONS.map((pl) => { const g = shown.filter((u) => u.platoon === pl); if (!g.length) return null; return [
                      <tr key={`g${pl}`}><td colSpan={5} className="bg-black/30 px-3 py-1.5 font-head text-[12px] font-bold tracking-[2px] text-white">{(pl || "NO PLATOON").toUpperCase()} <small className="ml-2 font-mono text-[10px] font-normal text-dim">{g.filter((u) => stateOf(e, u.id) === "p").length} / {g.length} PRESENT</small></td></tr>,
                      ...g.map((u) => { const s = stateOf(e, u.id), r = rateOf(u), sg = su.get(u.id);
                        const [bl, bc] = s === "p" ? ["✓ PRESENT", "#22e07a"] : s === "e" ? ["E EXCUSED", "#f59e0b"] : ["– ABSENT", "#7d8a99"];
                        return (
                          <tr key={u.id} className="rise rrow" style={{ animationDelay: `${Math.min(n++, 40) * 0.012}s` }}>
                            <td className="border-b border-cyan/10 px-3 py-1.5"><b className="text-white">{memberName(u)}</b> {pgOf(u) && <span className="ml-1 border border-cyan/30 px-1 text-[9.5px] text-cyan">{pgOf(u)}</span>} <span className="ml-1 text-[11px]" style={{ color: rateC(r) }}>{r == null ? "—" : `${r}%`}</span></td>
                            <td className="border-b border-cyan/10 px-3 text-[11px] text-dim">{u.squad || "—"}</td>
                            <td className="border-b border-cyan/10 px-3 text-[12px]">{sg ? <span style={{ color: sg.going ? "#a78bfa" : "#7d8a99" }}>{sg.label}{sg.waiting ? " ⏳" : ""}</span> : <span className="text-dimmer">—</span>}</td>
                            <td className="border-b border-cyan/10 px-3 text-[12px]">{prior.length ? prior.map((x, i) => { const t = stateOf(x, u.id); return <span key={i} className="mr-1.5" style={{ color: t === "p" ? "#22e07a" : t === "e" ? "#f59e0b" : "#4b5765" }}>{t === "p" ? "✓" : t === "e" ? "E" : "–"}</span>; }) : <span className="text-dimmer">—</span>}</td>
                            <td className="border-b border-cyan/10 px-3 py-1">
                              <button type="button" disabled={e.locked} onClick={() => cycle(e, u.id)} aria-label={`${memberName(u)}: ${bl} — click to change`} className="min-w-[96px] border px-2 py-1 text-[10.5px] tracking-[1.5px] disabled:opacity-60" style={{ color: bc, borderColor: bc }}>{bl}</button>
                              {s === "e" && <input defaultValue={e.excusedReasons[u.id] ?? ""} disabled={e.locked} maxLength={60} placeholder="Reason (optional)" aria-label={`Reason for ${memberName(u)}`}
                                onBlur={(x) => { if (x.target.value !== (e.excusedReasons[u.id] ?? "")) void run({ action: "reason", id: e.id, uid: u.id, reason: x.target.value }, true); }} className="ml-2 w-[160px] border border-cyan/20 bg-black/40 px-2 py-1 text-[11px] text-white" />}
                            </td>
                          </tr>); })]; })}
                    {!shown.length && <tr><td colSpan={5} className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NOBODY MATCHES</td></tr>}
                  </tbody>
                </table>
                <p className="px-4 py-2 text-[11px] text-dim">Click THIS OP to cycle ✓ → E → –. Excused can have a short reason. Changes save as you go until you LOCK.</p>
                <div className={`flex items-center gap-3 border-t px-4 py-3 text-[11px] ${e.locked ? "border-ok/40 bg-ok/5" : "border-gold/40 bg-gold/5"}`}>
                  {!d.canLock ? <span className="text-dim">🔒 LOCK / UNLOCK: STAFF NCO AND ABOVE</span>
                    : e.locked ? <><span className="flex-1 text-ok">🔒 LOCKED — PERMANENT RECORD, STATS COUNTED{e.lockedBy ? ` · BY ${e.lockedBy.toUpperCase()}` : ""}. UNLOCK TO FIX, THEN LOCK AGAIN.</span>
                        <button type="button" disabled={busy} onClick={async () => { if (await askBox(`UNLOCK THIS EVENT?\n\n${e.title}\n\nYou can then correct it. Lock it again afterwards so stats are recounted.`)) void run({ action: "unlock", id: e.id }); }} className="border border-cyan/40 px-3 py-2 tracking-[1.5px] text-white">🔓 UNLOCK TO CORRECT</button></>
                    : <><span className="flex-1 text-[#c6d0da]">🔒 LOCK recounts everyone's stats from all locked ops: {cnt.p} present → +1 op attended · everyone → +1 op eligible · ATT this month updates · unlock any time to fix</span>
                        <button type="button" disabled={busy} onClick={async () => { if (await askBox(`LOCK ATTENDANCE?\n\n${e.title}\n\n${e.attendees.length} present. This finalises the event and recounts every member's stats.`)) void run({ action: "lock", id: e.id }); }} className="border border-gold bg-gold px-4 py-2 font-bold tracking-[1.5px] text-black">{busy ? "◷ WORKING…" : "🔒 LOCK EVENT"}</button></>}
                </div>
              </>);
            })()}
          </section>
        </div>
      </>}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
