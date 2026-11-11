import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
/** Same `media` records and categories as the Terminal (media.js), so the public Gallery / Videos pages keep working. */
const CATS = new Set(["operations", "training", "events", "screenshots"]);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const ytId = (url: string) => /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url)?.[1] ?? null;

/** GET /api/hub/media → every image + video (visible and hidden). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "media")) return hubJson({ error: "You don't have Media access." }, 403);
  const docs = await TerminalDoc.find({ parent: "media" }, { docId: 1, data: 1 }).lean();
  const items = docs.map((d) => { const m = (d.data ?? {}) as U; return { id: d.docId, type: m.type === "video" ? "video" : "image", url: String(m.url || ""), name: String(m.name || "Untitled"),
    description: String(m.description || ""), category: String(m.category || "operations"), uploadedAt: String(m.uploadedAt || ""), enabled: m.enabled !== false }; })
    .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
  return hubJson({ items });
}

/**
 * POST /api/hub/media — add-images (Cloudinary URLs from the signed upload) · add-video (YouTube link, title looked up)
 * · edit (name, description, category, visible) · bulk (show / hide / category / delete, many at once). Audit Log like the Terminal.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "media")) return hubJson({ error: "You don't have Media access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const now = new Date();
  const cat = (v: unknown) => (CATS.has(String(v)) ? String(v) : "operations");
  const add = async (data: U) => { const id = autoId(); await TerminalDoc.create({ _id: `media/${id}`, parent: "media", docId: id, createTime: now, updateTime: now, data }); };

  if (b.action === "add-images") {
    const files = (Array.isArray(b.files) ? b.files : []).slice(0, 30).filter((f: U) => /^https:\/\/res\.cloudinary\.com\//.test(String(f?.url)));
    if (!files.length) return hubJson({ error: "No uploaded images." }, 400);
    for (const f of files) await add({ type: "image", url: String(f.url), name: String(f.name || "Untitled").trim().slice(0, 120) || "Untitled", description: "", category: cat(b.category), uploadedAt: now.toISOString(), enabled: b.enabled !== false });
    await hubAudit(who, "IMAGES UPLOADED", `${files.length} image(s) — ${cat(b.category)} — via app`);
    return hubJson({ ok: true, msg: `${files.length} image${files.length === 1 ? "" : "s"} added` });
  }
  if (b.action === "add-video") {
    const id = ytId(String(b.url ?? ""));
    if (!id) return hubJson({ error: "Paste a YouTube link." }, 400);
    let name = String(b.name ?? "").trim().slice(0, 120);
    if (!name) {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
      name = r?.ok ? String(((await r.json().catch(() => ({}))) as U).title || "").slice(0, 120) : "";
    }
    await add({ type: "video", url: `https://www.youtube.com/watch?v=${id}`, name: name || "Untitled video", description: String(b.description ?? "").slice(0, 500), category: cat(b.category), uploadedAt: now.toISOString(), enabled: b.enabled !== false });
    await hubAudit(who, "VIDEO ADDED", `${name || id} — via app`);
    return hubJson({ ok: true, msg: `Video added — ${name || id}` });
  }
  if (b.action === "edit") {
    const id = String(b.id ?? "");
    if (!ID.test(id)) return hubJson({ error: "Invalid item." }, 400);
    const d = await TerminalDoc.findById(`media/${id}`, { data: 1 }).lean();
    if (!d) return hubJson({ error: "Not found." }, 404);
    const m = (d.data ?? {}) as U;
    const patch: U = { name: String(b.name ?? m.name).trim().slice(0, 120) || "Untitled", description: String(b.description ?? m.description ?? "").slice(0, 500), category: cat(b.category ?? m.category), enabled: b.enabled ?? m.enabled !== false };
    await TerminalDoc.updateOne({ _id: `media/${id}` }, { $set: { ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`data.${k}`, v])), updateTime: now } });
    await hubAudit(who, `${m.type === "video" ? "VIDEO" : "IMAGE"} EDITED`, `${patch.name} — via app`);
    return hubJson({ ok: true, msg: "Saved" });
  }
  if (b.action === "bulk") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x: string) => ID.test(x)).slice(0, 200);
    if (!ids.length) return hubJson({ error: "Nothing selected." }, 400);
    const q = { parent: "media", docId: { $in: ids } };
    if (b.op === "delete") {
      const names = (await TerminalDoc.find(q, { data: 1 }).lean()).map((d) => String(((d.data ?? {}) as U).name || ""));
      await TerminalDoc.deleteMany(q);
      await hubAudit(who, "MEDIA DELETED", `${names.slice(0, 10).join(", ")}${names.length > 10 ? ` (+${names.length - 10})` : ""} — via app`);
      return hubJson({ ok: true, msg: `${names.length} deleted` });
    }
    if (b.op === "show" || b.op === "hide") {
      await TerminalDoc.updateMany(q, { $set: { "data.enabled": b.op === "show", updateTime: now } });
      await hubAudit(who, b.op === "show" ? "MEDIA SHOWN" : "MEDIA HIDDEN", `${ids.length} item(s) — via app`);
      return hubJson({ ok: true, msg: `${ids.length} ${b.op === "show" ? "shown" : "hidden"}` });
    }
    if (b.op === "category") {
      await TerminalDoc.updateMany(q, { $set: { "data.category": cat(b.category), updateTime: now } });
      await hubAudit(who, "MEDIA CATEGORY", `${ids.length} item(s) → ${cat(b.category)} — via app`);
      return hubJson({ ok: true, msg: `${ids.length} moved to ${cat(b.category)}` });
    }
  }
  return hubJson({ error: "Unknown action." }, 400);
}
