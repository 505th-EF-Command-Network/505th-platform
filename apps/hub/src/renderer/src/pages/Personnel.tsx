import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEntry, MemberFile, MemberTile } from "../../../preload/api";
import { ActionWindow, type Action } from "./MemberActions";

/**
 * PERSONNEL FILES in the app (same design as the approved Terminal Personnel Files v2/v3):
 * tile grid (photo, rank badge, status, role, platoon, attendance), tabs, search, sort → file window
 * (photo + summary · Details · Service Record timeline · Attendance) + edit windows (Promote, Transfer, Warn, Medal, Stats,
 * edit / delete record entries) — same rules as the Terminal, checked again on the server.
 */
const TABS: [string, string][] = [
  ["ALL", "ALL"], ["Command", "COMMAND"], ["1st Platoon", "1ST PLT"], ["2nd Platoon", "2ND PLT"], ["3rd Platoon", "3RD PLT"],
  ["Force Recon", "FORCE RECON"], ["Corpsmen", "CORPSMEN"], ["Pilot", "PILOT"], ["Awaiting BCT", "AWAITING BCT"],
  ["Reserves", "RESERVES"], ["Inactive", "INACTIVE"], ["Retired", "RETIRED VETERAN"],
];
const ROLE: Record<string, [string, string]> = {
  commander: ["COMMANDER", "#f59e0b"], officer: ["OFFICER", "#f59e0b"], developer: ["DEVELOPER", "#a78bfa"], staff_nco: ["STAFF NCO", "#00D9FF"],
  nco: ["NCO", "#38bdf8"], recruiter: ["RECRUITER", "#2dd4bf"], marine: ["MARINE", "#22e07a"], enlistee: ["ENLISTEE", "#94a3b8"], retired_veteran: ["RETIRED VET", "#c084fc"],
};
const STATUS: Record<string, [string, string]> = {
  active: ["ACTIVE", "#22e07a"], reserve: ["RESERVE", "#f59e0b"], inactive: ["INACTIVE", "#ff4d4d"], retired: ["RETIRED", "#c084fc"], bct: ["AWAITING BCT", "#38bdf8"],
};
const abbr = (r: string) => (r ? r.split("/").pop()!.trim() : "");
export const short = (r: string) => {
  const m: Record<string, string> = { "Lieutenant General": "LtGen", "Major General": "MajGen", "Brigadier General": "BGen", Colonel: "Col", "Lieutenant Colonel": "LtCol", Major: "Maj", Captain: "Capt", "First Lieutenant": "1stLt", "Second Lieutenant": "2ndLt", "Sergeant Major": "SgtMaj", "Master Gunnery Sergeant": "MGySgt", "First Sergeant": "1stSgt", "Master Sergeant": "MSgt", "Gunnery Sergeant": "GySgt", "Staff Sergeant": "SSgt", Sergeant: "Sgt", Corporal: "Cpl", "Lance Corporal": "LCpl", "Private First Class": "PFC", Private: "Pvt", Reservist: "Res" };
  const a = abbr(r);
  return m[a] ?? a;
};
export function memberName(u: { firstName: string; lastName: string; callsign: string; rank: string }) {
  const f = u.firstName.trim(), l = u.lastName.trim(), cs = u.callsign.trim();
  const hasCs = cs && cs !== f && cs !== `${f} ${l}`;
  return [short(u.rank), `${f ? f[0]!.toUpperCase() + ". " : ""}${hasCs ? `"${cs}"` : l || (cs ? `"${cs}"` : "")}`.trim()].filter(Boolean).join(" ") || "—";
}
const statusOf = (u: { retired: boolean; platoon: string; inactive: boolean }) => (u.retired ? "retired" : u.platoon === "Reserves" ? "reserve" : u.platoon === "Awaiting BCT" ? "bct" : u.inactive ? "inactive" : "active");
const pctOf = (u: { opsAttended: number; opsEligible: number }) => (u.opsEligible ? Math.round((u.opsAttended / u.opsEligible) * 100) : null);
const pctC = (a: number | null) => (a == null ? "#4b5765" : a >= 75 ? "#22e07a" : a >= 50 ? "#f59e0b" : "#ff4d4d");
export const rankOrder = (r: string) => { const m = /^([OE])(\d+)/.exec(r); return !m ? (r === "Reservist" ? 900 : 999) : (m[1] === "O" ? 0 : 100) + (99 - Number(m[2])); };
const inTab = (u: MemberTile, t: string) => (t === "ALL" ? true : t === "Inactive" ? u.inactive : t === "Retired" ? u.retired : u.platoon === t);

function Hex(p: { photo: string | null; label: string; size: number }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-[#183040] to-[#0b2028] font-head font-bold text-gold [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]"
      style={{ width: p.size, height: p.size, fontSize: p.size / 3.4 }}>
      {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : p.label}
    </span>
  );
}

export function Personnel(p: { me: string }) {
  const me = p.me;
  const [list, setList] = useState<MemberTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rank" | "name" | "joined" | "att">("rank");
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "list">("cards");

  const load = useCallback(async () => {
    const r = await window.cn.hub.members();
    if ("error" in r) setError(r.error); else { setList(r.members); setError(null); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "users") { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);

  const shown = useMemo(() => {
    if (!list) return [];
    const s = q.trim().toLowerCase();
    const by = {
      rank: (a: MemberTile, b: MemberTile) => rankOrder(a.rank) - rankOrder(b.rank) || a.lastName.localeCompare(b.lastName),
      name: (a: MemberTile, b: MemberTile) => a.lastName.localeCompare(b.lastName),
      joined: (a: MemberTile, b: MemberTile) => b.joinedAt.localeCompare(a.joinedAt),
      att: (a: MemberTile, b: MemberTile) => (pctOf(a) ?? 101) - (pctOf(b) ?? 101),
    }[sort];
    return list.filter((u) => inTab(u, tab) && (!s || [u.firstName, u.lastName, u.callsign, u.discordUsername, u.rank, memberName(u)].join(" ").toLowerCase().includes(s))).sort(by);
  }, [list, tab, q, sort]);

  if (error && !list) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Personnel Files">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">PERSONNEL FILES</h1>
        <span className="text-[11px] tracking-[2px] text-dim">{shown.length} MEMBER{shown.length === 1 ? "" : "S"}</span>
        <div className="flex-1" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH NAME, CALLSIGN, DISCORD…" aria-label="Search personnel"
          className="w-[300px] border border-cyan/25 bg-black/45 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="border border-cyan/25 bg-[#05080b] px-2 py-2 text-[12px] text-white">
          <option value="rank">SORT: RANK</option><option value="name">SORT: NAME</option><option value="joined">SORT: NEWEST</option><option value="att">SORT: LOWEST ATT</option>
        </select>
        <div className="flex" role="group" aria-label="View">
          {(["cards", "list"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`border px-3 py-2 text-[11px] tracking-[1.5px] ${view === v ? "border-cyan text-cyan" : "border-cyan/25 text-dim"}`}>{v === "cards" ? "▦ CARDS" : "☰ LIST"}</button>
          ))}
        </div>
      </div>
      {list && (
        <div className="mb-3 grid grid-cols-5 gap-2.5">
          {(() => {
            const st = list.map(statusOf), w = list.filter((u) => u.opsEligible);
            const avg = w.length ? Math.round(w.reduce((n, u) => n + pctOf(u)!, 0) / w.length) : null;
            return ([[list.length, "TOTAL", "#00D9FF"], [st.filter((x) => x === "active").length, "ACTIVE", "#22e07a"], [st.filter((x) => x === "reserve").length, "RESERVE", "#f59e0b"],
              [st.filter((x) => x === "inactive").length, "INACTIVE", "#ff4d4d"], [avg == null ? "—" : `${avg}%`, "AVG ATTENDANCE", pctC(avg)]] as [number | string, string, string][]).map(([v, l, c]) => (
              <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>
            ));
          })()}
        </div>
      )}
      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => {
          const n = list?.filter((u) => inTab(u, k)).length ?? 0;
          if (k !== "ALL" && !n && tab !== k) return null;
          return (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
              className={`border px-3 py-1.5 text-[11px] tracking-[1.5px] ${tab === k ? "border-cyan text-cyan" : k === "Inactive" ? "border-bad/30 text-bad/80" : "border-cyan/15 text-dim"}`}>
              {l} <span className="ml-1 text-dimmer">{n}</span>
            </button>
          );
        })}
      </div>
      {!list ? <p className="text-[12px] tracking-[2px] text-dim">LOADING…</p> : view === "list" ? (
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="text-left text-[10.5px] tracking-[2px] text-dim">{["", "NAME", "RANK", "UNIT", "ROLE", "STATUS", "ATTENDANCE"].map((h) => <th key={h} className="border-b border-cyan/15 px-2.5 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((u, i) => {
              const [rl, rc] = ROLE[u.role] ?? [u.role.toUpperCase(), "#94a3b8"];
              const [sl, sc] = STATUS[statusOf(u)]!;
              const a = pctOf(u);
              return (
                <tr key={u.id} tabIndex={0} onClick={() => setOpen(u.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(u.id)} className="rise cursor-pointer hover:bg-cyan/5" style={{ animationDelay: `${Math.min(i, 30) * 0.015}s` }}>
                  <td className="border-b border-cyan/10 px-2.5 py-1.5"><Hex photo={u.photo} label={short(u.rank) || "—"} size={30} /></td>
                  <td className="border-b border-cyan/10 px-2.5 font-bold text-white">{memberName(u)}</td>
                  <td className="border-b border-cyan/10 px-2.5 text-dim">{u.rank || "—"}</td>
                  <td className="border-b border-cyan/10 px-2.5 text-[#9fb3c4]">{u.platoon || "—"}</td>
                  <td className="border-b border-cyan/10 px-2.5 text-[10.5px] tracking-[1.5px]" style={{ color: rc }}>{rl}</td>
                  <td className="border-b border-cyan/10 px-2.5 text-[11px]" style={{ color: sc }}>● {sl}</td>
                  <td className="border-b border-cyan/10 px-2.5 text-[12px]"><span className="mr-2 inline-block h-1 w-[90px] bg-white/5 align-middle"><i className="block h-full" style={{ width: `${a ?? 0}%`, background: pctC(a) }} /></span>{a == null ? "—" : `${a}%`}</td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={7} className="py-10 text-center text-[12px] tracking-[2px] text-dimmer">NO PERSONNEL MATCH THIS FILTER</td></tr>}
          </tbody>
        </table>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
          {shown.map((u, i) => {
            const [rl, rc] = ROLE[u.role] ?? [u.role.toUpperCase(), "#94a3b8"];
            const [sl, sc] = STATUS[statusOf(u)]!;
            const a = pctOf(u);
            return (
              <button key={u.id} type="button" onClick={() => setOpen(u.id)} aria-label={memberName(u)}
                className="rise tile group flex flex-col border border-cyan/15 bg-[#0b1016] text-left hover:border-cyan/50" style={{ animationDelay: `${Math.min(i, 30) * 0.025}s`, borderTop: `3px solid ${sc}` }}>
                <div className="relative grid h-[130px] place-items-center bg-gradient-to-b from-[#0e151c] to-[#0a0e13]">
                  <Hex photo={u.photo} label={short(u.rank) || "—"} size={84} />
                  <span className="absolute left-2 top-2 border border-gold/50 bg-black/60 px-1.5 font-head text-[12px] font-bold text-gold">{short(u.rank) || "—"}</span>
                  <span className="absolute right-2 top-2 flex items-center gap-1.5 text-[10px] tracking-[1px]" style={{ color: sc }}><i className="h-[7px] w-[7px] rounded-full" style={{ background: sc }} />{sl}</span>
                </div>
                <div className="p-3">
                  <div className="truncate font-head text-[16px] font-bold tracking-[1px] text-white">{memberName(u)}</div>
                  <div className="truncate text-[11px] text-dim">{u.rank || "No rank"}{u.retired ? " (Ret.)" : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] tracking-[1.5px]">
                    <span className="border px-1.5 py-px" style={{ color: rc, borderColor: rc + "66" }}>{rl}</span>
                    {u.platoon && <span className="border border-[#3b4a5a] px-1.5 py-px text-[#9fb3c4]">{u.platoon.toUpperCase()}</span>}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[10px] text-dim">ATT
                    <div className="h-1 flex-1 bg-white/5"><i className="block h-full" style={{ width: `${a ?? 0}%`, background: pctC(a) }} /></div>{a == null ? "—" : `${a}%`}</div>
                </div>
              </button>
            );
          })}
          {!shown.length && <p className="col-span-full py-10 text-center text-[12px] tracking-[2px] text-dimmer">NO PERSONNEL MATCH THIS FILTER</p>}
        </div>
      )}
      {open && <FileWindow id={open} me={me} onClose={() => setOpen(null)} />}
    </main>
  );
}

// ───────── file window ─────────
const KIND: Record<string, [string, string]> = { promo: ["PROMOTED", "#22e07a"], platoon: ["TRANSFER", "#00D9FF"], warn: ["WARNING", "#f59e0b"], commend: ["MEDAL", "#a78bfa"], ribbon: ["RIBBON", "#2dd4bf"] };

export function FileWindow(p: { id: string; me: string; onClose: () => void }) {
  const meRole = p.me;
  const [f, setF] = useState<MemberFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "record" | "medals" | "att" | "warn">("details");
  const [filter, setFilter] = useState<string>("all");
  const [act, setAct] = useState<Action | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    let live = true;
    const load = async () => { const r = await window.cn.hub.member(p.id); if (!live) return; if ("error" in r) setError(r.error); else setF(r); };
    void load();
    const off = window.cn.net.onTopic((x) => { if (x === "users" || x === "attendance_events") void load(); });
    return () => { live = false; off(); };
  }, [p.id, tick]);
  const { onClose } = p;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !act && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose, act]);

  const rows = useMemo(() => {
    if (!f) return [];
    const L: [string, HistoryEntry[]][] = [["promo", f.promotionHistory], ["platoon", f.platoonHistory], ["warn", f.warningHistory], ["commend", f.commendationHistory], ["ribbon", f.ribbonHistory]];
    return L.flatMap(([k, l]) => (filter === "all" || filter === k ? l.map((e, i) => ({ k, e, i })) : [])).sort((a, b) => String(b.e.date ?? "").localeCompare(String(a.e.date ?? "")));
  }, [f, filter]);

  const a = f ? pctOf(f) : null;
  const [rl, rc] = f ? ROLE[f.role] ?? [f.role.toUpperCase(), "#94a3b8"] : ["", "#00D9FF"];
  const [sl, sc] = f ? STATUS[statusOf(f)]! : ["", ""];
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/65 p-6" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Personnel file" className="flex h-[min(760px,92vh)] w-[min(1100px,96vw)] flex-col border border-cyan/40 bg-panel shadow-[0_20px_60px_rgba(0,0,0,.7)]" style={{ borderTop: `3px solid ${rc}` }}>
        <div className="flex items-center border-b border-cyan/20 px-4 py-3">
          <b className="font-head text-[15px] tracking-[3px] text-cyan">PERSONNEL FILE{f ? ` — ${memberName(f).toUpperCase()}` : ""}</b>
          <button type="button" onClick={p.onClose} aria-label="Close" className="ml-auto px-2 text-dim hover:text-white">✕</button>
        </div>
        {error ? <p className="p-6 text-bad">⚠ {error}</p> : !f ? <p className="p-6 text-[12px] tracking-[2px] text-dim">LOADING…</p> : (
          <div className="flex min-h-0 flex-1">
            <aside className="w-[270px] shrink-0 overflow-auto border-r border-cyan/15 p-5 text-center">
              <Hex photo={f.photo} label={short(f.rank) || "—"} size={130} />
              <div className="mt-3 font-head text-[18px] font-bold tracking-[1px] text-white">{memberName(f)}</div>
              <div className="text-[11.5px] text-dim">{f.rank || "No rank"}{f.platoon ? ` · ${f.platoon}` : ""}</div>
              <div className="mt-2 flex justify-center gap-1.5 text-[10px] tracking-[1.5px]">
                <span className="border px-2 py-0.5" style={{ color: rc, borderColor: rc }}>{rl}</span><span className="border px-2 py-0.5" style={{ color: sc, borderColor: sc }}>● {sl}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1.5 text-center">
                {[[a == null ? "—" : `${a}%`, "ATTENDANCE", pctC(a)], [`${f.attendance}/3`, "THIS MONTH", "#fff"], [`${f.promotionTracker}`, "PT", "#ffd166"], [`${f.promotionHistory.length}`, "PROMOTIONS", "#fff"]].map(([v, l, c]) => (
                  <div key={l} className="border border-cyan/15 p-2"><b className="block font-head text-[20px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[1.5px] text-dim">{l}</span></div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-dimmer">{f.discordLinked ? `◈ DISCORD @${f.discordUsername || "linked"}` : "○ DISCORD NOT LINKED"}</p>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div role="tablist" className="flex border-b border-cyan/15">
                {([["details", "DETAILS"], ["record", "SERVICE RECORD"], ["medals", "MEDALS"], ["att", "ATTENDANCE"], ["warn", "WARNINGS"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`border-b-2 px-5 py-3 text-[12px] tracking-[2px] ${tab === k ? "border-cyan text-cyan" : "border-transparent text-dim"}`}>{l}</button>
                ))}
                {f.canEdit ? (
                  <span className="ml-auto flex items-center gap-1.5 self-center pr-3">
                    {([["promote", "▲ PROMOTE", "#22e07a"], ["transfer", "⇄ TRANSFER", "#00D9FF"], ["warn", "⚠ WARN", "#f59e0b"], ["medal", "★ MEDAL", "#a78bfa"], ["stats", "✎ STATS", "#00D9FF"]] as const).map(([k, l, c]) => (
                      <button key={k} type="button" onClick={() => setAct({ kind: k })} className="border px-2.5 py-1 text-[10.5px] tracking-[1.5px]" style={{ color: c, borderColor: c + "88" }}>{l}</button>
                    ))}
                  </span>
                ) : <span className="ml-auto self-center pr-4 text-[10.5px] tracking-[1.5px] text-dimmer">{f.retired ? "RETIRED — FILE FROZEN" : "VIEW ONLY"}</span>}
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-5">
                {tab === "details" && <Details f={f} me={meRole} roleLabel={rl} onSaved={(m) => { setToast(m); setTick((t) => t + 1); }} />}
                {tab === "medals" && (
                  <>
                    <h4 className="mb-2 mt-0 text-[10.5px] tracking-[2.5px] text-cyan">MEDALS · {f.commendationHistory.length}</h4>
                    <div className="mb-5 grid grid-cols-3 gap-2.5">
                      {f.commendationHistory.map((e, i) => (
                        <div key={i} className="rise border border-[#a78bfa44] bg-[#0e151a] p-3" style={{ animationDelay: `${i * 0.03}s` }}>
                          <b className="block text-[#c4b5fd]">★ {String(e.title ?? "Medal")}</b><span className="text-[11px] text-dim">{String(e.date ?? "—")}{e.addedBy ? ` · by ${String(e.addedBy)}` : ""}</span>
                          {e.note && <p className="m-0 mt-1 text-[12px] text-[#aeb9c4]">{String(e.note)}</p>}
                        </div>
                      ))}
                      {!f.commendationHistory.length && <p className="col-span-3 m-0 text-[12px] tracking-[2px] text-dimmer">NO MEDALS YET.</p>}
                    </div>
                    <h4 className="mb-2 mt-0 text-[10.5px] tracking-[2.5px] text-cyan">RIBBONS · {f.ribbonHistory.length}</h4>
                    <div className="flex flex-wrap gap-2">
                      {f.ribbonHistory.map((e, i) => <span key={i} title={String(e.note ?? "")} className="border border-[#2dd4bf66] px-2.5 py-1 text-[11.5px] text-[#5eead4]">▬ {String(e.title ?? "Ribbon")} <span className="text-dimmer">{String(e.date ?? "")}</span></span>)}
                      {!f.ribbonHistory.length && <p className="m-0 text-[12px] tracking-[2px] text-dimmer">NO RIBBONS YET.</p>}
                    </div>
                    {f.canEdit && <button type="button" onClick={() => setAct({ kind: "medal" })} className="mt-5 border border-[#a78bfa88] px-3 py-1.5 text-[11px] tracking-[1.5px] text-[#a78bfa]">★ AWARD MEDAL</button>}
                  </>
                )}
                {tab === "warn" && (() => {
                  const now = new Date().toISOString().slice(0, 10);
                  const live = f.warningHistory.filter((e) => !e.expires || String(e.expires) >= now);
                  return (
                    <>
                      <div className="mb-4 border bg-[#0e151a] p-3" style={{ borderColor: live.length ? "#f59e0b" : "#22e07a" }}>
                        <b style={{ color: live.length ? "#f59e0b" : "#22e07a" }}>● {live.length ? `${live.length} ACTIVE WARNING${live.length === 1 ? "" : "S"}` : "GOOD STANDING — NO ACTIVE WARNINGS"}</b>
                        <div className="text-[11px] text-dim">{f.warningHistory.length} on record in total</div>
                      </div>
                      {f.warningHistory.map((e, i) => {
                        const old = !!e.expires && String(e.expires) < now;
                        return (
                          <div key={i} className="mb-2 border border-cyan/10 bg-[#0e151a] px-3 py-2.5" style={{ borderLeft: "3px solid #f59e0b", opacity: old ? 0.55 : 1 }}>
                            <div className="text-[10.5px] tracking-[1.5px]"><b className="text-[#f59e0b]">⚠ {String(e.severity ?? "WARNING")}</b> <span className="text-dim">· {String(e.date ?? "—")}{e.addedBy ? ` · by ${String(e.addedBy)}` : ""}{e.expires ? ` · ${old ? "EXPIRED" : "expires"} ${String(e.expires)}` : ""}</span></div>
                            <div className="mt-1 text-white">{String(e.note ?? "")}</div>
                          </div>
                        );
                      })}
                      {f.canEdit && <button type="button" onClick={() => setAct({ kind: "warn" })} className="mt-3 border border-[#f59e0b88] px-3 py-1.5 text-[11px] tracking-[1.5px] text-[#f59e0b]">⚠ ISSUE WARNING</button>}
                    </>
                  );
                })()}
                {tab === "record" && (
                  <>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {[["all", "ALL"], ["promo", "▲ PROMOTIONS"], ["platoon", "⇄ TRANSFERS"], ["warn", "⚠ WARNINGS"], ["commend", "★ MEDALS"], ["ribbon", "▬ RIBBONS"]].map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k!)} className={`border px-2.5 py-1 text-[10.5px] tracking-[1.5px] ${filter === k ? "border-cyan text-cyan" : "border-cyan/15 text-dim"}`}>{l}</button>
                      ))}
                    </div>
                    <ol className="m-0 list-none border-l border-cyan/20 p-0 pl-4">
                      {rows.map(({ k, e, i: idx }, i) => {
                        const [t, c] = KIND[k]!;
                        const body = k === "promo" ? `${e.fromRank ?? "—"} → ${e.toRank ?? "—"}` : k === "platoon" ? `${e.from ?? "—"} → ${e.to ?? "—"}` : k === "warn" ? String(e.severity ?? "WARNING") : String(e.title ?? "Award");
                        return (
                          <li key={i} className="relative mb-3 border border-cyan/10 bg-[#0e151a] px-3 py-2.5" style={{ borderLeft: `3px solid ${c}` }}>
                            <div className="flex items-center gap-2 text-[10.5px] tracking-[1.5px]"><span style={{ color: c }}>{t}</span><span className="text-dim">{String(e.date ?? "—")}</span>
                              {e.addedBy && <span className="ml-auto text-dimmer">BY {String(e.addedBy)}</span>}
                              {f.canEdit && (<span className={`${e.addedBy ? "" : "ml-auto"} flex gap-1`}>
                                <button type="button" aria-label="Edit entry" title="Edit" onClick={() => setAct({ kind: "edit-entry", list: k, index: idx, entry: e })} className="border border-cyan/20 px-1.5 text-[#ffd166]">✎</button>
                                <button type="button" aria-label="Delete entry" title="Delete" onClick={() => setAct({ kind: "delete-entry", list: k, index: idx, entry: e })} className="border border-cyan/20 px-1.5 text-bad">🗑</button>
                              </span>)}</div>
                            <b className="mt-1 block font-normal text-white">{body}</b>
                            {e.note && <div className="text-[12px] text-[#aeb9c4]">{String(e.note)}</div>}
                          </li>
                        );
                      })}
                      {!rows.length && <li className="py-6 text-[12px] tracking-[2px] text-dimmer">NOTHING ON RECORD YET.</li>}
                    </ol>
                  </>
                )}
                {tab === "att" && (
                  <>
                    <div className="mb-4 grid grid-cols-4 gap-2">
                      {[[a == null ? "—" : `${a}%`, "OVERALL", pctC(a)], [`${f.opsAttended}`, "OPS ATTENDED", "#fff"], [`${f.opsEligible}`, "OPS ELIGIBLE", "#fff"], [`${f.attendance}/3`, "THIS MONTH", "#fff"]].map(([v, l, c]) => (
                        <div key={l} className="border border-cyan/15 p-3 text-center"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[1.5px] text-dim">{l}</span></div>
                      ))}
                    </div>
                    <p className="mb-2 text-[11px] tracking-[1.5px] text-dim">LAST ATTENDED: <b className="text-white">{f.lastAttendedDate || "never"}</b></p>
                    <table className="w-full border-collapse text-[13px]">
                      <thead><tr className="text-left text-[10.5px] tracking-[2px] text-dim"><th className="border-b border-cyan/15 py-2">DATE</th><th className="border-b border-cyan/15">OP</th><th className="border-b border-cyan/15">RESULT</th></tr></thead>
                      <tbody>
                        {f.lastOps.map((o, i) => (
                          <tr key={i}><td className="border-b border-cyan/10 py-2 text-dim">{o.date}</td><td className="border-b border-cyan/10 text-white">{o.title}</td>
                            <td className="border-b border-cyan/10" style={{ color: o.result === "present" ? "#22e07a" : o.result === "excused" ? "#f59e0b" : "#ff4d4d" }}>{o.result === "present" ? "✓ Present" : o.result === "excused" ? "◐ Excused" : "✕ Absent"}</td></tr>
                        ))}
                        {!f.lastOps.length && <tr><td colSpan={3} className="py-5 text-dimmer">No locked ops since they joined.</td></tr>}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {act && f && <ActionWindow f={f} name={memberName(f)} action={act} onClose={() => setAct(null)} onDone={(m) => { setAct(null); setToast(m); setTick((t) => t + 1); }} />}
      {toast && <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border border-ok bg-panel px-4 py-2 text-[12px] tracking-[1.5px] text-ok">✓ {toast}</div>}
    </div>
  );
}

// ───────── Details tab (view / edit) ─────────
const ROLE_OPTS = ["enlistee", "marine", "recruiter", "nco", "staff_nco", "officer", "developer", "commander", "retired_veteran"];
const F_TEXT: [keyof MemberFile & string, string][] = [["firstName", "FIRST NAME"], ["lastName", "LAST NAME"], ["callsign", "CALLSIGN"], ["squad", "SQUAD"], ["recruitSource", "RECRUITED BY"]];
const F_DATE: [keyof MemberFile & string, string][] = [["joinedAt", "JOINED"], ["graduation", "BCT PASSED"], ["joinedPlatoon", "IN PLATOON SINCE"]];

function Details(p: { f: MemberFile; me: string; roleLabel: string; onSaved: (m: string) => void }) {
  const { f } = p;
  const keys: string[] = [...F_TEXT, ...F_DATE].map(([k]) => k as string).concat("role");
  const start = () => Object.fromEntries(keys.map((k) => [k, String(f[k as keyof MemberFile] ?? "")]));
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState<Record<string, string>>(start);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!edit) setV(start()); }, [f, edit]); // eslint-disable-line react-hooks/exhaustive-deps
  const orig = start();
  const changed = keys.filter((k) => v[k] !== orig[k]);
  const canRole = ["commander", "developer"].includes(p.me);
  const save = async () => {
    setBusy(true); setErr(null);
    const r = await window.cn.hub.memberAction(f.id, { action: "details", changes: Object.fromEntries(changed.map((k) => [k, v[k]])), expect: orig, reason });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setEdit(false); setReason(""); p.onSaved("File updated");
  };
  const cell = (k: string, label: string, type: "text" | "date" | "role") => {
    const on = edit && (type !== "role" || canRole);
    const ch = changed.includes(k);
    return (
      <div key={k}>
        <label className="mb-1 block text-[10px] tracking-[1.5px]" style={{ color: ch ? "#f59e0b" : "#7d8a99" }}>{label}{ch ? " • CHANGED" : ""}</label>
        {!on ? <div className="px-2.5 py-2 text-[13px] text-white">{type === "role" ? p.roleLabel : v[k] || "—"}{type === "role" && edit && <span className="ml-2 text-[10.5px] text-dimmer">🔒 Commander / Developer only</span>}</div>
          : type === "role" ? (
            <select value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="w-full border bg-[#07111b] px-2.5 py-2 text-[13px] text-white" style={{ borderColor: ch ? "#f59e0b" : "rgb(0 217 255 / .2)" }}>
              {ROLE_OPTS.filter((r) => r !== "commander" || p.me === "commander" || v[k] === "commander").map((r) => <option key={r} value={r}>{ROLE[r]?.[0] ?? r}</option>)}
            </select>)
          : <input type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} maxLength={80}
              className="w-full border bg-[#07111b] px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan" style={{ borderColor: ch ? "#f59e0b" : "rgb(0 217 255 / .2)", colorScheme: "dark" }} />}
      </div>
    );
  };
  const sec = (h: string, body: React.ReactNode[]) => (
    <section className="mb-4"><h4 className="mb-2.5 mt-0 text-[10.5px] tracking-[2.5px] text-cyan">{h}</h4><div className="grid grid-cols-2 gap-x-4 gap-y-3">{body}</div></section>
  );
  return (
    <div>
      {f.canEdit && (
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setEdit(!edit)} className="border border-cyan px-3 py-1.5 text-[11px] tracking-[1.5px] text-cyan">{edit ? "👁 VIEW" : "✎ EDIT FILE"}</button>
        </div>
      )}
      {sec("IDENTITY", [cell("firstName", "FIRST NAME", "text"), cell("lastName", "LAST NAME", "text"), cell("callsign", "CALLSIGN", "text"),
        <div key="dc"><label className="mb-1 block text-[10px] tracking-[1.5px] text-dim">DISCORD</label><div className="px-2.5 py-2 text-[13px] text-white">{f.discordUsername ? "@" + f.discordUsername : "—"} {f.discordLinked ? "· linked ✓" : "· not linked"}</div></div>])}
      {sec("SERVICE", [
        <div key="rk"><label className="mb-1 block text-[10px] tracking-[1.5px] text-dim">RANK</label><div className="px-2.5 py-2 text-[13px] text-white">{f.rank || "—"}{edit && <span className="ml-2 text-[10.5px] text-dimmer">🔒 use PROMOTE</span>}</div></div>,
        <div key="pl"><label className="mb-1 block text-[10px] tracking-[1.5px] text-dim">PLATOON</label><div className="px-2.5 py-2 text-[13px] text-white">{f.platoon || "—"}{edit && <span className="ml-2 text-[10.5px] text-dimmer">🔒 use TRANSFER</span>}</div></div>,
        cell("role", "WEBSITE ROLE", "role"), cell("squad", "SQUAD", "text"), cell("recruitSource", "RECRUITED BY", "text")])}
      {sec("DATES", F_DATE.map(([k, l]) => cell(k, l, "date")))}
      {edit && (
        <div className="sticky bottom-[-20px] -mx-5 mt-2 flex items-center gap-2.5 border-t border-[#f59e0b] bg-[#1a1405] px-5 py-3" style={{ animation: "rise .3s ease-out forwards" }}>
          <b className="text-[12px] tracking-[1.5px] text-[#f59e0b]">● {changed.length} UNSAVED CHANGE{changed.length === 1 ? "" : "S"}</b>
          {err && <span className="text-[12px] text-bad">⚠ {err}</span>}
          <div className="flex-1" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={changed.includes("role") ? "Reason (required for role change)" : "Reason (optional)"}
            className="w-[280px] border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[12px] text-white outline-none focus:border-cyan" />
          <button type="button" onClick={() => setEdit(false)} className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-dim">CANCEL</button>
          <button type="button" disabled={busy || !changed.length} onClick={() => void save()} className="border border-ok px-3 py-2 text-[11px] tracking-[1.5px] text-ok disabled:opacity-40">{busy ? "SAVING…" : "✓ SAVE CHANGES"}</button>
        </div>
      )}
    </div>
  );
}
