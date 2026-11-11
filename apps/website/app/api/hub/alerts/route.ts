import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";

/** POST /api/hub/alerts { ids?: string[], all?: true } → mark the person's own alerts as read. */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as { ids?: unknown; all?: unknown };
  const parent = `notifications/${a.uid}/items`;
  const ids = Array.isArray(b.ids) ? b.ids.map(String).filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 100) : [];
  if (!b.all && !ids.length) return hubJson({ error: "Nothing to mark." }, 400);
  await TerminalDoc.updateMany(b.all ? { parent, "data.read": { $ne: true } } : { parent, docId: { $in: ids } }, { $set: { "data.read": true, updateTime: new Date() } });
  return hubJson({ ok: true });
}
