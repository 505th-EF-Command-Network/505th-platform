import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { TERMINAL_CLEARANCE, clearanceOf } from "@505th/db";

export const dynamic = "force-dynamic";

const FOLDERS = new Set(["505th_gallery", "505th_aar", "505th_comms", "505th_msg", "505th_discord", "505th_projects"]);
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * POST { folder } → { cloudName, apiKey, timestamp, folder, signature }
 * Signs one Cloudinary upload for terminal staff. The API secret never leaves the server.
 * Signature = sha1("folder=<f>&timestamp=<t>" + secret), per Cloudinary's signed-upload docs.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);

  let actor;
  try {
    actor = await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return json({ error: code }, code === "unauthenticated" ? 401 : 403);
  }
  if (clearanceOf(actor.role) < TERMINAL_CLEARANCE) return json({ error: "permission-denied" }, 403);

  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return json({ error: "Uploads not configured" }, 503);

  let folder = "";
  try {
    folder = String((await req.json())?.folder ?? "");
  } catch {}
  if (!FOLDERS.has(folder)) return json({ error: "Bad folder" }, 400);

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  return json({ cloudName, apiKey, timestamp, folder, signature });
}
