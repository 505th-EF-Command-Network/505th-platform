import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileV2 from "@/components/profile/ProfileV2";
import ServiceRecordView from "@/components/terminal/views/ServiceRecordView";
import { getViewer } from "@/lib/auth/session";
import { DEFAULT_PREFS, myUserDoc, syncPhoto } from "@/lib/profile";
import { getPromotionTracker, getServiceRecord } from "@/lib/terminal/data";
import "@/styles/tw/terminal.css";
import "@/styles/profile-v2.css";

export const metadata: Metadata = { title: "My Profile — 505th", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Any signed-in member: their own profile, hex picture and alert settings. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/login?next=/profile");
  const { tab } = await searchParams;
  const r = v.member ? await getServiceRecord(v.member.id) : null;
  const [me, pt] = r ? await Promise.all([myUserDoc(v), getPromotionTracker(v.member!.id).catch(() => null)]) : [null, null];
  const d = me ? await syncPhoto(me.uid, me.data, v.avatar) : null;
  return (
    <ProfileV2
      tab={tab ?? "over"}
      terminal={v.terminal.result === "GRANTED"}
      discordUsername={v.discordUsername}
      canEdit={!!v.member && ["ACTIVE", "LOA", "RESERVE"].includes(v.member.status)}
      r={r ? { name: r.name, rank: r.rank, roleLabel: r.roleLabel, platoon: r.platoon, joinedAt: r.joinedAt, callsign: r.callsign, status: r.status, attendance: r.attendance, counts: r.counts, hasDiscord: r.hasDiscord } : null}
      photo={d?.photo ?? { source: "discord", url: null, zoom: 100, x: 50, y: 50 }}
      discordAvatar={v.avatar ?? d?.discordAvatarUrl ?? null}
      pt={pt}
      prefs={{ ...DEFAULT_PREFS, ...(d?.notifyPrefs ?? {}) }}
      record={r ? <ServiceRecordView r={r} back={{ href: "/home", label: "HOME" }} /> : null}
    />
  );
}
