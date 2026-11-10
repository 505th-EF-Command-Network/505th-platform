/**
 * Firebase backup → MongoDB Atlas.
 *
 *   npm run migrate -w @505th/migrate-firebase -- --backup "<backup folder>"            (dry run)
 *   npm run migrate -w @505th/migrate-firebase -- --backup "<backup folder>" --apply    (write)
 *
 * Options
 *   --backup <dir>        backup folder (contains manifest.json, firestore/, auth/)
 *   --apply               actually write. Without it nothing is written.
 *   --left-unit <file>    JSON array of Firebase uids or "First Last" names who left the unit
 *   --db <name>           database name (default MONGODB_DB or "505th")
 *
 * Safety
 *   - Reads the backup only; Firebase itself is never touched.
 *   - Checks the backup's SHA-256 hashes against manifest.json before anything else.
 *   - Refuses to write into a database that already has members (no overwrite).
 *   - Secrets in settings (bot token, webhook URLs) are dropped, never copied.
 *   - Passwords are NOT migrated: sign-in moves to Discord.
 *   - Prints counts only — no names, emails or ids.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import mongoose from "mongoose";
import {
  connectDb, disconnectDb, Member, AttendanceEvent, AttendanceSnapshot, Aar, AuditLog, SiteContent, UnitStatus, LegacyDoc,
} from "@505th/db";
import {
  type FsDoc, leaverMatcher, toDate, transformAar, transformAudit, transformEvent, transformMember, transformSetting, transformSnapshot,
} from "./transform.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const APPLY = process.argv.includes("--apply");
const backupDir = arg("backup");
if (!backupDir) {
  console.error('Missing --backup "<backup folder>"');
  process.exit(1);
}
const root = resolve(backupDir);

function readNdjson(rel: string): FsDoc[] {
  const p = join(root, rel);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function verifyHashes(manifest: any) {
  let ok = 0;
  for (const [rel, hash] of Object.entries<string>(manifest.files ?? {})) {
    const h = createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");
    if (h !== hash) throw new Error(`Backup file changed or corrupted: ${rel}`);
    ok++;
  }
  return ok;
}

const line = (label: string, v: unknown) => console.log(`  ${label.padEnd(34)} ${v}`);

async function main() {
  console.log(`\n505th Firebase → MongoDB migration  [${APPLY ? "APPLY — WRITING" : "DRY RUN — nothing is written"}]`);
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  console.log(`\nBackup: ${manifest.startedAt} (project ${manifest.project})`);
  line("files verified (sha256)", verifyHashes(manifest));

  const leftFile = arg("left-unit");
  const leavers = leftFile ? (JSON.parse(readFileSync(resolve(leftFile), "utf8")) as string[]) : [];
  const isLeaver = leaverMatcher(leavers);

  // ── Members ──
  const users = readNdjson("firestore/users.ndjson");
  const members = users.map((u) => ({ uid: u.id, ...transformMember(u, isLeaver) }));
  const warnCount = new Map<string, number>();
  for (const m of members) for (const w of m.warnings) warnCount.set(w, (warnCount.get(w) ?? 0) + 1);
  const leaversMatched = members.filter((m) => m.doc.status === "LEFT_UNIT").length;
  const dupDiscord = (() => {
    const seen = new Set<string>();
    let d = 0;
    for (const m of members) if (m.doc.discordId) (seen.has(m.doc.discordId) ? d++ : seen.add(m.doc.discordId));
    return d;
  })();

  console.log("\nMembers");
  line("records", members.length);
  for (const s of ["ACTIVE", "PENDING", "LEFT_UNIT", "LOA", "RESERVE", "SUSPENDED"]) {
    const n = members.filter((m) => m.doc.status === s).length;
    if (n) line(`status ${s}`, n);
  }
  line("with Discord ID", members.filter((m) => m.doc.discordId).length);
  line("with callsign", members.filter((m) => m.doc.callsign).length);
  line("rank matched to rank table", members.filter((m) => m.doc.rankKey).length);
  line("leavers requested / matched", `${leavers.length} / ${leaversMatched}`);
  line("duplicate Discord IDs", dupDiscord);
  for (const [w, n] of warnCount) line(`warning: ${w}`, n);
  if (leavers.length && leaversMatched !== leavers.length) throw new Error("Not every leaver was matched — check the --left-unit list.");
  if (dupDiscord) throw new Error("Duplicate Discord IDs — fix before migrating.");

  // ── Other collections (counts) ──
  const events = readNdjson("firestore/attendance_events.ndjson");
  const snaps = readNdjson("firestore/attendance_history.ndjson");
  const aars = readNdjson("firestore/aars.ndjson");
  const audits = [
    ...readNdjson("firestore/audit_logs.ndjson").map((d) => ({ d, c: "audit_logs" })),
    ...readNdjson("firestore/audit_log.ndjson").map((d) => ({ d, c: "audit_log" })),
  ];
  const settings = readNdjson("firestore/settings.ndjson");
  const unit = readNdjson("firestore/unit_config.ndjson");
  const LEGACY = ["admin_notifications", "comms_media", "conversations", "media", "notifications", "presence_sessions"];
  const legacy = LEGACY.flatMap((c) => readNdjson(`firestore/${c}.ndjson`).map((d) => ({ c, d })));

  // dry-run mapping with fake ids to measure unmatched references
  const fakeIds = new Map<string, unknown>(members.map((m) => [m.uid, m.uid]));
  const unmatchedRefs = events.reduce((n, e) => n + transformEvent(e, fakeIds).unmatchedLegacyIds.length, 0);

  console.log("\nOther data");
  line("attendance events", events.length);
  line("  attendee refs not matching a member", unmatchedRefs);
  line("attendance monthly snapshots", snaps.length);
  line("after-action reports", aars.length);
  line("audit log entries", audits.length);
  line("site settings docs", settings.length);
  const secretDrops = settings.map(transformSetting).flatMap((s) => (s ? s.dropped : []));
  line("secret fields dropped (not copied)", secretDrops.length);
  line("unit status docs", unit.length);
  line("legacy docs kept raw (chat, media…)", legacy.length);
  line("Firebase Auth users (passwords NOT migrated)", (manifest.auth?.users as number) ?? "?");

  if (!APPLY) {
    console.log("\nDry run complete. Nothing was written. Re-run with --apply to write.\n");
    return;
  }

  // ── APPLY ──
  await connectDb(process.env.MONGODB_URI, arg("db") ?? process.env.MONGODB_DB ?? "505th");
  const existing = await Member.estimatedDocumentCount();
  if (existing > 0) throw new Error(`Target database already has ${existing} members. Refusing to overwrite. Use a fresh database.`);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const inserted = await Member.insertMany(members.map((m) => m.doc), { session });
      const uidToId = new Map<string, unknown>(members.map((m, i) => [m.uid, inserted[i]._id]));
      await AttendanceEvent.insertMany(events.map((e) => transformEvent(e, uidToId)), { session });
      await AttendanceSnapshot.insertMany(snaps.map((s) => transformSnapshot(s, uidToId)), { session });
      await Aar.insertMany(aars.map((a) => transformAar(a, uidToId)), { session });
      await AuditLog.insertMany(audits.map(({ d, c }) => transformAudit(d, uidToId, c)), { session });
      const keep = settings.map(transformSetting).filter((s) => s && Object.keys(s.data).length);
      await SiteContent.insertMany(keep.map((s) => ({ key: s!.key, data: s!.data, updatedBy: "migration" })), { session });
      for (const u of unit) {
        await UnitStatus.create(
          [{ key: u.id, opStatus: u.data.opStatus, statusMessage: u.data.statusMessage, updatedBy: u.data.updatedBy }],
          { session },
        );
      }
      await LegacyDoc.insertMany(
        legacy.map(({ c, d }) => ({
          collectionName: c, legacyId: d.id, legacyPath: d.path, data: d.data, createTime: toDate(d.createTime), updateTime: toDate(d.updateTime),
        })),
        { session },
      );
      await AuditLog.create([{ section: "system", action: "migration", details: `Imported Firebase backup ${manifest.startedAt}`, source: "migration" }], { session });
    });
  } finally {
    await session.endSession();
  }

  // ── Validate ──
  console.log("\nValidation (MongoDB counts vs backup)");
  const checks: [string, number, number][] = [
    ["members", await Member.countDocuments(), members.length],
    ["attendance_events", await AttendanceEvent.countDocuments(), events.length],
    ["attendance_snapshots", await AttendanceSnapshot.countDocuments(), snaps.length],
    ["aars", await Aar.countDocuments(), aars.length],
    ["audit_logs (incl. migration entry)", await AuditLog.countDocuments(), audits.length + 1],
    ["legacy_docs", await LegacyDoc.countDocuments(), legacy.length],
  ];
  let bad = 0;
  for (const [name, got, want] of checks) {
    line(name, `${got} / ${want} ${got === want ? "OK" : "MISMATCH"}`);
    if (got !== want) bad++;
  }
  const withDiscord = await Member.countDocuments({ discordId: { $exists: true } });
  line("members with Discord ID", withDiscord);
  if (bad) throw new Error(`${bad} count mismatch(es). Investigate before using this database.`);
  console.log("\nMigration complete and validated. Firebase is untouched.\n");
}

main()
  .catch((err) => {
    console.error(`\nFAILED: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
