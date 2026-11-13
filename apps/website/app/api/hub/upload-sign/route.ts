import { createHash } from "node:crypto";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";

export const dynamic = "force-dynamic";
/** Folder → access key needed (same folders as /api/terminal/upload-sign). */
const FOLDERS: Record<string, string> = { "505th_aar": "aar", "505th_gallery": "media", "505th_projects": "proj", "505th_msg": "", "505th_notes": "", "505th_sounds": "" };

/**
 * POST { folder } → { cloudName, apiKey, timestamp, folder, signature } for the app (bearer token).
 * Signs one Cloudinary upload; the API secret never leaves the server. Same signature as the Terminal's upload-sign.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const folder = String(((await req.json().catch(() => null)) ?? {}).folder ?? "");
  const key = FOLDERS[folder];
  if (key === undefined) return hubJson({ error: "Bad folder" }, 400);
  // "" = any signed-in staff (Messages images).
  if (key && !can(a.role, a.access, key)) return hubJson({ error: "permission-denied" }, 403);
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return hubJson({ error: "Uploads not configured" }, 503);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  return hubJson({ cloudName, apiKey, timestamp, folder, signature });
}
