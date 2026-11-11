import { randomBytes } from "node:crypto";
import { TerminalDoc } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type U = Record<string, any>;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SNOW = /^\d{17,20}$/;
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/** Queue a Cortana job (same shape as events/route.ts) and wait for it. null = Cortana offline. */
async function job(type: string, payload: U, requestedBy: string, waitMs = 20000) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `bot_jobs/${id}`, parent: "bot_jobs", docId: id, createTime: now, updateTime: now, data: { type, payload, status: "pending", attempts: 0, requestedBy, createdAtISO: now.toISOString() } });
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1200));
    const d = (await TerminalDoc.findById(`bot_jobs/${id}`, { data: 1 }).lean())?.data as U | undefined;
    if (d && (d.status === "done" || d.status === "failed")) return d;
  }
  return null;
}

/** GET /api/hub/tickets → tickets, types, opener info. Same data as the Terminal's tickets.js. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "tk")) return hubJson({ error: "You don't have Tickets access." }, 403);
  const [tk, ty, us, cs] = await Promise.all([
    TerminalDoc.find({ parent: "tickets" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "ticket_types" }, { docId: 1, data: 1 }).lean(),
    TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean(),
    can(a.role, a.access, "modw") ? TerminalDoc.find({ parent: "mod_cases" }, { data: 1 }).lean() : Promise.resolve([]),
  ]);
  const users = us.map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U);
  const tickets = tk.map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) }) as U)
    .sort((x, y) => String(y.lastActivityISO || y.openedAtISO).localeCompare(String(x.lastActivityISO || x.openedAtISO)));
  const openers = new Map<string, U>();
  for (const t of tickets) {
    if (openers.has(t.openerId)) continue;
    const u = users.find((x) => x.discordId === t.openerId);
    openers.set(t.openerId, { name: u ? memberName(u) : "", uid: u?.id ?? "", rank: u?.rank ?? "", status: u?.status ?? "",
      past: tickets.filter((x) => x.openerId === t.openerId).length - 1,
      warns: (cs as U[]).filter((c) => c.data?.discordId === t.openerId && c.data?.action === "warn" && c.data?.active).length });
  }
  return hubJson({ tickets, types: ty.map((d) => ({ id: String(d.docId), ...((d.data ?? {}) as U) })), openers: Object.fromEntries(openers) });
}

/** POST /api/hub/tickets {action, ticketId, …} → sent through Cortana (signed "Rank. F. Callsign"). */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "tk")) return hubJson({ error: "You don't have Tickets access." }, 403);
  const b = (await req.json().catch(() => null)) as U | null;
  const id = String(b?.ticketId ?? "");
  if (!b || !ID.test(id)) return hubJson({ error: "Bad request." }, 400);
  const tk = (await TerminalDoc.findById(`tickets/${id}`, { data: 1 }).lean())?.data as U | undefined;
  if (!tk) return hubJson({ error: "Ticket not found." }, 404);
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const tag = `#${String(tk.number).padStart(4, "0")} (${tk.typeName})`;
  let type = "", payload: U = { ticketId: id }, msg = "", audit = "";
  switch (b.action) {
    case "reply": case "note": {
      const text = String(b.text ?? "").trim().slice(0, 1900);
      if (!text) return hubJson({ error: "Type a message." }, 400);
      type = "ticket.reply"; payload = { ticketId: id, text, note: b.action === "note" };
      msg = b.action === "note" ? "Note saved" : "Reply sent to Discord"; audit = b.action === "note" ? "" : "TICKET REPLY";
      break;
    }
    case "claim": type = "ticket.claim"; msg = "Ticket claimed"; audit = "TICKET CLAIMED"; break;
    case "close": {
      const reason = String(b.reason ?? "").trim().slice(0, 300);
      if (!reason) return hubJson({ error: "Give a reason." }, 400);
      type = "ticket.close"; payload = { ticketId: id, reason }; msg = "Ticket closed"; audit = "TICKET CLOSED"; break;
    }
    case "reopen": type = "ticket.reopen"; msg = "Ticket reopened"; audit = "TICKET REOPENED"; break;
    case "transcript": type = "ticket.transcript"; msg = "Transcript posted"; break;
    case "delete": type = "ticket.delete"; msg = "Channel deleted"; audit = "TICKET CHANNEL DELETED"; break;
    case "add": case "remove": {
      const userId = String(b.userId ?? "");
      if (!SNOW.test(userId)) return hubJson({ error: "Bad Discord ID." }, 400);
      type = `ticket.${b.action}`; payload = { ticketId: id, userId }; msg = b.action === "add" ? "Person added" : "Person removed"; break;
    }
    case "move": {
      const typeId = String(b.typeId ?? "");
      if (!ID.test(typeId) || !(await TerminalDoc.exists({ _id: `ticket_types/${typeId}` }))) return hubJson({ error: "Pick a ticket type." }, 400);
      type = "ticket.move"; payload = { ticketId: id, typeId }; msg = "Ticket moved"; audit = "TICKET MOVED"; break;
    }
    default: return hubJson({ error: "Unknown action." }, 400);
  }
  const r = await job(type, payload, a.uid, b.action === "delete" ? 25000 : 20000);
  if (r?.status === "failed") return hubJson({ error: String(r.error || "Cortana could not do it.") }, 409);
  if (audit) await hubAudit(who, audit, `${tag} · ${tk.openerName ?? ""} — via app`);
  return hubJson({ ok: true, queued: !r, msg: r ? msg : "Cortana is offline — it will be done when Cortana is back" });
}
