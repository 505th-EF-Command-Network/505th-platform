import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";

/**
 * Cortana Control (approved mock 2026-11-12).
 *   🔑 Control Password — set / change: the server OWNER only (CORTANA_OWNER_DISCORD_ID on Vercel; missing → nobody).
 *   Update & Restart · Restart · Stop Cortana · Shut down home server — Commander + Developer, each needs the Control Password (shut down also a reason).
 * Password: scrypt hash + salt in secure/cortana_control (the terminal's generic data access can't read "secure").
 * 5 wrong tries → locked 15 min (audit). A correct password → one-time ticket secure/ctl_<id> (2 min) + bot_jobs entry.
 */
export class CtlError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export type CtlWho = { uid: string; role: string; discordId: string; name: string };

const DOC = "secure/cortana_control";
const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
const id = (n = 24) => Array.from(randomBytes(n), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
const isOwner = (w: CtlWho) => { const o = (process.env.CORTANA_OWNER_DISCORD_ID ?? "").trim(); return !!o && /^\d{15,22}$/.test(o) && w.discordId === o; };
const canControl = (w: CtlWho) => w.role === "commander" || w.role === "developer" || isOwner(w);
type Sec = { hash?: string; salt?: string; setAtISO?: string; fails?: number; lockUntilISO?: string };
const data = async (path: string) => ((await TerminalDoc.findById(path, { data: 1 }).lean())?.data ?? {}) as Record<string, any>;

async function audit(w: CtlWho, action: string, details: string) {
  const i = id(20), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${i}`, parent: "audit_logs", docId: i, createTime: now, updateTime: now,
    data: { section: "security", action, details: details.slice(0, 500), uid: w.uid, by: w.name, role: w.role, source: "terminal", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
}

export async function status(w: CtlWho) {
  await connectDb();
  const [sec, bot, ver, ctl] = await Promise.all([data(DOC) as Promise<Sec>, data("bot_status/cortana"), data("bot_status/version"), data("bot_status/control")]);
  const seen = Date.parse(String(bot.lastHeartbeatISO ?? "")) || 0;
  return {
    owner: isOwner(w), canControl: canControl(w),
    hasPassword: !!sec.hash, passwordSetAtISO: sec.setAtISO ?? "",
    lockedUntilISO: sec.lockUntilISO && Date.parse(sec.lockUntilISO) > Date.now() ? sec.lockUntilISO : "",
    online: bot.online !== false && !bot.shutdown && Date.now() - seen < 90_000, lastSeenISO: seen ? new Date(seen).toISOString() : "", startedAtISO: String(bot.startedAtISO ?? ""),
    shutdown: bot.shutdown ?? null, lastShutdown: bot.lastShutdown ?? null,
    version: { commit: ver.commit ?? "", subject: ver.subject ?? "", behind: Number(ver.behind) || 0, newest: ver.newest ?? "", newestSubject: ver.newestSubject ?? "", fetchError: ver.fetchError ?? "", checkedAtISO: ver.checkedAtISO ?? "" },
    pc: ctl.pc ?? null,
    control: ctl.state ? { action: ctl.action, by: ctl.by, state: ctl.state, steps: Array.isArray(ctl.steps) ? ctl.steps : [], atISO: ctl.atISO } : null,
  };
}

function hashPw(pw: string, salt = randomBytes(16).toString("hex")) { return { salt, hash: scryptSync(pw, salt, 64).toString("hex") }; }

export async function setPassword(w: CtlWho, pw: unknown) {
  if (!isOwner(w)) throw new CtlError("Only the server owner can set the Control Password.", 403);
  const p = String(pw ?? "");
  if (p.length < 10 || p.length > 200) throw new CtlError("Use at least 10 characters.");
  await connectDb();
  const now = new Date();
  await TerminalDoc.updateOne({ _id: DOC }, { $set: { parent: "secure", docId: "cortana_control", updateTime: now, data: { ...hashPw(p), setAtISO: now.toISOString(), fails: 0 } }, $setOnInsert: { createTime: now } }, { upsert: true });
  await audit(w, "CONTROL PASSWORD CHANGED", "Cortana Control Password set / changed");
  return { ok: true, msg: "Control Password saved" };
}

const REASONS = ["Maintenance / server work", "Bot misbehaving / spamming", "Security concern", "Other"];

export async function act(w: CtlWho, b: Record<string, unknown>) {
  const action = String(b.action ?? "");
  if (!["update", "restart", "shutdown", "pcshutdown", "pccancel"].includes(action)) throw new CtlError("Bad request.");
  if (!canControl(w)) throw new CtlError("Only the Commander or a Developer can control Cortana.", 403);
  // Home server PC: shut down = Commander / Developer with the Control Password. Cancel (during the 60 s countdown) = no password — it only stops a shutdown.
  if (action === "pccancel") return ticket(w, "pccancel", "");
  let reason = "";
  if (action === "shutdown" || action === "pcshutdown") {
    const r = String(b.reason ?? ""), d = String(b.details ?? "").trim().slice(0, 300);
    if (!REASONS.includes(r)) throw new CtlError("Pick a reason.");
    if (r === "Other" && !d) throw new CtlError("Write why you are shutting Cortana down.");
    if (String(b.confirm ?? "") !== "SHUTDOWN") throw new CtlError("Type SHUTDOWN to confirm.");
    reason = d ? `${r} — ${d}` : r;
  }
  await connectDb();
  const sec = (await data(DOC)) as Sec;
  if (!sec.hash || !sec.salt) throw new CtlError("No Control Password set yet — the server owner sets it first.", 409);
  if (sec.lockUntilISO && Date.parse(sec.lockUntilISO) > Date.now()) throw new CtlError(`Locked after ${MAX_FAILS} wrong passwords — try again after ${new Date(sec.lockUntilISO).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}.`, 429);
  const got = Buffer.from(hashPw(String(b.password ?? ""), sec.salt).hash, "hex"), want = Buffer.from(sec.hash, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    const fails = (sec.fails ?? 0) + 1, lock = fails >= MAX_FAILS;
    await TerminalDoc.updateOne({ _id: DOC }, { $set: lock ? { "data.fails": 0, "data.lockUntilISO": new Date(Date.now() + LOCK_MS).toISOString() } : { "data.fails": fails } });
    await audit(w, lock ? "CONTROL PASSWORD LOCKED" : "CONTROL PASSWORD WRONG", lock ? `${MAX_FAILS} wrong tries — Cortana controls locked 15 min` : `Wrong password (${fails}/${MAX_FAILS}) for ${action}`);
    throw new CtlError(lock ? "Wrong password. Locked for 15 minutes." : `Wrong password (${MAX_FAILS - fails} tries left).`, 403);
  }
  await TerminalDoc.updateOne({ _id: DOC }, { $set: { "data.fails": 0 }, $unset: { "data.lockUntilISO": 1 } });
  return ticket(w, action, reason);
}

const MSG: Record<string, string> = { shutdown: "Stopping Cortana…", update: "Updating Cortana…", restart: "Restarting Cortana…", pcshutdown: "Home server shutting down in 60 seconds…", pccancel: "Cancelling the home server shutdown…" };
async function ticket(w: CtlWho, action: string, reason: string) {
  const now = new Date(), t = id(32), j = id(20);
  await TerminalDoc.create({ _id: `secure/ctl_${t}`, parent: "secure", docId: `ctl_${t}`, createTime: now, updateTime: now,
    data: { type: action, by: w.name, uid: w.uid, reason, expiresAtISO: new Date(now.getTime() + 2 * 60_000).toISOString() } });
  await TerminalDoc.create({ _id: `bot_jobs/${j}`, parent: "bot_jobs", docId: j, createTime: now, updateTime: now,
    data: { type: `bot.${action}`, payload: { ticket: t }, status: "pending", attempts: 0, requestedBy: w.uid, createdAtISO: now.toISOString() } });
  await audit(w, `CORTANA ${action.toUpperCase()} REQUESTED`, reason || "from the terminal");
  return { ok: true, jobId: j, msg: MSG[action] ?? "Done" };
}
