import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";
import { syncMember } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
/** Same lists and rules as the Terminal's bct-approvals.js. */
const PFC = "E2 / Private First Class";
const PLATOONS = ["1st Platoon", "2nd Platoon", "3rd Platoon", "Force Recon", "Corpsmen", "Pilot"];
const SOURCES = ["Reddit", "Steam Community", "Disboard", "Discord", "Word of Mouth", "Other"];
const DENY_REASONS = ["Did not pass BCT / not known to instructor", "Did not meet requirements", "Fake or incomplete name", "Duplicate account", "Other"];
const STAFF_ROLES = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
const APPROVE_ROLES = STAFF_ROLES;
const LOGO = "https://i.ibb.co/d0Gn5M5R/505-TH-Logo.png";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const fullName = (u: U) => [u.firstName, u.middleName ? String(u.middleName)[0] + "." : "", u.lastName].filter(Boolean).join(" ") || "Unknown";
const iso = (v: unknown) => { if (!v) return ""; const d = v instanceof Date ? v : new Date(String(v)); return isNaN(+d) ? "" : d.toISOString(); };
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

async function webhook(key: "approved" | "denied", embed: U) {
  const s = await TerminalDoc.findById("settings/webhooks", { data: 1 }).lean();
  const url = ((s?.data ?? {}) as U)[key];
  if (typeof url !== "string" || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ username: "505th Command Terminal", avatar_url: LOGO, allowed_mentions: { parse: [] }, embeds: [{ ...embed, footer: { text: "505th Expeditionary Force • Command Terminal" }, timestamp: new Date().toISOString() }] }) }).catch(() => {});
}

/** GET /api/hub/bct → waiting / approved (30 days) / denied (30 days), stats, instructor list. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "bct")) return hubJson({ error: "You don't have BCT Approvals access." }, 403);
  const users = (await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U);
  const out = (u: U) => ({ id: u.id, fullName: fullName(u), name: memberName(u), pfcName: memberName({ ...u, rank: PFC }), initials: ((u.firstName || "?")[0] + (u.lastName || "?")[0]).toUpperCase(), discordUsername: u.discordUsername || "", email: u.discordUsername ? "" : u.email ? "email on file" : "",
    rank: u.rank || "", role: u.role || "", platoon: u.platoon || "", graduation: u.graduation || "", bctDate: u.bctDate || "", bctInstructor: u.bctInstructor || "", recruitSource: u.recruitSource || "", timezone: u.timezone || "",
    registeredAt: iso(u.registeredAt), approvedAt: iso(u.approvedAt), approvedBy: u.approvedBy || "", deniedAt: iso(u.deniedAt), deniedBy: u.deniedBy || "", denyReason: u.denyReason || "" });
  const days = (v: unknown) => { const t = Date.parse(iso(v)); return t ? (Date.now() - t) / 864e5 : 1e9; };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const recent = users.filter((u) => u.approvedAt && u.registeredAt && u.bctInstructor).slice(-30);
  return hubJson({
    pending: users.filter((u) => u.status === "pending").sort((x, y) => iso(x.registeredAt).localeCompare(iso(y.registeredAt))).map(out),
    approved: users.filter((u) => u.status !== "pending" && u.status !== "denied" && u.approvedAt && u.bctInstructor && days(u.approvedAt) <= 30).sort((x, y) => iso(y.approvedAt).localeCompare(iso(x.approvedAt))).map(out),
    denied: users.filter((u) => u.status === "denied" && days(u.deniedAt) <= 30).map(out),
    thisMonth: users.filter((u) => u.approvedAt && u.bctInstructor && Date.parse(iso(u.approvedAt)) >= monthStart).length,
    avg: recent.length ? (recent.reduce((s, u) => s + Math.max(0, (Date.parse(iso(u.approvedAt)) - Date.parse(iso(u.registeredAt))) / 864e5), 0) / recent.length).toFixed(1) : "—",
    instructors: users.filter((u) => STAFF_ROLES.has(u.role) && u.status !== "pending" && u.status !== "denied").map(memberName).filter(Boolean).sort(),
    platoons: PLATOONS, sources: SOURCES, denyReasons: DENY_REASONS, canAct: APPROVE_ROLES.has(a.role),
  });
}

/** POST /api/hub/bct — approve (→ Active · PFC · Marine · platoon, service record, welcome alert, webhook) · deny · reopen. */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "bct") || !APPROVE_ROLES.has(a.role)) return hubJson({ error: "You can't approve or deny." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const uid = String(b.id ?? "");
  if (!ID.test(uid)) return hubJson({ error: "Invalid member." }, 400);
  const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
  if (!d) return hubJson({ error: "Member not found." }, 404);
  const u = (d.data ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role }, by = a.displayName;
  const now = new Date(), nowISO = now.toISOString();
  const set = async (patch: U) => {
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { ...Object.fromEntries(Object.entries({ ...patch, updatedAt: nowISO }).map(([k, v]) => [`data.${k}`, v])), updateTime: now } });
    await syncMember(uid, false).catch(() => {});
  };

  if (b.action === "approve") {
    if (u.status !== "pending") return hubJson({ error: "They are not waiting for approval any more." }, 409);
    const date = String(b.date ?? ""), platoon = String(b.platoon ?? ""), instructor = String(b.instructor ?? "").slice(0, 80), source = String(b.source ?? ""), note = String(b.note ?? "").trim().slice(0, 200);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !instructor) return hubJson({ error: "Set a graduation date and pick the BCT instructor." }, 400);
    if (date > nowISO.slice(0, 10)) return hubJson({ error: "Graduation date can't be in the future." }, 400);
    if (!PLATOONS.includes(platoon)) return hubJson({ error: "Pick a platoon." }, 400);
    if (source && !SOURCES.includes(source)) return hubJson({ error: "Pick a recruitment source." }, 400);
    const promo = [...(u.promotionHistory || []), { date, fromRank: u.rank || "—", toRank: PFC, note: note ? `BCT passed — ${note}` : "BCT passed", addedBy: by, addedAt: nowISO, auto: true }];
    const plt = [...(u.platoonHistory || []), { date, from: u.platoon || "—", to: platoon, note: "BCT passed", addedBy: by, addedAt: nowISO, auto: true }];
    await set({ status: "active", role: "marine", rank: PFC, platoon, joinedPlatoon: date, graduation: date, bctInstructor: instructor, recruitSource: source || u.recruitSource || "",
      approvedAt: nowISO, approvedBy: by, promotionHistory: promo, platoonHistory: plt });
    const pfcName = memberName({ ...u, rank: PFC });
    const nid = autoId();
    await TerminalDoc.create({ _id: `notifications/${uid}/items/${nid}`, parent: `notifications/${uid}/items`, docId: nid, createTime: now, updateTime: now,
      data: { type: "promotion", read: false, title: "Welcome to the 505th!", body: `BCT passed — you are now ${pfcName}, ${platoon}.`, createdAt: now } }).catch(() => {});
    await hubAudit(who, "BCT APPROVED", `${fullName(u)} passed BCT (instructor: ${instructor}) → ${PFC}, ${platoon}${source ? " — Source: " + source : ""} — via app`);
    if (b.post !== false) await webhook("approved", { title: "🎖 New Marine — BCT Passed", description: `**${pfcName}** passed Basic Combat Training and joins **${platoon}**.`, color: 0x22e07a,
      fields: [{ name: "BCT Instructor", value: instructor, inline: true }, { name: "Approved by", value: by, inline: true }] });
    return hubJson({ ok: true, msg: "Approved — " + pfcName });
  }
  if (b.action === "deny") {
    if (u.status !== "pending") return hubJson({ error: "They are not waiting for approval any more." }, 409);
    const reason = String(b.reason ?? ""), note = String(b.note ?? "").trim().slice(0, 200);
    if (!DENY_REASONS.includes(reason)) return hubJson({ error: "Pick a reason." }, 400);
    await set({ status: "denied", deniedAt: nowISO, deniedBy: by, denyReason: reason, denyNote: note });
    await hubAudit(who, "ENLISTMENT DENIED", `${fullName(u)} — ${reason}${note ? " (" + note + ")" : ""} — via app`);
    if (b.post !== false) await webhook("denied", { title: "✕ Enlistment Denied", description: `**${fullName(u)}** was not approved.`, color: 0xff4d4d, fields: [{ name: "Denied by", value: by, inline: true }] });
    return hubJson({ ok: true, msg: "Denied — " + fullName(u) });
  }
  if (b.action === "reopen") {
    if (u.status !== "denied") return hubJson({ error: "Only denied sign-ups can be reopened." }, 409);
    await set({ status: "pending" });
    await hubAudit(who, "ENLISTMENT REOPENED", `${fullName(u)} moved back to BCT Approvals — via app`);
    return hubJson({ ok: true, msg: "Reopened — " + fullName(u) });
  }
  return hubJson({ error: "Unknown action." }, 400);
}
