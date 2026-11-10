/** Enlistment form rules — pure, no I/O (unit-tested). */

export const RECRUIT_SOURCES = ["Reddit", "Steam Community", "Disboard", "Discord", "Word of Mouth", "Other"] as const;
export const TIMEZONES = [
  "GMT / UK", "CET / Central Europe", "EET / Eastern Europe", "EST / US East", "CST / US Central",
  "MST / US Mountain", "PST / US West", "AEST / Australia East", "NZST / New Zealand", "Other",
] as const;
export const OTHER_INSTRUCTOR = "Other / not sure";

export type EnlistInput = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  instructor: string;
  bctDate: string;
  recruitSource: string;
  timezone: string;
  passedBct: boolean;
  agreeRules: boolean;
};

const NAME = /^[\p{L}][\p{L}' -]{0,39}$/u;

/** Validates and cleans the form. Returns field errors, or the clean values. */
export function validateEnlist(raw: unknown, instructors: string[]): { ok: true; value: EnlistInput } | { ok: false; errors: Record<string, string> } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const v: EnlistInput = {
    firstName: s("firstName"),
    middleInitial: s("middleInitial").replace(/[^\p{L}]/gu, "").slice(0, 1).toUpperCase(),
    lastName: s("lastName"),
    instructor: s("instructor"),
    bctDate: s("bctDate"),
    recruitSource: s("recruitSource"),
    timezone: s("timezone"),
    passedBct: r.passedBct === true,
    agreeRules: r.agreeRules === true,
  };
  const errors: Record<string, string> = {};
  if (!NAME.test(v.firstName)) errors.firstName = "Enter your real first name (letters only).";
  if (!NAME.test(v.lastName)) errors.lastName = "Enter your real last name (letters only).";
  if (!instructors.includes(v.instructor) && v.instructor !== OTHER_INSTRUCTOR) errors.instructor = "Pick who passed your BCT.";
  if (v.bctDate) {
    const d = new Date(v.bctDate);
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v.bctDate) && !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 864e5;
    if (!ok) errors.bctDate = "Enter a real date, not in the future.";
  }
  if (!(RECRUIT_SOURCES as readonly string[]).includes(v.recruitSource)) errors.recruitSource = "Tell us how you found the 505th.";
  if (!(TIMEZONES as readonly string[]).includes(v.timezone)) errors.timezone = "Pick your timezone.";
  if (!v.passedBct) errors.passedBct = "You must have passed BCT to enlist.";
  if (!v.agreeRules) errors.agreeRules = "You must agree to the Discord Rules.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: v };
}

