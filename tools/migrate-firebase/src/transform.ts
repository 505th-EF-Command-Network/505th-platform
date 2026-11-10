/**
 * Pure transform functions: Firebase backup record → MongoDB document.
 * No I/O here, so it can be unit-tested with fake data.
 */
import { toDate, type FsDoc } from "@505th/db";

// Shared with the website (original Command Terminal member sync).
export { toDate, leaverMatcher, transformMember, type FsDoc, type LeaverMatcher, type MemberResult } from "@505th/db";

const EVENT_TYPES = new Set(["main_op", "patrol", "training", "fun_op"]);

export function transformEvent(d: FsDoc, uidToId: Map<string, unknown>) {
  const e = d.data;
  const map = (list: unknown) => {
    const ids: unknown[] = [];
    const missing: string[] = [];
    for (const uid of Array.isArray(list) ? list : []) {
      const key = typeof uid === "string" ? uid : (uid as any)?.uid;
      const id = key ? uidToId.get(key) : undefined;
      if (id) ids.push(id);
      else if (key) missing.push(key);
    }
    return { ids, missing };
  };
  const att = map(e.attendees);
  const exc = map(e.excused);
  return {
    legacyId: d.id,
    title: e.title,
    type: EVENT_TYPES.has(e.type) ? e.type : "other",
    date: e.date,
    attendees: att.ids,
    excused: exc.ids,
    unmatchedLegacyIds: [...att.missing, ...exc.missing],
    locked: !!e.locked,
    unlockedAt: toDate(e.unlockedAt),
    unlockedBy: e.unlockedBy,
    createdBy: e.createdBy,
    updatedBy: e.updatedBy,
    createdAt: toDate(e.createdAt) ?? toDate(d.createTime),
    updatedAt: toDate(e.updatedAt) ?? toDate(d.updateTime),
  };
}

export function transformSnapshot(d: FsDoc, uidToId: Map<string, unknown>) {
  const s = d.data;
  return {
    month: s.month ?? d.id,
    snapshotAt: toDate(s.snapshotAt),
    totalOps: s.totalOps,
    memberCount: s.memberCount,
    members: (s.members ?? []).map((m: any) => ({ ...m, legacyUid: m.uid, member: uidToId.get(m.uid), uid: undefined })),
  };
}

const AAR_FIELDS = new Set([
  "title", "date", "operationType", "classification", "location", "unit", "unitsInvolved", "commander", "author",
  "filedBy", "submittedBy", "submittedByName", "submittedAt", "personnel", "casualties", "result", "attachments",
]);

export function transformAar(d: FsDoc, uidToId: Map<string, unknown>) {
  const a = d.data;
  const sections: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) if (!AAR_FIELDS.has(k) && v != null) sections[k] = typeof v === "string" ? v : JSON.stringify(v);
  return {
    legacyId: d.id,
    title: a.title || "Untitled AAR",
    date: toDate(a.date),
    operationType: a.operationType,
    classification: a.classification,
    location: a.location,
    unit: a.unit,
    unitsInvolved: a.unitsInvolved,
    commander: a.commander,
    author: a.author,
    filedBy: a.filedBy,
    submittedBy: uidToId.get(a.submittedBy),
    submittedByName: a.submittedByName,
    submittedAt: toDate(a.submittedAt),
    personnel: a.personnel,
    casualties: a.casualties,
    result: a.result,
    sections,
    attachments: a.attachments ?? [],
    createdAt: toDate(d.createTime),
    updatedAt: toDate(d.updateTime),
  };
}

export function transformAudit(d: FsDoc, uidToId: Map<string, unknown>, collection: string) {
  const a = d.data;
  return {
    legacyId: `${collection}/${d.id}`,
    at: toDate(a.createdAt) ?? toDate(a.createdAtISO) ?? toDate(a.timestamp) ?? toDate(d.createTime),
    actor: uidToId.get(a.uid),
    actorName: a.by,
    actorRole: a.role,
    section: a.section ?? collection,
    action: a.action ?? "",
    details: typeof a.details === "string" ? a.details : a.details != null ? JSON.stringify(a.details) : "",
    source: "legacy" as const,
  };
}

/**
 * Settings docs. SECRETS ARE DROPPED: `site.botHttpToken` and every webhook URL
 * must live in environment variables, never in the database.
 */
export const SECRET_SETTINGS: Record<string, "all" | string[]> = {
  webhooks: "all",
  site: ["botHttpToken", "botHttpUrl"],
};

export function transformSetting(d: FsDoc): { key: string; data: Record<string, any>; dropped: string[] } | null {
  const rule = SECRET_SETTINGS[d.id];
  if (rule === "all") return { key: d.id, data: {}, dropped: Object.keys(d.data) };
  const data = { ...d.data };
  const dropped: string[] = [];
  for (const k of rule ?? []) {
    if (k in data) {
      delete data[k];
      dropped.push(k);
    }
  }
  return { key: d.id, data, dropped };
}
