import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { GRANTABLE, activeGrant, hasTerminal } from "@/lib/terminal/access";

/**
 * HIGH COMMAND MANAGEMENT (was Command Access; approved mock 18 Nov) — the Commander lends Command Centre pages to members, optionally until a date.
 * Shared by the website (/api/terminal/cmd-access) and the Hub (/api/hub/cmd-access).
 * Stored on users/{uid}.cmdGrant = { keys, untilISO, by, byUid, reason, atISO }. Cortana warns 24 h before the end and removes it after (access-expiry.ts).
 * Only Commander / Developer. Nobody can give themselves access; Commander and Developer are never targets.
 */
type U = Record<string, any>;
export type CaActor = { uid: string; role: string; displayName: string; source: "terminal" | "hub" };
export class CaError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const OWNERS = new Set(["commander", "developer"]);
const nameOf = (d: U) => String(d.callsign || [d.firstName, d.lastName].filter(Boolean).join(" ") || "Member");
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const owner = (a: CaActor) => { if (!OWNERS.has(a.role)) throw new CaError("Only the Commander can manage Command Centre access", 403); };

export async function caList(a: CaActor) {
  owner(a);
  const docs = (await TerminalDoc.find({ parent: "users" }, { docId: 1, "data.callsign": 1, "data.firstName": 1, "data.lastName": 1, "data.rank": 1, "data.role": 1, "data.status": 1, "data.cmdGrant": 1 }).lean()) as { docId: string; data?: U }[];
  const all = docs.map((d) => ({ uid: d.docId, d: d.data ?? {} }));
  const grants = all.filter((x) => Array.isArray(x.d.cmdGrant?.keys) && x.d.cmdGrant.keys.length).map((x) => ({
    uid: x.uid, name: nameOf(x.d), role: x.d.role ?? "", keys: x.d.cmdGrant.keys as string[], untilISO: x.d.cmdGrant.untilISO ?? null,
    by: x.d.cmdGrant.by ?? "", reason: x.d.cmdGrant.reason ?? "", atISO: x.d.cmdGrant.atISO ?? null, active: activeGrant(x.d.cmdGrant).length > 0,
  }));
  const always = all.filter((x) => OWNERS.has(x.d.role) && !["pending", "denied"].includes(x.d.status)).map((x) => ({ uid: x.uid, name: nameOf(x.d), role: x.d.role as string }));
  const members = all.filter((x) => hasTerminal(x.d.role) && !OWNERS.has(x.d.role) && !["pending", "denied"].includes(x.d.status) && x.uid !== a.uid)
    .map((x) => ({ uid: x.uid, name: nameOf(x.d), role: x.d.role ?? "" })).sort((p, q) => p.name.localeCompare(q.name));
  return { grants, always, members, grantable: GRANTABLE };
}

export async function caSave(a: CaActor, b: U) {
  owner(a);
  const uid = String(b?.uid ?? "");
  if (!/^[A-Za-z0-9_\-]{1,128}$/.test(uid)) throw new CaError("Pick a member");
  if (uid === a.uid) throw new CaError("You can't give yourself Command Centre access", 403);
  const t = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as U | undefined;
  if (!t) throw new CaError("Member not found", 404);
  if (OWNERS.has(t.role)) throw new CaError("Commander and Developers already have full access");
  if (!hasTerminal(t.role)) throw new CaError("Only Recruiter and above can be given Command Centre access");
  const now = new Date(), tell = b.notify !== false;
  const log = async (action: string, details: string) => {
    const id = autoId();
    await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
      data: { section: "security", action, details, uid: a.uid, by: a.displayName, role: a.role, source: a.source, createdAt: now, createdAtISO: now.toISOString() } });
  };
  const notifyT = async (title: string, body: string) => {
    if (!tell) return;
    const id = autoId();
    await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
      data: { type: "access", read: false, title, body, createdAt: now } }).catch(() => {});
  };

  if (b.remove === true) {
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $unset: { "data.cmdGrant": "" }, $set: { updateTime: now } });
    await log("COMMAND ACCESS REMOVED", `${nameOf(t)} — Command Centre access removed`);
    await notifyT("Command Centre access removed", `By ${a.displayName}`);
    return { ok: true, msg: "Access removed" };
  }

  const keys: string[] = b.keys === "full" ? [...GRANTABLE] : Array.isArray(b.keys) ? [...new Set((b.keys as unknown[]).map(String))].filter((k) => (GRANTABLE as readonly string[]).includes(k)) : [];
  if (!keys.length) throw new CaError("Tick at least one page");
  const reason = String(b.reason ?? "").trim().slice(0, 200);
  if (reason.length < 3) throw new CaError("Give a reason (3+ characters)");
  let untilISO: string | null = null;
  if (b.untilISO) {
    const u = Date.parse(String(b.untilISO));
    if (!Number.isFinite(u) || u <= Date.now() || u > Date.now() + 366 * 864e5) throw new CaError("End date must be in the next 12 months");
    untilISO = new Date(u).toISOString();
  }
  const grant = { keys, untilISO, by: a.displayName, byUid: a.uid, reason, atISO: now.toISOString() };
  await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.cmdGrant": grant, updateTime: now } });
  const what = keys.length === GRANTABLE.length ? "FULL" : keys.join(", ");
  const until = untilISO ? new Date(untilISO).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }) : "no end";
  await log("COMMAND ACCESS GIVEN", `${nameOf(t)} — ${what} · until ${until} — "${reason}"`);
  await notifyT("You have Command Centre access", `${keys.length === GRANTABLE.length ? "Full access" : "Some Command pages"} · until ${until} · ${reason}`);
  return { ok: true, grant, msg: "Access saved" };
}
