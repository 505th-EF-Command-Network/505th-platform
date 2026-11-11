import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const iso = (v: unknown) => { if (!v) return ""; const d = v instanceof Date ? v : new Date(String(v)); return isNaN(+d) ? "" : d.toISOString(); };
const ukMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);

/**
 * GET /api/hub/overview → everything the app Dashboard widgets + side nav counts need, in one call.
 * Each block is only filled when the person has access to that page (same access as the Terminal).
 * Also returns the person's saved app layout (users/{uid}.hubPrefs).
 */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const has = (k: string) => can(a.role, a.access, k);
  await connectDb();
  const t0 = Date.now();
  await TerminalDoc.findById("settings/roster_meta", { _id: 1 }).lean().catch(() => null);
  const dbMs = Date.now() - t0;
  const [users, atts, evs, tickets, audits, bot] = await Promise.all([
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "attendance_events", "data.locked": true }, { data: 1 }).lean(),
    TerminalDoc.find({ parent: "community_events" }, { docId: 1, data: 1 }).lean(),
    has("tk") ? TerminalDoc.find({ parent: "tickets", "data.status": "open", "data.waiting": "staff" }, { _id: 1 }).lean() : Promise.resolve([]),
    has("audit") ? TerminalDoc.find({ parent: "audit_logs" }, { data: 1 }).sort({ createTime: -1 }).limit(8).lean() : Promise.resolve([]),
    TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean(),
  ]);
  const us = users.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U);
  const me = us.find((u) => u.id === a.uid) ?? ({} as U);
  const members = us.filter((u) => u.status !== "pending" && u.status !== "denied" && u.role !== "retired_veteran");
  const actv = members.filter((u) => u.platoon !== "Reserves");
  const tE = actv.reduce((s, u) => s + (Number(u.opsEligible) || 0), 0), tA = actv.reduce((s, u) => s + (Number(u.opsAttended) || 0), 0);
  const pending = us.filter((u) => u.status === "pending");
  const now = Date.now();

  // Attendance trend: last 8 locked ops, turnout % of the active roll.
  const trend = atts.map((d) => (d.data ?? {}) as U).sort((x, y) => String(x.date).localeCompare(String(y.date))).slice(-8)
    .map((e) => ({ label: String(e.date || "").slice(5, 10).split("-").reverse().join("/"), title: String(e.title || "Op"), pct: actv.length ? Math.round(((e.attendees || []).length / actv.length) * 100) : 0 }));

  // Recruitment this month (same as Recruitment Stats: approved with a BCT instructor).
  const m = ukMonth();
  const rec = us.filter((u) => u.approvedAt && u.bctInstructor && iso(u.approvedAt).slice(0, 7) === m);
  const bySrc: Record<string, number> = {};
  for (const u of rec) bySrc[u.recruitSource || "Not tagged"] = (bySrc[u.recruitSource || "Not tagged"] ?? 0) + 1;
  const recent = us.filter((u) => u.approvedAt && u.registeredAt && u.bctInstructor).slice(-30);
  const avg = recent.length ? (recent.reduce((s, u) => s + Math.max(0, (Date.parse(iso(u.approvedAt)) - Date.parse(iso(u.registeredAt))) / 864e5), 0) / recent.length).toFixed(1) : "—";

  // This week (UK days, today + 6).
  const week = evs.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U)
    .filter((e) => e.status !== "cancelled" && e.startAtISO && Date.parse(e.startAtISO) > now - 864e5 && Date.parse(e.startAtISO) < now + 7 * 864e5)
    .sort((x, y) => String(x.startAtISO).localeCompare(String(y.startAtISO)))
    .map((e) => ({ id: e.id, title: String(e.title || "Event"), startAtISO: e.startAtISO, opType: e.opType || "main_op" }));

  const b = (bot?.data ?? {}) as U;
  const hb = b.lastHeartbeatISO ? now - Date.parse(b.lastHeartbeatISO) : Infinity;
  const cortana = b.online !== false && hb < 90_000;
  const meName = memberName(me);

  return hubJson({
    prefs: me.hubPrefs ?? null,
    me: { name: meName, rank: me.rank || "", platoon: me.platoon || "", role: a.role, discordUsername: me.discordUsername || "",
      photo: [me.photoUrl, me.photoURL, me.discordAvatarUrl].find((p) => typeof p === "string" && p.startsWith("https://")) ?? null,
      ribbons: (me.ribbonHistory || []).length, medals: (me.commendationHistory || []).length,
      warnings: (me.warningHistory || []).filter((w: U) => !w.expires || String(w.expires) >= new Date().toISOString().slice(0, 10)).length },
    counts: { bct: has("bct") ? pending.length : 0, tickets: tickets.length },
    manpower: { active: actv.filter((u) => u.platoon !== "Awaiting BCT").length, reserves: members.filter((u) => u.platoon === "Reserves").length, bct: pending.length,
      rate: tE ? Math.round((tA / tE) * 100) : 0, at3: actv.filter((u) => (Number(u.attendance) || 0) >= 3).length, tickets: tickets.length },
    trend,
    recruitment: has("rstat") || has("bct") ? { count: rec.length, avg, sources: Object.entries(bySrc).sort((x, y) => y[1] - x[1]) } : null,
    bctQueue: has("bct") ? pending.sort((x, y) => iso(x.registeredAt).localeCompare(iso(y.registeredAt))).slice(0, 5)
      .map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown", days: Math.max(0, Math.floor((now - Date.parse(iso(u.registeredAt) || new Date().toISOString())) / 864e5)) })) : null,
    week,
    activity: has("audit") ? audits.map((d) => { const x = (d.data ?? {}) as U; return { at: iso(x.createdAtISO || x.createdAt), by: String(x.by || "—"), action: String(x.action || ""), details: String(x.details || "").slice(0, 140) }; }) : null,
    system: {
      cortana: { online: cortana, pingMs: typeof b.pingMs === "number" ? b.pingMs : null, cpu: typeof b.cpuPercent === "number" ? b.cpuPercent : null, startedAtISO: b.startedAtISO || null,
        missingPerms: Array.isArray(b.missingPerms) ? b.missingPerms.length : 0, errors24h: Number(b.errors24h) || 0, jobsQueued: Number(b.jobsQueued) || 0 },
      dbMs, website: true,
      media: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      realtime: !!process.env.ABLY_API_KEY,
    },
    at: new Date().toISOString(),
  });
}
