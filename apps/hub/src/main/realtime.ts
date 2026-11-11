import * as Ably from "ably";

/*
 * The 505th Net (Ably channel "505th-live") — the same live line the website Terminal and Cortana use.
 * Same method as the RCD Hub: the app only LISTENS, using a 1-hour token request from /api/hub/realtime
 * (listen-only, can't publish). Each message is just a topic name ("users", "notifications"…);
 * the app then reloads that data through the website API. Never any data on the line itself.
 * If Ably isn't set up or is unreachable, the app keeps working with a 2-minute check.
 */
export type RealtimeState = "off" | "connecting" | "live";
type Api = (path: string, init?: RequestInit) => Promise<Response>;
const CHANNEL = "505th-live";

export function createRealtime(o: { api: Api; onTopic: (t: string) => void; onState: (s: RealtimeState, why: string | null) => void }) {
  let client: Ably.Realtime | null = null;
  let state: RealtimeState = "off";
  let reason: string | null = null;
  const setState = (s: RealtimeState, why: string | null = null) => {
    if (s === state && why === reason) return;
    state = s;
    reason = s === "live" ? null : why;
    o.onState(s, reason);
  };

  function start(): void {
    if (client) return;
    client = new Ably.Realtime({
      authCallback: (_p, cb) => {
        o.api("/api/hub/realtime")
          .then(async (res) => {
            const b = (await res.json().catch(() => ({}))) as Ably.TokenRequest & { error?: string };
            if (!res.ok) throw new Error(b.error ?? `Website error ${res.status}`);
            cb(null, b);
          })
          .catch((e: unknown) => cb(e instanceof Error ? e.message : "token error", null));
      },
      autoConnect: true,
      echoMessages: false,
      // Keep trying in the background; the 2-minute check covers any gaps.
      disconnectedRetryTimeout: 15_000,
      suspendedRetryTimeout: 60_000,
    });
    client.connection.on((c) => {
      if (c.current === "connected") setState("live");
      else if (c.current === "connecting" || c.current === "disconnected") setState("connecting");
      else setState("off", c.reason?.message ?? null);
      if (c.reason) console.error("[505th net]", c.current, c.reason.message);
    });
    void client.channels.get(CHANNEL).subscribe((m) => { if (typeof m.name === "string") o.onTopic(m.name); });
  }
  function stop(): void {
    client?.close();
    client = null;
    setState("off");
  }
  return { start, stop, getState: () => ({ state, reason }) };
}
