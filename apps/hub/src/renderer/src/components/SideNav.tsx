import { useEffect, useMemo, useRef, useState } from "react";
import type { HubPrefs, Overview, Summary } from "../../../preload/api";
import { STATE, type StateKey } from "../ui";

/**
 * Side nav (approved mock 2026-11-11):
 * groups MANPOWER · OPERATIONS · COMMS · INTEL ARCHIVE · DISCORD · WORKSPACE · SECURITY (Command + Help stay website-only)
 * · filter (/) · ★ pinned pages · ✎ customise (drag categories, 👁 hide, ★ pin) · « collapse to icon rail (Ctrl B, hover = flyout)
 * · red count dots · signed-in card at the bottom with status + "my" pages. Layout is saved to the account (hubPrefs.nav).
 * Pages not built yet show the in-app "coming soon" screen (never the website).
 */
type Link = { id: string; label: string; icon: string; key?: string; app?: boolean; count?: "bct" | "tickets" };
type Group = { id: string; label: string; icon: string; links: Link[] };
const GROUPS: Group[] = [
  { id: "manpower", label: "MANPOWER", icon: "♟", links: [
    { id: "panel-active", label: "Personnel Files", icon: "✎", key: "pers", app: true }, { id: "panel-register", label: "BCT Approvals", icon: "✚", key: "bct", app: true, count: "bct" },
    { id: "panel-roster", label: "Battalion Roster", icon: "☰", key: "roster", app: true }, { id: "panel-unitcards", label: "Order of Battle", icon: "▦", key: "oob" },
    { id: "panel-recruit-source", label: "Recruitment Stats", icon: "▲", key: "rstat" }] },
  { id: "operations", label: "OPERATIONS", icon: "⚙", links: [
    { id: "panel-attendance", label: "Attendance Tracker", icon: "▣", key: "att", app: true }, { id: "panel-att-history", label: "Attendance History", icon: "☷", key: "att" },
    { id: "panel-aar", label: "After Action Reports", icon: "✦", key: "aar", app: true }, { id: "panel-events", label: "Events", icon: "⚑", key: "ev", app: true }] },
  { id: "comms", label: "COMMS", icon: "✉", links: [
    { id: "panel-tickets", label: "Tickets", icon: "🎫", key: "tk", count: "tickets" }, { id: "panel-send", label: "Send Message", icon: "➤", key: "send" }] },
  { id: "intel", label: "INTEL ARCHIVE", icon: "▤", links: [{ id: "panel-media", label: "Media (Gallery + Videos)", icon: "▧", key: "media" }] },
  { id: "discord", label: "DISCORD", icon: "◈", links: [
    { id: "panel-quick", label: "Quick Upload", icon: "⇪", key: "qu" }, { id: "panel-info", label: "Info Posts", icon: "📌", key: "info" }, { id: "panel-mod", label: "Moderation", icon: "⛨", key: "modw" }] },
  { id: "workspace", label: "WORKSPACE", icon: "▦", links: [
    { id: "panel-projects", label: "Project Tracker", icon: "☷", key: "proj" }, { id: "panel-notes", label: "Notes", icon: "✎", key: "notes" }, { id: "panel-website", label: "Website", icon: "⌂", key: "web" }] },
  { id: "security", label: "SECURITY", icon: "⛉", links: [
    { id: "panel-officers", label: "Officer Management", icon: "★", key: "om" }, { id: "panel-network", label: "Network Status", icon: "◉", key: "net" }, { id: "panel-auditv2", label: "Audit Log", icon: "☍", key: "audit" }] },
];
const ALL_LINKS = GROUPS.flatMap((g) => g.links);
export const PAGES: Record<string, string> = {
  ...Object.fromEntries(ALL_LINKS.map((l) => [l.id, l.label])),
  "my-settings": "App Settings", "my-devices": "My Devices", "my-notifications": "Notifications & Sounds", "my-shortcuts": "Keyboard Shortcuts", "panel-msg2": "Messages", "alerts": "Alerts",
};
export const NAV_LINKS = ALL_LINKS;
export type NavPrefs = NonNullable<HubPrefs["nav"]>;
export const DEFAULT_NAV: NavPrefs = { order: GROUPS.map((g) => g.id), hidden: [], pins: [], closed: ["workspace", "security"], rail: false };

export function SideNav(p: {
  sum: Summary; ov: Overview | null; page: string; onPage: (id: string) => void; prefs: NavPrefs; onPrefs: (n: NavPrefs) => void;
  onStatus: (s: StateKey) => void; onMyFile: () => void; onSignOut: () => void; version: string;
}) {
  const { prefs } = p;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const filter = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<NavPrefs>) => p.onPrefs({ ...prefs, ...patch });
  const rail = prefs.rail;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); set({ rail: !rail }); }
      else if (e.key === "/" && !typing) { e.preventDefault(); if (rail) set({ rail: false }); setTimeout(() => filter.current?.focus(), 30); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  useEffect(() => {
    if (!card) return;
    const c = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-mecard]")) setCard(false); };
    addEventListener("mousedown", c);
    return () => removeEventListener("mousedown", c);
  }, [card]);

  const acc = p.sum.me.access;
  const count = (l: Link) => (l.count ? p.ov?.counts[l.count] ?? 0 : 0);
  const order = useMemo(() => [...prefs.order.filter((id) => GROUPS.some((g) => g.id === id)), ...GROUPS.map((g) => g.id).filter((id) => !prefs.order.includes(id))], [prefs.order]);
  const groups = order.map((id) => GROUPS.find((g) => g.id === id)!).map((g) => ({ ...g, links: g.links.filter((l) => (!l.key || acc[l.key]) && (!q || l.label.toLowerCase().includes(q.toLowerCase()))) })).filter((g) => g.links.length);
  const pins = prefs.pins.map((id) => ALL_LINKS.find((l) => l.id === id)).filter((l): l is Link => !!l && (!l.key || !!acc[l.key]));
  const st = (p.sum.me.status.state ?? "online") as StateKey;
  const initials = p.sum.me.name.split(" ")[0] || "ME";

  const linkBtn = (l: Link, inPins = false) => (
    <button key={(inPins ? "pin-" : "") + l.id} type="button" onClick={() => p.onPage(l.id)} title={l.app ? undefined : "Coming to the app soon"}
      className={`group flex w-full items-center gap-2.5 border-l-2 px-3 py-[7px] text-left text-[13px] ${p.page === l.id ? "border-cyan bg-cyan/10 text-white" : "border-transparent text-[#aeb9c4] hover:bg-cyan/5 hover:text-white"}`}>
      {edit ? <span role="button" tabIndex={0} aria-label={prefs.pins.includes(l.id) ? `Unpin ${l.label}` : `Pin ${l.label}`} onClick={(e) => { e.stopPropagation(); set({ pins: prefs.pins.includes(l.id) ? prefs.pins.filter((x) => x !== l.id) : [...prefs.pins, l.id] }); }} className="text-gold">{prefs.pins.includes(l.id) ? "★" : "☆"}</span>
        : <span className="w-4 text-center text-cyan/80">{l.icon}</span>}
      <span className="min-w-0 flex-1 truncate">{l.label}</span>
      {count(l) > 0 ? <span className="rounded-full bg-bad px-1.5 text-[10px] text-white">{count(l)}</span> : !l.app && <span className="border border-cyan/15 px-1 text-[9px] tracking-[1px] text-dimmer">SOON</span>}
    </button>
  );

  return (
    <nav aria-label="Menu" className={`relative flex shrink-0 flex-col border-r border-cyan/20 bg-gradient-to-b from-[#0a1119] to-[#070b10] transition-[width] duration-200 ${rail ? "w-[64px]" : "w-[262px]"}`}>
      <div className={`flex gap-1.5 p-2.5 ${rail ? "justify-center" : ""}`}>
        {rail ? <button type="button" aria-label="Search menu" onClick={() => { set({ rail: false }); setTimeout(() => filter.current?.focus(), 30); }} className="grid h-8 w-10 place-items-center border border-cyan/20 text-dim">⌕</button>
          : <><input ref={filter} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter menu… ( / )" aria-label="Filter menu" className="min-w-0 flex-1 border border-cyan/20 bg-black/45 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-cyan" />
            <button type="button" aria-pressed={edit} title="Customise menu" onClick={() => setEdit(!edit)} className={`border px-2.5 text-[13px] ${edit ? "border-amber text-amber" : "border-cyan/20 text-dim hover:text-cyan"}`}>✎</button></>}
      </div>
      <div className={`min-h-0 flex-1 ${rail ? "overflow-visible" : "overflow-auto"} pb-3`}>
        <button type="button" onClick={() => p.onPage("dashboard")} title="Dashboard"
          className={`mx-2 mb-1.5 flex items-center gap-2.5 border-l-[3px] px-3 py-2 text-[12px] tracking-[2px] ${rail ? "justify-center px-0" : ""} ${p.page === "dashboard" ? "border-cyan bg-cyan/10 text-cyan" : "border-transparent text-[#c6d0da] hover:bg-cyan/5"}`}>■{!rail && " DASHBOARD"}</button>
        {!rail && pins.length > 0 && <div className="mb-1"><div className="px-3 pb-1 pt-1 text-[9.5px] tracking-[3px] text-gold">★ PINNED</div>{pins.map((l) => linkBtn(l, true))}</div>}
        {groups.map((g) => {
          const hidden = prefs.hidden.includes(g.id), closed = prefs.closed.includes(g.id) && !q;
          const red = g.links.some((l) => count(l) > 0);
          if (hidden && !edit) return null;
          if (rail) return (
            <div key={g.id} className="group relative">
              <button type="button" title={g.label} className="relative grid h-11 w-full place-items-center text-[17px] text-cyan/85 hover:bg-cyan/10">{g.icon}{red && <i className="absolute right-3 top-2 h-2 w-2 rounded-full bg-bad" />}</button>
              <div className="invisible absolute left-[58px] top-0 z-40 w-[240px] border border-cyan/40 bg-[#0a1018] py-1.5 opacity-0 shadow-[12px_10px_30px_rgba(0,0,0,.7)] transition-opacity group-hover:visible group-hover:opacity-100">
                <div className="mb-1 border-b border-cyan/15 px-3 pb-1.5 text-[10px] tracking-[3px] text-cyan">{g.label}</div>{g.links.map((l) => linkBtn(l))}
              </div>
            </div>);
          return (
            <div key={g.id} draggable={edit} onDragStart={() => setDrag(g.id)} onDragOver={(e) => { e.preventDefault(); setOver(g.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
              onDrop={(e) => { e.preventDefault(); if (drag && drag !== g.id) { const o = order.filter((x) => x !== drag); o.splice(o.indexOf(g.id), 0, drag); set({ order: o }); } setDrag(null); setOver(null); }}
              className={`mb-0.5 border ${over === g.id && drag ? "border-amber bg-amber/5" : "border-transparent"} ${drag === g.id ? "opacity-40" : ""} ${hidden ? "opacity-40" : ""}`}>
              <button type="button" aria-expanded={!closed} onClick={() => set({ closed: closed ? prefs.closed.filter((x) => x !== g.id) : [...prefs.closed, g.id] })}
                className="flex w-full items-center gap-2 px-3 pb-1 pt-2.5 text-left text-[11.5px] tracking-[2.5px] text-[#c6d0da] hover:text-white">
                {edit && <span className="cursor-grab text-amber" aria-hidden="true">⠿</span>}<span className="w-4 text-center text-cyan">{g.icon}</span>{g.label}
                {g.id === "comms" && <span className="bg-cyan px-1 text-[8.5px] tracking-[1px] text-black">NEW</span>}
                {closed && red && <i className="h-2 w-2 rounded-full bg-bad" />}
                {edit && <span role="button" tabIndex={0} title={hidden ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); set({ hidden: hidden ? prefs.hidden.filter((x) => x !== g.id) : [...prefs.hidden, g.id] }); }} className="ml-auto text-dim">{hidden ? "🚫" : "👁"}</span>}
                <span className={`${edit ? "" : "ml-auto"} text-dim transition-transform ${closed ? "-rotate-90" : ""}`}>▾</span>
              </button>
              {!closed && !hidden && <div className="pl-2">{g.links.map((l) => linkBtn(l))}</div>}
            </div>);
        })}
        {edit && !rail && <div className="mx-2 mt-3 border border-dashed border-amber p-2.5 text-[11px] leading-relaxed text-amber">✎ MENU EDIT MODE<br />• Drag ⠿ to move a category<br />• 👁 hide a category · ★ pin a page to the top<br />• Saved to your account
          <button type="button" onClick={() => p.onPrefs({ ...DEFAULT_NAV, rail })} className="mt-2 w-full border border-amber py-1.5 tracking-[1.5px]">↺ RESET TO DEFAULT</button></div>}
        <button type="button" onClick={() => set({ rail: !rail })} title={rail ? "Expand menu (Ctrl B)" : "Collapse menu (Ctrl B)"} className={`mx-2 mt-2 border border-cyan/20 py-1.5 text-[11px] tracking-[2px] text-dim hover:border-cyan hover:text-cyan ${rail ? "w-[48px]" : "w-[calc(100%-16px)]"}`}>{rail ? "»" : "« COLLAPSE"}</button>
      </div>

      {/* signed-in card */}
      <div data-mecard className="relative border-t border-cyan/20">
        {card && (
          <div role="menu" className={`rise absolute bottom-[62px] z-50 w-[250px] border border-cyan/40 bg-[#0a1018] shadow-[0_-10px_40px_rgba(0,0,0,.7)] ${rail ? "left-2" : "left-2"}`}>
            <div className="flex items-center gap-2.5 border-b border-cyan/15 p-3">
              <Hex photo={p.ov?.me.photo ?? null} label={initials} size={44} />
              <div className="min-w-0"><b className="block truncate text-white">{p.sum.me.name}</b><div className="truncate text-[10.5px] text-dim">{p.sum.me.rank || "—"} · {p.sum.me.platoon || "—"}</div>
                <div className="truncate text-[10.5px] text-purple">{p.sum.me.role.replace("_", " ").toUpperCase()}{p.ov?.me.discordUsername ? ` · @${p.ov.me.discordUsername}` : ""}</div></div>
            </div>
            <div className="grid grid-cols-3 border-b border-cyan/15 text-center">
              {([[p.sum.me.opsEligible ? `${Math.round((p.sum.me.opsAttended / p.sum.me.opsEligible) * 100)}%` : "—", "ATTEND", "#f59e0b"], [p.sum.me.pt, "PT", "#00d9ff"], [`${p.ov?.me.ribbons ?? 0}/${p.ov?.me.medals ?? 0}`, "RIB/MED", "#a78bfa"]] as [string | number, string, string][]).map(([v, l, c]) => (
                <div key={l} className="py-2"><b className="block text-[15px]" style={{ color: c }}>{v}</b><span className="text-[9px] tracking-[1.5px] text-dim">{l}</span></div>))}
            </div>
            <div className="px-3 pb-0.5 pt-2 text-[9.5px] tracking-[2px] text-dim">STATUS</div>
            <div className="flex gap-1 px-3 pb-2">{(["online", "dnd", "invisible"] as const).map((k) => (
              <button key={k} type="button" role="menuitemradio" aria-checked={st === k} onClick={() => p.onStatus(k)} className="flex-1 border py-1.5 text-[10.5px]"
                style={{ color: STATE[k].color, borderColor: st === k ? STATE[k].color : "rgb(0 217 255 / .15)", background: st === k ? "rgba(255,255,255,.04)" : undefined }}>
                {k === "online" ? "● Online" : k === "dnd" ? "⛔ DND" : "○ Hidden"}</button>))}</div>
            <hr className="my-1 border-cyan/10" />
            {([["👤", "My personnel file", () => p.onMyFile()], ["⚠", `My warnings · ${p.ov?.me.warnings ?? 0}`, () => p.onMyFile()]] as [string, string, () => void][]).map(([i, l, f]) => (
              <button key={l} type="button" role="menuitem" onClick={() => { setCard(false); f(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#c6d0da] hover:bg-cyan/10 hover:text-white"><i className="w-4 text-center not-italic text-cyan">{i}</i>{l}</button>))}
            <hr className="my-1 border-cyan/10" />
            {([["🔔", "Notifications & sounds", "my-notifications"], ["⚙", "App settings", "my-settings"], ["🖥", "My devices", "my-devices"], ["?", "Keyboard shortcuts", "my-shortcuts"]] as [string, string, string][]).map(([i, l, id]) => (
              <button key={id} type="button" role="menuitem" onClick={() => { setCard(false); p.onPage(id); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#c6d0da] hover:bg-cyan/10 hover:text-white"><i className="w-4 text-center not-italic text-cyan">{i}</i>{l}</button>))}
            <hr className="my-1 border-cyan/10" />
            <button type="button" role="menuitem" onClick={() => { setCard(false); p.onSignOut(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-bad hover:bg-bad/10"><i className="w-4 text-center not-italic">⏻</i>Sign out</button>
            <div className="px-3 pb-2.5 pt-1 text-[9.5px] tracking-[1px] text-dimmer">COMMAND NETWORK v{p.version} · <span className="text-ok">CONNECTED ●</span></div>
          </div>)}
        <button type="button" aria-haspopup="menu" aria-expanded={card} onClick={() => setCard(!card)} title={p.sum.me.name}
          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-cyan/5 ${rail ? "justify-center px-0" : ""}`}>
          <span className="relative"><Hex photo={p.ov?.me.photo ?? null} label={initials} size={38} />
            <i className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full border-2 border-[#070b10]" style={{ background: STATE[st].color }} /></span>
          {!rail && <><span className="min-w-0 flex-1"><b className="block truncate text-[13px] text-white">{p.sum.me.name}</b><small className="block truncate text-[10.5px] text-dim">{p.sum.me.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} · {p.sum.me.platoon || "—"}</small></span>
            <span className={`text-dim transition-transform ${card ? "rotate-180" : ""}`}>▴</span></>}
        </button>
      </div>
    </nav>
  );
}

export function Hex(p: { photo: string | null; label: string; size: number }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-[#183040] to-[#0b2028] font-head font-bold text-gold [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]"
      style={{ width: p.size, height: p.size, fontSize: p.size / 3.4 }}>
      {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : p.label}
    </span>
  );
}
