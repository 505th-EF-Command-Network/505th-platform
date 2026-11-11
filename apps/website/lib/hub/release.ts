/**
 * Hub releases (release v0.1). The installer lives on a GitHub release of the private platform repo, tagged "hub-v<version>".
 * The website reads it with a read-only token (Vercel env HUB_RELEASE_TOKEN — fine-grained, this repo, Contents: read).
 * Members never see GitHub: /api/terminal/hub-download checks Hub Access, then hands out a short-lived download link.
 * Optional env HUB_RELEASE_REPO (default 505th-EF-Command-Network/505th-platform).
 */
type U = Record<string, any>;
export type HubRelease = { version: string; tag: string; sizeMB: number; sha256: string; dateISO: string; notes: string[]; file: string; assetId: number };
const REPO = () => process.env.HUB_RELEASE_REPO || "505th-EF-Command-Network/505th-platform";
const gh = (path: string, init: RequestInit = {}) => fetch(`https://api.github.com/repos/${REPO()}${path}`, {
  ...init, signal: AbortSignal.timeout(8000),
  headers: { Authorization: `Bearer ${process.env.HUB_RELEASE_TOKEN ?? ""}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "505th-website", ...(init.headers ?? {}) },
});
let cache: { at: number; rel: HubRelease | null } | null = null;

/** Newest published (not draft, not pre-release) "hub-v*" release with a .exe. Cached 5 minutes. */
export async function latestRelease(): Promise<HubRelease | null> {
  if (!process.env.HUB_RELEASE_TOKEN) return null;
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rel;
  let rel: HubRelease | null = null;
  try {
    const r = await gh("/releases?per_page=20");
    if (r.ok) {
      const list = (await r.json()) as U[];
      const x = list.find((v) => !v.draft && !v.prerelease && String(v.tag_name).startsWith("hub-v") && (v.assets ?? []).some((a: U) => /\.exe$/i.test(a.name)));
      if (x) {
        const a = (x.assets as U[]).find((y) => /\.exe$/i.test(y.name))!;
        rel = { version: String(x.tag_name).replace(/^hub-v/, ""), tag: x.tag_name, sizeMB: Math.round((a.size / 1048576) * 10) / 10, sha256: String(a.digest ?? "").replace(/^sha256:/, ""),
          dateISO: x.published_at, file: a.name, assetId: a.id,
          notes: String(x.body ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, "").slice(0, 120)).slice(0, 8) };
      }
    }
  } catch { /* GitHub unreachable — keep the last answer */ if (cache) return cache.rel; }
  cache = { at: Date.now(), rel };
  return rel;
}

/** A short-lived (about 5 minutes) signed link straight to the installer file. */
export async function downloadUrl(rel: HubRelease): Promise<string | null> {
  const r = await gh(`/releases/assets/${rel.assetId}`, { headers: { Accept: "application/octet-stream" }, redirect: "manual" });
  return r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
}
