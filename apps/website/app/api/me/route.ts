import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Minimal signed-in state for the site navigation. No private data. */
export async function GET() {
  const v = await getViewer().catch(() => null);
  const body = v
    ? {
        signedIn: true,
        name: v.member?.displayName ?? v.discordUsername,
        role: v.member?.roleLabel ?? null,
        avatar: v.avatar,
        terminal: v.terminal.result === "GRANTED",
      }
    : { signedIn: false };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
