export type AppUser = { uid: string; name: string; role: string; deviceName: string; discordUsername: string; platoon: string; access: Record<string, boolean> };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "waiting" }
  | { status: "signed-in"; user: AppUser }
  | { status: "offline"; error: string };
export type MyStatus = { state: "online" | "dnd" | "invisible" | "offline"; note?: string; untilISO?: string | null };
export type StaffRow = { uid: string; name: string; role: string; level: number; state: "online" | "dnd" | "offline"; page: string; note: string; until: string | null; photo: string | null };
export type Summary = {
  me: { uid: string; name: string; role: string; rank: string; platoon: string; attendance: number; pt: number; opsAttended: number; opsEligible: number; status: MyStatus; access: Record<string, boolean> };
  ops: { id: string; title: string; startAtISO: string; signedUp: number; mine: string | null }[];
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
export type NetState = { state: "off" | "connecting" | "live"; reason: string | null };

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
        setStatus(s: { state: string; note?: string; untilISO?: string | null }): Promise<{ ok?: boolean; error?: string }>;
      };
    };
  }
}
export {};
