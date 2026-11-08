# 505th Platform — Command Network

The digital command network for the **505th Expeditionary Force**, a UNSC / Halo-themed Arma 3 military simulation unit.

One monorepo for three connected systems that share a single database and sign-in:

| System | What it is |
|---|---|
| **505th Website** | Public site + member portal + Command Terminal (admin). Looks exactly like [505expeditionaryforce.com](https://www.505expeditionaryforce.com). |
| **505th Hub** | Windows desktop app for members and staff — same Command Terminal tools, quicker to reach. |
| **Cortana v2.0** | Discord bot — events, sign-ups, role sync, logging, announcements. |

## Tech stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, TypeScript, Zod validation
- **Database:** MongoDB Atlas (migrated from Firebase)
- **Sign-in:** Discord OAuth2 with role-based permissions
- **Discord:** discord.js (TypeScript)
- **Hosting:** Vercel

## Repository layout (planned)

```
apps/
  website/     Next.js website + Command Terminal
  hub/         505th Hub desktop app
  cortana/     Cortana v2.0 Discord bot
packages/
  db/          MongoDB models + Firebase migration scripts
  auth/        Discord OAuth2 + permissions
  ui/          Shared Command Terminal components
```

## Roadmap

- [x] **Phase 0** — Firebase backup and audit (verified 2026-11-08: 785 records, 32 accounts, 25/25 active members linked to a Discord ID)
- [ ] **Phase 1** — MongoDB Atlas design and migration testing
- [ ] **Phase 2** — Repository structure and shared services
- [ ] **Phase 3** — Website rebuild (exact visual match)
- [ ] **Phase 4** — Discord OAuth2 sign-in
- [ ] **Phase 5** — Cortana v2.0
- [ ] **Phase 6** — 505th Hub
- [ ] **Phase 7** — Integration, testing and security review
- [ ] **Phase 8** — Production migration
- [ ] **Phase 9** — Mobile apps and advanced automation

The current Firebase website stays live until the new platform is tested and approved.

## Security

- Never commit `.env` files, Discord bot tokens, database connection strings or Firebase keys.
- Secrets live in Vercel environment variables only.
- Member data and backups are never stored in this repository.

## Credits

Built by **REV Creative Developer** for the 505th Expeditionary Force.
