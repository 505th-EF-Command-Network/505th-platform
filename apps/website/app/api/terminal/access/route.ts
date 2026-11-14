import { type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { omGet, omPost } from "@/lib/terminal/om";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function actor() {
  try { return { a: await getActor() }; } catch (e) { const code = e instanceof FsError ? e.code : "internal"; return { r: json({ error: code }, code === "unauthenticated" ? 401 : code === "internal" ? 503 : 403) }; }
}
/** Officer Management (website). Logic: lib/terminal/om.ts (same as the Hub). */
export async function GET() {
  const { a, r } = await actor();
  return a ? omGet(a) : r!;
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403);
  const { a, r } = await actor();
  if (!a) return r!;
  return omPost(a, await req.json().catch(() => null));
}
