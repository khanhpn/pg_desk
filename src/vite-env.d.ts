/// <reference types="vite/client" />

type PgConnectionConfig = {
  id?: string;
  name?: string;
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

type PgConnectionProfile = PgConnectionConfig & {
  id: string;
  name: string;
};

type PgConnectionListResult = {
  profiles: PgConnectionProfile[];
  activeConnectionId: string | null;
  connectedConnectionIds: string[];
};

type PgDatabaseBackupResult = {
  ok: boolean;
  message: string;
  filePath?: string;
};

type PgDatabaseRestoreResult = {
  ok: boolean;
  message: string;
  filePath?: string;
};

type PgDatabaseSummary = {
  name: string;
};

type PgDatabaseListResult = {
  ok: boolean;
  message: string;
  databases: PgDatabaseSummary[];
};

type PgBackupFolderSelectionResult = {
  ok: boolean;
  message: string;
  folderPath?: string;
};

type PgDatabaseMaintenanceItemResult = {
  name: string;
  ok: boolean;
  message: string;
  filePath?: string;
};

type PgMultiDatabaseBackupPayload = {
  connectionId?: string | null;
  databases: string[];
  folderPath: string;
};

type PgMultiDatabaseBackupResult = {
  ok: boolean;
  message: string;
  items: PgDatabaseMaintenanceItemResult[];
};

type PgRestoreFileEntry = {
  filePath: string;
  targetDatabase: string;
};

type PgRestoreFileSelectionResult = {
  ok: boolean;
  message: string;
  files: PgRestoreFileEntry[];
};

type PgMultiDatabaseRestorePayload = {
  connectionId?: string | null;
  entries: PgRestoreFileEntry[];
};

type PgMultiDatabaseRestoreResult = {
  ok: boolean;
  message: string;
  items: PgDatabaseMaintenanceItemResult[];
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
  connectionId?: string | null;
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

type QueryRowDeletePayload = {
  connectionId?: string | null;
  tableOid: number;
  primaryKeys: Array<{
    columnName: string;
    value: unknown;
  }>;
};

type QueryRowDeleteResult = {
  ok: boolean;
  message: string;
  rowCount: number;
};

type QueryCancelResult = {
  ok: boolean;
  message: string;
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

type PgTableColumnInfo = {
  name: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
};

type PgTableForeignKeyInfo = {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  updateRule: string;
  deleteRule: string;
};

type PgTableIndexInfo = {
  name: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
};

type PgTableDetail = {
  schema: string;
  name: string;
  columns: PgTableColumnInfo[];
  foreignKeys: PgTableForeignKeyInfo[];
  indexes: PgTableIndexInfo[];
};

type PgTableDetailResult = {
  ok: boolean;
  message: string;
  table: PgTableDetail | null;
};

type PgTableChangePayload =
  | {
      action: "add-column";
      schema: string;
      table: string;
      columnName: string;
      dataType: string;
      isNullable: boolean;
    }
  | {
      action: "rename-column";
      schema: string;
      table: string;
      columnName: string;
      newColumnName: string;
    }
  | {
      action: "change-data-type";
      schema: string;
      table: string;
      columnName: string;
      dataType: string;
    }
  | {
      action: "change-default";
      schema: string;
      table: string;
      columnName: string;
      defaultExpression: string | null;
    }
  | {
      action: "delete-column";
      schema: string;
      table: string;
      columnName: string;
    };

type PgTableChangeResult = {
  ok: boolean;
  message: string;
  sql: string;
};

type UpdateStatusPayload = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";
  message: string;
  version?: string;
  percent?: number;
  isManual?: boolean;
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
    disconnect: (
      connectionId?: string | null,
    ) => Promise<{ ok: boolean; message: string }>;
    list: () => Promise<PgConnectionListResult>;
    deleteProfile: (
      connectionId: string,
    ) => Promise<{ ok: boolean; message: string }>;
    setActive: (
      connectionId: string,
    ) => Promise<{ ok: boolean; message: string }>;
    getProfile: () => Promise<PgConnectionConfig | null>;
  };

  query: {
    run: (
      sql: string,
      connectionId?: string | null,
      requestId?: string,
    ) => Promise<QueryRunResult>;
    cancel: (
      connectionId: string | null,
      requestId: string,
    ) => Promise<QueryCancelResult>;
    explain: (
      sql: string,
      connectionId?: string | null,
    ) => Promise<QueryRunResult>;
    updateCell: (
      payload: QueryCellUpdatePayload,
    ) => Promise<QueryCellUpdateResult>;
    deleteRow: (
      payload: QueryRowDeletePayload,
    ) => Promise<QueryRowDeleteResult>;
  };

  database: {
    backup: (connectionId?: string | null) => Promise<PgDatabaseBackupResult>;
    restore: (connectionId?: string | null) => Promise<PgDatabaseRestoreResult>;
    listDatabases: (
      connectionId?: string | null,
    ) => Promise<PgDatabaseListResult>;
    chooseBackupFolder: () => Promise<PgBackupFolderSelectionResult>;
    chooseRestoreFiles: () => Promise<PgRestoreFileSelectionResult>;
    backupMany: (
      payload: PgMultiDatabaseBackupPayload,
    ) => Promise<PgMultiDatabaseBackupResult>;
    restoreMany: (
      payload: PgMultiDatabaseRestorePayload,
    ) => Promise<PgMultiDatabaseRestoreResult>;
    onOpenBackupModal: (callback: () => void) => () => void;
    onOpenRestoreModal: (callback: () => void) => () => void;
  };

  metadata: {
    explorer: (
      connectionId?: string | null,
    ) => Promise<PgDatabaseExplorerResult>;
    tableDetail: (
      schema: string,
      table: string,
      connectionId?: string | null,
    ) => Promise<PgTableDetailResult>;
    applyTableChange: (
      payload: PgTableChangePayload,
      connectionId?: string | null,
    ) => Promise<PgTableChangeResult>;
  };

  update: {
    check: () => Promise<{ ok: boolean }>;
    download: () => Promise<{ ok: boolean }>;
    install: () => Promise<{ ok: boolean }>;
    onStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void;
  };
};

declare global {
  interface Window {
    pgdesk: PgDeskApi;
  }
}

export { type UpdateStatusPayload };
