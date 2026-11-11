import "server-only";
import { TerminalDoc, connectDb } from "@505th/db";
import { setRoleDefaults } from "./access";

/** Loads settings/role_access into the access module (cached 20 s per server instance). Called by getActor(). */
let loadedAt = 0;
let pending: Promise<void> | null = null;

export async function loadRoleDefaults(force = false) {
  if (!force && Date.now() - loadedAt < 20_000) return;
  if (pending) return pending;
  pending = (async () => {
    try {
      await connectDb();
      const d = (await TerminalDoc.findById("settings/role_access", { data: 1 }).lean())?.data as { roles?: unknown } | undefined;
      setRoleDefaults(d?.roles ?? {});
      loadedAt = Date.now();
    } catch {
      /* keep the last good copy */
    } finally {
      pending = null;
    }
  })();
  return pending;
}
