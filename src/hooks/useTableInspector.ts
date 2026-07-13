import { useCallback, useState } from "react";
import type { PgRelationInfo, PgTableDetail } from "@/types/metadata";

type TableInspectorMenuState = {
  relation: PgRelationInfo;
  x: number;
  y: number;
};

/**
 * Coordinates table context-menu state and schema inspection for the selected
 * PostgreSQL relation.
 *
 * @param connectionId - Connection used for metadata requests and schema changes.
 * @returns Context-menu, drawer, metadata, refresh, and mutation commands for the
 * table inspector UI.
 */
export const useTableInspector = (connectionId: string | null) => {
  const [contextMenu, setContextMenu] =
    useState<TableInspectorMenuState | null>(null);
  const [selectedTable, setSelectedTable] = useState<PgRelationInfo | null>(
    null,
  );
  const [tableDetail, setTableDetail] = useState<PgTableDetail | null>(null);
  const [isLoadingTableDetail, setIsLoadingTableDetail] = useState(false);
  const [tableDetailMessage, setTableDetailMessage] = useState("");

  const closeTableContextMenu = useCallback((): void => {
    setContextMenu(null);
  }, []);

  const openTableContextMenu = useCallback(
    (relation: PgRelationInfo, x: number, y: number): void => {
      setContextMenu({ relation, x, y });
    },
    [],
  );

  const openTableInspector = useCallback(
    async (relation: PgRelationInfo): Promise<void> => {
      if (!connectionId) {
        setTableDetailMessage(
          "Select a connection before loading table details.",
        );
        return;
      }

      closeTableContextMenu();
      setSelectedTable(relation);
      setTableDetail(null);
      setTableDetailMessage("Loading table details...");
      setIsLoadingTableDetail(true);

      try {
        const result = await window.pgdesk.metadata.tableDetail(
          relation.schema,
          relation.name,
          connectionId,
        );

        if (result.ok && result.table) {
          setTableDetail(result.table);
          setTableDetailMessage(result.message);
          return;
        }

        setTableDetailMessage(`Error: ${result.message}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        setTableDetailMessage(`Error: ${message}`);
      } finally {
        setIsLoadingTableDetail(false);
      }
    },
    [closeTableContextMenu, connectionId],
  );

  const closeTableInspector = useCallback((): void => {
    setSelectedTable(null);
    setTableDetail(null);
    setTableDetailMessage("");
  }, []);

  const refreshTableInspector = useCallback(async (): Promise<void> => {
    if (!selectedTable) {
      return;
    }

    await openTableInspector(selectedTable);
  }, [openTableInspector, selectedTable]);

  return {
    contextMenu,
    selectedTable,
    tableDetail,
    isLoadingTableDetail,
    tableDetailMessage,
    openTableContextMenu,
    closeTableContextMenu,
    openTableInspector,
    closeTableInspector,
    refreshTableInspector,
  };
};
