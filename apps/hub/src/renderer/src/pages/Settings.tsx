import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, Device, MediaItem, NetState, ShortcutId, Summary, SysInfo } from "../../../preload/api";
import { askBox } from "../components/Confirm";
import { PolicyText } from "../components/Policy";
import { ACCENTS, DEFAULT_KEYS, DEFAULT_SETTINGS, EVENTS, SHORTCUT_GROUPS, SHORTCUTS, THEMES, ZONES, SOUNDS, comboOf, fire, fmtDate, fmtTime, hashPin, mergeSettings, playDing, playSound } from "../settings";
import { STATE, type StateKey } from "../ui";
import logo from "../../../../assets/logo.png";
import rcd from "../../../../assets/rcd.png";
import notes from "../../../../RELEASE_NOTES.md?raw";
import { UpdateCheck } from "../components/UpdateBanner";

/**
 * SETTINGS v2 (approved mock 2026-11-12). Saved to your account (users/{uid}.hubPrefs.settings) so they follow you to every PC.
 * Sections: General · Appearance · Accessibility · Notifications · Security · My Devices · Shortcuts · Backup & Reset · About.
 */
export const SETTINGS_TABS = [
  ["my-settings", "⚙", "General", "start-up open on time zone clock date updates"],
  ["my-appearance", "🎨", "Appearance", "theme accent colour night ops glow corners background picture transparency side menu text size density colour-blind"],
  ["my-a11y", "♿", "Accessibility", "visual alerts flash colour pop-ups stay away banner captions sound text plain english font line spacing contrast animations focus bigger buttons screen reader"],
  ["my-notifications", "🔔", "Notifications", "do not disturb pop-up windows taskbar sound events test preview new device"],
  ["my-security", "🛡", "Security", "lock pin auto-lock streamer mode sign-in activity 2fa panic not me alerts"],
  ["my-devices", "🖥", "My Devices", "devices rename trust sign out rules max unused"],
  ["my-shortcuts", "⌨", "Shortcuts", "keyboard keys record reset cheat sheet pinned pages"],
  ["my-backup", "💾", "Backup & Reset", "sync restore points export import reset repair cache window logs"],
  ["my-about", "ⓘ", "About", "version what's new health diagnostics help report problem idea policy legal privacy credits"],
] as const;
type P = { tab: string; s: AppSettings; onChange: (s: AppSettings) => void; onPage: (pg: string) => void; sum: Summary; net: NetState; version: string; onLock: () => void; onStatus: (s: StateKey) => void; pins: string[] };
type SetS = (s: AppSettings) => void;
const ukDT = (iso: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");
const ago = (iso: string) => { if (!iso) return "—"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 3 ? "Now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

/* ───────── restore points (this PC, 30 days) ───────── */
type Snap = { at: string; why: string; s: AppSettings };
const RKEY = "cn:restore";
const snaps = (): Snap[] => { try { return (JSON.parse(localStorage.getItem(RKEY) || "[]") as Snap[]).filter((x) => Date.now() - Date.parse(x.at) < 30 * 864e5); } catch { return []; } };
function snapshot(why: string, s: AppSettings) {
  try { localStorage.setItem(RKEY, JSON.stringify([{ at: new Date().toISOString(), why, s }, ...snaps()].slice(0, 40))); } catch { /* storage full */ }
}
/** One automatic "daily" point per day, taken before the first change. */
function daily(s: AppSettings) { const d = new Date().toISOString().slice(0, 10); if (!snaps().some((x) => x.why === "Daily" && x.at.startsWith(d))) snapshot("Daily", s); }

export function Settings(p: P) {
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const change: SetS = useCallback((n) => { daily(p.s); p.onChange(n); }, [p]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); search.current?.focus(); } }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const hits = q.trim() ? SETTINGS_TABS.filter(([, , l, k]) => `${l} ${k}`.toLowerCase().includes(q.trim().toLowerCase())) : SETTINGS_TABS;
  const tab = SETTINGS_TABS.some(([id]) => id === p.tab) ? p.tab : "my-settings";
  const me = p.sum.me, st = STATE[me.status.state as StateKey] ?? STATE.online;
  const x = { ...p, onChange: change };
  return (
    <main className="flex min-w-0 flex-1 overflow-hidden" aria-label="Settings">
      <nav className="w-[236px] shrink-0 overflow-auto border-r border-cyan/15 py-3" aria-label="Settings sections">
        <div className="mx-3 mb-3 border border-cyan/15 bg-panel p-3">
          <div className="flex items-center gap-2.5"><div className="grid h-10 w-10 place-items-center border border-cyan/30 font-head text-[16px] text-cyan">{me.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1"><b className="block truncate text-[13px] text-white" title={me.name}>{me.name}</b><small className="block truncate text-[10px] tracking-[1px] text-dim">{me.rank.split(" / ").pop()} · {me.role.toUpperCase()}</small></div></div>
          <label className="mt-2 flex items-center gap-1.5 text-[10.5px] text-dim"><span className="dot" style={{ color: st.color, background: st.color }} />
            <select value={me.status.state === "offline" ? "online" : me.status.state} onChange={(e) => p.onStatus(e.target.value as StateKey)} aria-label="My status" className="flex-1 border border-cyan/20 bg-[#070a0f] px-1 py-0.5 text-[11px] text-white">
              <option value="online">Online</option><option value="dnd">Do not disturb</option><option value="invisible">Invisible</option></select></label>
        </div>
        <div className="mx-3 mb-2"><input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="⌕ Search settings (Ctrl+F)" aria-label="Search settings"
          onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { p.onPage(hits[0][0]); setQ(""); } if (e.key === "Escape") setQ(""); }}
          className="w-full border border-cyan/20 bg-[#070a0f] px-2 py-1.5 text-[12px] text-white outline-none focus:border-cyan" /></div>
        {hits.map(([id, ic, l]) => <button key={id} type="button" aria-current={tab === id} onClick={() => { p.onPage(id); setQ(""); }}
          className={`flex w-full gap-2.5 px-4 py-2.5 text-left text-[12.5px] ${tab === id ? "bg-cyan/10 text-cyan shadow-[inset_3px_0_0_var(--color-cyan)]" : "text-[#aeb9c4] hover:bg-cyan/5 hover:text-white"}`}><span className="w-4 text-center">{ic}</span>{l}</button>)}
        {!hits.length && <p className="px-4 text-[11px] text-dim">Nothing matches "{q}".</p>}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto px-7 py-5">
        {tab === "my-appearance" ? <Look {...x} /> : tab === "my-a11y" ? <A11y {...x} /> : tab === "my-notifications" ? <Notifs {...x} /> : tab === "my-security" ? <Security {...x} />
          : tab === "my-devices" ? <Devices {...x} /> : tab === "my-shortcuts" ? <Keys {...x} /> : tab === "my-backup" ? <Backup {...x} /> : tab === "my-about" ? <About {...x} /> : <General {...x} />}
      </div>
    </main>
  );
}

/* ───────── building blocks ───────── */
const Head = ({ t, d }: { t: string; d: string }) => <><h2 className="m-0 font-head text-[20px] font-bold tracking-[3px] text-white">{t}</h2><p className="mb-4 mt-0.5 text-[11px] tracking-[1px] text-dim">{d}</p></>;
const Group = ({ t, children, right }: { t: string; children: React.ReactNode; right?: React.ReactNode }) => <section className="card mb-4 max-w-[900px] bg-panel"><div className="flex items-center border-b border-cyan/10 px-3.5 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-cyan">{t}<span className="ml-auto">{right}</span></div>{children}</section>;
const Row = ({ t, d, children }: { t: string; d?: React.ReactNode; children?: React.ReactNode }) => <div className="flex items-center gap-3 border-b border-white/5 px-3.5 py-2.5 last:border-b-0"><div className="min-w-0 flex-1"><b className="block text-[12.5px] font-medium text-white">{t}</b>{d && <small className="text-[11px] text-dim">{d}</small>}</div>{children}</div>;
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-5 w-[38px] shrink-0 rounded-full transition ${on ? "bg-ok/35" : "bg-white/10"}`}>
    <i className={`absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all ${on ? "left-[21px] bg-ok" : "left-[3px] bg-dim"}`} /><span className="sr-only">{on ? "On" : "Off"}</span></button>;
}
function Seg<T extends string>({ v, opts, onChange, label }: { v: T; opts: [T, string][]; onChange: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="flex flex-wrap">{opts.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => onChange(k)}
    className={`-ml-px border px-2.5 py-1 text-[10.5px] tracking-[1px] first:ml-0 ${v === k ? "z-[1] border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim hover:text-white"}`}>{l}</button>)}</div>;
}
const Slider = ({ v, min, max, onChange, label, unit = "%" }: { v: number; min: number; max: number; onChange: (n: number) => void; label: string; unit?: string }) =>
  <div className="flex items-center gap-2"><input type="range" min={min} max={max} value={v} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="w-[160px] accent-[var(--color-cyan)]" /><span className="w-10 text-right text-[11px] tabular-nums text-white">{v}{unit}</span></div>;
const Btn = ({ children, onClick, tone, disabled }: { children: React.ReactNode; onClick: () => void; tone?: "bad" | "go"; disabled?: boolean }) =>
  <button type="button" disabled={disabled} onClick={onClick} className={`shrink-0 border px-2.5 py-1 text-[10.5px] tracking-[1.5px] disabled:opacity-40 ${tone === "bad" ? "border-bad/50 text-bad hover:bg-bad/10" : tone === "go" ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/25 text-white hover:bg-cyan/10"}`}>{children}</button>;
const Time = ({ v, onChange, label }: { v: string; onChange: (v: string) => void; label: string }) => <input type="time" value={v} aria-label={label} onChange={(e) => onChange(e.target.value)} className="border border-cyan/20 bg-[#070a0f] px-1.5 py-0.5 text-[11px] text-white" />;
const Note = ({ children }: { children: React.ReactNode }) => <p className="m-0 border-t border-white/5 px-3.5 py-2 text-[10.5px] text-dimmer">{children}</p>;
const Flash = ({ msg }: { msg: string | null }) => (msg ? <p role="status" className="mb-3 max-w-[900px] border-l-2 border-cyan bg-cyan/5 px-3 py-1.5 text-[12px] text-cyan">{msg}</p> : null);

/* ───────── GENERAL ───────── */
function General({ s, onChange, onPage }: P) {
  const set = (x: Partial<AppSettings>) => onChange({ ...s, ...x });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const d = new Date(now), pc = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoneOpts = useMemo(() => [...new Set([pc, ...ZONES.map(([z]) => z)])], [pc]);
  const [addTz, setAddTz] = useState("America/Los_Angeles");
  const [news, setNews] = useState(false);
  return <>
    <Head t="⚙ GENERAL" d="START-UP · TIME & REGION · UPDATES" />
    <Group t="START-UP">
      <Row t="Start with Windows" d="Opens in the tray when you log in (installed app only)"><Toggle on={s.startup} onChange={(v) => set({ startup: v })} label="Start with Windows" /></Row>
      <Row t="Close button hides to tray" d="Keeps notifications coming. Quit from the tray icon."><Toggle on={s.closeToTray} onChange={(v) => set({ closeToTray: v })} label="Close hides to tray" /></Row>
      <Row t="Open on"><Seg v={s.openOn} label="Open on" opts={[["dashboard", "DASHBOARD"], ["last", "LAST PAGE"], ["messages", "MESSAGES"]]} onChange={(v) => set({ openOn: v })} /></Row>
    </Group>
    <Group t="TIME & REGION">
      <Row t="My time zone" d={s.tzPin ? "📌 Pinned — stays the same on every PC" : `Following this PC (${pc})`}>
        <select value={s.tz || pc} onChange={(e) => set({ tz: e.target.value === pc && !s.tzPin ? "" : e.target.value })} aria-label="My time zone" className="border border-cyan/20 bg-[#070a0f] px-1.5 py-1 text-[11px] text-white">
          {zoneOpts.map((z) => <option key={z} value={z}>{z}</option>)}</select>
        <Btn onClick={() => set({ tzPin: !s.tzPin, tz: !s.tzPin ? s.tz || pc : "" })}>{s.tzPin ? "📌 UNPIN" : "📌 PIN"}</Btn></Row>
      <Row t="Top bar clock" d={`UK ${fmtTime(d, "Europe/London")} · You ${fmtTime(d, s.tz || undefined)}`}><Seg v={s.time} label="Clock" opts={[["uk", "UK"], ["local", "MY TIME"], ["both", "BOTH"]]} onChange={(v) => set({ time: v })} /></Row>
      <Row t="Extra clocks" d="Up to 3 more in the top bar (wide windows)">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {s.clocks.map((c, i) => <span key={i} className="flex items-center gap-1 border border-cyan/25 px-2 py-0.5 text-[11px] text-white">{c.label} <b className="font-normal text-dim">{fmtTime(d, c.tz)}</b>
            <button type="button" aria-label={`Remove ${c.label}`} onClick={() => set({ clocks: s.clocks.filter((_, j) => j !== i) })} className="text-dim hover:text-bad">✕</button></span>)}
          {s.clocks.length < 3 && <><select value={addTz} onChange={(e) => setAddTz(e.target.value)} aria-label="Add a clock" className="border border-cyan/20 bg-[#070a0f] px-1 py-0.5 text-[11px] text-white">
            {ZONES.map(([z, l]) => <option key={z} value={z}>{l} — {z}</option>)}</select>
            <Btn onClick={() => set({ clocks: [...s.clocks, { tz: addTz, label: ZONES.find(([z]) => z === addTz)?.[1] ?? addTz }] })}>＋ ADD</Btn></>}
        </div></Row>
      <Row t="Date style" d={`Today: ${fmtDate(d)}`}><Seg v={s.dateStyle} label="Date style" opts={[["dmy", "31/12/2026"], ["mdy", "12/31/2026"], ["iso", "2026-12-31"]]} onChange={(v) => set({ dateStyle: v })} /></Row>
      <Row t="24-hour clock"><Toggle on={s.h24} onChange={(v) => set({ h24: v })} label="24-hour clock" /></Row>
      <Note>Op times on the website and in Discord stay in UK time — the unit's time.</Note>
    </Group>
    <Group t="UPDATES">
      <Row t="Install updates by itself" d="Only when you're away from the PC — never while an op is running"><Toggle on={s.autoUpdate} onChange={(v) => set({ autoUpdate: v })} label="Auto-install updates" /></Row>
      <Row t="Check now"><UpdateCheck /></Row>
      <Row t="What's new"><Btn onClick={() => setNews(true)}>✨ WHAT'S NEW</Btn></Row>
      <Row t="Help pages" d="Plain-English guides"><Btn onClick={() => onPage("my-about")}>OPEN HELP</Btn></Row>
    </Group>
    {news && <WhatsNew onClose={() => setNews(false)} />}
  </>;
}

function Modal({ t, onClose, children, w = 620 }: { t: string; onClose: () => void; children: React.ReactNode; w?: number }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  return <div role="dialog" aria-modal="true" aria-label={t} onMouseDown={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-[150] grid place-items-center bg-black/70">
    <div className="cfm-pop max-h-[84vh] overflow-auto border border-cyan/30 bg-panel" style={{ width: w }}>
      <div className="sticky top-0 flex items-center border-b border-cyan/15 bg-panel px-4 py-3 font-head text-[15px] font-bold tracking-[3px] text-cyan">{t}<button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-[16px] text-dim hover:text-white">✕</button></div>
      <div className="p-4">{children}</div></div></div>;
}
function WhatsNew({ onClose }: { onClose: () => void }) {
  const lines = notes.split(/\r?\n/).filter((l) => l.trim());
  return <Modal t="✨ WHAT'S NEW" onClose={onClose}>
    {lines.map((l, i) => /^505th Command Network v/.test(l) ? <div key={i} className="mb-1.5 mt-3 font-head text-[14px] font-bold tracking-[2px] text-white first:mt-0">{l.replace("505th Command Network ", "").toUpperCase()}</div>
      : <div key={i} className="flex gap-2 py-0.5 text-[12.5px] text-[#c6d0da]"><span className="text-cyan">{/NEW/.test(l) ? "✚" : /fix|now/i.test(l) ? "✓" : "•"}</span>{l.replace(/^-\s*/, "")}</div>)}
  </Modal>;
}

/* ───────── APPEARANCE ───────── */
function Look({ s, onChange }: P) {
  const L = s.look;
  const set = (x: Partial<AppSettings["look"]>) => onChange({ ...s, look: { ...L, ...x } });
  const [pics, setPics] = useState<MediaItem[] | null>(null);
  return <>
    <Head t="🎨 APPEARANCE" d="MAKE THE HUB YOURS · ONLY CHANGES YOUR SCREEN" />
    <Group t="THEME">
      <div className="grid grid-cols-4 gap-2 p-3.5">{(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => { const t = THEMES[k]; return (
        <button key={k} type="button" aria-pressed={L.theme === k} onClick={() => set({ theme: k, accent: "" })} className={`border p-2 text-left ${L.theme === k ? "border-cyan" : "border-white/10 hover:border-white/30"}`} style={{ background: t.panel }}>
          <div className="mb-2 h-10 border" style={{ borderColor: t.accent + "66", background: `linear-gradient(135deg, ${t.panel2}, ${t.accent}22)` }}><div className="m-1.5 h-1.5 w-1/2" style={{ background: t.accent }} /></div>
          <b className="text-[11px] tracking-[1px]" style={{ color: t.accent }}>{t.name.toUpperCase()}</b>{L.theme === k && <span className="float-right text-[11px] text-ok">✓</span>}</button>); })}</div>
      <Row t="Accent colour" d="Buttons, borders and glows">
        <div className="flex gap-1.5">{ACCENTS.map((c) => <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={(L.accent || THEMES[L.theme].accent) === c} onClick={() => set({ accent: c })}
          className={`h-6 w-6 rounded-full border-2 ${(L.accent || THEMES[L.theme].accent) === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}
          {L.accent && <Btn onClick={() => set({ accent: "" })}>THEME COLOUR</Btn>}</div></Row>
      <Row t="Night Ops by itself" d={L.nightAuto ? `Dark red theme from ${L.nightFrom} to ${L.nightTo} (your time) — easy on the eyes` : "Switch to the Night Ops theme at night"}>
        {L.nightAuto && <><Time v={L.nightFrom} label="Night from" onChange={(v) => set({ nightFrom: v })} />–<Time v={L.nightTo} label="Night until" onChange={(v) => set({ nightTo: v })} /></>}
        <Toggle on={L.nightAuto} onChange={(v) => set({ nightAuto: v })} label="Night Ops by itself" /></Row>
    </Group>
    <Group t="STYLE">
      <Row t="Glow" d="How much panels glow"><Slider v={L.glow} min={0} max={100} label="Glow" onChange={(v) => set({ glow: v })} /></Row>
      <Row t="Corners"><Seg v={L.corners} label="Corners" opts={[["sharp", "▢ SHARP"], ["round", "▢ ROUNDED"]]} onChange={(v) => set({ corners: v })} /></Row>
      <Row t="Background"><Seg v={L.bg} label="Background" opts={[["plain", "PLAIN"], ["grid", "GRID"], ["hex", "HEX"], ["scan", "SCANLINES"], ["picture", "PICTURE"]]} onChange={(v) => { set({ bg: v }); if (v === "picture" && !pics) void window.cn.hub.media().then((r) => setPics("error" in r ? [] : r.items.filter((i) => i.type === "image" && i.enabled))); }} /></Row>
      {L.bg === "picture" && <>
        <div className="flex gap-2 overflow-x-auto border-b border-white/5 px-3.5 py-2.5">{pics === null ? <span className="text-[11px] text-dim">Loading the 505th gallery…</span> : !pics.length ? <span className="text-[11px] text-dim">No gallery pictures.</span>
          : pics.slice(0, 30).map((m) => <button key={m.id} type="button" aria-label={m.name} aria-pressed={L.bgUrl === m.url} onClick={() => set({ bgUrl: m.url })} className={`h-14 w-24 shrink-0 border-2 bg-cover bg-center ${L.bgUrl === m.url ? "border-cyan" : "border-transparent"}`} style={{ backgroundImage: `url("${m.url}")` }} />)}</div>
        <Row t="Picture blur"><Slider v={L.bgBlur} min={0} max={20} unit="px" label="Picture blur" onChange={(v) => set({ bgBlur: v })} /></Row>
        <Row t="Picture darkness" d="Darker = easier to read"><Slider v={L.bgDark} min={0} max={95} label="Picture darkness" onChange={(v) => set({ bgDark: v })} /></Row></>}
      <Row t="Card see-through" d="100% = solid"><Slider v={L.cards} min={50} max={100} label="Card see-through" onChange={(v) => set({ cards: v })} /></Row>
    </Group>
    <Group t="LAYOUT">
      <Row t="Side menu"><Seg v={L.side} label="Side menu" opts={[["full", "FULL"], ["icons", "ICONS ONLY"], ["auto", "AUTO-HIDE"]]} onChange={(v) => set({ side: v })} /></Row>
      <Row t="Text size" d="Makes the whole app bigger or smaller"><Seg v={s.textSize} label="Text size" opts={[["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]]} onChange={(v) => onChange({ ...s, textSize: v })} /></Row>
      <Row t="Density" d="Space between things"><Seg v={L.density} label="Density" opts={[["compact", "COMPACT"], ["normal", "NORMAL"], ["roomy", "ROOMY"]]} onChange={(v) => set({ density: v })} /></Row>
      <Row t="Colour-blind status colours" d="Blue / orange instead of green / red"><Toggle on={L.cb} onChange={(v) => set({ cb: v })} label="Colour-blind colours" /></Row>
      <Row t="Reset look" d="Back to 505th Cyan and the default style"><Btn onClick={async () => { if (await askBox("RESET THE LOOK?\n\nTheme, colours, background and layout go back to default.")) { snapshot("Before reset look", s); onChange({ ...s, textSize: "m", look: { ...DEFAULT_SETTINGS.look } }); } }}>↺ RESET LOOK</Btn></Row>
    </Group>
  </>;
}

/* ───────── ACCESSIBILITY ───────── */
function A11y({ s, onChange }: P) {
  const A = s.a11y;
  const set = (x: Partial<AppSettings["a11y"]>) => onChange({ ...s, a11y: { ...A, ...x } });
  const test = () => fire("test", { id: "a11y-test", title: "Visual alert test", body: "This is how a visual alert looks.", icon: "👁", urgent: true }, { popup: true, taskbar: false, edge: true, sound: false });
  return <>
    <Head t="♿ ACCESSIBILITY" d="SEE EVERYTHING — NOTHING DEPENDS ON SOUND" />
    <Group t="VISUAL ALERTS" right={<Btn tone="go" onClick={test}>▶ TEST</Btn>}>
      <Row t="Alert style" d="What flashes on your screen for urgent alerts"><Seg v={A.style} label="Alert style" opts={[["edge", "▭ SCREEN EDGE"], ["tint", "▣ SCREEN TINT"], ["badge", "● CORNER DOT"]]} onChange={(v) => set({ style: v })} /></Row>
      <Row t="Alert colour"><div className="flex gap-1.5">{["#f59e0b", "#ff4d4d", "#00d9ff", "#22e07a", "#a78bfa", "#ffffff"].map((c) => <button key={c} type="button" aria-label={`Alert colour ${c}`} aria-pressed={A.color === c} onClick={() => set({ color: c })}
        className={`h-6 w-6 rounded-full border-2 ${A.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}</div></Row>
      <Row t="Flash until I notice" d="Keeps flashing until you move the mouse (max 1 minute)"><Toggle on={A.until} onChange={(v) => set({ until: v })} label="Flash until noticed" /></Row>
      <Row t="Safe flash" d="Slow fade, no fast blinking"><Toggle on={A.safe} onChange={(v) => set({ safe: v })} label="Safe flash" /></Row>
    </Group>
    <Group t="NEVER MISS ANYTHING">
      <Row t="Pop-ups stay until I close them" d="No 8-second timer"><Toggle on={A.stay} onChange={(v) => set({ stay: v })} label="Pop-ups stay" /></Row>
      <Row t={'"While you were away" banner'} d="When you come back after 2+ minutes, shows what's new"><Toggle on={A.away} onChange={(v) => set({ away: v })} label="While you were away banner" /></Row>
      <Row t="Text for every sound" d="If a sound plays, a caption shows too"><Toggle on={A.soundText} onChange={(v) => set({ soundText: v })} label="Text for every sound" /></Row>
    </Group>
    <Group t="READING">
      <Row t="Easy-read font" d="Plain Segoe UI instead of the tech font"><Toggle on={A.easyFont} onChange={(v) => set({ easyFont: v })} label="Easy-read font" /></Row>
      <Row t="Line spacing"><Seg v={A.lines} label="Line spacing" opts={[["normal", "NORMAL"], ["wide", "WIDE"]]} onChange={(v) => set({ lines: v })} /></Row>
      <Row t="Plain English" d="Short, simple words in help and messages from the Hub"><Toggle on={A.plain} onChange={(v) => set({ plain: v })} label="Plain English" /></Row>
      <Row t="High contrast" d="Brighter text and borders"><Toggle on={s.contrast} onChange={(v) => onChange({ ...s, contrast: v })} label="High contrast" /></Row>
      <Row t="Colour-blind status colours"><Toggle on={s.look.cb} onChange={(v) => onChange({ ...s, look: { ...s.look, cb: v } })} label="Colour-blind colours" /></Row>
      <Row t="Animations" d="Glows, sweeps, pop-ins"><Seg v={s.anim} label="Animations" opts={[["on", "ON"], ["reduced", "REDUCED"], ["off", "OFF"]]} onChange={(v) => onChange({ ...s, anim: v })} /></Row>
    </Group>
    <Group t="CONTROL">
      <Row t="Strong focus outline" d="Thick outline round what the keyboard is on (alert colour)"><Toggle on={A.focus} onChange={(v) => set({ focus: v })} label="Strong focus" /></Row>
      <Row t="Bigger buttons" d="Easier to click"><Toggle on={A.big} onChange={(v) => set({ big: v })} label="Bigger buttons" /></Row>
      <Row t="More time" d="Pop-ups and messages wait longer"><Toggle on={A.moreTime} onChange={(v) => set({ moreTime: v, stay: v || A.stay })} label="More time" /></Row>
      <Row t="Sound" d="Alert ding — off by default"><Toggle on={s.notify.sound} onChange={(v) => onChange({ ...s, notify: { ...s.notify, sound: v } })} label="Sound" /></Row>
      <Row t="Screen reader support" d="Reads new alerts out (status messages)"><Toggle on={A.reader} onChange={(v) => set({ reader: v })} label="Screen reader" /></Row>
    </Group>
    <Group t="QUICK SET">
      <Row t="Visual-first preset" d="Pop-ups stay · flash until noticed · captions · away banner · strong focus">
        <Btn tone="go" onClick={() => set({ stay: true, until: true, soundText: true, away: true, focus: true, style: "edge" })}>APPLY</Btn></Row>
    </Group>
  </>;
}

/* ───────── NOTIFICATIONS ───────── */
function Notifs({ s, onChange }: P) {
  const n = s.notify;
  const set = (x: Partial<AppSettings["notify"]>) => onChange({ ...s, notify: { ...n, ...x } });
  const [test, setTest] = useState<"all" | "popup" | "win" | "edge" | "bar" | "sound" | "every">("all");
  const [cols, setCols] = useState({ popup: true, bell: true, flash: true });
  const box = (on: boolean, flip: () => void, label: string) => <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={flip}
    className={`mx-auto grid h-4 w-4 place-items-center border text-[11px] ${on ? "border-ok bg-ok text-black" : "border-cyan/60"}`}>{on ? "✓" : ""}</button>;
  const [from, to] = n.dnd === "night" ? ["23:00", "08:00"] : [n.dndFrom, n.dndTo];
  const pct = (t: string) => { const [h, m] = t.split(":").map(Number); return ((h! * 60 + m!) / 1440) * 100; };
  const colFlip = (c: "popup" | "bell" | "flash") => { const all = EVENTS.every(([k]) => n.ev[k][c]); set({ ev: Object.fromEntries(EVENTS.map(([k]) => [k, { ...n.ev[k], [c]: !all }])) as AppSettings["notify"]["ev"] }); };
  return <>
    <Head t="🔔 NOTIFICATIONS" d="CHOOSE WHAT TELLS YOU, AND HOW · SAVED TO YOUR ACCOUNT" />
    <Group t="DO NOT DISTURB">
      <Row t="Do not disturb" d={n.dnd === "off" ? "Alerts always pop up" : "Alerts wait in the 🔔 bell"}>
        {n.dnd === "custom" && <><Time v={n.dndFrom} label="Quiet from" onChange={(v) => set({ dndFrom: v })} />–<Time v={n.dndTo} label="Quiet until" onChange={(v) => set({ dndTo: v })} /></>}
        <Seg v={n.dnd} label="Do not disturb" opts={[["off", "OFF"], ["on", "ALWAYS"], ["night", "NIGHT"], ["custom", "CUSTOM"]]} onChange={(v) => set({ dnd: v })} /></Row>
      {(n.dnd === "night" || n.dnd === "custom") && <div className="border-b border-white/5 px-3.5 py-2.5"><div className="relative h-3 bg-white/5" aria-hidden="true">
        {(pct(from) <= pct(to) ? [[pct(from), pct(to)]] : [[pct(from), 100], [0, pct(to)]]).map(([a, b], i) => <div key={i} className="absolute top-0 h-3 bg-bad/40" style={{ left: `${a}%`, width: `${b! - a!}%` }} />)}
        <div className="absolute -top-0.5 h-4 w-0.5 bg-cyan" style={{ left: `${pct(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}%` }} /></div>
        <div className="mt-1 flex justify-between text-[9.5px] text-dimmer"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00 UK</span></div></div>}
      <Row t="Let op alerts through" d="Ops starting still pop up during do not disturb"><Toggle on={n.letOps} onChange={(v) => set({ letOps: v })} label="Let op alerts through" /></Row>
    </Group>
    <Group t="HOW">
      <Row t="Pop-up cards" d="Bottom right of the screen — shows over games and other apps"><Toggle on={n.popup} onChange={(v) => set({ popup: v })} label="Pop-up cards" /></Row>
      <Row t="Windows notifications" d="Also in the Windows notification centre (Win + N)"><Toggle on={n.windows} onChange={(v) => set({ windows: v })} label="Windows notifications" /></Row>
      <Row t="Flash the taskbar button" d="Until you open the Hub"><Toggle on={n.taskbar} onChange={(v) => set({ taskbar: v })} label="Taskbar flash" /></Row>
      <Row t="Visual alert on screen (urgent)" d="Style and colour: Accessibility → Visual alerts"><Toggle on={n.edge} onChange={(v) => set({ edge: v })} label="Visual screen alert" /></Row>
      <Row t="Show message text in pop-ups" d="Off = just 'new message' (good when streaming)"><Toggle on={n.preview} onChange={(v) => set({ preview: v })} label="Message preview" /></Row>
      <Row t="Tell me when a new device signs in"><Toggle on={n.newDevice} onChange={(v) => set({ newDevice: v })} label="New device alert" /></Row>
    </Group>
    <Sounds s={s} onChange={onChange} />
    <Group t="WHAT">
      <table className="w-full border-collapse text-[12.5px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim"><th className="px-3.5 py-2 text-left font-normal">EVENT</th>
        {(["popup", "bell", "flash"] as const).map((c) => <th key={c} className="w-[86px] py-2 text-center font-normal"><button type="button" onClick={() => setCols({ ...cols, [c]: !cols[c] })} className="hover:text-white">{c === "popup" ? "POP-UP" : c.toUpperCase()} {cols[c] ? "▾" : "▸"}</button>
          {cols[c] && <button type="button" onClick={() => colFlip(c)} className="block w-full text-[9px] text-dimmer hover:text-cyan">ALL ON/OFF</button>}</th>)}</tr></thead>
        <tbody>{EVENTS.map(([k, ic, l]) => <tr key={k} className="border-t border-white/5"><td className="px-3.5 py-2 text-white">{ic} {k === "op" ? <>Op starting in <select value={n.opMins} onChange={(e) => set({ opMins: Number(e.target.value) })} aria-label="Minutes before an op" className="border border-cyan/20 bg-[#070a0f] px-1 text-[11px] text-white">{[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></> : l}</td>
          {(["popup", "bell", "flash"] as const).map((c) => <td key={c} className="py-2 text-center">{cols[c] ? box(n.ev[k][c], () => set({ ev: { ...n.ev, [k]: { ...n.ev[k], [c]: !n.ev[k][c] } } }), `${l} — ${c}`) : <span className="text-dimmer">·</span>}</td>)}</tr>)}</tbody></table>
      <Row t="Test it" d="Pick what to try, then press the button">
        <Seg v={test} label="What to test" opts={[["all", "ALL"], ["popup", "POP-UP"], ["win", "WINDOWS"], ["edge", "SCREEN"], ["bar", "TASKBAR"], ["sound", "🔊"], ["every", "ALL + 🔊"]]} onChange={setTest} />
        <Btn tone="go" onClick={() => { const all = test === "all" || test === "every";
          if (test === "sound") { playDing(); if (s.a11y.soundText) dispatchEvent(new CustomEvent("hub:caption", { detail: "🔊 Sound: test ding" })); return; }
          fire("test", { id: "test", title: "Test notification", body: "This is how alerts look on your screen.", icon: "🔔", urgent: true, actions: [{ id: "open", label: "OPEN" }] },
            { popup: all || test === "popup", windows: all || test === "win", edge: all || test === "edge", taskbar: all || test === "bar", sound: test === "every" }); }}>▶ SEND TEST</Btn></Row>
      <Note>Real alerts only pop up when the Hub isn't the window you're looking at (tests always show). Taskbar flash: switch to another window within 5 s to see it.</Note>
    </Group>
  </>;
}

/* ───────── ALERT SOUNDS (approved mock 2026-11-13) ───────── */
function Sounds({ s, onChange }: { s: AppSettings; onChange: (s: AppSettings) => void }) {
  const S = s.sounds;
  const set = (x: Partial<AppSettings["sounds"]>) => onChange({ ...s, sounds: { ...S, ...x } });
  const [msg, setMsg] = useState<string | null>(null);
  const [cap, setCap] = useState("");
  const play = (id: string) => { const n = playSound(id, s); if (n) { setCap(`🔊 Sound: ${n}`); setTimeout(() => setCap(""), 2500); } };
  const opts: [string, string][] = [...SOUNDS.map(([id, l]) => [id, l] as [string, string]), ...S.mine.map((m) => [m.id, `🎵 ${m.name}`] as [string, string]), ["none", "— None"]];
  const upload = async (f: File) => {
    if (!/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg)$/.test(f.type)) return setMsg("MP3 or WAV only.");
    if (f.size > 1_000_000) return setMsg("Too big — 1 MB max.");
    const dur = await new Promise<number>((res) => { const a = new Audio(URL.createObjectURL(f)); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); });
    if (dur > 5.5) return setMsg("Too long — 5 seconds max.");
    if (S.mine.length >= 8) return setMsg("8 sounds max — delete one first.");
    setMsg("Uploading…");
    const r = await window.cn.hub.upload("505th_sounds", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
    if (!r.url) return setMsg(r.error ?? "Upload failed");
    set({ mine: [...S.mine, { id: `my${Date.now().toString(36)}`, name: f.name.replace(/\.[^.]+$/, "").slice(0, 30), url: r.url }] }); setMsg("Sound added");
  };
  return <Group t="🔊 ALERT SOUNDS" right={<span className="text-[10px] font-normal tracking-[1px] text-dim">CAPTION ALWAYS SHOWS</span>}>
    <Row t="Play sounds" d="Off by default — every sound also shows a caption"><Toggle on={s.notify.sound} onChange={(v) => onChange({ ...s, notify: { ...s.notify, sound: v } })} label="Play sounds" /></Row>
    <Row t="Volume"><Slider v={S.vol} min={0} max={100} label="Volume" onChange={(v) => set({ vol: v })} /></Row>
    {EVENTS.map(([k, ic, l]) => <Row key={k} t={`${ic} ${l}`}>
      <select value={S.map[k] ?? "chime"} aria-label={`Sound for ${l}`} onChange={(e) => set({ map: { ...S.map, [k]: e.target.value } })} className="border border-cyan/20 bg-[#070a0f] px-1.5 py-1 text-[11px] text-white">{opts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      <Btn onClick={() => play(S.map[k] ?? "chime")}>▶ PLAY</Btn></Row>)}
    <Row t="My own sounds" d={`MP3 / WAV · up to 1 MB · 5 seconds · ${S.mine.length}/8`}>
      <label className="shrink-0 cursor-pointer border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white hover:bg-cyan/10">＋ UPLOAD<input type="file" accept="audio/mpeg,audio/wav,audio/ogg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label></Row>
    {S.mine.map((m) => <Row key={m.id} t={`🎵 ${m.name}`}><Btn onClick={() => play(m.id)}>▶</Btn>
      <Btn tone="bad" onClick={() => set({ mine: S.mine.filter((x) => x.id !== m.id), map: Object.fromEntries(Object.entries(S.map).map(([k, v]) => [k, v === m.id ? "chime" : v])) })}>DELETE</Btn></Row>)}
    {(msg || cap) && <Note>{cap || msg}</Note>}
  </Group>;
}

/* ───────── SECURITY ───────── */
function Security({ s, onChange, onLock, onPage }: P) {
  const S = s.security;
  const set = (x: Partial<AppSettings["security"]>) => onChange({ ...s, security: { ...S, ...x } });
  const [d, setD] = useState<{ devices: Device[]; recent: Device[] } | null>(null);
  const [pin, setPin] = useState<{ a: string; b: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void window.cn.hub.devices().then((r) => !("error" in r) && setD(r)); }, []);
  const checks: [string, boolean, string, () => void][] = [
    ["Hub PIN set", !!S.pinHash, "SET PIN", () => setPin({ a: "", b: "" })],
    ["Hub locks by itself", S.lock !== "off" && !!S.pinHash, "TURN ON", () => set({ lock: "15" })],
    ["New-device alerts on", s.notify.newDevice, "TURN ON", () => onChange({ ...s, notify: { ...s.notify, newDevice: true } })],
    ["Security alerts on", S.alerts, "TURN ON", () => set({ alerts: true })],
    [`Devices within your limit (${s.devices.max})`, !d || d.devices.length <= s.devices.max, "REVIEW", () => onPage("my-devices")],
  ];
  const score = Math.round((checks.filter((c) => c[1]).length / checks.length) * 100);
  const col = score >= 80 ? "#22e07a" : score >= 50 ? "#f59e0b" : "#ff4d4d";
  const savePin = async () => {
    if (!pin) return;
    if (!/^\d{4,8}$/.test(pin.a)) return setMsg("PIN must be 4–8 numbers.");
    if (pin.a !== pin.b) return setMsg("The two PINs don't match.");
    set({ pinHash: await hashPin(pin.a), lock: S.lock === "off" ? "15" : S.lock });
    setPin(null); setMsg("Hub PIN saved. Ctrl+L locks the Hub.");
  };
  return <>
    <Head t="🛡 SECURITY" d="KEEP YOUR ACCOUNT AND THE 505TH SAFE" />
    <Flash msg={msg} />
    <Group t="SECURITY CHECK">
      <div className="flex items-center gap-5 px-3.5 py-3">
        <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Security score ${score} out of 100`}><circle cx="42" cy="42" r="36" fill="none" stroke="#ffffff14" strokeWidth="7" />
          <circle cx="42" cy="42" r="36" fill="none" stroke={col} strokeWidth="7" strokeDasharray={`${(score / 100) * 226} 226`} transform="rotate(-90 42 42)" strokeLinecap="round" />
          <text x="42" y="48" textAnchor="middle" fill="#fff" fontSize="20" fontFamily="Rajdhani">{score}</text></svg>
        <div className="flex-1">{checks.map(([t, ok, b, fix]) => <div key={t} className="flex items-center gap-2 py-0.5 text-[12.5px]"><span style={{ color: ok ? "#22e07a" : "#f59e0b" }}>{ok ? "✓" : "⚠"}</span><span className={ok ? "text-[#aeb9c4]" : "text-white"}>{t}</span>
          {!ok && <button type="button" onClick={fix} className="ml-auto border border-amber/50 px-2 text-[10px] tracking-[1px] text-amber hover:bg-amber/10">{b}</button>}</div>)}</div></div>
      <Note>Discord two-factor (2FA): turn it on in Discord → User Settings → My Account. The Hub can't see it yet.</Note>
    </Group>
    <Group t="HUB LOCK">
      <Row t="Hub PIN" d={S.pinHash ? "Set — needed to unlock the Hub" : "Not set. 4–8 numbers, only for this Hub."}>
        {S.pinHash && <Btn tone="bad" onClick={() => set({ pinHash: "", lock: "off" })}>REMOVE</Btn>}<Btn onClick={() => setPin({ a: "", b: "" })}>{S.pinHash ? "CHANGE PIN" : "SET PIN"}</Btn></Row>
      {pin && <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-2.5">
        {(["a", "b"] as const).map((k) => <input key={k} type="password" inputMode="numeric" maxLength={8} autoFocus={k === "a"} placeholder={k === "a" ? "New PIN" : "Again"} aria-label={k === "a" ? "New PIN" : "PIN again"} value={pin[k]}
          onChange={(e) => setPin({ ...pin, [k]: e.target.value.replace(/\D/g, "") })} onKeyDown={(e) => e.key === "Enter" && void savePin()} className="w-[120px] border border-cyan/30 bg-[#070a0f] px-2 py-1 text-[13px] tracking-[4px] text-white" />)}
        <Btn tone="go" onClick={() => void savePin()}>SAVE</Btn><Btn onClick={() => setPin(null)}>CANCEL</Btn></div>}
      <Row t="Lock by itself" d="After you're away from the PC"><Seg v={S.lock} label="Auto-lock" opts={[["off", "OFF"], ["5", "5 MIN"], ["15", "15 MIN"], ["60", "1 HOUR"], ["sleep", "ON SLEEP"]]} onChange={(v) => S.pinHash ? set({ lock: v }) : setMsg("Set a Hub PIN first.")} /></Row>
      <Row t="Lock now" d={`Shortcut: ${s.keys.lock}`}><Btn onClick={() => (S.pinHash ? onLock() : setMsg("Set a Hub PIN first."))}>🔒 LOCK</Btn></Row>
      <Note>Windows Hello isn't available to the Hub yet, so the lock uses a Hub PIN. Forgot it? Sign out and sign in with Discord.</Note>
    </Group>
    <Group t="STREAMER MODE">
      <Row t="Streamer mode" d="Blurs Discord pictures and hides message text in pop-ups — hover to see"><Toggle on={S.streamer} onChange={(v) => { set({ streamer: v }); }} label="Streamer mode" /></Row>
      <Note>Auto-on when OBS or Discord screen share starts isn't possible yet — turn it on yourself before streaming.</Note>
    </Group>
    <Group t="SIGN-IN ACTIVITY">
      {!d ? <p className="m-0 px-3.5 py-2 text-[12px] text-dim">Loading…</p> : <table className="w-full text-[12px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim"><th className="px-3.5 py-1.5 text-left font-normal">DEVICE</th><th className="text-left font-normal">SIGNED IN</th><th className="text-left font-normal">LAST USED</th><th className="pr-3.5 text-right font-normal">STATUS</th></tr></thead>
        <tbody>{d.recent.map((x) => <tr key={x.id} className="border-t border-white/5"><td className="px-3.5 py-1.5 text-white">{x.name}{x.current && <span className="ml-1.5 text-[10px] text-ok">THIS PC</span>}</td><td className="text-dim">{ukDT(x.signedInAt)}</td><td className="text-dim">{ago(x.lastUsedAt)}</td>
          <td className="pr-3.5 text-right">{x.revokedAt ? <span className="text-dim">Signed out</span> : x.expiresAt && Date.parse(x.expiresAt) < Date.now() ? <span className="text-dim">Expired</span> : <span className="text-ok">Active</span>}</td></tr>)}</tbody></table>}
      <Note>City / location isn't recorded for sign-ins yet.</Note>
    </Group>
    <Group t="ALERTS & EMERGENCY">
      <Row t="Security alerts" d="Tell me about new sign-ins and lock-outs"><Toggle on={S.alerts} onChange={(v) => set({ alerts: v })} label="Security alerts" /></Row>
      <Row t="🚨 NOT ME" d="See a sign-in that wasn't you? Signs out EVERY device (this one too) and tells staff.">
        <Btn tone="bad" onClick={async () => { if (await askBox("NOT ME — SIGN OUT EVERYWHERE?\n\nEvery device is signed out, including this PC. Staff see it in the audit log.\n\nThen: change your Discord password and turn on Discord 2FA.")) {
          const r = await window.cn.hub.devicesAction({ action: "panic" }); setMsg(r.error ?? r.msg ?? null); if (!r.error) setTimeout(() => void window.cn.auth.logout(), 1500); } }}>NOT ME</Btn></Row>
    </Group>
  </>;
}

/* ───────── MY DEVICES ───────── */
function Devices({ s, onChange, version }: P) {
  const D = s.devices;
  const setD2 = (x: Partial<AppSettings["devices"]>) => onChange({ ...s, devices: { ...D, ...x } });
  const [d, setD] = useState<{ devices: Device[]; recent: Device[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const load = useCallback(async () => { const r = await window.cn.hub.devices(); if ("error" in r) setErr(r.error); else { setD(r); setErr(null); } return r; }, []);
  const act = async (b: Record<string, unknown>) => { const r = await window.cn.hub.devicesAction(b); setMsg(r.error ?? r.msg ?? null); void load(); };
  // Rule: sign out devices not used for idleDays (never this PC, never ★ trusted).
  useEffect(() => { void load().then(async (r) => {
    if ("error" in r) return;
    const old = r.devices.filter((x) => !x.current && !D.trusted.includes(x.id) && x.lastUsedAt && Date.now() - Date.parse(x.lastUsedAt) > D.idleDays * 864e5);
    for (const x of old) await window.cn.hub.devicesAction({ action: "signout", id: x.id });
    if (old.length) { setMsg(`${old.length} device(s) unused for ${D.idleDays}+ days signed out`); void load(); }
  }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [load, D.idleDays]);
  if (err && !d) return <p className="text-bad">⚠ {err}</p>;
  if (!d) return <p className="text-[12px] tracking-[2px] text-dim">LOADING…</p>;
  const KV = ({ k, v, c }: { k: string; v: string; c?: string }) => <div className="flex justify-between py-0.5 text-[12px]"><span className="text-dim">{k}</span><b className="font-normal" style={{ color: c ?? "#fff" }}>{v}</b></div>;
  const online = (x: Device) => x.current || (x.lastUsedAt && Date.now() - Date.parse(x.lastUsedAt) < 10 * 60000);
  const idle = (x: Device) => !online(x) && x.lastUsedAt && Date.now() - Date.parse(x.lastUsedAt) < 24 * 36e5;
  const counts = [["ONLINE", d.devices.filter(online).length, "#22e07a"], ["IDLE", d.devices.filter(idle).length, "#f59e0b"], ["OFFLINE", d.devices.filter((x) => !online(x) && !idle(x)).length, "#7d8a99"], ["LIMIT", D.max, "#00d9ff"]] as const;
  return <>
    <Head t="🖥 MY DEVICES" d="EVERY PC SIGNED IN TO THE HUB WITH YOUR ACCOUNT · SIGN OUT ANY YOU DON'T RECOGNISE" />
    <Flash msg={msg} />
    <div className="mb-4 grid max-w-[900px] grid-cols-4 gap-3">{counts.map(([l, n, c]) => <div key={l} className="kpi"><small>{l}</small><b style={{ color: c }}>{n}</b></div>)}</div>
    {d.devices.length > D.max && <p role="alert" className="mb-3 max-w-[900px] border-l-2 border-amber bg-amber/10 px-3 py-1.5 text-[12px] text-amber">⚠ {d.devices.length} devices — more than your limit of {D.max}. Sign out the ones you don't use.</p>}
    <div className="grid max-w-[900px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      {d.devices.map((x) => { const trusted = D.trusted.includes(x.id), old = x.appVersion && x.appVersion !== version; return (
      <section key={x.id} className={`card bg-panel ${x.current ? "border-ok/50!" : ""}`}>
        <div className="flex items-center gap-3 border-b border-cyan/10 px-3.5 py-2.5"><span className="text-[26px]" aria-hidden="true">🖥</span>
          <div className="min-w-0 flex-1">{edit?.id === x.id ? <input autoFocus value={edit.name} maxLength={40} aria-label="Device name" onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { void act({ action: "rename", id: x.id, name: edit.name }); setEdit(null); } if (e.key === "Escape") setEdit(null); }} className="w-full border border-cyan bg-[#070a0f] px-2 py-0.5 text-[13px] text-white" />
            : <b className="block truncate text-[14px] font-medium text-white">{trusted && <span className="text-gold">★ </span>}{x.name.toUpperCase()}</b>}
            <small className="text-[11px]" style={{ color: online(x) ? "#22e07a" : idle(x) ? "#f59e0b" : "#7d8a99" }}>● {x.current ? "THIS DEVICE · ACTIVE NOW" : online(x) ? "ONLINE" : idle(x) ? `IDLE · ${ago(x.lastUsedAt).toLowerCase()}` : `OFFLINE · ${ago(x.lastUsedAt).toLowerCase()}`}</small></div></div>
        <div className="px-3.5 py-2"><KV k="System" v={x.os || "Windows"} /><KV k="Hub version" v={`${x.appVersion || "—"}${old ? " · update needed" : ""}`} c={old ? "#f59e0b" : undefined} /><KV k="Signed in" v={ukDT(x.signedInAt)} />
          <KV k="Sign-in ends" v={trusted ? "Trusted — kept" : x.current ? `If unused for ${D.idleDays} days` : `${ukDT(x.expiresAt).slice(0, 11)} if unused`} /></div>
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-white/5 px-3.5 py-2">
          <Btn onClick={() => setD2({ trusted: trusted ? D.trusted.filter((t) => t !== x.id) : [...D.trusted, x.id] })}>{trusted ? "★ TRUSTED" : "☆ TRUST"}</Btn>
          <Btn onClick={() => setEdit(edit?.id === x.id ? null : { id: x.id, name: x.name })}>✎ RENAME</Btn>
          {!x.current && <Btn tone="bad" onClick={async () => { if (await askBox(`SIGN OUT ${x.name.toUpperCase()}?\n\nIt needs Discord sign-in again to use the Hub.`)) void act({ action: "signout", id: x.id }); }}>SIGN OUT</Btn>}</div>
      </section>); })}
    </div>
    <div className="mt-4"><Group t="RULES">
      <Row t="Most devices at once" d="Warns you when you go over"><Seg v={String(D.max) as "2" | "3" | "5"} label="Most devices" opts={[["2", "2"], ["3", "3"], ["5", "5"]]} onChange={(v) => setD2({ max: Number(v) as 2 | 3 | 5 })} /></Row>
      <Row t="Sign out devices I don't use" d="Not this PC, not ★ trusted ones"><Seg v={String(D.idleDays) as "7" | "30" | "90"} label="Unused after" opts={[["7", "7 DAYS"], ["30", "30 DAYS"], ["90", "90 DAYS"]]} onChange={(v) => setD2({ idleDays: Number(v) as 7 | 30 | 90 })} /></Row>
      <Row t="Sign out every other device" d="This PC stays signed in.">
        <Btn tone="bad" disabled={d.devices.length < 2} onClick={async () => { if (await askBox(`SIGN OUT ALL OTHER DEVICES?\n\n${d.devices.length - 1} device(s) will need Discord sign-in again.`)) void act({ action: "signout-others" }); }}>SIGN OUT ALL OTHERS</Btn></Row>
      <Note>Website browser sign-ins aren't listed here yet. "Find" and "Update it" on another PC aren't possible yet — open the Hub on that PC to update.</Note>
    </Group></div>
  </>;
}

/* ───────── SHORTCUTS ───────── */
function Keys({ s, onChange, pins }: P) {
  const [rec, setRec] = useState<ShortcutId | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!rec) return;
    const k = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") return setRec(null);
      const c = comboOf(e);
      if (!c) return;
      if (rec === "toggle" && !c.includes("+")) return; // a global key needs Ctrl / Shift / Alt
      onChange({ ...s, keys: { ...s.keys, [rec]: c } });
      setRec(null);
    };
    addEventListener("keydown", k, true);
    return () => removeEventListener("keydown", k, true);
  }, [rec, s, onChange]);
  const used = (c: string, id: ShortcutId) => SHORTCUTS.find(([x]) => x !== id && !s.keysOff.includes(x) && s.keys[x] === c)?.[1];
  const kb = (c: string) => c.split("+").map((k, i) => <kbd key={i} className="ml-1 border border-b-2 border-cyan/30 bg-[#070a0f] px-1.5 font-mono text-[11px] text-white">{k}</kbd>);
  return <>
    <Head t="⌨ SHORTCUTS" d="CLICK A SHORTCUT, THEN PRESS THE NEW KEYS · ESC CANCELS · ? SHOWS THE CHEAT SHEET" />
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="⌕ Find a shortcut" aria-label="Find a shortcut" className="mb-3 w-full max-w-[900px] border border-cyan/20 bg-[#070a0f] px-2 py-1.5 text-[12px] text-white" />
    {SHORTCUT_GROUPS.map(([g, list]) => { const rows = list.filter(([, l]) => l.toLowerCase().includes(q.toLowerCase())); return rows.length ? (
      <Group key={g} t={g.toUpperCase()}>{rows.map(([id, l, anywhere]) => { const off = s.keysOff.includes(id), clash = !off && used(s.keys[id], id); return (
        <Row key={id} t={l} d={<>{anywhere && <span className="mr-1.5 border border-ok/50 px-1 text-[9px] tracking-[1px] text-ok">WORKS ANYWHERE</span>}{clash ? <span className="text-amber">⚠ Same as "{clash}"</span> : anywhere ? "Needs Ctrl, Shift or Alt" : null}</>}>
          <button type="button" disabled={off} onClick={() => setRec(rec === id ? null : id)} aria-label={`Change shortcut for ${l}`} className={`min-w-[120px] border px-2 py-1 text-right disabled:opacity-30 ${rec === id ? "animate-pulse border-amber text-amber" : "border-transparent hover:border-cyan/30"}`}>
            {rec === id ? <span className="text-[11px] tracking-[1px]">PRESS KEYS…</span> : kb(s.keys[id])}</button>
          <button type="button" aria-label={`Reset ${l}`} title="Reset" onClick={() => onChange({ ...s, keys: { ...s.keys, [id]: DEFAULT_KEYS[id] } })} className="text-dim hover:text-white">↺</button>
          <Toggle on={!off} label={`${l} on`} onChange={(v) => onChange({ ...s, keysOff: v ? s.keysOff.filter((x) => x !== id) : [...s.keysOff, id] })} /></Row>); })}</Group>) : null; })}
    <Group t="PAGE SHORTCUTS">
      <Row t="Ctrl + 1 … 9 opens my ★ pinned pages" d={pins.length ? pins.slice(0, 9).map((p, i) => `${i + 1}: ${p.replace(/^panel-/, "")}`).join(" · ") : "Pin pages with ★ in the side menu first"}><Toggle on={s.pageKeys} onChange={(v) => onChange({ ...s, pageKeys: v })} label="Page shortcuts" /></Row>
    </Group>
    <div className="max-w-[900px] text-right"><Btn onClick={async () => { if (await askBox("RESET ALL SHORTCUTS?")) onChange({ ...s, keys: { ...DEFAULT_KEYS }, keysOff: [], pageKeys: true }); }}>↺ RESET ALL</Btn></div>
    <p className="max-w-[900px] text-[11px] text-dimmer">Always: Esc closes pop-ups · ↑ ↓ Enter in lists · Ctrl + Enter sends a ticket reply.</p>
  </>;
}

/* ───────── BACKUP & RESET ───────── */
const AREAS: [keyof AppSettings | "general", string][] = [["general", "General & time"], ["look", "Appearance"], ["a11y", "Accessibility"], ["notify", "Notifications"], ["security", "Security (not your PIN)"], ["devices", "Device rules"], ["keys", "Shortcuts"]];
function pick(s: AppSettings, areas: string[]): Partial<AppSettings> {
  const o: Record<string, unknown> = {};
  if (areas.includes("general")) for (const k of ["startup", "closeToTray", "openOn", "textSize", "anim", "contrast", "time", "tz", "tzPin", "clocks", "dateStyle", "h24", "autoUpdate", "channel"] as const) o[k] = s[k];
  for (const a of areas) if (a !== "general") o[a] = a === "security" ? { ...s.security, pinHash: "" } : a === "keys" ? s.keys : s[a as keyof AppSettings];
  if (areas.includes("keys")) { o.keysOff = s.keysOff; o.pageKeys = s.pageKeys; }
  return o as Partial<AppSettings>;
}
function Backup({ s, onChange }: P) {
  const [list, setList] = useState(snaps);
  const [exp, setExp] = useState<string[]>(AREAS.map(([a]) => a));
  const [imp, setImp] = useState<{ name: string; data: Partial<AppSettings> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const restore = async (x: Snap) => { if (await askBox(`RESTORE SETTINGS FROM ${ukDT(x.at).toUpperCase()}?\n\nYour current settings are saved as a restore point first.`)) { snapshot("Before restore", s); onChange(mergeSettings({ ...x.s, security: { ...x.s.security, pinHash: s.security.pinHash } })); setList(snaps()); setMsg("Restored"); } };
  const download = () => {
    const blob = new Blob([JSON.stringify({ app: "505th-hub-settings", v: 2, at: new Date().toISOString(), settings: pick(s, exp) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `505th-hub-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const read = async (f: File) => {
    try { const j = JSON.parse(await f.text()) as { app?: string; settings?: Partial<AppSettings> }; if (j.app !== "505th-hub-settings" || !j.settings) throw new Error(); setImp({ name: f.name, data: j.settings }); }
    catch { setMsg("That isn't a 505th Hub settings file."); }
  };
  const resetArea = async (a: string, l: string) => { if (!(await askBox(`RESET ${l.toUpperCase()}?`))) return; snapshot(`Before reset ${l}`, s); onChange(mergeSettings({ ...s, ...pick(DEFAULT_SETTINGS, [a]), security: a === "security" ? { ...DEFAULT_SETTINGS.security } : s.security })); setList(snaps()); setMsg(`${l} reset`); };
  const repair = async (w: "cache" | "window" | "logs") => setMsg(await window.cn.app.repair(w) || null);
  return <>
    <Head t="💾 BACKUP & RESET" d="YOUR SETTINGS ARE SAVED TO YOUR ACCOUNT · RESTORE POINTS ARE KEPT ON THIS PC" />
    <Flash msg={msg} />
    <Group t="SYNC">
      <Row t="Saved to your account" d="Settings follow you to every PC you sign in on"><span className="text-[11px] text-ok">● SYNCED</span>
        <Btn onClick={() => { onChange({ ...s }); setMsg("Saved to your account"); }}>⟳ SYNC NOW</Btn></Row>
    </Group>
    <Group t="RESTORE POINTS" right={<Btn onClick={() => { snapshot("Manual", s); setList(snaps()); }}>＋ MAKE ONE</Btn>}>
      {!list.length ? <p className="m-0 px-3.5 py-2.5 text-[12px] text-dim">None yet — one is made each day before your first change, and before any reset or import.</p>
        : list.slice(0, 12).map((x, i) => <Row key={i} t={ukDT(x.at)} d={x.why}><Btn onClick={() => void restore(x)}>↺ RESTORE</Btn></Row>)}
      <Note>Kept for 30 days on this PC.</Note>
    </Group>
    <Group t="EXPORT / IMPORT">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-white/5 px-3.5 py-2.5">{AREAS.map(([a, l]) => <label key={a} className="flex items-center gap-1.5 text-[12px] text-white">
        <input type="checkbox" checked={exp.includes(a)} onChange={(e) => setExp(e.target.checked ? [...exp, a] : exp.filter((x) => x !== a))} />{l}</label>)}</div>
      <Row t="Export" d="Downloads a .json file (never includes your PIN)"><Btn disabled={!exp.length} onClick={download}>⬇ EXPORT</Btn></Row>
      <Row t="Import" d="From a file you exported before"><input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} /><Btn onClick={() => file.current?.click()}>⬆ IMPORT…</Btn></Row>
      {imp && <div className="border-t border-white/5 px-3.5 py-2.5"><b className="text-[12px] text-white">Preview — {imp.name}</b>
        <div className="my-1.5 text-[11.5px] text-dim">Will change: {AREAS.filter(([a]) => a === "general" ? "textSize" in imp.data : a in imp.data).map(([, l]) => l).join(", ") || "nothing"}</div>
        <div className="flex gap-1.5"><Btn tone="go" onClick={() => { snapshot("Before import", s); onChange(mergeSettings({ ...s, ...imp.data, security: { ...s.security, ...(imp.data.security ?? {}), pinHash: s.security.pinHash } })); setImp(null); setList(snaps()); setMsg("Imported"); }}>APPLY</Btn><Btn onClick={() => setImp(null)}>CANCEL</Btn></div></div>}
    </Group>
    <Group t="RESET">
      {AREAS.map(([a, l]) => <Row key={a} t={l}><Btn onClick={() => void resetArea(a, l)}>↺ RESET</Btn></Row>)}
      <div className="flex items-center gap-2 px-3.5 py-2.5"><b className="flex-1 text-[12.5px] text-bad">Reset EVERYTHING</b>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type RESET" aria-label="Type RESET to confirm" className="w-[110px] border border-bad/40 bg-[#070a0f] px-2 py-1 text-[12px] text-white" />
        <Btn tone="bad" disabled={typed !== "RESET"} onClick={() => { snapshot("Before reset all", s); onChange({ ...DEFAULT_SETTINGS }); setTyped(""); setList(snaps()); setMsg("All settings reset (restore point saved)"); }}>RESET ALL</Btn></div>
    </Group>
    <Group t="REPAIR">
      <Row t="Clear cache" d="Fixes old pictures or pages that won't update"><Btn onClick={() => void repair("cache")}>CLEAR</Btn></Row>
      <Row t="Reset window" d="Back to normal size, middle of the screen"><Btn onClick={() => void repair("window")}>RESET</Btn></Row>
      <Row t="Open logs folder" d="For Developers when fixing a problem"><Btn onClick={() => void repair("logs")}>OPEN</Btn></Row>
      <Row t="Reinstall" d="Download the latest installer from the 505th website → Hub, then run it. Your settings stay."><Btn onClick={() => window.open("https://www.505expeditionaryforce.com", "_blank")}>WEBSITE ↗</Btn></Row>
    </Group>
  </>;
}

/* ───────── ABOUT ───────── */
const HELP: [string, string][] = [
  ["Getting started", "Sign in with Discord. The side menu has every page you can use. ★ pins a page to the top. Ctrl+K jumps anywhere."],
  ["Notifications", "Pop-ups show bottom right. The 🔔 bell keeps every alert. Do not disturb holds pop-ups — they wait in the bell."],
  ["Messages", "✉ in the top bar opens Messages. Press it again to go back. Red number = unread."],
  ["Notes", "Notes are yours unless you share them. Add a reminder and the Hub tells you on time."],
  ["Hub lock", "Set a Hub PIN in Security. Ctrl+L locks. Forgot your PIN? Sign out and sign in with Discord."],
  ["Something is wrong", "Settings → Backup & Reset → Repair. Still wrong? About → Report a problem."],
];
function About({ version, sum, net, s }: P) {
  const [sys, setSys] = useState<SysInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<"" | "news" | "legal" | "bug" | "idea" | "help">("");
  useEffect(() => { void window.cn.app.sys().then(setSys); }, []);
  const c = sum.system.cortana;
  const diag = [`505th Command Network ${version} (${s.channel})`, `Windows ${sys?.windows ?? "?"}`, `Signed in as ${sum.me.name}`, `Cortana: ${c.online ? `online${c.pingMs != null ? ` (${c.pingMs} ms)` : ""}` : "offline"}`,
    `505th Net: ${net.state}${net.reason ? ` (${net.reason})` : ""}`, `Screen: ${screen.width}×${screen.height} @ ${devicePixelRatio}x`, `Time: ${new Date().toISOString()}`].join("\n");
  const KV = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => <div className="flex justify-between px-3.5 py-1 text-[12px]"><span className="text-dim">{k}</span><b className="font-normal" style={{ color: ok == null ? "#fff" : ok ? "#22e07a" : "#ff4d4d" }}>{v}</b></div>;
  const health: [string, boolean, string][] = [["Website", sum.system.website, sum.system.website ? "Online" : "Down"], ["Cortana", c.online, c.online ? `Online${c.pingMs != null ? ` · ${c.pingMs} ms` : ""}` : "Offline"],
    ["505th Net (live)", net.state === "live", net.state === "live" ? "Live" : net.state === "connecting" ? "Connecting…" : "Off"]];
  const released = notes.match(/v[\d.]+/)?.[0];
  return <>
    <div className="mb-4 flex max-w-[900px] items-center gap-5 border border-cyan/15 px-5 py-4" style={{ background: "linear-gradient(90deg,rgb(var(--accent-rgb)/.08),transparent)" }}>
      <img src={logo} alt="505th" className="h-[74px] w-[74px] object-contain" />
      <div className="flex-1"><h2 className="m-0 font-head text-[24px] font-bold tracking-[3px] text-white">505TH COMMAND NETWORK</h2><p className="m-0 text-[11px] tracking-[1px] text-dim">THE 505TH EXPEDITIONARY FORCE STAFF APP · HUB FOR WINDOWS</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] tracking-[1.5px]"><span className="border border-cyan px-2 text-cyan">VERSION {version}</span><span className="border border-ok/50 px-2 text-ok">{s.channel.toUpperCase()}</span>
          {released && released !== `v${version}` && <span className="text-dim">Latest notes: {released}</span>}<UpdateCheck /><Btn onClick={() => setModal("news")}>✨ WHAT'S NEW</Btn></div></div></div>
    <div className="grid max-w-[900px] gap-4 lg:grid-cols-2">
      <div>
        <Group t="SYSTEM HEALTH">{health.map(([k, ok, v]) => <KV key={k} k={k} v={v} ok={ok} />)}
          <Row t="" d="Copy this when reporting a problem"><Btn onClick={() => { void navigator.clipboard.writeText(diag); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "✓ COPIED" : "⧉ COPY DIAGNOSTICS"}</Btn></Row></Group>
        <Group t="THIS INSTALL"><div className="py-1.5"><KV k="Device" v={navigator.userAgent.includes("Windows") ? "Windows PC" : "PC"} /><KV k="Windows" v={sys?.windows ?? "—"} /><KV k="Installed" v={sys?.installedISO ? ukDT(sys.installedISO) : "—"} />
          <KV k="Running for" v={sys ? (sys.upMins < 60 ? `${sys.upMins} min` : `${Math.floor(sys.upMins / 60)} h ${sys.upMins % 60} min`) : "—"} /><KV k="Free space" v={sys?.freeGB ? `${sys.freeGB} GB` : "—"} /></div>
          <Row t="Update channel" d="Beta isn't set up yet — everyone is on Stable"><Seg v={s.channel} label="Update channel" opts={[["stable", "STABLE"], ["beta", "BETA"]]} onChange={() => undefined} /></Row>
          <Row t="Logs folder"><Btn onClick={() => void window.cn.app.repair("logs")}>OPEN</Btn></Row></Group>
      </div>
      <div>
        <Group t="HELP">
          <Row t="Report a problem" d="Sends a report to Bug Reports with your diagnostics"><Btn onClick={() => setModal("bug")}>🐞 REPORT</Btn></Row>
          <Row t="Suggest an idea" d="Goes to the Project Tracker → Ideas"><Btn onClick={() => setModal("idea")}>💡 SUGGEST</Btn></Row>
          <Row t="Help pages" d="Plain-English guides"><Btn onClick={() => setModal("help")}>📖 OPEN</Btn></Row>
          <Row t="Policy & Legal" d="Hub Policy, privacy, third-party notices"><Btn onClick={() => setModal("legal")}>⚖ VIEW</Btn></Row></Group>
        <Group t="CREDITS"><div className="flex items-center gap-3 px-3.5 py-3"><img src={rcd} alt="Rev Creative Developer" className="h-11 w-11 rounded-lg" />
          <div className="flex-1"><b className="block text-[12.5px] text-white">REV Creative Developer</b><small className="text-[11px] text-dim">revcreativedeveloper.com</small></div><Btn onClick={() => window.open("https://revcreativedeveloper.com", "_blank")}>OPEN ↗</Btn></div>
          <p className="m-0 px-3.5 pb-2.5 text-[11px] italic tracking-[1px] text-dim">NEVER STOP LEARNING.</p></Group>
      </div>
    </div>
    <p className="max-w-[900px] text-center text-[10px] tracking-[2px] text-dimmer">© 2026 505TH EXPEDITIONARY FORCE · BUILT BY REV CREATIVE DEVELOPER · NOT AFFILIATED WITH BOHEMIA INTERACTIVE OR MICROSOFT</p>
    {modal === "news" && <WhatsNew onClose={() => setModal("")} />}
    {modal === "legal" && <Legal onClose={() => setModal("")} />}
    {modal === "help" && <Modal t="📖 HELP" onClose={() => setModal("")}><HelpPages /></Modal>}
    {(modal === "bug" || modal === "idea") && <Feedback kind={modal} diag={diag} onClose={() => setModal("")} />}
  </>;
}
function HelpPages() {
  const [open, setOpen] = useState(0);
  const [vote, setVote] = useState<Record<number, "y" | "n">>({});
  return <>{HELP.map(([t, b], i) => <div key={t} className="border-b border-white/5">
    <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center py-2.5 text-left text-[13px] text-white">{t}<span className="ml-auto text-dim">{open === i ? "−" : "+"}</span></button>
    {open === i && <div className="pb-3 text-[12.5px] leading-relaxed text-[#c6d0da]">{b}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-dim">Did this help?{(["y", "n"] as const).map((v) => <button key={v} type="button" aria-pressed={vote[i] === v} onClick={() => setVote({ ...vote, [i]: v })} className={`border px-1.5 ${vote[i] === v ? "border-cyan text-cyan" : "border-cyan/20"}`}>{v === "y" ? "👍" : "👎"}</button>)}{vote[i] && <span>Thanks!</span>}</div></div>}
  </div>)}</>;
}
function Feedback({ kind, diag, onClose }: { kind: "bug" | "idea"; diag: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<"low" | "med" | "high">("med");
  const [withDiag, setWithDiag] = useState(true);
  const [shot, setShot] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const addShot = async (f: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return setMsg(["Images only (PNG, JPG, WEBP, GIF)", false]);
    setBusy(true); const r = await window.cn.hub.upload("505th_projects", f.name, f.type, new Uint8Array(await f.arrayBuffer())); setBusy(false);
    if (r.url) setShot(r.url); else setMsg([r.error ?? "Upload failed", false]);
  };
  const send = async () => {
    setBusy(true);
    const r = await window.cn.hub.feedbackAction({ kind, text, level, diag: withDiag ? diag.split("\n").slice(0, 2).join(" · ") : "", shot });
    setBusy(false);
    if (r.error) setMsg([r.error, false]); else { setMsg([r.msg ?? "Sent", true]); setTimeout(onClose, 1500); }
  };
  return <Modal t={kind === "bug" ? "🐞 REPORT A PROBLEM" : "💡 SUGGEST AN IDEA"} onClose={onClose} w={540}>
    <textarea autoFocus value={text} maxLength={500} onChange={(e) => setText(e.target.value)} rows={5} aria-label={kind === "bug" ? "What went wrong?" : "Your idea"}
      placeholder={kind === "bug" ? "What went wrong? What did you do just before?" : "What should the Hub do? Why would it help?"} className="w-full border border-cyan/25 bg-[#070a0f] p-2 text-[13px] text-white" />
    <div className="mt-2 flex items-center gap-2 text-[11px] text-dim">{kind === "bug" ? "How bad?" : "How important?"}<Seg v={level} label="Level" opts={[["low", "LOW"], ["med", "MEDIUM"], ["high", "HIGH"]]} onChange={setLevel} /><span className="ml-auto">{text.length}/500</span></div>
    {kind === "bug" && <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] text-white">
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={withDiag} onChange={(e) => setWithDiag(e.target.checked)} />Add diagnostics (version, Windows)</label>
      <label className="flex cursor-pointer items-center gap-1.5 border border-cyan/25 px-2 py-0.5 text-[11px]">📷 {shot ? "Screenshot added ✓" : "Add screenshot"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addShot(f); }} /></label></div>}
    {msg && <p role="status" className={`mt-2 text-[12px] ${msg[1] ? "text-ok" : "text-bad"}`}>{msg[0]}</p>}
    <div className="mt-3 flex justify-end gap-2"><Btn onClick={onClose}>CANCEL</Btn><Btn tone="go" disabled={busy || text.trim().length < 5} onClick={() => void send()}>{busy ? "SENDING…" : "SEND"}</Btn></div>
  </Modal>;
}
const NOTICES: [string, string][] = [["Electron", "MIT"], ["Chromium", "BSD-3-Clause and others"], ["Node.js", "MIT"], ["React / React DOM", "MIT"], ["Tailwind CSS", "MIT"], ["Ably SDK", "Apache-2.0"], ["Rajdhani font", "SIL Open Font License 1.1"], ["Share Tech Mono font", "SIL Open Font License 1.1"]];
function Legal({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState<"policy" | "privacy" | "notices">("policy");
  return <Modal t="⚖ POLICY & LEGAL" onClose={onClose} w={700}>
    <div className="mb-3"><Seg v={t} label="Section" opts={[["policy", "HUB POLICY"], ["privacy", "PRIVACY"], ["notices", "THIRD-PARTY NOTICES"]]} onChange={setT} /></div>
    {t === "policy" ? <PolicyText /> : t === "privacy" ? <div className="space-y-2 text-[12.5px] leading-relaxed text-[#c6d0da]">
      <p className="m-0"><b className="text-white">What the Hub keeps:</b> your Discord ID and name, your 505th record, your Hub settings, and which devices you're signed in on (name, Hub version, sign-in times).</p>
      <p className="m-0"><b className="text-white">What it doesn't:</b> your Discord password, your PIN (only a scrambled check of it), or anything on your PC outside the Hub.</p>
      <p className="m-0"><b className="text-white">Who sees it:</b> 505th staff with the right access, as set by the unit. It is never sold or shared outside the 505th.</p>
      <p className="m-0"><b className="text-white">Removing it:</b> ask a Commander or Developer.</p></div>
      : <div><div className="mb-3 border border-amber/50 bg-amber/10 px-3 py-2 text-[12px] text-amber">The 505th Command Network Hub is private software owned by the 505th Expeditionary Force and REV Creative Developer. It is NOT open source. You may not copy, share or change it.</div>
        <p className="mb-2 mt-0 text-[12px] text-dim">The Hub is built with these tools. Their own licences apply to them only:</p>
        <table className="w-full text-[12.5px]"><tbody>{NOTICES.map(([n, l]) => <tr key={n} className="border-t border-white/5"><td className="py-1.5 text-white">{n}</td><td className="text-right text-dim">{l}</td></tr>)}</tbody></table></div>}
  </Modal>;
}
