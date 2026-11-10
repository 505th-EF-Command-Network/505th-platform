/** Small shared helpers for Cortana feature modules. */
import { randomBytes } from "node:crypto";
import { PermissionFlagsBits, type Guild, type Role } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";

export const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
export const nowISO = () => new Date().toISOString();
export const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

/** Cortana Setup (settings/cortana) over the older bot_settings/cortana. */
export async function cortanaSettings(): Promise<Record<string, any>> {
  const [a, b] = await Promise.all([TerminalDoc.findById("bot_settings/cortana", { data: 1 }).lean(), TerminalDoc.findById("settings/cortana", { data: 1 }).lean()]);
  return { ...((a?.data ?? {}) as Record<string, any>), ...((b?.data ?? {}) as Record<string, any>) };
}

/** Write a website audit-log entry (Security → Audit Log). */
export async function auditLog(action: string, details: string, by: string, section = "discord") {
  const id = autoId();
  const now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section, action, details: details.slice(0, 500), by, role: "discord", uid: null, createdAtISO: now.toISOString() } }).catch(() => {});
}

/** Next number in a named counter (ticket numbers, case numbers). Atomic. */
export async function nextNumber(name: string): Promise<number> {
  const d = await TerminalDoc.findOneAndUpdate({ _id: "bot_state/counters" }, { $inc: { [`data.${name}`]: 1 }, $set: { parent: "bot_state", docId: "counters", updateTime: new Date() } }, { upsert: true, new: true, projection: { data: 1 } }).lean();
  return Number((d as any)?.data?.[name] ?? 1);
}

const DANGEROUS = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.MentionEveryone];
/** A role buttons may hand out: exists, not managed, below Cortana, and carries no staff/admin powers. */
export function safeRole(g: Guild, id: unknown): { role: Role | null; why: string } {
  const r = typeof id === "string" ? g.roles.cache.get(id) : undefined;
  if (!r || r.id === g.id) return { role: null, why: "That role no longer exists." };
  if (r.managed) return { role: null, why: "That role is managed by an app." };
  const me = g.members.me;
  if (!me || r.position >= me.roles.highest.position) return { role: null, why: "Cortana's role must be above that role (Server Settings → Roles)." };
  if (DANGEROUS.some((p) => r.permissions.has(p))) return { role: null, why: "That role has staff powers, so buttons can't give it out." };
  return { role: r, why: "" };
}

/** User / role mentions typed in text (<@id>, <@&id>). @everyone is never taken from text — only the confirmed ping option. */
export function mentionsIn(...texts: (string | null | undefined)[]): { users: string[]; roles: string[]; text: string } {
  const t = texts.filter(Boolean).join("\n");
  const users = [...new Set([...t.matchAll(/<@!?(\d{17,20})>/g)].map((m) => m[1]))].slice(0, 100);
  const roles = [...new Set([...t.matchAll(/<@&(\d{17,20})>/g)].map((m) => m[1]))].filter((r) => r !== env.AUTHORISED_GUILD_ID).slice(0, 100);
  return { users, roles, text: [...users.map((u) => `<@${u}>`), ...roles.map((r) => `<@&${r}>`)].join(" ") };
}
