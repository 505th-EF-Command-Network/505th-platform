/**
 * One-time import from the OLD Cortana (F:\Discord Bot\Cortana_Bot) — run on switch-over night, on the real 505th server.
 * Job `legacy.import` (access "set", button in Cortana Setup → Server Check):
 *  1. Info Posts: Rules, 505th Information, Unit Info & Handbook, Stalker File Cabinet and the Notification Roles picker
 *     (reactions → toggle buttons). They keep the OLD message IDs, so "UPDATE IN DISCORD" edits the existing
 *     messages in place (same bot account) — nothing is re-posted.
 *  2. Cortana Setup: fills EMPTY settings with the old bot's channels / roles (log, mission log, events, mod updates, announcements).
 *  3. Upcoming Events list: takes over the old list message.
 * Never overwrites anything already set. Safe to run twice.
 */
import { TerminalDoc } from "@505th/db";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { auditLog } from "./util.ts";

const GUILD = "1314384730120261664";
const CH = { log: "1383841952838975742", rules: "1330045174478278758", info: "1325566525297528984", unitInfo: "1329505947214938132", stalker: "1439093368687824949",
  missionLog: "1391106888946417736", roleSelect: "1383839729463726211", events: "1329953341530443856", modUpdates: "1336876606270210159", announcements: "1314658149776490517" };
const ROLE = { events: "1382495318519844924", gameNights: "1382495199523115118", movieNights: "1382495163359690795", modUpdates: "1382495478176026716" };
const MSG = { rules: "1391027469255184415", info: "1510072572568535122", unitInfo: "1500158228057817119", stalker: "1445192980678971494", roles: "1391027469284544552", eventList: "1424553162727231640" };
const doc = (url: string) => `[Click to open](${url})`;
const SITE = "https://www.505expeditionaryforce.com";
const em = (o: Record<string, unknown>) => ({ title: "", description: "", color: 0x2b2d31, fields: [], image: "", thumbnail: "logo", footer: "", ...o });

const POSTS: { key: string; name: string; channelId: string; messageId: string; embed: Record<string, unknown>; buttons?: unknown[]; clearReactions?: boolean }[] = [
  { key: "rules", name: "Server Rules", channelId: CH.rules, messageId: MSG.rules, embed: em({
    title: "__**Server Rules**__", description: "By joining, you agree to follow the rules below:", color: 0xedc531, thumbnail: "none", footer: "Rules are subject to change at staff discretion.",
    fields: [
      { name: "1️⃣ No NSFW Content", value: "Includes text, images, links, and usernames." },
      { name: "2️⃣ Be Respectful", value: "Treat others respectfully. No trolling, harassment, or toxicity." },
      { name: "3️⃣ No Advertising", value: "No promotion of other servers, products, or services." },
      { name: "4️⃣ No Spam", value: "Avoid message spam, reaction spam, or disruptive behavior." },
      { name: "5️⃣ Zero Tolerance Policy", value: "Racism, sexism, homophobia, or hate speech results in a ban." },
      { name: "6️⃣ Access Limits", value: "TeamSpeak and Arma operations are for verified 505th members only." },
      { name: "7️⃣ Age Requirement", value: "Members must be 18 years or older." },
    ] }) },
  { key: "info", name: "505th Information", channelId: CH.info, messageId: MSG.info, embed: em({
    title: "505th Information", footer: "505th Expeditionary Force – Server Info",
    description: ["**505th Arma Server**", "━━━━━━━━━━━━━━━━━━", "`217.217.25.5`", "Port: `2372`", "Password: `505th`", "", "**505th Teamspeak**", "━━━━━━━━━━━━━━━━━━", "IP: `217.217.30.252:9041`", "Password: `505`", "", "**Required Plugin**", "━━━━━━━━━━━━━━━━━━",
      `[Download Task Force Radio Plugin](https://discord.com/channels/${GUILD}/1314645365601075292/1393338482923143372)`].join("\n") }) },
  { key: "unitInfo", name: "Unit Info & Handbook", channelId: CH.unitInfo, messageId: MSG.unitInfo, embed: em({
    title: "📘 505th Unit Information & Handbook", footer: "505th Expeditionary Force • Unit Info & Reference Library",
    description: ["**📅 Event Schedule**", "• **Major Deployments** – 1st of the month at **4PM PST**", "• **Deployments** – Every **Friday or weekend**, unless reserved", "• **Sector Patrols** – Can happen **any day**", "", "_*Subject to change — still playing with scheduling*_"].join("\n"),
    fields: [
      { name: "━━━━━━━━━━━━━━━━━━━━━━━━", value: "**🌐 Unit Website**", inline: false },
      { name: "505th Website", value: `[Visit the 505th Website](${SITE})`, inline: true },
      { name: "Register", value: `[Create your account](${SITE}/login.html)`, inline: true },
      { name: "Unit Roster", value: `[View the live roster](${SITE}/resources-roster.html)`, inline: true },
      { name: "━━━━━━━━━━━━━━━━━━━━━━━━", value: "**📚 Reference Documents**", inline: false },
      { name: "📖 General Handbook", value: doc(`${SITE}/resources-handbook.html`), inline: true },
      { name: "⚕️ Hospital Corpsman Handbook", value: doc(`${SITE}/resources-hospital-corps-handbook.html`), inline: true },
      { name: "📋 After Action Report", value: doc(`${SITE}/resources-aar.html`), inline: true },
      { name: "📝 Feedback Form", value: doc("https://forms.gle/w47CTnkBoN4foGFv5"), inline: true },
    ] }) },
  { key: "stalker", name: "Stalker File Cabinet", channelId: CH.stalker, messageId: MSG.stalker, embed: em({
    title: "Stalker File Cabinet", footer: "505th Expeditionary Force • Stalker File Cabinet",
    description: ["**Stalker Team Reference Documents**", "", "All SOPs and handbooks for Stalker operations.", "────────────────────────"].join("\n"),
    fields: [
      { name: "Stalker Handbook", value: doc("https://docs.google.com/document/d/1AiAUcWMbkw9-ZaQLOmMEO3GPjVZha79UVgpIXtO40ro/edit?usp=sharing"), inline: false },
      { name: "━━━━━━━━━━━━━━━━━━━━", value: "**Standard Operating Procedures**", inline: false },
      { name: "Reconnaissance", value: doc("https://docs.google.com/document/d/1vyJhKxH64s8MvtlQyPWDGpRzFGv9VZm9hF3UxAox0SQ/edit?usp=sharing"), inline: true },
      { name: "Target Acquisition", value: doc("https://docs.google.com/document/d/1K_1_ASH30jmliOnfMo4USTZCNQZbBu3FzD-NuCTCP_Y/edit?usp=sharing"), inline: true },
      { name: "Engagement", value: doc("https://docs.google.com/document/d/1ZBMz4GpeD7KPKgZ2GaO3WhhejipxzwX-M4N383Lz1ok/edit?usp=sharing"), inline: true },
      { name: "Sniper/Spotter Team", value: doc("https://docs.google.com/document/d/1nICf5uzD_anfwd1T2CsSHuLgNEl1tvt2Z2eiVQYCVx0/edit?usp=sharing"), inline: true },
      { name: "━━━━━━━━━━━━━━━━━━━━", value: "**Advanced Certifications**", inline: false },
      { name: "Sniper", value: doc("https://docs.google.com/document/d/18SWjTkxIKkiI5YiO0r1-OB5gsD73XpKoPUHMwxSPWSo/edit?usp=sharing"), inline: true },
      { name: "EOD Tech", value: doc("https://docs.google.com/document/d/1iixjcRL-RXvm907ceMculcIU8s2BX3MjQdGaeekKe4s/edit?usp=drive_link"), inline: true },
      { name: "UAV Operator", value: doc("https://docs.google.com/document/d/1S-I9ZcqbXKdwHHk9CEdwoPlhOb9JZCpQccDx5MQstFg/edit?usp=drive_link"), inline: true },
    ] }) },
  { key: "roles", name: "Notification Roles", channelId: CH.roleSelect, messageId: MSG.roles, clearReactions: true, embed: em({
    title: "__**505th Notification Roles**__", footer: "505th Expeditionary Force • Notifications Command",
    description: ["Welcome to the **505th Expeditionary Force** server.", "To stay informed, pick your notification roles with the buttons below:", "",
      "🟣 **Events** — scheduled operations and briefings", "🟡 **Game Nights** — casual sessions and community play", "🟠 **Movie Nights** — relax with the team and enjoy a film", "🟤 **Mod Updates** — alerts when mods or loadouts change", "", "*Click again at any time to remove a role.*"].join("\n") }),
    buttons: [
      { type: "toggle", label: "Events", emoji: "🟣", style: "grey", roleId: ROLE.events, url: "", ticketType: "", reply: "" },
      { type: "toggle", label: "Game Nights", emoji: "🟡", style: "grey", roleId: ROLE.gameNights, url: "", ticketType: "", reply: "" },
      { type: "toggle", label: "Movie Nights", emoji: "🟠", style: "grey", roleId: ROLE.movieNights, url: "", ticketType: "", reply: "" },
      { type: "toggle", label: "Mod Updates", emoji: "🟤", style: "grey", roleId: ROLE.modUpdates, url: "", ticketType: "", reply: "" },
    ] },
];

export function startLegacyImport() {
  registerJob("legacy.import", async (job) => {
    const who = await uidAllowed(job.data.requestedBy, "set");
    if (!who.ok) throw new PermanentJobError("Only Developers / Command can do that");
    if (env.AUTHORISED_GUILD_ID !== GUILD) throw new PermanentJobError("Only works when Cortana runs on the real 505th server (switch-over night)");
    const now = new Date(), iso = now.toISOString();
    let posts = 0, filled = 0;
    for (const p of POSTS) {
      const id = `legacy_${p.key}`;
      if (await TerminalDoc.exists({ _id: `info_posts/${id}` })) continue;
      await TerminalDoc.create({ _id: `info_posts/${id}`, parent: "info_posts", docId: id, createTime: now, updateTime: now, data: {
        name: p.name, channelId: p.channelId, content: "", embeds: [p.embed], buttons: p.buttons ?? [], menu: null, pin: false, showOnWebsite: false, clearReactions: !!p.clearReactions,
        history: [], updatedAtISO: iso, updatedByName: `${who.name} (imported from old Cortana)`, createdAtISO: iso,
        discord: { channelId: p.channelId, messageId: p.messageId, missing: false } } });
      posts++;
    }
    // Cortana Setup: only fill empty settings.
    const cur = ((await TerminalDoc.findById("settings/cortana", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
    const set: Record<string, unknown> = {};
    const fill = (path: string, v: unknown) => { const val = path.split(".").reduce<any>((o, k) => o?.[k], cur); if (val === undefined || val === "" || val === null) { set[`data.${path}`] = v; filled++; } };
    fill("logs.joinLeaveId", CH.log); fill("logs.messageLogId", CH.log); fill("missionLogChannelId", CH.missionLog);
    fill("eventChannelId", CH.events); fill("eventListChannelId", CH.events);
    fill("aux.channelId", CH.modUpdates); fill("aux.pingRoleId", ROLE.modUpdates); fill("announce.channelId", CH.announcements);
    if (Object.keys(set).length) await TerminalDoc.updateOne({ _id: "settings/cortana" }, { $set: { ...set, parent: "settings", docId: "cortana", updateTime: now }, $setOnInsert: { createTime: now } }, { upsert: true });
    // Take over the old Upcoming Events message.
    const st = ((await TerminalDoc.findById("bot_state/cortana", { data: 1 }).lean())?.data ?? {}) as Record<string, any>;
    if (!st.eventListMessageId) await TerminalDoc.updateOne({ _id: "bot_state/cortana" }, { $set: { parent: "bot_state", docId: "cortana", "data.eventListChannelId": CH.events, "data.eventListMessageId": MSG.eventList, updateTime: now } }, { upsert: true });
    await auditLog("OLD CORTANA IMPORTED", `${posts} info post(s), ${filled} setting(s)`, who.name, "security");
    log.ok(`Old Cortana import: ${posts} info posts, ${filled} settings.`);
    return { posts, filled };
  });
}
