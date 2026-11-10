/**
 * Cortana v2 — 505th Expeditionary Force Discord bot.
 * Talks to the website ONLY through MongoDB (see apps/cortana/README.md).
 */
import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { connectDb, disconnectDb } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { checkGuilds, isAuthorisedGuild } from "./guard.ts";
import { markOffline, noteError, startHeartbeat } from "./health.ts";
import { startJobWorker } from "./worker.ts";
import { scheduleSync, syncGuild } from "./sync.ts";
import { commandMap, registerCommands } from "./commands/index.ts";
import { allowed } from "./access.ts";
import { handleEventButton, onDiscordEventCreate, onDiscordEventDelete, onDiscordEventUpdate, startEvents } from "./events.ts";

const client = new Client({
  // GuildMembers + MessageContent are privileged: turn them ON in the Developer Portal.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents,
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
  // Never ping @everyone / roles unless a feature explicitly allows it.
  allowedMentions: { parse: [] },
});

let heartbeat: NodeJS.Timeout | undefined;
let stopWorker: (() => void) | undefined;
let stopEvents: (() => void) | undefined;

client.once(Events.ClientReady, async (ready) => {
  log.ok(`Logged in as ${ready.user.tag}`);
  checkGuilds(ready);
  await ready.guilds.cache.get(env.AUTHORISED_GUILD_ID)?.members.fetch().catch(() => {});
  heartbeat = startHeartbeat(ready);
  await syncGuild(ready).catch((e) => log.error("First sync failed", e));
  await registerCommands().catch((e) => log.error("Command registration failed", e));
  stopEvents = startEvents(ready); // registers event jobs before the worker starts
  stopWorker = startJobWorker(ready);
  ready.user.setActivity("the 505th Deployment", { type: 3 /* Watching */ });
});

for (const evt of [Events.ChannelCreate, Events.ChannelDelete, Events.ChannelUpdate, Events.GuildRoleCreate, Events.GuildRoleDelete, Events.GuildRoleUpdate] as const) {
  client.on(evt, () => scheduleSync(client));
}

client.on(Events.GuildScheduledEventCreate, (se) => client.isReady() && void onDiscordEventCreate(client, se).catch((e) => log.error("Discord event create", e)));
client.on(Events.GuildScheduledEventUpdate, (_o, se) => client.isReady() && void onDiscordEventUpdate(client, se).catch((e) => log.error("Discord event update", e)));
client.on(Events.GuildScheduledEventDelete, (se) => client.isReady() && void onDiscordEventDelete(client, se).catch((e) => log.error("Discord event delete", e)));

client.on(Events.InteractionCreate, async (i) => {
  if (i.isButton() && isAuthorisedGuild(i.guildId)) {
    try {
      await handleEventButton(i);
    } catch (e) {
      noteError();
      log.error("Button failed", e);
      if (i.deferred) await i.editReply("⚠️ Something went wrong — it has been logged.").catch(() => {});
    }
    return;
  }
  if (!i.isChatInputCommand()) return;
  if (!isAuthorisedGuild(i.guildId)) return;
  const cmd = commandMap.get(i.commandName);
  if (!cmd) return;
  try {
    const member = i.inCachedGuild() ? i.member : null;
    if (!(await allowed(member, cmd.key))) {
      await i.reply({ content: "⛔ You don't have access to this command.", flags: MessageFlags.Ephemeral });
      return;
    }
    await cmd.run(i);
  } catch (e) {
    noteError();
    log.error(`/${i.commandName} failed`, e);
    const reply = { content: "⚠️ Something went wrong — it has been logged.", flags: MessageFlags.Ephemeral } as const;
    if (i.deferred || i.replied) await i.followUp(reply).catch(() => {});
    else await i.reply(reply).catch(() => {});
  }
});

client.on(Events.Error, (e) => {
  noteError();
  log.error("Discord client error", e);
});

async function shutdown(reason: string, code: number) {
  log.warn(`Shutting down (${reason})…`);
  clearInterval(heartbeat);
  stopWorker?.();
  stopEvents?.();
  await markOffline(reason);
  await client.destroy().catch(() => {});
  await disconnectDb().catch(() => {});
  process.exit(code);
}
process.on("SIGINT", () => void shutdown("stopped", 0));
process.on("SIGTERM", () => void shutdown("stopped", 0));
process.on("unhandledRejection", (e) => {
  noteError();
  log.error("Unhandled error", e);
});

log.info("Cortana v2 starting…");
await connectDb(env.MONGODB_URI, env.MONGODB_DB);
log.ok("Connected to MongoDB.");
await client.login(env.DISCORD_TOKEN);
