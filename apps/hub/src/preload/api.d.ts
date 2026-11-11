export type AppUser = { uid: string; name: string; role: string; deviceName: string; discordUsername: string; platoon: string; access: Record<string, boolean> };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "waiting" }
  | { status: "signed-in"; user: AppUser }
  | { status: "offline"; error: string };
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
    };
  }
}
export {};
