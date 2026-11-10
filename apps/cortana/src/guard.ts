import type { Client } from "discord.js";
import { env } from "./env.ts";
import { log } from "./log.ts";

/*
 * SERVER LOCK — Cortana only works in ONE server (AUTHORISED_GUILD_ID).
 * Anything from another server is ignored. It does NOT leave automatically
 * (the same bot account may be in other servers on purpose).
 */
export const isAuthorisedGuild = (id: string | null | undefined) => id === env.AUTHORISED_GUILD_ID;

export function checkGuilds(client: Client<true>) {
  const others = client.guilds.cache.filter((g) => !isAuthorisedGuild(g.id));
  if (others.size) log.warn(`Also in ${others.size} other server(s) — ignored: ${others.map((g) => g.name).join(", ")}`);
  if (!client.guilds.cache.has(env.AUTHORISED_GUILD_ID)) log.warn("Cortana is not in the authorised server yet — invite the bot there.");
}
