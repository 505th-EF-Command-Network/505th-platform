import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { ACCESS, can, checkAccessEdit, effectiveAccess, hasTerminal, normaliseOverrides } from "@/lib/terminal/access";
import { assignableRoles } from "@/lib/terminal/fs-core";
import { FsError, getActor } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function actorOr401() {
  try {
    return await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    throw json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

/**
 * GET → { me: { uid, role, access }, items, members? }
 * `members` (everyone Recruiter and above) is only sent to people with Officer Management.
 */
export async function GET() {
  let actor;
  try {
    actor = await actorOr401();
  } catch (r) {
    return r as Response;
  }
  const me = { uid: actor.uid, role: actor.role, access: effectiveAccess(actor.role, actor.access) };
  if (!me.access.om) return json({ me, items: ACCESS });

  const docs = await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean();
  const members = docs
    .map((d) => ({ uid: d.docId, ...(d.data as Record<string, any>) }) as Record<string, any>)
    .filter((u) => hasTerminal(u.role) && u.status !== "pending" && u.status !== "denied")
    .map((u) => ({
      uid: u.uid,
      role: u.role,
      callsign: u.callsign ?? "",
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      rank: u.rank ?? "",
      overrides: normaliseOverrides(u.role, u.access),
      lastSeen: u.lastSeen ?? u.lastLogin ?? null,
    }));
  return json({ me, items: ACCESS, members, assignable: assignableRoles(actor.role) });
}

/** POST { changes: [{ uid, access }] } — per-person access overrides. All-or-nothing. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  let actor;
  try {
    actor = await actorOr401();
  } catch (r) {
    return r as Response;
  }
  if (!can(actor.role, actor.access, "om")) return json({ error: "You don't have Officer Management access" }, 403);

  let changes: { uid: string; access: unknown }[];
  try {
    changes = (await req.json())?.changes;
    if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw new Error();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const assignable = assignableRoles(actor.role);
  const plan: { uid: string; next: Record<string, 0 | 1>; label: string }[] = [];
  for (const c of changes) {
    const uid = String(c?.uid ?? "");
    if (!/^[A-Za-z0-9_\-]{1,200}$/.test(uid)) return json({ error: "Bad member id" }, 400);
    const d = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
    if (!d) return json({ error: `Member not found: ${uid}` }, 404);
    const data = (d.data ?? {}) as Record<string, any>;
    const next = normaliseOverrides(data.role, c.access);
    const err = checkAccessEdit(
      { uid: actor.uid, role: actor.role, overrides: actor.access },
      { uid, role: data.role, overrides: data.access },
      next,
      assignable,
    );
    if (err) return json({ error: `${data.callsign || uid}: ${err}` }, 403);
    const diff = ACCESS.filter((a) => !a.locked && can(data.role, data.access, a.key) !== can(data.role, next, a.key))
      .map((a) => `${can(data.role, next, a.key) ? "+" : "−"}${a.label}`);
    plan.push({ uid, next, label: `${data.callsign || uid}: ${diff.join(", ") || "reset to role defaults"}` });
  }

  const now = new Date();
  for (const p of plan) {
    await TerminalDoc.updateOne({ _id: `users/${p.uid}` }, { $set: { "data.access": p.next, updateTime: now } });
  }
  const id = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await TerminalDoc.create({
    _id: `audit_logs/${id}`,
    parent: "audit_logs",
    docId: id,
    data: {
      section: "security",
      action: "ACCESS CHANGED",
      details: plan.map((p) => p.label).join(" · ").slice(0, 1500),
      uid: actor.uid,
      by: actor.displayName,
      role: actor.role,
      createdAt: now,
      createdAtISO: now.toISOString(),
    },
    createTime: now,
    updateTime: now,
  });
  return json({ ok: true, saved: plan.length });
}
