import { getHubActor, hubJson } from "@/lib/hub/auth";
import { downloadUrl, latestRelease } from "@/lib/hub/release";

export const dynamic = "force-dynamic";
/**
 * GET /api/hub/update?v=<installed version> → the newest Hub release (release v0.1 · R3 updater).
 * Only for signed-in people with Hub Access (getHubActor checks that). `url` is a short-lived signed link to the installer —
 * the app downloads it, checks the SHA-256, then runs it silently. GitHub and the token stay hidden.
 */
const parts = (v: string) => v.split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
const newer = (a: string, b: string) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) { if (x[i]! !== y[i]!) return x[i]! > y[i]!; } return false; };
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const have = new URL(req.url).searchParams.get("v") ?? "0.0.0";
  const rel = await latestRelease();
  if (!rel) return hubJson({ available: false, latest: have });
  if (!newer(rel.version, have)) return hubJson({ available: false, latest: rel.version });
  const url = new URL(req.url).searchParams.get("download") ? await downloadUrl(rel) : null;
  return hubJson({ available: true, latest: rel.version, notes: rel.notes, sizeMB: rel.sizeMB, sha256: rel.sha256, dateISO: rel.dateISO, file: rel.file, url });
}
