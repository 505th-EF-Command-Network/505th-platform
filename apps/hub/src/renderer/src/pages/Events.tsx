import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EvButton, EvData, EvItem } from "../../../preload/api";
import { Rsvp } from "../components/Rsvp";

/**
 * EVENTS in the app — same data, wizard and actions as the Terminal's events.js, plus the approved month CALENDAR.
 * Create / edit = the same 4-step wizard (Location · Details · Sign-ups · Review) with the live Discord preview.
 * Detail = Details + Live status, with Edit · Refresh · Repost with ping · End · Cancel · Delete. Cortana does the Discord side.
 * Attendance check opens the in-app Attendance Tracker.
 */
const OPT: Record<string, [string, string]> = { main_op: ["Main Op", "#ff4d5e"], patrol: ["Patrol", "#b48cff"], training: ["Training", "#1fc8ff"], fun_op: ["Fun Op", "#ffb020"] };
const REPEAT: Record<string, string> = { none: "Does not repeat", weekly: "Every week", fortnightly: "Every 2 weeks" };
const PRESETS: [string, EvButton[]][] = [
  ["Going / Can't go", [{ emoji: "✅", label: "Going", style: "green", limit: 0, attending: true }, { emoji: "❌", label: "Can't go", style: "grey", limit: 0, attending: false }]],
  ["BLUFOR / OPFOR", [{ emoji: "🔵", label: "BLUFOR", style: "blue", limit: 0, attending: true }, { emoji: "🔴", label: "OPFOR", style: "red", limit: 0, attending: true }, { emoji: "❌", label: "Can't make it", style: "grey", limit: 0, attending: false }]],
  ["Attend / Can't make it", [{ emoji: "👍", label: "Attend", style: "green", limit: 0, attending: true }, { emoji: "👎", label: "Can't make it", style: "grey", limit: 0, attending: false }]],
];
const STEPS = ["LOCATION", "DETAILS", "SIGN-UPS", "REVIEW"];
const BTN_BG: Record<string, string> = { green: "#248046", red: "#da373c", blue: "#5865f2", grey: "#4e5058" };
const ukDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const ukFmt = (iso: string, o: Intl.DateTimeFormatOptions) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...o }) : "—");
const whenLabel = (v: { date: string; startTime: string; endTime: string }) => (v.date ? `${new Date(`${v.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${v.startTime}–${v.endTime}` : "Choose a date");
const whereLabel = (e: { where: string; voiceChannel: string; location: string }) => (e.where === "else" ? `📍 ${e.location || "Somewhere else"}` : `${e.where === "stage" ? "🎙" : "🔊"} ${e.voiceChannel || (e.where === "stage" ? "Stage channel" : "Voice channel")}`);
const isOpen = (e: EvItem) => e.status !== "cancelled" && e.status !== "completed" && !e.discord.closedAtISO && Date.parse(e.endAtISO) > Date.now();
const inp = "w-full border border-cyan/25 bg-[#07111b] px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan [color-scheme:dark]";
const lbl = "mb-1.5 mt-3.5 block text-[10px] tracking-[2px] text-dim";
type Wiz = { step: number; editId: string | null; err: string | null; v: { where: string; voiceChannel: string; location: string; title: string; description: string; date: string; startTime: string; endTime: string; repeat: string; banner: string; channel: string; buttons: EvButton[]; linkAttendance: boolean; opType: string } };

export function Events(p: { onPage: (id: string) => void }) {
  const [d, setD] = useState<EvData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"cal" | "list">("cal");
  const [month, setMonth] = useState(() => ukDay().slice(0, 7));
  const [open, setOpen] = useState<string | null>(null);
  const [wiz, setWiz] = useState<Wiz | null>(null);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { const r = await window.cn.hub.events(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (["community_events", "attendance_events", "bot_status"].includes(x)) { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const run = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    const r = await window.cn.hub.eventsAction(body);
    setBusy(null);
    setToast(r.error ? [r.error, false] : [String(r.msg ?? "Done").toUpperCase(), true]);
    await load();
    return r;
  };
  const startWizard = (date?: string, edit?: EvItem) => {
    const first = d?.signupChannels.find(([, id]) => id)?.[1] ?? "";
    setOpen(null);
    setWiz({ step: 0, editId: edit?.id ?? null, err: null, v: edit
      ? { where: edit.where, voiceChannel: edit.voiceChannel, location: edit.location, title: edit.title, description: edit.description, date: edit.date, startTime: edit.startTime, endTime: edit.endTime, repeat: edit.repeat, banner: edit.banner, channel: edit.channel, buttons: edit.buttons.map(({ emoji, label, style, limit, attending }) => ({ emoji, label, style, limit, attending })), linkAttendance: !edit.attendanceEventId, opType: edit.opType }
      : { where: "voice", voiceChannel: "", location: "", title: "", description: "", date: date ?? ukDay(), startTime: "19:00", endTime: "22:00", repeat: "none", banner: "", channel: first, buttons: PRESETS[0]![1].map((b) => ({ ...b })), linkAttendance: true, opType: "main_op" } });
  };

  const byDay = useMemo(() => {
    const m = new Map<string, EvItem[]>();
    for (const e of d?.events ?? []) { const k = e.startAtISO ? ukDay(new Date(e.startAtISO)) : e.date; m.set(k, [...(m.get(k) ?? []), e]); }
    for (const l of m.values()) l.sort((a, b) => a.startAtISO.localeCompare(b.startAtISO));
    return m;
  }, [d]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const now = Date.now();
  const live = d.events.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) <= now && Date.parse(e.endAtISO) > now);
  const up = d.events.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > now).sort((a, b) => a.startAtISO.localeCompare(b.startAtISO));
  const past = d.events.filter((e) => !(e.status !== "cancelled" && Date.parse(e.endAtISO) > now)).sort((a, b) => b.startAtISO.localeCompare(a.startAtISO)).slice(0, 30);
  const next = up[0];
  const ev = d.events.find((x) => x.id === open) ?? null;

  const [y, mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y!, mo! - 1, 1)), days = new Date(Date.UTC(y!, mo!, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const shift = (n: number) => { const x = new Date(Date.UTC(y!, mo! - 1 + n, 1)); setMonth(x.toISOString().slice(0, 7)); };
  const today = ukDay();

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Events">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">EVENTS</h1>
        <div className="flex-1" />
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="border border-cyan/25 px-3 py-2 text-[12px] text-white">‹</button>
        <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="min-w-[170px] border border-cyan px-3 py-2 text-[11px] tracking-[2px] text-cyan">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase()}</button>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="border border-cyan/25 px-3 py-2 text-[12px] text-white">›</button>
        {(["cal", "list"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`border px-3 py-2 text-[11px] tracking-[1.5px] ${view === v ? "border-cyan text-cyan" : "border-cyan/25 text-dim"}`}>{v === "cal" ? "▦ CALENDAR" : "☰ LIST"}</button>)}
        {d.canEdit && <button type="button" disabled={!!busy} onClick={() => void run({ action: "refreshall" }, "all")} title="Update every upcoming sign-up post in Discord (no pings)" className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-white">{busy === "all" ? "◷ REFRESHING…" : "↻ REFRESH ALL POSTS"}</button>}
        {d.canEdit && <button type="button" onClick={() => startWizard()} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">📅 CREATE EVENT</button>}
      </div>
      <p className="mb-3 mt-0 text-[10.5px] tracking-[2px] text-dim">EVENTS WITH YOUR OWN SIGN-UP BUTTONS IN DISCORD — CAN REPEAT EVERY WEEK OR EVERY 2 WEEKS{d.cortanaOnline === false && <span className="text-amber"> · ◷ CORTANA OFFLINE — POSTS WAIT UNTIL IT'S BACK</span>}</p>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
        {view === "cal" ? (
          <div className="grid grid-cols-7 gap-1">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((x) => <div key={x} className="pb-1 text-center text-[10px] tracking-[2px] text-dim">{x}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, "0")}`, list = byDay.get(key) ?? [];
              return (
                <div key={key} onClick={(x) => { if (d.canEdit && x.target === x.currentTarget) startWizard(key); }} title={d.canEdit ? "Click an empty space to create an event this day" : undefined}
                  className={`min-h-[104px] border bg-[#0b1016] p-1.5 text-[11px] ${key === today ? "border-cyan shadow-[0_0_14px_-4px_var(--color-cyan)]" : "border-cyan/12"} ${d.canEdit ? "cursor-copy" : ""}`}>
                  <span className={`pointer-events-none ${key === today ? "font-bold text-cyan" : "text-dim"}`}>{i + 1}</span>
                  {list.map((e) => { const c = OPT[e.opType]?.[1] ?? "#9fb3c4"; return (
                    <button key={e.id} type="button" onClick={() => setOpen(e.id)} className="rise mt-1 block w-full truncate border-l-[3px] bg-[#0d1a27] px-1.5 py-1 text-left text-[11px] text-white hover:bg-[#132536]"
                      style={{ borderColor: c, opacity: e.status === "cancelled" ? 0.45 : 1, textDecoration: e.status === "cancelled" ? "line-through" : undefined }}>{e.startTime} {e.title}</button>); })}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {live.length > 0 && <><h3 className="mb-2 mt-0 text-[11px] tracking-[2.5px] text-ok">● HAPPENING NOW</h3>{live.map((e) => <Row key={e.id} e={e} onOpen={setOpen} />)}</>}
            <h3 className="mb-2 mt-3 text-[11px] tracking-[2.5px] text-cyan">UPCOMING</h3>{up.length ? up.map((e) => <Row key={e.id} e={e} onOpen={setOpen} />) : <p className="text-[11px] tracking-[2px] text-dimmer">NO UPCOMING EVENTS</p>}
            <h3 className="mb-2 mt-4 text-[11px] tracking-[2.5px] text-cyan">PAST AND CANCELLED</h3>{past.length ? past.map((e) => <Row key={e.id} e={e} onOpen={setOpen} />) : <p className="text-[11px] tracking-[2px] text-dimmer">NOTHING YET</p>}
          </div>
        )}
        <aside className="self-start">
          <h3 className="mb-2 mt-0 text-[11px] tracking-[2.5px] text-cyan">NEXT EVENT{next && <span className="text-dim"> · {countdown(next.startAtISO)}</span>}</h3>
          {next ? (
            <button type="button" onClick={() => setOpen(next.id)} className="tile block w-full border border-cyan/15 bg-[#0b1016] p-3.5 text-left" style={{ borderTop: `3px solid ${OPT[next.opType]?.[1] ?? "#00D9FF"}` }}>
              <b className="block font-head text-[17px] text-white">{next.title}</b>
              <span className="text-[11px] text-dim">{ukFmt(next.startAtISO, { weekday: "short", day: "numeric", month: "short" })} · {next.startTime}–{next.endTime} UK · {(OPT[next.opType]?.[0] ?? "").toUpperCase()}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">{next.buttons.map((b) => <span key={b.key} className="border border-cyan/20 px-1.5 py-0.5 text-[11px] text-white">{b.emoji} {b.label} {next.signups.filter((s) => s.choice === b.key).length}{b.limit ? `/${b.limit}` : ""}</span>)}</div>
              <span className="mt-2 block text-[11px] text-dim">{whereLabel(next)}</span>
            </button>
          ) : <p className="text-[11px] tracking-[2px] text-dimmer">NO UPCOMING EVENTS</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-[10.5px]">{Object.values(OPT).map(([l, c]) => <span key={l} className="flex items-center gap-1.5 text-dim"><i className="inline-block h-2.5 w-2.5" style={{ background: c }} />{l}</span>)}</div>
        </aside>
      </div>

      {ev && <Detail e={ev} d={d} busy={busy} onReload={() => void load()} onClose={() => setOpen(null)} onEdit={() => startWizard(undefined, ev)} onAtt={() => p.onPage("panel-attendance")}
        onAct={(action, extra) => void run({ action, id: ev.id, ...extra }, action).then((r) => { if (r.ok && (action === "delete" || action === "cancel" || action === "end")) setOpen(null); })} />}
      {wiz && <Wizard d={d} w={wiz} setW={setWiz} busy={busy === "save"} onSave={async () => { const r = await run({ action: "save", id: wiz.editId ?? undefined, v: wiz.v }, "save"); if (r.ok) setWiz(null); else setWiz((o) => o && { ...o, err: r.error ?? null }); }} />}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function countdown(iso: string) {
  const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
  return m >= 1440 ? `IN ${Math.floor(m / 1440)}D ${Math.floor((m % 1440) / 60)}H` : `IN ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function discordChip(e: EvItem): [string, string] {
  if (e.status === "cancelled") return ["Cancelled", "#ff4d4d"];
  if (e.status === "completed") return ["✓ Completed", "#22e07a"];
  const s = e.discord;
  if (s.status === "posted") return s.closedAtISO ? ["🚪 Sign-ups closed", "#7d8a99"] : s.missing ? ["⚠ POST MISSING", "#f59e0b"] : ["✓ Posted in Discord", "#22e07a"];
  if (s.status === "failed") return ["✕ Discord post failed", "#ff4d4d"];
  return ["◷ Waiting for Cortana", "#f59e0b"];
}
function Row({ e, onOpen }: { e: EvItem; onOpen: (id: string) => void }) {
  const [t, c] = discordChip(e);
  return (
    <button type="button" onClick={() => onOpen(e.id)} className="tile mb-1.5 flex w-full items-center gap-3 border border-cyan/15 bg-[#0b1016] px-3 py-2.5 text-left" style={{ borderLeft: `3px solid ${OPT[e.opType]?.[1] ?? "#00D9FF"}`, opacity: e.status === "cancelled" ? 0.55 : 1 }}>
      <span className="min-w-0 flex-1"><b className="block truncate text-[14px] text-white">{e.title}</b><small className="text-[11px] text-dim">{ukFmt(e.startAtISO, { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()} · {e.startTime}–{e.endTime}</small></span>
      <span className="flex flex-wrap justify-end gap-1 text-[10.5px]">
        <span className="border px-1.5" style={{ color: c, borderColor: c + "80" }}>{t}</span>
        {e.repeat !== "none" && <span className="border border-cyan/30 px-1.5 text-cyan">↻ {REPEAT[e.repeat]}</span>}
        {e.buttons.map((b) => <span key={b.key} className="border border-cyan/15 px-1.5 text-white">{b.emoji} {b.label} {e.signups.filter((s) => s.choice === b.key).length}{b.limit ? `/${b.limit}` : ""}</span>)}
        {e.attendance && <span className="border px-1.5" style={e.attendance.locked ? { color: "#22e07a", borderColor: "#22e07a80" } : { color: "#00D9FF", borderColor: "#00D9FF60" }}>{e.attendance.locked ? `🔒 CHECKED — ${e.attendance.present} ATTENDED` : "▣ ATTENDANCE LINKED"}</span>}
      </span>
    </button>
  );
}

function Detail(p: { e: EvItem; d: EvData; busy: string | null; onReload: () => void; onClose: () => void; onEdit: () => void; onAtt: () => void; onAct: (a: string, extra?: Record<string, unknown>) => void }) {
  const { e, d } = p;
  const [tab, setTab] = useState<"details" | "live">("details");
  const [t, c] = discordChip(e);
  const ds = e.discord, now = Date.now(), start = Date.parse(e.startAtISO), end = Date.parse(e.endAtISO);
  const going = e.signups.filter((x) => !x.waiting && e.buttons.find((b) => b.key === x.choice)?.attending).length;
  const chan = (ref: string) => d.channelNames[ref] ?? ref.replace(/^#/, "");
  const sys: [string, string, string][] = [
    ["Cortana", d.cortanaOnline === false ? "● OFFLINE — FIXES ITSELF WHEN BACK" : d.cortanaOnline ? "● ONLINE" : "— UNKNOWN", d.cortanaOnline === false ? "#ff4d4d" : d.cortanaOnline ? "#22e07a" : "#7d8a99"],
    ["Sign-up post", ds.closedAtISO ? "CLOSED · REMOVED" : ds.status !== "posted" ? (ds.status === "failed" ? `✕ FAILED${ds.error ? " — " + ds.error : ""}` : "◷ WAITING TO POST") : ds.missing ? "⚠ MISSING IN DISCORD" : `✓ IN #${chan(ds.channelId || e.channel)}`,
      ds.closedAtISO ? "#7d8a99" : ds.status === "posted" && !ds.missing ? "#22e07a" : ds.status === "failed" ? "#ff4d4d" : "#f59e0b"],
    ["Discord event (calendar)", ds.scheduledEventId ? "✓ MADE" : "— NOT MADE", ds.scheduledEventId ? "#22e07a" : "#7d8a99"],
    ["Start ping", ds.startSentISO ? `✓ SENT (${going} ${going === 1 ? "PERSON" : "PEOPLE"})` : now < start ? `◷ AT ${ukFmt(e.startAtISO, { weekday: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()}` : "— NOT SENT", ds.startSentISO ? "#22e07a" : "#7d8a99"],
    ["Attendance record", e.attendanceEventId ? "✓ LINKED" : "— NOT LINKED", e.attendanceEventId ? "#22e07a" : "#7d8a99"],
  ];
  const running = e.status !== "cancelled" && now >= start && now < end && !ds.closedAtISO && e.status !== "completed";
  const bad = isOpen(e) && (ds.status !== "posted" || ds.missing);
  const btn = "border px-3 py-2 text-[11px] tracking-[1.5px] disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-6" onMouseDown={(x) => x.target === x.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label={e.title} className="rise flex max-h-[92vh] w-[min(820px,96vw)] flex-col border border-cyan/40 bg-panel" style={{ borderTop: `3px solid ${OPT[e.opType]?.[1] ?? "#00D9FF"}` }}>
        <div className="flex items-start border-b border-cyan/20 px-4 py-3">
          <div><b className="font-head text-[18px] tracking-[2px] text-white">{e.title.toUpperCase()}</b>
            <div className="text-[10.5px] tracking-[1px] text-dim">{ukFmt(e.startAtISO, { weekday: "long", day: "numeric", month: "long" }).toUpperCase()} · {e.startTime}–{e.endTime} UK · {whereLabel(e)}</div></div>
          <button type="button" onClick={p.onClose} aria-label="Close" className="ml-auto px-2 text-dim hover:text-white">✕</button>
        </div>
        <div role="tablist" className="flex border-b border-cyan/15">
          {([["details", "DETAILS"], ["live", "● LIVE STATUS"]] as const).map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 px-5 py-2.5 text-[11.5px] tracking-[2px] ${tab === k ? "border-cyan text-cyan" : "border-transparent text-dim"}`}>{l}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 text-[13px]">
          {tab === "details" ? <>
            <div className="mb-3 flex flex-wrap gap-1.5 text-[10.5px]">
              <span className="border px-1.5" style={{ color: c, borderColor: c + "80" }}>{t}</span>
              {e.repeat !== "none" && <span className="border border-cyan/30 px-1.5 text-cyan">↻ {REPEAT[e.repeat]}</span>}
              {e.attendance && <span className="border border-cyan/30 px-1.5 text-cyan">{e.attendance.locked ? `🔒 CHECKED — ${e.attendance.present} ATTENDED` : "▣ ATTENDANCE LINKED"}</span>}
            </div>
            {e.description && <p className="mb-3 mt-0 whitespace-pre-wrap leading-relaxed text-[#c6d0da]">{e.description}</p>}
            {(() => { const mine = e.signups.find((x) => x.uid === d.me?.uid || (!!d.me?.discordId && x.discordId === d.me?.discordId)); return (
              <div className="mb-3 border border-cyan/15 bg-[#0e151a] p-2.5"><span className="mb-1.5 block text-[10px] tracking-[2px] text-cyan">MY SIGN-UP</span>
                <Rsvp eventId={e.id} myChoice={mine?.choice ?? null} myWaiting={!!mine?.waiting} linked={!!d.me?.discordId} onDone={p.onReload}
                  open={e.status !== "cancelled" && e.status !== "completed" && !ds.closedAtISO && !ds.startSentISO}
                  buttons={e.buttons.map((b) => ({ key: b.key, emoji: b.emoji, label: b.label, style: b.style, limit: b.limit, count: e.signups.filter((x) => x.choice === b.key && !x.waiting).length, waiting: e.signups.filter((x) => x.choice === b.key && x.waiting).length }))} /></div>); })()}
            <span className="mb-1.5 block text-[10px] tracking-[2px] text-dim">SIGN-UPS · POSTED IN #{chan(e.channel)}</span>
            <div className="grid grid-cols-2 gap-2">
              {e.buttons.map((b) => { const l = e.signups.filter((s) => s.choice === b.key); return (
                <div key={b.key} className="border border-cyan/15 bg-[#0e151a] p-2.5"><b className="text-white">{b.emoji} {b.label} <span className="text-cyan">{l.length}{b.limit ? `/${b.limit}` : ""}</span></b>
                  <small className="mt-1 block text-[11.5px] text-[#aeb9c4]">{l.map((s) => s.name + (s.waiting ? " ⏳" : "")).join(", ") || "—"}</small></div>); })}
            </div>
            {ds.status !== "posted" && <p className="text-[11.5px] text-dim">Sign-ups arrive from the Discord buttons once Cortana posts this event.</p>}
            <p className="mb-0 mt-3 text-[10.5px] tracking-[1px] text-dimmer">CREATED BY {e.createdByName || "—"}{e.updatedByName ? ` · LAST EDIT ${e.updatedByName}` : ""}</p>
          </> : <>
            {running && <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[2px] text-ok"><i className="inline-block h-2 w-2 animate-pulse rounded-full bg-ok" />LIVE · STARTED {Math.max(0, Math.round((now - start) / 60000))} MIN AGO</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">{e.buttons.map((b) => <div key={b.key} className="min-w-[90px] border border-cyan/15 p-2 text-center"><b className="block font-head text-[20px] text-white">{e.signups.filter((s) => s.choice === b.key).length}{b.limit ? `/${b.limit}` : ""}</b><span className="text-[9.5px] tracking-[1.5px] text-dim">{b.emoji} {b.label.toUpperCase()}</span></div>)}</div>
                <span className="mb-1.5 block text-[10px] tracking-[2px] text-dim">SIGN-UPS</span>
                <table className="w-full border-collapse text-[12px]"><thead><tr className="text-left text-[10px] tracking-[1.5px] text-dim"><th className="border-b border-cyan/15 py-1">MEMBER</th><th className="border-b border-cyan/15">CHOICE</th></tr></thead>
                  <tbody>{e.signups.length ? [...e.signups].sort((x, y) => x.atISO.localeCompare(y.atISO)).map((s, i) => { const b = e.buttons.find((y) => y.key === s.choice); return <tr key={i}><td className="border-b border-cyan/10 py-1 text-white">{s.name}</td><td className="border-b border-cyan/10">{b?.emoji} {b?.label ?? s.choice}{s.waiting ? <span className="text-dim"> · WAITING LIST</span> : ""}</td></tr>; })
                    : <tr><td colSpan={2} className="py-2 text-dim">No sign-ups yet.</td></tr>}</tbody></table>
              </div>
              <div>
                <span className="mb-1.5 block text-[10px] tracking-[2px] text-dim">SYSTEM CHECK</span>
                <ul className="m-0 list-none p-0">{sys.map(([k, v, col]) => <li key={k} className="flex justify-between gap-3 border-b border-cyan/10 py-1.5 text-[12px]"><span className="text-dim">{k}</span><span className="text-right" style={{ color: col }}>{v}</span></li>)}</ul>
                {bad && d.canEdit && <div className="mt-3 border border-amber/50 bg-amber/5 p-2.5 text-[12px] text-amber">⚠ Something is out of sync.
                  <div className="mt-2 flex gap-2"><button type="button" disabled={!!p.busy} onClick={() => p.onAct("refresh")} className={`${btn} border-cyan/40 text-white`}>↻ FIX</button>
                    <button type="button" disabled={!!p.busy} onClick={async () => { if (await askBox(`REPOST WITH PING?\n\n${e.title}\n\nThe sign-up post is posted again and the usual roles are pinged.`)) p.onAct("refresh", { ping: true }); }} className={`${btn} border-cyan/40 text-white`}>↻ REPOST WITH PING</button></div></div>}
              </div>
            </div>
          </>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-cyan/20 px-4 py-3">
          {d.canEdit && e.status !== "cancelled" && e.status !== "completed" && <button type="button" disabled={!!p.busy} onClick={async () => { if (await askBox(`CANCEL EVENT?\n\n${e.title}\n\nCortana marks the Discord event and sign-up post as cancelled.`)) p.onAct("cancel"); }} className={`${btn} border-bad/60 text-bad`}>CANCEL EVENT</button>}
          {d.canEdit && <button type="button" disabled={!!p.busy} onClick={async () => { if (await askBox(`DELETE EVENT?\n\n${e.title}\n\nThe Discord event and the sign-up post are deleted, and the event is removed from the website. Sign-ups are lost.\n\nTHIS CANNOT BE UNDONE.`)) p.onAct("delete"); }} className={`${btn} border-bad/60 text-bad`}>{p.busy === "delete" ? "DELETING…" : "🗑 DELETE"}</button>}
          <div className="flex-1" />
          {isOpen(e) && d.canEdit && <button type="button" disabled={!!p.busy} title="Update the Discord sign-up post — re-posts it (no ping) if it was deleted" onClick={() => p.onAct("refresh")} className={`${btn} border-cyan/40 text-white`}>{p.busy === "refresh" ? "◷ REFRESHING…" : "↻ REFRESH POST"}</button>}
          {e.attendanceEventId && <button type="button" onClick={p.onAtt} className={`${btn} border-cyan/40 text-cyan`}>▣ ATTENDANCE CHECK</button>}
          {d.canEdit && e.status !== "cancelled" && e.status !== "completed" && start <= now && <button type="button" disabled={!!p.busy} onClick={async () => { if (await askBox(`END EVENT?\n\n${e.title}\n\nThe event is marked completed. Cortana logs the sign-ups to the mission log, removes the sign-up post and ends the Discord event.`)) p.onAct("end"); }} className={`${btn} border-ok/60 text-ok`}>{p.busy === "end" ? "ENDING…" : "✓ END EVENT"}</button>}
          {d.canEdit && e.status !== "cancelled" && e.status !== "completed" && <button type="button" onClick={p.onEdit} className={`${btn} border-gold bg-gold font-bold text-black`}>✎ EDIT</button>}
        </div>
      </div>
    </div>
  );
}

function Wizard(p: { d: EvData; w: Wiz; setW: (f: (o: Wiz | null) => Wiz | null) => void; busy: boolean; onSave: () => void }) {
  const { d, w } = p, v = w.v, s = w.step;
  const set = (patch: Partial<Wiz["v"]>) => p.setW((o) => o && { ...o, err: null, v: { ...o.v, ...patch } });
  const setB = (i: number, patch: Partial<EvButton>) => set({ buttons: v.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const check = (k: number): string | null => {
    if (k === 0) { if (v.where !== "else" && !v.voiceChannel.trim()) return `Type the ${v.where === "stage" ? "stage" : "voice"} channel name.`; if (v.where === "else" && !v.location.trim()) return "Type where the event happens."; }
    if (k === 1) { if (v.title.trim().length < 3) return "Give the event a title (at least 3 characters)."; if (!v.date || !v.startTime || !v.endTime) return "Choose the date, start and end time."; }
    if (k === 2) { if (!v.channel.trim()) return "Pick the channel for the sign-up post."; if (!v.buttons.length) return "Add at least one sign-up button."; if (v.buttons.some((b) => !b.label.trim())) return "Every button needs a label."; }
    return null;
  };
  const go = (to: number) => { if (to < 0 || to > 3) return; for (let k = s; k < to; k++) { const e = check(k); if (e) return p.setW((o) => o && { ...o, step: k, err: e }); } p.setW((o) => o && { ...o, step: to, err: null }); };
  const vcs = v.where === "stage" ? d.stageChannels : d.voiceChannels;
  const eo = (key: string, icon: string, l: string, h: string) => (
    <label className={`mb-2 flex cursor-pointer gap-3 border px-3 py-2.5 ${v.where === key ? "border-cyan bg-cyan/10" : "border-cyan/15"}`}>
      <input type="radio" name="evWhere" checked={v.where === key} onChange={() => set({ where: key })} className="accent-cyan" /><span><b className="text-white">{icon} {l}</b><small className="block text-dim">{h}</small></span></label>);
  const pill = (on: boolean) => `mb-1.5 mr-1.5 border px-2.5 py-1 text-[11px] tracking-[1px] ${on ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-white"}`;
  const chanLabel = d.channelNames[v.channel] ?? v.channel;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      <div role="dialog" aria-modal="true" aria-label="Create event" className="rise flex max-h-[94vh] w-[min(1140px,96vw)] flex-col border border-cyan/40 bg-panel" style={{ borderTop: "3px solid #c9a227" }}>
        <div className="flex items-center border-b border-cyan/20 px-4 py-3"><b className="font-head text-[16px] tracking-[3px] text-cyan">📅 {w.editId ? "EDIT EVENT" : "CREATE EVENT"}</b>
          <button type="button" onClick={() => p.setW(() => null)} aria-label="Close" className="ml-auto px-2 text-dim hover:text-white">✕</button></div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-4" style={{ gridTemplateColumns: "1fr 360px" }}>
          <div className="text-[13px]">
            <ol className="m-0 mb-4 flex list-none gap-1.5 p-0">{STEPS.map((t, i) => <li key={t}><button type="button" onClick={() => go(i)} aria-current={i === s ? "step" : undefined}
              className={`border px-3 py-1.5 text-[11px] tracking-[1.5px] ${i < s ? "border-ok/50 text-ok" : i === s ? "border-gold text-gold" : "border-cyan/15 text-dim"}`}>{i < s ? "✓" : i + 1} {t}</button></li>)}</ol>
            {s === 0 && <>
              <h3 className="m-0 font-head tracking-[2px] text-cyan">WHERE IS YOUR EVENT?</h3><p className="mb-3 mt-1 text-[11.5px] text-dim">So no one gets lost on where to go.</p>
              {eo("stage", "🎙", "STAGE CHANNEL", "For bigger events: speakers on stage, everyone else listens.")}
              {eo("voice", "🔊", "VOICE CHANNEL", "Hang out with voice, video and Screen Share.")}
              {eo("else", "📍", "SOMEWHERE ELSE", "A game server, an external link or an in-person place.")}
              {v.where === "else" ? <><label htmlFor="evLoc" className={lbl}>LOCATION</label><input id="evLoc" maxLength={100} value={v.location} onChange={(x) => set({ location: x.target.value })} placeholder="e.g. Arma 3 — 505th server" className={inp} /></>
                : <><label htmlFor="evVc" className={lbl}>{v.where === "stage" ? "STAGE" : "VOICE"} CHANNEL</label>
                  {vcs.length ? <select id="evVc" value={v.voiceChannel} onChange={(x) => set({ voiceChannel: x.target.value })} className={inp}><option value="">— pick a channel —</option>{vcs.map((n) => <option key={n}>{n}</option>)}{v.voiceChannel && !vcs.includes(v.voiceChannel) && <option>{v.voiceChannel}</option>}</select>
                    : <><input id="evVc" maxLength={100} value={v.voiceChannel} onChange={(x) => set({ voiceChannel: x.target.value })} placeholder="e.g. Ops Briefing" className={inp} /><p className="text-[11px] text-dim">Add voice / stage channels in COMMAND → Cortana Setup to get a pick list here.</p></>}</>}
            </>}
            {s === 1 && <>
              <h3 className="m-0 font-head tracking-[2px] text-cyan">EVENT DETAILS</h3>
              <span className={lbl}>OPERATION TYPE</span><div role="radiogroup" aria-label="Operation type">{Object.entries(OPT).map(([k, [l]]) => <button key={k} type="button" role="radio" aria-checked={v.opType === k} onClick={() => set({ opType: k })} className={pill(v.opType === k)}>{l.toUpperCase()}</button>)}</div>
              <label htmlFor="evT" className={lbl}>EVENT TOPIC</label><input id="evT" maxLength={100} value={v.title} onChange={(x) => set({ title: x.target.value })} placeholder="e.g. Weekend Op: Operation Firebreak" className={inp} />
              <div className="grid grid-cols-3 gap-2.5">
                <div><label htmlFor="evD" className={lbl}>DATE</label><input id="evD" type="date" value={v.date} onChange={(x) => set({ date: x.target.value })} className={inp} /></div>
                <div><label htmlFor="evS" className={lbl}>START</label><input id="evS" type="time" value={v.startTime} onChange={(x) => set({ startTime: x.target.value })} className={inp} /></div>
                <div><label htmlFor="evE" className={lbl}>END</label><input id="evE" type="time" value={v.endTime} onChange={(x) => set({ endTime: x.target.value })} className={inp} /></div>
              </div>
              <label htmlFor="evR" className={lbl}>REPEAT</label><select id="evR" value={v.repeat} onChange={(x) => set({ repeat: x.target.value })} className={inp}>{Object.entries(REPEAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <label htmlFor="evDs" className={lbl}>DESCRIPTION (OPTIONAL)</label><textarea id="evDs" rows={4} maxLength={1000} value={v.description} onChange={(x) => set({ description: x.target.value })} className={inp} />
              <label htmlFor="evBn" className={lbl}>COVER IMAGE URL (OPTIONAL)</label><input id="evBn" value={v.banner} onChange={(x) => set({ banner: x.target.value })} placeholder="Paste an image link from the Gallery" className={inp} />
              <p className="text-[11px] text-dim">Shown on the sign-up post and as the Discord event cover. Wide images (about 800×320) look best.</p>
            </>}
            {s === 2 && <>
              <h3 className="m-0 font-head tracking-[2px] text-cyan">SIGN-UPS</h3><p className="mb-0 mt-1 text-[11.5px] text-dim">Choose the buttons people press under the sign-up post.</p>
              <span className={lbl}>POST THE SIGN-UP IN</span><div role="radiogroup" aria-label="Sign-up channel">{d.signupChannels.map(([n, id]) => <button key={n} type="button" role="radio" aria-checked={!!id && v.channel === id} disabled={!id} title={id ? undefined : "Not found in Discord yet"} onClick={() => set({ channel: id })} className={`${pill(!!id && v.channel === id)} disabled:opacity-35`}>#{n}</button>)}</div>
              {!d.signupChannels.some(([, id]) => id) && <p className="text-[11px] text-dim">Channels appear once Cortana has synced the Discord server. Set them in COMMAND → Cortana Setup.</p>}
              <span className={lbl}>QUICK PRESETS</span><div>{PRESETS.map(([l, bs]) => <button key={l} type="button" onClick={() => set({ buttons: bs.map((b) => ({ ...b })) })} className={pill(false)}>{l}</button>)}</div>
              <span className={lbl}>BUTTONS ({v.buttons.length}/5)</span>
              {v.buttons.map((b, i) => (
                <div key={i} className="mb-1.5 grid items-center gap-1.5" style={{ gridTemplateColumns: "44px 52px 1fr 90px 70px 104px 30px" }}>
                  <span className="flex flex-col"><button type="button" disabled={!i} onClick={() => { const x = [...v.buttons]; [x[i - 1], x[i]] = [x[i]!, x[i - 1]!]; set({ buttons: x }); }} aria-label="Move up" className="text-[10px] text-dim disabled:opacity-25">▲</button>
                    <button type="button" disabled={i === v.buttons.length - 1} onClick={() => { const x = [...v.buttons]; [x[i + 1], x[i]] = [x[i]!, x[i + 1]!]; set({ buttons: x }); }} aria-label="Move down" className="text-[10px] text-dim disabled:opacity-25">▼</button></span>
                  <input value={b.emoji} maxLength={64} onChange={(x) => setB(i, { emoji: x.target.value })} aria-label="Emoji" placeholder="🙂" className={`${inp} text-center`} />
                  <input value={b.label} maxLength={40} onChange={(x) => setB(i, { label: x.target.value })} aria-label="Label" placeholder="Label" className={inp} />
                  <select value={b.style} onChange={(x) => setB(i, { style: x.target.value })} aria-label="Colour" className={inp}>{["blue", "green", "red", "grey"].map((c) => <option key={c} value={c}>{c[0]!.toUpperCase() + c.slice(1)}</option>)}</select>
                  <input type="number" min={0} max={500} value={b.limit || ""} onChange={(x) => setB(i, { limit: Number(x.target.value) || 0 })} placeholder="∞" aria-label="Places (empty = no limit)" className={inp} />
                  <label title="Attending: tagged when it starts and counted as going" className="flex items-center gap-1 text-[10.5px] tracking-[1px] text-[#c6d0da]"><input type="checkbox" checked={b.attending} onChange={(x) => setB(i, { attending: x.target.checked })} className="accent-cyan" /> ATTENDING</label>
                  <button type="button" onClick={() => set({ buttons: v.buttons.filter((_, j) => j !== i) })} aria-label="Remove button" className="border border-bad/50 py-1.5 text-bad">✕</button>
                </div>))}
              {v.buttons.length < 5 && <button type="button" onClick={() => set({ buttons: [...v.buttons, { emoji: "", label: "", style: "grey", limit: 0, attending: true }] })} className="border border-cyan/30 px-3 py-1.5 text-[11px] tracking-[1.5px] text-white">+ ADD BUTTON</button>}
              <p className="text-[11px] text-dim">Places: empty = no limit; a full button greys out. One choice per person — pressing another moves them. "Attending" people are tagged when it starts.</p>
              {w.editId && <p className="text-[11px] text-dim">Changing buttons keeps sign-ups on buttons that stay in the same position.</p>}
            </>}
            {s === 3 && <>
              <h3 className="m-0 font-head tracking-[2px] text-cyan">CHECK AND {w.editId ? "SAVE" : "CREATE"}</h3>
              <ul className="my-3 space-y-1.5 pl-0 text-[13px]" style={{ listStyle: "none" }}>
                <li>✓ <b className="text-white">{v.title || "Untitled"}</b> · {whenLabel(v)} (UK)</li><li>✓ Where: {whereLabel(v)}</li><li>✓ Discord event in the server's Events list</li>
                <li>✓ Sign-up post in #{chanLabel || "—"} · {v.buttons.map((b) => `${b.emoji} ${b.label}${b.limit ? ` (${b.limit})` : ""}`).join(" · ")}</li>
                <li>✓ {v.repeat === "none" ? REPEAT.none : `${REPEAT[v.repeat]} — next one is created automatically`}</li>
                <li>✓ Attending people tagged at the start · posts removed 30 minutes after</li>
                {v.linkAttendance ? <li>✓ <b className="text-white">Attendance Tracker event created</b> · sign-ups shown as SIGNED UP · NCO+ confirms at the Attendance Check</li> : <li className="opacity-55">✕ No attendance event</li>}
              </ul>
              {!(w.editId && !v.linkAttendance && d.events.find((x) => x.id === w.editId)?.attendanceEventId) && (
                <label className={`flex cursor-pointer gap-3 border px-3 py-2.5 ${v.linkAttendance ? "border-cyan bg-cyan/10" : "border-cyan/15"}`}>
                  <input type="checkbox" checked={v.linkAttendance} onChange={(x) => set({ linkAttendance: x.target.checked })} className="accent-cyan" />
                  <span><b className="text-white">▣ ALSO CREATE ATTENDANCE TRACKER EVENT</b><small className="block text-dim">Same title and date. People who press an "Attending" button show as SIGNED UP — not present. An NCO or above ticks who actually turned up at the Attendance Check, then Staff NCO+ locks it.</small></span></label>)}
              <p className="text-[11.5px]" style={{ color: d.cortanaOnline === false ? "#f59e0b" : "#22e07a" }}>{d.cortanaOnline === false ? "◷ Cortana is offline right now: the event is saved and posted to Discord automatically when Cortana is back." : "✓ Cortana posts the sign-up in Discord within a few seconds of CREATE."}</p>
            </>}
            {w.err && <p role="alert" className="text-[12px] text-bad">⚠ {w.err}</p>}
            <div className="mt-4 flex">{s > 0 && <button type="button" onClick={() => go(s - 1)} className="border border-cyan/25 px-3 py-2 text-[11px] tracking-[1.5px] text-white">← BACK</button>}<div className="flex-1" />
              {s < 3 ? <button type="button" onClick={() => go(s + 1)} className="border border-gold bg-gold px-4 py-2 text-[11px] font-bold tracking-[1.5px] text-black">NEXT</button>
                : <button type="button" disabled={p.busy} onClick={p.onSave} className="border border-gold bg-gold px-4 py-2 text-[11px] font-bold tracking-[1.5px] text-black disabled:opacity-50">{p.busy ? "SAVING…" : w.editId ? "SAVE EVENT" : "CREATE EVENT"}</button>}</div>
          </div>
          <aside className="text-[13px]">
            <span className="mb-1.5 block text-[10px] tracking-[2px] text-dim">DISCORD EVENT</span>
            <div className="mb-3 rounded-md bg-[#2b2d31] p-3 text-[#dbdee1]" style={{ fontFamily: "'gg sans','Segoe UI',sans-serif" }}>
              <div className="text-[12px] text-[#b5bac1]">📅 {whenLabel(v)}</div><div className="my-1 text-[16px] font-bold text-white">{v.title || "Event title"}</div>
              {v.description && <div className="text-[13px]">{v.description.slice(0, 200)}</div>}<div className="mt-2 text-[12px] text-[#b5bac1]">{whereLabel(v)}</div></div>
            <span className="mb-1.5 block text-[10px] tracking-[2px] text-dim">SIGN-UP POST</span>
            <div className="rounded-md bg-[#2b2d31] p-3 text-[#dbdee1]" style={{ fontFamily: "'gg sans','Segoe UI',sans-serif" }}>
              <div className="font-bold text-white">📌 {v.title || "Event title"}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px]">{v.buttons.map((b, i) => <div key={i}><b>{b.emoji} {b.label || "Label"}</b> <span className="text-[#b5bac1]">0{b.limit ? `/${b.limit}` : ""}</span></div>)}</div>
              <div className="mt-1">{v.buttons.map((b, i) => <span key={i} className="mr-1.5 mt-1.5 inline-block rounded px-3 py-1 text-[13px] text-white" style={{ background: BTN_BG[b.style] }}>{b.emoji} {b.label || "Label"}</span>)}</div></div>
            <p className="text-[11px] text-dim">Shows on the app calendar, website and Discord at the same time.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
