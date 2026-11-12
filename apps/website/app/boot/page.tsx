import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessAttempt, connectDb } from "@505th/db";
import { getViewer } from "@/lib/auth/session";
import ClearanceScan from "@/components/boot/ClearanceScan";
import "@/styles/tw/boot.css";

export const metadata: Metadata = { title: "Clearance Scan — 505th Command Terminal" };
export const dynamic = "force-dynamic";

export default async function BootPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/boot");
  // In the 505th Discord but no personnel file yet: they passed BCT and need to sign up.
  if (viewer.inGuild && !viewer.member) redirect("/enlist");

  // Members below Terminal clearance still get ACCESS GRANTED, but to their profile.
  const member = viewer.terminal.reason === "LOW_CLEARANCE";
  const { result, reason, checks } = member
    ? { result: "GRANTED" as const, reason: "NONE" as const, checks: [true, true, true] as [boolean, boolean, boolean] }
    : viewer.terminal;
  const dest = member ? "/profile" : "/terminal";
  const h = await headers();
  // Only DENIED attempts are saved (Security → Access Log). Normal sign-ins aren't stored. Cleared on the 1st of each month by Cortana.
  let incident = Math.random().toString(36).slice(2, 8).toUpperCase();
  if (result === "DENIED") {
  await connectDb();
  const attempt = await AccessAttempt.create({
    discordId: viewer.discordId,
    discordUsername: viewer.discordUsername,
    member: viewer.member?.id,
    result,
    reason,
    target: dest.slice(1),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: h.get("user-agent")?.slice(0, 200) ?? undefined,
  });
  incident = String(attempt._id).slice(-6).toUpperCase();
  }

  const m = viewer.member;
  return (
    <ClearanceScan
      result={result}
      reason={reason}
      checks={checks}
      name={m && reason !== "NOT_IN_DISCORD" ? m.displayName : viewer.discordUsername}
      operator={m ? m.operatorId : viewer.discordUsername.toLowerCase()}
      tag={m ? `CLEARANCE: ${m.roleLabel.toUpperCase()}` : "CLEARANCE: NONE"}
      avatar={viewer.avatar}
      discordId={viewer.discordId}
      incident={incident}
      time={new Date().toISOString().replace("T", " ").slice(0, 19)}
      dest={dest}
    />
  );
}
