import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { memberName, photoOf } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
/**
 * MESSAGES in the app (H3b, approved mock 2026-11-11) — the SAME chats as the website Terminal (messages-v2.js):
 *   conversations/{id}  { participants, name, lastMessage, lastMessageAt, lastSenderUid, unreadCounts, typing, createdBy, createdAt }
 *   conversations/{id}/messages/{mid}  { senderUid, text, imageUrl?, timestamp, readBy[] }
 * App extras (the website ignores them): message reactions { "👍": [uid] }, conversation pinnedBy[] / mutedBy[].
 * Only participants can read or write a chat. New messages leave a 🔔 "message" alert for the others (not if they muted the chat).
 *   GET  ?conv=<id>  → { me, convs, people, messages? }
 *   POST { action: send | read | typing | create | leave | react | pin | mute, … }
 */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🫡"];
const IMG = /^https:\/\/res\.cloudinary\.com\/\S+$/;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const iso = (v: unknown) => { if (!v) return ""; const d = v instanceof Date ? v : typeof v === "object" && v && "seconds" in (v as U) ? new Date((v as U).seconds * 1000) : new Date(String(v)); return isNaN(+d) ? "" : d.toISOString(); };
const ONLINE_MS = 3 * 60_000;

async function conv(id: string, uid: string) {
  if (!ID.test(id)) return null;
  const d = await TerminalDoc.findById(`conversations/${id}`, { data: 1 }).lean();
  const c = d?.data as U | undefined;
  return c && Array.isArray(c.participants) && c.participants.includes(uid) ? c : null;
}
const patchConv = (id: string, set: U, extra: U = {}) => TerminalDoc.updateOne({ _id: `conversations/${id}` }, { $set: { ...Object.fromEntries(Object.entries(set).map(([k, v]) => [`data.${k}`, v])), updateTime: new Date() }, ...extra });

export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const want = new URL(req.url).searchParams.get("conv") ?? "";
  const F = ["firstName", "lastName", "callsign", "rank", "role", "status", "platoon", "photoUrl", "photoURL", "discordAvatarUrl"];
  const [cs, us, pres] = await Promise.all([
    TerminalDoc.find({ parent: "conversations", "data.participants": a.uid }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "users" }, { docId: 1, ...Object.fromEntries(F.map((f) => [`data.${f}`, 1])) }).lean(),
    TerminalDoc.find({ parent: "presence_sessions" }, { data: 1 }).lean(),
  ]);
  const now = Date.now();
  const online = new Set(pres.map((p) => (p.data ?? {}) as U).filter((d) => now - Date.parse(d.updatedAt || 0) < ONLINE_MS).map((d) => String(d.uid)));
  const convs = cs.map((d) => { const c = (d.data ?? {}) as U; return {
    id: String(d.docId), participants: (c.participants as string[]) ?? [], name: c.name ?? null, lastMessage: c.lastMessage ?? "", lastMessageAt: iso(c.lastMessageAt), lastSenderUid: c.lastSenderUid ?? "",
    unread: Number(c.unreadCounts?.[a.uid] ?? 0), pinned: Array.isArray(c.pinnedBy) && c.pinnedBy.includes(a.uid), muted: Array.isArray(c.mutedBy) && c.mutedBy.includes(a.uid),
    typing: Object.entries((c.typing ?? {}) as Record<string, string | null>).filter(([u, t]) => u !== a.uid && t && now - Date.parse(t) < 8000).map(([u]) => u) }; })
    .sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.lastMessageAt.localeCompare(x.lastMessageAt));
  const people = us.map((d) => ({ id: String(d.docId), ...(((d as U).data ?? {}) as U) }) as U).filter((u) => u.status !== "denied")
    .map((u) => ({ uid: u.id, name: memberName(u), role: u.role || "", platoon: u.platoon || "", photo: photoOf(u), online: online.has(u.id) || u.id === a.uid }));
  let messages: U[] | undefined;
  if (want && convs.some((c) => c.id === want)) {
    const ms = await TerminalDoc.find({ parent: `conversations/${want}/messages` }, { docId: 1, data: 1 }).sort({ "data.timestamp": -1 }).limit(200).lean();
    messages = ms.reverse().map((d) => { const m = (d.data ?? {}) as U; return { id: String(d.docId), senderUid: m.senderUid ?? "", text: m.text ?? "", imageUrl: m.imageUrl ?? "",
      at: iso(m.timestamp), readBy: Array.isArray(m.readBy) ? m.readBy : [], reactions: m.reactions && typeof m.reactions === "object" ? m.reactions : {} }; });
  }
  return hubJson({ me: a.uid, convs, people, messages });
}

export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const id = String(b.convId ?? "");
  const now = new Date();

  if (b.action === "create") {
    const ids = [...new Set((Array.isArray(b.uids) ? b.uids : []).map(String))].filter((u) => ID.test(u) && u !== a.uid).slice(0, 25);
    if (!ids.length) return hubJson({ error: "Pick someone to message." }, 400);
    const real = await TerminalDoc.countDocuments({ _id: { $in: ids.map((u) => `users/${u}`) } });
    if (real !== ids.length) return hubJson({ error: "Someone in that list doesn't exist." }, 400);
    if (ids.length === 1) {
      const ex = await TerminalDoc.findOne({ parent: "conversations", "data.participants": { $all: [a.uid, ids[0]], $size: 2 } }, { docId: 1 }).lean();
      if (ex) return hubJson({ ok: true, id: String(ex.docId) });
    }
    const participants = [a.uid, ...ids], cid = autoId();
    await TerminalDoc.create({ _id: `conversations/${cid}`, parent: "conversations", docId: cid, createTime: now, updateTime: now,
      data: { participants, name: ids.length === 1 ? null : String(b.name ?? "").trim().slice(0, 60) || "Group Chat", lastMessage: null, lastMessageAt: now, unreadCounts: Object.fromEntries(participants.map((p) => [p, 0])), createdBy: a.uid, createdAt: now } });
    return hubJson({ ok: true, id: cid });
  }

  const c = await conv(id, a.uid);
  if (!c) return hubJson({ error: "Chat not found." }, 404);
  const others = (c.participants as string[]).filter((p) => p !== a.uid);

  switch (b.action) {
    case "send": {
      const text = String(b.text ?? "").slice(0, 4000).trim();
      const imageUrl = IMG.test(String(b.imageUrl ?? "")) ? String(b.imageUrl) : "";
      if (!text && !imageUrl) return hubJson({ error: "Type a message." }, 400);
      const mid = autoId();
      await TerminalDoc.create({ _id: `conversations/${id}/messages/${mid}`, parent: `conversations/${id}/messages`, docId: mid, createTime: now, updateTime: now,
        data: { senderUid: a.uid, text, ...(imageUrl ? { imageUrl } : {}), timestamp: now, readBy: [a.uid] } });
      await patchConv(id, { lastMessage: text || "📷 Image", lastMessageAt: now, lastSenderUid: a.uid, [`typing.${a.uid}`]: null }, { $inc: Object.fromEntries(others.map((p) => [`data.unreadCounts.${p}`, 1])) });
      const muted = new Set(Array.isArray(c.mutedBy) ? c.mutedBy : []);
      const preview = (text || "📷 Image").slice(0, 60) + (text.length > 60 ? "…" : "");
      for (const p of others) {
        if (muted.has(p)) continue;
        const nid = autoId();
        await TerminalDoc.create({ _id: `notifications/${p}/items/${nid}`, parent: `notifications/${p}/items`, docId: nid, createTime: now, updateTime: now,
          data: { type: "message", read: false, title: `${a.displayName} sent you a message`, body: preview, fromUid: a.uid, convId: id, createdAt: now } }).catch(() => {});
      }
      return hubJson({ ok: true, id: mid });
    }
    case "read": {
      await patchConv(id, { [`unreadCounts.${a.uid}`]: 0 });
      await TerminalDoc.updateMany({ parent: `conversations/${id}/messages`, "data.readBy": { $ne: a.uid } }, { $addToSet: { "data.readBy": a.uid } });
      // Their 🔔 "sent you a message" alerts for this chat are done too.
      await TerminalDoc.updateMany({ parent: `notifications/${a.uid}/items`, "data.convId": id, "data.read": false }, { $set: { "data.read": true, updateTime: now } });
      return hubJson({ ok: true });
    }
    case "typing": await patchConv(id, { [`typing.${a.uid}`]: now.toISOString() }); return hubJson({ ok: true });
    case "react": {
      const mid = String(b.messageId ?? ""), e = String(b.emoji ?? "");
      if (!ID.test(mid) || !EMOJI.includes(e)) return hubJson({ error: "Bad request." }, 400);
      const m = await TerminalDoc.findById(`conversations/${id}/messages/${mid}`, { "data.reactions": 1 }).lean();
      if (!m) return hubJson({ error: "Message not found." }, 404);
      const has = ((((m as U).data?.reactions ?? {}) as U)[e] ?? []).includes(a.uid);
      await TerminalDoc.updateOne({ _id: `conversations/${id}/messages/${mid}` }, { [has ? "$pull" : "$addToSet"]: { [`data.reactions.${e}`]: a.uid }, $set: { updateTime: now } });
      return hubJson({ ok: true });
    }
    case "pin": case "mute": {
      const f = b.action === "pin" ? "data.pinnedBy" : "data.mutedBy";
      await TerminalDoc.updateOne({ _id: `conversations/${id}` }, { [b.on === true ? "$addToSet" : "$pull"]: { [f]: a.uid }, $set: { updateTime: now } });
      return hubJson({ ok: true });
    }
    case "leave": {
      if (others.length) await patchConv(id, { participants: others });
      else { await TerminalDoc.deleteMany({ parent: `conversations/${id}/messages` }); await TerminalDoc.deleteOne({ _id: `conversations/${id}` }); }
      return hubJson({ ok: true, msg: "Chat removed from your list" });
    }
    default: return hubJson({ error: "Unknown action." }, 400);
  }
}
