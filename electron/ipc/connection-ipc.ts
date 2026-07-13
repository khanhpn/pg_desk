import { ipcMain } from "electron";
import {
  connectPostgres,
  deletePostgresConnectionProfile,
  disconnectPostgres,
  listPostgresConnections,
  setActivePostgresConnection,
  testPostgresConnection,
} from "@electron/services/postgres-connection-service";
import type { PgConnectionConfig } from "@electron/types/connection";
import { loadConnectionProfile } from "@electron/services/connection-profile-service";

/** Registers connection lifecycle and profile IPC handlers. @returns Nothing. */
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

  ipcMain.handle(
    "connection:disconnect",
    async (_event, payload?: { connectionId?: string | null }) => {
      await disconnectPostgres(payload?.connectionId);

      return {
        ok: true,
        message: "Disconnected",
      };
    },
  );

  ipcMain.handle("connection:list", async () => {
    return listPostgresConnections();
  });

  ipcMain.handle(
    "connection:set-active",
    async (_event, payload: { connectionId: string }) => {
      await setActivePostgresConnection(payload.connectionId);

      return {
        ok: true,
        message: "Active connection changed",
      };
    },
  );

  ipcMain.handle(
    "connection:profile:delete",
    async (_event, payload: { connectionId: string }) => {
      await deletePostgresConnectionProfile(payload.connectionId);

      return {
        ok: true,
        message: "Connection deleted",
      };
    },
  );

  ipcMain.handle("connection:profile:get", async () => {
    return loadConnectionProfile();
  });
};
