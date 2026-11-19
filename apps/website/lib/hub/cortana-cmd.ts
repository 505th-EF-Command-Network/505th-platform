import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";

/**
 * CORTANA COMMAND in the Hub (18 Nov) — Quick Post, Info Posts, Moderation. Same data + rules as the website panels
 * (quick-upload.js, info-posts.js, moderation.js). Discord work is queued as bot_jobs with requestedBy = the member,
 * and Cortana re-checks their access before acting (uidAllowed). Nobody can act on someone of their own rank or higher.
 */
type U = Record<string, any>;
export type CcActor = { uid: string; role: string; access: Record<string, unknown>; displayName: string };
export class CcError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const need = (a: CcActor, ...keys: string[]) => { if (!keys.some((k) => can(a.role, a.access, k))) throw new CcError("You don't have access to this page.", 403); };
const str = (x: unknown, max: number) => String(x ?? "").trim().slice(0, max);
const SNOW = /^\d{17,20}$/, HTTPS = /^https:\/\/[^\s"'<>]{4,600}$/;

/** Queue a Cortana job and wait up to `ms` for it (null = Cortana offline, it runs when back). */
async function job(a: CcActor, type: string, payload: U, ms = 10000) {
  const id = id20(), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type, payload, status: "pending", attempts: 0, requestedBy: a.uid, createdAtISO: now.toISOString() } });
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1000));
    const d = (await TerminalDoc.findById(`bot_jobs/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (d?.status === "failed") throw new CcError(String(d.error || "Cortana could not do it"));
    if (d?.status === "done") return d;
  }
  return null;
}
async function audit(a: CcActor, action: string, details: string) {
  const id = id20(), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "discord", action, details, uid: a.uid, by: a.displayName, role: a.role, source: "hub", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}
const list = async (parent: string, proj: U = { docId: 1, data: 1 }): Promise<U[]> => ((await TerminalDoc.find({ parent }, proj).lean()) as U[]).map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }));
async function channels() {
  return (await list("discord_channels")).map((c) => ({ id: c.id, name: String(c.name ?? ""), type: String(c.type ?? ""), parentName: String(c.parentName ?? ""), botCanSend: c.botCanSend !== false }))
    .filter((c) => ["text", "announcement"].includes(c.type)).sort((x, y) => (x.parentName + x.name).localeCompare(y.parentName + y.name));
}

/* ───────── Quick Post ───────── */
export async function quickGet(a: CcActor) {
  need(a, "qu");
  const evs = await list("community_events");
  const since = Date.now() - 21 * 864e5, until = Date.now() + 7 * 864e5;
  const ops = evs.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > since && Date.parse(e.startAtISO) < until)
    .sort((x, y) => String(y.startAtISO).localeCompare(String(x.startAtISO)))
    .map((e) => `${e.title} · ${new Date(e.startAtISO).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" })}`.slice(0, 150));
  return { channels: await channels(), ops, canGallery: can(a.role, a.access, "media") };
}
export async function quickPost(a: CcActor, b: U) {
  need(a, "qu");
  const channelId = str(b.channelId, 20), style = ["embed", "grid", "plain"].includes(b.style) ? b.style : "embed";
  const images = Array.isArray(b.images) ? b.images.filter((u: unknown) => typeof u === "string" && HTTPS.test(u) && u.includes("res.cloudinary.com/")).slice(0, 10) : [];
  if (!SNOW.test(channelId)) throw new CcError("Pick a channel.");
  if (!images.length) throw new CcError("Add at least one image.");
  const caption = str(b.caption, 1000), credit = str(b.credit, 100), op = style === "embed" ? str(b.op, 150) : "";
  const pending = job(a, "quick.upload", { channelId, images, style, caption, credit, op }, 10000);
  if (b.gallery && can(a.role, a.access, "media")) {
    const now = new Date();
    for (const u of images) { const id = id20(); await TerminalDoc.create({ _id: `media/${id}`, parent: "media", docId: id, createTime: now, updateTime: now, data: { type: "image", url: u, name: (caption || op || "Quick Post").slice(0, 100), description: [op, credit].filter(Boolean).join(" · "), category: "operations", uploadedAt: now.toISOString(), enabled: true, uploadedBy: a.displayName } }); }
  }
  const r = await pending;
  const ch = (await TerminalDoc.findById(`discord_channels/${channelId}`, { "data.name": 1 }).lean())?.data as U | undefined;
  await audit(a, "QUICK UPLOAD", `${images.length} image(s) → #${ch?.name ?? channelId}${op ? " · " + op : ""}`);
  return { ok: true, queued: !r, msg: r ? `Posted ${images.length} image${images.length === 1 ? "" : "s"} to #${ch?.name ?? ""}` : "Uploaded — Cortana posts it when it's back online" };
}

/* ───────── Info Posts ───────── */
const KEEP = ["name", "channelId", "content", "embeds", "buttons", "menu", "pin", "showOnWebsite", "updatedAtISO", "updatedByName"];
export async function infoGet(a: CcActor) {
  need(a, "info");
  const [posts, roles, types] = await Promise.all([list("info_posts"), list("discord_roles"), list("ticket_types")]);
  return {
    posts: posts.map(({ history, ...p }): U => ({ ...p, versions: Array.isArray(history) ? history.length : 0 })).sort((x, y) => String(x.name).localeCompare(String(y.name))),
    channels: await channels(),
    roles: roles.map((r) => ({ id: r.id, name: String(r.name ?? ""), color: Number(r.color ?? 0), assignable: r.assignable !== false && r.managed !== true })).filter((r) => r.name !== "@everyone"),
    ticketTypes: types.map((t) => ({ id: t.id, name: String(t.name ?? t.label ?? t.id) })),
  };
}
function cleanPost(v: U) {
  const emb = (e: U) => ({ title: str(e.title, 256), description: str(e.description, 4000), color: Math.max(0, Math.min(0xffffff, Number(e.color) || 0)),
    fields: (Array.isArray(e.fields) ? e.fields : []).slice(0, 25).map((f: U) => ({ name: str(f.name, 256), value: str(f.value, 1024), inline: !!f.inline })),
    image: HTTPS.test(String(e.image ?? "")) ? String(e.image) : "", thumbnail: e.thumbnail === "logo" || HTTPS.test(String(e.thumbnail ?? "")) ? String(e.thumbnail) : "", footer: str(e.footer, 2048) });
  const btn = (x: U) => ({ type: ["accept", "toggle", "link", "ticket", "reply"].includes(x.type) ? x.type : "link", label: str(x.label, 80), emoji: str(x.emoji, 40), style: ["green", "blue", "grey", "red"].includes(x.style) ? x.style : "grey",
    roleId: SNOW.test(String(x.roleId ?? "")) ? String(x.roleId) : "", url: HTTPS.test(String(x.url ?? "")) ? String(x.url) : "https://", ticketType: str(x.ticketType, 60), reply: str(x.reply, 2000) });
  const embeds = (Array.isArray(v.embeds) ? v.embeds : []).slice(0, 10).map(emb);
  return { name: str(v.name, 100), channelId: SNOW.test(String(v.channelId ?? "")) ? String(v.channelId) : "", content: str(v.content, 2000), embeds, buttons: (Array.isArray(v.buttons) ? v.buttons : []).slice(0, 25).map(btn),
    menu: v.menu ?? null, pin: !!v.pin, showOnWebsite: !!v.showOnWebsite };
}
export async function infoPost(a: CcActor, b: U) {
  need(a, "info");
  if (b.action === "delete") {
    const id = str(b.id, 40);
    const p = (await TerminalDoc.findById(`info_posts/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (!p) throw new CcError("Post not found.", 404);
    if (p.discord?.messageId) await job(a, "info.delete", { channelId: p.discord.channelId, messageId: p.discord.messageId }, 0).catch(() => {});
    await TerminalDoc.deleteOne({ _id: `info_posts/${id}` });
    await audit(a, "INFO POST DELETED", String(p.name ?? id));
    return { ok: true, msg: "Post deleted" };
  }
  if (b.action !== "save" && b.action !== "publish") throw new CcError("Bad request.");
  const v = cleanPost((b.v ?? {}) as U);
  if (!v.name) throw new CcError("Give the post a name.");
  if (!v.channelId) throw new CcError("Pick a channel.");
  if (!v.content && !v.embeds.some((e) => e.title || e.description || e.fields.length || e.image)) throw new CcError("The post is empty.");
  if (v.buttons.some((x) => !x.label && !x.emoji)) throw new CcError("Every button needs a label or emoji.");
  const now = new Date(), body = { ...v, updatedAtISO: now.toISOString(), updatedByName: a.displayName };
  let id = b.id ? str(b.id, 40) : "";
  if (id) {
    const old = (await TerminalDoc.findById(`info_posts/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (!old) throw new CcError("Post not found.", 404);
    const prev = Object.fromEntries(KEEP.map((k) => [k, old[k] ?? null]));
    const set: U = { updateTime: now, "data.history": [prev, ...(Array.isArray(old.history) ? old.history : [])].slice(0, 6) };
    for (const [k, x] of Object.entries(body)) set[`data.${k}`] = x;
    await TerminalDoc.updateOne({ _id: `info_posts/${id}` }, { $set: set });
  } else {
    id = id20();
    await TerminalDoc.create({ _id: `info_posts/${id}`, parent: "info_posts", docId: id, createTime: now, updateTime: now, data: { ...body, history: [], createdAtISO: body.updatedAtISO } });
  }
  if (b.action === "save") return { ok: true, id, msg: "Saved (not in Discord yet)" };
  const r = await job(a, "info.publish", { postId: id }, 10000);
  await audit(a, "INFO POST UPDATED", `${v.name}`);
  return { ok: true, id, queued: !r, msg: r ? ((r.result as U | undefined)?.reposted ? "Posted in Discord" : "Updated in Discord") : "Saved — Cortana updates Discord when it's back" };
}

/* ───────── Moderation ───────── */
export async function modGet(a: CcActor) {
  need(a, "modw", "modk");
  const [users, cases, purges] = await Promise.all([list("users", { docId: 1, "data.callsign": 1, "data.firstName": 1, "data.lastName": 1, "data.rank": 1, "data.discordId": 1, "data.suspended": 1 }), list("mod_cases"), list("mod_purges")]);
  return {
    members: users.filter((u) => !u.suspended && SNOW.test(String(u.discordId ?? ""))).map((u) => ({ id: u.id, discordId: String(u.discordId), name: [String(u.rank ?? "").split("/").pop()?.trim(), u.firstName, u.callsign ? `"${u.callsign}"` : u.lastName].filter(Boolean).join(" ") }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    cases: cases.sort((x, y) => String(y.createdAtISO ?? "").localeCompare(String(x.createdAtISO ?? ""))).slice(0, 300),
    purges: purges.sort((x, y) => String(y.createdAtISO ?? y.atISO ?? "").localeCompare(String(x.createdAtISO ?? x.atISO ?? ""))).slice(0, 30),
    channels: await channels(),
    canWarn: can(a.role, a.access, "modw"), canKick: can(a.role, a.access, "modk"),
  };
}
export async function modPost(a: CcActor, b: U) {
  const act = String(b.action ?? "");
  if (act === "action") {
    const kind = String(b.kind);
    if (!["warn", "timeout", "kick", "ban"].includes(kind)) throw new CcError("Bad action.");
    need(a, kind === "kick" || kind === "ban" ? "modk" : "modw");
    if (!SNOW.test(String(b.discordId ?? ""))) throw new CcError("Pick a member.");
    const reason = str(b.reason, 500);
    if (reason.length < 3) throw new CcError("A reason is needed.");
    const r = await job(a, "mod.action", { discordId: String(b.discordId), action: kind, reason, note: str(b.note, 500), minutes: Math.max(1, Math.min(40320, Number(b.minutes) || 60)), deleteDays: Math.max(0, Math.min(7, Number(b.deleteDays) || 0)), dm: b.dm !== false });
    return { ok: true, queued: !r, msg: r ? `${kind.toUpperCase()} done` : "Cortana is offline — done when it's back" };
  }
  if (act === "lift" || act === "delete") {
    need(a, "modw", "modk");
    const caseId = str(b.caseId, 40);
    const r = await job(a, act === "lift" ? "mod.lift" : "mod.delete", { caseId });
    return { ok: true, queued: !r, msg: r ? (act === "lift" ? "Lifted" : "Case deleted") : "Cortana is offline — done when it's back" };
  }
  if (act === "purge") {
    need(a, "modw");
    const channelId = str(b.channelId, 20), amount = Math.max(1, Math.min(100, Number(b.amount) || 0)), mode = ["all", "member", "bots"].includes(b.mode) ? b.mode : "all";
    if (!SNOW.test(channelId)) throw new CcError("Pick a channel.");
    const reason = str(b.reason, 300);
    if (reason.length < 3) throw new CcError("A reason is needed.");
    if (mode === "member" && !SNOW.test(String(b.memberId ?? ""))) throw new CcError("Pick the member.");
    const r = await job(a, "mod.purge", { channelId, amount, mode, ...(mode === "member" ? { memberId: String(b.memberId) } : {}), keepPinned: b.keepPinned !== false, reason }, 10000);
    return { ok: true, queued: !r, msg: r ? `Purged ${(r.result as U | undefined)?.deleted ?? amount} messages` : "Cortana is offline — done when it's back" };
  }
  throw new CcError("Bad request.");
}
