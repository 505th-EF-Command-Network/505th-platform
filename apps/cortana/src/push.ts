/**
 * 📱 PHONE ALERTS (approved mock 2026-11-13). Every new 🔔 alert (notifications/<uid>/items/*) is also sent as a
 * web push to that person's phones (iPhone Home Screen app, Android Chrome) — if they turned it on.
 *   Phones:   push_subs/<id> { uid, endpoint, keys, name, enabled, createdISO, lastISO }  (made by /api/me/push)
 *   Choices:  users/<uid>.data.phonePrefs { ev: {kind: bool}, quiet, from, to, letOps, preview, badge, skipHub }
 * Needs VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in .env.local (private key never leaves the bot server).
 * Dead phones (404 / 410 from the push service) are removed.
 */
import webpush from "web-push";
import { HubSession, Member, TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { onDbChange } from "./live.ts";
import { log } from "./log.ts";

type U = Record<string, any>;
export type PushKind = "message" | "tag" | "op" | "event" | "ticket" | "bct" | "project" | "rank" | "note" | "net" | "staff" | "test";

/** Which phone-alert switch an alert belongs to (same idea as the Hub's alertKind). */
export function kindOf(type: string, title: string): PushKind {
  const t = `${type} ${title}`.toLowerCase();
  if (type === "test") return "test";
  if (type === "staff_online") return "staff";
  if (/tagged|mention/.test(t)) return "tag";
  if (/message|\bdm\b|chat/.test(type)) return "message";
  if (/ticket/.test(t)) return "ticket";
  if (/note|reminder/.test(t)) return "note";
  if (/offline|outage|down\b|network status/.test(t)) return "net";
  if (/project|task/.test(t)) return "project";
  if (/bct|recruit|register/.test(t)) return "bct";
  if (/starting|op\b.*soon|in \d+ min/.test(t)) return "op";
  if (/event|rsvp|operation/.test(t)) return "event";
  return "rank";
}
const DEFAULT_EV: Record<string, boolean> = { message: true, tag: true, op: true, event: false, ticket: true, bct: false, project: false, rank: true, note: true, net: true, staff: true };
const LINK: Record<string, string> = { message: "/terminal#panel-msg2", tag: "/terminal", op: "/terminal#panel-events", event: "/terminal#panel-events", ticket: "/terminal#panel-tickets",
  bct: "/terminal#panel-bct", project: "/terminal#panel-projects", rank: "/profile", note: "/terminal#panel-notes", net: "/terminal#panel-network", staff: "/terminal", test: "/profile?tab=phone" };

const ukHM = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const inQuiet = (p: U) => {
  if (!p.quiet || p.quiet === "off") return false;
  const [a, b] = p.quiet === "night" ? ["23:00", "08:00"] : [String(p.from || "23:00"), String(p.to || "08:00")];
  const n = ukHM();
  return a <= b ? n >= a && n < b : n >= a || n < b;
};

async function onHub(uid: string) {
  const m = await Member.findOne({ $or: [{ legacyId: uid }, ...(/^[a-f0-9]{24}$/.test(uid) ? [{ _id: uid }] : [])] }, { _id: 1 }).lean();
  return !!m && !!(await HubSession.exists({ member: m._id, revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(Date.now() - 3 * 60_000) } }));
}

async function send(uid: string, n: U) {
  const subs = (await TerminalDoc.find({ parent: "push_subs", "data.uid": uid, "data.enabled": { $ne: false } }, { data: 1 }).lean()) as U[];
  if (!subs.length) return;
  const kind = kindOf(String(n.type ?? ""), String(n.title ?? ""));
  const u = ((await TerminalDoc.findById(`users/${uid}`, { "data.phonePrefs": 1 }).lean()) as U | null)?.data?.phonePrefs ?? {};
  if (kind !== "test") {
    if ((u.ev?.[kind] ?? DEFAULT_EV[kind]) === false) return;
    if (inQuiet(u) && !(kind === "op" && u.letOps !== false)) return;
    if (u.skipHub !== false && (await onHub(uid))) return;
  }
  const badge = u.badge === false ? undefined : await TerminalDoc.countDocuments({ parent: `notifications/${uid}/items`, "data.read": { $ne: true } });
  const payload = JSON.stringify({
    title: String(n.title ?? "505th").slice(0, 120),
    body: kind === "message" && u.preview === false ? "New message — open the 505th app to read it." : String(n.body ?? "").slice(0, 240),
    url: LINK[kind] ?? "/terminal", tag: kind === "message" ? "msg" : undefined, badge,
  });
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.data.endpoint, keys: s.data.keys }, payload, { TTL: 3600, urgency: kind === "op" || kind === "message" || kind === "test" ? "high" : "normal" });
      await TerminalDoc.updateOne({ _id: s._id }, { $set: { "data.lastISO": new Date().toISOString() } }).catch(() => {});
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await TerminalDoc.deleteOne({ _id: s._id }).catch(() => {}); log.info(`Phone alerts: removed a dead phone for ${uid}`); }
      else log.warn(`Phone alerts: send failed (${code ?? (e as Error).message})`);
    }
  }
}

export function startPush() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) { log.info("Phone alerts: off (set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in .env.local)."); return; }
  webpush.setVapidDetails("https://www.505expeditionaryforce.com", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  onDbChange((top, c) => {
    if (top !== "notifications" || c.operationType !== "insert") return;
    const d = c.fullDocument as U | undefined;
    const uid = String(d?.parent ?? "").split("/")[1];
    if (!uid || !d?.data) return;
    void send(uid, d.data).catch((e) => log.warn(`Phone alerts: ${(e as Error).message}`));
  });
  log.ok("Phone alerts on (web push).");
}
