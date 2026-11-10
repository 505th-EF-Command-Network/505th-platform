import "server-only";

/**
 * Discord OAuth2 (authorization code flow) — server side only.
 * Scopes: identify (who you are) + guilds.members.read (are you in the 505th
 * server, and your server nickname/roles). We never request email or DMs.
 */
const API = "https://discord.com/api/v10";
export const SCOPES = ["identify", "guilds.members.read"];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to apps/website/.env.local.`);
  return v;
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const redirectUri = () => `${appUrl()}/api/auth/callback`;

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

export async function exchangeCode(code: string): Promise<{ access_token: string }> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord token exchange failed (${res.status})`);
  return res.json();
}

export type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null };

export async function fetchUser(token: string): Promise<DiscordUser> {
  const res = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Discord user lookup failed (${res.status})`);
  return res.json();
}

/** Returns null when the user is not a member of the 505th Discord server. */
export async function fetchGuildMember(token: string): Promise<{ nick: string | null; roles: string[] } | null> {
  const res = await fetch(`${API}/users/@me/guilds/${env("DISCORD_GUILD_ID")}/member`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Discord server membership lookup failed (${res.status})`);
  return res.json();
}

export async function revokeToken(token: string) {
  await fetch(`${API}/oauth2/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("DISCORD_CLIENT_ID"), client_secret: env("DISCORD_CLIENT_SECRET"), token }),
  }).catch(() => undefined);
}

export function avatarUrl(u: { id: string; avatar: string | null }): string | null {
  return u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : null;
}
