import { ipcMain } from "electron";
import { testPostgresConnection } from "@electron/services/postgres-connection-service";
import type { PgConnectionConfig } from "@electron/types/connection";

export const registerConnectionIpc = (): void => {
  ipcMain.handle(
    "connection:test",
    async (_event, config: PgConnectionConfig) => {
      return testPostgresConnection(config);
    },
  );
};
