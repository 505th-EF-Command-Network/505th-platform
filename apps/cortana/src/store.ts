/**
 * Cortana's documents in the website's `terminal_fs` collection.
 * `_id` is the full path ("bot_status/cortana"), like the Command Terminal uses.
 */
import { TerminalDoc } from "@505th/db";

export async function putDoc(parent: string, docId: string, data: Record<string, unknown>) {
  const now = new Date();
  await TerminalDoc.updateOne(
    { _id: `${parent}/${docId}` },
    { $set: { parent, docId, data, updateTime: now }, $setOnInsert: { createTime: now } },
    { upsert: true },
  );
}

export async function patchDoc(parent: string, docId: string, set: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const now = new Date();
  const $set: Record<string, unknown> = { parent, docId, updateTime: now };
  for (const [k, v] of Object.entries(set)) $set[`data.${k}`] = v;
  await TerminalDoc.updateOne({ _id: `${parent}/${docId}` }, { $set, $setOnInsert: { createTime: now }, ...extra }, { upsert: true });
}
