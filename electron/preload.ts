import { contextBridge, ipcRenderer } from "electron";

const pgdeskApi = {
  app: {
    ping: (): Promise<{
      ok: boolean;
      message: string;
      timestamp: string;
    }> => {
      return ipcRenderer.invoke("app:ping");
    },
  },
};

contextBridge.exposeInMainWorld("pgdesk", pgdeskApi);
