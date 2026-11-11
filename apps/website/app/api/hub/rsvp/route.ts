import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/**
 * POST /api/hub/rsvp { eventId, key } → change MY sign-up on an event from the app (approved 2026-11-11).
 * Exactly the same rules as pressing the button in Discord (apps/cortana/src/events.ts): closed once the op
 * starts · full button = waiting list · waiting list moves up when a place frees · same key again = remove me.
 * Saved only if nobody else changed the event meanwhile, then Cortana refreshes the Discord sign-up post (no ping).
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const id = String(b.eventId ?? ""), key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !/^[A-Za-z0-9_-]{1,20}$/.test(key)) return hubJson({ error: "Invalid." }, 400);
  const me = ((await TerminalDoc.findById(`users/${a.uid}`, { data: 1 }).lean())?.data ?? {}) as U;
  const discordId = String(me.discordId || "");
  if (!/^\d{17,20}$/.test(discordId)) return hubJson({ error: "Link your Discord account first (website → profile)." }, 400);
  const name = memberName(me);
  for (let tries = 0; tries < 4; tries++) {
    const d = await TerminalDoc.findById(`community_events/${id}`, { data: 1, updateTime: 1 }).lean();
    if (!d) return hubJson({ error: "Event not found." }, 404);
    const ev = (d.data ?? {}) as U;
    if (ev.status === "cancelled" || ev.status === "completed" || ev.discord?.closedAtISO || ev.discord?.startSentISO) return hubJson({ error: "This sign-up is closed." }, 409);
    const btn = ((ev.buttons || []) as U[]).find((x) => x.key === key);
    if (!btn) return hubJson({ error: "That option no longer exists." }, 400);
    let su = [...((ev.signups || []) as U[])];
    const mine = su.find((x) => x.discordId === discordId || x.uid === a.uid);
    let msg: string, waiting = false;
    if (mine && mine.choice === key) {
      su = su.filter((x) => x !== mine);
      msg = mine.waiting ? `Removed you from the ${btn.label} waiting list` : `Removed you from ${btn.label}`;
    } else {
      const taken = su.filter((x) => x.choice === key && !x.waiting && x !== mine).length;
      waiting = btn.limit > 0 && taken >= btn.limit;
      su = su.filter((x) => x !== mine);
      su.push({ uid: a.uid, discordId, name, choice: key, atISO: new Date().toISOString(), ...(waiting ? { waiting: true } : {}) });
      msg = waiting ? `${btn.label} is full — you're on the waiting list` : `You're down as ${btn.emoji} ${btn.label}`.trim();
    }
    for (const x of (ev.buttons || []) as U[]) {
      if (!x.limit) continue;
      let free = x.limit - su.filter((s) => s.choice === x.key && !s.waiting).length;
      for (const w of su.filter((s) => s.choice === x.key && s.waiting)) if (free-- > 0) delete w.waiting;
    }
    const now = new Date();
    const res = await TerminalDoc.updateOne({ _id: `community_events/${id}`, updateTime: d.updateTime }, { $set: { "data.signups": su, updateTime: now } });
    if (res.modifiedCount !== 1) continue;
    const j = autoId();
    await TerminalDoc.create({ _id: `bot_jobs/${j}`, parent: "bot_jobs", docId: j, createTime: now, updateTime: now,
      data: { type: "event.refresh", payload: { eventId: id, ping: false }, status: "pending", attempts: 0, requestedBy: a.uid, createdAtISO: now.toISOString() } }).catch(() => {});
    await hubAudit({ uid: a.uid, name: a.displayName, role: a.role }, "EVENT SIGN-UP CHANGED", `${ev.title || id}: ${msg} — via app`);
    return hubJson({ ok: true, msg, waiting });
  }
  return hubJson({ error: "Busy — please try again." }, 409);
}
