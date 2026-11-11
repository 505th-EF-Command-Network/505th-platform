import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
const STATES = new Set(["online", "dnd", "invisible", "offline"]);

/**
 * POST /api/hub/status { state, note?, untilISO? } → sets My Status (users/{uid}.myStatus).
 * Same field the website Dashboard and top bar use, so all three stay in step (505th Net signals "users").
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as { state?: unknown; note?: unknown; untilISO?: unknown } | null;
  const state = String(b?.state ?? "");
  if (!STATES.has(state)) return hubJson({ error: "Unknown status." }, 400);
  const note = String(b?.note ?? "").slice(0, 60);
  const until = typeof b?.untilISO === "string" && !Number.isNaN(Date.parse(b.untilISO)) && Date.parse(b.untilISO) > Date.now() ? new Date(b.untilISO).toISOString() : null;
  const myStatus = state === "online" ? { state: "online", note: "", untilISO: null } : { state, note, untilISO: until, setAtISO: new Date().toISOString() };
  const r = await TerminalDoc.updateOne({ _id: `users/${a.uid}` }, { $set: { "data.myStatus": myStatus, updateTime: new Date() } });
  if (!r.matchedCount) return hubJson({ error: "Your personnel file was not found." }, 404);
  return hubJson({ ok: true, myStatus });
}
