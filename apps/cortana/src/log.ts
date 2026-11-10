/** Console log with time and level. Never log tokens, connection strings or message contents of DMs. */
const t = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
export const log = {
  info: (m: string) => console.log(`${t()} · ${m}`),
  ok: (m: string) => console.log(`${t()} ✓ ${m}`),
  warn: (m: string) => console.warn(`${t()} ⚠ ${m}`),
  error: (m: string, e?: unknown) => console.error(`${t()} ✕ ${m}${e ? ` — ${(e as Error)?.message ?? e}` : ""}`),
};
