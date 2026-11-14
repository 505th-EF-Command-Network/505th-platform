/** Notes v2 (lib/notes/service.ts). body = cleaned HTML. x / y / pin / arch / rem are just for you. */
export type NotePerm = "view" | "edit";
export interface NoteItem { id: string; title: string; body: string; text: string; color: string; folder: string; tags: string[]; owner: string | null; ownerName: string; access: "owner" | NotePerm;
  share?: { mode: "private" | "shared"; people: Record<string, NotePerm>; groups: Record<string, NotePerm> };
  shareSummary: { mode: string; people: { uid: string; perm: NotePerm; name: string }[]; groups: { key: string; perm: NotePerm; label: string }[] };
  updatedAtISO: string | null; updatedByName: string | null; x: number | null; y: number | null; pin: boolean; arch: boolean; rem: { atISO: string; repeat: string; sentISO?: string } | null }
export interface NotesData { me: string; canCreate: boolean; notes: NoteItem[]; people: { uid: string; name: string; role: string; photoUrl: string | null; callsign: string }[]; groups: { key: string; label: string }[]; colours: string[] }
/** Network Status v2 (lib/net/core.ts). Beat = [minuteOfDay or minute, ms (-1 = no answer), 0 up | 1 slow | 2 down]. */
export type NetBeat = [number, number, number];
export interface NetMonitor { id: string; name: string; group: string; type: string; target: string; builtin: boolean; third: boolean; paused: boolean; muted: boolean; slowMs: number; status: "up" | "slow" | "down" | "paused" | "stale" | "pending"; ms: number | null; info: string; error: string; checkedAtISO: string; downSinceISO: string; certValidToISO: string; last: NetBeat[]; up24: number | null; up30: number | null; avg24: number | null }
export interface NetData { canEdit: boolean; cortanaChecking: boolean; lastCheckISO: string; monitors: NetMonitor[] }
export interface NetIncident { id: string; startedAtISO: string; endedAtISO: string; error: string; note: string }
export interface NetDetail { points: NetBeat[]; uptime: number | null; avg: number | null; incidents: NetIncident[] }
export type AppUser = { uid: string; name: string; role: string; deviceName: string; discordUsername: string; platoon: string; access: Record<string, boolean> };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "waiting" }
  | { status: "signed-in"; user: AppUser }
  | { status: "offline"; error: string };
export type MyStatus = { state: "online" | "dnd" | "invisible" | "offline"; note?: string; untilISO?: string | null };
export type StaffRow = { uid: string; name: string; role: string; level: number; state: "online" | "dnd" | "offline"; page: string; where?: "hub" | "terminal" | "both" | ""; voice?: string; discord?: string; usage?: { weekMins: number; days: number; bars: number[]; lastISO: string } | null; lastSeenISO?: string; note: string; until: string | null; photo: string | null };
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
export type HubPrefs = { dash?: [string, number][]; nav?: { order: string[]; hidden: string[]; pins: string[]; closed: string[]; rail: boolean }; settings?: AppSettings };
export type NotifyEvent = "message" | "tag" | "ticket" | "bct" | "op" | "project" | "rank" | "note" | "net" | "staff";
export type ShortcutId = "palette" | "rail" | "filter" | "messages" | "refresh" | "toggle" | "notes" | "newNote" | "lock" | "settings" | "help" | "dnd";
/** My Settings / My Notifications / My Shortcuts — same shape as website lib/hub/settings.ts. */
export type AppSettings = {
  startup: boolean; closeToTray: boolean; openOn: "dashboard" | "last" | "messages"; textSize: "s" | "m" | "l" | "xl"; anim: "on" | "reduced" | "off"; contrast: boolean; time: "uk" | "local" | "both";
  /** Time & Region. tz "" = this PC's zone. clocks = up to 3 extra (e.g. PST). */
  tz: string; tzPin: boolean; clocks: { tz: string; label: string }[]; dateStyle: "dmy" | "mdy" | "iso"; h24: boolean;
  autoUpdate: boolean; channel: "stable" | "beta";
  look: { theme: "cyan" | "gold" | "olive" | "night"; accent: string; platoon: boolean; nightAuto: boolean; nightFrom: string; nightTo: string; glow: number; corners: "sharp" | "round";
    bg: "plain" | "grid" | "hex" | "scan" | "picture"; bgUrl: string; bgBlur: number; bgDark: number; cards: number; side: "full" | "icons" | "auto"; density: "compact" | "normal" | "roomy"; cb: boolean };
  a11y: { style: "edge" | "tint" | "badge"; color: string; until: boolean; safe: boolean; stay: boolean; away: boolean; soundText: boolean; plain: boolean; easyFont: boolean; lines: "normal" | "wide";
    focus: boolean; big: boolean; moreTime: boolean; reader: boolean };
  notify: { popup: boolean; windows: boolean; taskbar: boolean; edge: boolean; sound: boolean; dnd: "off" | "on" | "night" | "custom"; dndFrom: string; dndTo: string; opMins: number; newDevice: boolean;
    letOps: boolean; preview: boolean; ev: Record<NotifyEvent, { popup: boolean; bell: boolean; flash: boolean }> };
  security: { lock: "off" | "5" | "15" | "60" | "sleep"; pinHash: string; streamer: boolean; alerts: boolean };
  devices: { max: 2 | 3 | 5; idleDays: 7 | 30 | 90; trusted: string[] };
  /** Alert sounds: one per alert kind — built-in id ("radio" …) or "none" or one of mine. Off by default. */
  sounds: { vol: number; map: Partial<Record<NotifyEvent, string>>; mine: { id: string; name: string; url: string }[] };
  keys: Record<ShortcutId, string>; keysOff: ShortcutId[]; pageKeys: boolean;
};
export type OmItem = { key: string; label: string; group: string; min: number; locked?: boolean };
export type OmMember = { uid: string; role: string; callsign: string; firstName: string; lastName: string; rank: string; overrides: Record<string, 0 | 1>; until: Record<string, string>; photo: string | null; lastSeen: unknown };
export type OmLog = { id: string; atISO: string; byName: string; targetUid: string; targetName: string; changes: string[]; reason: string; undone?: boolean; undoneBy?: string };
export type OmData = { me: { uid: string; role: string; access: Record<string, boolean> }; items: OmItem[]; members?: OmMember[]; assignable?: string[]; log?: OmLog[] };
export type RaData = { canEdit: boolean; items: OmItem[]; roles: { key: string; count: number }[]; builtIn: Record<string, Record<string, boolean>>; current: Record<string, Record<string, 0 | 1>> };
export type SysInfo = { version: string; windows: string; installedISO: string; upMins: number; freeGB: number; idleSecs: number };
export type Device = { id: string; name: string; appVersion: string; os: string; current: boolean; signedInAt: string; lastUsedAt: string; expiresAt: string; revokedAt: string; revokedReason: string };
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
export type ProjTask = { id: string; title: string; done: boolean; doneAtISO?: string | null; assigneeUid: string; due: string; priority: "high" | "med" | "low"; parent: string | null; createdBy: string };
export type Proj = { id: string; title: string; description: string; cover: string; category: string; priority: "high" | "med" | "low"; status: "planning" | "active" | "hold" | "done"; deadline: string;
  privacy: "private" | "invite"; ownerUid: string; members: { uid: string; role: "editor" | "viewer"; status: "active" | "pending"; invitedBy: string; atISO: string; message?: string }[];
  tasks: ProjTask[]; images: { url: string; name: string; by: string; atISO: string }[]; comments: { id: string; uid: string; text: string; atISO: string }[];
  activity: { atISO: string; icon: string; text: string }[]; createdAtISO: string; updatedAtISO: string; myRole: "owner" | "editor" | "viewer" | "pending" | null };
export type ProjData = { me: string; categories: string[]; projects: Proj[]; people: { uid: string; name: string; platoon: string; photo: string | null }[] };
export type MsgData = {
  me: string;
  convs: { id: string; participants: string[]; name: string | null; lastMessage: string; lastMessageAt: string; lastSenderUid: string; unread: number; pinned: boolean; muted: boolean; typing: string[] }[];
  people: { uid: string; name: string; role: string; platoon: string; photo: string | null; online: boolean }[];
  messages?: { id: string; senderUid: string; text: string; imageUrl: string; at: string; readBy: string[]; reactions: Record<string, string[]> }[];
};
export type HubAccessData = {
  canManage: boolean;
  people: { uid: string; name: string; role: string; photo: string | null; always: boolean; status: string; byName: string; atISO: string; reason: string; note: string; requestAtISO: string; suspended?: boolean; devices: number; lastUsedISO: string }[];
  stats: { access: number; requests: number; online: number; revoked: number };
};
export type UpdateInfo = { available: boolean; latest: string; notes?: string[]; sizeMB?: number; sha256?: string; dateISO?: string; file?: string; url?: string | null };
export type UpdateState =
  | { state: "idle" | "checking"; checkedAt: string | null; latest: string | null }
  | { state: "available"; info: UpdateInfo; checkedAt: string }
  | { state: "downloading"; info: UpdateInfo; percent: number }
  | { state: "installing"; info: UpdateInfo }
  | { state: "error"; message: string; info?: UpdateInfo };
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
      app: { applySettings(s: { startup: boolean; closeToTray: boolean; zoom: number; toggleKey: string }): Promise<void>; quit(): Promise<void>;
        sys(): Promise<SysInfo | null>; repair(what: "cache" | "window" | "logs"): Promise<string>; onSleep(cb: (why: string) => void): () => void };
      update: {
        get(): Promise<UpdateState>;
        check(): Promise<UpdateState>;
        install(): Promise<UpdateState>;
        onState(cb: (s: UpdateState) => void): () => void;
        onNew(cb: (i: UpdateInfo) => void): () => void;
      };
      notify: {
        show(t: { id: string; title: string; body: string; icon?: string; color?: string; urgent?: boolean; actions?: { id: string; label: string }[] }, o: { popup: boolean; taskbar: boolean; edge: boolean; windows?: boolean; test?: boolean; style?: "edge" | "tint" | "badge"; color?: string; safe?: boolean; until?: boolean; stay?: boolean }): Promise<void>;
        unread(n: number): Promise<void>;
        onAction(cb: (a: { id: string; action: string }) => void): () => void;
      };
      tray: {
        info(i: { name: string; role: string; msgs: number; tickets: number; dnd: boolean; startup: boolean }): Promise<void>;
        onPage(cb: (page: string) => void): () => void;
        onToggle(cb: (what: "dnd" | "startup") => void): () => void;
      };
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
        projects(): Promise<ProjData | { error: string }>;
        messages(conv?: string): Promise<MsgData | { error: string }>;
        messagesAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; msg?: string; error?: string }>;
        network(): Promise<NetData | { error: string }>;
        network(mon: string, range: string): Promise<NetDetail | { error: string }>;
        networkAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string; id?: string }>;
        notes(): Promise<NotesData | { error: string }>;
        notesAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; msg?: string; error?: string; alerted?: number }>;
        hubAccess(): Promise<HubAccessData | { error: string }>;
        hubAccessAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        policy(): Promise<{ version: string; accepted: boolean; atISO: string } | { error: string }>;
        policyAction(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }>;
        devices(): Promise<{ devices: Device[]; recent: Device[] } | { error: string }>;
        devicesAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        feedbackAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        officers(): Promise<OmData | { error: string }>;
        officersAction(body: Record<string, unknown>): Promise<{ ok?: boolean; saved?: number; error?: string }>;
        roles(): Promise<RaData | { error: string }>;
        rolesAction(body: Record<string, unknown>): Promise<{ ok?: boolean; changed?: number; error?: string }>;
        projectsAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string; msg?: string; error?: string }>;
        sendAction(body: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string; error?: string }>;
        setStatus(s: { state: string; note?: string; untilISO?: string | null }): Promise<{ ok?: boolean; error?: string }>;
      };
    };
  }
}
export {};
