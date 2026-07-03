export type PgDatabaseBackupResult = {
  ok: boolean;
  message: string;
  filePath?: string;
};

export type PgDatabaseRestoreResult = {
  ok: boolean;
  message: string;
  filePath?: string;
};

export type PgDatabaseSummary = {
  name: string;
};

export type PgDatabaseListResult = {
  ok: boolean;
  message: string;
  databases: PgDatabaseSummary[];
};

export type PgBackupFolderSelectionResult = {
  ok: boolean;
  message: string;
  folderPath?: string;
};

export type PgDatabaseMaintenanceItemResult = {
  name: string;
  ok: boolean;
  message: string;
  filePath?: string;
};

export type PgMultiDatabaseBackupPayload = {
  connectionId?: string | null;
  databases: string[];
  folderPath: string;
};

export type PgMultiDatabaseBackupResult = {
  ok: boolean;
  message: string;
  items: PgDatabaseMaintenanceItemResult[];
};

export type PgRestoreFileEntry = {
  filePath: string;
  targetDatabase: string;
};

export type PgRestoreFileSelectionResult = {
  ok: boolean;
  message: string;
  files: PgRestoreFileEntry[];
};

export type PgMultiDatabaseRestorePayload = {
  connectionId?: string | null;
  entries: PgRestoreFileEntry[];
};

export type PgMultiDatabaseRestoreResult = {
  ok: boolean;
  message: string;
  items: PgDatabaseMaintenanceItemResult[];
};
