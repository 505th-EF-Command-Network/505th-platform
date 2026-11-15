import { getHubActor, hubJson } from "@/lib/hub/auth";
import { AuditError, auditDelete, auditList } from "@/lib/terminal/audit-core";

export const dynamic = "force-dynamic";
/** Audit Log in the app. GET ?days=1|7|30 → entries · POST { action: "delete", ids, reason } (Commander / Developer). */
const who = async (req: Request) => { const a = await getHubActor(req); return a ? { uid: a.uid, role: a.role, access: a.access, displayName: a.displayName } : null; };
const fail = (e: unknown) => (e instanceof AuditError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await auditList(a, Number(new URL(req.url).searchParams.get("days") ?? 7))); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const a = await who(req); if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || b.action !== "delete") return hubJson({ error: "Bad request." }, 400);
  try { return hubJson(await auditDelete(a, b.ids, b.reason)); } catch (e) { return fail(e); }
}
