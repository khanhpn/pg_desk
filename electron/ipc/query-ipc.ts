import { ipcMain } from "electron";
import {
  runPostgresQuery,
  updatePostgresCell,
} from "@electron/services/postgres-connection-service";
import type {
  QueryCellUpdatePayload,
  QueryRunPayload,
} from "@electron/types/query";

export const registerQueryIpc = (): void => {
  ipcMain.handle("query:run", async (_event, payload: QueryRunPayload) => {
    return runPostgresQuery(payload);
  });

  ipcMain.handle(
    "query:update-cell",
    async (_event, payload: QueryCellUpdatePayload) => {
      return updatePostgresCell(payload);
    },
  );
};
