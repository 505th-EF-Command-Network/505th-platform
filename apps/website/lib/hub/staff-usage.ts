import { TerminalDoc, connectDb } from "@505th/db";

type U = Record<string, any>;
export type Usage = { weekMins: number; days: number; bars: number[]; lastISO: string };
const ukDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** uid → this week's Hub + Terminal use (last 7 UK days, today last). Written once a minute by Cortana (staff-watch.ts). */
export async function staffUsage(): Promise<Record<string, Usage>> {
  await connectDb();
  const days = Array.from({ length: 7 }, (_, i) => ukDay(new Date(Date.now() - (6 - i) * 864e5)));
  const docs = (await TerminalDoc.find({ parent: "staff_usage", "data.day": { $gte: ukDay(new Date(Date.now() - 60 * 864e5)) } }, { data: 1 }).lean()) as U[];
  const out: Record<string, Usage> = {};
  for (const d of docs) {
    const x = d.data ?? {}, uid = String(x.uid ?? "");
    if (!uid) continue;
    const u = (out[uid] ??= { weekMins: 0, days: 0, bars: [0, 0, 0, 0, 0, 0, 0], lastISO: "" });
    if (String(x.lastISO ?? "") > u.lastISO) u.lastISO = String(x.lastISO);
    const i = days.indexOf(String(x.day));
    if (i < 0) continue;
    const m = Number(x.mins) || 0;
    u.bars[i] = m; u.weekMins += m; if (m) u.days++;
  }
  return out;
}
