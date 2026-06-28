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
  columnMetadata: QueryColumnMetadata[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  command?: string;
  editMessage?: string;
};

type QueryColumnMetadata = {
  name: string;
  dataTypeId: number;
  tableOid: number;
  columnId: number;
  columnName: string | null;
  tableSchema: string | null;
  tableName: string | null;
  isPrimaryKey: boolean;
  isEditable: boolean;
};

type QueryCellUpdatePayload = {
  tableOid: number;
  columnName: string;
  primaryKeys: Array<{
    columnName: string;
    value: unknown;
  }>;
  value: unknown;
};

type QueryCellUpdateResult = {
  ok: boolean;
  message: string;
  rowCount: number;
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

type UpdateStatusPayload = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  message: string;
  version?: string;
  percent?: number;
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
    updateCell: (
      payload: QueryCellUpdatePayload,
    ) => Promise<QueryCellUpdateResult>;
  };

  metadata: {
    explorer: () => Promise<PgDatabaseExplorerResult>;
  };

  update: {
    check: () => Promise<{ ok: boolean }>;
    download: () => Promise<{ ok: boolean }>;
    onStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void;
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export { type UpdateStatusPayload };
