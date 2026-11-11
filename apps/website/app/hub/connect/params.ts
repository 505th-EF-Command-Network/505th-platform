/** Query string the Command Network app opens: /hub/connect?challenge=…&state=…&device=… */
export type ConnectParams = { challenge: string; state: string; device: string };

export function parseConnect(raw: Record<string, unknown>): ConnectParams | null {
  const challenge = String(raw.challenge ?? ""), state = String(raw.state ?? ""), device = String(raw.device ?? "").trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return null;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) return null;
  if (!device || device.length > 64 || !/^[\w .-]+$/.test(device)) return null;
  return { challenge, state, device };
}

export function connectPath(p: ConnectParams): string {
  return `/hub/connect?${new URLSearchParams({ challenge: p.challenge, state: p.state, device: p.device }).toString()}`;
}
