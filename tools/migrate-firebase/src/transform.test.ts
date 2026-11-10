/** Tests with FAKE data only — never real member records. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { leaverMatcher, toDate, transformAar, transformAudit, transformEvent, transformMember, transformSetting } from "./transform.ts";

const fakeUser = (id: string, extra: Record<string, any> = {}) => ({
  id,
  path: `users/${id}`,
  createTime: "2026-01-01T00:00:00Z",
  data: {
    firstName: "Test",
    middleName: "",
    lastName: `User${id}`,
    callsign: "",
    rank: "E6 / Staff Sergeant",
    role: "staff_nco",
    status: "active",
    discordId: `1000${id}`,
    platoon: "1st Platoon",
    promotionHistory: [{ fromRank: "E5 / Sergeant", toRank: "E6 / Staff Sergeant", addedAt: "2026-02-01T00:00:00Z" }],
    ...extra,
  },
});

test("toDate handles Firestore timestamps and ISO strings", () => {
  assert.equal(toDate({ __type: "timestamp", seconds: 1, nanoseconds: 500_000_000 })!.getTime(), 1500);
  assert.equal(toDate("2026-04-12")!.toISOString(), "2026-04-12T00:00:00.000Z");
  assert.equal(toDate("not a date"), undefined);
  assert.equal(toDate(null), undefined);
});

test("member: rank, role, status mapping and history dates", () => {
  const { doc, warnings } = transformMember(fakeUser("1"), leaverMatcher([]));
  assert.equal(doc.rankKey, "E6-SSGT");
  assert.equal(doc.rankRaw, undefined);
  assert.equal(doc.role, "staff_nco");
  assert.equal(doc.status, "ACTIVE");
  assert.ok(doc.promotionHistory[0].addedAt instanceof Date);
  assert.deepEqual(warnings, []);
});

test("member: 'approved' maps to ACTIVE", () => {
  assert.equal(transformMember(fakeUser("2", { status: "approved" }), leaverMatcher([])).doc.status, "ACTIVE");
});

test("member: leavers by name or uid become LEFT_UNIT", () => {
  const m = leaverMatcher(["Test User3", "uid-9"]);
  assert.equal(transformMember(fakeUser("3"), m).doc.status, "LEFT_UNIT");
  assert.equal(transformMember(fakeUser("uid-9"), m).doc.status, "LEFT_UNIT");
  assert.equal(transformMember(fakeUser("4"), m).doc.status, "ACTIVE");
});

test("member: unknown rank kept as rankRaw, missing Discord flagged", () => {
  const { doc, warnings } = transformMember(fakeUser("5", { rank: "E99 / Space Admiral", discordId: "" }), leaverMatcher([]));
  assert.equal(doc.rankKey, undefined);
  assert.equal(doc.rankRaw, "E99 / Space Admiral");
  assert.ok(warnings.some((w) => w.includes("rank")));
  assert.ok(warnings.some((w) => w.includes("Discord")));
});

test("event: attendees mapped, unknown uids kept, not dropped", () => {
  const ids = new Map<string, unknown>([["a", "ID_A"]]);
  const e = transformEvent({ id: "e1", path: "attendance_events/e1", data: { title: "Op", type: "main_op", date: "2026-04-12", attendees: ["a", "ghost"], excused: [] } }, ids);
  assert.deepEqual(e.attendees, ["ID_A"]);
  assert.deepEqual(e.unmatchedLegacyIds, ["ghost"]);
  assert.equal(e.type, "main_op");
});

test("aar: known fields mapped, every other text field kept in sections", () => {
  const a = transformAar({ id: "r1", path: "aars/r1", data: { title: "Op X", summary: "s", lessonsLearned: "l", casualties: 2 } }, new Map());
  assert.equal(a.title, "Op X");
  assert.equal(a.casualties, 2);
  assert.deepEqual(a.sections, { summary: "s", lessonsLearned: "l" });
});

test("audit: timestamp and section", () => {
  const a = transformAudit({ id: "x", path: "audit_logs/x", data: { action: "promote", section: "manpower", createdAt: { seconds: 10, nanoseconds: 0 } } }, new Map(), "audit_logs");
  assert.equal(a.at!.getTime(), 10_000);
  assert.equal(a.section, "manpower");
  assert.equal(a.legacyId, "audit_logs/x");
});

test("settings: secrets are dropped, never copied", () => {
  const site = transformSetting({ id: "site", path: "settings/site", data: { discord_invite: "x", botHttpToken: "SECRET", botHttpUrl: "u" } })!;
  assert.deepEqual(site.data, { discord_invite: "x" });
  assert.deepEqual(site.dropped.sort(), ["botHttpToken", "botHttpUrl"]);
  const hooks = transformSetting({ id: "webhooks", path: "settings/webhooks", data: { aar: "https://discord.com/api/webhooks/SECRET" } })!;
  assert.deepEqual(hooks.data, {});
  assert.deepEqual(hooks.dropped, ["aar"]);
  const page = transformSetting({ id: "page_content", path: "settings/page_content", data: { a: 1 } })!;
  assert.deepEqual(page.data, { a: 1 });
});
