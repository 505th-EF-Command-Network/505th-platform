import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { EnlistError, createEnlistment, getInstructors, validateEnlist } from "@/lib/enlist";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** POST the enlistment form. Creates a pending personnel file for the signed-in Discord user. */
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Please sign in with Discord first." }, 401);
  if (viewer.member) return json({ error: "You already have a personnel file." }, 409);
  if (!viewer.inGuild) return json({ error: "Join the 505th Discord server first." }, 403);

  const text = await req.text();
  if (text.length > 10_000) return json({ error: "Request too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const checked = validateEnlist(body, await getInstructors());
  if (!checked.ok) return json({ errors: checked.errors }, 422);
  try {
    await createEnlistment(viewer, checked.value);
  } catch (e) {
    if (e instanceof EnlistError) return json({ error: e.message }, 409);
    console.error("[enlist]", (e as Error).message);
    return json({ error: "Could not save your enlistment. Please try again." }, 500);
  }
  return json({ ok: true });
}
