/**
 * Hub app settings (H3, approved mock 2026-11-11) — saved per person in users/{uid}.hubPrefs.settings,
 * so they follow you to every PC. Same shape in the app (apps/hub/src/renderer/src/settings.ts).
 * Everything is checked here; unknown keys are dropped.
 */
type U = Record<string, any>;
export const EVENTS = ["message", "tag", "ticket", "bct", "op", "project", "rank", "note", "net", "staff"] as const;
export const KEYS = ["palette", "rail", "filter", "messages", "refresh", "toggle", "notes", "newNote", "lock", "settings", "help", "dnd"] as const;
const one = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const hhmm = (v: unknown, d: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const tz = (v: unknown) => (typeof v === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(v) && v.length <= 40 ? v : "");
/** "Ctrl+Shift+K" style; letters, digits, F1–F12, / , ? and a few named keys. */
const key = (v: unknown, d: string) => (typeof v === "string" && /^((Ctrl|Shift|Alt)\+){0,3}([A-Z0-9/,?]|F([1-9]|1[0-2])|Escape|Space)$/.test(v) ? v : d);

export const DEFAULT_KEYS: Record<(typeof KEYS)[number], string> = { palette: "Ctrl+K", rail: "Ctrl+B", filter: "/", messages: "Ctrl+M", refresh: "F5", toggle: "Ctrl+Shift+5",
  notes: "Ctrl+N", newNote: "Ctrl+Shift+N", lock: "Ctrl+L", settings: "Ctrl+,", help: "?", dnd: "Ctrl+D" };

export function cleanSettings(b: U) {
  const n = (b?.notify ?? {}) as U, ev = (n.ev ?? {}) as U, k = (b?.keys ?? {}) as U, L = (b?.look ?? {}) as U, A = (b?.a11y ?? {}) as U, S = (b?.security ?? {}) as U, D = (b?.devices ?? {}) as U;
  return {
    startup: bool(b?.startup, false), closeToTray: bool(b?.closeToTray, true), openOn: one(b?.openOn, ["dashboard", "last", "messages"], "dashboard"),
    textSize: one(b?.textSize, ["s", "m", "l", "xl"], "m"), anim: one(b?.anim, ["on", "reduced", "off"], "on"), contrast: bool(b?.contrast, false),
    time: one(b?.time, ["uk", "local", "both"], "uk"),
    tz: tz(b?.tz), tzPin: bool(b?.tzPin, false), dateStyle: one(b?.dateStyle, ["dmy", "mdy", "iso"], "dmy"), h24: bool(b?.h24, true),
    clocks: (Array.isArray(b?.clocks) ? b.clocks : []).slice(0, 3).map((c: U) => ({ tz: tz(c?.tz) || "UTC", label: String(c?.label ?? "").replace(/[^\w .-]/g, "").slice(0, 12) })),
    autoUpdate: bool(b?.autoUpdate, true), channel: one(b?.channel, ["stable", "beta"], "stable"),
    look: {
      theme: one(L.theme, ["cyan", "gold", "olive", "night"], "cyan"), accent: L.accent === "" ? "" : hex(L.accent, ""), platoon: bool(L.platoon, false),
      nightAuto: bool(L.nightAuto, false), nightFrom: hhmm(L.nightFrom, "22:00"), nightTo: hhmm(L.nightTo, "07:00"), glow: num(L.glow, 0, 100, 50), corners: one(L.corners, ["sharp", "round"], "sharp"),
      bg: one(L.bg, ["plain", "grid", "hex", "scan", "picture"], "grid"), bgUrl: typeof L.bgUrl === "string" && /^https:\/\/res\.cloudinary\.com\/[\w./%-]+$/.test(L.bgUrl) ? L.bgUrl.slice(0, 400) : "",
      bgBlur: num(L.bgBlur, 0, 20, 6), bgDark: num(L.bgDark, 0, 95, 70), cards: num(L.cards, 50, 100, 100), side: one(L.side, ["full", "icons", "auto"], "full"),
      density: one(L.density, ["compact", "normal", "roomy"], "normal"), cb: bool(L.cb, false),
    },
    a11y: {
      style: one(A.style, ["edge", "tint", "badge"], "edge"), color: hex(A.color, "#f59e0b"), until: bool(A.until, false), safe: bool(A.safe, false), stay: bool(A.stay, false),
      away: bool(A.away, true), soundText: bool(A.soundText, true), plain: bool(A.plain, false), easyFont: bool(A.easyFont, false), lines: one(A.lines, ["normal", "wide"], "normal"),
      focus: bool(A.focus, false), big: bool(A.big, false), moreTime: bool(A.moreTime, false), reader: bool(A.reader, false),
    },
    notify: {
      popup: bool(n.popup, true), windows: bool(n.windows, true), taskbar: bool(n.taskbar, true), edge: bool(n.edge, true), sound: bool(n.sound, false),
      dnd: one(n.dnd, ["off", "on", "night", "custom"], "off"), dndFrom: hhmm(n.dndFrom, "23:00"), dndTo: hhmm(n.dndTo, "08:00"),
      opMins: [5, 10, 15, 30, 60].includes(Number(n.opMins)) ? Number(n.opMins) : 15, newDevice: bool(n.newDevice, true), letOps: bool(n.letOps, true), preview: bool(n.preview, true),
      ev: Object.fromEntries(EVENTS.map((e) => { const x = (ev[e] ?? {}) as U; return [e, { popup: bool(x.popup, e !== "bct"), bell: bool(x.bell, true), flash: bool(x.flash, e === "message" || e === "op" || e === "net") }]; })),
    },
    /** pinHash = PBKDF2 "salt.hash" made in the app — never the PIN. */
    security: { lock: one(S.lock, ["off", "5", "15", "60", "sleep"], "off"), pinHash: typeof S.pinHash === "string" && /^[0-9a-f]{32}\.[0-9a-f]{64}$/.test(S.pinHash) ? S.pinHash : "",
      streamer: bool(S.streamer, false), alerts: bool(S.alerts, true) },
    devices: { max: [2, 3, 5].includes(Number(D.max)) ? Number(D.max) : 3, idleDays: [7, 30, 90].includes(Number(D.idleDays)) ? Number(D.idleDays) : 30,
      trusted: (Array.isArray(D.trusted) ? D.trusted : []).filter((x: unknown) => typeof x === "string" && /^[a-f0-9]{24}$/.test(x)).slice(0, 10) },
    sounds: (() => { const so = (b?.sounds ?? {}) as U, mine = (Array.isArray(so.mine) ? so.mine : []).filter((m: U) => typeof m?.url === "string" && /^https:\/\/res\.cloudinary\.com\/[\w./%-]+$/.test(m.url)).slice(0, 8)
      .map((m: U) => ({ id: String(m.id ?? "").replace(/[^\w-]/g, "").slice(0, 24) || "my", name: String(m.name ?? "My sound").slice(0, 30), url: m.url }));
      const ok = new Set(["radio", "unsc", "chime", "ping", "klaxon", "none", ...mine.map((m: U) => m.id)]), map = (so.map ?? {}) as U;
      return { vol: num(so.vol, 0, 100, 70), mine, map: Object.fromEntries(EVENTS.filter((e) => ok.has(map[e])).map((e) => [e, map[e]])) }; })(),
    keys: Object.fromEntries(KEYS.map((x) => [x, key(k[x], DEFAULT_KEYS[x])])),
    keysOff: (Array.isArray(b?.keysOff) ? b.keysOff : []).filter((x: unknown) => (KEYS as readonly unknown[]).includes(x)),
    pageKeys: bool(b?.pageKeys, true),
  };
}
