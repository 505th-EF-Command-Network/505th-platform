import { useState } from "react";

/**
 * Left side nav (approved mock): same groups as the Terminal. Every page opens INSIDE the app.
 * Pages not built yet show an in-app "coming soon" screen (never the website). Command and Help stay website-only.
 */
type Link = { id: string; label: string; icon: string; key?: string; app?: boolean };
const GROUPS: { label: string; icon: string; links: Link[] }[] = [
  { label: "MANPOWER", icon: "♟", links: [
    { id: "panel-active", label: "Personnel Files", icon: "✎", key: "pers", app: true }, { id: "panel-register", label: "BCT Approvals", icon: "✉", key: "bct" },
    { id: "panel-roster", label: "Battalion Roster", icon: "☰", key: "roster" }, { id: "panel-unitcards", label: "Order of Battle", icon: "▦", key: "oob" },
    { id: "panel-recruit-source", label: "Recruitment Stats", icon: "▲", key: "rstat" }] },
  { label: "OPERATIONS", icon: "⚙", links: [
    { id: "panel-attendance", label: "Attendance Tracker", icon: "▣", key: "att" }, { id: "panel-att-history", label: "Attendance History", icon: "☰", key: "att" },
    { id: "panel-aar", label: "After Action Reports", icon: "✦", key: "aar" }] },
  { label: "INTEL ARCHIVE", icon: "▤", links: [{ id: "panel-gallery", label: "Gallery", icon: "▧", key: "media" }, { id: "panel-videos", label: "Videos", icon: "▶", key: "media" }] },
  { label: "DISCORD", icon: "◈", links: [
    { id: "panel-tickets", label: "Tickets", icon: "🎫", key: "tk" }, { id: "panel-events", label: "Events", icon: "⚑", key: "ev" },
    { id: "panel-send", label: "Send Message", icon: "✉", key: "send" }, { id: "panel-quick", label: "Quick Upload", icon: "⇪", key: "qu" },
    { id: "panel-info", label: "Info Posts", icon: "📌", key: "info" }, { id: "panel-mod", label: "Moderation", icon: "⛨", key: "modw" }] },
  { label: "WORKSPACE", icon: "▤", links: [
    { id: "panel-projects", label: "Project Tracker", icon: "☷", key: "proj" }, { id: "panel-notes", label: "Notes", icon: "✎", key: "notes" },
    { id: "panel-website", label: "Website", icon: "⌂", key: "web" }] },
  { label: "SECURITY", icon: "⛉", links: [
    { id: "panel-officers", label: "Officer Management", icon: "★", key: "om" }, { id: "panel-network", label: "Network Status", icon: "◉", key: "net" },
    { id: "panel-auditv2", label: "Audit Log", icon: "☍", key: "audit" }] },
];

export const PAGES: Record<string, string> = Object.fromEntries(GROUPS.flatMap((g) => g.links.map((l) => [l.id, l.label])));

export function SideNav(p: { access: Record<string, boolean>; page: string; onPage: (id: string) => void; cortanaOk: boolean }) {
  const [open, setOpen] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem("cn.open") || "[]")); } catch { return new Set(); } });
  const [rail, setRail] = useState(() => localStorage.getItem("cn.rail") === "1");
  const [q, setQ] = useState("");
  const toggle = (g: string) => { const n = new Set(open); n.has(g) ? n.delete(g) : n.add(g); setOpen(n); localStorage.setItem("cn.open", JSON.stringify([...n])); };
  const setR = (v: boolean) => { setRail(v); localStorage.setItem("cn.rail", v ? "1" : "0"); };
  const go = (l: Link) => p.onPage(l.id);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => (!l.key || p.access[l.key]) && (!q || l.label.toLowerCase().includes(q.toLowerCase()))) })).filter((g) => g.links.length);

  if (rail)
    return (
      <nav aria-label="Menu" className="flex w-[70px] shrink-0 flex-col border-r border-cyan/20 bg-gradient-to-b from-[#0b1016] to-[#080b10]">
        <button type="button" title="Dashboard" onClick={() => p.onPage("dashboard")} className={`grid h-12 place-items-center text-[19px] ${p.page === "dashboard" ? "text-cyan" : "text-[#b9c4d0]"}`}>■</button>
        <hr className="mx-3 border-cyan/15" />
        {groups.map((g) => <button key={g.label} type="button" title={g.label} onClick={() => { setR(false); if (!open.has(g.label)) toggle(g.label); }} className="grid h-12 place-items-center text-[19px] text-cyan/85 hover:bg-cyan/5">{g.icon}</button>)}
        <div className="flex-1" />
        <button type="button" aria-label="Expand menu" onClick={() => setR(false)} className="m-2 border border-cyan/30 py-1.5 text-cyan">»</button>
      </nav>
    );
  return (
    <nav aria-label="Menu" className="flex w-[280px] shrink-0 flex-col border-r border-cyan/20 bg-gradient-to-b from-[#0b1016] to-[#080b10]">
      <div className="p-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="FILTER MENU…" aria-label="Filter menu"
        className="w-full border border-cyan/25 bg-black/45 px-2.5 py-2.5 text-[14px] text-white outline-none focus:border-cyan" /></div>
      <div className="flex-1 overflow-auto">
        <button type="button" onClick={() => p.onPage("dashboard")} className={`navlink ${p.page === "dashboard" ? "act" : ""}`}><span className="ic">■</span>Dashboard</button>
        {groups.map((g) => {
          const isOpen = !!q || open.has(g.label);
          return (
            <div key={g.label}>
              <button type="button" aria-expanded={isOpen} onClick={() => toggle(g.label)} className="flex w-full items-center gap-2.5 px-4 pb-1.5 pt-3.5 text-left text-[12px] tracking-[2.5px] text-dimmer hover:text-dim">
                <span className="text-cyan">{g.icon}</span>{g.label}<span className="ml-auto">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && g.links.map((l) => (
                <button key={l.id} type="button" onClick={() => go(l)} className={`navlink ${p.page === l.id ? "act" : ""}`} title={l.app ? "" : "Coming to the app soon"}>
                  <span className="ic">{l.icon}</span>{l.label}{!l.app && <span className="ml-auto text-[9.5px] tracking-[1px] text-dimmer">SOON</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-cyan/20 px-3.5 py-2.5 text-[12px] tracking-[1.5px] text-dim">
        <i className="dot" style={{ background: p.cortanaOk ? "#22e07a" : "#ff4d4d" }} />{p.cortanaOk ? "CORTANA OK" : "CORTANA OFFLINE"}
        <button type="button" onClick={() => setR(true)} className="ml-auto border border-cyan/30 px-2.5 py-1 text-cyan">« COLLAPSE</button>
      </div>
    </nav>
  );
}
