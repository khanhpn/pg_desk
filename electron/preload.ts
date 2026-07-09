import { contextBridge, ipcRenderer } from "electron";

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

    disconnect: (
      connectionId?: string | null,
    ): Promise<{ ok: boolean; message: string }> => {
      return ipcRenderer.invoke("connection:disconnect", { connectionId });
    },

    list: (): Promise<PgConnectionListResult> => {
      return ipcRenderer.invoke("connection:list");
    },

    deleteProfile: (
      connectionId: string,
    ): Promise<{ ok: boolean; message: string }> => {
      return ipcRenderer.invoke("connection:profile:delete", { connectionId });
    },

    setActive: (
      connectionId: string,
    ): Promise<{ ok: boolean; message: string }> => {
      return ipcRenderer.invoke("connection:set-active", { connectionId });
    },

    getProfile: (): Promise<PgConnectionConfig | null> => {
      return ipcRenderer.invoke("connection:profile:get");
    },
  },

  query: {
    run: (
      sql: string,
      connectionId?: string | null,
      requestId?: string,
    ): Promise<QueryRunResult> => {
      return ipcRenderer.invoke("query:run", { sql, connectionId, requestId });
    },

    cancel: (
      connectionId: string | null,
      requestId: string,
    ): Promise<QueryCancelResult> => {
      return ipcRenderer.invoke("query:cancel", { connectionId, requestId });
    },

    explain: (
      sql: string,
      connectionId?: string | null,
    ): Promise<QueryRunResult> => {
      return ipcRenderer.invoke("query:explain", { sql, connectionId });
    },

    updateCell: (
      payload: QueryCellUpdatePayload,
    ): Promise<QueryCellUpdateResult> => {
      return ipcRenderer.invoke("query:update-cell", payload);
    },

    deleteRow: (
      payload: QueryRowDeletePayload,
    ): Promise<QueryRowDeleteResult> => {
      return ipcRenderer.invoke("query:delete-row", payload);
    },
  },

  database: {
    backup: (connectionId?: string | null): Promise<PgDatabaseBackupResult> => {
      return ipcRenderer.invoke("database:backup", { connectionId });
    },

    restore: (
      connectionId?: string | null,
    ): Promise<PgDatabaseRestoreResult> => {
      return ipcRenderer.invoke("database:restore", { connectionId });
    },

    listDatabases: (
      connectionId?: string | null,
    ): Promise<PgDatabaseListResult> => {
      return ipcRenderer.invoke("database:list-databases", { connectionId });
    },

    chooseBackupFolder: (): Promise<PgBackupFolderSelectionResult> => {
      return ipcRenderer.invoke("database:choose-backup-folder");
    },

    chooseRestoreFiles: (): Promise<PgRestoreFileSelectionResult> => {
      return ipcRenderer.invoke("database:choose-restore-files");
    },

    backupMany: (
      payload: PgMultiDatabaseBackupPayload,
    ): Promise<PgMultiDatabaseBackupResult> => {
      return ipcRenderer.invoke("database:backup-many", payload);
    },

    restoreMany: (
      payload: PgMultiDatabaseRestorePayload,
    ): Promise<PgMultiDatabaseRestoreResult> => {
      return ipcRenderer.invoke("database:restore-many", payload);
    },

    onOpenBackupModal: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };

      ipcRenderer.on("database:open-backup-modal", listener);

      return () => {
        ipcRenderer.removeListener("database:open-backup-modal", listener);
      };
    },

    onOpenRestoreModal: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };

      ipcRenderer.on("database:open-restore-modal", listener);

      return () => {
        ipcRenderer.removeListener("database:open-restore-modal", listener);
      };
    },
  },

  metadata: {
    explorer: (
      connectionId?: string | null,
    ): Promise<PgDatabaseExplorerResult> => {
      return ipcRenderer.invoke("metadata:explorer", { connectionId });
    },

    tableDetail: (
      schema: string,
      table: string,
      connectionId?: string | null,
    ): Promise<PgTableDetailResult> => {
      return ipcRenderer.invoke("metadata:table-detail", {
        schema,
        table,
        connectionId,
      });
    },

    applyTableChange: (
      payload: PgTableChangePayload,
      connectionId?: string | null,
    ): Promise<PgTableChangeResult> => {
      return ipcRenderer.invoke("metadata:apply-table-change", {
        change: payload,
        connectionId,
      });
    },
  },

  update: {
    check: (): Promise<{ ok: boolean }> => {
      return ipcRenderer.invoke("update:check");
    },

    download: (): Promise<{ ok: boolean }> => {
      return ipcRenderer.invoke("update:download");
    },

    install: (): Promise<{ ok: boolean }> => {
      return ipcRenderer.invoke("update:install");
    },

    onStatus: (
      callback: (payload: UpdateStatusPayload) => void,
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: UpdateStatusPayload,
      ): void => {
        callback(payload);
      };

      ipcRenderer.on("update:status", listener);

      return () => {
        ipcRenderer.removeListener("update:status", listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld("pgdesk", pgdeskApi);
