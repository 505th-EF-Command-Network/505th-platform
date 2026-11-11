import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { memberName, photoOf } from "@/lib/hub/members";

/**
 * PROJECT TRACKER v2 (approved mock 2026-11-11) — shared by /api/hub/projects (app) and /api/terminal/projects (website).
 * One doc per project: projects_v2/<id>. Privacy: "private" (owner only) or "invite" (owner + accepted members).
 * Roles: owner (everything) · editor (tasks, images, comments) · viewer (read + comment).
 * Alerts (🔔 Hub + Terminal, no Discord DMs): invited, invite accepted/declined, task assigned, @tagged, task overdue.
 * The old Kanban `projects` collection is left untouched; its tasks are copied once into a project called "General".
 */
type U = Record<string, any>;
export type Who = { uid: string; name: string; role: string; access: unknown; source: "hub" | "terminal" };
export type Member = { uid: string; role: "editor" | "viewer"; status: "active" | "pending"; invitedBy: string; atISO: string; message?: string };
export type Task = { id: string; title: string; done: boolean; doneAtISO?: string | null; assigneeUid: string; due: string; priority: "high" | "med" | "low"; parent: string | null; overdueSent?: boolean; createdBy: string };
export type Project = {
  title: string; description: string; cover: string; category: string; priority: "high" | "med" | "low"; status: "planning" | "active" | "hold" | "done"; deadline: string;
  privacy: "private" | "invite"; ownerUid: string; members: Member[]; tasks: Task[]; images: { url: string; name: string; by: string; atISO: string }[];
  comments: { id: string; uid: string; text: string; atISO: string }[]; activity: { atISO: string; icon: string; text: string }[]; createdAtISO: string; updatedAtISO: string; migrated?: boolean;
};
export class ProjError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const P = "projects_v2";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = new Set(["planning", "active", "hold", "done"]);
const PRI = new Set(["high", "med", "low"]);
const CATS = ["Operations", "Training", "Mod", "Website", "Recruitment", "Admin", "Other"];
const IMG = /^https:\/\/res\.cloudinary\.com\/\S+$|^https:\/\/i\.ibb\.co\/\S+$/;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const nowISO = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function alert(uid: string, title: string, body: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now,
    data: { type: "project", read: false, title, body, createdAt: now } }).catch(() => {});
}
async function audit(w: Who, action: string, details: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "workspace", action, details, uid: w.uid, by: w.name, role: w.role, source: w.source, createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}

/** Who can see / change what. */
export function roleIn(p: Project, uid: string): "owner" | "editor" | "viewer" | "pending" | null {
  if (p.ownerUid === uid) return "owner";
  if (p.privacy === "private") return null;
  const m = p.members.find((x) => x.uid === uid);
  return !m ? null : m.status === "pending" ? "pending" : m.role;
}
const canEdit = (r: string | null) => r === "owner" || r === "editor";

async function people() {
  // Only the fields we need — full member records (all their history) made this slow.
  const F = ["firstName", "lastName", "callsign", "rank", "role", "access", "cmdGrant", "status", "suspended", "platoon", "photoUrl", "photoURL", "discordAvatarUrl"];
  const us = await TerminalDoc.find({ parent: "users" }, { docId: 1, ...Object.fromEntries(F.map((f) => [`data.${f}`, 1])) }).lean();
  return us.map((d) => ({ id: String(d.docId), ...(((d as U).data ?? {}) as U) }) as U)
    .filter((u) => u.status !== "pending" && u.status !== "denied" && u.suspended !== true && can(String(u.role ?? ""), u.access, "proj"));
}

/** Copy the old Kanban tasks into one "General" project, once. */
async function migrate(w: Who) {
  if (await TerminalDoc.exists({ parent: P })) return;
  const old = (await TerminalDoc.find({ parent: "projects" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U);
  if (!old.length) return;
  const uids = [...new Set(old.flatMap((t) => [t.assigneeUid, t.createdBy]).filter((x) => typeof x === "string" && x && x !== w.uid))] as string[];
  const p: Project = { title: "General", description: "Tasks from the old Project Tracker.", cover: "", category: "Other", priority: "med", status: "active", deadline: "", privacy: "invite",
    ownerUid: w.uid, members: uids.map((uid) => ({ uid, role: "editor", status: "active", invitedBy: w.uid, atISO: nowISO() })),
    tasks: old.map((t) => ({ id: t.id, title: str(t.title, 200) || "Task", done: t.status === "done", doneAtISO: t.status === "done" ? (t.doneAt || null) : null, assigneeUid: t.assigneeUid || "", due: DAY.test(t.due) ? t.due : "",
      priority: PRI.has(t.priority) ? t.priority : "med", parent: null, createdBy: t.createdBy || w.uid })),
    images: [], comments: [], activity: [{ atISO: nowISO(), icon: "📦", text: `${old.length} tasks moved from the old tracker` }], createdAtISO: nowISO(), updatedAtISO: nowISO(), migrated: true };
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `${P}/${id}`, parent: P, docId: id, createTime: now, updateTime: now, data: p });
}

/** GET: the projects you own, are in, or are invited to + the people you can invite. */
export async function listProjects(w: Who) {
  if (!can(w.role, w.access, "proj")) throw new ProjError("You don't have Projects access.", 403);
  await migrate(w);
  const [docs, ppl] = await Promise.all([
    TerminalDoc.find({ parent: P, $or: [{ "data.ownerUid": w.uid }, { "data.privacy": "invite", "data.members.uid": w.uid }] }, { docId: 1, data: 1, updateTime: 1 }).lean(),
    people(),
  ]);
  const t = today();
  const out = [];
  for (const d of docs) {
    const p = d.data as Project;
    // Overdue alerts, once per task (checked whenever someone opens Projects).
    const late = p.tasks.filter((x) => !x.done && x.due && x.due < t && !x.overdueSent && x.assigneeUid);
    if (late.length) {
      for (const x of late) await alert(x.assigneeUid, "⚠ Task overdue", `"${x.title}" in ${p.title} was due ${x.due}.`);
      await TerminalDoc.updateOne({ _id: `${P}/${d.docId}` }, { $set: Object.fromEntries(p.tasks.map((x, i) => [x, i] as const).filter(([x]) => late.includes(x)).map(([, i]) => [`data.tasks.${i}.overdueSent`, true])) });
    }
    out.push({ id: String(d.docId), ...p, myRole: roleIn(p, w.uid), version: (d as U).updateTime ? new Date((d as U).updateTime).toISOString() : "" });
  }
  out.sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO));
  return {
    me: w.uid, categories: CATS,
    projects: out,
    people: ppl.map((u) => ({ uid: u.id, name: memberName(u), platoon: u.platoon || "", photo: photoOf(u) })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Read-modify-write one project with an updateTime guard (retries once if two people saved at the same moment). */
async function change(id: string, fn: (p: Project) => Promise<string | void> | string | void) {
  if (!ID.test(id)) throw new ProjError("Bad request.");
  for (let i = 0; i < 3; i++) {
    const d = await TerminalDoc.findById(`${P}/${id}`, { data: 1, updateTime: 1 }).lean();
    if (!d) throw new ProjError("Project not found.", 404);
    const p = JSON.parse(JSON.stringify(d.data)) as Project;
    const msg = await fn(p);
    p.updatedAtISO = nowISO();
    p.activity = p.activity.slice(-60);
    const r = await TerminalDoc.updateOne({ _id: `${P}/${id}`, updateTime: (d as U).updateTime }, { $set: { data: p, updateTime: new Date() } });
    if (r.modifiedCount) return { p, msg: msg || "Saved" };
  }
  throw new ProjError("Someone else saved at the same time — try again.", 409);
}

function cleanTask(b: U, p: Project, memberOk: (uid: string) => boolean): Partial<Task> {
  const t: Partial<Task> = {};
  if ("title" in b) { t.title = str(b.title, 200); if (!t.title) throw new ProjError("Give the task a title."); }
  if ("assigneeUid" in b) { const a = str(b.assigneeUid, 64); if (a && !memberOk(a)) throw new ProjError("You can only assign people in the team."); t.assigneeUid = a; }
  if ("due" in b) { const v = str(b.due, 10); if (v && !DAY.test(v)) throw new ProjError("Bad due date."); t.due = v; t.overdueSent = false; }
  if ("priority" in b) { if (!PRI.has(b.priority)) throw new ProjError("Bad priority."); t.priority = b.priority; }
  if ("parent" in b) { const v = b.parent ? str(b.parent, 64) : null; if (v && !p.tasks.some((x) => x.id === v && !x.parent)) throw new ProjError("Bad parent task."); t.parent = v; }
  return t;
}

/** POST actions. Returns { ok, msg, id? }. */
export async function projectAction(w: Who, b: U) {
  if (!can(w.role, w.access, "proj")) throw new ProjError("You don't have Projects access.", 403);
  const action = String(b?.action ?? "");
  const ppl = new Map((await people()).map((u) => [u.id, u]));
  const nameOf = (uid: string) => (ppl.get(uid) ? memberName(ppl.get(uid)!) : "Someone");
  const act = (p: Project, icon: string, text: string) => p.activity.push({ atISO: nowISO(), icon, text });

  if (action === "create") {
    const title = str(b.title, 80);
    if (!title) throw new ProjError("Give the project a name.");
    const p: Project = { title, description: str(b.description, 5000), cover: IMG.test(String(b.cover ?? "")) ? String(b.cover) : "", category: CATS.includes(b.category) ? b.category : "Other",
      priority: PRI.has(b.priority) ? b.priority : "med", status: STATUS.has(b.status) ? b.status : "planning", deadline: DAY.test(String(b.deadline ?? "")) ? String(b.deadline) : "",
      privacy: b.privacy === "private" ? "private" : "invite", ownerUid: w.uid, members: [], tasks: [], images: [], comments: [],
      activity: [{ atISO: nowISO(), icon: "✦", text: `${w.name} created the project` }], createdAtISO: nowISO(), updatedAtISO: nowISO() };
    const id = autoId(), now = new Date();
    await TerminalDoc.create({ _id: `${P}/${id}`, parent: P, docId: id, createTime: now, updateTime: now, data: p });
    await audit(w, "PROJECT CREATED", `${title} — via ${w.source}`);
    return { ok: true, id, msg: "Project created" };
  }

  const id = String(b.id ?? "");
  let after: (() => Promise<void>) | null = null;
  const res = await change(id, async (p) => {
    const r = roleIn(p, w.uid);
    if (!r) throw new ProjError("Project not found.", 404);
    const owner = r === "owner";
    const memberOk = (uid: string) => uid === p.ownerUid || p.members.some((m) => m.uid === uid && m.status === "active");
    const need = (ok: boolean, m = "Only the owner can do that.") => { if (!ok) throw new ProjError(m, 403); };
    const task = (tid: unknown) => { const t = p.tasks.find((x) => x.id === tid); if (!t) throw new ProjError("Task not found.", 404); return t; };

    switch (action) {
      case "respond": {
        need(r === "pending", "No invite to answer.");
        const m = p.members.find((x) => x.uid === w.uid)!;
        if (b.accept === true) { m.status = "active"; act(p, "👥", `${w.name} joined the team`); }
        else { p.members = p.members.filter((x) => x.uid !== w.uid); act(p, "✕", `${w.name} declined the invite`); }
        after = () => alert(p.ownerUid, b.accept === true ? "✓ Invite accepted" : "✕ Invite declined", `${w.name} ${b.accept === true ? "joined" : "declined"} ${p.title}.`);
        return b.accept === true ? "You joined the project" : "Invite declined";
      }
      case "update": {
        need(owner);
        if ("title" in b) { const t = str(b.title, 80); if (!t) throw new ProjError("Give the project a name."); p.title = t; }
        if ("description" in b) p.description = str(b.description, 5000);
        if ("cover" in b) { const c = String(b.cover ?? ""); if (c && !IMG.test(c)) throw new ProjError("Upload the cover image first."); p.cover = c; }
        if ("category" in b && CATS.includes(b.category)) p.category = b.category;
        if ("priority" in b && PRI.has(b.priority)) p.priority = b.priority;
        if ("status" in b && STATUS.has(b.status)) { if (p.status !== b.status) act(p, "◆", `${w.name} set status to ${String(b.status).toUpperCase()}`); p.status = b.status; }
        if ("deadline" in b) { const v = str(b.deadline, 10); if (v && !DAY.test(v)) throw new ProjError("Bad deadline."); p.deadline = v; }
        if ("privacy" in b) { p.privacy = b.privacy === "private" ? "private" : "invite"; }
        return "Project saved";
      }
      case "invite": {
        need(owner);
        const list = (Array.isArray(b.invites) ? b.invites : []).slice(0, 20) as U[];
        if (!list.length) throw new ProjError("Pick someone to invite.");
        if (p.privacy === "private") p.privacy = "invite";
        const sent: string[] = [];
        for (const x of list) {
          const uid = str(x.uid, 64);
          if (!ppl.has(uid) || uid === p.ownerUid || p.members.some((m) => m.uid === uid)) continue;
          p.members.push({ uid, role: x.role === "viewer" ? "viewer" : "editor", status: "pending", invitedBy: w.uid, atISO: nowISO(), message: str(b.message, 300) || undefined });
          sent.push(uid);
        }
        if (!sent.length) throw new ProjError("They're already in the team.");
        act(p, "👥", `${w.name} invited ${sent.map(nameOf).join(", ")}`);
        const msg = str(b.message, 300);
        after = async () => { for (const uid of sent) await alert(uid, "👥 Project invite", `${w.name} invited you to ${p.title}.${msg ? ` “${msg}”` : ""} Open Projects to accept.`); };
        return `${sent.length} invite${sent.length === 1 ? "" : "s"} sent`;
      }
      case "member": {
        need(owner);
        const m = p.members.find((x) => x.uid === b.uid);
        if (!m) throw new ProjError("Not in the team.", 404);
        if (b.remove === true) {
          p.members = p.members.filter((x) => x.uid !== m.uid);
          p.tasks.forEach((t) => { if (t.assigneeUid === m.uid) t.assigneeUid = ""; });
          act(p, "➖", `${w.name} removed ${nameOf(m.uid)}`);
          return "Removed from the team";
        }
        m.role = b.role === "viewer" ? "viewer" : "editor";
        return "Role changed";
      }
      case "transfer": {
        need(owner);
        const m = p.members.find((x) => x.uid === b.uid && x.status === "active");
        if (!m) throw new ProjError("Pick an active team member.");
        p.members = p.members.filter((x) => x.uid !== m.uid);
        p.members.push({ uid: p.ownerUid, role: "editor", status: "active", invitedBy: m.uid, atISO: nowISO() });
        p.ownerUid = m.uid;
        act(p, "★", `${w.name} handed ownership to ${nameOf(m.uid)}`);
        after = () => alert(m.uid, "★ You own a project now", `${w.name} handed ${p.title} to you.`);
        return "Ownership handed over";
      }
      case "leave": {
        need(!owner && r !== "pending", "The owner can't leave — hand it over first.");
        p.members = p.members.filter((x) => x.uid !== w.uid);
        p.tasks.forEach((t) => { if (t.assigneeUid === w.uid) t.assigneeUid = ""; });
        act(p, "➖", `${w.name} left the team`);
        return "You left the project";
      }
      case "task.add": {
        need(canEdit(r), "Viewers can't add tasks.");
        if (p.tasks.length >= 300) throw new ProjError("This project has 300 tasks — that's the limit.");
        const t = cleanTask({ priority: "med", ...b, title: b.title ?? "" }, p, memberOk);
        const nt: Task = { id: autoId(), title: t.title!, done: false, doneAtISO: null, assigneeUid: t.assigneeUid ?? "", due: t.due ?? "", priority: t.priority ?? "med", parent: t.parent ?? null, createdBy: w.uid };
        p.tasks.push(nt);
        act(p, "＋", `${w.name} added "${nt.title}"`);
        if (nt.assigneeUid && nt.assigneeUid !== w.uid) after = () => alert(nt.assigneeUid, "☑ Task for you", `${w.name} gave you "${nt.title}" in ${p.title}${nt.due ? ` — due ${nt.due}` : ""}.`);
        return "Task added";
      }
      case "task.update": {
        need(canEdit(r), "Viewers can't change tasks.");
        const t = task(b.taskId);
        const before = t.assigneeUid;
        Object.assign(t, cleanTask(b.patch ?? {}, p, memberOk));
        if (typeof b.patch?.done === "boolean" && b.patch.done !== t.done) {
          t.done = b.patch.done; t.doneAtISO = t.done ? nowISO() : null;
          if (t.done) { p.tasks.filter((x) => x.parent === t.id).forEach((x) => { x.done = true; x.doneAtISO ||= nowISO(); }); }
          act(p, t.done ? "✓" : "↺", `${w.name} ${t.done ? "finished" : "reopened"} "${t.title}"`);
        }
        if (t.assigneeUid && t.assigneeUid !== before && t.assigneeUid !== w.uid) after = () => alert(t.assigneeUid, "☑ Task for you", `${w.name} gave you "${t.title}" in ${p.title}${t.due ? ` — due ${t.due}` : ""}.`);
        return "Task saved";
      }
      case "task.delete": {
        need(canEdit(r), "Viewers can't delete tasks.");
        const t = task(b.taskId);
        p.tasks = p.tasks.filter((x) => x.id !== t.id && x.parent !== t.id);
        act(p, "🗑", `${w.name} deleted "${t.title}"`);
        return "Task deleted";
      }
      case "task.reorder": {
        need(canEdit(r), "Viewers can't reorder.");
        const order = (Array.isArray(b.order) ? b.order : []).map(String);
        const pos = new Map(order.map((x, i) => [x, i]));
        p.tasks.sort((a, c) => (pos.get(a.id) ?? 1e9) - (pos.get(c.id) ?? 1e9));
        return "Order saved";
      }
      case "image.add": {
        need(canEdit(r), "Viewers can't add images.");
        const urls = (Array.isArray(b.urls) ? b.urls : [b.url]).map(String).filter((u) => IMG.test(u)).slice(0, 20);
        if (!urls.length) throw new ProjError("Upload the image first.");
        if (p.images.length + urls.length > 60) throw new ProjError("60 images is the limit for one project.");
        for (const u of urls) p.images.push({ url: u, name: str(b.name, 120), by: w.uid, atISO: nowISO() });
        if (!p.cover) p.cover = urls[0]!;
        act(p, "🖼", `${w.name} added ${urls.length} image${urls.length === 1 ? "" : "s"}`);
        return "Images added";
      }
      case "image.remove": {
        need(canEdit(r), "Viewers can't remove images.");
        p.images = p.images.filter((x) => x.url !== b.url);
        if (p.cover === b.url) p.cover = p.images[0]?.url ?? "";
        return "Image removed";
      }
      case "comment": {
        need(r !== "pending", "Accept the invite first.");
        const text = str(b.text, 2000);
        if (!text) throw new ProjError("Write something first.");
        p.comments.push({ id: autoId(), uid: w.uid, text, atISO: nowISO() });
        p.comments = p.comments.slice(-200);
        const tagged = [...new Set((Array.isArray(b.mentions) ? b.mentions : []).map(String))].filter((u) => u !== w.uid && memberOk(u)).slice(0, 20);
        if (tagged.length) after = async () => { for (const u of tagged) await alert(u, "💬 You were tagged", `${w.name} in ${p.title}: “${text.slice(0, 120)}”`); };
        return "Comment posted";
      }
      case "comment.delete": {
        const c = p.comments.find((x) => x.id === b.commentId);
        if (!c) throw new ProjError("Comment not found.", 404);
        need(owner || c.uid === w.uid, "You can only delete your own comments.");
        p.comments = p.comments.filter((x) => x.id !== c.id);
        return "Comment deleted";
      }
      default: throw new ProjError("Unknown action.");
    }
  });
  if (after) await (after as () => Promise<void>)();
  return { ok: true, msg: res.msg };
}

/** Delete — owner only. */
export async function deleteProject(w: Who, id: string) {
  if (!ID.test(id)) throw new ProjError("Bad request.");
  const d = await TerminalDoc.findById(`${P}/${id}`, { data: 1 }).lean();
  const p = d?.data as Project | undefined;
  if (!p || roleIn(p, w.uid) === null) throw new ProjError("Project not found.", 404);
  if (p.ownerUid !== w.uid) throw new ProjError("Only the owner can delete the project.", 403);
  await TerminalDoc.deleteOne({ _id: `${P}/${id}` });
  await audit(w, "PROJECT DELETED", `${p.title} — via ${w.source}`);
  return { ok: true, msg: "Project deleted" };
}
