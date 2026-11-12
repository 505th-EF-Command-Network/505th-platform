import { getHubActor, hubJson } from "@/lib/hub/auth";
import { NoteError, createNote, deleteNote, listNotes, patchNote, type NoteWho } from "@/lib/notes/service";

export const dynamic = "force-dynamic";
/** Notes v2 for the app. GET → list · POST {action: create | patch | delete, …}. Same rules as /api/terminal/notes. */
async function who(req: Request): Promise<NoteWho | null> {
  const a = await getHubActor(req);
  return a ? { uid: a.uid, role: a.role, access: a.access, name: a.displayName } : null;
}
const fail = (e: unknown) => (e instanceof NoteError ? hubJson({ error: e.message }, e.status) : hubJson({ error: "Something went wrong." }, 500));
export async function GET(req: Request) {
  const w = await who(req);
  if (!w) return hubJson({ error: "unauthenticated" }, 401);
  try { return hubJson(await listNotes(w)); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  const w = await who(req);
  if (!w) return hubJson({ error: "unauthenticated" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return hubJson({ error: "Bad request." }, 400);
  try {
    return hubJson(b.action === "create" ? await createNote(w, b) : b.action === "delete" ? await deleteNote(w, String(b.id ?? "")) : await patchNote(w, b));
  } catch (e) { return fail(e); }
}
