import { ipcMain } from "electron";
import {
  applyPostgresTableChanges,
  cancelPostgresQuery,
  deletePostgresRow,
  explainPostgresQuery,
  runPostgresQuery,
  updatePostgresCell,
} from "@electron/services/postgres-connection-service";
import type {
  QueryCellUpdatePayload,
  QueryCancelPayload,
  QueryExplainPayload,
  QueryRunPayload,
  QueryRowDeletePayload,
  QueryTableChangePayload,
} from "@electron/types/query";

export const registerQueryIpc = (): void => {
  ipcMain.handle("query:run", async (_event, payload: QueryRunPayload) => {
    return runPostgresQuery(payload);
  });

  ipcMain.handle(
    "query:cancel",
    async (_event, payload: QueryCancelPayload) => {
      return cancelPostgresQuery(payload);
    },
  );

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

  ipcMain.handle(
    "query:delete-row",
    async (_event, payload: QueryRowDeletePayload) => {
      return deletePostgresRow(payload);
    },
  );

  ipcMain.handle(
    "query:apply-table-changes",
    async (_event, payload: QueryTableChangePayload) => {
      return applyPostgresTableChanges(payload);
    },
  );
};
