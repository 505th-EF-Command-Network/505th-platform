/**
 * Instant updates (RCD-style, Ably). Cortana watches the shared database (MongoDB change stream on
 * terminal_fs) and sends a tiny "this changed" signal per collection on Ably channel "505th-live".
 * Only the collection name is sent — never any data. Open terminal pages re-load that section at once.
 * Also wakes the job worker the moment the website queues a job.
 * No ABLY_API_KEY → only the job wake-up runs; the website keeps polling as before.
 */
import { createHttpClient } from "@ably/pubsub-server";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";

const CHANNEL = "505th-live";
const QUIET = new Set(["presence_sessions"]);
const pending = new Set<string>();
let flushTimer: NodeJS.Timeout | undefined;

// Ably's server package: the 505th Ably account is on MAU pricing, which refuses SDKs that don't say
// whether they run on a server or a device (error 40168). Server traffic isn't counted as users.
let http: ReturnType<typeof createHttpClient> | null = null;
function publish(topics: string[]) {
  const key = process.env.ABLY_API_KEY || "";
  if (!key.includes(":") || !topics.length) return;
  http ??= createHttpClient({ key });
  void http.channels.get(CHANNEL).publish(topics.map((name) => ({ name, data: "" })))
    .catch((e: Error) => log.warn(`505th Net publish failed: ${e.message}`));
}
export function signal(topic: string) {
  if (QUIET.has(topic)) return;
  pending.add(topic);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { const t = [...pending]; pending.clear(); publish(t); }, 250);
}

type ChangeHook = (top: string, change: any) => void;
const hooks: ChangeHook[] = [];
/** Other modules (role sync) can react to database changes. */
export const onDbChange = (fn: ChangeHook) => void hooks.push(fn);

export function startLive(wakeJobs: () => void) {
  let stream: ReturnType<typeof TerminalDoc.watch> | null = null;
  let stopped = false;
  const open = () => {
    if (stopped) return;
    try {
      stream = TerminalDoc.watch([], { fullDocument: undefined });
      stream.on("change", (c: any) => {
        const id = String(c.documentKey?._id ?? "");
        const top = id.split("/")[0];
        if (!top) return;
        if (top === "bot_jobs" && c.operationType === "insert") wakeJobs();
        signal(top);
        for (const h of hooks) try { h(top, c); } catch { /* never break the stream */ }
      });
      stream.on("error", (e: Error) => {
        log.warn(`Live updates paused: ${e.message} — retrying in 30 s`);
        stream?.close().catch(() => {});
        stream = null;
        setTimeout(open, 30_000);
      });
    } catch (e) {
      log.warn(`Live updates unavailable: ${(e as Error).message}`);
    }
  };
  open();
  log.ok(process.env.ABLY_API_KEY?.includes(":") ? "Live updates on (Ably)." : "Live updates: job wake-up only (no ABLY_API_KEY).");
  return () => { stopped = true; void stream?.close().catch(() => {}); };
}
