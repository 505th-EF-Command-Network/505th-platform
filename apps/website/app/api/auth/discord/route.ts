import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/auth/discord";
import { STATE_COOKIE, cookieOptions, newToken } from "@/lib/auth/session";

/** Only allow redirects back to our own pages (no open redirect). */
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/boot";
}

/** GET /api/auth/discord?next=/boot → Discord consent screen. */
export async function GET(req: NextRequest) {
  const state = newToken();
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, `${state}|${next}`, cookieOptions(600));
  return res;
}
