import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { getViewer } from "@/lib/auth/session";
import { myUserDoc } from "@/lib/profile";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } });

/**
 * 📱 PHONE ALERTS + 🔊 ALERT SOUNDS (approved mock 2026-11-13). Your own settings only.
 *   GET  → { publicKey, phones, prefs, sounds }
 *   POST { action: "subscribe", sub, name } · { action: "remove", id } · { action: "enable", id, on } · { action: "prefs", prefs } · { action: "sounds", sounds } · { action: "test" }
 * Phones live in push_subs/<id>; Cortana (push.ts) does the sending. VAPID_PUBLIC_KEY is public; the private key is only on the bot server.
 */
const KINDS = ["message", "tag", "op", "event", "ticket", "bct", "project", "rank", "note", "net", "staff"] as const;
const DEF_EV: Record<string, boolean> = { message: true, tag: true, op: true, event: false, ticket: true, bct: false, project: false, rank: true, note: true, net: true, staff: true };
const hhmm = (v: unknown, d: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
function cleanPrefs(b: U = {}) {
  const ev = (b.ev ?? {}) as U;
  return { ev: Object.fromEntries(KINDS.map((k) => [k, bool(ev[k], DEF_EV[k]!)])), quiet: ["off", "night", "custom"].includes(b.quiet) ? b.quiet : "night",
    from: hhmm(b.from, "23:00"), to: hhmm(b.to, "08:00"), letOps: bool(b.letOps, true), preview: bool(b.preview, true), badge: bool(b.badge, true), skipHub: bool(b.skipHub, true) };
}
const SOUND_IDS = ["radio", "unsc", "chime", "ping", "klaxon", "none"];
const cloud = (v: unknown) => typeof v === "string" && /^https:\/\/res\.cloudinary\.com\/[\w./%-]+$/.test(v);
function cleanSounds(b: U = {}) {
  const mine = (Array.isArray(b.mine) ? b.mine : []).filter((m: U) => m && cloud(m.url)).slice(0, 8)
    .map((m: U) => ({ id: String(m.id ?? "").replace(/[^\w-]/g, "").slice(0, 24) || "my", name: String(m.name ?? "My sound").slice(0, 30), url: m.url }));
  const ok = new Set([...SOUND_IDS, ...mine.map((m: U) => m.id)]);
  const map = (b.map ?? {}) as U;
  return { on: bool(b.on, false), vol: Math.min(100, Math.max(0, Math.round(Number(b.vol ?? 70)) || 0)), mine,
    map: Object.fromEntries(KINDS.map((k) => [k, ok.has(map[k]) ? map[k] : k === "message" ? "radio" : k === "op" ? "klaxon" : k === "ticket" || k === "staff" ? "ping" : "chime"])) };
}

async function who() {
  const v = await getViewer();
  if (!v) return null;
  return myUserDoc(v);
}
const phonesOf = async (uid: string) => ((await TerminalDoc.find({ parent: "push_subs", "data.uid": uid }, { docId: 1, data: 1 }).lean()) as U[])
  .map((d) => ({ id: String(d.docId), name: String(d.data?.name ?? "Phone"), enabled: d.data?.enabled !== false, createdISO: d.data?.createdISO ?? "", lastISO: d.data?.lastISO ?? "", endpointHash: String(d.docId) }));

export async function GET() {
  const me = await who();
  if (!me) return json({ error: "unauthenticated" }, 401);
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "", phones: await phonesOf(me.uid), prefs: cleanPrefs(me.data.phonePrefs), sounds: cleanSounds(me.data.soundPrefs) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const me = await who();
  if (!me) return json({ error: "unauthenticated" }, 401);
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const now = new Date();
  switch (b.action) {
    case "subscribe": {
      const s = b.sub as U;
      if (!s || typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return json({ error: "Bad subscription" }, 400);
      const id = createHash("sha256").update(s.endpoint).digest("hex").slice(0, 32);
      if ((await TerminalDoc.countDocuments({ parent: "push_subs", "data.uid": me.uid })) >= 5 && !(await TerminalDoc.exists({ _id: `push_subs/${id}` }))) return json({ error: "5 phones max — remove one first." }, 400);
      await TerminalDoc.updateOne({ _id: `push_subs/${id}` }, { $set: { parent: "push_subs", docId: id, updateTime: now, data: { uid: me.uid, endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 200), auth: s.keys.auth.slice(0, 100) },
        name: String(b.name ?? "Phone").slice(0, 40), enabled: true, createdISO: now.toISOString(), lastISO: "" } }, $setOnInsert: { createTime: now } }, { upsert: true });
      return json({ ok: true, id, msg: "Phone alerts on for this phone" });
    }
    case "remove": case "enable": {
      const id = String(b.id ?? "");
      if (!/^[a-f0-9]{32}$/.test(id)) return json({ error: "Bad request" }, 400);
      const q = { _id: `push_subs/${id}`, "data.uid": me.uid };
      if (b.action === "remove") await TerminalDoc.deleteOne(q); else await TerminalDoc.updateOne(q, { $set: { "data.enabled": b.on === true, updateTime: now } });
      return json({ ok: true });
    }
    case "prefs":
      await TerminalDoc.updateOne({ _id: `users/${me.uid}` }, { $set: { "data.phonePrefs": cleanPrefs(b.prefs), updateTime: now } });
      return json({ ok: true });
    case "sounds":
      await TerminalDoc.updateOne({ _id: `users/${me.uid}` }, { $set: { "data.soundPrefs": cleanSounds(b.sounds), updateTime: now } });
      return json({ ok: true });
    case "test": {
      // A normal 🔔 alert with type "test" — Cortana sends it to your phones even in quiet time.
      const id = Array.from(randomBytes(20), (x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[x % 62]).join("");
      await TerminalDoc.create({ _id: `notifications/${me.uid}/items/${id}`, parent: `notifications/${me.uid}/items`, docId: id, createTime: now, updateTime: now,
        data: { type: "test", read: false, title: "505th · Test", body: "Phone alerts are working ✓", createdAt: now } });
      return json({ ok: true, msg: "Test sent — it should arrive in a few seconds" });
    }
  }
  return json({ error: "Unknown action" }, 400);
}
