import { BrowserWindow, ipcMain } from "electron";
import {
  backupPostgresDatabase,
  backupPostgresDatabases,
  choosePostgresBackupFolder,
  choosePostgresRestoreFiles,
  listPostgresDatabases,
  restorePostgresDatabase,
  restorePostgresDatabases,
} from "@electron/services/postgres-backup-service";
import type {
  PgMultiDatabaseBackupPayload,
  PgMultiDatabaseRestorePayload,
} from "@electron/types/database";

/** Registers database discovery, backup, restore, and picker IPC handlers. @returns Nothing. */
export const registerDatabaseIpc = (): void => {
  ipcMain.handle(
    "database:backup",
    async (event, payload?: { connectionId?: string | null }) => {
      return backupPostgresDatabase(
        BrowserWindow.fromWebContents(event.sender),
        payload?.connectionId,
      );
    },
  );

  ipcMain.handle(
    "database:restore",
    async (event, payload?: { connectionId?: string | null }) => {
      return restorePostgresDatabase(
        BrowserWindow.fromWebContents(event.sender),
        payload?.connectionId,
      );
    },
  );

  ipcMain.handle(
    "database:list-databases",
    async (_event, payload?: { connectionId?: string | null }) => {
      return listPostgresDatabases(payload?.connectionId);
    },
  );

  ipcMain.handle("database:choose-backup-folder", async (event) => {
    return choosePostgresBackupFolder(
      BrowserWindow.fromWebContents(event.sender),
    );
  });

  ipcMain.handle("database:choose-restore-files", async (event) => {
    return choosePostgresRestoreFiles(
      BrowserWindow.fromWebContents(event.sender),
    );
  });

  ipcMain.handle(
    "database:backup-many",
    async (_event, payload: PgMultiDatabaseBackupPayload) => {
      return backupPostgresDatabases(payload);
    },
  );

  ipcMain.handle(
    "database:restore-many",
    async (_event, payload: PgMultiDatabaseRestorePayload) => {
      return restorePostgresDatabases(payload);
    },
  );
};
