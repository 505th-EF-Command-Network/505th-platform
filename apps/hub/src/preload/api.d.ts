export type AppUser = { uid: string; name: string; role: string; deviceName: string; discordUsername: string; platoon: string; access: Record<string, boolean> };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "waiting" }
  | { status: "signed-in"; user: AppUser }
  | { status: "offline"; error: string };
export type MyStatus = { state: "online" | "dnd" | "invisible" | "offline"; note?: string; untilISO?: string | null };
export type StaffRow = { uid: string; name: string; role: string; level: number; state: "online" | "dnd" | "offline"; page: string; where?: "hub" | "terminal" | "both" | ""; note: string; until: string | null; photo: string | null };
export type Summary = {
  me: { uid: string; name: string; role: string; rank: string; platoon: string; attendance: number; pt: number; opsAttended: number; opsEligible: number; status: MyStatus; access: Record<string, boolean> };
  ops: { id: string; title: string; startAtISO: string; opType: string; signedUp: number; mine: string | null; myChoice: string | null; myWaiting: boolean; open: boolean; linked: boolean;
    buttons: { key: string; emoji: string; label: string; style: string; limit: number; count: number; waiting: number }[] }[];
  alerts: { id: string; type: string; title: string; body: string; read: boolean; at: unknown }[];
  staff: StaffRow[];
  system: { cortana: { online: boolean; pingMs: number | null }; website: boolean };
  at: string;
};
export type MemberTile = { id: string; firstName: string; lastName: string; callsign: string; rank: string; role: string; platoon: string; joinedAt: string; opsAttended: number; opsEligible: number; inactive: boolean; retired: boolean; photo: string | null; discordUsername: string };
export type HistoryEntry = Record<string, string | boolean | undefined> & { date?: string; note?: string; addedBy?: string };
export type MemberFile = Omit<MemberTile, "opsAttended" | "opsEligible"> & {
  squad: string; graduation: string; joinedPlatoon: string; recruitSource: string; discordLinked: boolean;
  attendance: number; promotionTracker: number; opsAttended: number; opsEligible: number; lastAttendedDate: string;
  promotionHistory: HistoryEntry[]; platoonHistory: HistoryEntry[]; warningHistory: HistoryEntry[]; commendationHistory: HistoryEntry[]; ribbonHistory: HistoryEntry[];
  lastOps: { date: string; title: string; result: "present" | "excused" | "absent" }[];
  canEdit: boolean;
  lists: { ranks: string[]; platoons: string[]; medals: [string, string][] };
};
export type RosterRow = { id: string; firstName: string; lastName: string; callsign: string; rank: string; role: string; platoon: string; squad: string; billet: string; attendance: number; promotionTracker: number; opsAttended: number; opsEligible: number; ribbons: string[]; medals: number };
export type Roster = { rows: RosterRow[]; canEdit: boolean; meta: { month: string; lastAttendanceReset: string; lastResetAt: string; lastResetBy: string; lastResetPromoted: number | null; running: { by?: string; done?: number; total?: number; startedAt?: string } | null }; medals: [string, string][]; ribbons: string[] };
export type AttEvent = { id: string; title: string; date: string; type: string; locked: boolean; lockedBy: string; createdBy: string; attendees: string[]; excused: string[]; excusedReasons: Record<string, string>;
  linked: { signups: { uid: string; label: string; going: boolean; waiting: boolean }[] } | null };
export type AttRoll = { id: string; firstName: string; lastName: string; callsign: string; rank: string; platoon: string; squad: string; opsAttended: number; opsEligible: number; attendance: number };
export type Attendance = { events: AttEvent[]; roll: AttRoll[]; online: string[]; discord: { id: string; title: string; startAtISO: string; date: string; type: string; going: number }[]; canEdit: boolean; canLock: boolean };
export type EvButton = { key?: string; emoji: string; label: string; style: string; limit: number; attending: boolean };
export type EvItem = { id: string; title: string; description: string; where: string; voiceChannel: string; location: string; date: string; startTime: string; endTime: string; startAtISO: string; endAtISO: string; opType: string;
  repeat: string; banner: string; channel: string; buttons: (EvButton & { key: string })[]; signups: { uid: string; discordId: string; name: string; choice: string; waiting: boolean; atISO: string }[]; status: string;
  discord: { status?: string; missing?: boolean; closedAtISO?: string; channelId?: string; scheduledEventId?: string; startSentISO?: string; error?: string }; attendanceEventId: string | null;
  attendance: { locked: boolean; present: number } | null; createdByName: string; updatedByName: string; createdAtISO: string };
export type EvData = { events: EvItem[]; me: { uid: string; discordId: string }; canEdit: boolean; signupChannels: [string, string][]; voiceChannels: string[]; stageChannels: string[]; channelNames: Record<string, string>; cortanaOnline: boolean | null };
export type Aar = Record<"title" | "commander" | "filedBy" | "author" | "location" | "mainObjective" | "commanderIntent" | "objectiveStandards" | "plannedExecution" | "unitsInvolved" | "enemyFaction" | "enemyCasualties" | "enemyTactics" | "enemyDisposition" | "successfulManeuvers" | "mistakes" | "unexpected" | "objectiveOutcome" | "lessonsLearned" | "recommended" | "miscComments" | "result" | "unit", string> & {
  id: string; operationType: string; classification: string; summary: string; personnel: number | null; casualties: number; objectives: { text: string; done: boolean }[]; attachments: string[];
  date: string; status: string; submittedByName: string; submittedAt: string; updatedAt: string; updatedByName: string };
export type AarData = { reports: Aar[]; events: { id: string; title: string; date: string; type: string; attendees: number }[] };
export type BctPerson = { id: string; fullName: string; name: string; pfcName: string; initials: string; discordUsername: string; email: string; rank: string; role: string; platoon: string; graduation: string; bctDate: string; bctInstructor: string;
  recruitSource: string; timezone: string; registeredAt: string; approvedAt: string; approvedBy: string; deniedAt: string; deniedBy: string; denyReason: string };
export type BctData = { pending: BctPerson[]; approved: BctPerson[]; denied: BctPerson[]; thisMonth: number; avg: string; instructors: string[]; platoons: string[]; sources: string[]; denyReasons: string[]; canAct: boolean };
export type HubPrefs = { dash?: [string, number][]; nav?: { order: string[]; hidden: string[]; pins: string[]; closed: string[]; rail: boolean } };
export type Overview = {
  prefs: HubPrefs | null;
  me: { name: string; rank: string; platoon: string; role: string; discordUsername: string; photo: string | null; ribbons: number; medals: number; warnings: number };
  counts: { bct: number; tickets: number };
  manpower: { active: number; reserves: number; bct: number; rate: number; at3: number; tickets: number };
  trend: { label: string; title: string; pct: number }[];
  recruitment: { count: number; avg: string; sources: [string, number][] } | null;
  bctQueue: { id: string; name: string; days: number }[] | null;
  week: { id: string; title: string; startAtISO: string; opType: string }[];
  activity: { at: string; by: string; action: string; details: string }[] | null;
  system: { cortana: { online: boolean; pingMs: number | null; cpu: number | null; startedAtISO: string | null; missingPerms: number; errors24h: number; jobsQueued: number }; dbMs: number; website: boolean; media: boolean; realtime: boolean };
  at: string;
};
export type HistMember = { uid: string; name: string; rank: string; platoon: string; attended: number; eligible: number; missed: number; rate: number };
export type HistMonth = { id: string; totalOps: number; memberCount: number; snapshotAt: string; savedBy: string; rebuiltAt: string; lateUpdate: { at: string; by: string; title: string; action: string } | null; members: HistMember[] };
export type HistData = { months: HistMonth[]; missing: string[]; current: string };
export type MediaItem = { id: string; type: "image" | "video"; url: string; name: string; description: string; category: string; uploadedAt: string; enabled: boolean };
export type OobData = { data: Record<string, { status?: string; name?: string; userId?: string } | boolean>; members: { id: string; name: string; rank: string; short: string }[] };
export type NetState = { state: "off" | "connecting" | "live"; reason: string | null };

export type RecruitData = { sources: string[]; members: { id: string; name: string; source: string; joined: string; instructor: string }[] };
export type TicketLine = { who: string; whoId?: string; staff?: boolean; note?: boolean; text: string; atISO: string; images?: string[] };
export type Ticket = { id: string; number: number; status: string; waiting?: string; typeId: string; typeName: string; typeEmoji?: string; openerId: string; openerName: string;
  openedAtISO: string; lastActivityISO?: string; closedAtISO?: string; closedByName?: string; closeReason?: string; claimedByName?: string; channelDeleted?: boolean; firstReplyMs?: number | null; transcript?: TicketLine[] };
export type TicketData = { tickets: Ticket[]; types: { id: string; name: string; emoji?: string }[]; openers: Record<string, { name: string; uid: string; rank: string; status: string; past: number; warns: number }>; nextNumber: number; canReset: boolean };
export type SentMsg = { id: string; kind: string; channelName: string; content: string; embed: { title?: string; description?: string; color?: number; image?: string; thumbnail?: boolean } | null; buttons: { label: string; url: string }[]; sentByName: string; sentAtISO: string; jumpUrl: string };
export type SendData = { channels: { id: string; name: string; parentName: string; canSend: boolean }[]; roles: { id: string; name: string; color: string }[];
  emojis: { id: string; name: string; animated: boolean; url: string }[]; members: { discordId: string; name: string }[]; gallery: { id: string; url: string; name: string }[]; sent: SentMsg[] };
declare global {
  interface Window {
    cn: {
      auth: {
        get(): Promise<AuthState>;
        login(): Promise<void>;
        cancel(): Promise<void>;
        logout(): Promise<void>;
        retry(): Promise<void>;
        onChange(cb: (s: AuthState) => void): () => void;
      };
      net: {
        get(): Promise<NetState>;
        onState(cb: (s: NetState) => void): () => void;
        onTopic(cb: (topic: string) => void): () => void;
      };
      info(): Promise<{ version: string; packaged: boolean }>;
      hub: {
        summary(): Promise<Summary | { error: string }>;
        members(): Promise<{ members: MemberTile[]; canEdit: boolean } | { error: string }>;
        member(id: string): Promise<MemberFile | { error: string }>;
        memberAction(id: string, body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }>;
        roster(): Promise<Roster | { error: string }>;
        rosterAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        attendance(): Promise<Attendance | { error: string }>;
        attendanceAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; msg?: string; error?: string }>;
        events(): Promise<EvData | { error: string }>;
        eventsAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; msg?: string; error?: string }>;
        aars(): Promise<AarData | { error: string }>;
        aarsAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; status?: string; savedAt?: string; msg?: string; error?: string }>;
        upload(folder: string, name: string, type: string, bytes: Uint8Array): Promise<{ url?: string; error?: string }>;
        bct(): Promise<BctData | { error: string }>;
        bctAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        overview(): Promise<Overview | { error: string }>;
        savePrefs(body: HubPrefs): Promise<{ ok?: boolean; error?: string }>;
        readAlerts(body: { ids?: string[]; all?: boolean }): Promise<{ ok?: boolean; error?: string }>;
        rsvp(eventId: string, key: string): Promise<{ ok?: boolean; msg?: string; waiting?: boolean; error?: string }>;
        history(): Promise<HistData | { error: string }>;
        historyAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        media(): Promise<{ items: MediaItem[] } | { error: string }>;
        mediaAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        oob(): Promise<OobData | { error: string }>;
        oobAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        recruit(): Promise<RecruitData | { error: string }>;
        tickets(): Promise<TicketData | { error: string }>;
        ticketsAction(body: Record<string, unknown>): Promise<{ ok?: boolean; queued?: boolean; msg?: string; error?: string }>;
        send(): Promise<SendData | { error: string }>;
        sendAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        setStatus(s: { state: string; note?: string; untilISO?: string | null }): Promise<{ ok?: boolean; error?: string }>;
      };
    };
  }
}
export {};
