import { myTz } from "./settings";
export const STATE = {
  online: { label: "ONLINE", color: "#22e07a" },
  dnd: { label: "DO NOT DISTURB", color: "#ff4d4d" },
  invisible: { label: "INVISIBLE", color: "#7d8a99" },
  offline: { label: "OFFLINE", color: "#4b5765" },
} as const;
export type StateKey = keyof typeof STATE;

/** Terminal page ids → readable names (Staff Status "on: …"). */
export const PAGE_NAME: Record<string, string> = {
  "panel-dashboard": "Dashboard", "panel-active": "Personnel Files", "panel-register": "BCT Approvals", "panel-roster": "Member List",
  "panel-unitcards": "Company Roster", "panel-recruit-source": "Recruitment Stats", "panel-attendance": "Attendance", "panel-att-history": "Attendance History",
  "panel-aar": "AARs", "panel-gallery": "Gallery", "panel-videos": "Videos", "panel-tickets": "Tickets", "panel-events": "Events", "panel-send": "Transmission", "panel-transmission": "Transmission",
  "panel-quick": "Quick Upload", "panel-info": "Info Posts", "panel-mod": "Moderation", "panel-projects": "Projects", "panel-notes": "Notes",
  "panel-website": "Website", "panel-officers": "Officer Management", "panel-network": "Network", "panel-auditv2": "Audit Log", "panel-msg2": "Messages",
};
export const pageName = (id: string) => PAGE_NAME[id] ?? (id ? "Terminal" : "");
/** 19 Nov: shows the member's OWN time (Settings → Time & Region, else the PC's zone) — name kept so callers don't change. */
export const ukTime = (iso: string | number | Date, opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: myTz(), ...opts });
/** Short zone name for a moment in MY time zone, e.g. "PST", "GMT", "BST". */
export const tzAbbr = (d: string | number | Date = new Date()) =>
  new Intl.DateTimeFormat("en-US", { timeZone: myTz(), timeZoneName: "short" }).formatToParts(new Date(d)).find((p) => p.type === "timeZoneName")?.value ?? "";
export function countdown(ms: number): string {
  if (ms <= 0) return "LIVE NOW";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  const p = (n: number) => String(n).padStart(2, "0");
  return d ? `${d}D ${p(h)}:${p(m)}:${p(s)}` : `${p(h)}:${p(m)}:${p(s)}`;
}
