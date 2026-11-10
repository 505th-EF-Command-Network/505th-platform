"use client";

/** Enlistment form (approved mock 2026-11-09). Same card style as the login page. */
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Props = {
  discordUsername: string;
  avatar: string | null;
  instructors: string[];
  sources: string[];
  timezones: string[];
};

/** Best guess of the visitor's timezone option from the browser. */
function guessTimezone(options: string[]) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const map: [RegExp, string][] = [
      [/^Europe\/(London|Dublin|Lisbon)/, "GMT / UK"],
      [/^Europe\/(Athens|Helsinki|Kiev|Kyiv|Bucharest|Sofia|Riga|Vilnius|Tallinn)/, "EET / Eastern Europe"],
      [/^Europe\//, "CET / Central Europe"],
      [/^America\/(New_York|Toronto|Detroit|Indiana)/, "EST / US East"],
      [/^America\/(Chicago|Winnipeg|Mexico_City)/, "CST / US Central"],
      [/^America\/(Denver|Phoenix|Edmonton)/, "MST / US Mountain"],
      [/^America\/(Los_Angeles|Vancouver)/, "PST / US West"],
      [/^Australia\//, "AEST / Australia East"],
      [/^Pacific\/Auckland/, "NZST / New Zealand"],
    ];
    const hit = map.find(([re]) => re.test(tz))?.[1];
    return hit && options.includes(hit) ? hit : "";
  } catch {
    return "";
  }
}

const label = "font-mono text-[10px] tracking-[2.5px] text-[#aeb9c4]";
const field =
  "w-full border border-[rgba(0,217,255,0.35)] bg-[#070a0f] px-3 py-2.5 font-mono text-[13px] text-[#E8EEF2] outline-none focus:border-[#00D9FF] focus:shadow-[0_0_0_1px_#00D9FF] aria-[invalid=true]:border-[#ff6b6b]";
const errText = "font-mono text-[10px] tracking-[1px] text-[#ff6b6b]";

export default function EnlistForm({ discordUsername, avatar, instructors, sources, timezones }: Props) {
  const [v, setV] = useState({
    firstName: "",
    middleInitial: "",
    lastName: "",
    instructor: "",
    bctDate: "",
    recruitSource: "",
    timezone: "",
    passedBct: false,
    agreeRules: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const g = guessTimezone(timezones);
    if (g) setV((x) => (x.timezone ? x : { ...x, timezone: g }));
  }, [timezones]);

  const set = (k: keyof typeof v) => (e: { target: { value: string; checked?: boolean; type?: string } }) => {
    const val = e.target.type === "checkbox" ? !!e.target.checked : e.target.value;
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };

  const preview = useMemo(() => {
    const f = v.firstName.trim(), l = v.lastName.trim();
    return `PFC ${f ? f[0].toUpperCase() + "." : "?."} ${l || "?"}`;
  }, [v.firstName, v.lastName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError("");
    const local: Record<string, string> = {};
    if (!v.firstName.trim()) local.firstName = "Required.";
    if (!v.lastName.trim()) local.lastName = "Required.";
    if (!v.instructor) local.instructor = "Pick who passed your BCT.";
    if (!v.recruitSource) local.recruitSource = "Required.";
    if (!v.timezone) local.timezone = "Required.";
    if (!v.passedBct) local.passedBct = "You must have passed BCT to enlist.";
    if (!v.agreeRules) local.agreeRules = "You must agree to the Discord Rules.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/enlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.assign("/boot");
        return;
      }
      if (body.errors) setErrors(body.errors);
      else setFormError(body.error || "Something went wrong. Please try again.");
    } catch {
      setFormError("Network error. Please try again.");
    }
    setBusy(false);
  }

  const err = (k: string) =>
    errors[k] ? (
      <span id={`${k}-err`} className={errText}>
        {errors[k]}
      </span>
    ) : null;
  const a11y = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-err` : undefined });

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-[#0A0E12] to-[#050709] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />
      <img src="/images/logo.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" />

      <section
        aria-labelledby="enlist-title"
        className="relative w-full max-w-[620px] border border-[rgba(0,217,255,0.35)] bg-[rgba(20,27,31,0.9)] p-9 shadow-[0_0_60px_rgba(0,217,255,0.12)] [clip-path:polygon(18px_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%,0_18px)] animate-[bt-up_0.5s_ease_both] max-[560px]:p-5"
      >
        <p className="font-mono text-[11px] tracking-[3px] text-[#6B7B87]">UNSC TACTICAL NETWORK · NEW PERSONNEL</p>
        <h1 id="enlist-title" className="mt-1 text-[1.6rem] font-bold tracking-[4px] text-[#00D9FF] [text-shadow:0_0_14px_rgba(0,217,255,0.45)]">
          ENLISTMENT FORM
        </h1>
        <p className="mt-1.5 text-[0.98rem] leading-[1.5] text-[#A8B5BF]">
          Welcome, Marine. You passed BCT — fill this in so Command can open your personnel file.
        </p>

        <div className="mt-5 flex items-center gap-3 border border-[rgba(88,101,242,0.5)] bg-[rgba(88,101,242,0.08)] px-3 py-2.5">
          {avatar ? (
            <img src={avatar} alt="" className="h-10 w-10 rounded-full" />
          ) : (
            <div aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[#5865F2] font-bold">
              {discordUsername.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <b className="block truncate tracking-[1px] text-[#E8EEF2]">{discordUsername}</b>
            <span className="font-mono text-[10px] tracking-[1px] text-[#A8B5BF]">DISCORD ACCOUNT · VERIFIED</span>
          </div>
          <span className="ml-auto shrink-0 border border-[rgba(78,230,138,0.5)] px-2 py-1 font-mono text-[9.5px] tracking-[1.5px] text-[#4ee68a]">
            ✓ IN 505TH SERVER
          </span>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 grid grid-cols-[1fr_90px_1fr] gap-x-3 gap-y-3.5 max-[560px]:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="firstName" className={label}>FIRST NAME</label>
            <input id="firstName" autoComplete="given-name" maxLength={40} className={field} value={v.firstName} onChange={set("firstName")} {...a11y("firstName")} />
            {err("firstName")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="middleInitial" className={label}>
              M.I. <small className="tracking-[1px] text-[#6B7B87]">(OPT.)</small>
            </label>
            <input id="middleInitial" maxLength={1} className={field} value={v.middleInitial} onChange={set("middleInitial")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lastName" className={label}>LAST NAME</label>
            <input id="lastName" autoComplete="family-name" maxLength={40} className={field} value={v.lastName} onChange={set("lastName")} {...a11y("lastName")} />
            {err("lastName")}
          </div>

          <div className="col-span-full grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="instructor" className={label}>BCT INSTRUCTOR</label>
              <select id="instructor" className={field} value={v.instructor} onChange={set("instructor")} {...a11y("instructor")}>
                <option value="">— WHO PASSED YOU? —</option>
                {instructors.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              {err("instructor")}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bctDate" className={label}>
                BCT DATE <small className="tracking-[1px] text-[#6B7B87]">(APPROX.)</small>
              </label>
              <input id="bctDate" type="date" className={field} value={v.bctDate} onChange={set("bctDate")} {...a11y("bctDate")} />
              {err("bctDate")}
            </div>
          </div>

          <div className="col-span-full grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recruitSource" className={label}>HOW DID YOU HEAR ABOUT US?</label>
              <select id="recruitSource" className={field} value={v.recruitSource} onChange={set("recruitSource")} {...a11y("recruitSource")}>
                <option value="">— SELECT —</option>
                {sources.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              {err("recruitSource")}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="timezone" className={label}>
                TIMEZONE <small className="tracking-[1px] text-[#6B7B87]">(AUTO)</small>
              </label>
              <select id="timezone" className={field} value={v.timezone} onChange={set("timezone")} {...a11y("timezone")}>
                <option value="">— SELECT —</option>
                {timezones.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              {err("timezone")}
            </div>
          </div>

          <div className="col-span-full border border-dashed border-[rgba(0,217,255,0.3)] px-3 py-2.5 font-mono text-[11px] tracking-[1px] text-[#A8B5BF]">
            ONCE APPROVED YOUR FILE WILL READ: <b className="font-normal text-[#4ee68a]">{preview}</b>
          </div>

          <div className="col-span-full flex flex-col gap-1">
            <label className="flex items-start gap-2.5 text-[0.98rem] leading-[1.4] text-[#d4dce3]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#00D9FF]" checked={v.passedBct} onChange={set("passedBct")} {...a11y("passedBct")} />
              I have passed Basic Combat Training with the 505th.
            </label>
            {err("passedBct")}
          </div>
          <div className="col-span-full flex flex-col gap-1">
            <label className="flex items-start gap-2.5 text-[0.98rem] leading-[1.4] text-[#d4dce3]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#00D9FF]" checked={v.agreeRules} onChange={set("agreeRules")} {...a11y("agreeRules")} />
              <span>
                I have read and agree to the{" "}
                <a href="/resources-discord-rules" target="_blank" className="text-[#00D9FF] underline-offset-2 hover:underline">
                  Discord Rules
                </a>
                .
              </span>
            </label>
            {err("agreeRules")}
          </div>

          {formError && (
            <div role="alert" className="col-span-full border-l-[3px] border-[#ff6b6b] bg-[rgba(255,107,107,0.08)] px-3 py-2.5 text-[0.95rem] font-semibold text-[#E8EEF2]">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="col-span-full min-h-[50px] cursor-pointer border border-[#00D9FF] bg-[rgba(0,217,255,0.1)] text-[1rem] font-bold tracking-[4px] text-[#00D9FF] transition hover:bg-[rgba(0,217,255,0.18)] hover:shadow-[0_0_16px_rgba(0,217,255,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00D9FF] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "SUBMITTING..." : "SUBMIT ENLISTMENT ▸"}
          </button>
          <p className="col-span-full font-mono text-[10px] leading-[1.6] tracking-[1px] text-[#6B7B87]">
            Your file is checked by Command. Fake names or not passing BCT = denied.
          </p>
        </form>
        <form action="/api/auth/logout" method="post" className="mt-3 text-center">
          <button type="submit" className="cursor-pointer border-0 bg-transparent font-mono text-[11px] tracking-[2px] text-[#6B7B87] hover:text-[#00D9FF]">
            ⏻ SIGN OUT
          </button>
        </form>
      </section>
    </main>
  );
}
