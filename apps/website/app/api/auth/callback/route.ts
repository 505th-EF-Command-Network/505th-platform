import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb, Member, AuditLog } from "@505th/db";
import { appUrl, avatarUrl, exchangeCode, fetchGuildMember, fetchUser, revokeToken } from "@/lib/auth/discord";
import { SESSION_COOKIE, STATE_COOKIE, cookieOptions, createSession } from "@/lib/auth/session";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Discord sends the user back here with ?code&state. */
export async function GET(req: NextRequest) {
  const fail = (why: string) => NextResponse.redirect(`${appUrl()}/login?error=${why}`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get(STATE_COOKIE)?.value ?? "";
  const [savedState, next = "/boot"] = saved.split("|");
  if (req.nextUrl.searchParams.get("error")) return fail("cancelled");
  if (!code || !state || !savedState || !same(state, savedState)) return fail("state");

  try {
    const { access_token } = await exchangeCode(code);
    const [user, guildMember] = await Promise.all([fetchUser(access_token), fetchGuildMember(access_token)]);
    await revokeToken(access_token); // we only needed it once

    await connectDb();
    const member = await Member.findOne({ discordId: user.id }).select("_id").lean();
    if (member) await Member.updateOne({ _id: member._id }, { $set: { discordUsername: user.username } });
    const { token, maxAge } = await createSession({
      member: member?._id,
      discordId: user.id,
      discordUsername: user.username,
      discordAvatar: avatarUrl(user),
      inGuild: !!guildMember,
    });
    await AuditLog.create({ section: "security", action: "sign_in", actor: member?._id, actorName: user.username, details: guildMember ? "in server" : "not in server" });

    const res = NextResponse.redirect(`${appUrl()}${next}`);
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[auth] callback failed:", (err as Error).message);
    return fail("discord");
  }
}
