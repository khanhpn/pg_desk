import { ipcMain } from "electron";
import {
  applyPostgresTableChange,
  getPostgresExplorer,
  getPostgresTableDetail,
} from "@electron/services/postgres-metadata-service";
import type { PgTableChangePayload } from "@electron/types/metadata";

export const registerMetadataIpc = (): void => {
  ipcMain.handle(
    "metadata:explorer",
    async (_event, payload?: { connectionId?: string | null }) => {
      return getPostgresExplorer(payload?.connectionId);
    },
  );

  ipcMain.handle(
    "metadata:table-detail",
    async (
      _event,
      payload: { schema: string; table: string; connectionId?: string | null },
    ) => {
      return getPostgresTableDetail(
        payload.schema,
        payload.table,
        payload.connectionId,
      );
    },
  );

  ipcMain.handle(
    "metadata:apply-table-change",
    async (
      _event,
      payload: {
        change: PgTableChangePayload;
        connectionId?: string | null;
      },
    ) => {
      return applyPostgresTableChange(payload.change, payload.connectionId);
    },
  );
};
