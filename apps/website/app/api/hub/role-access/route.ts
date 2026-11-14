import { getHubActor, hubJson } from "@/lib/hub/auth";
import { raGet, raPost } from "@/lib/terminal/role-access";

export const dynamic = "force-dynamic";
/** Officer Management for the Hub — same rules as the website (role-access.ts). */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  return raGet({ uid: a.uid, role: a.role, access: a.access, displayName: a.displayName });
}
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  return raPost({ uid: a.uid, role: a.role, access: a.access, displayName: a.displayName }, await req.json().catch(() => null));
}
