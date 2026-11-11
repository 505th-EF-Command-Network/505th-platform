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
});
