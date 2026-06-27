/// <reference types="vite/client" />

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

type PgDeskApi = {
  app: {
    ping: () => Promise<{
      ok: boolean;
      message: string;
      timestamp: string;
    }>;
  };

  connection: {
    test: (config: PgConnectionConfig) => Promise<PgConnectionTestResult>;
    connect: (config: PgConnectionConfig) => Promise<PgConnectionTestResult>;
    disconnect: () => Promise<{ ok: boolean; message: string }>;
  };

  query: {
    run: (sql: string) => Promise<QueryRunResult>;
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export {};
