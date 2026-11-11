import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { GRANTABLE, activeGrant, hasTerminal } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";

/**
 * COMMAND ACCESS (approved mock 2026-11-11) — Commander lends Command Centre parts to members.
 * GET  → { grants: [{ uid, name, role, keys, untilISO, by, reason, atISO, active }], members: [{ uid, name, role }] }
 * POST { uid, keys: [...] | "full", untilISO?, reason } → give / change
 * POST { uid, remove: true }                           → take away
 * Only Commander (and Developer, for support). Nobody can give themselves access; Commander role is never a target.
 */
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const OWNERS = new Set(["commander", "developer"]);
const nameOf = (d: Record<string, any>) => String(d.callsign || [d.firstName, d.lastName].filter(Boolean).join(" ") || "Member");
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

async function owner() {
  try {
    const a = await getActor();
    return OWNERS.has(a.role) ? a : json({ error: "Only the Commander can manage Command Access" }, 403);
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

export async function GET() {
  const a = await owner();
  if (a instanceof Response) return a;
  const docs = (await TerminalDoc.find({ parent: "users" }, { docId: 1, "data.callsign": 1, "data.firstName": 1, "data.lastName": 1, "data.role": 1, "data.status": 1, "data.cmdGrant": 1 }).lean()) as { docId: string; data?: Record<string, any> }[];
  const all = docs.map((d) => ({ uid: d.docId, d: d.data ?? {} }));
  const grants = all.filter((x) => Array.isArray(x.d.cmdGrant?.keys) && x.d.cmdGrant.keys.length).map((x) => ({
    uid: x.uid, name: nameOf(x.d), role: x.d.role ?? "", keys: x.d.cmdGrant.keys, untilISO: x.d.cmdGrant.untilISO ?? null,
    by: x.d.cmdGrant.by ?? "", reason: x.d.cmdGrant.reason ?? "", atISO: x.d.cmdGrant.atISO ?? null, active: activeGrant(x.d.cmdGrant).length > 0,
  }));
  const members = all.filter((x) => hasTerminal(x.d.role) && !["commander", "developer"].includes(x.d.role) && !["pending", "denied"].includes(x.d.status) && x.uid !== a.uid)
    .map((x) => ({ uid: x.uid, name: nameOf(x.d), role: x.d.role ?? "" })).sort((p, q) => p.name.localeCompare(q.name));
  return json({ grants, members, grantable: GRANTABLE });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const a = await owner();
  if (a instanceof Response) return a;
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const uid = String(b?.uid ?? "");
  if (!/^[A-Za-z0-9_\-]{1,128}$/.test(uid)) return json({ error: "Pick a member" }, 400);
  if (uid === a.uid) return json({ error: "You can't give yourself Command Access" }, 403);
  const t = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
  if (!t) return json({ error: "Member not found" }, 404);
  if (["commander", "developer"].includes(t.role)) return json({ error: "Commander and Developers already have full access" }, 400);
  if (!hasTerminal(t.role)) return json({ error: "Only Recruiter and above can be given Command Access" }, 400);
  const now = new Date();
  const log = async (action: string, details: string) => {
    const id = autoId();
    await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
      data: { section: "security", action, details, uid: a.uid, by: a.displayName, role: a.role, createdAt: now, createdAtISO: now.toISOString() } });
  };
  const notifyT = async (title: string, body: string) => {
    const id = autoId();
    await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
      data: { type: "access", read: false, title, body, createdAt: now } }).catch(() => {});
  };

  if (b.remove === true) {
    await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $unset: { "data.cmdGrant": "" }, $set: { updateTime: now } });
    await log("COMMAND ACCESS REMOVED", `${nameOf(t)} — Command Centre access removed`);
    await notifyT("Command Centre access removed", `By ${a.displayName}`);
    return json({ ok: true });
  }

  const keys: string[] = b.keys === "full" ? [...GRANTABLE] : Array.isArray(b.keys) ? [...new Set(b.keys.map(String))].filter((k) => (GRANTABLE as readonly string[]).includes(k)) : [];
  if (!keys.length) return json({ error: "Tick at least one part" }, 400);
  const reason = String(b.reason ?? "").trim().slice(0, 200);
  if (reason.length < 3) return json({ error: "Give a reason (3+ characters)" }, 400);
  let untilISO: string | null = null;
  if (b.untilISO) {
    const u = Date.parse(String(b.untilISO));
    if (!Number.isFinite(u) || u <= Date.now() || u > Date.now() + 366 * 864e5) return json({ error: "End date must be in the next 12 months" }, 400);
    untilISO = new Date(u).toISOString();
  }
  const grant = { keys, untilISO, by: a.displayName, byUid: a.uid, reason, atISO: now.toISOString() };
  await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: { "data.cmdGrant": grant, updateTime: now } });
  const what = keys.length === GRANTABLE.length ? "FULL" : keys.join(", ");
  const until = untilISO ? new Date(untilISO).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }) : "no end";
  await log("COMMAND ACCESS GIVEN", `${nameOf(t)} — ${what} · until ${until} — "${reason}"`);
  await notifyT("You have Command Centre access", `${keys.length === GRANTABLE.length ? "Full access" : "Some Command pages"} · until ${until} · ${reason}`);
  return json({ ok: true, grant });
}
