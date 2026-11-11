import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { effectiveAccess, hasTerminal, roleLevel } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";

type U = Record<string, any>;
const ONLINE_MS = 3 * 60_000;
/** Same naming rule as the Terminal: [Rank] F. "Callsign" / [Rank] F. Lastname. */
function nameOf(u: U): string {
  const abbr = String(u.rank || "").split("/").pop()?.trim() ?? "";
  const first = String(u.firstName || "").trim(), last = String(u.lastName || "").trim(), cs = String(u.callsign || "").trim();
  const nm = `${first ? first[0]!.toUpperCase() + ". " : ""}${cs && cs !== first ? `"${cs}"` : last}`.trim();
  return [abbr, nm].filter(Boolean).join(" ") || "—";
}
/** A member's status as others see it (invisible → offline; expired → online). */
function stateOf(u: U, online: boolean): "online" | "dnd" | "offline" {
  if (!online) return "offline";
  const s = u.myStatus;
  if (!s?.state || (s.untilISO && Date.parse(s.untilISO) < Date.now())) return "online";
  return s.state === "invisible" || s.state === "offline" ? "offline" : s.state === "dnd" ? "dnd" : "online";
}

/**
 * GET /api/hub/summary → everything the app Dashboard needs in one call:
 * me (attendance, PT, status), next ops, unread alerts, staff status, system status.
 * The app reloads it when the 505th Net says "users", "presence_sessions", "community_events", "notifications" or "bot_status".
 */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const now = Date.now();
  const [users, pres, evs, alerts, bot] = await Promise.all([
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "presence_sessions" }, { data: 1 }).lean(),
    TerminalDoc.find({ parent: "community_events" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: `notifications/${a.uid}/items` }, { docId: 1, data: 1 }).sort({ "data.createdAt": -1 }).limit(20).lean(),
    TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean(),
  ]);
  const lastSeen = new Map<string, { at: number; panel: string }>();
  for (const p of pres) {
    const d = (p.data ?? {}) as U, at = Date.parse(d.updatedAt || 0);
    if (now - at > ONLINE_MS) continue;
    const cur = lastSeen.get(d.uid);
    if (!cur || cur.at < at) lastSeen.set(d.uid, { at, panel: String(d.panel || "") });
  }
  const meDoc = (users.find((u) => u.docId === a.uid)?.data ?? {}) as U;
  const staff = users
    .map((u) => ({ id: u.docId, ...((u.data ?? {}) as U) }) as U)
    .filter((u) => hasTerminal(u.role) && u.status !== "pending" && u.status !== "denied" && u.suspended !== true && u.role !== "retired_veteran")
    .map((u) => {
      const p = lastSeen.get(u.id);
      const st = u.id === a.uid ? stateOf(u, true) : stateOf(u, !!p);
      return {
        uid: u.id, name: nameOf(u), role: u.role, level: roleLevel(u.role), state: st,
        page: st === "online" ? p?.panel || "" : "",
        note: st === "dnd" ? String(u.myStatus?.note || "") : "",
        until: st === "dnd" ? u.myStatus?.untilISO || null : null,
        photo: [u.photoUrl, u.photoURL, u.discordAvatarUrl].find((p) => typeof p === "string" && p.startsWith("https://")) ?? null,
      };
    })
    .sort((x, y) => y.level - x.level || x.name.localeCompare(y.name));

  const ops = evs
    .map((e) => ({ id: e.docId, ...((e.data ?? {}) as U) }) as U)
    .filter((e) => e.startAtISO && Date.parse(e.startAtISO) > now - 2 * 3600e3 && e.status !== "cancelled")
    .sort((x, y) => Date.parse(x.startAtISO) - Date.parse(y.startAtISO))
    .slice(0, 3)
    .map((e) => {
      const su = (e.signups || []) as U[];
      const mine = su.find((s) => s.uid === a.uid);
      return { id: e.id, title: String(e.title || "Op"), startAtISO: e.startAtISO, signedUp: su.length, mine: mine ? String(mine.choice || "signed") : null };
    });

  const b = (bot?.data ?? {}) as U;
  const cortanaOnline = b.online !== false && !!b.lastHeartbeatISO && now - Date.parse(b.lastHeartbeatISO) < 90_000;

  return hubJson({
    me: {
      uid: a.uid, name: nameOf(meDoc), role: a.role, rank: meDoc.rank || "", platoon: meDoc.platoon || "",
      attendance: Number(meDoc.attendance) || 0, pt: Number(meDoc.promotionTracker) || 0,
      opsAttended: Number(meDoc.opsAttended) || 0, opsEligible: Number(meDoc.opsEligible) || 0,
      status: meDoc.myStatus?.state && !(meDoc.myStatus.untilISO && Date.parse(meDoc.myStatus.untilISO) < now) ? meDoc.myStatus : { state: "online" },
      access: effectiveAccess(a.role, a.access),
    },
    ops,
    alerts: alerts.map((n) => { const d = (n.data ?? {}) as U; return { id: n.docId, type: d.type || "", title: d.title || "", body: d.body || "", read: !!d.read, at: d.createdAt ?? null }; }),
    staff,
    system: { cortana: { online: cortanaOnline, pingMs: b.pingMs ?? null }, website: true },
    at: new Date().toISOString(),
  });
}
