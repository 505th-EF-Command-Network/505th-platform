import { NextResponse, type NextRequest } from "next/server";
import { TerminalDoc } from "@505th/db";
import { getViewer } from "@/lib/auth/session";
import { DEFAULT_PREFS, cleanPhoto, cleanPrefs, myUserDoc, syncPhoto } from "@/lib/profile";

export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } });

/** GET → my picture + alert settings. */
export async function GET() {
  const v = await getViewer();
  if (!v) return json({ error: "unauthenticated" }, 401);
  const me = await myUserDoc(v);
  if (!me) return json({ error: "No member record" }, 404);
  const d = await syncPhoto(me.uid, me.data, v.avatar);
  return json({ photo: d.photo ?? { source: "discord", url: null, zoom: 100, x: 50, y: 50 }, photoUrl: d.photoUrl ?? null, discordAvatarUrl: d.discordAvatarUrl ?? null, notifyPrefs: { ...DEFAULT_PREFS, ...(d.notifyPrefs ?? {}) } });
}

/** POST { photo? , notifyPrefs? } — only your OWN picture and settings. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const v = await getViewer();
  if (!v) return json({ error: "unauthenticated" }, 401);
  if (!v.member || !["ACTIVE", "LOA", "RESERVE"].includes(v.member.status)) return json({ error: "Only active members can change their profile" }, 403);
  const me = await myUserDoc(v);
  if (!me) return json({ error: "No member record" }, 404);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const set: Record<string, unknown> = {};
  if (body.photo) {
    const photo = cleanPhoto(body.photo, me.data.photo);
    set["data.photo"] = photo;
    set["data.photoUrl"] = photo.source === "upload" && photo.url ? photo.url : v.avatar ?? me.data.discordAvatarUrl ?? null;
  }
  if (body.notifyPrefs) set["data.notifyPrefs"] = cleanPrefs(body.notifyPrefs);
  if (!Object.keys(set).length) return json({ error: "Nothing to save" }, 400);
  await TerminalDoc.updateOne({ _id: `users/${me.uid}` }, { $set: { ...set, updateTime: new Date() } });
  return json({ ok: true, photoUrl: set["data.photoUrl"] ?? me.data.photoUrl ?? null });
}
