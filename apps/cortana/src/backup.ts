/**
 * Nightly MongoDB backup (Atlas free M0 has NO automatic backups).
 * Every night after 03:00 UK time Cortana copies every collection to the bot server's disk:
 *   apps/cortana/backups/2026-11-15/<collection>.json.gz   (one EJSON document per line, types kept: dates, ObjectIds)
 *   apps/cortana/backups/2026-11-15/manifest.json          (written LAST — a folder without it is incomplete)
 * Keeps the newest 14 days. Checks every 15 min, so a restart or a PC that was off still gets today's backup.
 * Optional BACKUP_DIR in .env.local puts them somewhere else (e.g. another drive). The folder is in .gitignore — member data never goes to GitHub.
 * Restore (into a TEST database first): npx tsx scripts/restore-backup.ts backups/2026-11-15 --db 505th_restore_test
 * Job "backup.now" runs one straight away.
 */
import mongoose from "mongoose";
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { once } from "node:events";
import { log } from "./log.ts";
import { registerJob } from "./worker.ts";

const KEEP = 14;
const DIR = resolve(process.env.BACKUP_DIR || join(import.meta.dirname, "..", "backups"));
const EJSON = mongoose.mongo.BSON.EJSON;
const ukDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // 2026-11-15
const ukHour = () => Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }));

export type BackupResult = { day: string; folder: string; collections: Record<string, number>; total: number; ms: number };

export async function runBackup(): Promise<BackupResult> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  const t0 = Date.now(), day = ukDay(), folder = join(DIR, day), tmp = `${folder}.partial`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const counts: Record<string, number> = {};
  const cols = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system.")).sort();
  for (const name of cols) {
    const gz = createGzip(), out = createWriteStream(join(tmp, `${name}.json.gz`));
    gz.pipe(out);
    let n = 0;
    for await (const doc of db.collection(name).find({}, { batchSize: 500 })) {
      if (!gz.write(EJSON.stringify(doc, { relaxed: false }) + "\n")) await once(gz, "drain");
      n++;
    }
    gz.end();
    await once(out, "finish");
    // Check: the copy has as many documents as the database has right now (a write during the backup can add one — allowed).
    const live = await db.collection(name).countDocuments();
    if (n < live - 5) throw new Error(`${name}: copied ${n} but database has ${live}`);
    counts[name] = n;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  writeFileSync(join(tmp, "manifest.json"), JSON.stringify({ day, atISO: new Date().toISOString(), db: db.databaseName, collections: counts, total }, null, 2));
  rmSync(folder, { recursive: true, force: true });
  renameSync(tmp, folder);
  // Keep the newest 14 finished backups.
  const old = readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && existsSync(join(DIR, f, "manifest.json"))).sort().slice(0, -KEEP);
  for (const f of old) rmSync(join(DIR, f), { recursive: true, force: true });
  return { day, folder, collections: counts, total, ms: Date.now() - t0 };
}

export function startBackup() {
  let busy = false;
  const run = async (force = false) => {
    if (busy) return null;
    if (!force && (ukHour() < 3 || existsSync(join(DIR, ukDay(), "manifest.json")))) return null;
    busy = true;
    try {
      const r = await runBackup();
      log.ok(`Backup done: ${r.total} documents in ${Object.keys(r.collections).length} collections (${(r.ms / 1000).toFixed(1)} s) → ${r.folder}`);
      return r;
    } catch (e) {
      log.error("Backup FAILED", e);
      throw e;
    } finally { busy = false; }
  };
  registerJob("backup.now", async () => {
    const r = await run(true);
    if (!r) throw new Error("A backup is already running");
    return { day: r.day, total: r.total, collections: Object.keys(r.collections).length };
  });
  setTimeout(() => void run().catch(() => {}), 60_000); // after start-up settles
  setInterval(() => void run().catch(() => {}), 15 * 60_000);
  log.info(`Nightly backup on (after 03:00 UK, keeps ${KEEP} days) → ${DIR}`);
}
