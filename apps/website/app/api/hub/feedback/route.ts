import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/**
 * Settings v2 → About → Help. POST { kind: "idea" | "bug", text, level: "low"|"med"|"high", diag?, shot? }
 * Adds a task to the Project Tracker project called "Ideas" (ideas) or "Bug Reports" (problems).
 * Anyone with the Hub can send — the project's own owner/editors see and handle them.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const kind = b.kind === "bug" ? "bug" : "idea";
  const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (text.length < 5) return hubJson({ error: "Please write a little more." }, 400);
  const level = ["low", "med", "high"].includes(b.level) ? (b.level as "low" | "med" | "high") : "med";
  const diag = String(b.diag ?? "").slice(0, 300);
  const shot = typeof b.shot === "string" && /^https:\/\/res\.cloudinary\.com\/[\w./%-]+$/.test(b.shot) ? b.shot : "";
  const title = kind === "bug" ? "Bug Reports" : "Ideas";
  await connectDb();
  const d = (await TerminalDoc.findOne({ parent: "projects_v2", "data.title": title }, { docId: 1 }).lean()) as U | null;
  if (!d) return hubJson({ error: `No "${title}" project yet — ask a Developer to create one in Project Tracker.` }, 404);
  const now = new Date().toISOString();
  const task = { id: autoId(), title: `${text} — ${a.displayName}`.slice(0, 200), done: false, doneAtISO: null, assigneeUid: "", due: "", priority: level, parent: null, createdBy: a.uid };
  const push: U = { "data.tasks": task, "data.activity": { atISO: now, icon: kind === "bug" ? "🐞" : "💡", text: `${a.displayName} sent ${kind === "bug" ? "a problem" : "an idea"} from the Hub${diag ? ` (${diag})` : ""}` } };
  if (shot) push["data.images"] = { url: shot, name: `Screenshot — ${task.id}`, by: a.uid, atISO: now };
  await TerminalDoc.updateOne({ _id: `projects_v2/${d.docId}` }, { $push: push, $set: { "data.updatedAtISO": now, updateTime: new Date() } });
  await hubAudit({ uid: a.uid, name: a.displayName, role: a.role }, kind === "bug" ? "APP PROBLEM REPORTED" : "APP IDEA SENT", text.slice(0, 120));
  return hubJson({ ok: true, msg: kind === "bug" ? "Thanks — problem sent to Bug Reports" : "Thanks — idea sent to Ideas" });
}
