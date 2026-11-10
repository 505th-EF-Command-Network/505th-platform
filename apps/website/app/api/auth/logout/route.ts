import { NextResponse, type NextRequest } from "next/server";
import { Session, connectDb } from "@505th/db";
import { appUrl } from "@/lib/auth/discord";
import { SESSION_COOKIE, destroySession, getViewer } from "@/lib/auth/session";

/**
 * POST only, so a link or image on another site cannot sign people out.
 * Form field all=1 also signs this Discord account out on every other device.
 */
export async function POST(req: NextRequest) {
  let all = false;
  try {
    const f = await req.formData();
    all = f.get("all") === "1";
  } catch {}
  if (all) {
    const v = await getViewer();
    if (v) {
      await connectDb();
      await Session.deleteMany({ discordId: v.discordId });
    }
  }
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(`${appUrl()}/login?out=${all ? "all" : "1"}`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
