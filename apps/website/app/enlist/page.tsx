import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { getInstructors, OTHER_INSTRUCTOR, RECRUIT_SOURCES, TIMEZONES } from "@/lib/enlist";
import EnlistForm from "@/components/enlist/EnlistForm";
import "@/styles/tw/boot.css";

export const metadata: Metadata = { title: "Enlistment — 505th Command Network" };
export const dynamic = "force-dynamic";

/**
 * Sign-up for new members who passed BCT. Only for people signed in with
 * Discord, in the 505th server, with no personnel file yet. Everyone else is
 * sent to /boot, which shows the matching Idea D screen.
 */
export default async function EnlistPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/enlist");
  if (viewer.member || !viewer.inGuild) redirect("/boot");
  const instructors = await getInstructors();
  return (
    <EnlistForm
      discordUsername={viewer.discordUsername}
      avatar={viewer.avatar}
      instructors={[...instructors, OTHER_INSTRUCTOR]}
      sources={[...RECRUIT_SOURCES]}
      timezones={[...TIMEZONES]}
    />
  );
}
