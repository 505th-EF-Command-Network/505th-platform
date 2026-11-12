import { NextResponse, type NextRequest } from "next/server";
import { FsError, getActor } from "@/lib/terminal/fs";
import { NoteError, createNote, deleteNote, listNotes, patchNote, type NoteWho } from "@/lib/notes/service";

export const dynamic = "force-dynamic";
/**
 * Notes v2 (website terminal). Same rules as the Hub (/api/hub/notes) — see lib/notes/service.ts.
 *   GET → { notes, people, groups, colours }   POST {title, body, color, folder, tags, x, y, rem} → create
 *   PATCH {id, …fields}   DELETE ?id=
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function who(req?: NextRequest): Promise<NoteWho | Response> {
  if (req && req.method !== "GET") { const o = req.headers.get("origin"); if (!o || o !== req.nextUrl.origin) return json({ error: "Bad origin" }, 403); }
  try { const a = await getActor(); return { uid: a.uid, role: a.role, access: a.access, name: a.displayName || "Staff" }; }
  catch (e) { const c = e instanceof FsError ? e.code : "unavailable"; return json({ error: c }, c === "unauthenticated" ? 401 : c === "unavailable" ? 503 : 403); }
}
const fail = (e: unknown) => (e instanceof NoteError ? json({ error: e.message }, e.status) : (console.error("[notes]", (e as Error)?.message), json({ error: "Something went wrong." }, 500)));
const body = async (req: NextRequest) => ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

export async function GET() { const w = await who(); if (w instanceof Response) return w; try { return json(await listNotes(w)); } catch (e) { return fail(e); } }
export async function POST(req: NextRequest) { const w = await who(req); if (w instanceof Response) return w; try { return json(await createNote(w, await body(req))); } catch (e) { return fail(e); } }
export async function PATCH(req: NextRequest) { const w = await who(req); if (w instanceof Response) return w; try { return json(await patchNote(w, await body(req))); } catch (e) { return fail(e); } }
export async function DELETE(req: NextRequest) { const w = await who(req); if (w instanceof Response) return w; try { return json(await deleteNote(w, req.nextUrl.searchParams.get("id") || "")); } catch (e) { return fail(e); } }
