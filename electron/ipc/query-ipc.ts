import { ipcMain } from "electron";
import { runPostgresQuery } from "@electron/services/postgres-connection-service";
import type { QueryRunPayload } from "@electron/types/query";

export const registerQueryIpc = (): void => {
  ipcMain.handle("query:run", async (_event, payload: QueryRunPayload) => {
    return runPostgresQuery(payload);
  });
};
