import "server-only";
import { Aar, TerminalDoc, connectDb } from "@505th/db";

/**
 * After Action Reports for the public /resources-aar page (it was public on the old site too).
 * Live reports are in the Command Terminal store (aars/<id>, written by Terminal → AAR).
 * Falls back to the migrated Aar collection if the terminal store has none.
 * Only the fields the page shows are sent to the browser.
 */
export type PublicAar = Record<string, string | number | string[] | null> & { id: string; dateISO: string | null };

const FIELDS = [
  "title", "unit", "operationType", "result", "summary", "commander", "filedBy", "submittedByName", "location", "personnel", "casualties",
  "classification", "mainObjective", "commanderIntent", "objectiveStandards", "plannedExecution", "unitsInvolved", "enemyFaction", "enemyCasualties",
  "enemyTactics", "enemyDisposition", "keyMoments", "successfulManeuvers", "mistakes", "unexpected", "objectiveOutcome", "recommended", "lessonsLearned", "miscComments",
];

function toISO(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return Number.isNaN(Date.parse(v)) ? null : new Date(v).toISOString();
  const o = v as Record<string, unknown>;
  const s = Number(o.seconds ?? o._seconds);
  if (Number.isFinite(s)) return new Date(s * 1000).toISOString();
  if (o.$date) return toISO(o.$date);
  return null;
}
function pick(src: Record<string, unknown>, id: string): PublicAar {
  const out: PublicAar = { id, dateISO: toISO(src.date ?? src.createdAt) };
  for (const k of FIELDS) {
    const v = src[k];
    if (typeof v === "string" || typeof v === "number") out[k] = v;
  }
  out.attachments = Array.isArray(src.attachments) ? (src.attachments as unknown[]).filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 10) : [];
  return out;
}

export async function getPublicAars(): Promise<PublicAar[]> {
  await connectDb();
  // Drafts (status "draft", saved while writing in the Terminal) are never public.
  const live = await TerminalDoc.find({ parent: "aars", "data.status": { $ne: "draft" } }, { docId: 1, data: 1 }).lean();
  let list = live.map((d) => pick((d.data ?? {}) as Record<string, unknown>, String(d.docId)));
  if (!list.length) {
    const old = await Aar.find().lean();
    list = old.map((a) => pick(a as unknown as Record<string, unknown>, String(a._id)));
  }
  return list.sort((a, b) => String(b.dateISO ?? "").localeCompare(String(a.dateISO ?? "")));
}
