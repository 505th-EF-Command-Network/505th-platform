import "server-only";
import { TerminalDoc, connectDb } from "@505th/db";

/**
 * Public site content that the old pages loaded from Firebase in the browser (js/cms.js + media pages).
 * Now read on the server from the same records (Terminal → Website / Gallery / Videos / Settings write them).
 */
export type MediaItem = { url: string; name: string; description: string; category: string; uploadedAtISO: string | null };

const iso = (v: unknown) => {
  if (!v) return null;
  if (typeof v === "string") return Number.isNaN(Date.parse(v)) ? null : new Date(v).toISOString();
  const s = Number((v as { seconds?: number; _seconds?: number }).seconds ?? (v as { _seconds?: number })._seconds);
  return Number.isFinite(s) ? new Date(s * 1000).toISOString() : null;
};

/** Gallery (image) or Videos (video): enabled items, newest first. */
export async function getMedia(type: "image" | "video"): Promise<MediaItem[]> {
  await connectDb();
  const docs = await TerminalDoc.find({ parent: "media" }, { data: 1 }).lean();
  return docs
    .map((d) => (d.data ?? {}) as Record<string, unknown>)
    .filter((m) => m.type === type && m.enabled !== false && typeof m.url === "string" && /^https?:\/\//.test(m.url as string))
    .map((m) => ({ url: String(m.url), name: String(m.name ?? ""), description: String(m.description ?? ""), category: String(m.category ?? ""), uploadedAtISO: iso(m.uploadedAt) }))
    .sort((a, b) => String(b.uploadedAtISO ?? "").localeCompare(String(a.uploadedAtISO ?? "")));
}

/** Editable page slots (settings/page_content keys "<page>__<slot>") + the Discord invite (settings/site). */
export async function getSiteContent(page: string | null) {
  await connectDb();
  const [pc, site] = await Promise.all([
    page ? TerminalDoc.findById("settings/page_content", { data: 1 }).lean() : null,
    TerminalDoc.findById("settings/site", { data: 1 }).lean(),
  ]);
  const slots: Record<string, unknown> = {};
  if (page && pc?.data) for (const [k, v] of Object.entries(pc.data as Record<string, unknown>)) if (k.startsWith(page + "__")) slots[k.slice(page.length + 2)] = v;
  const invite = String((site?.data as Record<string, unknown> | undefined)?.discord_invite ?? "");
  return { slots, discordInvite: /^https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\//.test(invite) ? invite : null };
}
