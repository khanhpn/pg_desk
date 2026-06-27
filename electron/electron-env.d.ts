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
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export {};
