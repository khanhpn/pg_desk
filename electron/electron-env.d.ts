/// <reference types="vite/client" />

import type {
  PgConnectionConfig,
  PgConnectionTestResult,
} from "@electron/types/connection";

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
