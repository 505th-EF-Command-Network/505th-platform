import { NextResponse, type NextRequest } from "next/server";
import { getSiteContent } from "@/lib/public/content";

/** GET /api/public/site?page=about-505th → { slots, discordInvite }. Public, cached briefly. Used by SiteShell. */
const PAGES = new Set(["home", "about-505th", "about-alpha", "about-stalker", "about-corpsman", "about-54th"]);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("page");
  const page = p && PAGES.has(p) ? p : null;
  try {
    const data = await getSiteContent(page);
    return NextResponse.json(data, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ slots: {}, discordInvite: null });
  }
}
