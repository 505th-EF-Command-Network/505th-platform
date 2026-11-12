/**
 * Cortana Control (approved mock 2026-11-12): Update & Restart · Restart · Shut down — from the website.
 * Only the website can start these: it checks the Control Password, then writes a one-time ticket in secure/ctl_<id>
 * (the terminal's generic data access can't touch "secure"). A job without a valid ticket is refused.
 *   bot.update   → git pull (newest code) → npm install only if package-lock.json changed → restart (PM2)
 *   bot.restart  → restart (PM2)
 *   bot.pcshutdown / bot.pccancel → the whole home server PC (Windows shutdown /s /t 60 · shutdown /a)
 *   bot.shutdown → post in the log channel, stop (exit 0 → PM2 leaves it stopped). Start again on the home server: pm2 start Cortana_V2
 * Steps are written to bot_status/control so the page shows them live. Version info → bot_status/version (every 30 min).
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EmbedBuilder, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { markOffline } from "./health.ts";
import { patchDoc } from "./store.ts";
import { LOGO, auditLog, cortanaSettings } from "./util.ts";
import { PermanentJobError, registerJob, type Job } from "./worker.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); // repo root (apps/cortana/src → ../../..)
const LOCK = join(ROOT, "package-lock.json");
const win = process.platform === "win32";

function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((res, rej) => {
    // npm needs the Windows shell; git is a real .exe and runs without it.
    execFile(cmd, args, { cwd: ROOT, timeout: timeoutMs, windowsHide: true, shell: cmd === "npm" && win, maxBuffer: 8 * 1024 * 1024 }, (err, out, errOut) => {
      if (err) rej(new Error((String(errOut || out || err.message).trim().split("\n").slice(-3).join(" ") || err.message).slice(0, 300)));
      else res(String(out).trim());
    });
  });
}
const lockHash = async () => createHash("sha256").update(await readFile(LOCK).catch(() => Buffer.from(""))).digest("hex");

/** One-time ticket written by the website after the Control Password check. Used once, valid 2 minutes. */
async function takeTicket(job: Job, type: string) {
  const t = String(job.data.payload?.ticket ?? "");
  if (!/^[A-Za-z0-9]{20,64}$/.test(t)) throw new PermanentJobError("Not allowed — use the Cortana controls on the website.");
  const d = await TerminalDoc.findOneAndDelete({ _id: `secure/ctl_${t}` }).lean();
  const x = (d?.data ?? {}) as { type?: string; by?: string; reason?: string; expiresAtISO?: string };
  if (!d || x.type !== type || !x.expiresAtISO || Date.parse(x.expiresAtISO) < Date.now()) throw new PermanentJobError("Not allowed — that request has expired. Try again.");
  return { by: String(x.by || "Staff"), reason: String(x.reason || "") };
}

type Step = { t: string; s: "ok" | "run" | "fail" | "skip"; d?: string };
let steps: Step[] = [];
const setSteps = (action: string, by: string, state: "running" | "failed" | "restarting" | "done", extra: Record<string, unknown> = {}) =>
  patchDoc("bot_status", "control", { action, by, state, steps, atISO: new Date().toISOString(), ...extra }).catch(() => {});
const step = (t: string, s: Step["s"], d?: string) => { const i = steps.findIndex((x) => x.t === t); const v = { t, s, ...(d ? { d } : {}) }; if (i >= 0) steps[i] = v; else steps.push(v); };

async function postLog(client: Client<true>, title: string, text: string, color: number) {
  const s = await cortanaSettings().catch(() => ({} as Record<string, any>));
  const id = s.logs?.auditId || s.logs?.modLogId;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (ch && "send" in ch) await ch.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(text).setFooter({ text: "505th Cortana Control", iconURL: LOGO }).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}

/** Running version + how far behind GitHub (git fetch). */
export async function checkVersion() {
  try {
    const [head, subject] = (await run("git", ["log", "-1", "--format=%h%x09%s"])).split("\t");
    let behind = 0, newest = "", newestSubject = "", fetchError = "";
    try {
      await run("git", ["fetch", "--quiet"], 60_000);
      behind = Number(await run("git", ["rev-list", "--count", "HEAD..@{u}"])) || 0;
      if (behind) [newest, newestSubject] = (await run("git", ["log", "-1", "--format=%h%x09%s", "@{u}"])).split("\t");
    } catch (e) { fetchError = (e as Error).message; }
    await patchDoc("bot_status", "version", { commit: head, subject: (subject ?? "").slice(0, 120), behind, newest, newestSubject: (newestSubject ?? "").slice(0, 120), fetchError, checkedAtISO: new Date().toISOString() });
  } catch (e) { log.warn(`Version check failed: ${(e as Error).message}`); }
}

const exitSoon = (code: number, why: string) => setTimeout(() => void markOffline(why).finally(() => process.exit(code)), 1500);

export function startControl(client: Client<true>) {
  // After a restart from the website: mark it finished. After a shut down: keep the record as "last shut down".
  void (async () => {
    const c = (await TerminalDoc.findById("bot_status/control", { data: 1 }).lean())?.data as Record<string, any> | undefined;
    if (c?.state === "restarting") {
      steps = Array.isArray(c.steps) ? c.steps : [];
      step("Back online", "ok");
      await setSteps(String(c.action), String(c.by), "done");
      await auditLog("CORTANA BACK ONLINE", c.action === "update" ? "after Update & Restart" : "after restart", "Cortana", "security");
    }
    const st = (await TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean())?.data as Record<string, any> | undefined;
    if (st?.shutdown) await TerminalDoc.updateOne({ _id: "bot_status/cortana" }, { $set: { "data.lastShutdown": st.shutdown }, $unset: { "data.shutdown": 1 } }).catch(() => {});
    if (c?.pc?.state === "countdown") await patchDoc("bot_status", "control", { pc: { ...c.pc, state: "done" } });
    await checkVersion();
  })();
  const t = setInterval(() => void checkVersion(), 30 * 60_000);

  registerJob("bot.restart", async (job) => {
    const { by } = await takeTicket(job, "restart");
    steps = []; step("Restarting Cortana", "run");
    await setSteps("restart", by, "restarting");
    log.warn(`Restart from the website by ${by}.`);
    exitSoon(1, "restart"); // non-zero → PM2 starts it again
    return { ok: true };
  });

  registerJob("bot.update", async (job) => {
    const { by } = await takeTicket(job, "update");
    steps = [];
    const fail = async (t: string, e: unknown) => {
      step(t, "fail", (e as Error).message);
      await setSteps("update", by, "failed");
      await auditLog("CORTANA UPDATE FAILED", `${t}: ${(e as Error).message}`.slice(0, 400), by, "security");
      throw new PermanentJobError(`${t} failed — Cortana was NOT restarted. ${(e as Error).message}`);
    };
    log.warn(`Update & Restart from the website by ${by}.`);
    step("Get newest code (git pull)", "run"); await setSteps("update", by, "running");
    const before = await lockHash();
    try {
      await run("git", ["checkout", "--", "package-lock.json"]).catch(() => ""); // npm on this PC rewrites it → would block the pull
      const out = await run("git", ["pull", "--ff-only"], 120_000);
      step("Get newest code (git pull)", "ok", /Already up to date/i.test(out) ? "already up to date" : out.split("\n").pop()?.slice(0, 120));
    } catch (e) { return fail("Get newest code (git pull)", e); }
    if ((await lockHash()) !== before) {
      step("Install packages (npm install)", "run"); await setSteps("update", by, "running");
      try { await run("npm", ["install", "--no-audit", "--no-fund"], 170_000); step("Install packages (npm install)", "ok"); }
      catch (e) { return fail("Install packages (npm install)", e); }
    } else step("Install packages (npm install)", "skip", "no package changes");
    step("Restarting Cortana", "run");
    await setSteps("update", by, "restarting");
    await auditLog("CORTANA UPDATE", "Update & Restart from the website", by, "security");
    exitSoon(1, "update");
    return { ok: true };
  });

  registerJob("bot.shutdown", async (job, c) => {
    const { by, reason } = await takeTicket(job, "shutdown");
    const at = new Date().toISOString();
    log.warn(`SHUT DOWN from the website by ${by}: ${reason}`);
    await patchDoc("bot_status", "cortana", { shutdown: { by, reason, atISO: at } });
    await auditLog("CORTANA SHUT DOWN", `${reason} — by ${by}`, by, "security");
    await postLog(c, "⏻ Cortana shut down", `**By:** ${by}\n**Reason:** ${reason}\n\nStart again on the home server: \`pm2 start Cortana_V2\``, 0xff4d4d);
    exitSoon(0, "shutdown"); // exit 0 → PM2 leaves it stopped (stop_exit_codes: [0])
    return { ok: true };
  });

  // 🖥 Home server PC (Windows): shut down with a 60 s countdown (owner only, checked by the website) · cancel during the countdown.
  registerJob("bot.pcshutdown", async (job, c) => {
    const { by, reason } = await takeTicket(job, "pcshutdown");
    if (!win) throw new PermanentJobError("Home server shutdown only works on Windows.");
    const until = new Date(Date.now() + 60_000).toISOString();
    await run("shutdown", ["/s", "/t", "60", "/c", `505th: home server shutting down from the website by ${by}. Reason: ${reason}`.slice(0, 500)]);
    await patchDoc("bot_status", "control", { pc: { state: "countdown", by, reason, untilISO: until, atISO: new Date().toISOString() } });
    await auditLog("HOME SERVER SHUT DOWN", `${reason} — by ${by} (60 s countdown)`, by, "security");
    await postLog(c, "🖥 Home server shutting down", `**By:** ${by}\n**Reason:** ${reason}\n\nThe PC turns off <t:${Math.floor(Date.parse(until) / 1000)}:R>. Cortana, PM2 and everything on it go offline.\nTo start again: power on the PC, then \`pm2 start Cortana_V2\` (or pm2 resurrect).`, 0xff4d4d);
    return { ok: true, untilISO: until };
  });
  registerJob("bot.pccancel", async (job, c) => {
    const { by } = await takeTicket(job, "pccancel");
    if (!win) throw new PermanentJobError("Only works on Windows.");
    try { await run("shutdown", ["/a"]); } catch (e) { throw new PermanentJobError(`Couldn't cancel — ${(e as Error).message}`); }
    await patchDoc("bot_status", "control", { pc: { state: "cancelled", by, atISO: new Date().toISOString() } });
    await auditLog("HOME SERVER SHUTDOWN CANCELLED", `by ${by}`, by, "security");
    await postLog(c, "✓ Home server shutdown cancelled", `**By:** ${by}`, 0x22e07a);
    return { ok: true };
  });

  return () => clearInterval(t);
}
