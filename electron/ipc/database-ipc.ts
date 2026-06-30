import { BrowserWindow, ipcMain } from "electron";
import {
  backupPostgresDatabase,
  restorePostgresDatabase,
} from "@electron/services/postgres-backup-service";

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
};
