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
