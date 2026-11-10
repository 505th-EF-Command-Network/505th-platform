import "server-only";

/**
 * Command Terminal data — server only. Every function returns plain,
 * serialisable objects containing only what the page shows.
 * Callers MUST be behind requireTerminal() (see lib/terminal/guard.ts).
 */
import {
  AccessAttempt, Aar, AttendanceEvent, AuditLog, Member, connectDb, memberDisplayName, rankByKey, rankLabel, ROLE_LABEL, type MemberDoc, type MemberStatus, type Role,
} from "@505th/db";

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : null);

export type RosterRow = {
  id: string;
  name: string;
  rankAbbrev: string;
  rankOrder: number;
  role: string;
  roleLabel: string;
  status: string;
  platoon: string;
  attendance: number;
  hasDiscord: boolean;
  joinedAt: string | null;
};

export async function getRoster(filter: { status?: MemberStatus[] } = {}): Promise<RosterRow[]> {
  await connectDb();
  const q = filter.status ? { status: { $in: filter.status } } : {};
  const rows = await Member.find(q)
    .select("firstName middleName lastName callsign rankKey rankRaw role status platoon attendance discordId joinedAt")
    .lean<MemberDoc[]>();
  return rows
    .map((m) => {
      const r = rankByKey(m.rankKey);
      return {
        id: String(m._id),
        name: memberDisplayName(m),
        rankAbbrev: r?.abbrev ?? m.rankRaw ?? "",
        rankOrder: r?.order ?? -1,
        role: m.role ?? "",
        roleLabel: ROLE_LABEL[m.role as Role] ?? m.role ?? "",
        status: m.status ?? "",
        platoon: m.platoon ?? "",
        attendance: m.attendance?.percent ?? 0,
        hasDiscord: !!m.discordId,
        joinedAt: iso(m.joinedAt),
      };
    })
    .sort((a, b) => b.rankOrder - a.rankOrder || a.name.localeCompare(b.name));
}

export type HistoryEntry = { date: string; title: string; note: string; by: string; tone: "promo" | "platoon" | "award" | "warn" };

export type ServiceRecord = {
  id: string;
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  callsign: string;
  rank: string;
  rankAbbrev: string;
  role: string;
  roleLabel: string;
  status: string;
  platoon: string;
  joinedPlatoon: string;
  recruitSource: string;
  joinedAt: string | null;
  approvedAt: string | null;
  discordUsername: string;
  hasDiscord: boolean;
  attendance: { percent: number; opsAttended: number; opsEligible: number; lastAttendedDate: string | null };
  history: HistoryEntry[];
  counts: { promotions: number; commendations: number; ribbons: number; warnings: number };
};

export async function getServiceRecord(id: string): Promise<ServiceRecord | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  await connectDb();
  const m = await Member.findById(id).lean();
  if (!m) return null;
  const r = rankByKey(m.rankKey);
  const h = (arr: any[] | undefined, tone: HistoryEntry["tone"], title: (x: any) => string): HistoryEntry[] =>
    (arr ?? []).map((x) => ({ date: x.date || iso(x.addedAt)?.slice(0, 10) || "", title: title(x), note: x.note ?? "", by: x.addedBy ?? "", tone }));
  const history = [
    ...h(m.promotionHistory, "promo", (x) => `PROMOTED ${x.fromRank ? `${x.fromRank} → ` : ""}${x.toRank ?? ""}`),
    ...h(m.platoonHistory, "platoon", (x) => `TRANSFER ${x.from ? `${x.from} → ` : ""}${x.to ?? ""}`),
    ...h(m.commendationHistory, "award", (x) => `COMMENDATION — ${x.title ?? ""}`),
    ...h(m.ribbonHistory, "award", (x) => `RIBBON — ${x.title ?? ""}`),
    ...h(m.warningHistory, "warn", (x) => `WARNING${x.severity ? ` (${String(x.severity).toUpperCase()})` : ""}`),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return {
    id: String(m._id),
    name: memberDisplayName(m),
    firstName: m.firstName ?? "",
    middleName: m.middleName ?? "",
    lastName: m.lastName ?? "",
    callsign: m.callsign ?? "",
    rank: r ? rankLabel(r) : m.rankRaw ?? "",
    rankAbbrev: r?.abbrev ?? m.rankRaw ?? "",
    role: m.role ?? "",
    roleLabel: ROLE_LABEL[m.role as Role] ?? m.role ?? "",
    status: m.status ?? "",
    platoon: m.platoon ?? "",
    joinedPlatoon: m.joinedPlatoon ?? "",
    recruitSource: m.recruitSource ?? "",
    joinedAt: iso(m.joinedAt),
    approvedAt: iso(m.approvedAt),
    discordUsername: m.discordUsername ?? "",
    hasDiscord: !!m.discordId,
    attendance: {
      percent: m.attendance?.percent ?? 0,
      opsAttended: m.attendance?.opsAttended ?? 0,
      opsEligible: m.attendance?.opsEligible ?? 0,
      lastAttendedDate: m.attendance?.lastAttendedDate ?? null,
    },
    history,
    counts: {
      promotions: m.promotionHistory?.length ?? 0,
      commendations: m.commendationHistory?.length ?? 0,
      ribbons: m.ribbonHistory?.length ?? 0,
      warnings: m.warningHistory?.length ?? 0,
    },
  };
}

export type OpRow = { id: string; title: string; type: string; date: string; attendees: number; excused: number; locked: boolean };

export async function getOps(limit = 200): Promise<OpRow[]> {
  await connectDb();
  const rows = await AttendanceEvent.find().sort({ date: -1 }).limit(limit).select("title type date attendees excused locked").lean();
  return rows.map((e) => ({
    id: String(e._id),
    title: e.title ?? "",
    type: e.type ?? "other",
    date: e.date ?? "",
    attendees: e.attendees?.length ?? 0,
    excused: e.excused?.length ?? 0,
    locked: !!e.locked,
  }));
}

export type AarRow = { id: string; title: string; date: string | null; operationType: string; result: string; author: string; casualties: number | null };

export async function getAars(): Promise<AarRow[]> {
  await connectDb();
  const rows = await Aar.find().sort({ date: -1 }).select("title date operationType result submittedByName author casualties").lean();
  return rows.map((a) => ({
    id: String(a._id),
    title: a.title ?? "",
    date: iso(a.date),
    operationType: a.operationType ?? "",
    result: a.result ?? "",
    author: a.submittedByName || a.author || "",
    casualties: a.casualties ?? null,
  }));
}

export type AuditRow = { id: string; at: string | null; actor: string; role: string; section: string; action: string; details: string; source: string };

export async function getAudit(limit = 200, section?: string): Promise<AuditRow[]> {
  await connectDb();
  const rows = await AuditLog.find(section ? { section } : {}).sort({ at: -1 }).limit(limit).lean();
  return rows.map((a) => ({
    id: String(a._id),
    at: iso(a.at),
    actor: a.actorName ?? "",
    role: a.actorRole ?? "",
    section: a.section ?? "",
    action: a.action ?? "",
    details: a.details ?? "",
    source: a.source ?? "",
  }));
}

export type AttemptRow = { id: string; at: string | null; who: string; result: string; reason: string; target: string };

export async function getAttempts(limit = 200, result?: "GRANTED" | "PENDING" | "DENIED"): Promise<AttemptRow[]> {
  await connectDb();
  const rows = await AccessAttempt.find(result ? { result } : {}).sort({ at: -1 }).limit(limit).lean();
  return rows.map((a) => ({
    id: String(a._id),
    at: iso(a.at),
    who: a.discordUsername ?? "",
    result: a.result ?? "",
    reason: a.reason ?? "",
    target: a.target ?? "",
  }));
}

export type Overview = {
  kpi: { active: number; pending: number; opsThisMonth: number; avgAttendance: number; deniedWeek: number; aars: number };
  recentOps: OpRow[];
  activity: AuditRow[];
  alerts: AttemptRow[];
  pendingMembers: RosterRow[];
};

export async function getOverview(): Promise<Overview> {
  await connectDb();
  const month = new Date().toISOString().slice(0, 7);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [active, pending, opsThisMonth, avg, deniedWeek, aars, recentOps, activity, alerts, pendingMembers] = await Promise.all([
    Member.countDocuments({ status: "ACTIVE" }),
    Member.countDocuments({ status: "PENDING" }),
    AttendanceEvent.countDocuments({ date: { $regex: `^${month}` } }),
    Member.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: null, v: { $avg: "$attendance.percent" } } }]),
    AccessAttempt.countDocuments({ result: "DENIED", at: { $gte: weekAgo } }),
    Aar.countDocuments(),
    getOps(5),
    getAudit(8),
    getAttempts(5, "DENIED"),
    getRoster({ status: ["PENDING"] }),
  ]);
  return {
    kpi: { active, pending, opsThisMonth, avgAttendance: Math.round(avg[0]?.v ?? 0), deniedWeek, aars },
    recentOps,
    activity,
    alerts,
    pendingMembers: pendingMembers.slice(0, 5),
  };
}
