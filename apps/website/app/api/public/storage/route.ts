import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** GET /api/public/storage → { ready } — are the media upload keys (Cloudinary) set? For Cortana's Network Status. Never returns the keys. */
export function GET() {
  const ready = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  return NextResponse.json({ ready }, { headers: { "Cache-Control": "no-store" } });
}
