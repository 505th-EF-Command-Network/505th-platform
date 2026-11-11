import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type U = Record<string, any>;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SNOW = /^\d{17,20}$/;
const HTTPS = /^https:\/\/\S+$/;
const COLORS = new Set([0x194a77, 0x00d9ff, 0x22e07a, 0xf59e0b, 0xff4d4d]);
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

async function job(type: string, payload: U, requestedBy: string, extra: U = {}, waitMs = 20000) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type, payload, status: "pending", attempts: 0, requestedBy, createdAtISO: now.toISOString(), ...extra } });
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1200));
    const d = (await TerminalDoc.findById(`bot_jobs/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (d && (d.status === "done" || d.status === "failed")) return d;
  }
  return null;
}

/** GET /api/hub/send → channels, roles, server emoji, members to @, gallery images, recently sent. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "send")) return hubJson({ error: "You don't have Send Message access." }, 403);
  const [ch, ro, em, us, me, sent] = await Promise.all([
    TerminalDoc.find({ parent: "discord_channels" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "discord_roles" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "discord_emojis" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "users", "data.discordId": { $exists: true, $ne: "" } }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "media" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "discord_messages" }, { docId: 1, data: 1 }).sort({ createTime: -1 }).limit(30).lean(),
  ]);
  const D = (d: { docId?: unknown; data?: unknown }) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U;
  return hubJson({
    channels: ch.map(D).filter((c) => c.type === "text" || c.type === "announcement").sort((x, y) => (x.position || 0) - (y.position || 0))
      .map((c) => ({ id: c.id, name: c.name, parentName: c.parentName ?? "", canSend: !!c.botCanSend })),
    roles: ro.map(D).filter((r) => !r.managed).sort((x, y) => (y.position || 0) - (x.position || 0)).map((r) => ({ id: r.id, name: r.name, color: r.color || "" })),
    emojis: em.map(D).map((e) => ({ id: e.id, name: e.name, animated: !!e.animated, url: e.url })),
    members: us.map(D).filter((u) => SNOW.test(String(u.discordId)) && u.status !== "denied").map((u) => ({ discordId: u.discordId, name: memberName(u) })).sort((x, y) => x.name.localeCompare(y.name)),
    gallery: me.map(D).filter((m) => m.type === "image" && m.url && m.enabled !== false).map((m) => ({ id: m.id, url: m.url, name: m.name || "" })),
    sent: sent.map(D).map((m) => ({ id: m.id, kind: m.kind || "", channelName: m.channelName || "", content: m.content || "", embed: m.embed ?? null, buttons: m.buttons ?? [],
      sentByName: m.sentByName || "", sentAtISO: m.sentAtISO || "", jumpUrl: m.jumpUrl || "" })),
  });
}

/** Same checks as send-message.js problems(). */
function clean(b: U) {
  const content = String(b.content ?? "").slice(0, 1900);
  const e = b.embed && typeof b.embed === "object" ? b.embed as U : null;
  const embed = e ? { title: String(e.title ?? "").trim().slice(0, 256), description: String(e.description ?? "").slice(0, 4000), color: COLORS.has(Number(e.color)) ? Number(e.color) : 0x194a77, image: String(e.image ?? "").trim(), thumbnail: e.thumbnail !== false } : null;
  const buttons = (Array.isArray(b.buttons) ? b.buttons : []).slice(0, 5).map((x: U) => ({ label: String(x?.label ?? "").trim().slice(0, 80), url: String(x?.url ?? "").trim() })).filter((x: U) => x.label || x.url);
  if (!embed && !content.trim()) return "Type a message.";
  if (embed && !embed.title && !embed.description.trim() && !embed.image) return "Add a title, message or image.";
  if (embed?.image && !HTTPS.test(embed.image)) return "Image link must start with https://";
  for (const x of buttons) { if (!x.label) return "A button needs a label."; if (!HTTPS.test(x.url)) return `Button "${x.label}" needs an https:// link.`; }
  return { content, embed, buttons };
}

/** POST /api/hub/send {action: send|edit|delete} → Cortana posts as itself. */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "send")) return hubJson({ error: "You don't have Send Message access." }, 403);
  const b = (await req.json().catch(() => null)) as U | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  if (b.action === "delete") {
    const id = String(b.recordId ?? "");
    if (!ID.test(id)) return hubJson({ error: "Bad request." }, 400);
    const rec = (await TerminalDoc.findById(`discord_messages/${id}`, { data: 1 }).lean())?.data as U | undefined;
    const r = await job("message.delete", { recordId: id }, a.uid);
    if (r?.status === "failed") return hubJson({ error: String(r.error || "Cortana could not delete it.") }, 409);
    await hubAudit(who, "MESSAGE DELETED", `#${rec?.channelName ?? "?"} — via app`);
    return hubJson({ ok: true, msg: r ? "Deleted from Discord" : "Cortana is offline — it will be deleted when Cortana is back" });
  }
  const body = clean(b);
  if (typeof body === "string") return hubJson({ error: body }, 400);
  const short = (body.embed?.title || body.content || "(image)").slice(0, 80);
  if (b.action === "edit") {
    const id = String(b.recordId ?? "");
    if (!ID.test(id)) return hubJson({ error: "Bad request." }, 400);
    const rec = (await TerminalDoc.findById(`discord_messages/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (!rec) return hubJson({ error: "Message not found." }, 404);
    const r = await job("message.edit", { recordId: id, ...body }, a.uid);
    if (r?.status === "failed") return hubJson({ error: String(r.error || "Cortana could not edit it.") }, 409);
    await hubAudit(who, "MESSAGE EDITED", `#${rec.channelName} · ${short} — via app`);
    return hubJson({ ok: true, msg: r ? "Message updated in Discord" : "Cortana is offline — it will update when Cortana is back" });
  }
  if (b.action !== "send") return hubJson({ error: "Unknown action." }, 400);
  const channelId = String(b.channelId ?? "");
  const ch = SNOW.test(channelId) ? (await TerminalDoc.findById(`discord_channels/${channelId}`, { data: 1 }).lean())?.data as U | undefined : undefined;
  if (!ch) return hubJson({ error: "Pick a channel." }, 400);
  if (!ch.botCanSend) return hubJson({ error: "Cortana can't post in that channel." }, 400);
  const ping = { everyone: b.ping?.everyone === true, roles: (Array.isArray(b.ping?.roles) ? b.ping.roles : []).map(String).filter((r: string) => SNOW.test(r)).slice(0, 10) };
  const runAt = b.runAtISO ? new Date(String(b.runAtISO)) : null;
  if (runAt && (isNaN(+runAt) || +runAt < Date.now() - 60000)) return hubJson({ error: "Schedule time is in the past." }, 400);
  if (runAt) {
    await job("message.send", { channelId, ping, ...body }, a.uid, { runAtISO: runAt.toISOString() }, 0);
    await hubAudit(who, "MESSAGE SCHEDULED", `#${ch.name} · ${runAt.toLocaleString("en-GB", { timeZone: "Europe/London" })} — via app`);
    return hubJson({ ok: true, msg: "Scheduled — Cortana sends it at that time" });
  }
  const r = await job("message.send", { channelId, ping, ...body }, a.uid);
  if (r?.status === "failed") return hubJson({ error: String(r.error || "Cortana could not send it.") }, 409);
  await hubAudit(who, "MESSAGE SENT", `#${ch.name} · ${short} — via app`);
  return hubJson({ ok: true, msg: r ? `Sent to #${ch.name}` : "Cortana is offline — it will be sent when Cortana is back" });
}
