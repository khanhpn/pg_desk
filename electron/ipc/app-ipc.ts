import { ipcMain } from "electron";

/** Registers application-level IPC handlers. @returns Nothing. */
export const registerAppIpc = (): void => {
  ipcMain.handle("app:ping", async () => {
    return {
      ok: true,
      message: "pong from Electron main process",
      timestamp: new Date().toISOString(),
    };
  });
};
