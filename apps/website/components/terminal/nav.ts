/**
 * Command Terminal sidebar. Group names = proposed refined grouping (2026-11-08).
 * `ready: false` items open an honest "module not built yet" page.
 */
export type TermLink = { label: string; href: string; ready: boolean };
export type TermGroup = { key: string; label: string; icon: string; links: TermLink[] };

export const TERMINAL_NAV: TermGroup[] = [
  {
    key: "personnel",
    label: "PERSONNEL",
    icon: "◉",
    links: [
      { label: "Roster & Service Records", href: "/terminal/personnel", ready: true },
      { label: "Pending Approvals", href: "/terminal/personnel/pending", ready: true },
      { label: "Promotions", href: "/terminal/personnel/promotions", ready: false },
      { label: "Commendations & Ribbons", href: "/terminal/personnel/commendations", ready: false },
    ],
  },
  {
    key: "operations",
    label: "EVENTS",
    icon: "◈",
    links: [
      { label: "Attendance Tracker", href: "/terminal/operations/attendance", ready: true },
      { label: "After-Action Reports", href: "/terminal/operations/aars", ready: true },
      { label: "Events & Sign-ups", href: "/terminal/operations/events", ready: false },
    ],
  },
  {
    key: "orbat",
    label: "ORDER OF BATTLE",
    icon: "▤",
    links: [
      { label: "Unit Structure", href: "/terminal/orbat/structure", ready: false },
      { label: "Slot Assignments", href: "/terminal/orbat/slots", ready: false },
    ],
  },
  {
    key: "intel",
    label: "INTELLIGENCE",
    icon: "◬",
    links: [{ label: "Unit Statistics", href: "/terminal/intel/stats", ready: false }],
  },
  {
    key: "public",
    label: "PUBLIC AFFAIRS",
    icon: "✦",
    links: [
      { label: "Page Content", href: "/terminal/public/content", ready: false },
      { label: "Media Library", href: "/terminal/public/media", ready: false },
      { label: "Announcements", href: "/terminal/public/announcements", ready: false },
    ],
  },
  {
    key: "integrations",
    label: "INTEGRATIONS",
    icon: "⇄",
    links: [
      { label: "Cortana Bot", href: "/terminal/integrations/cortana", ready: false },
      { label: "Discord Roles", href: "/terminal/integrations/discord", ready: false },
    ],
  },
  {
    key: "security",
    label: "SECURITY",
    icon: "⛨",
    links: [
      { label: "Access Attempts", href: "/terminal/security/access", ready: true },
      { label: "Audit Log", href: "/terminal/security/audit", ready: true },
    ],
  },
];

export function findLink(pathname: string): { group: TermGroup; link: TermLink } | null {
  let best: { group: TermGroup; link: TermLink } | null = null;
  for (const group of TERMINAL_NAV)
    for (const link of group.links)
      if ((pathname === link.href || pathname.startsWith(`${link.href}/`)) && (!best || link.href.length > best.link.href.length)) best = { group, link };
  return best;
}
