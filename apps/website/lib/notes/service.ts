import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { GROUPS, audience, cleanShare, noteAccess, shareOf, toAlert, type NoteDoc } from "@/lib/terminal/notes-core";
import { cleanHtml, htmlToText, plainToHtml } from "./html";

/**
 * Notes v2 (approved mock 2026-11-12) — one set of rules for the website terminal (/api/terminal/notes) and the Hub (/api/hub/notes).
 *   Shared fields (need CAN EDIT): title · body (rich text, cleaned) · colour · folder · tags
 *   Personal fields (anyone who can open it, just for them): board position · pin · archive · reminder
 *     → data.mine.<uid> = { x, y, pin, arch, rem: { atISO, repeat: none|daily|weekly, sentISO } }
 *   Sharing (owner only) — unchanged from v1, people newly given access get a 🔔 alert.
 * Reminders are sent by Cortana (notes-reminders.ts) as a 🔔 alert + Hub pop-up.
 */
export class NoteError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export type NoteWho = { uid: string; role: string; access: unknown; name: string };

const MAX_TITLE = 120, MAX_BODY = 60_000;
export const COLOURS = ["#00D9FF", "#c9a227", "#22e07a", "#ff4d4d", "#8b93f8", "#f472b6", "#4b5765"];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const STAFF = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
type U = { uid: string; role: string; data: Record<string, any> };
type Mine = { x?: number; y?: number; pin?: boolean; arch?: boolean; rem?: { atISO: string; repeat: string; sentISO?: string } | null };

async function staff(): Promise<U[]> {
  const docs = await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean();
  return docs.map((d) => ({ uid: String(d.docId), role: String((d.data as any)?.role || ""), data: (d.data ?? {}) as Record<string, any> }))
    .filter((u) => STAFF.has(u.role) && !["pending", "denied"].includes(u.data.status) && u.data.suspended !== true);
}
const accessFor = (n: NoteDoc, w: NoteWho) => (!n.share && !can(w.role, w.access, "notes") ? null : noteAccess(n, w.uid, w.role));
export const nameOf = (d: Record<string, any>) => {
  const rank = String(d.rank || "").split("/").pop()?.trim() || "";
  const cs = String(d.callsign || "").trim(), last = String(d.lastName || "").trim(), first = String(d.firstName || "").trim();
  return [rank, first ? first[0] + "." : "", cs && cs !== first ? `"${cs}"` : last].filter(Boolean).join(" ") || "Someone";
};
const cleanTags = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((t) => String(t).trim().replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24)).filter(Boolean).slice(0, 12);
const cleanColour = (v: unknown) => (COLOURS.includes(String(v)) ? String(v) : COLOURS[0]!);
const cleanFolder = (v: unknown) => String(v ?? "").trim().replace(/[<>]/g, "").slice(0, 40);
function cleanRem(v: unknown): Mine["rem"] {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>, at = Date.parse(String(r.atISO ?? ""));
  if (!at || at < Date.now() - 864e5 * 365 || at > Date.now() + 864e5 * 366 * 2) throw new NoteError("Pick a valid reminder date.");
  return { atISO: new Date(at).toISOString(), repeat: ["daily", "weekly"].includes(String(r.repeat)) ? String(r.repeat) : "none" };
}
const bodyOf = (n: NoteDoc) => (n.fmt === "html" ? String(n.body ?? "") : plainToHtml(n.body));

function summary(n: NoteDoc, users: Map<string, U>) {
  const s = shareOf(n);
  if (s.mode === "private") return { mode: "private", people: [], groups: [] };
  return {
    mode: "shared",
    people: Object.entries(s.people).map(([uid, p]) => ({ uid, perm: p, name: users.get(uid) ? nameOf(users.get(uid)!.data) : "Former member" })),
    groups: Object.entries(s.groups).map(([g, p]) => ({ key: g, perm: p, label: GROUPS[g]!.label })),
  };
}
function view(id: string, n: NoteDoc, access: string, w: NoteWho, users: Map<string, U>) {
  const owner = users.get(String(n.createdBy || ""));
  const mine = ((n.mine as Record<string, Mine> | undefined)?.[w.uid] ?? {}) as Mine;
  const body = bodyOf(n);
  return {
    id, title: String(n.title || ""), body, text: htmlToText(body).slice(0, 400),
    color: cleanColour(n.color), folder: String(n.folder || ""), tags: Array.isArray(n.tags) ? (n.tags as string[]) : [],
    owner: n.createdBy || null, ownerName: owner ? nameOf(owner.data) : String(n.createdByName || ""),
    access, share: access === "owner" ? shareOf(n) : undefined, shareSummary: summary(n, users),
    updatedAtISO: n.updatedAtISO || null, updatedByName: n.updatedByName || null,
    x: Number.isFinite(mine.x) ? mine.x : null, y: Number.isFinite(mine.y) ? mine.y : null,
    pin: !!mine.pin, arch: !!mine.arch, rem: mine.rem ?? null,
  };
}

export async function listNotes(w: NoteWho) {
  await connectDb();
  const [docs, us] = await Promise.all([TerminalDoc.find({ parent: "notes" }).lean(), staff()]);
  const users = new Map(us.map((u) => [u.uid, u]));
  const notes = docs.map((d) => ({ d, n: (d.data ?? {}) as NoteDoc })).map((x) => ({ ...x, acc: accessFor(x.n, w) })).filter((x) => x.acc)
    .map(({ d, n, acc }) => view(String(d.docId), n, acc!, w, users))
    .sort((a, b) => String(b.updatedAtISO || "").localeCompare(String(a.updatedAtISO || "")));
  const people = us.filter((u) => u.uid !== w.uid).map((u) => ({ uid: u.uid, name: nameOf(u.data), role: u.role, photoUrl: u.data.photoUrl || u.data.discordAvatarUrl || null, callsign: u.data.callsign || "" }));
  return { me: w.uid, canCreate: can(w.role, w.access, "notes"), notes, people, groups: Object.entries(GROUPS).map(([key, g]) => ({ key, label: g.label })), colours: COLOURS };
}

export async function createNote(w: NoteWho, b: Record<string, unknown>) {
  if (!can(w.role, w.access, "notes")) throw new NoteError("You don't have access to create notes", 403);
  await connectDb();
  const id = autoId(), now = new Date();
  const mine: Mine = {};
  if (Number.isFinite(Number(b.x))) mine.x = Math.max(0, Math.min(5000, Number(b.x)));
  if (Number.isFinite(Number(b.y))) mine.y = Math.max(0, Math.min(5000, Number(b.y)));
  if (b.rem) mine.rem = cleanRem(b.rem);
  const data = {
    title: String(b.title ?? "New note").slice(0, MAX_TITLE) || "New note", body: cleanHtml(b.body ?? "", MAX_BODY), fmt: "html",
    color: cleanColour(b.color), folder: cleanFolder(b.folder), tags: cleanTags(b.tags),
    createdBy: w.uid, createdByName: w.name, createdAt: now, createdAtISO: now.toISOString(), updatedAtISO: now.toISOString(), updatedByName: w.name,
    share: { mode: "private", people: {}, groups: {} }, mine: { [w.uid]: mine },
  };
  await TerminalDoc.create({ _id: `notes/${id}`, parent: "notes", docId: id, data, createTime: now, updateTime: now });
  return { ok: true, id };
}

async function alertPeople(list: [string, string][], w: NoteWho, noteId: string, title: string, users: Map<string, U>) {
  const now = new Date();
  const who = users.get(w.uid) ? nameOf(users.get(w.uid)!.data) : w.name;
  const docs = list.filter(([uid]) => users.get(uid)?.data?.notifyPrefs?.notes?.bell !== false).map(([uid, p]) => {
    const id = autoId();
    return { _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
      data: { type: "note", read: false, title: `${who} shared a note with you`, body: `"${title || "Untitled"}" · ${p === "edit" ? "CAN EDIT" : "CAN VIEW"}`, noteId, fromUid: w.uid, createdAt: now } };
  });
  if (docs.length) await TerminalDoc.insertMany(docs, { ordered: false }).catch(() => {});
}

export async function patchNote(w: NoteWho, b: Record<string, unknown>) {
  const id = String(b.id || "");
  if (!ID.test(id)) throw new NoteError("Bad note");
  await connectDb();
  const d = await TerminalDoc.findById(`notes/${id}`).lean();
  const n = (d?.data ?? {}) as NoteDoc;
  const acc = d ? accessFor(n, w) : null;
  if (!acc) throw new NoteError("Note not found", 404);
  const set: Record<string, unknown> = {}, unset: Record<string, 1> = {};
  const shared = ["title", "body", "color", "folder", "tags"].filter((k) => k in b);
  if (shared.length) {
    if (acc === "view") throw new NoteError("This note is view only", 403);
    if ("title" in b) set["data.title"] = String(b.title ?? "").slice(0, MAX_TITLE);
    if ("body" in b) { set["data.body"] = cleanHtml(b.body, MAX_BODY); set["data.fmt"] = "html"; }
    if ("color" in b) set["data.color"] = cleanColour(b.color);
    if ("folder" in b) set["data.folder"] = cleanFolder(b.folder);
    if ("tags" in b) set["data.tags"] = cleanTags(b.tags);
  }
  // Personal (just you): position, pin, archive, reminder.
  const mk = `data.mine.${w.uid}`;
  if ("x" in b || "y" in b) { set[`${mk}.x`] = Math.max(0, Math.min(5000, Number(b.x) || 0)); set[`${mk}.y`] = Math.max(0, Math.min(5000, Number(b.y) || 0)); }
  if ("pin" in b) set[`${mk}.pin`] = b.pin === true;
  if ("arch" in b) set[`${mk}.arch`] = b.arch === true;
  if ("rem" in b) { const r = cleanRem(b.rem); if (r) set[`${mk}.rem`] = r; else unset[`${mk}.rem`] = 1; }
  let alerts: [string, string][] = [];
  let users: Map<string, U> | null = null;
  if ("share" in b) {
    if (acc !== "owner" && n.createdBy) throw new NoteError("Only the owner can change sharing", 403);
    const owner = String(n.createdBy || w.uid), next = cleanShare(b.share, owner), us = await staff();
    users = new Map(us.map((u) => [u.uid, u]));
    const plain = us.map((u) => ({ uid: u.uid, role: u.role }));
    alerts = toAlert(audience(shareOf(n), plain, owner), audience(next, plain, owner)).filter(([uid]) => uid !== w.uid);
    set["data.share"] = next;
    if (!n.createdBy) set["data.createdBy"] = owner;
  }
  if (!Object.keys(set).length && !Object.keys(unset).length) return { ok: true };
  const now = new Date();
  if (shared.length || "share" in b) { set["data.updatedAtISO"] = now.toISOString(); set["data.updatedByName"] = w.name; }
  set.updateTime = now;
  await TerminalDoc.updateOne({ _id: `notes/${id}` }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  if (alerts.length && users) await alertPeople(alerts, w, id, String(set["data.title"] ?? n.title ?? ""), users);
  return { ok: true, alerted: alerts.length };
}

export async function deleteNote(w: NoteWho, id: string) {
  if (!ID.test(id)) throw new NoteError("Bad note");
  await connectDb();
  const d = await TerminalDoc.findById(`notes/${id}`).lean();
  const n = (d?.data ?? {}) as NoteDoc;
  const acc = d ? accessFor(n, w) : null;
  if (!acc) throw new NoteError("Note not found", 404);
  if (acc !== "owner" && !(acc === "edit" && !n.createdBy)) throw new NoteError("Only the owner can delete this note", 403);
  await TerminalDoc.deleteOne({ _id: `notes/${id}` });
  return { ok: true };
}
