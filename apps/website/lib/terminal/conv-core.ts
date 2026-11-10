/**
 * Private messages rules (pure — unit tested). Used by lib/terminal/fs.ts.
 * Only the people in a conversation can read it, its messages, or change it.
 * Nobody else — not even Command.
 */
import { FsError } from "./fs-core";

type Data = Record<string, any>;
const deny = (m: string): never => {
  throw new FsError("permission-denied", m);
};
const isParticipant = (conv: Data | null, uid: string) => Array.isArray(conv?.participants) && conv!.participants.includes(uid);
const UID = /^[A-Za-z0-9_-]{1,64}$/;

/** Reading a conversation or anything inside it. */
export function checkConvRead(uid: string, conv: Data | null) {
  if (conv && !isParticipant(conv, uid)) deny("Not your conversation");
}

/** Listing conversations: must ask for your own (participants array-contains you). */
export function checkConvQuery(uid: string, where: unknown) {
  const ok = Array.isArray(where) && where.some((w) => Array.isArray(w) && w[0] === "participants" && w[1] === "array-contains" && w[2] === uid);
  if (!ok) deny("You can only list your own conversations");
}

/**
 * Writes.
 *  segs: ["conversations", convId] or ["conversations", convId, "messages", msgId]
 *  data: for update ops the keys are field paths ("unreadCounts.abc").
 */
export function checkConvWrite(
  uid: string,
  op: "set" | "update" | "delete" | "add",
  segs: string[],
  conv: Data | null,
  msg: Data | null,
  data: Data,
) {
  const isMsg = segs.length === 4;
  if (op === "set") deny("Not allowed");

  if (!isMsg) {
    if (op === "add") {
      const p = data.participants;
      if (!Array.isArray(p) || p.length < 2 || p.length > 50 || !p.every((x) => typeof x === "string" && UID.test(x))) deny("Bad participants");
      if (!p.includes(uid)) deny("You must be in the conversation you start");
      if (new Set(p).size !== p.length) deny("Bad participants");
      return;
    }
    if (!conv) deny("Conversation not found");
    if (!isParticipant(conv, uid)) deny("Not your conversation");
    if (op === "delete") {
      if (conv!.participants.length > 1) deny("Others are still in this conversation");
      return;
    }
    // update
    for (const key of Object.keys(data)) {
      const [top, sub] = key.split(".");
      if (["lastMessage", "lastMessageAt", "lastSenderUid", "name"].includes(top) && !sub) continue;
      if (top === "unreadCounts" && sub && conv!.participants.includes(sub)) {
        // you may reset your own count, or add to others' counts (sending a message)
        const v = data[key];
        if (sub === uid ? v === 0 : v && v.__sv === "increment" && v.n === 1) continue;
        deny("Bad unread change");
      }
      if (top === "typing" && sub === uid) continue;
      if (top === "participants" && !sub) {
        const next = data[key];
        const want = conv!.participants.filter((x: string) => x !== uid);
        if (Array.isArray(next) && next.length === want.length && next.every((x: string) => want.includes(x))) continue;
        deny("You can only remove yourself from a conversation");
      }
      deny(`Not allowed to change ${top}`);
    }
    return;
  }

  // messages
  if (!conv) deny("Conversation not found");
  if (!isParticipant(conv, uid)) deny("Not your conversation");
  if (op === "add") {
    if (data.senderUid !== uid) deny("You can only send as yourself");
    if (!Array.isArray(data.readBy) || data.readBy.length !== 1 || data.readBy[0] !== uid) deny("Bad message");
    if (typeof data.text !== "string" || data.text.length > 4000) deny("Message too long");
    if (data.imageUrl != null && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(String(data.imageUrl))) deny("Bad image");
    return;
  }
  if (op === "delete") deny("Messages can't be deleted");
  // update: only add yourself to readBy
  if (!msg) deny("Message not found");
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "readBy") deny("You can only mark messages as read");
  const before: string[] = Array.isArray(msg!.readBy) ? msg!.readBy : [];
  const after = data.readBy;
  if (!Array.isArray(after) || !before.every((x) => after.includes(x)) || after.some((x: string) => !before.includes(x) && x !== uid) || after.length > before.length + 1) {
    deny("You can only mark messages as read");
  }
}

/** Notifications: you read and change only your own; anyone in the terminal may send one. */
export function checkNotif(uid: string, op: "read" | "set" | "update" | "delete" | "add", ownerUid: string) {
  if (op === "add") return;
  if (ownerUid !== uid) deny("Not your alerts");
}
