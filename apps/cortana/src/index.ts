/**
 * Cortana v2 — 505th Expeditionary Force Discord bot.
 * Talks to the website ONLY through MongoDB (see apps/cortana/README.md).
 */
import { ActivityType, Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { connectDb, disconnectDb } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { checkGuilds, isAuthorisedGuild } from "./guard.ts";
import { markOffline, noteError, startHeartbeat } from "./health.ts";
import { checkNow, startMonitors } from "./monitors.ts";
import { startControl } from "./control.ts";
import { startNoteReminders } from "./notes-reminders.ts";
import { startStaffWatch } from "./staff-watch.ts";
import { startStaffPresence } from "./presence.ts";
import { PermanentJobError, registerJob, startJobWorker, wake } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { onDbChange, startLive } from "./live.ts";
import { cortanaSettings } from "./util.ts";
import { onMemberUpdate, onUserDocChange, startRoleSync } from "./rolesync.ts";
import { startMessages } from "./messages.ts";
import { startQuickUpload } from "./quick-upload.ts";
import { handleInfoButton, handleInfoMenu, startInfoPosts } from "./info-posts.ts";
import { handleTicketButton, handleTicketModal, onTicketMessage, startTickets } from "./tickets.ts";
import { startModeration } from "./moderation.ts";
import { startModlist } from "./modlist.ts";
import { startLegacyImport } from "./legacy-import.ts";
import { startCleanup } from "./cleanup.ts";
import { startAar } from "./aar.ts";
import { startMonthlyReset } from "./monthly-reset.ts";
import { startDiscordAudit } from "./audit-discord.ts";
import { startAuditCleanup } from "./audit-cleanup.ts";
import { onJoin, onLeave, onMessageDelete, onMessageEdit } from "./logs.ts";
import { handleCommandButton, handleCommandModal } from "./commands/staff.ts";
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
    GatewayIntentBits.GuildModeration, // bans (Audit Log). Not privileged.
    GatewayIntentBits.GuildInvites, // invite used on join (Audit Log). Not privileged.
    GatewayIntentBits.GuildVoiceStates, // who is in which voice channel (Dashboard → Staff Online). Not a privileged intent.
    // Staff Discord status (Dashboard → Staff Online). Privileged: only when PRESENCE_INTENT=true in .env.local.
    ...(env.PRESENCE_INTENT ? [GatewayIntentBits.GuildPresences] : []),
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel, Partials.User],
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
  startMonitors(ready);
  // Network Status → "↻ CHECK NOW" (website / Hub).
  registerJob("net.check", async () => { await checkNow(ready); return { ok: true }; });
  void startStaffPresence(ready);
  await syncGuild(ready).catch((e) => log.error("First sync failed", e));
  await registerCommands().catch((e) => log.error("Command registration failed", e));
  registerJob("sync.now", async (_j, c) => (await syncGuild(c), { at: new Date().toISOString() })); // Cortana Setup "RE-SYNC"
  startMessages();
  startQuickUpload();
  startInfoPosts(ready);
  startTickets(ready);
  startAar();
  startMonthlyReset();
  startNoteReminders(); // Notes v2 ⏰ reminders → 🔔 alert + Hub pop-up
  startStaffWatch(); // owner only: 🟢 staff came online (Discord / Hub / website)
  startDiscordAudit(ready); // Audit Log v3 — Discord server events
  startAuditCleanup(ready); // Audit Log v3 — monthly clean-up, clear, archives
  startModeration();
  startModlist();
  startLegacyImport();
  startCleanup(ready);
  startRoleSync(ready);
  onDbChange((top, c) => { if (top === "users") void onUserDocChange(ready, c).catch(() => {}); });
  registerJob("commands.register", async (job) => {
    if (!(await uidAllowed(job.data.requestedBy, "bot")).ok) throw new PermanentJobError("Only Developers / Command can do that");
    await registerCommands();
    return { ok: true };
  });
  // Restart / Update & Restart / Shut down: control.ts (Control Password + one-time ticket from the website).
  startControl(ready);
  stopEvents = startEvents(ready); // registers event jobs before the worker starts
  stopWorker = startJobWorker(ready);
  startLive(() => wake());
  // Presence: Settings → CORTANA (website). Applied at start and whenever settings change.
  const applyPresence = async () => {
    const c = await cortanaSettings().catch(() => ({} as Record<string, any>));
    const type = ({ playing: ActivityType.Playing, listening: ActivityType.Listening, watching: ActivityType.Watching, competing: ActivityType.Competing } as Record<string, ActivityType>)[String(c.activityType || "watching")] ?? ActivityType.Watching;
    ready.user.setActivity(String(c.activityText || "the 505th Deployment").slice(0, 128), { type });
  };
  void applyPresence();
  onDbChange((top) => { if (top === "settings") void applyPresence(); });
});

for (const evt of [Events.ChannelCreate, Events.ChannelDelete, Events.ChannelUpdate, Events.GuildRoleCreate, Events.GuildRoleDelete, Events.GuildRoleUpdate, Events.GuildEmojiCreate, Events.GuildEmojiDelete, Events.GuildEmojiUpdate] as const) {
  client.on(evt, () => scheduleSync(client));
}

client.on(Events.GuildScheduledEventCreate, (se) => client.isReady() && void onDiscordEventCreate(client, se).catch((e) => log.error("Discord event create", e)));
client.on(Events.GuildScheduledEventUpdate, (_o, se) => client.isReady() && void onDiscordEventUpdate(client, se).catch((e) => log.error("Discord event update", e)));
client.on(Events.GuildScheduledEventDelete, (se) => client.isReady() && void onDiscordEventDelete(client, se).catch((e) => log.error("Discord event delete", e)));

client.on(Events.GuildMemberUpdate, (before, after) => client.isReady() && void onMemberUpdate(client, before, after).catch((e) => log.warn(`Role sync failed: ${(e as Error).message}`)));

client.on(Events.GuildMemberAdd, (m) => void onJoin(client, m).catch((e) => log.warn(`Join log failed: ${(e as Error).message}`)));
client.on(Events.GuildMemberRemove, (m) => void onLeave(client, m).catch(() => {}));
client.on(Events.MessageDelete, (m) => void onMessageDelete(client, m).catch(() => {}));
client.on(Events.MessageUpdate, (a, b) => void onMessageEdit(client, a, b).catch(() => {}));

client.on(Events.MessageCreate, (m) => void onTicketMessage(m).catch((e) => log.warn(`Ticket message failed: ${(e as Error).message}`)));

client.on(Events.InteractionCreate, async (i) => {
  if ((i.isButton() || i.isStringSelectMenu()) && isAuthorisedGuild(i.guildId)) {
    try {
      if (i.isStringSelectMenu()) await handleInfoMenu(i);
      else (await handleCommandButton(i)) || (await handleTicketButton(i)) || (await handleInfoButton(i)) || (await handleEventButton(i));
    } catch (e) {
      noteError();
      log.error("Button failed", e);
      if (i.deferred) await i.editReply("⚠️ Something went wrong — it has been logged.").catch(() => {});
    }
    return;
  }
  if (i.isModalSubmit() && isAuthorisedGuild(i.guildId)) {
    try { (await handleTicketModal(i)) || (await handleCommandModal(i)); } catch (e) { noteError(); log.error("Form failed", e); if (!i.replied) await i.reply({ content: "⚠️ Something went wrong — it has been logged.", flags: MessageFlags.Ephemeral }).catch(() => {}); }
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
