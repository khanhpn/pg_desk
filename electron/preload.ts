import { contextBridge, ipcRenderer } from "electron";
import type {
  PgConnectionConfig,
  PgConnectionTestResult,
} from "@electron/types/connection";

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
  connection: {
    test: (config: PgConnectionConfig): Promise<PgConnectionTestResult> => {
      return ipcRenderer.invoke("connection:test", config);
    },
  },
};

contextBridge.exposeInMainWorld("pgdesk", pgdeskApi);
