/// <reference types="vite/client" />

type PgDeskApi = {
  connection: {
    test: (config: PgConnectionConfig) => Promise<PgConnectionTestResult>;
  };
  app: {
    ping: () => Promise<{
      ok: boolean;
      message: string;
      timestamp: string;
    }>;
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export {};
