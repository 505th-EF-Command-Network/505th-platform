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
        setStatus(s: { state: string; note?: string; untilISO?: string | null }): Promise<{ ok?: boolean; error?: string }>;
      };
      openSite(panel?: string): Promise<void>;
    };
  }
}
export {};
