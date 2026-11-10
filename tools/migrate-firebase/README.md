# Firebase → MongoDB migration

Copies the **verified Firebase backup** into MongoDB Atlas. Firebase itself is never touched.

## Safety

- **Dry run by default.** Nothing is written unless you add `--apply`.
- Checks every backup file's SHA-256 against `manifest.json` first.
- **Refuses to write** into a database that already has members (no overwrite).
- Runs inside one MongoDB transaction: it all goes in, or nothing does.
- **Secrets are dropped**: `settings/site.botHttpToken`, `botHttpUrl` and every webhook URL in `settings/webhooks`. Put those in environment variables instead.
- **Passwords are not migrated.** Sign-in moves to Discord.
- Prints counts only — no names, emails or IDs.
- Every migrated document keeps its Firebase id in `legacyId`.

## What goes where

| Firebase | MongoDB |
|---|---|
| `users` | `members` (status `approved` → `ACTIVE`; leavers → `LEFT_UNIT`) |
| `attendance_events` | `attendance_events` (member refs; unknown ids kept in `unmatchedLegacyIds`) |
| `attendance_history` | `attendance_snapshots` |
| `aars` | `aars` (all text fields kept in `sections`) |
| `audit_logs`, `audit_log` | `audit_logs` |
| `settings` (page_content, unit_cards, roster_meta, site) | `site_content` (secrets removed) |
| `unit_config` | `unit_status` |
| conversations, notifications, media, comms_media, presence_sessions, admin_notifications | `legacy_docs` (raw copy, nothing lost) |

## Run it (Windows PowerShell, from the repo root)

```powershell
npm install

# 1. Dry run — read-only, shows counts and warnings
npm run migrate -w @505th/migrate-firebase -- `
  --backup "F:\505th Exp Force Design Dev Works\505th-firebase-backups\backup-2026-11-08T18-41-33-393Z" `
  --left-unit "F:\505th Exp Force Design Dev Works\505th-firebase-backups\left-unit.json"

# 2. Test import into a throwaway database first
$env:MONGODB_URI = "<your Atlas connection string>"   # never commit this
npm run migrate -w @505th/migrate-firebase -- --backup "<same>" --left-unit "<same>" --db 505th_test --apply

# 3. Check it in Atlas (Browse Collections → 505th_test). Happy? Import for real:
npm run migrate -w @505th/migrate-firebase -- --backup "<same>" --left-unit "<same>" --db 505th --apply
```

`left-unit.json` is a JSON list of Firebase uids or "First Last" names of members who left. It lives next to the backups, **not** in this repo.

## Original Command Terminal data (`terminal_fs`)

The original terminal (`/terminal`, the old admin.html) still uses Firestore-style
data. `seed-terminal` copies the same backup into the `terminal_fs` collection
(one document per Firestore document, secrets removed). Edits to `users` in the
terminal are mirrored into `members` automatically.

```powershell
# Dry run
npm run seed-terminal -w @505th/migrate-firebase -- --backup "<backup folder>"

# Write (refuses if terminal_fs already has data). Run from tools\migrate-firebase:
npx tsx --env-file="<path to .env>" src/seed-terminal.ts --backup "<backup folder>" --apply
```

## Rollback

Nothing in Firebase changes, so rollback = drop the MongoDB database and keep using Firebase.
