import { z } from "zod";

/**
 * Settings from apps/cortana/.env.local, checked at start-up.
 * If anything is wrong Cortana refuses to start and says which setting. Values are never printed.
 */
const snowflake = (name: string) => z.string().regex(/^\d{17,20}$/, `${name} must be a Discord ID (numbers only)`);
const schema = z.object({
  DISCORD_TOKEN: z.string().min(50, "DISCORD_TOKEN looks wrong (too short)"),
  DISCORD_CLIENT_ID: snowflake("DISCORD_CLIENT_ID"),
  AUTHORISED_GUILD_ID: snowflake("AUTHORISED_GUILD_ID"),
  CORTANA_CRED_ROLE_ID: snowflake("CORTANA_CRED_ROLE_ID").optional().or(z.literal("").transform(() => undefined)),
  // Defaults for events made directly in Discord / the mission log (the website settings override these)
  EVENT_CHANNEL_ID: snowflake("EVENT_CHANNEL_ID").optional().or(z.literal("").transform(() => undefined)),
  MISSION_LOG_CHANNEL_ID: snowflake("MISSION_LOG_CHANNEL_ID").optional().or(z.literal("").transform(() => undefined)),
  EVENTS_ROLE_ID: snowflake("EVENTS_ROLE_ID").optional().or(z.literal("").transform(() => undefined)),
  // Optional: website address for the "Open on website" button (e.g. https://www.505expeditionaryforce.com)
  SITE_URL: z.string().url("SITE_URL must be a full https:// address").optional().or(z.literal("").transform(() => undefined)),
  MONGODB_URI: z.string().startsWith("mongodb", "MONGODB_URI must start with mongodb"),
  MONGODB_DB: z.string().min(1).default("505th"),
  // "true" ONLY after Presence Intent is switched ON in the Developer Portal → Bot (otherwise Discord refuses the login).
  PRESENCE_INTENT: z.enum(["true", "false", ""]).optional().transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Cortana can't start — fix these in apps/cortana/.env.local:");
  for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(0); // exit 0 so PM2 doesn't restart-loop on a settings problem
}

export const env = parsed.data;
