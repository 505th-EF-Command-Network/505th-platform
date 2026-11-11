import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const WIDGETS = new Set(["kpi", "next", "me", "att", "alerts", "staff", "recruit", "bct", "events", "system", "activity", "quick"]);
const str = (v: unknown, max = 60) => String(v ?? "").slice(0, max);

/**
 * POST /api/hub/prefs { dash?, nav? } → saves the person's own app layout to users/{uid}.hubPrefs
 * (dashboard widgets + sizes, menu order / hidden groups / pins / collapsed), so it's the same on every PC.
 * Only the signed-in person's own record; values are checked and capped.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const set: U = {};
  if (Array.isArray(b.dash)) {
    const seen = new Set<string>();
    set["data.hubPrefs.dash"] = b.dash.slice(0, 20).map((x: unknown): [string, number] | null => (Array.isArray(x) ? [str(x[0], 20), Math.max(1, Math.min(5, Number(x[1]) || 2))] : null))
      .filter((x: [string, number] | null): x is [string, number] => !!x && WIDGETS.has(x[0]) && !seen.has(x[0]) && !!seen.add(x[0]));
  }
  if (b.nav && typeof b.nav === "object") {
    const n = b.nav as U, list = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x)) : []);
    set["data.hubPrefs.nav"] = { order: list(n.order), hidden: list(n.hidden), pins: list(n.pins, 12), closed: list(n.closed), rail: !!n.rail };
  }
  if (!Object.keys(set).length) return hubJson({ error: "Nothing to save." }, 400);
  await TerminalDoc.updateOne({ _id: `users/${a.uid}` }, { $set: set });
  return hubJson({ ok: true });
}
