export * from "./connection.ts";
export * from "./models.ts";
export * from "./ranks.ts";
export * from "./roles.ts";
export * from "./names.ts";

import { rankByKey } from "./ranks.ts";
import { displayName } from "./names.ts";

/** Display name straight from a member record. */
export function memberDisplayName(m: {
  rankKey?: string | null;
  rankRaw?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  callsign?: string | null;
}): string {
  return displayName({ ...m, rankAbbrev: rankByKey(m.rankKey)?.abbrev ?? m.rankRaw ?? "" });
}
export * from "./legacy.ts";
