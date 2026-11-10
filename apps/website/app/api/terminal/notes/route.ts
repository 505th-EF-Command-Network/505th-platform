import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";
import { GROUPS, audience, cleanShare, noteAccess, shareOf, toAlert, type NoteDoc } from "@/lib/terminal/notes-core";

export const dynamic = "force-dynamic";

/**
 * Notes with per-note sharing (the generic terminal data API refuses `notes`).
 *   GET                     → { notes, people, groups }   only notes you can open
 *   POST   { title, body }  → create (you are the owner, private until you share)
 *   PATCH  { id, title?, body?, share? } → save (edit needs CAN EDIT; share needs owner)
 *   DELETE ?id=             → owner only
 * People newly given access get a 🔔 alert (unless they turned "Notes shared" off).
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const MAX_TITLE = 120;
const MAX_BODY = 50_000;

type Actor = Awaited<ReturnType<typeof getActor>>;
async function actorOr(req?: NextRequest): Promise<Actor | Response> {
  if (req && req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  }
  try {
    return await getActor(); // any staff in the terminal: they only see notes shared with them
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
}

const autoId = () => {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(20), (b) => abc[b % 62]).join("");
};

type U = { uid: string; role: string; data: Record<string, any> };
const STAFF = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
/** Staff who can be picked or alerted: Recruiter, NCO, Staff NCO, Officer, Developer, Commander. */
async function noteUsers(): Promise<U[]> {
  const docs = await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean();
  return docs
    .map((d) => ({ uid: String(d.docId), role: String((d.data as any)?.role || ""), data: (d.data ?? {}) as Record<string, any> }))
    .filter((u) => STAFF.has(u.role) && !["pending", "denied"].includes(u.data.status) && u.data.suspended !== true);
}
/** Notes access for this person. Old notes (no sharing set) stay "Notes access holders only". */
const accessFor = (n: NoteDoc, a: Actor) => (!n.share && !can(a.role, a.access, "notes") ? null : noteAccess(n, a.uid, a.role));

const nameOf = (d: Record<string, any>) => {
  const rank = String(d.rank || "").split("/").pop()?.trim() || "";
  const cs = String(d.callsign || "").trim();
  const last = String(d.lastName || "").trim();
  const first = String(d.firstName || "").trim();
  return [rank, first ? first[0] + "." : "", cs && cs !== first ? `"${cs}"` : last].filter(Boolean).join(" ") || "Someone";
};

function view(id: string, n: NoteDoc, access: string, users: Map<string, U>) {
  const owner = users.get(String(n.createdBy || ""));
  return {
    id,
    title: String(n.title || ""),
    body: String(n.body || ""),
    owner: n.createdBy || null,
    ownerName: owner ? nameOf(owner.data) : String(n.createdByName || ""),
    access,
    share: access === "owner" ? shareOf(n) : undefined,
    shareSummary: summary(shareOf(n), users),
    updatedAtISO: n.updatedAtISO || null,
    updatedByName: n.updatedByName || null,
  };
}
function summary(s: ReturnType<typeof shareOf>, users: Map<string, U>) {
  if (s.mode === "private") return { mode: "private", people: [], groups: [] };
  return {
    mode: "shared",
    people: Object.entries(s.people).map(([uid, p]) => ({ uid, perm: p, name: users.get(uid) ? nameOf(users.get(uid)!.data) : "Former member" })),
    groups: Object.entries(s.groups).map(([g, p]) => ({ key: g, perm: p, label: GROUPS[g].label })),
  };
}

async function alertPeople(list: [string, string][], actor: Actor, noteId: string, title: string, users: Map<string, U>) {
  const now = new Date();
  const who = users.get(actor.uid) ? nameOf(users.get(actor.uid)!.data) : actor.displayName;
  const docs = list
    .filter(([uid]) => users.get(uid)?.data?.notifyPrefs?.notes?.bell !== false)
    .map(([uid, p]) => {
      const id = autoId();
      return {
        _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
        data: { type: "note", read: false, title: `${who} shared a note with you`, body: `"${title || "Untitled"}" · ${p === "edit" ? "CAN EDIT" : "CAN VIEW"}`, noteId, fromUid: actor.uid, createdAt: now },
      };
    });
  if (docs.length) await TerminalDoc.insertMany(docs, { ordered: false }).catch(() => {});
}

export async function GET() {
  const a = await actorOr();
  if (a instanceof Response) return a;
  const [docs, us] = await Promise.all([TerminalDoc.find({ parent: "notes" }).lean(), noteUsers()]);
  const users = new Map(us.map((u) => [u.uid, u]));
  const notes = docs
    .map((d) => ({ d, n: (d.data ?? {}) as NoteDoc }))
    .map(({ d, n }) => ({ d, n, acc: accessFor(n, a) }))
    .filter((x) => x.acc)
    .map(({ d, n, acc }) => view(String(d.docId), n, acc!, users))
    .sort((x, y) => String(y.updatedAtISO || "").localeCompare(String(x.updatedAtISO || "")));
  const people = us.filter((u) => u.uid !== a.uid).map((u) => ({ uid: u.uid, name: nameOf(u.data), role: u.role, photoUrl: u.data.photoUrl || u.data.discordAvatarUrl || null, callsign: u.data.callsign || "" }));
  return json({ me: a.uid, canCreate: can(a.role, a.access, "notes"), notes, people, groups: Object.entries(GROUPS).map(([key, g]) => ({ key, label: g.label })) });
}

export async function POST(req: NextRequest) {
  const a = await actorOr(req);
  if (a instanceof Response) return a;
  if (!can(a.role, a.access, "notes")) return json({ error: "You don't have access to create notes" }, 403);
  const b = await req.json().catch(() => ({}));
  const id = autoId();
  const now = new Date();
  const data = {
    title: String(b.title ?? "New note").slice(0, MAX_TITLE),
    body: String(b.body ?? "").slice(0, MAX_BODY),
    createdBy: a.uid,
    createdByName: a.displayName,
    createdAt: now,
    createdAtISO: now.toISOString(),
    updatedAtISO: now.toISOString(),
    updatedByName: a.displayName,
    share: { mode: "private", people: {}, groups: {} },
  };
  await TerminalDoc.create({ _id: `notes/${id}`, parent: "notes", docId: id, data, createTime: now, updateTime: now });
  return json({ id });
}

export async function PATCH(req: NextRequest) {
  const a = await actorOr(req);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "Bad note" }, 400);
  const d = await TerminalDoc.findById(`notes/${id}`).lean();
  if (!d) return json({ error: "Note not found" }, 404);
  const n = (d.data ?? {}) as NoteDoc;
  const acc = accessFor(n, a);
  if (!acc) return json({ error: "Note not found" }, 404); // don't reveal that it exists
  const set: Record<string, unknown> = {};
  if ("title" in b || "body" in b) {
    if (acc === "view") return json({ error: "This note is view only" }, 403);
    if ("title" in b) set["data.title"] = String(b.title ?? "").slice(0, MAX_TITLE);
    if ("body" in b) set["data.body"] = String(b.body ?? "").slice(0, MAX_BODY);
  }
  let alerts: [string, string][] = [];
  let users: Map<string, U> | null = null;
  if ("share" in b) {
    // Legacy notes without an owner: the first person to set sharing becomes the owner.
    if (acc !== "owner" && n.createdBy) return json({ error: "Only the owner can change sharing" }, 403);
    const owner = String(n.createdBy || a.uid);
    const next = cleanShare(b.share, owner);
    const us = await noteUsers();
    users = new Map(us.map((u) => [u.uid, u]));
    const plain = us.map((u) => ({ uid: u.uid, role: u.role }));
    alerts = toAlert(audience(shareOf(n), plain, owner), audience(next, plain, owner)).filter(([uid]) => uid !== a.uid);
    set["data.share"] = next;
    if (!n.createdBy) set["data.createdBy"] = owner;
  }
  if (!Object.keys(set).length) return json({ ok: true });
  const now = new Date();
  set["data.updatedAtISO"] = now.toISOString();
  set["data.updatedByName"] = a.displayName;
  set.updateTime = now;
  await TerminalDoc.updateOne({ _id: `notes/${id}` }, { $set: set });
  if (alerts.length && users) await alertPeople(alerts, a, id, String(set["data.title"] ?? n.title ?? ""), users);
  return json({ ok: true, alerted: alerts.length });
}

export async function DELETE(req: NextRequest) {
  const a = await actorOr(req);
  if (a instanceof Response) return a;
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "Bad note" }, 400);
  const d = await TerminalDoc.findById(`notes/${id}`).lean();
  if (!d) return json({ error: "Note not found" }, 404);
  const n = (d.data ?? {}) as NoteDoc;
  const acc = accessFor(n, a);
  if (!acc) return json({ error: "Note not found" }, 404);
  if (acc !== "owner" && !(acc === "edit" && !n.createdBy)) return json({ error: "Only the owner can delete this note" }, 403);
  await TerminalDoc.deleteOne({ _id: `notes/${id}` });
  return json({ ok: true });
}
