/**
 * Restore a nightly backup (made by src/backup.ts) into a database.
 * Run from apps/cortana:
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts backups/2026-11-15 --db 505th_restore_test
 * SAFETY:
 *  - --db is required. Restoring into the LIVE database ("505th" / MONGODB_DB) is refused unless you also add --overwrite-live.
 *  - Each collection in the target database is emptied first, then filled from the backup.
 *  - At the end every collection's count is checked against manifest.json.
 * The connection string comes from .env.local (MONGODB_URI) — it is never printed.
 */
import mongoose from "mongoose";
import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--db");
const target = args[args.indexOf("--db") + 1];
const live = process.env.MONGODB_DB || "505th";
const fail = (m: string) => { console.error(`❌ ${m}`); process.exit(1); };

if (!folder || args.indexOf("--db") < 0 || !target) fail("Usage: npx tsx --env-file=.env.local scripts/restore-backup.ts backups/<day> --db <database name>");
const dir = resolve(folder!);
const manifestPath = join(dir, "manifest.json");
if (!existsSync(manifestPath)) fail(`${dir} has no manifest.json — not a finished backup`);
if (target === live && !args.includes("--overwrite-live")) fail(`"${target}" is the LIVE database. Restore into a test name first (e.g. --db 505th_restore_test). To really overwrite live, add --overwrite-live.`);
if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set (run with --env-file=.env.local)");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { day: string; collections: Record<string, number>; total: number };
const EJSON = mongoose.mongo.BSON.EJSON;

await mongoose.connect(process.env.MONGODB_URI!, { dbName: target, serverSelectionTimeoutMS: 10_000 });
const db = mongoose.connection.db!;
console.log(`Restoring backup ${manifest.day} (${manifest.total} documents) → database "${target}"`);

let bad = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort()) {
  const name = file.replace(/\.json\.gz$/, "");
  const col = db.collection(name);
  await col.deleteMany({});
  let batch: any[] = [], n = 0;
  const lines = createInterface({ input: createReadStream(join(dir, file)).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    batch.push(EJSON.parse(line, { relaxed: false }));
    if (batch.length >= 500) { await col.insertMany(batch, { ordered: false }); n += batch.length; batch = []; }
  }
  if (batch.length) { await col.insertMany(batch, { ordered: false }); n += batch.length; }
  const count = await col.countDocuments(), want = manifest.collections[name] ?? n;
  const ok = count === want;
  if (!ok) bad++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${count} / ${want}`);
}
await mongoose.disconnect();
if (bad) fail(`${bad} collection(s) did not match the backup`);
console.log(`✅ Restore checked: every collection matches manifest.json`);
