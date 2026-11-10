/**
 * Channel + role lists for the website's pickers (Send Message, Events, Info Posts, Role Map).
 * Written to `discord_channels/<id>` and `discord_roles/<id>`; old ones are removed.
 */
import { ChannelType, PermissionFlagsBits, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";

const TYPE: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "text", [ChannelType.GuildAnnouncement]: "announcement", [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildStageVoice]: "stage", [ChannelType.GuildCategory]: "category", [ChannelType.GuildForum]: "forum",
};

async function replaceAll(parent: string, docs: { id: string; data: Record<string, unknown> }[]) {
  const now = new Date();
  if (docs.length) {
    await TerminalDoc.bulkWrite(docs.map((d) => ({
      updateOne: { filter: { _id: `${parent}/${d.id}` }, update: { $set: { parent, docId: d.id, data: d.data, updateTime: now }, $setOnInsert: { createTime: now } }, upsert: true },
    })));
  }
  await TerminalDoc.deleteMany({ parent, docId: { $nin: docs.map((d) => d.id) } });
}

export async function syncGuild(client: Client<true>) {
  const guild = client.guilds.cache.get(env.AUTHORISED_GUILD_ID);
  if (!guild) return;
  const me = guild.members.me;
  const channels = [...guild.channels.cache.values()].map((c) => ({
    id: c.id,
    data: {
      name: c.name,
      type: TYPE[c.type] ?? "other",
      parentName: c.parent?.name ?? null,
      position: "rawPosition" in c ? c.rawPosition : 0,
      botCanSend: !!me && c.isTextBased() && !!c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    },
  }));
  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      id: r.id,
      data: { name: r.name, color: r.hexColor, position: r.position, managed: r.managed, members: r.members.size, botCanAssign: !!me && !r.managed && r.position < me.roles.highest.position },
    }));
  await replaceAll("discord_channels", channels);
  await replaceAll("discord_roles", roles);
  log.info(`Synced ${channels.length} channels, ${roles.length} roles.`);
}

let timer: NodeJS.Timeout | undefined;
/** Debounced re-sync after channel / role changes. */
export function scheduleSync(client: Client) {
  clearTimeout(timer);
  timer = setTimeout(() => client.isReady() && void syncGuild(client).catch((e) => log.error("Sync failed", e)), 3000);
}
