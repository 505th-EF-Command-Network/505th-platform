/**
 * Hub app settings (H3, approved mock 2026-11-11) — saved per person in users/{uid}.hubPrefs.settings,
 * so they follow you to every PC. Same shape in the app (apps/hub/src/renderer/src/settings.ts).
 * Everything is checked here; unknown keys are dropped.
 */
type U = Record<string, any>;
export const EVENTS = ["message", "tag", "ticket", "bct", "op", "project", "rank"] as const;
export const KEYS = ["palette", "rail", "filter", "messages", "refresh", "toggle"] as const;
const one = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const hhmm = (v: unknown, d: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
/** "Ctrl+Shift+K" style; letters, digits, F1–F12, / and a few named keys. */
const key = (v: unknown, d: string) => (typeof v === "string" && /^((Ctrl|Shift|Alt)\+){0,3}([A-Z0-9/]|F([1-9]|1[0-2])|Escape|Space)$/.test(v) ? v : d);

export const DEFAULT_KEYS: Record<(typeof KEYS)[number], string> = { palette: "Ctrl+K", rail: "Ctrl+B", filter: "/", messages: "Ctrl+M", refresh: "F5", toggle: "Ctrl+Shift+5" };

export function cleanSettings(b: U) {
  const n = (b?.notify ?? {}) as U, ev = (n.ev ?? {}) as U, k = (b?.keys ?? {}) as U;
  return {
    startup: bool(b?.startup, false), closeToTray: bool(b?.closeToTray, true), openOn: one(b?.openOn, ["dashboard", "last"], "dashboard"),
    textSize: one(b?.textSize, ["s", "m", "l", "xl"], "m"), anim: one(b?.anim, ["on", "reduced", "off"], "on"), contrast: bool(b?.contrast, false),
    time: one(b?.time, ["uk", "local", "both"], "uk"),
    notify: {
      popup: bool(n.popup, true), taskbar: bool(n.taskbar, true), edge: bool(n.edge, true), sound: bool(n.sound, false),
      dnd: one(n.dnd, ["off", "night", "custom"], "off"), dndFrom: hhmm(n.dndFrom, "23:00"), dndTo: hhmm(n.dndTo, "08:00"),
      opMins: [5, 10, 15, 30, 60].includes(Number(n.opMins)) ? Number(n.opMins) : 15, newDevice: bool(n.newDevice, true),
      ev: Object.fromEntries(EVENTS.map((e) => { const x = (ev[e] ?? {}) as U; return [e, { popup: bool(x.popup, e !== "bct"), bell: bool(x.bell, true), flash: bool(x.flash, e === "message" || e === "op") }]; })),
    },
    keys: Object.fromEntries(KEYS.map((x) => [x, key(k[x], DEFAULT_KEYS[x])])),
  };
}
