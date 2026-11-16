import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";

/**
 * WEBSITE EDITOR for the Hub (approved mock 2026-11-16). SAME data + rules as the website Terminal (public/terminal-panels/website.js):
 *  settings/page_content  "<page>__<slot>" → { url } for photos, { value } for text / video. Edits are a draft in the app until PUBLISH.
 *  comms_media            the Comms photo library. media (type image, enabled) = Gallery.
 * Access: "web" (Officer Management). Publish re-reads the latest content and only writes the changed slots,
 * so it never overwrites someone else's published change. Every publish → Audit Log "WEBSITE PUBLISHED".
 */
type Actor = { uid: string; role: string; access: Record<string, unknown>; displayName: string };
export class WebError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

export const W_PAGES: Record<string, { name: string; url: string; prefix?: string; card?: string; cards?: string; home?: true }> = {
  home: { name: "Home Page", url: "/home", home: true },
  "about-505th": { name: "505th Expeditionary Force", url: "/about-505th", prefix: "marine", card: "Marine Card", cards: "MARINE CARDS" },
  "about-alpha": { name: "Alpha Company", url: "/about-alpha-company", prefix: "op", card: "Operation Card", cards: "OPERATION CARDS" },
  "about-stalker": { name: "JTF Force Recon", url: "/about-stalker", prefix: "equip", card: "Equipment Card", cards: "EQUIPMENT CARDS" },
  "about-corpsman": { name: "Hospital Corpsman", url: "/about-corpsman", prefix: "equip", card: "Equipment Card", cards: "EQUIPMENT CARDS" },
  "about-54th": { name: "54th Air Wing", url: "/about-54th-air-wing", prefix: "air", card: "Air Asset Card", cards: "AIR ASSET CARDS" },
};
export function wSlots(page: string): string[] {
  if (page === "home") return ["enlist_photo", "hero_video", "hero_video_description"];
  const p = W_PAGES[page]!.prefix!, o = ["slider_header", "cards_header"];
  for (const i of [1, 2, 3]) o.push(`slider_${i}`, `slider_${i}_title`, `slider_${i}_desc`);
  for (const i of [1, 2, 3]) o.push(`${p}_${i}`, `${p}_${i}_title`, `${p}_${i}_desc`);
  return o;
}
const ALL_KEYS = new Set(Object.keys(W_PAGES).flatMap((p) => wSlots(p).map((s) => `${p}__${s}`)));
const IMG = /^(enlist_photo|slider_\d|marine_\d|op_\d|equip_\d|air_\d)$/;
const isImg = (key: string) => IMG.test(key.split("__")[1] ?? "");
const HTTPS = /^https:\/\/[^\s"'<>]{4,600}$/;
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

function need(a: Actor) { if (!can(a.role, a.access, "web")) throw new WebError("You don't have Website access.", 403); }

export async function wGet(a: Actor) {
  need(a);
  const [pc, lib, gal] = await Promise.all([
    TerminalDoc.findById("settings/page_content", { data: 1 }).lean(),
    TerminalDoc.find({ parent: "comms_media" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "media", "data.type": "image", "data.enabled": { $ne: false } }, { docId: 1, "data.url": 1, "data.name": 1, "data.title": 1 }).lean(),
  ]);
  const content = ((pc?.data ?? {}) as Record<string, unknown>);
  const pick = (d: { docId?: string; data?: unknown }) => { const x = (d.data ?? {}) as Record<string, any>; return { id: String(d.docId), url: String(x.url ?? ""), name: String(x.name || x.title || "") , at: String(x.uploadedAt ?? "") }; };
  return {
    pages: Object.entries(W_PAGES).map(([k, p]) => ({ key: k, ...p, slots: wSlots(k) })),
    content,
    library: lib.map(pick).filter((m) => m.url).sort((x, y) => y.at.localeCompare(x.at)),
    gallery: gal.map(pick).filter((m) => m.url),
  };
}

export async function wPost(a: Actor, b: Record<string, unknown> | null) {
  need(a);
  if (!b) throw new WebError("Bad request.");
  if (b.action === "addLib") {
    const url = String(b.url ?? ""), name = String(b.name ?? "").replace(/\.[^.]+$/, "").slice(0, 120);
    if (!HTTPS.test(url) || !url.includes("res.cloudinary.com/")) throw new WebError("Bad photo address.");
    const id = id20(), now = new Date();
    await TerminalDoc.create({ _id: `comms_media/${id}`, parent: "comms_media", docId: id, createTime: now, updateTime: now, data: { url, name, uploadedAt: now.toISOString(), uploadedBy: a.displayName } });
    return { ok: true, id };
  }
  if (b.action !== "publish") throw new WebError("Bad request.");
  const ch = b.changes as Record<string, unknown> | undefined;
  if (!ch || typeof ch !== "object") throw new WebError("Nothing to publish.");
  const keys = Object.keys(ch);
  if (!keys.length || keys.length > 200 || !keys.every((k) => ALL_KEYS.has(k))) throw new WebError("Bad change list.");
  const clean: Record<string, Record<string, string>> = {};
  for (const k of keys) {
    const v = (ch[k] ?? {}) as Record<string, unknown>;
    if (isImg(k)) {
      const url = String(v.url ?? "");
      if (url && !HTTPS.test(url)) throw new WebError("A photo address is not valid.");
      clean[k] = url ? { url, ...(typeof v.mediaId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v.mediaId) ? { mediaId: v.mediaId } : {}) } : {};
    } else {
      const value = String(v.value ?? "").slice(0, 2000);
      if (k === "home__hero_video" && value && !HTTPS.test(value)) throw new WebError("The video link must start with https://");
      clean[k] = value ? { value } : {};
    }
  }
  const now = new Date();
  const set: Record<string, unknown> = { updateTime: now, "data.__lastPublishedBy": a.displayName, "data.__lastPublishedAt": now.toISOString() };
  for (const k of keys) set[`data.${k}`] = clean[k];
  await TerminalDoc.updateOne({ _id: "settings/page_content" }, { $set: set, $setOnInsert: { parent: "settings", docId: "page_content", createTime: now } }, { upsert: true });
  const pages = [...new Set(keys.map((k) => W_PAGES[k.split("__")[0]!]!.name))];
  const id = id20();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "public_comms", action: "WEBSITE PUBLISHED", details: `${keys.length} change${keys.length === 1 ? "" : "s"} — ${pages.join(", ")}`, uid: a.uid, by: a.displayName, role: a.role, source: "hub", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
  return { ok: true, published: keys.length };
}
