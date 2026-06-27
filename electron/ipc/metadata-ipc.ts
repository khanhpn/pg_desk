import { ipcMain } from "electron";
import { getPostgresExplorer } from "@electron/services/postgres-metadata-service";

export const registerMetadataIpc = (): void => {
  ipcMain.handle("metadata:explorer", async () => {
    return getPostgresExplorer();
  });
};
