import "server-only";
import { redirect } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/auth/session";

/**
 * Every Command Terminal page and action calls this first.
 * Not signed in → /login. Signed in without clearance → /boot (shows why).
 */
export async function requireTerminal(): Promise<Viewer & { member: NonNullable<Viewer["member"]> }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/terminal");
  if (viewer.terminal.result !== "GRANTED" || !viewer.member) redirect("/boot");
  return viewer as Viewer & { member: NonNullable<Viewer["member"]> };
}
