/** Console log with time and level. Never log tokens, connection strings or message contents of DMs. */
const t = () => new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Europe/London" });
/** Recent lines for Command Centre → Bot Server (LOGS / ERRORS tabs). Saved by logsync.ts. */
export const recent = { lines: [] as string[], errors: [] as string[], dirty: false };
const keep = (line: string, err: boolean) => {
  const l = line.slice(0, 500);
  recent.lines.push(l); if (recent.lines.length > 300) recent.lines.splice(0, recent.lines.length - 300);
  if (err) { recent.errors.push(`${new Date().toISOString().slice(0, 10)} ${l}`); if (recent.errors.length > 100) recent.errors.splice(0, recent.errors.length - 100); }
  recent.dirty = true;
};
const out = (fn: (s: string) => void, line: string, err = false) => { fn(line); keep(line, err); };
export const log = {
  info: (m: string) => out(console.log, `${t()} · ${m}`),
  ok: (m: string) => out(console.log, `${t()} ✓ ${m}`),
  warn: (m: string) => out(console.warn, `${t()} ⚠ ${m}`),
  error: (m: string, e?: unknown) => out(console.error, `${t()} ✕ ${m}${e ? ` — ${(e as Error)?.message ?? e}` : ""}`, true),
};
