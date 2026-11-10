/**
 * Notes sharing rules (pure — unit tested). Enforced by /api/terminal/notes.
 *
 * A note: { title, body, createdBy (owner uid), share }
 * share = { mode: "private" | "shared", people: { uid: "view" | "edit" }, groups: { groupKey: "view" | "edit" } }
 *
 * - Private: only the owner. Nobody else — not even Command.
 * - Shared: the owner + listed people + members of listed groups (groups follow roles).
 * - Notes from before sharing existed (no `share`) count as "All Staff — can edit",
 *   so nothing disappears for anyone. The owner can change it.
 */
export type Perm = "view" | "edit";
export type Share = { mode: "private" | "shared"; people: Record<string, Perm>; groups: Record<string, Perm> };
export type NoteDoc = { createdBy?: string; share?: unknown; [k: string]: unknown };
export type Access = "owner" | Perm | null;

export const GROUPS: Record<string, { label: string; roles: string[] }> = {
  all_staff: { label: "ALL STAFF", roles: ["recruiter", "nco", "staff_nco", "officer", "developer", "commander"] },
  officers: { label: "OFFICERS", roles: ["officer"] },
  developers: { label: "DEVELOPERS", roles: ["developer"] },
  command: { label: "COMMAND", roles: ["commander"] },
  senior_ncos: { label: "SENIOR NCOs", roles: ["staff_nco"] },
};

export const LEGACY_SHARE: Share = { mode: "shared", people: {}, groups: { all_staff: "edit" } };
const UID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PEOPLE = 100;

const perm = (v: unknown): Perm | null => (v === "view" || v === "edit" ? v : null);

/** Make a share object safe (unknown groups / bad uids / bad values dropped). */
export function cleanShare(raw: unknown, ownerUid: string): Share {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const mode = r.mode === "private" ? "private" : "shared";
  const people: Record<string, Perm> = {};
  const groups: Record<string, Perm> = {};
  if (mode === "shared") {
    for (const [uid, p] of Object.entries(r.people && typeof r.people === "object" ? r.people : {})) {
      const v = perm(p);
      if (v && UID.test(uid) && uid !== ownerUid && Object.keys(people).length < MAX_PEOPLE) people[uid] = v;
    }
    for (const [g, p] of Object.entries(r.groups && typeof r.groups === "object" ? r.groups : {})) {
      const v = perm(p);
      if (v && GROUPS[g]) groups[g] = v;
    }
  }
  return { mode, people, groups };
}

export const shareOf = (n: NoteDoc): Share => (n.share ? cleanShare(n.share, String(n.createdBy || "")) : LEGACY_SHARE);

/** What this person can do with the note. */
export function noteAccess(n: NoteDoc, uid: string, role: string): Access {
  if (n.createdBy && n.createdBy === uid) return "owner";
  const s = shareOf(n);
  if (s.mode === "private") return null;
  let best: Access = s.people[uid] ?? null;
  for (const [g, p] of Object.entries(s.groups)) {
    if (GROUPS[g]?.roles.includes(role)) best = best === "edit" || p === "edit" ? "edit" : "view";
  }
  return best;
}

/** Everyone who can open the note (excluding the owner), with their permission. */
export function audience(s: Share, users: { uid: string; role: string }[], ownerUid: string): Map<string, Perm> {
  const out = new Map<string, Perm>();
  if (s.mode === "private") return out;
  for (const u of users) {
    if (u.uid === ownerUid) continue;
    let p: Perm | null = s.people[u.uid] ?? null;
    for (const [g, gp] of Object.entries(s.groups)) if (GROUPS[g]?.roles.includes(u.role)) p = p === "edit" || gp === "edit" ? "edit" : "view";
    if (p) out.set(u.uid, p);
  }
  return out;
}

/** Who to alert after a sharing change: newly added, or raised from view to edit. */
export function toAlert(before: Map<string, Perm>, after: Map<string, Perm>): [string, Perm][] {
  return [...after].filter(([uid, p]) => !before.has(uid) || (before.get(uid) === "view" && p === "edit"));
}
