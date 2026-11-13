/** Next.js hook: runs on every unhandled server error. A broken / overloaded database connection is dropped,
 *  so the next request reconnects instead of failing again for minutes (13 Nov 23:24). Node runtime only. */
export function register() {}
export async function onRequestError(err: unknown) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resetDbIfBroken } = await import("@505th/db");
  if (resetDbIfBroken(err)) console.warn("[db] connection reset after:", (err as Error)?.message?.slice(0, 120));
}
