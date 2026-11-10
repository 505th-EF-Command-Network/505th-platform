/** Navigation — same sections, labels and order as the live site. */
export const DISCORD_INVITE = "https://discord.gg/uh8ax8MhNb";

export type NavItem = { label: string; href: string };
export type PanelKey = "career" | "media" | "resources";

export type NavSection = {
  key: PanelKey;
  code: string;
  label: string;
  short: string;
  icon: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "career",
    code: "01",
    label: "CAREER PATHS",
    short: "CAREERS",
    icon: "/images/icons/About Us.png",
    items: [
      { label: "505th Expeditionary Force", href: "/about-505th" },
      { label: "Alpha Company", href: "/about-alpha-company" },
      { label: "JTF-23 Force Recon", href: "/about-stalker" },
      { label: "Hospital Corpsman", href: "/about-corpsman" },
      { label: "54th Air Wing", href: "/about-54th-air-wing" },
    ],
  },
  {
    key: "media",
    code: "02",
    label: "MEDIA",
    short: "MEDIA",
    icon: "/images/icons/Media.png",
    items: [
      { label: "Gallery", href: "/media-gallery" },
      { label: "Videos", href: "/media-videos" },
    ],
  },
  {
    key: "resources",
    code: "03",
    label: "RESOURCES",
    short: "RESOURCES",
    icon: "/images/icons/Resources.png",
    items: [
      { label: "Discord Rules", href: "/resources-discord-rules" },
      { label: "General Handbook", href: "/resources-handbook" },
      { label: "Hospital Corps Handbook", href: "/resources-hospital-corps-handbook" },
      { label: "Control Reference", href: "/resources-keybinds" },
      { label: "Roster", href: "/resources-roster" },
      { label: "After Action Reports", href: "/resources-aar" },
      { label: "Field Lexicon", href: "/resources-field-lexicon" },
    ],
  },
];

/** Section + page for the "you are here" strip and highlights. */
export function locate(pathname: string): { section: NavSection | null; item: NavItem | null } {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.href === pathname);
    if (item) return { section, item };
  }
  return { section: null, item: null };
}
