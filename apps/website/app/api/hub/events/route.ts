import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type U = Record<string, any>;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const LIMITS = { title: 100, description: 1000, location: 100, maxGoing: 500, buttons: 5, buttonLabel: 40 };
const OP_TYPES = new Set(["main_op", "patrol", "training", "fun_op"]);
const REPEAT = new Set(["none", "weekly", "fortnightly"]);
const STYLES = new Set(["blue", "green", "red", "grey"]);
/** Same fallback as events.js: until Cortana Setup lists sign-up channels, the official ones are matched by name. */
const SIGNUP_CHANNELS = ["killjoy-1-1", "killjoy-1-2", "jtf-23", "hm", "pilots", "event-schedule"];
const norm = (x: unknown) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/** "2026-11-21" + "19:00" in UK time → Date (handles GMT/BST) — same as events.js ukToDate. */
function ukToDate(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(guess).split(":").map(Number);
  const [wh, wm] = time.split(":").map(Number);
  return new Date(guess.getTime() - ((h! * 60 + m!) - (wh! * 60 + wm!)) * 60000);
}
const whenLabel = (v: U) => `${new Date(`${v.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${v.startTime}–${v.endTime}`;

async function job(type: string, payload: U, requestedBy: string, waitMs = 0) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type, payload, status: "pending", attempts: 0, requestedBy, createdAtISO: now.toISOString() } });
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1200));
    const d = (await TerminalDoc.findById(`bot_jobs/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (d && (d.status === "done" || d.status === "failed")) return d;
  }
  return null;
}

/** GET /api/hub/events → Events (calendar + list), channels for the wizard, Cortana status. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "ev")) return hubJson({ error: "You don't have Events access." }, 403);
  const [evs, atts, chans, cfg, hb] = await Promise.all([
    TerminalDoc.find({ parent: "community_events" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "attendance_events" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "discord_channels" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.findById("settings/cortana", { data: 1 }).lean(),
    TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean(),
  ]);
  const channels = chans.map((c) => ({ id: c.docId, ...((c.data ?? {}) as U) }) as U);
  const c = (cfg?.data ?? {}) as U;
  const text = channels.filter((x) => x.type === "text" || x.type === "announcement");
  const chanFor = (label: string) => { const n = norm(label); const hit = text.find((x) => norm(x.name) === n) || (n.length > 2 ? text.find((x) => norm(x.name).endsWith(n)) : null); return hit ? String(hit.id) : ""; };
  const signup: [string, string][] = Array.isArray(c.signupChannels) && c.signupChannels.length
    ? c.signupChannels.map((id: string) => [channels.find((x) => x.id === id)?.name || "deleted", channels.some((x) => x.id === id) ? id : ""])
    : SIGNUP_CHANNELS.map((n) => [n, chanFor(n)]);
  const vc = (k: string) => ((c[k] || []) as string[]).map((id) => channels.find((x) => x.id === id)?.name).filter(Boolean) as string[];
  const attMap = new Map(atts.map((x) => [x.docId, (x.data ?? {}) as U]));
  const hbd = (hb?.data ?? {}) as U;
  const events = evs.map((d) => {
    const e = (d.data ?? {}) as U, at = e.attendanceEventId ? attMap.get(e.attendanceEventId) : null;
    return {
      id: d.docId, title: e.title || "Untitled", description: e.description || "", where: e.where || "voice", voiceChannel: e.voiceChannel || "", location: e.location || "",
      date: e.date || "", startTime: e.startTime || "", endTime: e.endTime || "", startAtISO: e.startAtISO || "", endAtISO: e.endAtISO || "", opType: e.opType || at?.type || "main_op",
      repeat: e.repeat || "none", banner: e.banner || "", channel: e.channel || "", buttons: e.buttons || [], signups: (e.signups || []).map((s: U) => ({ uid: s.uid || "", name: s.name || "?", choice: s.choice, waiting: !!s.waiting, atISO: s.atISO || "" })),
      status: e.status || "scheduled", discord: e.discord || {}, attendanceEventId: e.attendanceEventId || null,
      attendance: at ? { locked: !!at.locked, present: (at.attendees || []).length } : null,
      createdByName: e.createdByName || "", updatedByName: e.updatedByName || "", createdAtISO: e.createdAtISO || "",
    };
  });
  return hubJson({
    events, canEdit: can(a.role, a.access, "ev"), signupChannels: signup, voiceChannels: vc("voiceChannels"), stageChannels: vc("stageChannels"),
    channelNames: Object.fromEntries(channels.map((x) => [x.id, x.name])),
    cortanaOnline: hbd.lastHeartbeatISO ? Date.now() - Date.parse(hbd.lastHeartbeatISO) < 3 * 60000 : null,
  });
}

/**
 * POST /api/hub/events — same as the Terminal events.js:
 * save (create / edit, + optional Attendance Tracker event) · cancel · end · delete · refresh / repost with ping · refreshall.
 * Cortana does the Discord side through bot_jobs, exactly like the website.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "ev")) return hubJson({ error: "You don't have Events access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const now = new Date(), nowISO = now.toISOString();

  if (b.action === "refreshall") {
    const r = await job("event.refreshAll", { all: true }, a.uid, 50000);
    if (!r) return hubJson({ error: "Cortana didn't pick this up — it fixes them by itself when it's back." }, 504);
    const x = (r.result ?? {}) as U;
    await hubAudit(who, "EVENT POSTS REFRESHED", `${x.fixed || 0} re-posted · ${x.updated || 0} updated — via app`);
    return hubJson({ ok: true, msg: `${x.fixed || 0} re-posted · ${x.updated || 0} updated${x.failed ? ` · ${x.failed} failed` : ""}` });
  }

  if (b.action === "save") {
    const v = (b.v ?? {}) as U;
    const where = ["stage", "voice", "else"].includes(v.where) ? v.where : "voice";
    const title = String(v.title ?? "").trim().slice(0, LIMITS.title), description = String(v.description ?? "").trim().slice(0, LIMITS.description);
    const voiceChannel = where === "else" ? "" : String(v.voiceChannel ?? "").trim().slice(0, 100), location = where === "else" ? String(v.location ?? "").trim().slice(0, LIMITS.location) : "";
    if (where !== "else" && !voiceChannel) return hubJson({ error: `Type the ${where} channel name.` }, 400);
    if (where === "else" && !location) return hubJson({ error: "Type where the event happens." }, 400);
    if (title.length < 3) return hubJson({ error: "Give the event a title (at least 3 characters)." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.date)) || !/^\d{2}:\d{2}$/.test(String(v.startTime)) || !/^\d{2}:\d{2}$/.test(String(v.endTime))) return hubJson({ error: "Choose the date, start and end time." }, 400);
    const channel = String(v.channel ?? "").trim().replace(/^#/, "").slice(0, 40);
    if (!channel) return hubJson({ error: "Pick the channel for the sign-up post." }, 400);
    const raw = Array.isArray(v.buttons) ? v.buttons.slice(0, LIMITS.buttons) : [];
    if (!raw.length) return hubJson({ error: "Add at least one sign-up button." }, 400);
    if (raw.some((x: U) => !String(x.label ?? "").trim())) return hubJson({ error: "Every button needs a label." }, 400);
    const banner = String(v.banner ?? "").trim().slice(0, 500);
    if (banner && !/^https:\/\//.test(banner)) return hubJson({ error: "Cover image must be an https link." }, 400);
    const start = ukToDate(v.date, v.startTime);
    let end = ukToDate(v.date, v.endTime);
    if (end <= start) end = new Date(end.getTime() + 864e5);
    const editId = b.id ? String(b.id) : null;
    if (editId && !ID.test(editId)) return hubJson({ error: "Invalid event." }, 400);
    const oldDoc = editId ? await TerminalDoc.findById(`community_events/${editId}`, { data: 1 }).lean() : null;
    if (editId && !oldDoc) return hubJson({ error: "Event not found." }, 404);
    const old = (oldDoc?.data ?? null) as U | null;
    // Keep sign-ups on buttons that stay in the same position (same as the website).
    const buttons = raw.map((x: U, i: number) => ({ key: old?.buttons?.[i]?.key || `b${i + 1}`, emoji: String(x.emoji ?? "").trim().slice(0, 64), label: String(x.label).trim().slice(0, LIMITS.buttonLabel),
      style: STYLES.has(x.style) ? x.style : "grey", limit: Math.max(0, Math.min(LIMITS.maxGoing, Math.floor(Number(x.limit) || 0))), attending: !!x.attending }));
    const keys = new Set(buttons.map((x: U) => x.key));
    const by = a.displayName;
    const rec: U = {
      title, description, where, voiceChannel, location, date: v.date, startTime: v.startTime, endTime: v.endTime, startAtISO: start.toISOString(), endAtISO: end.toISOString(),
      opType: OP_TYPES.has(v.opType) ? v.opType : "main_op", repeat: REPEAT.has(v.repeat) ? v.repeat : "none", banner, channel, buttons,
      ...(!old ? { signups: [] } : (old.signups || []).some((s: U) => !keys.has(s.choice)) ? { signups: (old.signups || []).filter((s: U) => keys.has(s.choice)) } : {}),
      updatedAtISO: nowISO, updatedByName: by,
    };
    let id = editId;
    if (id) {
      await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { ...Object.fromEntries(Object.entries(rec).map(([k, x]) => [`data.${k}`, x])), updateTime: now } });
      await hubAudit(who, "EVENT EDITED", `${title} — ${whenLabel(rec)} — via app`);
    } else {
      id = autoId();
      await TerminalDoc.create({ _id: `community_events/${id}`, parent: "community_events", docId: id, createTime: now, updateTime: now,
        data: { ...rec, status: "scheduled", attendanceEventId: null, discord: { status: "queued" }, createdBy: a.uid, createdByName: by, createdAt: now, createdAtISO: nowISO } });
      await hubAudit(who, "EVENT CREATED", `${title} — ${whenLabel(rec)} — via app`);
    }
    if (!old?.attendanceEventId && v.linkAttendance) {
      const at = autoId();
      await TerminalDoc.create({ _id: `attendance_events/${at}`, parent: "attendance_events", docId: at, createTime: now, updateTime: now,
        data: { title, date: v.date, type: rec.opType, attendees: [], excused: [], noShow: [], locked: false, linkedEventId: id, createdBy: by, createdAt: nowISO, updatedAt: nowISO, updatedBy: by } });
      await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.attendanceEventId": at } });
    } else if (old?.attendanceEventId) {
      await TerminalDoc.updateOne({ _id: `attendance_events/${old.attendanceEventId}` }, { $set: { "data.title": title, "data.date": v.date, "data.updatedAt": nowISO, updateTime: now } });
    }
    await job("event.publish", { eventId: id }, a.uid);
    return hubJson({ ok: true, id, msg: editId ? "Event saved" : "Event created — queued for Discord" });
  }

  const id = String(b.id ?? "");
  if (!ID.test(id)) return hubJson({ error: "Invalid event." }, 400);
  const d = await TerminalDoc.findById(`community_events/${id}`, { data: 1 }).lean();
  if (!d) return hubJson({ error: "Event not found." }, 404);
  const e = (d.data ?? {}) as U, ds = (e.discord ?? {}) as U;
  const note = (r: U | null, off: string) => (!r ? ` — ${off}` : r.status === "failed" ? ` — Discord: ${r.error || "error"}` : "");

  switch (b.action) {
    case "cancel":
      if (e.status === "cancelled" || e.status === "completed") return hubJson({ error: "Already finished." }, 400);
      await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "cancelled", "data.cancelledAtISO": nowISO, updateTime: now } });
      await job("event.cancel", { eventId: id }, a.uid);
      await hubAudit(who, "EVENT CANCELLED", `${e.title} — via app`);
      return hubJson({ ok: true, msg: "Event cancelled" });
    case "end": {
      await TerminalDoc.updateOne({ _id: `community_events/${id}` }, { $set: { "data.status": "completed", "data.completedAtISO": nowISO, "data.endAtISO": nowISO, "data.updatedAtISO": nowISO, updateTime: now } });
      const r = ds.messageId || ds.scheduledEventId ? await job("event.complete", { eventId: id }, a.uid, 25000) : {};
      await hubAudit(who, "EVENT ENDED", `${e.title} — ${whenLabel(e)} — via app`);
      return hubJson({ ok: true, msg: "Event ended" + note(r as U | null, "Cortana is offline: Discord will update when it's back") });
    }
    case "delete": {
      const r = ds.messageId || ds.scheduledEventId
        ? await job("event.remove", { eventId: id, title: e.title, channelId: ds.channelId || null, messageId: ds.messageId || null, scheduledEventId: ds.scheduledEventId || null, extraMessageIds: [ds.reminderMessageId, ds.startMessageId].filter(Boolean) }, a.uid, 25000)
        : {};
      await TerminalDoc.deleteOne({ _id: `community_events/${id}` });
      if (e.attendanceEventId) await TerminalDoc.updateOne({ _id: `attendance_events/${e.attendanceEventId}` }, { $set: { "data.linkedEventId": null } });
      await hubAudit(who, "EVENT DELETED", `${e.title} — ${whenLabel(e)} — via app`);
      return hubJson({ ok: true, msg: "Event deleted" + note(r as U | null, "Cortana is offline: the Discord post will be removed when it's back") });
    }
    case "refresh": {
      const r = await job("event.refresh", { eventId: id, ping: !!b.ping }, a.uid, 40000);
      if (!r) return hubJson({ error: "Cortana didn't pick this up — it fixes this by itself when it's back." }, 504);
      if (r.status === "failed") return hubJson({ error: "Refresh failed: " + (r.error || "error") }, 502);
      const x = (r.result ?? {}) as U;
      if (!x.skipped) await hubAudit(who, "EVENT POST REFRESHED", `${e.title}${x.fixed ? " · re-posted" : " · updated"}${b.ping ? " · with ping" : ""} — via app`);
      return hubJson({ ok: true, msg: x.skipped ? "This event is finished — nothing to refresh" : x.fixed ? "Sign-up post re-posted" : "Sign-up post updated" });
    }
  }
  return hubJson({ error: "Unknown action." }, 400);
}
