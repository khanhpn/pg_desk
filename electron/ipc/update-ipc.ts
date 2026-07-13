import { ipcMain } from "electron";
import {
  checkForAppUpdates,
  downloadAppUpdate,
  installAppUpdate,
} from "@electron/services/app-update-service";

/** Registers update check, download, and installation IPC handlers. @returns Nothing. */
export const registerUpdateIpc = (): void => {
  ipcMain.handle("update:check", async () => {
    await checkForAppUpdates();

    return {
      ok: true,
    };
  });

  ipcMain.handle("update:download", async () => {
    await downloadAppUpdate();

    return {
      ok: true,
    };
  });

  ipcMain.handle("update:install", async () => {
    await installAppUpdate();

    return {
      ok: true,
    };
  });
};
