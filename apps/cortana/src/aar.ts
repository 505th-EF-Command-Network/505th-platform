/**
 * AAR published on the website (Terminal → AAR v3) → post it in Discord.
 * Job "aar.post" { aarId } — key "aar".
 * Where: Cortana Setup → Logs → "AAR POSTS" channel (settings/cortana.logs.aarId).
 * If no channel is set, falls back to the old Settings → Webhooks "AAR SUBMITTED" webhook, so nothing changes for you.
 */
import { EmbedBuilder, type Client } from "discord.js";
import { TerminalDoc } from "@505th/db";
import { log } from "./log.ts";
import { PermanentJobError, registerJob } from "./worker.ts";
import { uidAllowed } from "./access.ts";
import { cortanaSettings } from "./util.ts";

const LOGO = "https://www.505expeditionaryforce.com/images/logo.png";
const UNITS: Record<string, string> = { alpha: "Alpha Company", forcerecon: "JTF-23 Force Recon", corpsman: "Hospital Corpsman", airwing: "54th Air Wing", combined: "Combined Arms" };
const RES: Record<string, [string, number]> = { success: ["✅ Mission Success", 0x22e07a], partial: ["🟡 Partial Success", 0xf5c518], failure: ["❌ Mission Failure", 0xff4d4d] };
const OPS: Record<string, string> = { main_op: "🔴 Operations", patrol: "🔵 Patrol", deployment: "🟢 Deployment", fun_op: "🟡 Fun Op" };
const cut = (s: unknown, n: number) => { const t = String(s ?? "").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

async function post(client: Client<true>, job: { data: { requestedBy?: string; payload?: Record<string, unknown> } }) {
  if (!(await uidAllowed(job.data.requestedBy, "aar")).ok) throw new PermanentJobError("No AAR access");
  const id = String(job.data.payload?.aarId ?? "");
  const a = (await TerminalDoc.findById(`aars/${id}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
  if (!a) throw new PermanentJobError("AAR not found");
  if (a.status === "draft") return { skipped: "draft" };
  const [res, color] = RES[a.result] ?? ["—", 0x2b2d31];
  const date = a.date ? new Date(a.date?.$date ?? a.date) : null;
  const objs = Array.isArray(a.objectives) ? a.objectives : [];
  const e = new EmbedBuilder().setColor(color).setAuthor({ name: "505th Expeditionary Force — Operations", iconURL: LOGO }).setTitle(`📘 ${cut(a.title || "After Action Report", 240)}`)
    .setURL("https://www.505expeditionaryforce.com/resources-aar")
    .setDescription(cut(a.summary, 1500) || "—")
    .addFields(
      { name: "Result", value: res, inline: true },
      { name: "Unit", value: UNITS[a.unit] ?? String(a.unit || "—"), inline: true },
      { name: "Type", value: OPS[a.operationType] ?? String(a.operationType || "—"), inline: true },
      { name: "Date", value: date && !isNaN(date.getTime()) ? `<t:${Math.floor(date.getTime() / 1000)}:D>` : "—", inline: true },
      { name: "Commander", value: cut(a.commander, 100) || "—", inline: true },
      { name: "Objectives", value: objs.length ? `${objs.filter((o: any) => o.done).length}/${objs.length}` : "—", inline: true },
    )
    .setFooter({ text: `Filed by ${cut(a.filedBy || a.submittedByName || "Staff", 60)} · 505th Command Terminal`, iconURL: LOGO }).setTimestamp();
  const img = Array.isArray(a.attachments) ? a.attachments.find((u: unknown) => typeof u === "string" && /^https:\/\//.test(u)) : null;
  if (img) e.setImage(img);

  const s = await cortanaSettings();
  const chId = s.logs?.aarId;
  if (chId) {
    const ch = await client.channels.fetch(chId).catch(() => null);
    if (!ch?.isTextBased() || !("send" in ch)) throw new PermanentJobError("AAR channel not found — check Cortana Setup → Logs");
    const m = await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
    log.info(`AAR posted: ${a.title}`);
    return { messageId: m.id };
  }
  const wh = String(((await TerminalDoc.findById("settings/webhooks", { data: 1 }).lean())?.data as Record<string, unknown> | undefined)?.aar ?? "");
  if (/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(wh)) {
    const r = await fetch(wh, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "505th Command Terminal", avatar_url: LOGO, embeds: [e.toJSON()], allowed_mentions: { parse: [] } }) });
    if (!r.ok) throw new PermanentJobError(`Webhook refused (${r.status})`);
    return { webhook: true };
  }
  return { skipped: "no AAR channel set" };
}

export function startAar() {
  registerJob("aar.post", (job, c) => post(c, job));
}
