import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { EDIT_ROLES, MEDALS, memberName } from "@/lib/hub/members";
import { syncMember } from "@/lib/terminal/fs";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
/** Same list as the Terminal's Battalion Roster (battalion-roster.js RIBBONS). */
const RIBBONS = ["Training Ribbon", "Commendation Ribbon", "Ribbon C"];
const ukMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);
const str = (v: unknown, max = 400) => String(v ?? "").trim().slice(0, max);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : new Date().toISOString().slice(0, 10));
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

async function notify(uid: string, type: string, title: string, body: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now, data: { type, read: false, title, body, createdAt: now } }).catch(() => {});
}

/** GET /api/hub/roster → Battalion Roster (same rows + stats + reset banner data as the Terminal). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "roster")) return hubJson({ error: "You don't have Roster access." }, 403);
  const [docs, meta] = await Promise.all([
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.findById("settings/roster_meta", { data: 1 }).lean(),
  ]);
  const rows = docs
    .map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U)
    .filter((u) => u.status !== "pending" && u.status !== "denied" && u.role !== "retired_veteran")
    .map((u) => ({
      id: u.id, firstName: u.firstName || "", lastName: u.lastName || "", callsign: u.callsign || "", rank: u.rank || "", role: u.role || "",
      platoon: u.platoon || "", squad: u.squad || "", billet: u.billet || "", attendance: Number(u.attendance) || 0, promotionTracker: Number(u.promotionTracker) || 0,
      opsAttended: Number(u.opsAttended) || 0, opsEligible: Number(u.opsEligible) || 0,
      ribbons: (u.ribbonHistory || []).map((r: U) => String(r.title || "")), medals: (u.commendationHistory || []).length,
    }));
  const m = (meta?.data ?? {}) as U;
  return hubJson({
    rows, canEdit: EDIT_ROLES.has(a.role),
    meta: { month: ukMonth(), lastAttendanceReset: m.lastAttendanceReset || "", lastResetAt: m.lastResetAt || "", lastResetBy: m.lastResetBy || "", lastResetPromoted: m.lastResetPromoted ?? null, running: m.resetRunning ?? null },
    medals: MEDALS, ribbons: RIBBONS,
  });
}

/**
 * POST /api/hub/roster — same quick actions as the Terminal roster:
 * pip (+1 attendance, max 3) · pt (+1 PT; at 3/3 it also resets ATT) · award (bulk medal / ribbon).
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!EDIT_ROLES.has(a.role)) return hubJson({ error: "You do not have authority to edit the roster." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const nowISO = new Date().toISOString();

  if (b.action === "pip" || b.action === "pt") {
    const uid = String(b.id ?? "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) return hubJson({ error: "Invalid member." }, 400);
    const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
    if (!d) return hubJson({ error: "Member not found." }, 404);
    const u = (d.data ?? {}) as U, name = memberName(u);
    if (u.role === "retired_veteran") return hubJson({ error: "This file is retired and frozen." }, 403);
    const att = Number(u.attendance) || 0;
    // The app sends what it saw: stop double clicks / two staff clicking at once.
    if (Number(b.expectAtt) !== att) return hubJson({ error: "Someone else just changed this. Refreshed." }, 409);
    let msg: string;
    if (b.action === "pip") {
      if (att >= 3) return hubJson({ error: "Already 3/3." }, 400);
      await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.attendance": att + 1, "data.updatedAt": nowISO, updateTime: new Date() } });
      await hubAudit(who, "ATTENDANCE PIP", `Manual +1 pip for ${name} (now ${att + 1}/3) — via app`);
      msg = att + 1 >= 3 ? `${name} — 3/3 attendance — ready for PT` : `${name} — attendance ${att + 1}/3`;
    } else {
      const pt = (Number(u.promotionTracker) || 0) + 1;
      const set: U = { "data.promotionTracker": pt, "data.updatedAt": nowISO, updateTime: new Date() };
      if (att >= 3) set["data.attendance"] = 0;
      await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: set });
      await hubAudit(who, att >= 3 ? "PT AWARDED" : "PT AWARDED (MANUAL)", att >= 3 ? `+1 PT for ${name} (now ${pt} PT), attendance reset — via app` : `${name} → ${pt} PT (ATT ${att}/3) — via app`);
      msg = att >= 3 ? `${name} — PT +1 (now ${pt}) — attendance reset` : `+1 PT — ${name}`;
    }
    await syncMember(uid, false).catch(() => {});
    return hubJson({ ok: true, msg });
  }

  if (b.action === "award") {
    const kind = b.kind === "ribbon" ? "ribbon" : "medal";
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x: string) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 200);
    if (!ids.length) return hubJson({ error: "Pick at least one member." }, 400);
    const title = str(b.title, 80), note = str(b.note, 400), date = day(b.date);
    let img = "";
    if (kind === "medal") {
      img = str(b.img, 60);
      if (!MEDALS.some(([f]) => f === img)) return hubJson({ error: "Pick a medal." }, 400);
      if (!title) return hubJson({ error: "An award title is required." }, 400);
    } else if (!RIBBONS.includes(title)) return hubJson({ error: "Pick a ribbon." }, 400);
    const field = kind === "medal" ? "commendationHistory" : "ribbonHistory";
    let n = 0;
    for (const id of ids) {
      const d = await TerminalDoc.findById(`users/${id}`, { data: 1 }).lean();
      const u = (d?.data ?? null) as U | null;
      if (!u || u.role === "retired_veteran") continue;
      const entry: U = { date, note, title, addedBy: a.displayName, addedAt: nowISO, source: "hub" };
      if (kind === "medal") entry.medalImg = img;
      await TerminalDoc.updateOne({ _id: `users/${id}` }, { $push: { [`data.${field}`]: entry }, $set: { "data.updatedAt": nowISO, updateTime: new Date() } });
      if (b.notify !== false) await notify(id, "medal", kind === "medal" ? "You have been awarded a medal" : "You have been awarded a ribbon", title + (note ? " — " + note.slice(0, 80) : ""));
      await syncMember(id, false).catch(() => {});
      n++;
    }
    await hubAudit(who, kind === "medal" ? "MEDAL AWARDED (BULK)" : "RIBBON AWARDED (BULK)", `${title} awarded to ${n} member(s) — via app`);
    return hubJson({ ok: true, msg: `${kind === "medal" ? "★" : "▬"} ${title} awarded to ${n} member${n === 1 ? "" : "s"}` });
  }
  return hubJson({ error: "Unknown action." }, 400);
}
