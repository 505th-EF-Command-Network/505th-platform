import "server-only";

/**
 * New-member sign-up (enlistment). People only sign up AFTER passing BCT,
 * when their BCT instructor tells them to. The form creates a pending
 * personnel file in the same shape the original register form used, so the
 * Command Terminal shows it straight away.
 */
import { randomBytes } from "node:crypto";
import { connectDb, Member, TerminalDoc, clearanceOf } from "@505th/db";
import { syncMember } from "@/lib/terminal/fs";
import type { Viewer } from "@/lib/auth/session";
import type { EnlistInput } from "./enlist-core";

export { OTHER_INSTRUCTOR, RECRUIT_SOURCES, TIMEZONES, validateEnlist, type EnlistInput } from "./enlist-core";

const RANK_ABBR: Record<string, string> = {
  "O9 / Lieutenant General": "LtGen", "O8 / Major General": "MajGen", "O7 / Brigadier General": "BGen",
  "O6 / Colonel": "Col", "O5 / Lieutenant Colonel": "LtCol", "O4 / Major": "Maj", "O3 / Captain": "Capt",
  "O2 / First Lieutenant": "1stLt", "O1 / Second Lieutenant": "2ndLt", "E9 / Sergeant Major": "SgtMaj",
  "E9 / Master Gunnery Sergeant": "MGySgt", "E9 / First Sergeant": "1stSgt", "E8 / Master Sergeant": "MSgt",
  "E7 / Gunnery Sergeant": "GySgt", "E6 / Staff Sergeant": "SSgt", "E5 / Sergeant": "Sgt", "E4 / Corporal": "Cpl",
  "E3 / Lance Corporal": "LCpl", "E2 / Private First Class": "PFC", "E1 / Private": "Pvt",
  "E9 / Master Chief Hospital Corpsman": "MCPO", "E8 / Senior Chief Corpsman": "SCPO", "E7 / Chief Corpsman": "CPO",
  "E6 / Corpsman First Class": "HM1", "E5 / Corpsman Second Class": "HM2", "E4 / Corpsman Third Class": "HM3",
  "E6 / Technical Sergeant": "TSgt", "E5 / Staff Sergeant": "SSgt",
};

/** Same name format as everywhere else: SSgt S. "Davy" or Sgt G. Doyle. */
function legacyName(u: Record<string, any>) {
  const rank = RANK_ABBR[u.rank] || (u.rank ? String(u.rank).split("/").pop()!.trim() : "");
  const first = String(u.firstName || "").trim(), last = String(u.lastName || "").trim(), cs = String(u.callsign || "").trim();
  const name = `${first ? first[0].toUpperCase() + ". " : ""}${cs && cs !== first ? `"${cs}"` : last}`.trim();
  return [rank, name].filter(Boolean).join(" ");
}

/** BCT instructor choices: active members who are Recruiter or above. */
export async function getInstructors(): Promise<string[]> {
  await connectDb();
  const docs = await TerminalDoc.find({ parent: "users" }, { data: 1 }).lean();
  return docs
    .map((d) => (d.data ?? {}) as Record<string, any>)
    .filter((u) => u.status !== "pending" && u.status !== "denied" && clearanceOf(u.role) >= 2)
    .sort((a, b) => clearanceOf(b.role) - clearanceOf(a.role) || String(a.lastName).localeCompare(String(b.lastName)))
    .map(legacyName)
    .filter(Boolean);
}

const autoId = () => {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(28), (b) => abc[b % 62]).join("");
};

export class EnlistError extends Error {}

/** Creates the pending personnel file and its member record. */
export async function createEnlistment(viewer: Viewer, v: EnlistInput): Promise<void> {
  if (!viewer.inGuild) throw new EnlistError("You must be in the 505th Discord server.");
  await connectDb();
  if (await Member.exists({ discordId: viewer.discordId })) throw new EnlistError("You already have a personnel file.");
  if (await TerminalDoc.exists({ parent: "users", "data.discordId": viewer.discordId })) {
    throw new EnlistError("You already have a personnel file.");
  }
  const uid = autoId();
  const now = new Date();
  const iso = now.toISOString();
  await TerminalDoc.create({
    _id: `users/${uid}`,
    parent: "users",
    docId: uid,
    createTime: now,
    updateTime: now,
    data: {
      // Same fields as the original register form, so the original terminal shows it.
      callsign: "",
      firstName: v.firstName,
      middleName: v.middleInitial,
      lastName: v.lastName,
      recruitSource: v.recruitSource,
      email: "",
      role: "enlistee",
      status: "pending",
      rank: "",
      platoon: "",
      joinedAt: iso,
      registeredAt: iso,
      approvedBy: null,
      approvedAt: null,
      // New: Discord link and BCT details from the sign-up form.
      discordId: viewer.discordId,
      discordUsername: viewer.discordUsername,
      bctInstructor: v.instructor,
      bctDate: v.bctDate || null,
      timezone: v.timezone,
      signupSource: "website",
    },
  });
  await syncMember(uid, false);
  await postRegistrationWebhook(v, viewer).catch(() => {});
}

/** Fires the "registration" Discord webhook if staff have set one. Server-side only. */
async function postRegistrationWebhook(v: EnlistInput, viewer: Viewer) {
  const hooks = await TerminalDoc.findById("settings/webhooks", { data: 1 }).lean();
  const url = (hooks?.data as Record<string, unknown> | undefined)?.registration;
  if (typeof url !== "string" || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) return;
  const name = [v.firstName, v.middleInitial ? v.middleInitial + "." : "", v.lastName].filter(Boolean).join(" ");
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      username: "505th Command Terminal",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: "📋 New Enlistment — Passed BCT",
          description: "A new Marine has signed up and is waiting for BCT approval.",
          color: 0xf59e0b,
          fields: [
            { name: "Full Name", value: name.slice(0, 100), inline: true },
            { name: "Discord", value: `@${viewer.discordUsername}`.slice(0, 100), inline: true },
            { name: "BCT Instructor", value: v.instructor.slice(0, 100), inline: true },
            { name: "Heard about us", value: v.recruitSource, inline: true },
          ],
          footer: { text: "505th Expeditionary Force • Command Terminal" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}
