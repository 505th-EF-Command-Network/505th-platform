# 505th Platform — Command Network

The digital command network for the **505th Expeditionary Force**, a UNSC / Halo-themed Arma 3 military simulation unit.

One monorepo for the systems that share one database (MongoDB Atlas) and one sign-in (Discord):

| System | What it is | Status |
|---|---|---|
| **505th Website** | Public site, member profile and the **Command Terminal** (staff admin). | ✅ Live on Vercel — www.505expeditionaryforce.com |
| **Cortana v2** | Discord bot — events and sign-ups, tickets, moderation, role sync, info posts, logs, uptime monitor. | ✅ Live on the home server (PM2: `Cortana_V2`) |
| **505th Hub** | Windows desktop app — the same Terminal tools, plus tray and desktop alerts. | ⏳ Planned (Phase 6) |

## Folders

```
apps/
  website/            Next.js website + Command Terminal
    app/              pages and API routes
    components/       React components
    lib/              server code (data, access rules, auth)
    legacy/           the original Command Terminal page (being replaced page by page)
    public/
      terminal-panels/  the new Terminal pages (one file per page)
      terminal-shim/    makes the old Terminal code talk to MongoDB instead of Firebase
    styles/           per-page stylesheets
  cortana/            Cortana v2 Discord bot (TypeScript, discord.js)
  hub/                505th Hub — placeholder
packages/
  db/                 MongoDB models shared by the website and Cortana
  auth/               placeholder (shared access rules will move here)
  ui/                 placeholder
tools/
  migrate-firebase/   one-off Firebase → MongoDB migration (kept as a record)
scripts/
  dev-all.mjs         run the website and Cortana together locally
```

## Run it locally

Requires Node 20+.

```bash
npm install                 # once, from the repo root
npm run dev:all             # website (http://localhost:3000) + Cortana
```

Secrets live only in `.env.local` files (never committed):
- `apps/website/.env.local` — see `.env.example` for the key names
- `apps/cortana/.env.local` — see `apps/cortana/.env.example`

Optional Cortana switch: `PRESENCE_INTENT=true` — only after Presence Intent is ON in the Discord Developer Portal (staff Discord status on the Dashboard).

## Deploying

- **Website:** push to GitHub → Vercel builds and deploys automatically.
- **Cortana:** on the home server, pull with GitHub Desktop, then `pm2 restart Cortana_V2`.

## Command Terminal access

Every page has an access key (e.g. `ev` = Events, `modw` = Warn / Timeout).
- **Role defaults** — Officer Management → *Role Access* (Developers / Command edit).
- **Per person** — Officer Management → *Members* (wins over the role).
- The Commander always has everything; Bot Server, Settings and Overall Status stay Developer + Commander only.

The same rules are checked by the website server and by Cortana.

## Rules for this repo

- Never commit secrets, member data or backups (`.gitignore` covers `.env*`, `backups/`, `*.ndjson`).
- Keep the public website's look the same as the original 505th site.
- New Terminal pages go in `apps/website/public/terminal-panels/`, one file per page.

## Roadmap

- [x] Phase 0 — Firebase backup and audit
- [x] Phase 1 — MongoDB Atlas migration
- [x] Phase 2 — Monorepo and shared database models
- [x] Phase 3 — Website rebuild (live)
- [x] Phase 4 — Discord sign-in and access control
- [x] Phase 5 — Cortana v2 (live)
- [ ] Phase 6 — 505th Hub desktop app
- [ ] Phase 7 — Replace the rest of the original Terminal page; move shared access rules to `packages/auth`
- [ ] Phase 8 — Firebase switched off (after sign-off)
- [ ] Phase 9 — Mobile apps
