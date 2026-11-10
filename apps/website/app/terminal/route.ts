import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * The ORIGINAL Command Terminal (admin.html), served as-is with Firebase
 * swapped for /terminal-shim (MongoDB via /api/terminal/fs) and sign-in
 * swapped for the Discord session.
 *
 * Sections are replaced one at a time after each redesign is approved.
 * The React terminal waiting for those redesigns lives in app/_terminal-v2.
 */
let cached: string | null = null;

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/login?next=/terminal", req.url));
  if (viewer.terminal.result !== "GRANTED") return NextResponse.redirect(new URL("/boot", req.url));

  const html =
    process.env.NODE_ENV === "production" && cached
      ? cached
      : (cached = await readFile(join(process.cwd(), "legacy", "terminal.html"), "utf8"));

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}
