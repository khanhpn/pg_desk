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

type PgRelationType = "table" | "view";

type PgRelationInfo = {
  schema: string;
  name: string;
  type: PgRelationType;
};

type PgSchemaInfo = {
  name: string;
  tables: PgRelationInfo[];
  views: PgRelationInfo[];
};

type PgDatabaseExplorerResult = {
  ok: boolean;
  message: string;
  schemas: PgSchemaInfo[];
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
    getProfile: () => Promise<PgConnectionConfig | null>;
  };

  query: {
    run: (sql: string) => Promise<QueryRunResult>;
  };

  metadata: {
    explorer: () => Promise<PgDatabaseExplorerResult>;
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export {};
