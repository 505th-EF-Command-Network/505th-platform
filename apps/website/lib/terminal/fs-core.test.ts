/** Tests with FAKE data only. Run: npx tsx --test apps/website/lib/terminal/fs-core.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FsError, assignableRoles, buildQuery, checkWrite, collPath, decode, decodeFieldPaths, docPath, encode, fieldUpdate, mergeUpdate,
  resolveSentinels, touchedFields,
} from "./fs-core.ts";

const now = new Date("2026-11-09T12:00:00.000Z");
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as FsError).code;
  }
  return "ok";
};

test("paths: allowed collections and subcollections only", () => {
  assert.equal(docPath("users/abc").parent, "users");
  assert.equal(docPath("notifications/u1/items/n1").parent, "notifications/u1/items");
  assert.equal(collPath("conversations/c1/messages"), "conversations/c1/messages");
  assert.equal(code(() => docPath("sessions/x")), "permission-denied");
  assert.equal(code(() => docPath("users/a/secret/b")), "permission-denied");
  assert.equal(code(() => docPath("users/../x")), "invalid-argument");
  assert.equal(code(() => docPath("users")), "invalid-argument");
  assert.equal(code(() => collPath("users/abc")), "invalid-argument");
});

test("values: timestamps round-trip, unsafe keys rejected", () => {
  const d = new Date("2026-01-02T03:04:05.678Z");
  const wire = encode({ a: d, b: [d], c: { d } }) as any;
  assert.deepEqual(wire.a, { __type: "timestamp", seconds: 1767323045, nanoseconds: 678000000 });
  assert.equal((decode(wire) as any).c.d.getTime(), d.getTime());
  assert.equal(code(() => decode({ $where: 1 })), "invalid-argument");
  assert.equal(code(() => decode({ nested: { "a.b": 1 } })), "invalid-argument");
  assert.equal(code(() => decode({ __type: "geopoint" })), "invalid-argument");
});

test("writes: merge deep-merges, update uses field paths, sentinels resolve", () => {
  const m = mergeUpdate(decode({ a: { b: 1, c: { __sv: "serverTimestamp" } }, n: { __sv: "increment", n: 2 }, arr: [1] }) as any, now);
  assert.deepEqual(m.$set, { "data.a.b": 1, "data.a.c": now, "data.arr": [1] });
  assert.deepEqual(m.$inc, { "data.n": 2 });
  const u = fieldUpdate(decodeFieldPaths({ "unreadCounts.u1": { __sv: "increment", n: 1 }, profile: { x: 1 } }) as any, now);
  assert.deepEqual(u.$set, { "data.profile": { x: 1 } });
  assert.deepEqual(u.$inc, { "data.unreadCounts.u1": 1 });
  assert.equal(code(() => fieldUpdate({ "a.$b": 1 }, now)), "invalid-argument");
  assert.equal(code(() => decodeFieldPaths({ "a.$b": 1 })), "invalid-argument");
  assert.deepEqual(resolveSentinels({ t: { __sv: "serverTimestamp" }, i: { __sv: "increment", n: 3 } }, now), { t: now, i: 3 });
  assert.deepEqual([...touchedFields({ "role": 1, "a.b": 2 }, true)], ["role", "a"]);
});

test("queries: Firestore operators, ordering excludes missing fields", () => {
  const q = buildQuery("attendance_events", [["locked", "==", true], ["date", ">=", "2026-11-01"]], [["date", "desc"]], 20);
  assert.deepEqual(q.filter, {
    $and: [
      { parent: "attendance_events" },
      { "data.locked": true },
      { "data.date": { $gte: "2026-11-01" } },
      { "data.date": { $exists: true } },
    ],
  });
  assert.deepEqual(q.sort, { "data.date": -1, docId: 1 });
  assert.equal(q.limit, 20);
  const a = buildQuery("conversations", [["participants", "array-contains", "u1"]]);
  assert.deepEqual(a.filter.$and[1], { "data.participants": { $elemMatch: { $eq: "u1" } } });
  assert.equal(buildQuery("users").limit, 5000);
  assert.equal(code(() => buildQuery("users", [["x", "regex", 1]])), "invalid-argument");
});

test("permissions: role assignment follows the original terminal's table", () => {
  assert.deepEqual(assignableRoles("recruiter"), []);
  assert.ok(assignableRoles("commander").includes("commander"));
  assert.ok(!assignableRoles("developer").includes("developer"));
  const users = { top: "users", path: "users/t1", docId: "t1" };
  const staff = { uid: "me", role: "staff_nco" };
  const dev = { uid: "me", role: "developer" };
  const target = { uid: "t1", role: "marine", discordId: "123456789012345678" };
  // promote within authority
  assert.equal(code(() => checkWrite(staff, "update", users, new Set(["role"]), { role: "nco" }, target)), "ok");
  // cannot grant a role above your authority
  assert.equal(code(() => checkWrite(staff, "update", users, new Set(["role"]), { role: "staff_nco" }, target)), "permission-denied");
  // cannot touch someone who outranks you
  assert.equal(code(() => checkWrite(staff, "update", users, new Set(["role"]), { role: "marine" }, { ...target, role: "developer" })), "permission-denied");
  // cannot change own role
  assert.equal(code(() => checkWrite(dev, "update", { ...users, path: "users/me", docId: "me" }, new Set(["role"]), { role: "commander" }, { uid: "me", role: "developer" })), "permission-denied");
  // unchanged role value is fine (attendance updates resend the whole file)
  assert.equal(code(() => checkWrite(staff, "set", users, new Set(["role", "attendance"]), { role: "developer" }, { ...target, role: "developer" })), "ok");
  // other fields always allowed
  assert.equal(code(() => checkWrite(staff, "update", users, new Set(["attendance"]), { attendance: 90 }, { ...target, role: "commander" })), "ok");
});

test("permissions: Discord links, deletes and secret settings", () => {
  const users = { top: "users", path: "users/t1", docId: "t1" };
  const target = { uid: "t1", role: "marine", discordId: null };
  assert.equal(code(() => checkWrite({ uid: "me", role: "staff_nco" }, "update", users, new Set(["discordId"]), { discordId: "123456789012345678" }, target)), "permission-denied");
  assert.equal(code(() => checkWrite({ uid: "me", role: "developer" }, "update", users, new Set(["discordId"]), { discordId: "123456789012345678" }, target)), "ok");
  assert.equal(code(() => checkWrite({ uid: "me", role: "developer" }, "update", users, new Set(["discordId"]), { discordId: "abc" }, target)), "permission-denied");
  assert.equal(code(() => checkWrite({ uid: "me", role: "developer" }, "update", users, new Set(["discordId"]), { discordId: "123456789012345678" }, { ...target, role: "commander" })), "permission-denied");
  assert.equal(code(() => checkWrite({ uid: "me", role: "nco" }, "delete", users, new Set(), {}, target)), "permission-denied");
  assert.equal(code(() => checkWrite({ uid: "me", role: "staff_nco" }, "delete", users, new Set(), {}, target)), "ok");
  assert.equal(code(() => checkWrite({ uid: "t1", role: "commander" }, "delete", users, new Set(), {}, target)), "permission-denied");
  const hooks = { top: "settings", path: "settings/webhooks", docId: "webhooks" };
  assert.equal(code(() => checkWrite({ uid: "me", role: "staff_nco" }, "set", hooks, new Set(["aar"]), {}, null)), "permission-denied");
  assert.equal(code(() => checkWrite({ uid: "me", role: "developer" }, "set", hooks, new Set(["aar"]), {}, null)), "ok");
});
