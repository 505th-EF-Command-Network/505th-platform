import { TerminalDoc } from "@505th/db";
import { ACCESS, can, checkAccessEdit, effectiveAccess, hasTerminal, normaliseOverrides } from "@/lib/terminal/access";
import { assignableRoles } from "@/lib/terminal/fs-core";

/** Officer Management v2 (approved mock 2026-11-14) — shared by the website (/api/terminal/access) and the Hub (/api/hub/access). */
export type OmActor = { uid: string; role: string; access?: unknown; displayName: string };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function omGet(actor: OmActor) {
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
      until: (u.accessUntil && typeof u.accessUntil === "object" ? u.accessUntil : {}) as Record<string, string>,
      photo: [u.photoUrl, u.photoURL, u.discordAvatarUrl].find((x: unknown) => typeof x === "string" && x.startsWith("https://")) ?? null,
      lastSeen: u.lastSeen ?? u.lastLogin ?? null,
    }));
  const log = ((await TerminalDoc.find({ parent: "access_log" }, { docId: 1, data: 1 }).sort({ "data.atISO": -1 }).limit(150).lean()) as Record<string, any>[])
    .map((d) => ({ id: String(d.docId), ...(d.data ?? {}), prev: undefined }));
  return json({ me, items: ACCESS, members, assignable: assignableRoles(actor.role), log });
}

/** POST { changes: [{ uid, access }] } — per-person access overrides. All-or-nothing. */
export async function omPost(actor: OmActor, rawBody: unknown) {
  if (!can(actor.role, actor.access, "om")) return json({ error: "You don't have Officer Management access" }, 403);

  let changes: { uid: string; access: unknown; until?: Record<string, string> }[];
  let reason = "";
  let body: Record<string, any>;
  try {
    body = (rawBody ?? {}) as Record<string, any>;
    // UNDO one Change Log entry → put that person's access back to how it was before it.
    if (body.action === "undo") {
      const e = (await TerminalDoc.findById(`access_log/${String(body.id ?? "").replace(/[^\w]/g, "")}`, { data: 1 }).lean()) as Record<string, any> | null;
      if (!e || e.data?.undone) return json({ error: "Nothing to undo" }, 400);
      changes = [{ uid: e.data.targetUid, access: e.data.prev ?? {}, until: e.data.prevUntil ?? {} }];
      reason = `Undo: ${String(e.data.reason ?? "").slice(0, 100)}`;
      body.undoId = e._id;
    } else {
      changes = body.changes;
      reason = String(body.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (reason.length < 3) return json({ error: "Write a reason (it goes in the Change Log)." }, 400);
    }
    if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw new Error();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const assignable = assignableRoles(actor.role);
  const plan: { uid: string; next: Record<string, 0 | 1>; until: Record<string, string>; label: string; name: string; diff: string[]; prev: unknown; prevUntil: unknown }[] = [];
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
    // Time-limited access: only for keys this change GIVES (1), dates in the future, max 90 days.
    const until: Record<string, string> = {};
    for (const [k, v] of Object.entries((c.until ?? {}) as Record<string, string>)) {
      const t = Date.parse(String(v));
      if (next[k] === 1 && t > Date.now() && t < Date.now() + 91 * 864e5) until[k] = new Date(t).toISOString();
    }
    const name = [data.rank ? String(data.rank).split(" / ").pop() : "", data.callsign ? `"${data.callsign}"` : "", data.lastName ?? ""].filter(Boolean).join(" ") || uid;
    plan.push({ uid, next, until, name, diff: diff.map((x) => x + (until[ACCESS.find((a) => x.slice(1) === a.label)?.key ?? ""] ? ` until ${new Date(until[ACCESS.find((a) => x.slice(1) === a.label)!.key]!).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}` : "")),
      label: `${data.callsign || uid}: ${diff.join(", ") || "reset to role defaults"}`, prev: data.access ?? {}, prevUntil: data.accessUntil ?? {} });
  }

  const now = new Date();
  for (const p of plan) {
    await TerminalDoc.updateOne({ _id: `users/${p.uid}` }, { $set: { "data.access": p.next, "data.accessUntil": p.until, updateTime: now } });
    if (!p.diff.length) continue;
    // Change Log (with what it was before, for UNDO) + a 🔔 alert to the member.
    const lid = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
    await TerminalDoc.create({ _id: `access_log/${lid}`, parent: "access_log", docId: lid, createTime: now, updateTime: now,
      data: { atISO: now.toISOString(), byUid: actor.uid, byName: actor.displayName, targetUid: p.uid, targetName: p.name, changes: p.diff, reason, prev: p.prev, prevUntil: p.prevUntil, undone: false } });
    const nid = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
    await TerminalDoc.create({ _id: `notifications/${p.uid}/items/${nid}`, parent: `notifications/${p.uid}/items`, docId: nid, createTime: now, updateTime: now,
      data: { type: "access", read: false, title: "🔑 Your access changed", body: `${p.diff.join(", ")} — ${reason}`.slice(0, 280), createdAt: now } }).catch(() => {});
  }
  if (body.undoId) await TerminalDoc.updateOne({ _id: body.undoId }, { $set: { "data.undone": true, "data.undoneBy": actor.displayName, updateTime: now } });
  const id = `${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  await TerminalDoc.create({
    _id: `audit_logs/${id}`,
    parent: "audit_logs",
    docId: id,
    data: {
      section: "security",
      action: "ACCESS CHANGED",
      details: `${plan.map((p) => p.label).join(" · ")} — "${reason}"`.slice(0, 1500),
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
