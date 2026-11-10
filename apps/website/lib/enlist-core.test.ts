/** Tests with FAKE data only. Run: npx tsx --test apps/website/lib/enlist-core.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OTHER_INSTRUCTOR, validateEnlist } from "./enlist-core.ts";

const ins = ["Sgt G. Doyle", "SSgt S. \"Viper\""];
const good = {
  firstName: " Jack ", middleInitial: "r.", lastName: "O'Neil-Smith", instructor: "Sgt G. Doyle",
  bctDate: "2026-11-01", recruitSource: "Reddit", timezone: "GMT / UK", passedBct: true, agreeRules: true,
};

test("valid form is cleaned", () => {
  const r = validateEnlist(good, ins);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.firstName, "Jack");
    assert.equal(r.value.middleInitial, "R");
    assert.equal(r.value.lastName, "O'Neil-Smith");
  }
  assert.ok(validateEnlist({ ...good, instructor: OTHER_INSTRUCTOR, bctDate: "" }, ins).ok);
});

test("bad input is rejected with field errors", () => {
  const r = validateEnlist({ ...good, firstName: "<b>x", instructor: "Random Person", bctDate: "2099-01-01", recruitSource: "TikTok", passedBct: "yes", agreeRules: false }, ins);
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["agreeRules", "bctDate", "firstName", "instructor", "passedBct", "recruitSource"]);
  assert.ok(!validateEnlist(null, ins).ok);
  assert.ok(!validateEnlist({ ...good, lastName: "a".repeat(41) }, ins).ok);
});
