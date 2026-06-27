import { ipcMain } from "electron";
import {
  connectPostgres,
  disconnectPostgres,
  testPostgresConnection,
} from "@electron/services/postgres-connection-service";
import type { PgConnectionConfig } from "@electron/types/connection";

export const registerConnectionIpc = (): void => {
  ipcMain.handle(
    "connection:test",
    async (_event, config: PgConnectionConfig) => {
      return testPostgresConnection(config);
    },
  );

  ipcMain.handle(
    "connection:connect",
    async (_event, config: PgConnectionConfig) => {
      return connectPostgres(config);
    },
  );

  ipcMain.handle("connection:disconnect", async () => {
    await disconnectPostgres();

    return {
      ok: true,
      message: "Disconnected",
    };
  });
};
