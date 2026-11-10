import { test } from "node:test";
import assert from "node:assert/strict";
import { audience, cleanShare, noteAccess, toAlert } from "./notes-core.ts";

test("private note: only the owner, not even command", () => {
  const n = { createdBy: "a", share: { mode: "private" } };
  assert.equal(noteAccess(n, "a", "nco"), "owner");
  assert.equal(noteAccess(n, "b", "commander"), null);
});
test("legacy note (no share) = all staff can edit", () => {
  assert.equal(noteAccess({ createdBy: "a" }, "b", "staff_nco"), "edit");
  assert.equal(noteAccess({ createdBy: "a" }, "m", "marine"), null);
});
test("people + groups, edit wins", () => {
  const n = { createdBy: "a", share: { mode: "shared", people: { b: "view" }, groups: { officers: "edit" } } };
  assert.equal(noteAccess(n, "b", "nco"), "view");
  assert.equal(noteAccess(n, "b", "officer"), "edit");
  assert.equal(noteAccess(n, "c", "developer"), null);
});
test("cleanShare drops junk, owner and unknown groups", () => {
  const s = cleanShare({ mode: "shared", people: { a: "edit", "b": "admin", "c$": "view", d: "view" }, groups: { hackers: "edit", command: "view" } }, "a");
  assert.deepEqual(s, { mode: "shared", people: { d: "view" }, groups: { command: "view" } });
  assert.deepEqual(cleanShare({ mode: "private", people: { d: "edit" } }, "a"), { mode: "private", people: {}, groups: {} });
});
test("alerts only new people or view→edit", () => {
  const users = [{ uid: "a", role: "nco" }, { uid: "b", role: "officer" }, { uid: "c", role: "nco" }];
  const before = audience({ mode: "shared", people: { c: "view" }, groups: {} }, users, "a");
  const after = audience({ mode: "shared", people: { c: "edit" }, groups: { officers: "view" } }, users, "a");
  assert.deepEqual(toAlert(before, after).sort(), [["b", "view"], ["c", "edit"]]);
  assert.deepEqual(toAlert(after, after), []);
});
