import { getHubActor, hubJson } from "@/lib/hub/auth";
import { omGet, omPost } from "@/lib/terminal/om";

export const dynamic = "force-dynamic";
/** Officer Management for the Hub — same rules as the website (om.ts). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  return omGet({ uid: a.uid, role: a.role, access: a.access, displayName: a.displayName });
}
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  return omPost({ uid: a.uid, role: a.role, access: a.access, displayName: a.displayName }, await req.json().catch(() => null));
}
