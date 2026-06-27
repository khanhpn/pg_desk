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

type QueryRunResult = {
  ok: boolean;
  message: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  command?: string;
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

    connect: (config: PgConnectionConfig): Promise<PgConnectionTestResult> => {
      return ipcRenderer.invoke("connection:connect", config);
    },

    disconnect: (): Promise<{ ok: boolean; message: string }> => {
      return ipcRenderer.invoke("connection:disconnect");
    },
  },

  query: {
    run: (sql: string): Promise<QueryRunResult> => {
      return ipcRenderer.invoke("query:run", { sql });
    },
  },
};

contextBridge.exposeInMainWorld("pgdesk", pgdeskApi);
