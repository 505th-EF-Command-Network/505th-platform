import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { ACCESS, EDITABLE_ROLES, builtInDefault, can, cleanRoleDefaults, getRoleDefaults, hasTerminal, setRoleDefaults } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";
import { loadRoleDefaults } from "@/lib/terminal/role-defaults";

/**
 * Officer Management → ROLE ACCESS (approved mock 2026-11-11).
 * GET  → { canEdit, items, roles: [{ key, count }], builtIn: {role: {key: bool}}, current: {role: {key: 0|1}} }
 * POST { roles: {role: {key: 0|1}} } → Developers / Command only ("set"). Saved to settings/role_access + audit log.
 */
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function actorOr() {
  try {
    return { actor: await getActor() };
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return { res: json({ error: code }, code === "unauthenticated" ? 401 : 403) };
  }
}

export async function GET() {
  const { actor, res } = await actorOr();
  if (!actor) return res!;
  if (!can(actor.role, actor.access, "om") && !can(actor.role, actor.access, "set")) return json({ error: "You don't have Officer Management access" }, 403);
  await loadRoleDefaults(true);
  const users = await TerminalDoc.find({ parent: "users" }, { data: 1 }).lean();
  const count: Record<string, number> = {};
  for (const u of users) {
    const d = (u.data ?? {}) as Record<string, unknown>;
    const r = String(d.role ?? "");
    if (hasTerminal(r) && d.status !== "pending" && d.status !== "denied" && d.suspended !== true) count[r] = (count[r] ?? 0) + 1;
  }
  const builtIn = Object.fromEntries([...EDITABLE_ROLES, "commander"].map((r) => [r, Object.fromEntries(ACCESS.map((a) => [a.key, r === "commander" || builtInDefault(r, a.key)]))]));
  return json({
    canEdit: can(actor.role, actor.access, "set"),
    items: ACCESS,
    roles: [...EDITABLE_ROLES, "commander"].map((key) => ({ key, count: count[key] ?? 0 })),
    builtIn,
    current: getRoleDefaults(),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const { actor, res } = await actorOr();
  if (!actor) return res!;
  if (!can(actor.role, actor.access, "set")) return json({ error: "Only Developers / Command can change role access" }, 403);
  let raw: unknown;
  try {
    raw = (await req.json())?.roles;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  await loadRoleDefaults(true);
  const before = getRoleDefaults();
  const next = cleanRoleDefaults(raw);

  // Human-readable diff for the audit log: "+NCO → Personnel Files", "−STAFF_NCO → Kick / Ban".
  const eff = (m: Record<string, Record<string, 0 | 1>>, r: string, k: string) => (m[r] && k in m[r] ? m[r][k] === 1 : builtInDefault(r, k));
  const diff: string[] = [];
  for (const r of EDITABLE_ROLES) for (const a of ACCESS) {
    if (a.locked) continue;
    const was = eff(before, r, a.key), will = eff(next, r, a.key);
    if (was !== will) diff.push(`${will ? "+" : "−"}${r.toUpperCase()} → ${a.label}`);
  }
  if (!diff.length) return json({ ok: true, changed: 0 });

  const now = new Date();
  await TerminalDoc.updateOne(
    { _id: "settings/role_access" },
    { $set: { parent: "settings", docId: "role_access", updateTime: now, data: { roles: next, updatedBy: actor.displayName, updatedAtISO: now.toISOString() } }, $setOnInsert: { createTime: now } },
    { upsert: true },
  );
  setRoleDefaults(next);
  const id = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await TerminalDoc.create({
    _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "security", action: "ROLE ACCESS CHANGED", details: diff.join(" · ").slice(0, 1500), uid: actor.uid, by: actor.displayName, role: actor.role, createdAt: now, createdAtISO: now.toISOString() },
  });
  return json({ ok: true, changed: diff.length });
}
