import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { CtlError, act, status } from "@/lib/cortana/control";

export const dynamic = "force-dynamic";
/**
 * COMMAND CENTRE → BOT SERVER in the app (approved mock 18 Nov). Access "bot".
 * GET → Cortana status (same as the website Cortana Control) + CPU / memory + last logs and errors.
 * POST { action: "restart"|"update"|"shutdown"|"pcrestart"|"pcshutdown"|"pccancel", password, reason, details, confirm } → lib/cortana/control (Control Password, Commander / Developer)
 * POST { action: "clear", which: "logs"|"errors" } → empties the list (Cortana empties its copy too).
 */
type U = Record<string, any>;
const id20 = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
async function who(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "bot")) return hubJson({ error: "You don't have access to this page." }, 403);
  return { uid: a.uid, role: a.role, discordId: a.discordId, name: a.displayName || "Staff" };
}
const fail = (e: unknown) => (e instanceof CtlError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));

export async function GET(req: Request) {
  const w = await who(req); if (w instanceof Response) return w;
  try {
    const [st, bot, logs] = await Promise.all([status(w), TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean(), TerminalDoc.findById("bot_status/logs", { data: 1 }).lean()]);
    const b = (bot?.data ?? {}) as U, l = (logs?.data ?? {}) as U;
    return hubJson({ ...st, cpu: typeof b.cpuPercent === "number" ? b.cpuPercent : null, memoryMb: typeof b.memoryMb === "number" ? b.memoryMb : null, pingMs: typeof b.pingMs === "number" ? b.pingMs : null,
      logs: Array.isArray(l.lines) ? l.lines.slice(-300) : [], errors: Array.isArray(l.errors) ? l.errors.slice(-100) : [], logsSavedAtISO: l.savedAtISO ?? "" });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const w = await who(req); if (w instanceof Response) return w;
  const b = (await req.json().catch(() => null)) as U | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try {
    if (b.action === "clear") {
      if (w.role !== "commander" && w.role !== "developer") return hubJson({ error: "Only the Commander or Developer can clear logs." }, 403);
      const which = b.which === "errors" ? "errors" : "logs", now = new Date(), jid = id20();
      await TerminalDoc.updateOne({ _id: "bot_status/logs" }, { $set: { [`data.${which === "errors" ? "errors" : "lines"}`]: [], updateTime: now } });
      await TerminalDoc.create({ _id: `bot_jobs/${jid}`, parent: "bot_jobs", docId: jid, createTime: now, updateTime: now, data: { type: "logs.clear", payload: { which }, status: "pending", attempts: 0, requestedBy: w.uid, createdAtISO: now.toISOString() } });
      return hubJson({ ok: true, msg: which === "errors" ? "Errors cleared" : "Logs cleared" });
    }
    return hubJson(await act(w, b));
  } catch (e) { return fail(e); }
}
