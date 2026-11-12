/**
 * bot_jobs worker. The website writes jobs to `terminal_fs` (parent "bot_jobs"):
 *   data: { type, payload, status: "pending", requestedBy?, createdAtISO, attempts, runAtISO? }
 * Cortana claims ONE job at a time atomically (so a job never runs twice), runs it,
 * and writes status done / failed + result / error. Only job types Cortana knows are
 * claimed — anything else waits for a later version.
 */
import type { Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { noteError } from "./health.ts";

const POLL_MS = 2000;
const MAX_ATTEMPTS = 3;

/** An error that retrying can't fix (bad channel, missing permission, invalid content). */
export class PermanentJobError extends Error {}

export type Job = { _id: string; data: { type: string; payload?: Record<string, unknown>; attempts?: number; requestedBy?: string } };
type Handler = (job: Job, client: Client<true>) => Promise<Record<string, unknown>>;

const handlers: Record<string, Handler> = {
  // Test job: proves website → MongoDB → Cortana works.
  ping: async (_j, client) => ({ pong: true, pingMs: Math.round(client.ws.ping), at: new Date().toISOString() }),
};

export function registerJob(type: string, h: Handler) {
  handlers[type] = h;
}

const nowISO = () => new Date().toISOString();

async function claimNext(): Promise<Job | null> {
  const now = nowISO();
  return (await TerminalDoc.findOneAndUpdate(
    {
      parent: "bot_jobs",
      "data.status": "pending",
      "data.type": { $in: Object.keys(handlers) },
      $or: [{ "data.runAtISO": { $exists: false } }, { "data.runAtISO": null }, { "data.runAtISO": { $lte: now } }],
    },
    { $set: { "data.status": "processing", "data.claimedAtISO": now, updateTime: new Date() }, $inc: { "data.attempts": 1 } },
    { sort: { createTime: 1 }, returnDocument: "after", lean: true },
  )) as Job | null;
}

async function processOne(client: Client<true>) {
  const job = await claimNext();
  if (!job) return false;
  const { type } = job.data;
  try {
    const result = await handlers[type](job, client);
    await TerminalDoc.updateOne({ _id: job._id }, { $set: { "data.status": "done", "data.result": result, "data.finishedAtISO": nowISO(), updateTime: new Date() }, $unset: { "data.error": 1 } });
    log.info(`Job ${type} done.`);
  } catch (err) {
    noteError();
    const message = String((err as Error)?.message ?? err).slice(0, 500);
    const retry = (job.data.attempts ?? 1) < MAX_ATTEMPTS && !(err instanceof PermanentJobError);
    await TerminalDoc.updateOne(
      { _id: job._id },
      retry
        ? { $set: { "data.status": "pending", "data.error": message, "data.runAtISO": new Date(Date.now() + 10_000 * (job.data.attempts ?? 1)).toISOString() } }
        : { $set: { "data.status": "failed", "data.error": message, "data.finishedAtISO": nowISO() } },
    );
    log.error(`Job ${type} ${retry ? "will retry" : "failed"}`, err);
  }
  return true;
}

/** Jobs left "processing" by a crash go back to pending after 5 minutes. */
async function recoverStuck() {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const r = await TerminalDoc.updateMany({ parent: "bot_jobs", "data.status": "processing", "data.claimedAtISO": { $lt: cutoff } }, { $set: { "data.status": "pending" } });
  if (r.modifiedCount) log.warn(`Recovered ${r.modifiedCount} stuck job(s).`);
}

/** Run the queue now (called by live.ts on a new job). */
export let wake: () => void = () => {};

export function startJobWorker(client: Client<true>) {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      while (!stopped && (await processOne(client))) {}
    } catch (e) {
      log.error("Job worker error", e);
    } finally {
      running = false;
    }
  };
  void recoverStuck().catch((e) => log.error("Job recovery failed", e));
  wake = () => void tick(); // instant pick-up when the website queues a job (live.ts)
  const timer = setInterval(tick, POLL_MS);
  log.ok(`Job worker started (${Object.keys(handlers).join(", ")}).`);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
