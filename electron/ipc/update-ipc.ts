import { ipcMain } from "electron";
import {
  checkForAppUpdates,
  downloadAppUpdate,
} from "@electron/services/app-update-service";

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
};
