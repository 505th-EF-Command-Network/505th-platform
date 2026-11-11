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
  hub: {
    summary: () => ipcRenderer.invoke("hub:summary"),
    members: () => ipcRenderer.invoke("hub:members"),
    member: (id: string) => ipcRenderer.invoke("hub:member", id),
    memberAction: (id: string, body: Record<string, unknown>) => ipcRenderer.invoke("hub:member-action", id, body),
    roster: () => ipcRenderer.invoke("hub:roster"),
    rosterAction: (body: Record<string, unknown>) => ipcRenderer.invoke("hub:roster-action", body),
    setStatus: (s: { state: string; note?: string; untilISO?: string | null }) => ipcRenderer.invoke("hub:set-status", s),
  },
});
