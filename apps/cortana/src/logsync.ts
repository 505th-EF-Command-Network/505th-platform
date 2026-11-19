import { TerminalDoc } from "@505th/db";
import { recent } from "./log.ts";
import { registerJob } from "./worker.ts";

/**
 * Command Centre → Bot Server LOGS / ERRORS (approved mock 18 Nov).
 * Saves the last 300 log lines + last 100 errors to bot_status/logs every 15 s (only when something changed).
 * Job logs.clear { which: "logs" | "errors" } empties them (the website checks access first).
 */
async function save() {
  if (!recent.dirty) return;
  recent.dirty = false;
  const now = new Date();
  await TerminalDoc.updateOne({ _id: "bot_status/logs" }, { $set: { parent: "bot_status", docId: "logs", updateTime: now, "data.lines": recent.lines, "data.errors": recent.errors, "data.savedAtISO": now.toISOString() }, $setOnInsert: { createTime: now } }, { upsert: true }).catch(() => { recent.dirty = true; });
}
export function startLogSync() {
  registerJob("logs.clear", async (job) => {
    const which = (job.data.payload as { which?: string } | undefined)?.which;
    if (which === "errors") recent.errors.length = 0; else recent.lines.length = 0;
    recent.dirty = true;
    await save();
    return { cleared: which === "errors" ? "errors" : "logs" };
  });
  const t = setInterval(() => void save(), 15_000);
  t.unref?.();
  void save();
}
