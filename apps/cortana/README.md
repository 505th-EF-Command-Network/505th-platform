# apps/cortana — Cortana v2

505th Expeditionary Force Discord bot (discord.js 14 + TypeScript).
Talks to the website **only through MongoDB** — the same `terminal_fs` documents the Command Terminal uses.

```
Website / Hub ──writes bot_jobs──────► MongoDB ◄──claims jobs, writes results── Cortana
Website / Hub ◄──reads bot_status, discord_channels, discord_roles── MongoDB ◄── Cortana
```

## Setup
1. `cp .env.example .env.local` and fill in `DISCORD_TOKEN` and `MONGODB_URI` (never commit, never paste in chat).
2. Developer Portal → Bot → Privileged Gateway Intents: turn ON **Server Members** and **Message Content**.
3. From the repo root: `npm install`
4. Run: `npm run dev -w @505th/cortana` (restarts on code changes) or `npm start -w @505th/cortana`.
5. Production: `pm2 start ecosystem.config.cjs` inside `apps/cortana`.

Only one program can use a bot token at a time — stop the old Cortana test bot before starting v2 with the same token.

## What it writes (read by the website)
| Document | What |
|---|---|
| `bot_status/cortana` | online, ping, CPU, memory, jobs queued, 24 h ping history, 30-day uptime minutes — every 30 s |
| `discord_channels/<id>` | channel list for pickers |
| `discord_roles/<id>` | role list for pickers |
| `bot_jobs/<id>` | `data.status` pending → processing → done / failed, `data.result`, `data.error` |

Cortana only claims job types it knows. Other jobs stay `pending` until a later version handles them.

## Commands
`/ping`, `/status`. Allowed if the member's website access allows it **or** they have the Cortana Cred role.

## Safety
- Works in ONE server (`AUTHORISED_GUILD_ID`). Anything from another server is ignored (it does not leave automatically).
- Never pings @everyone / roles unless a feature allows it.
- Settings are checked at start-up; it refuses to start and says which one is wrong. Values are never printed.
