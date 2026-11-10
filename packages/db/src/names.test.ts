import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, operatorId } from "./names.ts";
import { parseRank, rankLabel, RANKS } from "./ranks.ts";

test("display name with callsign", () => {
  assert.equal(displayName({ rankAbbrev: "SSgt", firstName: "Simba", lastName: "Jones", callsign: "Davy" }), 'SSgt S. "Davy"');
});

test("display name without callsign, no middle name", () => {
  assert.equal(displayName({ rankAbbrev: "SSgt", firstName: "Simba", lastName: "Jones" }), "SSgt S. Jones");
});

test("display name without callsign, with middle name", () => {
  assert.equal(displayName({ rankAbbrev: "SSgt", firstName: "Simba", middleName: "Mark", lastName: "Jones" }), "SSgt S. M. Jones");
});

test("blank callsign / middle name are ignored", () => {
  assert.equal(displayName({ rankAbbrev: "Cpl", firstName: "a", middleName: "  ", lastName: "Smith", callsign: " " }), "Cpl A. Smith");
});

test("operator id", () => {
  assert.equal(operatorId({ firstName: "Simba", lastName: "Jones", callsign: "Davy" }), "davy");
  assert.equal(operatorId({ firstName: "Simba", lastName: "Jones" }), "s.jones");
});

test("every rank format seen in the Firebase backup parses", () => {
  const seen = [
    "E2 / Private First Class", "E4 / Corpsman Third Class", "E1 / Private", "E6 / Corpsman First Class",
    "E7 / Gunnery Sergeant", "E7 / Chief Corpsman", "E3 / Lance Corporal", "E5 / Sergeant", "Reservist",
    "E4 / Corporal", "E6 / Staff Sergeant", "E8 / Master Sergeant", "E5 / Staff Sergeant",
    "O9 / Lieutenant General", "E6 / Technical Sergeant", "E5 / Corpsman Second Class",
  ];
  for (const s of seen) {
    const r = parseRank(s);
    assert.ok(r, `unparsed: ${s}`);
    assert.equal(rankLabel(r), s);
  }
  assert.equal(parseRank("E6 / Staff Sergeant")!.branch, "marine");
  assert.equal(parseRank("E5 / Staff Sergeant")!.branch, "air");
  assert.equal(parseRank("O9 / Lieutenant General")!.abbrev, "LtGen");
});

test("rank keys are unique", () => {
  assert.equal(new Set(RANKS.map((r) => r.key)).size, RANKS.length);
});
