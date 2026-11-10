import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConvQuery, checkConvRead, checkConvWrite, checkNotif } from "./conv-core.ts";

const conv = { participants: ["a", "b"] };
const C = ["conversations", "c1"], M = ["conversations", "c1", "messages", "m1"];
const no = (f: () => void) => assert.throws(f, /./);

test("read: only participants, not even command", () => {
  assert.doesNotThrow(() => checkConvRead("a", conv));
  no(() => checkConvRead("z", conv));
});
test("list: must ask for your own", () => {
  assert.doesNotThrow(() => checkConvQuery("a", [["participants", "array-contains", "a"]]));
  no(() => checkConvQuery("a", [["participants", "array-contains", "b"]]));
  no(() => checkConvQuery("a", []));
});
test("start chat: must include yourself", () => {
  assert.doesNotThrow(() => checkConvWrite("a", "add", C, null, null, { participants: ["a", "b"] }));
  no(() => checkConvWrite("a", "add", C, null, null, { participants: ["b", "c"] }));
});
test("send: as yourself, only if in the chat", () => {
  const m = { senderUid: "a", text: "hi", readBy: ["a"] };
  assert.doesNotThrow(() => checkConvWrite("a", "add", M, conv, null, m));
  no(() => checkConvWrite("a", "add", M, conv, null, { ...m, senderUid: "b" }));
  no(() => checkConvWrite("z", "add", M, conv, null, { ...m, senderUid: "z", readBy: ["z"] }));
});
test("conversation update rules", () => {
  assert.doesNotThrow(() => checkConvWrite("a", "update", C, conv, null, { lastMessage: "x", "unreadCounts.b": { __sv: "increment", n: 1 }, "typing.a": null }));
  assert.doesNotThrow(() => checkConvWrite("a", "update", C, conv, null, { "unreadCounts.a": 0 }));
  no(() => checkConvWrite("a", "update", C, conv, null, { "unreadCounts.b": 0 }));
  no(() => checkConvWrite("a", "update", C, conv, null, { "typing.b": "x" }));
  no(() => checkConvWrite("a", "update", C, conv, null, { participants: ["a", "b", "z"] }));
  assert.doesNotThrow(() => checkConvWrite("a", "update", C, conv, null, { participants: ["b"] }));
  no(() => checkConvWrite("a", "update", C, conv, null, { participants: ["a"] }));
  no(() => checkConvWrite("z", "update", C, conv, null, { lastMessage: "x" }));
});
test("read receipts: only add yourself", () => {
  const msg = { readBy: ["b"] };
  assert.doesNotThrow(() => checkConvWrite("a", "update", M, conv, msg, { readBy: ["b", "a"] }));
  no(() => checkConvWrite("a", "update", M, conv, msg, { readBy: ["a"] }));
  no(() => checkConvWrite("a", "update", M, conv, msg, { text: "edited" }));
  no(() => checkConvWrite("a", "delete", M, conv, msg, {}));
});
test("delete chat only when last one in it", () => {
  no(() => checkConvWrite("a", "delete", C, conv, null, {}));
  assert.doesNotThrow(() => checkConvWrite("a", "delete", C, { participants: ["a"] }, null, {}));
});
test("alerts: own only, anyone can send", () => {
  assert.doesNotThrow(() => checkNotif("a", "add", "b"));
  no(() => checkNotif("a", "read", "b"));
  no(() => checkNotif("a", "update", "b"));
});
