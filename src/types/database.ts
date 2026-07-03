export type PgDatabaseSummary = {
  name: string;
};

export type PgDatabaseMaintenanceItemResult = {
  name: string;
  ok: boolean;
  message: string;
  filePath?: string;
};

export type PgRestoreFileEntry = {
  filePath: string;
  targetDatabase: string;
};
