import { useEffect, useState } from "react";
import type { NetState, Overview, Summary } from "../../../preload/api";
import { STATE, countdown, pageName, ukTime } from "../ui";
import { Rsvp } from "./Rsvp";
import { Guard } from "./Guard";
import { NotesWidget } from "../pages/Notes";
const Body = ({ f, p }: { f: (p: P) => React.ReactNode; p: P }) => <>{f(p)}</>;

/**
 * App Dashboard (approved mock 2026-11-11 — app only, better than the website):
 * widget grid you can customise (drag to move · S/M/L/XL/FULL · ✕ remove · ＋ add · reset), saved to your account.
 * Widgets: Manpower snapshot · Next op · My service · Attendance trend · Alerts · Staff on duty · This week · Recruitment
 * · BCT queue · System status · Live activity · Quick actions. Each opens its page inside the app.
 */
export type Dash = [string, number][];
export const DEFAULT_DASH: Dash = [["kpi", 5], ["next", 3], ["me", 2], ["alerts", 2], ["att", 3], ["staff", 2], ["events", 4], ["recruit", 2], ["system", 3], ["activity", 3], ["bct", 2]];
const SIZE: Record<number, string> = { 1: "col-span-3 row-span-2", 2: "col-span-4 row-span-3", 3: "col-span-6 row-span-3", 4: "col-span-8 row-span-3", 5: "col-span-12 row-span-2" };
const OPC: Record<string, string> = { main_op: "#ff4d4d", patrol: "#a78bfa", training: "#00d9ff", fun_op: "#f59e0b" };
type P = { sum: Summary; ov: Overview | null; net: NetState; onPage: (id: string) => void; onRefresh: () => void; now: number };

const Row = (p: { children: React.ReactNode; onClick?: () => void }) => (
  <button type="button" onClick={p.onClick} className="flex w-full items-center gap-2 border-b border-cyan/[.07] py-1.5 text-left text-[12px] last:border-0 hover:bg-cyan/[.04]">{p.children}</button>);
const Bar = ({ pct, c }: { pct: number; c: string }) => <i className="block h-[5px] bg-[#13283a]"><i className="grow-x block h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: c }} /></i>;
const rc = (p: number | null) => (p == null ? "#4b5765" : p >= 75 ? "#22e07a" : p >= 50 ? "#f59e0b" : "#ff4d4d");
const Empty = ({ t }: { t: string }) => <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">{t}</p>;

const W: Record<string, { title: string; desc: string; size: number; page?: string; live?: boolean; body: (p: P) => React.ReactNode }> = {
  kpi: { title: "MANPOWER SNAPSHOT", desc: "Active, attendance, BCT queue, tickets", size: 5, page: "panel-roster", body: ({ ov, onPage }) => {
    const m = ov?.manpower;
    return <div className="grid h-full grid-cols-4 gap-2.5">{([[m?.active ?? "—", "ACTIVE", "#22e07a", "panel-roster"], [m ? `${m.rate}%` : "—", "ATTENDANCE (UNIT)", rc(m?.rate ?? null), "panel-attendance"],
      [m?.bct ?? "—", "WAITING BCT", m?.bct ? "#f59e0b" : "#fff", "panel-register"], [m?.tickets ?? "—", "TICKETS WAITING", m?.tickets ? "#ff4d4d" : "#fff", "panel-tickets"]] as [string | number, string, string, string][]).map(([v, l, c, pg]) => (
      <button key={l} type="button" onClick={() => onPage(pg)} className="flex flex-col justify-between border border-cyan/10 p-2.5 text-left hover:border-cyan/40"><span className="text-[10px] tracking-[2px] text-dim">{l}</span>
        <b className="font-head text-[34px] leading-none" style={{ color: c }}>{v}</b>{l === "ACTIVE" && m ? <small className="text-[10.5px] text-dim">{m.reserves} reserves · {m.at3} at 3/3</small> : <small /> }</button>))}</div>; } },
  next: { title: "NEXT OPERATION", desc: "Live countdown + change your sign-up (updates Discord)", size: 3, page: "panel-events", live: true, body: ({ sum, now, onRefresh }) => {
    const op = sum.ops[0];
    if (!op) return <Empty t="NO OPS SCHEDULED" />;
    const ms = Date.parse(op.startAtISO) - now;
    return <>
      <div className="text-[10px] tracking-[2px] text-dim">{op.title.toUpperCase()} · {ukTime(op.startAtISO, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()} UK</div>
      <div className="my-2 font-head text-[38px] font-bold tracking-[2px] text-white">{ms <= 0 ? <span className="text-ok">● LIVE NOW</span> : countdown(ms)}</div>
      <Bar pct={op.signedUp * 4} c="#22e07a" />
      <div className="mb-2 mt-2 text-[12px]"><span className="text-ok">{op.signedUp} signed up</span> · <span className="text-dim">You: </span>{op.mine ? <span className="text-ok">{op.mine}</span> : <span className="text-amber">not signed up</span>}</div>
      <Rsvp eventId={op.id} buttons={op.buttons ?? []} myChoice={op.myChoice ?? null} myWaiting={!!op.myWaiting} open={op.open ?? false} linked={op.linked ?? false} onDone={onRefresh} />
      {sum.ops.slice(1).map((o) => <div key={o.id} className="mt-1.5 flex text-[11.5px] text-dim"><span className="text-[#c6d0da]">{o.title}</span><span className="ml-auto">{ukTime(o.startAtISO, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></div>)}
      </>; } },
  me: { title: "MY SERVICE", desc: "Your attendance ring, this month, PT, awards", size: 2, body: ({ sum, ov }) => {
    const me = sum.me, pct = me.opsEligible ? Math.round((me.opsAttended / me.opsEligible) * 100) : null;
    return <>
      <div className="flex items-center gap-3.5">
        <div className="relative h-[104px] w-[104px] shrink-0"><svg viewBox="0 0 110 110" className="h-full w-full -rotate-90"><circle cx="55" cy="55" r="48" fill="none" stroke="#13283a" strokeWidth="9" />
          <circle cx="55" cy="55" r="48" fill="none" stroke={rc(pct)} strokeWidth="9" strokeLinecap="round" strokeDasharray="302" className="ring" style={{ ["--o" as string]: 302 - (302 * (pct ?? 0)) / 100, strokeDashoffset: 302 }} /></svg>
          <b className="absolute inset-0 grid place-items-center font-head text-[22px] text-white">{pct == null ? "—" : `${pct}%`}</b></div>
        <div><div className="text-[10px] tracking-[2px] text-dim">THIS MONTH</div><div className="text-[20px] text-white">{me.attendance} / 3 <small className="text-[11px] text-dim">ATT</small></div>
          <div className="mt-1.5 text-[10px] tracking-[2px] text-dim">PT</div><div className="text-[20px] text-cyan">{me.pt}</div></div>
      </div>
      <div className="mt-3 text-[11px] text-dim">{me.attendance >= 3 ? "+1 PT at the monthly reset" : `${3 - me.attendance} more op${3 - me.attendance === 1 ? "" : "s"} = +1 PT`} · ops {me.opsAttended}/{me.opsEligible}</div>
      <div className="mt-1 text-[11px] text-dim">▬ {ov?.me.ribbons ?? 0} ribbons · ★ {ov?.me.medals ?? 0} medals · ⚠ {ov?.me.warnings ?? 0} warnings</div></>; } },
  att: { title: "ATTENDANCE TREND", desc: "Turnout % for the last 8 locked ops", size: 3, page: "panel-attendance", body: ({ ov }) => {
    const t = ov?.trend ?? [];
    if (!t.length) return <Empty t="NO LOCKED OPS YET" />;
    return <div className="flex h-[calc(100%-18px)] items-end gap-1.5 pt-2">{t.map((x, i) => (
      <div key={i} title={`${x.title} · ${x.pct}%`} className="relative flex h-full flex-1 flex-col justify-end">
        <span className="mb-1 text-center text-[10px] text-[#c6d0da]">{x.pct}%</span>
        <i className="grow-y block bg-gradient-to-t from-cyan/20 to-cyan" style={{ height: `${Math.max(3, x.pct)}%`, animationDelay: `${i * 70}ms` }} />
        <span className="absolute -bottom-[16px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-dim">{x.label}</span></div>))}</div>; } },
  alerts: { title: "ALERTS", desc: "Promotions, warnings, mentions", size: 2, body: ({ sum, onRefresh }) => {
    // Same title in a row (e.g. "Cortana back online" ×3) → one line with a count.
    const list: { a: Summary["alerts"][number]; n: number; ids: string[] }[] = [];
    for (const a of sum.alerts.slice(0, 40)) { const l = list[list.length - 1]; if (l && l.a.title === a.title) { l.n++; l.ids.push(a.id); } else list.push({ a, n: 1, ids: [a.id] }); }
    const icon = (t: string) => /online|back/i.test(t) ? "✅" : /updat|restart/i.test(t) ? "⟳" : /shut|offline|down/i.test(t) ? "⛔" : /remind|note/i.test(t) ? "⏰" : /message|dm/i.test(t) ? "💬" : /ticket/i.test(t) ? "🎫" : /promot|rank|medal|ribbon/i.test(t) ? "★" : /warn/i.test(t) ? "⚠" : "🔔";
    return list.length ? <>{list.map(({ a, n, ids }) => (
    <Row key={a.id} onClick={() => { if (!a.read) void window.cn.hub.readAlerts({ ids }).then(onRefresh); }}>
      {!a.read ? <i className="h-2 w-2 shrink-0 rounded-full bg-cyan" /> : <i className="h-2 w-2 shrink-0" />}<span className="w-4 shrink-0 text-center text-[12px]">{icon(a.title)}</span>
      <span className={`min-w-0 flex-1 truncate ${a.read ? "text-[#9fb3c4]" : "text-white"}`}>{a.title.replace(/^⏰\s*/, "")}</span>
      {n > 1 && <span className="shrink-0 border border-cyan/25 px-1 text-[10px] text-dim">×{n}</span>}
      </Row>))}</> : <Empty t="ALL CLEAR" />; } },
  staff: { title: "STAFF ON DUTY", desc: "Who's online / DND right now — and on the Hub or the Terminal", size: 2, body: ({ sum }) => {
    const on = sum.staff.filter((s) => s.state !== "offline");
    return on.length ? <>{on.slice(0, 8).map((s) => (
      <Row key={s.uid}><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATE[s.state].color }} /><span className="min-w-0 flex-1 truncate text-white">{s.name}</span>
        {s.where && <span title={s.where === "both" ? "On the Hub app and the website Terminal" : s.where === "hub" ? "On the Hub app" : "On the website Terminal"}
          className={`shrink-0 border px-1 text-[8.5px] tracking-[1px] ${s.where === "terminal" ? "border-gold/50 text-gold" : "border-cyan/50 text-cyan"}`}>{s.where === "both" ? "HUB + WEB" : s.where === "hub" ? "HUB" : "TERMINAL"}</span>}
        <small className="max-w-[110px] truncate text-[10.5px]" style={{ color: STATE[s.state].color }}>{s.state === "dnd" ? (s.note || "DND") : pageName(s.page) || "online"}</small></Row>))}
      <div className="mt-1 text-[10.5px] text-dim">{on.length} / {sum.staff.length} staff on</div></> : <Empty t="NO STAFF ONLINE" />; } },
  events: { title: "THIS WEEK", desc: "7-day mini calendar of ops", size: 4, page: "panel-events", body: ({ ov, onPage }) => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" }));
    return <div className="grid h-full grid-cols-7 gap-1.5">{days.map((d, i) => {
      const evs = (ov?.week ?? []).filter((e) => new Date(e.startAtISO).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === d);
      return <button key={d} type="button" onClick={() => onPage("panel-events")} className={`border p-1.5 text-left text-[10px] hover:border-cyan/50 ${i === 0 ? "border-cyan" : "border-cyan/10"}`}>
        <span className={i === 0 ? "text-cyan" : "text-dim"}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }).toUpperCase()}</span>
        {evs.map((e) => <div key={e.id} className="mt-1.5 truncate border-l-[3px] bg-[#0d1a27] px-1 py-0.5 text-white" style={{ borderColor: OPC[e.opType] ?? "#00d9ff" }}>{ukTime(e.startAtISO)} {e.title}</div>)}</button>; })}</div>; } },
  recruit: { title: "RECRUITMENT", desc: "Where recruits came from this month", size: 2, page: "panel-recruit-source", body: ({ ov }) => {
    const r = ov?.recruitment;
    if (!r) return <Empty t="NO ACCESS" />;
    const max = Math.max(1, ...r.sources.map((s) => s[1]));
    return <><div className="text-[10px] tracking-[2px] text-dim">{r.count} RECRUIT{r.count === 1 ? "" : "S"} · {r.avg} AVG DAYS TO APPROVE</div>
      {r.sources.length ? r.sources.slice(0, 5).map(([s, n], i) => <div key={s} className="mt-2 text-[12px]">{s}<span className="float-right text-white">{n}</span><Bar pct={(n / max) * 100} c={["#ff4d4d", "#a78bfa", "#22e07a", "#00d9ff", "#f59e0b"][i]!} /></div>) : <Empty t="NONE THIS MONTH YET" />}</>; } },
  notes: { title: "NOTES", desc: "📌 Pinned notes + ⏰ your next reminders", size: 2, page: "panel-notes", body: ({ onPage }) => <NotesWidget onPage={onPage} /> },
  bct: { title: "BCT QUEUE", desc: "Recruits waiting for approval", size: 2, page: "panel-register", body: ({ ov, onPage }) => {
    const q = ov?.bctQueue;
    if (!q) return <Empty t="NO ACCESS" />;
    return <>{q.length ? q.map((u) => { const c = u.days > 14 ? "#ff4d4d" : u.days > 7 ? "#f59e0b" : "#22e07a"; return <Row key={u.id} onClick={() => onPage("panel-register")}><span className="min-w-0 flex-1 truncate text-white">{u.name}</span>
      <span className="border px-1 text-[9.5px] tracking-[1px]" style={{ color: c, borderColor: c }}>{u.days}D WAITING</span></Row>; }) : <Empty t="NOBODY WAITING" />}
      <button type="button" onClick={() => onPage("panel-register")} className="mt-2 w-full border border-amber bg-amber py-1.5 text-[10.5px] font-bold tracking-[1.5px] text-black">OPEN BCT APPROVALS →</button></>; } },
  system: { title: "SYSTEM STATUS", desc: "Cortana, Discord, database, website, media, live net + ping", size: 3, body: ({ ov, sum, net, onRefresh }) => {
    const s = ov?.system, cor = s?.cortana ?? { online: sum.system.cortana.online, pingMs: sum.system.cortana.pingMs, cpu: null, startedAtISO: null, missingPerms: 0, errors24h: 0, jobsQueued: 0 };
    const rows: [string, string, string, boolean][] = [
      ["🤖", "Cortana", cor.online ? "Online" : "Offline", cor.online], ["💬", "Discord API", cor.online ? (cor.missingPerms ? `${cor.missingPerms} perms missing` : "Operational") : "Unknown", cor.online && !cor.missingPerms],
      ["🗄", "Database", s ? "Connected" : "…", !!s], ["🌐", "Website", s?.website ? "Operational" : "…", !!s?.website],
      ["🖥", "Bot server", cor.online ? `Online${cor.cpu != null ? ` · CPU ${cor.cpu}%` : ""}` : "Offline", cor.online], ["🖼", "Media storage", s?.media ? "Operational" : "Not set up", !!s?.media],
      ["⚡", "505th Net (live)", net.state === "live" ? "Operational" : net.state === "connecting" ? "Connecting" : "Off", net.state === "live"], ["⚙", "Cortana jobs", cor.jobsQueued ? `${cor.jobsQueued} queued` : "Clear", !cor.jobsQueued],
    ];
    const bad = rows.filter((r) => !r[3]).length;
    const up = cor.startedAtISO ? Math.max(0, Date.now() - Date.parse(cor.startedAtISO)) : 0;
    return <>
      <div className="-mt-0.5 mb-2 flex items-center gap-2"><i className={`h-[9px] w-[9px] rounded-full ${bad ? "bg-amber" : "animate-pulse bg-ok"}`} /><b className="text-[14px] text-white">{bad ? `${bad} issue${bad === 1 ? "" : "s"}` : "All systems operational"}</b>
        <span className="text-[11px] text-dim">· checked {ov ? ukTime(ov.at) : "…"}</span><div className="flex-1" />
        <button type="button" aria-label="Check again" onClick={onRefresh} className="border border-cyan/20 px-2 py-0.5 text-cyan hover:border-cyan">↻</button></div>
      <div className="grid grid-cols-2 gap-x-5">{rows.map(([i, k, v, ok]) => <div key={k} className="flex items-center gap-2 border-b border-cyan/[.06] py-[5px] text-[12px]"><span className="w-[18px] text-center opacity-85">{i}</span><span className="flex-1 text-[#d6dde6]">{k}</span><b className="font-normal" style={{ color: ok ? "#22e07a" : "#f59e0b" }}>{v}</b></div>)}</div>
      <div className="mt-2 flex gap-5 border-t border-cyan/15 pt-2 text-[12px]"><span>Bot ping <span className="text-amber">⚡</span> <b className="text-ok">{cor.pingMs != null ? `${cor.pingMs} ms` : "—"}</b></span><span>Database <span className="text-amber">⚡</span> <b className="text-ok">{s ? `${s.dbMs} ms` : "—"}</b></span>
        {up > 0 && <span className="ml-auto text-dim">Uptime {Math.floor(up / 864e5)}d {Math.floor((up % 864e5) / 36e5)}h</span>}</div></>; } },
  activity: { title: "LIVE ACTIVITY", desc: "What staff just did (Audit Log)", size: 3, live: true, body: ({ ov }) => {
    const a = ov?.activity;
    if (!a) return <Empty t="NEEDS AUDIT LOG ACCESS" />;
    return a.length ? <>{a.map((x, i) => <div key={i} className="flex gap-2 border-b border-cyan/[.07] py-1.5 text-[11.5px] last:border-0"><span className="w-[38px] shrink-0 text-[10.5px] text-dim">{x.at ? ukTime(x.at) : ""}</span>
      {(() => { const nick = x.by.match(/[“"](.+?)[”"]/)?.[1]; const dup = !!nick && x.details.includes(nick);
        return <span className="min-w-0 truncate"><span className="mr-1.5 border border-cyan/25 px-1 text-[9.5px] uppercase tracking-[1px] text-dim">{x.action.replace(/^cortana\s+/i, "")}</span>
          {!dup && <b className="mr-1 font-normal text-cyan">{x.by}</b>}<span className="text-[#c6d0da]">{x.details || x.action}</span></span>; })()}</div>)}</> : <Empty t="NOTHING YET" />; } },
  quick: { title: "QUICK ACTIONS", desc: "One-click shortcuts", size: 1, body: ({ onPage }) => <div className="grid grid-cols-2 gap-1.5">{([["📅 New event", "panel-events"], ["▣ Take roll", "panel-attendance"], ["✦ Write AAR", "panel-aar"], ["☰ Roster", "panel-roster"]] as [string, string][]).map(([l, pg]) =>
    <button key={l} type="button" onClick={() => onPage(pg)} className="border border-cyan/25 py-1.5 text-[11px] text-cyan hover:bg-cyan/10">{l}</button>)}</div> },
};

export function Dashboard(p: { sum: Summary; ov: Overview | null; net: NetState; dash: Dash; onDash: (d: Dash) => void; onPage: (id: string) => void; onRefresh: () => void }) {
  const [now, setNow] = useState(Date.now());
  const [edit, setEdit] = useState(false);
  const [gal, setGal] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const me = p.sum.me;
  const hour = Number(ukTime(now, { hour: "2-digit", hour12: false }));
  const greet = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  const first = (/"([^"]+)"/.exec(me.name)?.[1] ?? me.name.trim().split(/\s+/).pop() ?? "").toUpperCase();
  const dash = p.dash.filter(([k]) => W[k]);
  const props: P = { sum: p.sum, ov: p.ov, net: p.net, onPage: p.onPage, onRefresh: p.onRefresh, now };
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Dashboard">
      <div className="rise mb-4 flex items-end gap-4">
        <div><h1 className="m-0 font-head text-[26px] font-bold tracking-[4px] text-white">{greet}, <span className="text-cyan">{first}</span></h1>
          <small className="mt-1 block text-[11px] tracking-[2px] text-dim">{ukTime(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()} · {(me.platoon || "—").toUpperCase()} · {(me.rank.split("/").pop() || "").trim().toUpperCase()}</small></div>
        <div className="flex-1" />
        <button type="button" aria-pressed={edit} onClick={() => { setEdit(!edit); setGal(false); }} className={`border px-3.5 py-2 text-[11px] tracking-[1.5px] ${edit ? "border-amber bg-amber font-bold text-black" : "border-cyan text-cyan hover:bg-cyan/10"}`}>{edit ? "✓ DONE" : "✎ CUSTOMISE DASHBOARD"}</button>
      </div>
      {edit && <div className="rise mb-3.5 flex items-center gap-2.5 border border-amber bg-amber/5 px-3 py-2 text-[12px] text-amber">✎ CUSTOMISE MODE — drag cards to move · S / M / L / XL / FULL to resize · ✕ to remove · saved to your account<div className="flex-1" />
        <button type="button" onClick={() => setGal(true)} className="border border-amber px-2.5 py-1 text-[11px] tracking-[1.5px]">＋ ADD WIDGET</button>
        <button type="button" onClick={() => p.onDash(DEFAULT_DASH)} className="border border-amber px-2.5 py-1 text-[11px] tracking-[1.5px]">↺ RESET</button></div>}
      <div className="grid grid-flow-dense grid-cols-12 gap-3" style={{ gridAutoRows: 86 }}>
        {dash.map(([k, s], i) => { const w = W[k]!; return (
          <section key={k} aria-label={w.title} draggable={edit} onDragStart={() => setDrag(i)} onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragEnd={() => { setDrag(null); setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (drag != null && drag !== i) { const d = [...dash]; const [m] = d.splice(drag, 1); d.splice(i, 0, m!); p.onDash(d); } setDrag(null); setOver(null); }}
            className={`widget rise relative flex flex-col overflow-hidden border bg-gradient-to-br from-[#0e151c] to-[#0b1016] ${SIZE[s] ?? SIZE[2]} ${edit ? "wob cursor-grab border-dashed border-amber/60" : "border-cyan/15 hover:border-cyan/40 hover:shadow-[0_8px_28px_-10px_rgba(0,217,255,.35)]"} ${drag === i ? "opacity-30" : ""} ${over === i && drag != null ? "outline outline-2 outline-amber" : ""}`}
            style={{ animationDelay: `${i * 0.05}s` }}>
            {edit && <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">{([["S", 1], ["M", 2], ["L", 3], ["XL", 4], ["FULL", 5]] as [string, number][]).map(([l, z]) =>
              <button key={l} type="button" onClick={() => p.onDash(dash.map((x, j) => (j === i ? [x[0], z] : x)))} className={`border border-amber px-1.5 text-[10px] ${s === z ? "bg-amber text-black" : "bg-black/80 text-amber"}`}>{l}</button>)}
              <button type="button" aria-label={`Remove ${w.title}`} onClick={() => p.onDash(dash.filter((_, j) => j !== i))} className="border border-amber bg-black/80 px-1.5 text-[10px] text-amber">✕</button></div>}
            <h3 className="m-0 flex items-center gap-2 border-b border-cyan/[.12] px-3 py-2.5 text-[11px] font-normal tracking-[3px] text-cyan">{w.title}
              {!edit && (w.live ? <em className="ml-auto animate-pulse text-[10px] not-italic text-ok">● LIVE</em> : w.page ? <button type="button" onClick={() => p.onPage(w.page!)} className="ml-auto text-[11px] text-dim hover:text-cyan" aria-label={`Open ${w.title}`}>↗</button> : null)}</h3>
            <div className="wscroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"><Guard small label={w.title}><Body f={w.body} p={props} /></Guard></div>
          </section>); })}
        {!dash.length && <div className="col-span-12 row-span-2 grid place-items-center border border-dashed border-cyan/20 text-[12px] tracking-[2px] text-dim">NO WIDGETS — ✎ CUSTOMISE → ＋ ADD WIDGET</div>}
      </div>
      {gal && (
        <aside className="rise fixed bottom-0 right-0 top-[58px] z-40 w-[340px] overflow-auto border-l border-amber bg-[#0a0f15] p-3.5 shadow-[-20px_0_40px_rgba(0,0,0,.6)]" aria-label="Add widget">
          <div className="flex"><h4 className="m-0 tracking-[3px] text-amber">＋ ADD WIDGET</h4><button type="button" onClick={() => setGal(false)} aria-label="Close" className="ml-auto text-dim">✕</button></div>
          <small className="text-dim">Click to add. Greyed = already on your dashboard.</small>
          {Object.entries(W).map(([k, w]) => { const on = dash.some((d) => d[0] === k); return (
            <button key={k} type="button" disabled={on} onClick={() => p.onDash([[k, w.size], ...dash])} className="mt-2 block w-full border border-cyan/15 p-2.5 text-left hover:border-cyan disabled:opacity-35">
              <b className="block text-white">{w.title}</b><small className="text-dim">{w.desc}</small></button>); })}
        </aside>)}
    </main>
  );
}
