import { ipcMain } from "electron";
import {
  explainPostgresQuery,
  runPostgresQuery,
  updatePostgresCell,
} from "@electron/services/postgres-connection-service";
import type {
  QueryExplainPayload,
  QueryCellUpdatePayload,
  QueryRunPayload,
} from "@electron/types/query";

export const registerQueryIpc = (): void => {
  ipcMain.handle("query:run", async (_event, payload: QueryRunPayload) => {
    return runPostgresQuery(payload);
  });

  ipcMain.handle(
    "query:explain",
    async (_event, payload: QueryExplainPayload) => {
      return explainPostgresQuery(payload);
    },
  );

  ipcMain.handle(
    "query:update-cell",
    async (_event, payload: QueryCellUpdatePayload) => {
      return updatePostgresCell(payload);
    },
  );
};
