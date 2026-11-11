import type { AppSettings, NotifyEvent, ShortcutId, Summary } from "../../preload/api";

/**
 * H3 app settings in the window: defaults, look (text size / animations / contrast), shortcuts, alert kinds,
 * quiet hours and the alert sound. Saved to the account through /api/hub/prefs (checked again by the website).
 */
export const EVENTS: [NotifyEvent, string, string][] = [
  ["message", "💬", "Direct message"], ["tag", "@", "Tagged (projects, chats)"], ["ticket", "🎫", "Ticket waiting on staff"], ["bct", "✚", "Recruit waiting for BCT"],
  ["op", "⚑", "Op starting soon"], ["project", "☷", "Project invite / task / overdue"], ["rank", "★", "My rank / role / medal / account"],
];
export const SHORTCUTS: [ShortcutId, string][] = [["palette", "Jump to page / action"], ["rail", "Collapse side menu"], ["filter", "Filter menu"], ["messages", "Open Messages"], ["refresh", "Refresh"], ["toggle", "Show / hide the Hub (anywhere)"]];
export const DEFAULT_KEYS: Record<ShortcutId, string> = { palette: "Ctrl+K", rail: "Ctrl+B", filter: "/", messages: "Ctrl+M", refresh: "F5", toggle: "Ctrl+Shift+5" };
export const DEFAULT_SETTINGS: AppSettings = {
  startup: false, closeToTray: true, openOn: "dashboard", textSize: "m", anim: "on", contrast: false, time: "uk",
  notify: { popup: true, taskbar: true, edge: true, sound: false, dnd: "off", dndFrom: "23:00", dndTo: "08:00", opMins: 15, newDevice: true,
    ev: Object.fromEntries(EVENTS.map(([e]) => [e, { popup: e !== "bct", bell: true, flash: e === "message" || e === "op" }])) as AppSettings["notify"]["ev"] },
  keys: { ...DEFAULT_KEYS },
};
/** Saved settings on top of the defaults (new options get their default). */
export function mergeSettings(s?: Partial<AppSettings> | null): AppSettings {
  const d = DEFAULT_SETTINGS;
  return { ...d, ...(s ?? {}), notify: { ...d.notify, ...(s?.notify ?? {}), ev: Object.fromEntries(EVENTS.map(([e]) => [e, { ...d.notify.ev[e], ...(s?.notify?.ev?.[e] ?? {}) }])) as AppSettings["notify"]["ev"] },
    keys: { ...d.keys, ...(s?.keys ?? {}) } };
}

/** The current settings, readable from any component (set by App). */
let current: AppSettings = DEFAULT_SETTINGS;
export const settingsNow = () => current;
const ZOOM = { s: 0.9, m: 1, l: 1.1, xl: 1.25 };
export function applySettings(s: AppSettings) {
  current = s;
  const h = document.documentElement;
  h.classList.toggle("anim-off", s.anim === "off");
  h.classList.toggle("anim-reduced", s.anim === "reduced");
  h.classList.toggle("hi-contrast", s.contrast);
  void window.cn.app.applySettings({ startup: s.startup, closeToTray: s.closeToTray, zoom: ZOOM[s.textSize], toggleKey: s.keys.toggle });
}

/** "Ctrl+Shift+K" ↔ a key press. */
export function comboOf(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const k = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(k)) return null;
  if (!/^([A-Z0-9/]|F([1-9]|1[0-2])|Escape|Space)$/.test(k)) return null;
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.shiftKey && k !== "/" ? "Shift" : "", e.altKey ? "Alt" : "", k].filter(Boolean).join("+");
}
export const isKey = (e: KeyboardEvent, id: ShortcutId) => comboOf(e) === current.keys[id];

/** Which setting an alert belongs to (from its type / title). */
export function alertKind(a: Summary["alerts"][number]): NotifyEvent {
  const t = `${a.type} ${a.title}`.toLowerCase();
  if (/tagged|mention/.test(t)) return "tag";
  if (/message|dm|chat/.test(a.type)) return "message";
  if (/project|task/.test(t)) return "project";
  if (/ticket/.test(t)) return "ticket";
  if (/bct|recruit|register/.test(t)) return "bct";
  if (/event|op\b|rsvp/.test(t)) return "op";
  return "rank";
}

/** Do not disturb: night = 23:00–08:00, custom = your own times (UK time). */
export function quietNow(s: AppSettings) {
  const n = s.notify;
  if (n.dnd === "off") return false;
  const [from, to] = n.dnd === "night" ? ["23:00", "08:00"] : [n.dndFrom, n.dndTo];
  const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return from <= to ? now >= from! && now < to! : now >= from! || now < to!;
}

/** Short two-tone "ding-ding" made in the page — no sound file. */
export function playDing() {
  try {
    const A = new AudioContext(), n = A.currentTime;
    for (const [f, t] of [[880, 0], [1320, 0.16]] as const) {
      const o = A.createOscillator(), g = A.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0, n + t); g.gain.linearRampToValueAtTime(0.25, n + t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, n + t + 0.3);
      o.connect(g); g.connect(A.destination); o.start(n + t); o.stop(n + t + 0.32);
    }
    setTimeout(() => void A.close(), 800);
  } catch { /* no audio device */ }
}

/** Send one notification the way My Notifications says. */
export function fire(kind: NotifyEvent | "test", t: { id: string; title: string; body: string; icon?: string; color?: string; urgent?: boolean; actions?: { id: string; label: string }[] }, force?: { popup: boolean; taskbar: boolean; edge: boolean; sound: boolean }) {
  const s = current.notify;
  const ev = kind === "test" ? { popup: true, bell: true, flash: true } : s.ev[kind];
  if (!force && quietNow(current)) return;
  const o = force ?? { popup: s.popup && ev.popup, taskbar: s.taskbar && ev.flash, edge: s.edge && ev.flash, sound: s.sound && ev.popup };
  if (o.popup || o.taskbar || o.edge) void window.cn.notify.show(t, { popup: o.popup, taskbar: o.taskbar, edge: o.edge });
  if (o.sound) playDing();
}
