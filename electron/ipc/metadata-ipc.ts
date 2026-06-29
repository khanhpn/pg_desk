import { ipcMain } from "electron";
import {
  applyPostgresTableChange,
  getPostgresExplorer,
  getPostgresTableDetail,
} from "@electron/services/postgres-metadata-service";
import type { PgTableChangePayload } from "@electron/types/metadata";

export const registerMetadataIpc = (): void => {
  ipcMain.handle("metadata:explorer", async () => {
    return getPostgresExplorer();
  });

  ipcMain.handle(
    "metadata:table-detail",
    async (_event, payload: { schema: string; table: string }) => {
      return getPostgresTableDetail(payload.schema, payload.table);
    },
  );

  ipcMain.handle(
    "metadata:apply-table-change",
    async (_event, payload: PgTableChangePayload) => {
      return applyPostgresTableChange(payload);
    },
  );
};
