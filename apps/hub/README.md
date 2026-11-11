# apps/hub — 505th Command Network (Windows app)

Own code, like Cortana. Talks to:
- **Website** — `/api/hub/*` with the app token (same access rules as the Terminal, checked on the server)
- **505th Net** — listens on Ably `505th-live` (the website and Cortana send "this changed" topics)

Design copied from the RCD Hub (electron-vite + React + Tailwind).

Run: `npm install` (repo root) → `npm run dev -w @505th/hub`
Local website: `set CN_SITE=http://localhost:3000` before `npm run dev`.

Steps: H1 sign-in + 505th Net ✓ · H2 dashboard + status · H3 messages + alerts · H4 tray + app access · H5 installer + updates
