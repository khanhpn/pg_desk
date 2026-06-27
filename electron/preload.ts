import { contextBridge, ipcRenderer } from "electron";

type PgConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

type PgConnectionTestResult = {
  ok: boolean;
  message: string;
  database?: string;
  user?: string;
  serverVersion?: string;
};

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
