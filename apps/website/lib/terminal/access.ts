/**
 * Command Terminal access grid (approved mock 2026-11-09).
 * Each member's role gives default access; Officer Management can grant or
 * remove single items per person (stored on users/{uid}.access as {key: 0|1}).
 * Pure: no database. Used by the server checks and sent to the browser for the menu.
 */

export const ROLE_LEVEL: Record<string, number> = {
  recruiter: 2,
  nco: 2.5,
  staff_nco: 3,
  officer: 4,
  developer: 4.5,
  commander: 5,
};

export type AccessItem = {
  key: string;
  label: string;
  group: "MANPOWER" | "OPERATIONS" | "DISCORD" | "WORKSPACE" | "SECURITY" | "COMMAND";
  /** Lowest role that gets it by default. */
  min: number;
  /** Developer / Commander only. Never granted to anyone else. */
  locked?: boolean;
};

export const ACCESS: AccessItem[] = [
  { key: "bct", label: "BCT Approvals", group: "MANPOWER", min: 2 },
  { key: "pers", label: "Personnel Files", group: "MANPOWER", min: 3 },
  { key: "roster", label: "Roster", group: "MANPOWER", min: 2.5 },
  { key: "oob", label: "Order of Battle", group: "MANPOWER", min: 3 },
  { key: "rstat", label: "Recruit Stats", group: "MANPOWER", min: 2.5 },
  { key: "promote", label: "Promote", group: "MANPOWER", min: 4 },
  { key: "att", label: "Attendance", group: "OPERATIONS", min: 2.5 },
  { key: "lock", label: "Lock Attendance", group: "OPERATIONS", min: 3 },
  { key: "aar", label: "AAR", group: "OPERATIONS", min: 2.5 },
  { key: "media", label: "Gallery / Videos", group: "OPERATIONS", min: 2.5 },
  { key: "tk", label: "Tickets", group: "DISCORD", min: 2 },
  { key: "tkrep", label: "Report Tickets", group: "DISCORD", min: 3 },
  { key: "ev", label: "Events", group: "DISCORD", min: 2.5 },
  { key: "send", label: "Send Message", group: "DISCORD", min: 2.5 },
  { key: "qu", label: "Quick Upload", group: "DISCORD", min: 3 },
  { key: "info", label: "Info Posts", group: "DISCORD", min: 3 },
  { key: "modw", label: "Warn / Timeout", group: "DISCORD", min: 2.5 },
  { key: "modk", label: "Kick / Ban", group: "DISCORD", min: 3 },
  { key: "proj", label: "Projects", group: "WORKSPACE", min: 3 },
  { key: "notes", label: "Notes", group: "WORKSPACE", min: 3 },
  { key: "web", label: "Website", group: "WORKSPACE", min: 3 },
  { key: "om", label: "Officer Management", group: "SECURITY", min: 3 },
  { key: "net", label: "Network + Restart", group: "SECURITY", min: 3 },
  { key: "audit", label: "Audit Log", group: "SECURITY", min: 4 },
  { key: "bot", label: "Bot Server", group: "COMMAND", min: 4.5, locked: true },
  { key: "set", label: "Settings", group: "COMMAND", min: 4.5, locked: true },
  { key: "ovr", label: "Overall Status", group: "COMMAND", min: 4.5, locked: true },
];

export const ACCESS_KEYS = new Set(ACCESS.map((a) => a.key));
const BY_KEY = new Map(ACCESS.map((a) => [a.key, a]));

export type Overrides = Record<string, 0 | 1>;

export const roleLevel = (role: string | null | undefined) => ROLE_LEVEL[role ?? ""] ?? 0;
export const hasTerminal = (role: string | null | undefined) => roleLevel(role) >= 2;

/** Clean an overrides object: known keys only, 0/1 only, never locked items. */
export function cleanOverrides(raw: unknown): Overrides {
  const out: Overrides = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const item = BY_KEY.get(k);
    if (!item || item.locked) continue;
    if (v === 1 || v === true) out[k] = 1;
    else if (v === 0 || v === false) out[k] = 0;
  }
  return out;
}

/** Does this role (plus per-person overrides) have the item? */
export function can(role: string | null | undefined, overrides: unknown, key: string): boolean {
  const item = BY_KEY.get(key);
  if (!item || !hasTerminal(role)) return false;
  if (role === "commander") return true;
  const lvl = roleLevel(role);
  if (item.locked) return lvl >= item.min;
  const o = cleanOverrides(overrides);
  if (key in o) return o[key] === 1;
  return lvl >= item.min;
}

/** Every item → true/false for one member. */
export function effectiveAccess(role: string | null | undefined, overrides: unknown): Record<string, boolean> {
  return Object.fromEntries(ACCESS.map((a) => [a.key, can(role, overrides, a.key)]));
}

/** Drop overrides that equal the role default, so "changed" means really changed. */
export function normaliseOverrides(role: string, raw: unknown): Overrides {
  const o = cleanOverrides(raw);
  const lvl = roleLevel(role);
  for (const [k, v] of Object.entries(o)) {
    const def = lvl >= BY_KEY.get(k)!.min ? 1 : 0;
    if (v === def) delete o[k];
  }
  return o;
}

/**
 * Rules for editing someone's access (Officer Management):
 * - you need "om", you cannot edit yourself, nobody edits a Commander;
 * - the target's role must be one you're allowed to assign;
 * - you can only GRANT items you have yourself.
 */
export function checkAccessEdit(
  actor: { uid: string; role: string; overrides: unknown },
  target: { uid: string; role: string; overrides: unknown },
  next: Overrides,
  assignable: string[],
): string | null {
  if (!can(actor.role, actor.overrides, "om")) return "You don't have Officer Management access";
  if (actor.uid === target.uid) return "You can't edit your own access";
  if (target.role === "commander") return "The Commander always has full access";
  if (!hasTerminal(target.role)) return "Only Recruiter and above have terminal access";
  if (!assignable.includes(target.role)) return "Target outranks your authority";
  const before = cleanOverrides(target.overrides);
  for (const a of ACCESS) {
    if (a.locked) continue;
    const was = can(target.role, before, a.key);
    const will = can(target.role, next, a.key);
    if (!was && will && !can(actor.role, actor.overrides, a.key)) return `You can't grant "${a.label}" — you don't have it yourself`;
  }
  return null;
}

/**
 * Which access item a WRITE to a terminal collection needs.
 * null = no extra check beyond terminal sign-in (other rules may still apply).
 */
export function writeNeeds(top: string, docId: string, fields: Set<string>, values: Record<string, unknown> = {}): string[] | null {
  switch (top) {
    case "aars": return ["aar"];
    case "media": return ["media"];
    // Locking (locked: true) or unlocking (unlockedBy) needs "Lock Attendance"; normal saves send locked: false.
    case "attendance_events": return values.locked === true || fields.has("unlockedBy") ? ["lock"] : ["att"];
    case "attendance_history": return ["att"];
    case "projects": return ["proj"];
    case "notes": return ["notes"];
    case "community_events": return ["ev", "att"];
    // Jobs for Cortana v2 (queued now, sent to Discord once Cortana v2 runs).
    case "bot_jobs": return ["ev", "send", "qu", "info", "modw", "modk", "tk", "net", "bot"];
    // Command pages (Commander / Developer by default).
    case "unit_config":
    case "fragos": return ["set"];
    case "comms_media": return ["web"];
    case "settings":
      if (docId === "unit_cards") return ["oob"];
      if (docId === "page_content") return ["web"];
      if (docId === "roster_meta") return ["roster"];
      if (["webhooks", "site", "discord", "audit", "cortana", "discord_role_map"].includes(docId)) return ["set"];
      return null;
    default: return null;
  }
}

/** Roles allowed to delete audit entries (on top of "audit" access). */
export const AUDIT_DELETE_ROLES = new Set(["commander", "officer", "developer"]);

/** Which access item a READ needs (only for private collections). */
export function readNeeds(top: string): string | null {
  switch (top) {
    case "audit_log":
    case "audit_logs": return "audit";
    case "projects": return "proj";
    case "notes": return "notes";
    default: return null;
  }
}
