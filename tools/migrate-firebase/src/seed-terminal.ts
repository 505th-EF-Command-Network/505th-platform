/**
 * Firebase backup → `terminal_fs` (the data store for the ORIGINAL Command Terminal).
 *
 *   npm run seed-terminal -w @505th/migrate-firebase -- --backup "<backup folder>"            (dry run)
 *   npm run seed-terminal -w @505th/migrate-firebase -- --backup "<backup folder>" --apply    (write)
 *
 * Options
 *   --backup <dir>   backup folder (contains manifest.json and firestore/)
 *   --apply          actually write. Without it nothing is written.
 *   --replace        with --apply: empty `terminal_fs` first (only that collection)
 *   --db <name>      database name (default MONGODB_DB or "505th")
 *
 * Safety
 *   - Reads the backup only; Firebase is never touched.
 *   - Checks every backup file's SHA-256 against manifest.json first.
 *   - Refuses to write into a non-empty `terminal_fs` unless --replace is given.
 *   - Secrets are dropped (settings/webhooks, settings/site.botHttpToken/botHttpUrl).
 *   - Prints counts only — no names, emails or ids.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { connectDb, disconnectDb, TerminalDoc, type FsDoc } from "@505th/db";
import { SECRET_SETTINGS } from "./transform.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const line = (label: string, v: unknown) => console.log(`  ${label.padEnd(34)} ${v}`);

/** Backup encoding → native values. Only timestamps exist in this backup. */
export function decodeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decodeValue);
  if (v && typeof v === "object") {
    const o = v as Record<string, any>;
    if (o.__type === "timestamp") return new Date(o.seconds * 1000 + Math.floor((o.nanoseconds ?? 0) / 1e6));
    if (typeof o.__type === "string") throw new Error(`Unsupported value type "${o.__type}"`);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) out[k] = decodeValue(val);
    return out;
  }
  return v;
}

/** Remove secrets from settings docs. Returns null to skip the doc entirely. */
export function stripSecrets(d: FsDoc): FsDoc | null {
  if (!d.path.startsWith("settings/")) return d;
  const rule = SECRET_SETTINGS[d.id];
  if (rule === "all") return null;
  if (!rule) return d;
  const data = { ...d.data };
  for (const k of rule) delete data[k];
  return { ...d, data };
}

export function toTerminalDoc(d: FsDoc) {
  const segs = d.path.split("/");
  return {
    _id: d.path,
    parent: segs.slice(0, -1).join("/"),
    docId: segs[segs.length - 1],
    data: decodeValue(d.data) as Record<string, unknown>,
    createTime: d.createTime ? new Date(d.createTime) : undefined,
    updateTime: d.updateTime ? new Date(d.updateTime) : undefined,
  };
}

async function main() {
  const backupDir = arg("backup");
  if (!backupDir) throw new Error('Missing --backup "<backup folder>"');
  const root = resolve(backupDir);
  console.log(`\n505th backup → terminal_fs  [${APPLY ? "APPLY — WRITING" : "DRY RUN — nothing is written"}]`);
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  console.log(`\nBackup: ${manifest.startedAt} (project ${manifest.project})`);
  let verified = 0;
  for (const [rel, hash] of Object.entries<string>(manifest.files ?? {})) {
    const h = createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");
    if (h !== hash) throw new Error(`Backup file changed or corrupted: ${rel}`);
    verified++;
  }
  line("files verified (sha256)", verified);

  const dir = join(root, "firestore");
  if (!existsSync(dir)) throw new Error("No firestore/ folder in backup");
  const docs: ReturnType<typeof toTerminalDoc>[] = [];
  const perTop = new Map<string, number>();
  let skipped = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ndjson")).sort()) {
    for (const l of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!l.trim()) continue;
      const clean = stripSecrets(JSON.parse(l) as FsDoc);
      if (!clean) {
        skipped++;
        continue;
      }
      const td = toTerminalDoc(clean);
      docs.push(td);
      const top = td.parent.split("/").length > 1 ? `${td.parent.split("/")[0]}/*/${td.parent.split("/")[2]}` : td.parent;
      perTop.set(top, (perTop.get(top) ?? 0) + 1);
    }
  }
  console.log("\nDocuments:");
  for (const [k, n] of [...perTop].sort()) line(k, n);
  line("TOTAL", docs.length);
  line("skipped (secrets)", skipped);

  if (!APPLY) {
    console.log("\nDry run only. Add --apply to write.\n");
    return;
  }
  await connectDb(undefined, arg("db"));
  const existing = await TerminalDoc.estimatedDocumentCount();
  if (existing > 0 && !REPLACE) throw new Error(`terminal_fs already has ${existing} documents. Use --replace to overwrite it.`);
  if (REPLACE) line("emptied terminal_fs", (await TerminalDoc.deleteMany({})).deletedCount);
  await TerminalDoc.insertMany(docs, { ordered: true });
  const got = await TerminalDoc.countDocuments();
  line("terminal_fs count", `${got} / ${docs.length} ${got === docs.length ? "OK" : "MISMATCH"}`);
  if (got !== docs.length) throw new Error("Count mismatch. Investigate before using the terminal.");
  console.log("\nTerminal data ready. Firebase is untouched.\n");
}

if (process.argv[1]?.endsWith("seed-terminal.ts")) {
  main()
    .catch((err) => {
      console.error(`\nFAILED: ${err.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
