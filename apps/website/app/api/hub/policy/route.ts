import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
/** 505th Software Use Policy acceptance (shown by the app before first use, and again when the version changes). */
export const POLICY_VERSION = "0.1";
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const p = ((await TerminalDoc.findById(`users/${a.uid}`, { "data.hubPolicy": 1 }).lean())?.data as { hubPolicy?: { version?: string; atISO?: string } } | undefined)?.hubPolicy;
  return hubJson({ version: POLICY_VERSION, accepted: p?.version === POLICY_VERSION, atISO: p?.atISO ?? "" });
}
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const b = ((await req.json().catch(() => null)) ?? {}) as { version?: unknown };
  if (b.version !== POLICY_VERSION) return hubJson({ error: "The policy changed — please read it again." }, 409);
  const now = new Date();
  await TerminalDoc.updateOne({ _id: `users/${a.uid}` }, { $set: { "data.hubPolicy": { version: POLICY_VERSION, atISO: now.toISOString(), device: a.deviceName }, updateTime: now } });
  return hubJson({ ok: true });
}
