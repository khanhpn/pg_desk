import { ipcMain } from "electron";

export const registerAppIpc = (): void => {
  ipcMain.handle("app:ping", async () => {
    return {
      ok: true,
      message: "pong from Electron main process",
      timestamp: new Date().toISOString(),
    };
  });
};
