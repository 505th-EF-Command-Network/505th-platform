import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } });

/** Signs ONE profile-picture upload (folder 505th_pfp) for an active member. Secret stays on the server. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const v = await getViewer();
  if (!v?.member || !["ACTIVE", "LOA", "RESERVE"].includes(v.member.status)) return json({ error: "Only active members can upload a picture" }, 403);
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return json({ error: "Uploads not configured" }, 503);
  const folder = "505th_pfp";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  return json({ cloudName, apiKey, timestamp, folder, signature });
}
