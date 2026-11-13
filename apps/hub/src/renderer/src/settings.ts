import type { AppSettings, NotifyEvent, ShortcutId, Summary } from "../../preload/api";

/**
 * H3 app settings in the window: defaults, look (text size / animations / contrast), shortcuts, alert kinds,
 * quiet hours and the alert sound. Saved to the account through /api/hub/prefs (checked again by the website).
 */
export const EVENTS: [NotifyEvent, string, string][] = [
  ["message", "💬", "Direct message"], ["tag", "@", "Tagged (projects, chats)"], ["ticket", "🎫", "Ticket waiting on staff"], ["bct", "✚", "Recruit waiting for BCT"],
  ["op", "⚑", "Op starting soon"], ["project", "☷", "Project invite / task / overdue"], ["rank", "★", "My rank / role / medal / account"],
  ["note", "📝", "Note reminder"], ["net", "📡", "Network Status (Cortana / website down)"], ["staff", "🖥", "Staff opened the Hub / website Terminal"],
];
/** Shortcut groups for My Shortcuts. "anywhere" = works even when the Hub is hidden. */
export const SHORTCUT_GROUPS: [string, [ShortcutId, string, boolean?][]][] = [
  ["Navigation", [["palette", "Jump to page / action"], ["rail", "Collapse side menu"], ["filter", "Filter menu"], ["refresh", "Refresh"], ["settings", "Open Settings"]]],
  ["Messages & Alerts", [["messages", "Open / close Messages"], ["dnd", "Do not disturb on / off"]]],
  ["Notes", [["notes", "Open Notes"], ["newNote", "New note"]]],
  ["Hub", [["toggle", "Show / hide the Hub", true], ["lock", "Lock the Hub"], ["help", "Shortcut cheat sheet"]]],
];
export const SHORTCUTS: [ShortcutId, string][] = SHORTCUT_GROUPS.flatMap(([, l]) => l.map(([id, t]) => [id, t] as [ShortcutId, string]));
export const DEFAULT_KEYS: Record<ShortcutId, string> = { palette: "Ctrl+K", rail: "Ctrl+B", filter: "/", messages: "Ctrl+M", refresh: "F5", toggle: "Ctrl+Shift+5",
  notes: "Ctrl+N", newNote: "Ctrl+Shift+N", lock: "Ctrl+L", settings: "Ctrl+,", help: "?", dnd: "Ctrl+D" };
export const THEMES = { cyan: { name: "505th Cyan", accent: "#00d9ff", panel: "#0b0f15", panel2: "#0e131b" }, gold: { name: "Gold Command", accent: "#c9a227", panel: "#0f0d09", panel2: "#15120c" },
  olive: { name: "Olive Drab", accent: "#9bbf4a", panel: "#0c0f0a", panel2: "#11150e" }, night: { name: "Night Ops", accent: "#ff4d4d", panel: "#070707", panel2: "#0c0b0b" } } as const;
export const ACCENTS = ["#00d9ff", "#c9a227", "#9bbf4a", "#ff4d4d", "#a78bfa", "#f472b6"];
export const DEFAULT_SETTINGS: AppSettings = {
  startup: false, closeToTray: true, openOn: "dashboard", textSize: "m", anim: "on", contrast: false, time: "uk",
  tz: "", tzPin: false, clocks: [], dateStyle: "dmy", h24: true, autoUpdate: true, channel: "stable",
  look: { theme: "cyan", accent: "", platoon: false, nightAuto: false, nightFrom: "22:00", nightTo: "07:00", glow: 50, corners: "sharp", bg: "grid", bgUrl: "", bgBlur: 6, bgDark: 70, cards: 100, side: "full", density: "normal", cb: false },
  a11y: { style: "edge", color: "#f59e0b", until: false, safe: false, stay: false, away: true, soundText: true, plain: false, easyFont: false, lines: "normal", focus: false, big: false, moreTime: false, reader: false },
  notify: { popup: true, windows: true, taskbar: true, edge: true, sound: false, dnd: "off", dndFrom: "23:00", dndTo: "08:00", opMins: 15, newDevice: true, letOps: true, preview: true,
    ev: Object.fromEntries(EVENTS.map(([e]) => [e, { popup: e !== "bct", bell: true, flash: e === "message" || e === "op" || e === "net" }])) as AppSettings["notify"]["ev"] },
  security: { lock: "off", pinHash: "", streamer: false, alerts: true },
  devices: { max: 3, idleDays: 30, trusted: [] },
  sounds: { vol: 70, map: { message: "radio", op: "klaxon", ticket: "ping", staff: "ping" }, mine: [] },
  keys: { ...DEFAULT_KEYS }, keysOff: [], pageKeys: true,
};
/** Saved settings on top of the defaults (new options get their default). */
export function mergeSettings(s?: Partial<AppSettings> | null): AppSettings {
  const d = DEFAULT_SETTINGS;
  return { ...d, ...(s ?? {}), look: { ...d.look, ...(s?.look ?? {}) }, a11y: { ...d.a11y, ...(s?.a11y ?? {}) }, security: { ...d.security, ...(s?.security ?? {}) }, devices: { ...d.devices, ...(s?.devices ?? {}) }, sounds: { ...d.sounds, ...(s?.sounds ?? {}), map: { ...d.sounds.map, ...(s?.sounds?.map ?? {}) } },
    notify: { ...d.notify, ...(s?.notify ?? {}), ev: Object.fromEntries(EVENTS.map(([e]) => [e, { ...d.notify.ev[e], ...(s?.notify?.ev?.[e] ?? {}) }])) as AppSettings["notify"]["ev"] },
    keys: { ...d.keys, ...(s?.keys ?? {}) }, clocks: (s?.clocks ?? d.clocks).slice(0, 3), keysOff: s?.keysOff ?? [] };
}

/** The current settings, readable from any component (set by App). */
let current: AppSettings = DEFAULT_SETTINGS;
export const settingsNow = () => current;
const ZOOM = { s: 0.9, m: 1, l: 1.1, xl: 1.25 };
const inRange = (from: string, to: string, tz?: string) => {
  const now = new Date().toLocaleTimeString("en-GB", { timeZone: tz || undefined, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return from <= to ? now >= from && now < to : now >= from || now < to;
};
/** Platoon colour (set by App from my platoon) — used when look.platoon is on. */
let platoonColour = "";
export const setPlatoonColour = (c: string) => { platoonColour = /^#[0-9a-f]{6}$/i.test(c) ? c : ""; if (current.look.platoon) applySettings(current); };
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");

export function applySettings(s: AppSettings) {
  current = s;
  const h = document.documentElement, L = s.look, A = s.a11y;
  const night = L.theme === "night" || (L.nightAuto && inRange(L.nightFrom, L.nightTo));
  const th = THEMES[night ? "night" : L.theme];
  const accent = (L.platoon && platoonColour) || L.accent || th.accent;
  const v = (k: string, x: string) => h.style.setProperty(k, x);
  v("--color-cyan", accent); v("--accent-rgb", hexRgb(accent)); v("--color-panel", th.panel); v("--color-panel2", th.panel2);
  v("--glow", String(L.glow / 100)); v("--card-a", String(L.cards / 100)); v("--bg-blur", `${L.bgBlur}px`); v("--bg-dark", String(L.bgDark / 100));
  v("--bg-img", L.bg === "picture" && /^https:\/\/res\.cloudinary\.com\//.test(L.bgUrl) ? `url("${L.bgUrl}")` : "none");
  v("--focus-c", A.color);
  const cls: [string, boolean][] = [["anim-off", s.anim === "off"], ["anim-reduced", s.anim === "reduced"], ["hi-contrast", s.contrast], ["round", L.corners === "round"],
    ["bg-plain", L.bg === "plain"], ["bg-grid", L.bg === "grid"], ["bg-hex", L.bg === "hex"], ["bg-scan", L.bg === "scan"], ["bg-pic", L.bg === "picture"],
    ["side-icons", L.side === "icons"], ["side-auto", L.side === "auto"], ["dense", L.density === "compact"], ["roomy", L.density === "roomy"], ["cb", L.cb],
    ["focus-strong", A.focus], ["big-btn", A.big], ["easy-font", A.easyFont], ["lines-wide", A.lines === "wide"], ["streamer", s.security.streamer]];
  for (const [c, on] of cls) h.classList.toggle(c, on);
  void window.cn.app.applySettings({ startup: s.startup, closeToTray: s.closeToTray, zoom: ZOOM[s.textSize], toggleKey: s.keysOff.includes("toggle") ? "" : s.keys.toggle });
}
/** Re-check auto Night Ops every minute. */
setInterval(() => { if (current.look.nightAuto) applySettings(current); }, 60_000);

/** Time & Region helpers. */
export const myTz = () => current.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
export function fmtTime(d: Date, tz?: string) {
  return d.toLocaleTimeString("en-GB", { timeZone: tz || undefined, hour: "2-digit", minute: "2-digit", hourCycle: current.h24 ? "h23" : "h12" });
}
export function fmtDate(d: Date, tz?: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz || undefined, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return current.dateStyle === "iso" ? `${p.year}-${p.month}-${p.day}` : current.dateStyle === "mdy" ? `${p.month}/${p.day}/${p.year}` : `${p.day}/${p.month}/${p.year}`;
}
export const ZONES: [string, string][] = [["Europe/London", "UK"], ["Europe/Berlin", "CET"], ["America/New_York", "EST"], ["America/Chicago", "CST"], ["America/Denver", "MST"],
  ["America/Los_Angeles", "PST"], ["Australia/Sydney", "AEST"], ["Asia/Tokyo", "JST"], ["Asia/Kolkata", "IST"], ["Pacific/Auckland", "NZST"], ["UTC", "UTC"]];

/** Hub PIN (Hub lock) — PBKDF2 hash, never the PIN itself. */
export async function hashPin(pin: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" }, k, 256));
  const hx = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hx(salt)}.${hx(bits)}`;
}
export async function checkPin(pin: string, stored: string) {
  const [salt] = stored.split(".");
  if (!salt) return false;
  const u = new Uint8Array(salt.match(/../g)!.map((x) => parseInt(x, 16)));
  return (await hashPin(pin, u)) === stored;
}

/** "Ctrl+Shift+K" ↔ a key press. */
export function comboOf(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const k = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(k)) return null;
  if (!/^([A-Z0-9/,?]|F([1-9]|1[0-2])|Escape|Space)$/.test(k)) return null;
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.shiftKey && k !== "/" && k !== "?" ? "Shift" : "", e.altKey ? "Alt" : "", k].filter(Boolean).join("+");
}
export const isKey = (e: KeyboardEvent, id: ShortcutId) => !current.keysOff.includes(id) && comboOf(e) === current.keys[id];

/** Which setting an alert belongs to (from its type / title). */
export function alertKind(a: Summary["alerts"][number]): NotifyEvent {
  const t = `${a.type} ${a.title}`.toLowerCase();
  if (a.type === "staff_online") return "staff";
  if (/tagged|mention/.test(t)) return "tag";
  if (/message|dm|chat/.test(a.type)) return "message";
  if (/project|task/.test(t)) return "project";
  if (/ticket/.test(t)) return "ticket";
  if (/note|reminder/.test(t)) return "note";
  if (/offline|outage|down\b|network status/.test(t)) return "net";
  if (/bct|recruit|register/.test(t)) return "bct";
  if (/event|op\b|rsvp/.test(t)) return "op";
  return "rank";
}

/** Do not disturb: on = always (tray toggle), night = 23:00–08:00, custom = your own times (UK time). */
export function quietNow(s: AppSettings) {
  const n = s.notify;
  if (n.dnd === "off") return false;
  if (n.dnd === "on") return true;
  const [from, to] = n.dnd === "night" ? ["23:00", "08:00"] : [n.dndFrom, n.dndTo];
  const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return from <= to ? now >= from! && now < to! : now >= from! || now < to!;
}

/** Built-in alert sounds (made in the page — no files). */
export const SOUNDS: [string, string, [number, number][]][] = [
  ["radio", "Radio beep", [[1200, 0.08], [0, 0.05], [1200, 0.08]]], ["unsc", "UNSC alert", [[660, 0.15], [880, 0.15], [660, 0.15]]], ["chime", "Soft chime", [[880, 0.3], [1320, 0.4]]],
  ["ping", "Ping", [[1500, 0.12]]], ["klaxon", "Klaxon (ops)", [[440, 0.25], [330, 0.25], [440, 0.25], [330, 0.25]]],
];
/** Play a sound by id (built-in or one of mine). Returns its name for the caption. */
export function playSound(id: string, s: AppSettings = current): string {
  if (id === "none") return "";
  const v = s.sounds.vol / 100, mine = s.sounds.mine.find((m) => m.id === id);
  if (mine) { const a = new Audio(mine.url); a.volume = v; void a.play().catch(() => {}); return mine.name; }
  const x = SOUNDS.find((z) => z[0] === id) ?? SOUNDS[2]!;
  try {
    const A = new AudioContext(); void A.resume();
    let t = A.currentTime + 0.03;
    for (const [f, d] of x[2]) {
      if (f) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + d); }
      t += d;
    }
    setTimeout(() => void A.close(), (t - A.currentTime) * 1000 + 300);
  } catch { /* no audio device */ }
  return x[1];
}

/** Short two-tone "ding-ding" made in the page — no sound file. */
export function playDing() {
  try {
    const A = new AudioContext();
    void A.resume(); // some PCs start it paused
    const n = A.currentTime + 0.05;
    for (const [f, t] of [[880, 0], [1320, 0.16]] as const) {
      const o = A.createOscillator(), g = A.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0, n + t); g.gain.linearRampToValueAtTime(0.25, n + t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, n + t + 0.3);
      o.connect(g); g.connect(A.destination); o.start(n + t); o.stop(n + t + 0.32);
    }
    setTimeout(() => void A.close(), 800);
  } catch { /* no audio device */ }
}

/** Send one notification the way My Notifications says. */
export function fire(kind: NotifyEvent | "test", t: { id: string; title: string; body: string; icon?: string; color?: string; urgent?: boolean; actions?: { id: string; label: string }[] }, force?: { popup: boolean; taskbar: boolean; edge: boolean; sound: boolean; windows?: boolean }) {
  const s = current.notify;
  const ev = kind === "test" ? { popup: true, bell: true, flash: true } : s.ev[kind];
  if (!force && quietNow(current) && !(kind === "op" && current.notify.letOps)) return;
  const o = force ?? { popup: s.popup && ev.popup, windows: s.windows && ev.popup, taskbar: s.taskbar && ev.flash, edge: s.edge && ev.flash, sound: s.sound && ev.popup };
  if (o.popup || o.taskbar || o.edge || o.windows) {
    const a = current.a11y, body = current.notify.preview || kind === "test" ? t.body : "Open the Hub to read it.";
    void window.cn.notify.show({ ...t, body }, { popup: o.popup, taskbar: o.taskbar, edge: o.edge, windows: !!o.windows, test: kind === "test", style: a.style, color: a.color, safe: a.safe, until: a.until, stay: a.stay });
  }
  if (o.sound) {
    const id = kind === "test" ? "chime" : current.sounds.map[kind] ?? "chime";
    const name = playSound(id);
    if (name && current.a11y.soundText) window.dispatchEvent(new CustomEvent("hub:caption", { detail: `🔊 ${name}: ${t.title}` }));
  }
}

