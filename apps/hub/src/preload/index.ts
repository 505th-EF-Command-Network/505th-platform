/**
 * The only bridge between the window and the app's main process. Exposes window.cn — no Node, no files, no token.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const on = (ch: string) => (cb: (v: unknown) => void) => {
  const h = (_e: IpcRendererEvent, v: unknown) => cb(v);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld("cn", {
  auth: {
    get: () => ipcRenderer.invoke("auth:get"),
    login: () => ipcRenderer.invoke("auth:login"),
    cancel: () => ipcRenderer.invoke("auth:cancel"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    retry: () => ipcRenderer.invoke("auth:retry"),
    onChange: on("auth:state"),
  },
  net: {
    get: () => ipcRenderer.invoke("net:get"),
    onState: on("net:state"),
    onTopic: on("net:topic"),
  },
  info: () => ipcRenderer.invoke("app:info"),
  app: {
    applySettings: (s: Record<string, unknown>) => ipcRenderer.invoke("app:settings", s),
    quit: () => ipcRenderer.invoke("app:quit"),
  },
  update: {
    get: () => ipcRenderer.invoke("update:get"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onState: on("update:state"),
    onNew: on("update:new"),
  },
  notify: {
    show: (t: Record<string, unknown>, o: Record<string, unknown>) => ipcRenderer.invoke("notify:show", t, o),
    unread: (n: number) => ipcRenderer.invoke("notify:unread", n),
    onAction: on("notify:action"),
  },
  tray: {
    info: (i: Record<string, unknown>) => ipcRenderer.invoke("tray:info", i),
    onPage: on("tray:page"),
    onToggle: on("tray:toggle"),
  },
  hub: {
    summary: () => ipcRenderer.invoke("hub:summary"),
    members: () => ipcRenderer.invoke("hub:members"),
    member: (id: string) => ipcRenderer.invoke("hub:member", id),
    memberAction: (id: string, body: Record<string, unknown>) => ipcRenderer.invoke("hub:member-action", id, body),
    roster: () => ipcRenderer.invoke("hub:roster"),
    rosterAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:roster-action", body),
    attendance: () => ipcRenderer.invoke("hub:attendance"),
    attendanceAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:attendance-action", body),
    events: () => ipcRenderer.invoke("hub:events"),
    eventsAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:events-action", body),
    rsvp: (eventId: string, key: string) => ipcRenderer.invoke("hub:rsvp", eventId, key),
    history: () => ipcRenderer.invoke("hub:history"),
    historyAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:history-action", body),
    media: () => ipcRenderer.invoke("hub:media"),
    mediaAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:media-action", body),
    oob: () => ipcRenderer.invoke("hub:oob"),
    oobAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:oob-action", body),
    recruit: () => ipcRenderer.invoke("hub:recruit"),
    tickets: () => ipcRenderer.invoke("hub:tickets"),
    ticketsAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:tickets-action", body),
    send: () => ipcRenderer.invoke("hub:send"),
    projects: () => ipcRenderer.invoke("hub:projects"),
    devices: () => ipcRenderer.invoke("hub:devices"),
    hubAccess: () => ipcRenderer.invoke("hub:hub-access"),
    hubAccessAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:hub-access-action", body),
    network: (mon?: string, range?: string) => ipcRenderer.invoke("hub:network", mon, range),
    networkAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:network-action", body),
    policy: () => ipcRenderer.invoke("hub:policy"),
    policyAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:policy-action", body),
    messages: (conv?: string) => ipcRenderer.invoke("hub:messages", conv),
    messagesAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:messages-action", body),
    devicesAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:devices-action", body),
    projectsAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:projects-action", body),
    sendAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:send-action", body),
    overview: () => ipcRenderer.invoke("hub:overview"),
    savePrefs: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:prefs", body),
    readAlerts: (body: { ids?: string[]; all?: boolean }) => ipcRenderer.invoke("hub:alerts-read", body),
    bct: () => ipcRenderer.invoke("hub:bct"),
    bctAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:bct-action", body),
    aars: () => ipcRenderer.invoke("hub:aars"),
    aarsAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:aars-action", body),
    upload: (folder: string, name: string, type: string, bytes: Uint8Array) => ipcRenderer.invoke("hub:upload", folder, name, type, bytes),
    setStatus: (s: { state: string; note?: string; untilISO?: string | null }) => ipcRenderer.invoke("hub:set-status", s),
  },
});
