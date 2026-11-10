import "server-only";
import { Member, TerminalDoc, connectDb } from "@505th/db";
import type { Viewer } from "@/lib/auth/session";

/**
 * Profile picture (hex) + alert settings. Stored on the member's terminal file
 * (terminal_fs users/{uid}) so Personnel Files, Roster, Messages etc. all read
 * the same thing:
 *   photo:            { source: "discord" | "upload", url, zoom, x, y, updatedAt }
 *   photoUrl:         the picture to show (upload, else Discord picture)
 *   discordAvatarUrl: their current Discord picture (refreshed on every visit)
 *   notifyPrefs:      { messages, promotions, events, staff, command: { bell, dm } }
 */
export type Photo = { source: "discord" | "upload"; url: string | null; zoom: number; x: number; y: number; updatedAt?: string };
export const NOTIFY_KEYS = ["messages", "notes", "promotions", "events", "staff", "command"] as const;
export type NotifyPrefs = Record<(typeof NOTIFY_KEYS)[number], { bell: boolean; dm: boolean }> & { quiet: string | null };
export const DEFAULT_PREFS: NotifyPrefs = {
  messages: { bell: true, dm: false }, notes: { bell: true, dm: false }, promotions: { bell: true, dm: true }, events: { bell: true, dm: true },
  staff: { bell: true, dm: false }, command: { bell: true, dm: true }, quiet: null,
};

const clamp = (n: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : d);

/** Only pictures uploaded to OUR Cloudinary account, in the profile-picture folder. */
export function isOwnUpload(url: unknown): url is string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (typeof url !== "string" || !cloud) return false;
  return new RegExp(`^https://res\\.cloudinary\\.com/${cloud.replace(/[^\w-]/g, "")}/image/upload/(v\\d+/)?505th_pfp/[\\w\\-./]+$`).test(url);
}

export function cleanPhoto(raw: any, current: Photo | undefined): Photo {
  const source = raw?.source === "upload" ? "upload" : "discord";
  const url = source === "upload" ? (isOwnUpload(raw?.url) ? raw.url : current?.source === "upload" ? current.url : null) : null;
  return { source: url ? source : "discord", url, zoom: clamp(raw?.zoom, 100, 250, 100), x: clamp(raw?.x, 0, 100, 50), y: clamp(raw?.y, 0, 100, 50), updatedAt: new Date().toISOString() };
}

export function cleanPrefs(raw: any): NotifyPrefs {
  const out: any = { quiet: typeof raw?.quiet === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(raw.quiet) ? raw.quiet : null };
  for (const k of NOTIFY_KEYS) out[k] = { bell: raw?.[k]?.bell !== false, dm: k === "notes" ? false : !!raw?.[k]?.dm }; // notes: bell only (the Hub shows desktop alerts)
  return out;
}

/** The viewer's terminal file (users/{uid}), or null if they have no member record. */
export async function myUserDoc(v: Viewer) {
  if (!v.member) return null;
  await connectDb();
  const m = await Member.findById(v.member.id, { legacyId: 1 }).lean();
  const uid = m?.legacyId || String(m?._id);
  const d = await TerminalDoc.findById(`users/${uid}`).lean();
  return d ? { uid, data: (d.data ?? {}) as Record<string, any> } : null;
}

/** Keep the Discord picture up to date, and photoUrl in step with the chosen source. */
export async function syncPhoto(uid: string, data: Record<string, any>, discordAvatar: string | null): Promise<Record<string, any>> {
  const photo: Photo | undefined = data.photo;
  const want = photo?.source === "upload" && photo.url ? photo.url : discordAvatar;
  const set: Record<string, unknown> = {};
  if (discordAvatar && data.discordAvatarUrl !== discordAvatar) set["data.discordAvatarUrl"] = discordAvatar;
  if (want && data.photoUrl !== want) set["data.photoUrl"] = want;
  if (Object.keys(set).length) await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { ...set, updateTime: new Date() } });
  return { ...data, discordAvatarUrl: discordAvatar ?? data.discordAvatarUrl, photoUrl: want ?? data.photoUrl };
}
