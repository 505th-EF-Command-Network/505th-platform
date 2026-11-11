import { useCallback, useEffect, useState } from "react";
import type { AppSettings, Device, NetState, Summary } from "../../../preload/api";
import { askBox } from "../components/Confirm";
import { DEFAULT_KEYS, EVENTS, SHORTCUTS, comboOf, fire, playDing } from "../settings";
import logo from "../../../../assets/logo.png";
import rcd from "../../../../assets/rcd.png";
import { UpdateCheck } from "../components/UpdateBanner";

/**
 * H3 SETTINGS (approved mock 2026-11-11): My Settings · My Notifications · My Devices · My Shortcuts · About.
 * Saved to your account (users/{uid}.hubPrefs.settings) so they follow you to every PC.
 */
const TABS = [["my-settings", "⚙", "My Settings"], ["my-notifications", "🔔", "My Notifications"], ["my-devices", "🖥", "My Devices"], ["my-shortcuts", "⌨", "My Shortcuts"], ["my-about", "ⓘ", "About"]] as const;
const ukDT = (iso: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");
const ago = (iso: string) => { if (!iso) return "—"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 3 ? "Now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

export function Settings(p: { tab: string; s: AppSettings; onChange: (s: AppSettings) => void; onPage: (pg: string) => void; sum: Summary; net: NetState; version: string }) {
  return (
    <main className="flex min-w-0 flex-1 overflow-hidden" aria-label="Settings">
      <nav className="w-[220px] shrink-0 border-r border-cyan/15 py-3" aria-label="Settings sections">
        <div className="px-4 pb-2 font-head text-[13px] font-bold tracking-[3px] text-cyan">SETTINGS</div>
        {TABS.map(([id, ic, l]) => <button key={id} type="button" aria-current={p.tab === id} onClick={() => p.onPage(id)}
          className={`flex w-full gap-2.5 px-4 py-2.5 text-left text-[12.5px] ${p.tab === id ? "bg-cyan/10 text-cyan shadow-[inset_3px_0_0_#00d9ff]" : "text-[#aeb9c4] hover:bg-cyan/5 hover:text-white"}`}><span className="w-4 text-center">{ic}</span>{l}</button>)}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto px-7 py-5">
        {p.tab === "my-notifications" ? <Notifs {...p} /> : p.tab === "my-devices" ? <Devices /> : p.tab === "my-shortcuts" ? <Keys {...p} /> : p.tab === "my-about" ? <About {...p} /> : <General {...p} />}
      </div>
    </main>
  );
}

const Head = ({ t, d }: { t: string; d: string }) => <><h2 className="m-0 font-head text-[20px] font-bold tracking-[3px] text-white">{t}</h2><p className="mb-4 mt-0.5 text-[11px] tracking-[1px] text-dim">{d}</p></>;
const Group = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="mb-4 max-w-[860px] border border-cyan/15 bg-panel"><div className="border-b border-cyan/10 px-3.5 py-2 font-head text-[12px] font-bold tracking-[2.5px] text-cyan">{t}</div>{children}</section>;
const Row = ({ t, d, children }: { t: string; d?: string; children?: React.ReactNode }) => <div className="flex items-center gap-3 border-b border-white/5 px-3.5 py-2.5 last:border-b-0"><div className="min-w-0 flex-1"><b className="block text-[12.5px] font-medium text-white">{t}</b>{d && <small className="text-[11px] text-dim">{d}</small>}</div>{children}</div>;
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-5 w-[38px] shrink-0 rounded-full transition ${on ? "bg-ok/35" : "bg-white/10"}`}>
    <i className={`absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all ${on ? "left-[21px] bg-ok" : "left-[3px] bg-dim"}`} /><span className="sr-only">{on ? "On" : "Off"}</span></button>;
}
function Seg<T extends string>({ v, opts, onChange, label }: { v: T; opts: [T, string][]; onChange: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="flex">{opts.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => onChange(k)}
    className={`-ml-px border px-2.5 py-1 text-[10.5px] tracking-[1px] first:ml-0 ${v === k ? "z-[1] border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim hover:text-white"}`}>{l}</button>)}</div>;
}

function General({ s, onChange }: { s: AppSettings; onChange: (s: AppSettings) => void }) {
  const set = (x: Partial<AppSettings>) => onChange({ ...s, ...x });
  return <>
    <Head t="⚙ MY SETTINGS" d="APP LOOK AND BEHAVIOUR · SAVED TO YOUR ACCOUNT" />
    <Group t="APP">
      <Row t="Start with Windows" d="Opens in the tray when you log in (installed app only)"><Toggle on={s.startup} onChange={(v) => set({ startup: v })} label="Start with Windows" /></Row>
      <Row t="Close button hides to tray" d="Keeps notifications coming. Quit from the tray icon."><Toggle on={s.closeToTray} onChange={(v) => set({ closeToTray: v })} label="Close hides to tray" /></Row>
      <Row t="Open on"><Seg v={s.openOn} label="Open on" opts={[["dashboard", "DASHBOARD"], ["last", "LAST PAGE"]]} onChange={(v) => set({ openOn: v })} /></Row>
    </Group>
    <Group t="LOOK">
      <Row t="Text size" d="Makes the whole app bigger or smaller"><Seg v={s.textSize} label="Text size" opts={[["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]]} onChange={(v) => set({ textSize: v })} /></Row>
      <Row t="Animations" d="Glows, sweeps, pop-ins"><Seg v={s.anim} label="Animations" opts={[["on", "ON"], ["reduced", "REDUCED"], ["off", "OFF"]]} onChange={(v) => set({ anim: v })} /></Row>
      <Row t="High contrast" d="Brighter text and borders"><Toggle on={s.contrast} onChange={(v) => set({ contrast: v })} label="High contrast" /></Row>
    </Group>
    <Group t="TIME">
      <Row t="Clock in the top bar" d="UK time stays the unit time everywhere else"><Seg v={s.time} label="Clock" opts={[["uk", "UK"], ["local", "MY LOCAL"], ["both", "BOTH"]]} onChange={(v) => set({ time: v })} /></Row>
    </Group>
  </>;
}

function Notifs({ s, onChange }: { s: AppSettings; onChange: (s: AppSettings) => void }) {
  const n = s.notify;
  const set = (x: Partial<AppSettings["notify"]>) => onChange({ ...s, notify: { ...n, ...x } });
  const [test, setTest] = useState<"all" | "popup" | "edge" | "bar" | "sound" | "every">("all");
  const box = (on: boolean, flip: () => void, label: string) => <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={flip}
    className={`mx-auto grid h-4 w-4 place-items-center border text-[11px] ${on ? "border-ok bg-ok text-black" : "border-cyan/60"}`}>{on ? "✓" : ""}</button>;
  return <>
    <Head t="🔔 MY NOTIFICATIONS" d="CHOOSE WHAT TELLS YOU, AND HOW · SAVED TO YOUR ACCOUNT" />
    <Group t="HOW">
      <Row t="Pop-up cards" d="Bottom right of the screen, 505th style — shows over games and other apps"><Toggle on={n.popup} onChange={(v) => set({ popup: v })} label="Pop-up cards" /></Row>
      <Row t="Flash the taskbar button" d="Amber flash until you open the Hub"><Toggle on={n.taskbar} onChange={(v) => set({ taskbar: v })} label="Taskbar flash" /></Row>
      <Row t="Flash the screen edge (urgent only)" d="Op starting · direct message"><Toggle on={n.edge} onChange={(v) => set({ edge: v })} label="Screen edge flash" /></Row>
      <Row t="Sound" d="Short two-tone ding — off by default"><Toggle on={n.sound} onChange={(v) => set({ sound: v })} label="Sound" /></Row>
      <Row t="Do not disturb" d={n.dnd === "night" ? "23:00–08:00 UK — alerts wait in the 🔔 bell" : n.dnd === "custom" ? "Your times (UK) — alerts wait in the 🔔 bell" : "Alerts always pop up"}>
        <div className="flex items-center gap-2">{n.dnd === "custom" && <><input type="time" value={n.dndFrom} onChange={(e) => set({ dndFrom: e.target.value })} aria-label="Quiet from" className="border border-cyan/20 bg-[#070a0f] px-1.5 py-0.5 text-[11px] text-white [color-scheme:dark]" />–<input type="time" value={n.dndTo} onChange={(e) => set({ dndTo: e.target.value })} aria-label="Quiet until" className="border border-cyan/20 bg-[#070a0f] px-1.5 py-0.5 text-[11px] text-white [color-scheme:dark]" /></>}
          <Seg v={n.dnd} label="Do not disturb" opts={[["off", "OFF"], ["night", "23:00–08:00"], ["custom", "CUSTOM"]]} onChange={(v) => set({ dnd: v })} /></div></Row>
      <Row t="Tell me when a new device signs in" d="Bell alert + pop-up on your other devices"><Toggle on={n.newDevice} onChange={(v) => set({ newDevice: v })} label="New device alert" /></Row>
    </Group>
    <Group t="WHAT">
      <table className="w-full border-collapse text-[12.5px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim"><th className="px-3.5 py-2 text-left font-normal">EVENT</th>{["POP-UP", "BELL", "FLASH"].map((h) => <th key={h} className="w-[80px] py-2 text-center font-normal">{h}</th>)}</tr></thead>
        <tbody>{EVENTS.map(([k, ic, l]) => <tr key={k} className="border-t border-white/5"><td className="px-3.5 py-2 text-white">{ic} {k === "op" ? <>Op starting in <select value={n.opMins} onChange={(e) => set({ opMins: Number(e.target.value) })} aria-label="Minutes before an op" className="border border-cyan/20 bg-[#070a0f] px-1 text-[11px] text-white">{[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></> : l}</td>
          {(["popup", "bell", "flash"] as const).map((c) => <td key={c} className="py-2 text-center">{box(n.ev[k][c], () => set({ ev: { ...n.ev, [k]: { ...n.ev[k], [c]: !n.ev[k][c] } } }), `${l} — ${c}`)}</td>)}</tr>)}</tbody></table>
      <Row t="Test it" d="Pick what to try, then press the button">
        <Seg v={test} label="What to test" opts={[["all", "ALL 3"], ["popup", "POP-UP"], ["edge", "SCREEN"], ["bar", "TASKBAR"], ["sound", "🔊"], ["every", "ALL + 🔊"]]} onChange={setTest} />
        <button type="button" onClick={() => { const all = test === "all" || test === "every";
          if (test === "sound") return playDing();
          fire("test", { id: "test", title: "Test notification", body: "This is how alerts look on your screen.", icon: "🔔", urgent: true, actions: [{ id: "open", label: "OPEN" }] },
            { popup: all || test === "popup", edge: all || test === "edge", taskbar: all || test === "bar", sound: test === "every" }); }}
          className="border border-cyan bg-cyan/10 px-3.5 py-1.5 text-[11px] tracking-[2px] text-cyan">▶ SEND TEST</button></Row>
      <p className="m-0 px-3.5 pb-2.5 text-[10.5px] text-dimmer">Pop-ups and flashes only show when the Hub isn't the window you're looking at. Taskbar flash: switch to another window within 3 s of pressing the button to see it.</p>
    </Group>
  </>;
}

function Devices() {
  const [d, setD] = useState<{ devices: Device[]; recent: Device[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const load = useCallback(async () => { const r = await window.cn.hub.devices(); if ("error" in r) setErr(r.error); else { setD(r); setErr(null); } }, []);
  useEffect(() => { void load(); }, [load]);
  const act = async (b: Record<string, unknown>) => { const r = await window.cn.hub.devicesAction(b); setMsg(r.error ?? r.msg ?? null); void load(); };
  if (err && !d) return <p className="text-bad">⚠ {err}</p>;
  if (!d) return <p className="text-[12px] tracking-[2px] text-dim">LOADING…</p>;
  const KV = ({ k, v, c }: { k: string; v: string; c?: string }) => <div className="flex justify-between py-0.5 text-[12px]"><span className="text-dim">{k}</span><b className="font-normal" style={{ color: c ?? "#fff" }}>{v}</b></div>;
  return <>
    <Head t="🖥 MY DEVICES" d="EVERY PC SIGNED IN TO THE HUB WITH YOUR ACCOUNT · SIGN OUT ANY YOU DON'T RECOGNISE" />
    {msg && <p role="status" className="mb-3 border-l-2 border-cyan bg-cyan/5 px-3 py-1.5 text-[12px] text-cyan">{msg}</p>}
    <div className="grid max-w-[860px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      {d.devices.map((x) => <section key={x.id} className={`border bg-panel ${x.current ? "border-ok/50" : "border-cyan/15"}`}>
        <div className="flex items-center gap-3 border-b border-cyan/10 px-3.5 py-2.5"><span className="text-[26px]" aria-hidden="true">🖥</span>
          <div className="min-w-0 flex-1">{edit?.id === x.id ? <input autoFocus value={edit.name} maxLength={40} aria-label="Device name" onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { void act({ action: "rename", id: x.id, name: edit.name }); setEdit(null); } if (e.key === "Escape") setEdit(null); }} className="w-full border border-cyan bg-[#070a0f] px-2 py-0.5 text-[13px] text-white" />
            : <b className="block truncate text-[14px] font-medium text-white">{x.name.toUpperCase()}</b>}
            <small className={`text-[11px] ${x.current ? "text-ok" : "text-dim"}`}>{x.current ? "● THIS DEVICE · ACTIVE NOW" : `Last used ${ago(x.lastUsedAt).toLowerCase()}`}</small></div></div>
        <div className="px-3.5 py-2"><KV k="System" v={x.os || "Windows"} /><KV k="Hub version" v={x.appVersion || "—"} /><KV k="Signed in" v={ukDT(x.signedInAt)} /><KV k="Last used" v={ago(x.lastUsedAt)} c={x.current ? "#22e07a" : undefined} />
          <KV k="Sign-in ends" v={x.current ? "If unused for 30 days" : `${ukDT(x.expiresAt).slice(0, 11)} if unused`} /></div>
        <div className="flex justify-end gap-1.5 border-t border-white/5 px-3.5 py-2">
          <button type="button" onClick={() => setEdit(edit?.id === x.id ? null : { id: x.id, name: x.name })} className="border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">✎ RENAME</button>
          {!x.current && <button type="button" onClick={async () => { if (await askBox(`SIGN OUT ${x.name.toUpperCase()}?\n\nIt needs Discord sign-in again to use the Hub.`)) void act({ action: "signout", id: x.id }); }} className="border border-bad/50 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-bad">SIGN OUT</button>}</div>
      </section>)}
    </div>
    <div className="mt-4"><Group t="SECURITY">
      <Row t="Sign out every other device" d="They need Discord sign-in again. This PC stays signed in.">
        <button type="button" disabled={d.devices.length < 2} onClick={async () => { if (await askBox(`SIGN OUT ALL OTHER DEVICES?\n\n${d.devices.length - 1} device(s) will need Discord sign-in again. This PC stays signed in.`)) void act({ action: "signout-others" }); }}
          className="border border-bad/50 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-bad disabled:opacity-40">SIGN OUT ALL OTHERS</button></Row>
      <Row t="Recent sign-ins" d={d.recent.map((x) => `${ukDT(x.signedInAt).slice(0, 6)} · ${x.name}${x.revokedAt ? ` (signed out ${ukDT(x.revokedAt).slice(0, 6)})` : x.expiresAt && Date.parse(x.expiresAt) < Date.now() ? " (expired)" : " ✓"}`).join("  ·  ") || "—"} />
    </Group></div>
  </>;
}

function Keys({ s, onChange }: { s: AppSettings; onChange: (s: AppSettings) => void }) {
  const [rec, setRec] = useState<string | null>(null);
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
  const used = (c: string, id: string) => SHORTCUTS.find(([x]) => x !== id && s.keys[x] === c)?.[1];
  return <>
    <Head t="⌨ MY SHORTCUTS" d="CLICK A SHORTCUT, THEN PRESS THE NEW KEYS · ESC CANCELS" />
    <Group t="SHORTCUTS">
      {SHORTCUTS.map(([id, l]) => { const clash = used(s.keys[id], id); return (
        <Row key={id} t={l} d={id === "toggle" ? "Works even when the Hub is hidden — needs Ctrl, Shift or Alt" : clash ? `⚠ Same as "${clash}"` : undefined}>
          <button type="button" onClick={() => setRec(rec === id ? null : id)} aria-label={`Change shortcut for ${l}`} className={`min-w-[120px] border px-2 py-1 text-right ${rec === id ? "animate-pulse border-amber text-amber" : "border-transparent hover:border-cyan/30"}`}>
            {rec === id ? <span className="text-[11px] tracking-[1px]">PRESS KEYS…</span> : s.keys[id].split("+").map((k, i) => <kbd key={i} className="ml-1 border border-b-2 border-cyan/30 bg-[#070a0f] px-1.5 font-mono text-[11px] text-white">{k}</kbd>)}</button></Row>); })}
      <Row t=""><button type="button" onClick={() => onChange({ ...s, keys: { ...DEFAULT_KEYS } })} className="border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">RESET TO DEFAULT</button></Row>
    </Group>
    <p className="max-w-[860px] text-[11px] text-dimmer">Always: Esc closes pop-ups · ↑ ↓ Enter in lists · Ctrl + Enter sends a ticket reply.</p>
  </>;
}

function About({ version, sum, net, onPage }: { version: string; sum: Summary; net: NetState; onPage: (p: string) => void }) {
  const [copied, setCopied] = useState(false);
  const c = sum.system.cortana;
  const info = [`505th Command Network ${version}`, `Signed in as ${sum.me.name}`, `Cortana: ${c.online ? `online${c.pingMs != null ? ` (${c.pingMs} ms)` : ""}` : "offline"}`, `505th Net: ${net.state}${net.reason ? ` (${net.reason})` : ""}`,
    `Screen: ${screen.width}×${screen.height} @ ${devicePixelRatio}x`, `Time: ${new Date().toISOString()}`].join("\n");
  const KV = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => <div className="flex justify-between px-3.5 py-1 text-[12px]"><span className="text-dim">{k}</span><b className="font-normal" style={{ color: ok == null ? "#fff" : ok ? "#22e07a" : "#ff4d4d" }}>{v}</b></div>;
  const link = (l: string, u: string) => <button type="button" onClick={() => window.open(u, "_blank")} className="border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white hover:bg-cyan/10">{l} ↗</button>;
  return <>
    <div className="mb-4 flex max-w-[860px] items-center gap-5 border border-cyan/15 px-5 py-4" style={{ background: "linear-gradient(90deg,rgba(0,217,255,.07),transparent)" }}>
      <img src={logo} alt="505th" className="h-[74px] w-[74px] object-contain" />
      <div className="flex-1"><h2 className="m-0 font-head text-[24px] font-bold tracking-[3px] text-white">505TH COMMAND NETWORK</h2><p className="m-0 text-[11px] tracking-[1px] text-dim">THE 505TH EXPEDITIONARY FORCE STAFF APP · HUB FOR WINDOWS</p>
        <div className="mt-2 flex gap-2 text-[10.5px] tracking-[1.5px]"><span className="border border-cyan px-2 text-cyan">VERSION {version}</span><UpdateCheck /></div></div></div>
    <div className="grid max-w-[860px] gap-4 lg:grid-cols-2">
      <div><Group t="ABOUT THE 505TH"><p className="m-0 px-3.5 py-2.5 text-[12.5px] text-[#c6d0da]">The 505th Expeditionary Force is a UNSC-themed Arma 3 milsim unit. The Command Network links the website, the Hub and Cortana so staff run the unit from one place.</p>
          <Row t="Website" d="505expeditionaryforce.com">{link("OPEN", "https://www.505expeditionaryforce.com")}</Row></Group>
        <Group t="SYSTEM"><div className="py-1.5"><KV k="Hub" v={version} /><KV k="Website" v="Online" ok /><KV k="Cortana" v={c.online ? `Online${c.pingMs != null ? ` · ${c.pingMs} ms` : ""}` : "Offline"} ok={c.online} />
          <KV k="505th Net (live sync)" v={net.state === "live" ? "Live" : net.state === "connecting" ? "Connecting…" : "Off"} ok={net.state === "live"} /><KV k="Signed in as" v={sum.me.name} /></div>
          <Row t="" d="Copy this when reporting a problem"><button type="button" onClick={() => { void navigator.clipboard.writeText(info); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">{copied ? "✓ COPIED" : "⧉ COPY SYSTEM INFO"}</button></Row></Group></div>
      <div><Group t="MADE BY"><div className="flex items-center gap-3 px-3.5 pt-3"><img src={rcd} alt="Rev Creative Developer" className="h-11 w-11 rounded-lg" /><span className="text-[11px] tracking-[1px] text-dim">DESIGN + DEVELOPMENT</span></div><Row t="REV Creative Developer" d="Design + development · revcreativedeveloper.com">{link("OPEN", "https://revcreativedeveloper.com")}</Row><p className="m-0 px-3.5 pb-2.5 text-[11px] italic tracking-[1px] text-dim">NEVER STOP LEARNING.</p></Group>
        <Group t="HELP"><Row t="Report a problem" d="Copy your system info, then open a ticket in Discord"><button type="button" onClick={() => onPage("panel-tickets")} className="border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">🎫 TICKETS</button></Row>
          <Row t="Open-source licences" d="Electron, React, Tailwind CSS, Ably and others — MIT / Apache 2.0">{link("VIEW", "https://github.com/electron/electron/blob/main/LICENSE")}</Row></Group></div>
    </div>
    <p className="max-w-[860px] text-center text-[10px] tracking-[2px] text-dimmer">© 2026 505TH EXPEDITIONARY FORCE · BUILT BY REV CREATIVE DEVELOPER · NOT AFFILIATED WITH BOHEMIA INTERACTIVE OR MICROSOFT</p>
  </>;
}
