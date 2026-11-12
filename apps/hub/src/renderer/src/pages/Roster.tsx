import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Roster as RosterData, RosterRow } from "../../../preload/api";
import { FileWindow, memberName, rankOrder, short } from "./Personnel";

/**
 * BATTALION ROSTER in the app — same as the Terminal's battalion-roster.js:
 * 7 stats · find / platoon / sort / group · monthly-reset banner · platoon groups · RANK NAME PAYGRADE SQUAD ATT(MONTH) PT ATTENDANCE RIBBONS MEDALS ⋯
 * Pip = +1 attendance · ＋ = +1 PT (at 3/3 it also resets ATT) · bulk Award Medal / Award Ribbon. Every rule is checked again on the server.
 * App extras: rows slide in, hover glow, live update. Click a name → Personnel File inside the app.
 */
const PLATOON_ORDER = ["Command", "1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot", "Awaiting BCT", "Reserves"];
const plOrder = (p: string) => { const i = PLATOON_ORDER.indexOf(p); return i < 0 ? 99 : i; };
const pgOf = (r: RosterRow) => (/^([OE]\d+)/.exec(r.rank)?.[1]) ?? (r.rank === "Reservist" ? "RES" : "—");
const pgNum = (r: RosterRow) => { const m = /^([OE])(\d+)/.exec(pgOf(r)); return m ? (m[1] === "O" ? 100 : 0) + Number(m[2]) : -1; };
const rateOf = (r: RosterRow) => (r.opsEligible ? Math.round((r.opsAttended / r.opsEligible) * 100) : null);
const rc = (p: number | null) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
const nm = (r: RosterRow) => memberName(r);
const SORTS: Record<string, [string, (r: RosterRow) => number | string, number]> = {
  rank: ["Rank (high → low)", (r) => rankOrder(r.rank), 1], rankup: ["Rank (low → high)", (r) => rankOrder(r.rank), -1],
  pg: ["Paygrade (high → low)", (r) => -pgNum(r), 1], pgup: ["Paygrade (low → high)", (r) => -pgNum(r), -1],
  name: ["Name A–Z", (r) => `${r.lastName} ${r.firstName}`.toLowerCase(), 1],
  rate: ["Attendance % (high → low)", (r) => -(rateOf(r) ?? -1), 1], att: ["ATT this month", (r) => -r.attendance, 1],
  pt: ["PT (most first)", (r) => -r.promotionTracker, 1], rib: ["Ribbons (most first)", (r) => -r.ribbons.length, 1],
  med: ["Medals (most first)", (r) => -r.medals, 1], squad: ["Squad", (r) => (r.squad || "~").toLowerCase(), 1],
};
const PIP = ["", "#ff4d4d", "#f59e0b", "#22e07a"];
const RIB_C: Record<string, string> = { "Training Ribbon": "#2DD4BF", "Commendation Ribbon": "#F59E0B", "Ribbon C": "#A78BFA" };
const monLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y!, mo! - 1, 15)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase(); };
const shiftMonth = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y!, mo! - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export function Roster(p: { me: string }) {
  const [d, setD] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pl, setPl] = useState("");
  const [sortK, setSortK] = useState("rank");
  const [group, setGroup] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [award, setAward] = useState<{ kind: "medal" | "ribbon"; ids: string[] } | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    const r = await window.cn.hub.roster();
    if ("error" in r) setError(r.error); else { setD(r); setError(null); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "users" || x === "settings") { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const c = () => setMenu(null); addEventListener("click", c); return () => removeEventListener("click", c); }, []);

  const act = async (action: "pip" | "pt", r: RosterRow) => {
    if (action === "pt" && r.attendance < 3 && !await askBox(`GIVE +1 PT?\n\n${nm(r)} is ${r.attendance}/3 this month — this is a manual award (ATT is not reset).`)) return;
    setBusy(r.id);
    const res = await window.cn.hub.rosterAction({ action, id: r.id, expectAtt: r.attendance });
    setBusy(null);
    setToast(res.error ? [res.error, false] : [String(res.msg ?? "Done").toUpperCase(), true]);
    void load();
  };

  const list = useMemo(() => {
    if (!d) return [];
    const [, key, dir] = SORTS[sortK] ?? SORTS.rank!;
    return d.rows
      .filter((r) => (!pl || r.platoon === pl) && nm(r).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => { const A = key(a), B = key(b); return A !== B ? (A > B ? 1 : -1) * dir : rankOrder(a.rank) - rankOrder(b.rank) || nm(a).localeCompare(nm(b)); });
  }, [d, q, pl, sortK]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const canEdit = d.canEdit;
  const actv = d.rows.filter((r) => r.platoon !== "Reserves");
  const tE = actv.reduce((s, r) => s + r.opsEligible, 0);
  const rate = tE ? Math.round((actv.reduce((s, r) => s + r.opsAttended, 0) / tE) * 100) : 0;
  const plats = [...new Set(d.rows.map((r) => r.platoon))].sort((a, b) => plOrder(a) - plOrder(b));
  let rowN = 0;

  const table = (g: RosterRow[]) => (
    <table className="w-full border-collapse border border-cyan/15 text-[13px]">
      <thead><tr className="text-left text-[10px] tracking-[2px] text-cyan">
        {["RANK", "NAME", "PAYGRADE", "SQUAD", ...(group ? [] : ["PLATOON"]), "ATT (MONTH)", "PT", "ATTENDANCE", "RIBBONS", "MEDALS", ""].map((h) => <th key={h} className="border-b border-cyan/15 px-2.5 py-2 font-normal">{h}</th>)}
      </tr></thead>
      <tbody>
        {g.map((r) => {
          const pg = pgOf(r), pr = rateOf(r), att = r.attendance;
          return (
            <tr key={r.id} className="rise rrow" style={{ animationDelay: `${Math.min(rowN++, 40) * 0.015}s` }}>
              <td className="border-b border-cyan/10 px-2.5 py-1.5 text-[11px] text-dim">{short(r.rank) || "—"}</td>
              <td className="border-b border-cyan/10 px-2.5"><button type="button" onClick={() => setFile(r.id)} className="font-head text-[14px] font-bold tracking-[.5px] text-white hover:text-cyan">{nm(r).replace(/^\S+\s/, "")}</button></td>
              <td className="border-b border-cyan/10 px-2.5"><span title={r.rank} className="inline-block min-w-[38px] border px-1.5 py-px text-center text-[11px] font-bold"
                style={pg[0] === "O" ? { color: "#f59e0b", borderColor: "#f59e0b80", background: "#f59e0b0f" } : pg[0] === "E" ? { color: "#00D9FF", borderColor: "#00D9FF66", background: "#00D9FF0d" } : { color: "#8a9aa6", borderColor: "#3b4a5a" }}>{pg}</span></td>
              <td className="border-b border-cyan/10 px-2.5 text-[11px] text-dim">{r.squad || "—"}</td>
              {!group && <td className="border-b border-cyan/10 px-2.5 text-[11px] text-[#9fb3c4]">{r.platoon || "—"}</td>}
              <td className="border-b border-cyan/10 px-2.5"><span className="flex items-center gap-1">
                {[1, 2, 3].map((k) => k === att + 1 && canEdit
                  ? <button key={k} type="button" disabled={busy === r.id} onClick={() => void act("pip", r)} title="Add attendance (+1)" aria-label={`Add attendance for ${nm(r)}`} className="h-3.5 w-3.5 rounded-full border border-dashed border-cyan hover:bg-cyan/25 disabled:opacity-40" />
                  : <span key={k} className="inline-block h-3.5 w-3.5 rounded-full border" style={att >= k ? { background: PIP[att], borderColor: PIP[att] } : { borderColor: "rgb(var(--accent-rgb) / .3)" }} />)}
                <span className="ml-1 text-[10px] text-dim">{att}/3</span>
              </span></td>
              <td className="border-b border-cyan/10 px-2.5"><span className="inline-flex items-center gap-1.5"><b className="font-head text-[15px] text-cyan">{r.promotionTracker}</b>
                {canEdit && <button type="button" disabled={busy === r.id} onClick={() => void act("pt", r)} title={att >= 3 ? "Award +1 PT and reset ATT (3/3)" : "Give +1 PT"} aria-label={`Give PT to ${nm(r)}`}
                  className={`grid h-5 w-5 place-items-center border text-[12px] disabled:opacity-40 ${att >= 3 ? "border-ok bg-ok text-black" : "border-cyan/40 text-cyan hover:border-cyan"}`}>＋</button>}</span></td>
              <td className="border-b border-cyan/10 px-2.5 text-[12px]" style={{ color: rc(pr) }}>{pr == null ? "—" : `${pr}%`} <small className="text-dim">({r.opsAttended}/{r.opsEligible})</small></td>
              <td className="border-b border-cyan/10 px-2.5 text-[12px]" style={{ color: r.ribbons.length ? "#2dd4bf" : "#3b4a5a" }}>▬ {r.ribbons.length}</td>
              <td className="border-b border-cyan/10 px-2.5 text-[12px]" style={{ color: r.medals ? "#a78bfa" : "#3b4a5a" }}>★ {r.medals}</td>
              <td className="border-b border-cyan/10 px-2.5">{canEdit && <button type="button" aria-label={`Actions for ${nm(r)}`} onClick={(e) => { e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); setMenu({ id: r.id, x: Math.min(b.right - 240, innerWidth - 250), y: b.bottom + 4 }); }} className="px-2 text-[14px] text-dim hover:text-cyan">⋯</button>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Battalion Roster">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">BATTALION ROSTER</h1>
      <p className="mb-3 mt-1 text-[11px] tracking-[2px] text-dim">UNIT STRENGTH · MONTHLY ATTENDANCE · PROMOTION TRACKING · NCO+</p>
      <div className="mb-3 grid grid-cols-7 gap-2">
        {([[actv.filter((r) => r.platoon !== "Awaiting BCT").length, "ACTIVE", "#22e07a"], [d.rows.reduce((s, r) => s + r.promotionTracker, 0), "PT (TOTAL)", "#00D9FF"],
          [d.rows.reduce((s, r) => s + r.ribbons.length, 0), "RIBBONS", "#2dd4bf"], [d.rows.filter((r) => r.platoon === "Reserves").length, "RESERVES", "#f59e0b"],
          [d.rows.filter((r) => r.platoon === "Awaiting BCT").length, "AWAITING BCT", "#fff"], [`${rate}%`, "ATTENDANCE", rc(rate)],
          [actv.filter((r) => r.attendance >= 3).length, "3/3 THIS MONTH", "#22e07a"]] as [number | string, string, string][]).map(([v, l, c]) => (
          <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="FIND MARINE…" aria-label="Find marine" className="w-[200px] border border-cyan/25 bg-black/45 px-3 py-2 text-[12px] text-white outline-none focus:border-cyan" />
        <select value={pl} onChange={(e) => setPl(e.target.value)} aria-label="Platoon" className="border border-cyan/25 bg-[#05080b] px-2 py-2 text-[12px] text-white">
          <option value="">ALL PLATOONS</option>{plats.map((x) => <option key={x} value={x}>{x || "No platoon"}</option>)}
        </select>
        <select value={sortK} onChange={(e) => setSortK(e.target.value)} aria-label="Sort" className="border border-cyan/25 bg-[#05080b] px-2 py-2 text-[12px] text-white">
          {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>SORT: {l.toUpperCase()}</option>)}
        </select>
        <button type="button" aria-pressed={group} onClick={() => setGroup(!group)} className={`border px-3 py-2 text-[11px] tracking-[1.5px] ${group ? "border-cyan text-cyan" : "border-cyan/25 text-dim"}`}>{group ? "GROUP: PLATOON ✓" : "GROUP: OFF"}</button>
        <div className="flex-1" />
        {canEdit && <>
          <button type="button" onClick={() => setAward({ kind: "medal", ids: [] })} className="border border-[#C9A227] bg-[#C9A227] px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">★ AWARD MEDAL</button>
          <button type="button" onClick={() => setAward({ kind: "ribbon", ids: [] })} className="border border-[#2dd4bf88] px-3 py-2 text-[11px] tracking-[1.5px] text-[#2dd4bf]">▬ AWARD RIBBON</button>
        </>}
      </div>
      <Banner m={d.meta} />
      {group
        ? [...new Set(list.map((r) => r.platoon))].sort((a, b) => plOrder(a) - plOrder(b)).map((x) => {
            const g = list.filter((r) => r.platoon === x);
            const gE = g.reduce((s, r) => s + r.opsEligible, 0), gr = gE ? Math.round((g.reduce((s, r) => s + r.opsAttended, 0) / gE) * 100) : null;
            const isOpen = !closed.has(x) || !!q;
            return (
              <section key={x || "none"} className="mb-2.5">
                <button type="button" aria-expanded={isOpen} onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(x)) n.delete(x); else n.add(x); return n; })}
                  className="flex w-full items-center gap-2.5 border border-cyan/15 bg-[#0b1016] px-3 py-2 text-left font-head text-[14px] font-bold tracking-[2px] text-white">
                  <span className="text-cyan" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>{(x || "NO PLATOON").toUpperCase()}
                  <small className="ml-auto font-mono text-[10.5px] font-normal tracking-[1px] text-dim">{g.length} MEMBER{g.length === 1 ? "" : "S"}{gr != null && <> · <span style={{ color: rc(gr) }}>{gr}%</span></>}</small>
                </button>
                {isOpen && table(g)}
              </section>
            );
          })
        : list.length ? table(list) : null}
      {!list.length && <p className="py-10 text-center text-[12px] tracking-[2px] text-dimmer">NOBODY MATCHES</p>}
      <p className="mt-2 text-[9.5px] tracking-[1.5px] text-dim">CLICK THE DASHED PIP TO ADD ATTENDANCE · ＋ GIVES PT (AT 3/3 IT ALSO RESETS ATT) · CLICK A NAME FOR THE PERSONNEL FILE · ⋯ ALL ACTIONS</p>

      {menu && (() => {
        const r = d.rows.find((x) => x.id === menu.id);
        if (!r) return null;
        const items: [string, string, string | undefined, () => void][] = [
          ["file", "✎ Open personnel file", undefined, () => setFile(r.id)],
          ["medal", "★ Award medal", "#C9A227", () => setAward({ kind: "medal", ids: [r.id] })],
          ["ribbon", "▬ Award ribbon", "#2dd4bf", () => setAward({ kind: "ribbon", ids: [r.id] })],
        ];
        return (
          <div role="menu" onClick={(e) => e.stopPropagation()} className="fixed z-40 w-[240px] border border-cyan/40 bg-panel py-1 shadow-[0_10px_30px_rgba(0,0,0,.6)]" style={{ left: Math.max(8, menu.x), top: Math.min(menu.y, innerHeight - 200) }}>
            <div className="border-b border-cyan/15 px-3 py-1.5 text-[11px] tracking-[1.5px] text-dim">{nm(r)}</div>
            {items.map(([k, l, c, f]) => <button key={k} role="menuitem" type="button" onClick={() => { setMenu(null); f(); }} className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-cyan/10" style={{ color: c ?? "#fff" }}>{l}</button>)}
            <div className="px-3 py-1.5 text-[10px] text-dimmer">Promote · Transfer · Warn · Stats → in the personnel file</div>
          </div>
        );
      })()}
      {file && <FileWindow id={file} me={p.me} onClose={() => { setFile(null); void load(); }} />}
      {award && <AwardWindow d={d} kind={award.kind} pre={award.ids} onClose={() => setAward(null)} onDone={(m) => { setAward(null); setToast([m.toUpperCase(), true]); void load(); }} />}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function Banner({ m }: { m: RosterData["meta"] }) {
  const cur = m.month, next = shiftMonth(cur, 1), last = m.lastAttendanceReset;
  const box = "mb-3 border px-3 py-2.5 text-[11.5px] text-[#c6d0da]";
  if (m.running?.startedAt && Date.now() - Date.parse(m.running.startedAt) < 15 * 60000)
    return <div role="status" className={box} style={{ borderColor: "#00D9FF66", background: "#00D9FF0d" }}><b className="font-normal text-cyan">◷ RESET RUNNING…</b> — by {m.running.by ?? "?"} · {m.running.total ? `${m.running.done} / ${m.running.total} members done` : "starting"}</div>;
  const [y, mo] = next.split("-").map(Number);
  const days = Math.max(0, Math.ceil((Date.UTC(y!, mo! - 1, 1) - Date.now()) / 864e5));
  const at = m.lastResetAt ? new Date(m.lastResetAt) : null;
  const when = at ? `${at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }).toUpperCase()} ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} by ${m.lastResetBy || "—"}` : "done";
  if (last >= next) return <div className={box} style={{ borderColor: "#22e07a73", background: "#22e07a0d" }}><b className="font-normal text-ok">✓ {monLabel(next)} RESET DONE EARLY</b> — {when} · Cortana will skip it on the 1st.</div>;
  if (last === cur)
    return <div className={box} style={{ borderColor: "#22e07a73", background: "#22e07a0d" }}><b className="font-normal text-ok">✓ {monLabel(cur)} RESET DONE</b> — {when}{m.lastResetPromoted != null ? ` · ${m.lastResetPromoted} got +1 PT` : ""}<br /><small className="text-dim">Next reset: 01 {monLabel(next)} (in {days} day{days === 1 ? "" : "s"}) — Cortana runs it at 00:00 UK time.</small></div>;
  return <div role="alert" className={box} style={{ borderColor: "#ff4d4d", background: "#ff4d4d14" }}><b className="font-normal text-bad">⚠ {monLabel(cur)} RESET HAS NOT RUN</b> — Cortana may have been offline at midnight. Run the backup reset from the Terminal roster.</div>;
}

function AwardWindow(p: { d: RosterData; kind: "medal" | "ribbon"; pre: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const { d, kind } = p;
  const [picked, setPicked] = useState<Set<string>>(new Set(p.pre));
  const [pq, setPq] = useState("");
  const [pp, setPp] = useState("");
  const [sel, setSel] = useState(0);
  const [title, setTitle] = useState(kind === "medal" ? d.medals[0]?.[1] ?? "" : "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const plats = [...new Set(d.rows.map((r) => r.platoon))].filter(Boolean).sort((a, b) => plOrder(a) - plOrder(b));
  const shown = d.rows.filter((r) => (!pp || r.platoon === pp) && nm(r).toLowerCase().includes(pq.toLowerCase())).sort((a, b) => nm(a).localeCompare(nm(b)));
  const rib = d.ribbons[sel] ?? "";
  const color = kind === "medal" ? "#C9A227" : "#2dd4bf";
  const go = async () => {
    setBusy(true); setErr(null);
    const r = await window.cn.hub.rosterAction({ action: "award", kind, ids: [...picked], title: kind === "medal" ? title : rib, img: kind === "medal" ? d.medals[sel]?.[0] : undefined, note, date, notify });
    setBusy(false);
    if (r.error) setErr(r.error); else p.onDone(r.msg ?? "Awarded");
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-6" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label={kind === "medal" ? "Award medal" : "Award ribbon"} className="rise flex max-h-[92vh] w-[min(980px,96vw)] flex-col border bg-panel" style={{ borderColor: color + "8c" }}>
        <div className="flex items-center border-b border-cyan/20 px-4 py-3">
          <div><b className="font-head text-[15px] tracking-[3px]" style={{ color }}>{kind === "medal" ? "★ AWARD MEDAL" : "▬ AWARD RIBBON"}</b>
            <div className="text-[10px] tracking-[1.5px] text-dim">{kind === "medal" ? "PICK THE MEDAL, THEN WHO GETS IT" : "RIBBONS STACK — EACH AWARD ADDS ONE (×2, ×3 …)"}</div></div>
          <button type="button" onClick={p.onClose} aria-label="Close" className="ml-auto px-2 text-dim hover:text-white">✕</button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto p-4">
          <div>
            <span className="mb-1.5 block text-[10px] tracking-[2px] text-[#aeb9c4]">1 · {kind === "medal" ? "MEDAL" : "RIBBON"}</span>
            <div className="grid grid-cols-2 gap-1.5">
              {kind === "medal"
                ? d.medals.map(([, l], i) => <button key={l} type="button" aria-pressed={i === sel} onClick={() => { setSel(i); setTitle(l); }} className={`border px-2 py-2 text-left text-[12px] ${i === sel ? "border-[#C9A227] bg-[#C9A22714] text-[#e9c46a]" : "border-cyan/15 text-white"}`}>★ {l}</button>)
                : d.ribbons.map((n, i) => <button key={n} type="button" aria-pressed={i === sel} onClick={() => setSel(i)} className={`border px-2 py-2 text-left text-[12px] ${i === sel ? "border-[#2dd4bf] bg-[#2dd4bf14]" : "border-cyan/15"}`}>
                    <span className="mb-1 block h-2.5 w-12" style={{ background: `linear-gradient(90deg,${RIB_C[n] ?? "#2dd4bf"} 0 30%,#0008 30% 38%,#fff 38% 46%,#0008 46% 54%,#fff 54% 62%,#0008 62% 70%,${RIB_C[n] ?? "#2dd4bf"} 70%)` }} />
                    <span className="text-white">{n}</span><small className="block text-dim">{d.rows.filter((r) => r.ribbons.includes(n)).length} HOLDERS</small></button>)}
            </div>
            {kind === "medal" && <><label htmlFor="awT" className="mb-1.5 mt-3 block text-[10px] tracking-[2px] text-[#aeb9c4]">2 · AWARD TITLE</label>
              <input id="awT" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="w-full border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan" /></>}
            <label htmlFor="awN" className="mb-1.5 mt-3 block text-[10px] tracking-[2px] text-[#aeb9c4]">{kind === "medal" ? "3" : "2"} · CITATION <small className="text-dimmer">(OPTIONAL — SHOWN ON THEIR RECORD)</small></label>
            <textarea id="awN" value={note} maxLength={400} rows={3} onChange={(e) => setNote(e.target.value)} placeholder={kind === "medal" ? "e.g. For conspicuous gallantry during Operation Iron Veil" : "e.g. Completed CLS course"} className="w-full border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan" />
            <label htmlFor="awD" className="mb-1.5 mt-3 block text-[10px] tracking-[2px] text-[#aeb9c4]">DATE</label>
            <input id="awD" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[13px] text-white [color-scheme:dark]" />
          </div>
          <div className="flex min-h-0 flex-col">
            <span className="mb-1.5 block text-[10px] tracking-[2px] text-[#aeb9c4]">WHO · {picked.size} PICKED</span>
            <div className="mb-1.5 flex flex-wrap gap-1">
              <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="SEARCH…" aria-label="Search recipients" className="w-[150px] border border-cyan/25 bg-black/45 px-2 py-1 text-[11px] text-white" />
              {["", ...plats].map((x) => <button key={x || "all"} type="button" onClick={() => setPp(x)} className={`border px-2 py-1 text-[10px] tracking-[1px] ${pp === x ? "border-cyan text-cyan" : "border-cyan/15 text-dim"}`}>{x ? x.replace("Platoon", "PLT").toUpperCase() : "ALL"}</button>)}
            </div>
            <div className="mb-1 flex justify-between text-[10px] text-dim"><span>{shown.length} SHOWN</span><span>
              <button type="button" className="text-cyan" onClick={() => setPicked(new Set([...picked, ...shown.map((r) => r.id)]))}>SELECT SHOWN</button> · <button type="button" className="text-cyan" onClick={() => setPicked(new Set())}>CLEAR</button></span></div>
            <div className="min-h-[220px] flex-1 overflow-auto border border-cyan/15">
              {shown.map((r) => { const h = kind === "ribbon" ? r.ribbons.filter((x) => x === rib).length : 0; return (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 border-b border-cyan/10 px-2.5 py-1.5 text-[12.5px] hover:bg-cyan/5">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(r.id); else n.delete(r.id); setPicked(n); }} className="accent-cyan" />
                  <span className="text-white">{nm(r)}</span>{h > 0 && <span className="text-[10.5px] text-[#2dd4bf]">×{h} → ×{h + 1}</span>}<span className="ml-auto text-[10.5px] text-dimmer">{r.platoon}</span>
                </label>); })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-cyan/20 px-4 py-3">
          <label className="flex items-center gap-1.5 text-[11px] text-dim"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-cyan" /> NOTIFY THEM</label>
          {err && <span className="text-[12px] text-bad">⚠ {err}</span>}
          <div className="flex-1" />
          <button type="button" onClick={p.onClose} className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-dim">CANCEL</button>
          <button type="button" disabled={busy || !picked.size || (kind === "medal" && !title.trim())} onClick={() => void go()} className="border px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black disabled:opacity-40" style={{ background: color, borderColor: color }}>
            {busy ? "AWARDING…" : `${kind === "medal" ? "★" : "▬"} AWARD TO ${picked.size}`}</button>
        </div>
      </div>
    </div>
  );
}
