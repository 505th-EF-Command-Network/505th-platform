#!/usr/bin/env node
/**
 * node --env-file=apps/website/.env.local scripts/db-usage.mjs
 * Shows what uses the MongoDB space (read-only — changes nothing). Uses MONGODB_URI / MONGODB_DB from the env file; never prints them.
 *   1. every collection: documents, data, storage on disk, indexes
 *   2. terminal_fs + legacy_docs split by "parent" (users, net_days, audit_logs, …) — biggest first
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("✕ MONGODB_URI not found. Run with: node --env-file=apps/website/.env.local scripts/db-usage.mjs"); process.exit(1); }
const mb = (b) => (b / 1048576).toFixed(2).padStart(8) + " MB";
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB ?? "505th", maxPoolSize: 2, serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
const s = await db.command({ dbStats: 1 });
console.log(`\n505th database — ${mb(s.storageSize + s.indexSize).trim()} used of 512 MB (free tier) · ${s.objects} documents\n`);

const rows = [];
for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
  const st = await db.command({ collStats: c.name }).catch(() => null);
  if (st) rows.push({ name: c.name, count: st.count, data: st.size, disk: st.storageSize, idx: st.totalIndexSize });
}
rows.sort((a, b) => b.disk + b.idx - (a.disk + a.idx));
console.log(pad("COLLECTION", 26) + "DOCS".padStart(9) + "   DATA        DISK        INDEXES     TOTAL");
for (const r of rows) console.log(pad(r.name, 26) + String(r.count).padStart(9) + mb(r.data) + mb(r.disk) + mb(r.idx) + mb(r.disk + r.idx));

for (const name of ["terminal_fs", "legacy_docs"]) {
  if (!rows.some((r) => r.name === name)) continue;
  const top = await db.collection(name).aggregate([
    { $group: { _id: { $arrayElemAt: [{ $split: [{ $ifNull: ["$parent", "(none)"] }, "/"] }, 0] }, n: { $sum: 1 }, bytes: { $sum: { $bsonSize: "$$ROOT" } } } },
    { $sort: { bytes: -1 } }, { $limit: 20 },
  ], { allowDiskUse: true }).toArray();
  console.log(`\n${name} — biggest parts (data size, before compression)`);
  for (const t of top) console.log("  " + pad(t._id, 28) + String(t.n).padStart(8) + " docs" + mb(t.bytes));
}
await mongoose.disconnect();
console.log("\nDone. Nothing was changed.\n");
