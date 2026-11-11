import assert from "node:assert/strict";
import test from "node:test";
import { can, checkAccessEdit, effectiveAccess, normaliseOverrides, setRoleDefaults, writeNeeds } from "./access";
import { assignableRoles, checkWrite, checkRead } from "./fs-core";

test("role defaults match the approved table", () => {
  const r = effectiveAccess("recruiter", {});
  assert.deepEqual(Object.keys(r).filter((k) => r[k]), ["bct", "tk"]);
  assert.equal(can("nco", {}, "ev"), true);
  assert.equal(can("nco", {}, "modk"), false);
  assert.equal(can("staff_nco", {}, "audit"), false);
  assert.equal(can("officer", {}, "audit"), true);
  assert.equal(can("officer", {}, "bot"), false);
  assert.equal(can("developer", {}, "bot"), true);
  assert.equal(can("marine", {}, "tk"), false);
});

test("overrides grant and remove, but never Command pages", () => {
  assert.equal(can("nco", { info: 1 }, "info"), true);
  assert.equal(can("officer", { audit: 0 }, "audit"), false);
  assert.equal(can("officer", { bot: 1 }, "bot"), false);
  assert.equal(can("commander", { audit: 0 }, "audit"), true);
  assert.deepEqual(normaliseOverrides("nco", { ev: 1, info: 1, bot: 1, junk: 1 }), { info: 1 });
});

test("access edit rules", () => {
  const staff = { uid: "s", role: "staff_nco", overrides: {} };
  const ok = (target: any, next: any) => checkAccessEdit(staff, target, next, assignableRoles("staff_nco"));
  assert.equal(ok({ uid: "n", role: "nco", overrides: {} }, { info: 1 }), null);
  assert.match(ok({ uid: "n", role: "nco", overrides: {} }, { audit: 1 }) ?? "", /don't have it/);
  assert.match(ok({ uid: "s", role: "staff_nco", overrides: {} }, {}) ?? "", /own access/);
  assert.match(ok({ uid: "o", role: "officer", overrides: {} }, {}) ?? "", /outranks/);
  assert.match(ok({ uid: "c", role: "commander", overrides: {} }, {}) ?? "", /Commander/);
  const nco = { uid: "x", role: "nco", overrides: {} };
  assert.match(checkAccessEdit(nco, { uid: "r", role: "recruiter", overrides: {} }, {}, assignableRoles("nco")) ?? "", /Officer Management/);
});

test("server write / read checks use the grid", () => {
  const t = (top: string, docId = "x") => ({ top, path: `${top}/${docId}`, docId });
  const rec = { uid: "r", role: "recruiter", access: {} };
  assert.throws(() => checkWrite(rec, "set", t("settings", "unit_cards"), new Set(["a"]), {}, null), /access/);
  assert.throws(() => checkWrite(rec, "add", t("aars"), new Set(["a"]), {}, null), /access/);
  assert.doesNotThrow(() => checkWrite({ ...rec, access: { aar: 1 } }, "add", t("aars"), new Set(["a"]), {}, null));
  const nco = { uid: "n", role: "nco", access: {} };
  assert.throws(() => checkWrite(nco, "update", t("attendance_events"), new Set(["locked"]), { locked: true }, null), /access/);
  assert.doesNotThrow(() => checkWrite(nco, "update", t("attendance_events"), new Set(["locked", "attendees"]), { locked: false }, null));
  assert.throws(() => checkWrite(nco, "update", t("attendance_events"), new Set(["locked", "unlockedBy"]), { locked: false }, null), /access/);
  assert.doesNotThrow(() => checkWrite(nco, "update", t("attendance_events"), new Set(["attendees"]), {}, null));
  assert.throws(() => checkWrite(nco, "delete", t("audit_logs"), new Set(), {}, null), /Audit Log/);
  assert.throws(() => checkWrite({ uid: "c", role: "commander" }, "delete", t("audit_logs"), new Set(), {}, null), /Audit Log/);
  assert.throws(() => checkWrite({ uid: "o", role: "officer" }, "update", t("users", "x"), new Set(["suspended"]), {}, { uid: "x", role: "marine" }), /Command/);
  assert.doesNotThrow(() => checkWrite({ uid: "d", role: "developer" }, "update", t("users", "x"), new Set(["suspended"]), {}, { uid: "x", role: "marine" }));
  assert.throws(() => checkWrite({ uid: "o", role: "officer" }, "set", t("unit_config", "status"), new Set(["opStatus"]), {}, null), /access/);
  assert.doesNotThrow(() => checkWrite(nco, "add", t("audit_logs"), new Set(["a"]), {}, null));
  assert.throws(() => checkWrite(nco, "update", { top: "users", path: "users/me", docId: "me" }, new Set(["access"]), {}, null), /Officer Management/);
  assert.throws(() => checkRead(nco, "audit_logs"), /access/);
  assert.throws(() => checkWrite(nco, "update", { top: "users", path: "users/n", docId: "n" }, new Set(["photoUrl"]), {}, null), /profile page/);
  assert.doesNotThrow(() => checkWrite(nco, "update", { top: "users", path: "users/n", docId: "n" }, new Set(["dashLayout"]), {}, null));
  assert.doesNotThrow(() => checkRead({ uid: "o", role: "officer" }, "audit_logs"));
  assert.deepEqual(writeNeeds("settings", "webhooks", new Set()), ["set"]);
});

test("Cortana-only collections can't be written from the terminal", () => {
  for (const top of ["bot_status", "discord_channels", "discord_roles"]) {
    assert.throws(() => checkWrite({ uid: "c", role: "commander", access: {} }, "set", { top, path: `${top}/x`, docId: "x" }, new Set(["online"]), {}, null), /Only Cortana/);
  }
});

test("role access table changes role defaults; personal overrides still win; locked/commander unchanged", async () => {
  const { setRoleDefaults, cleanRoleDefaults } = await import("./access");
  setRoleDefaults({ nco: { pers: 1, set: 1 }, staff_nco: { modk: 0 }, commander: { om: 0 }, recruiter: { bct: 1 } });
  assert.equal(can("nco", {}, "pers"), true);
  assert.equal(can("nco", {}, "set"), false); // locked: ignored
  assert.equal(can("staff_nco", {}, "modk"), false);
  assert.equal(can("staff_nco", { modk: 1 }, "modk"), true); // person wins
  assert.equal(can("commander", {}, "om"), true);
  assert.deepEqual(cleanRoleDefaults({ recruiter: { bct: 1 } }), {}); // same as built-in → dropped
  assert.deepEqual(normaliseOverrides("nco", { pers: 1 }), {}); // equals new role default → not an override
  setRoleDefaults({});
  assert.equal(can("nco", {}, "pers"), false);
});

test("developer always has everything (role table and overrides can't remove)", () => {
  setRoleDefaults({ developer: { tk: 0, ev: 0 } });
  assert.equal(can("developer", { tk: 0, send: 0 }, "tk"), true);
  assert.equal(can("developer", { tk: 0, send: 0 }, "send"), true);
  assert.equal(can("developer", {}, "ev"), true);
  assert.equal(can("developer", {}, "cmd_suspend"), true);
  setRoleDefaults({});
});
