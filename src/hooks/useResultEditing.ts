import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  QueryColumnMetadata,
  QueryRunResult,
} from "@electron/types/query";

export type EditableResultRow = {
  id: string;
  values: Record<string, unknown>;
  isNew: boolean;
};

type DirtyCells = Record<string, Record<string, unknown>>;

export type RowDeleteTarget = {
  tableLabel: string;
  payload: {
    connectionId: string | null;
    tableOid: number;
    primaryKeys: Array<{
      columnName: string;
      value: unknown;
    }>;
  };
};

type TableContext = {
  tableOid: number;
  tableLabel: string;
  primaryKeyColumns: QueryColumnMetadata[];
  editableColumns: QueryColumnMetadata[];
};

let nextResultRowId = 0;

const createResultRowId = (prefix: "result" | "new"): string => {
  nextResultRowId += 1;
  return `${prefix}-${nextResultRowId}`;
};

const hasDuplicateColumns = (columns: string[]): boolean => {
  return new Set(columns).size !== columns.length;
};

const getTableContext = (
  queryResult: QueryRunResult | null,
): TableContext | null => {
  if (!queryResult || hasDuplicateColumns(queryResult.columns)) {
    return null;
  }

  const tableOids = Array.from(
    new Set(
      queryResult.columnMetadata
        .filter((column) => column.tableOid > 0 && column.columnId > 0)
        .map((column) => column.tableOid),
    ),
  );

  if (tableOids.length !== 1) {
    return null;
  }

  const tableOid = tableOids[0];
  const tableColumns = queryResult.columnMetadata.filter((column) => {
    return column.tableOid === tableOid && column.columnId > 0;
  });
  const firstColumn = tableColumns.find((column) => {
    return Boolean(column.tableSchema && column.tableName);
  });

  if (!firstColumn?.tableSchema || !firstColumn.tableName) {
    return null;
  }

  const primaryKeyColumns = tableColumns.filter((column) => {
    return column.isPrimaryKey && Boolean(column.columnName);
  });
  const editableColumns = tableColumns.filter((column) => {
    return (
      column.isEditable && !column.isPrimaryKey && Boolean(column.columnName)
    );
  });

  if (primaryKeyColumns.length === 0 || editableColumns.length === 0) {
    return null;
  }

  return {
    tableOid,
    tableLabel: `${firstColumn.tableSchema}.${firstColumn.tableName}`,
    primaryKeyColumns,
    editableColumns,
  };
};

const getPersistableValues = (
  values: Record<string, unknown>,
  columnMetadataByName: Map<string, QueryColumnMetadata>,
): Record<string, unknown> => {
  return Object.entries(values).reduce<Record<string, unknown>>(
    (persistableValues, [columnName, value]) => {
      const metadata = columnMetadataByName.get(columnName);

      if (!metadata?.isEditable || !metadata.columnName) {
        throw new Error(`This cell cannot be saved: ${columnName}`);
      }

      persistableValues[metadata.columnName] = value;
      return persistableValues;
    },
    {},
  );
};

export const useResultEditing = (
  queryResult: QueryRunResult | null,
  connectionId: string | null,
  refreshResult?: () => Promise<void>,
) => {
  const [draftRows, setDraftRows] = useState<EditableResultRow[]>([]);
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const columnMetadataByName = useMemo(() => {
    return new Map(
      queryResult?.columnMetadata.map((column) => [column.name, column]) ?? [],
    );
  }, [queryResult?.columnMetadata]);
  const tableContext = useMemo(
    () => getTableContext(queryResult),
    [queryResult],
  );
  const dirtyCellCount = useMemo(() => {
    return Object.values(dirtyCells).reduce((count, rowCells) => {
      return count + Object.keys(rowCells).length;
    }, 0);
  }, [dirtyCells]);
  const hasPendingChanges = dirtyCellCount > 0;
  const canInsertRows = Boolean(tableContext);

  useEffect(() => {
    setDraftRows(
      queryResult?.rows.map((row) => ({
        id: createResultRowId("result"),
        values: { ...row },
        isNew: false,
      })) ?? [],
    );
    setDirtyCells({});
    setSaveMessage("");
  }, [queryResult]);

  const getRow = useCallback(
    (rowId: string): EditableResultRow | undefined => {
      return draftRows.find((row) => row.id === rowId);
    },
    [draftRows],
  );

  const addRow = useCallback((): string | null => {
    if (!queryResult || !tableContext || isSaving) {
      return null;
    }

    const row: EditableResultRow = {
      id: createResultRowId("new"),
      values: Object.fromEntries(
        queryResult.columns.map((column) => [column, null]),
      ),
      isNew: true,
    };

    setDraftRows((currentRows) => [...currentRows, row]);
    setSaveMessage("");
    return row.id;
  }, [isSaving, queryResult, tableContext]);

  const updateDraftCell = useCallback(
    (rowId: string, column: string, value: unknown): void => {
      if (!getRow(rowId)) {
        return;
      }

      setDraftRows((currentRows) => {
        return currentRows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }

          return {
            ...row,
            values: {
              ...row.values,
              [column]: value,
            },
          };
        });
      });

      setDirtyCells((currentDirtyCells) => ({
        ...currentDirtyCells,
        [rowId]: {
          ...currentDirtyCells[rowId],
          [column]: value,
        },
      }));
      setSaveMessage("");
    },
    [getRow],
  );

  const isCellDirty = useCallback(
    (rowId: string, column: string): boolean => {
      return column in (dirtyCells[rowId] ?? {});
    },
    [dirtyCells],
  );

  const getRowDeleteTarget = useCallback(
    (rowId: string): RowDeleteTarget | null => {
      const row = getRow(rowId);

      if (!row || row.isNew || !tableContext) {
        return null;
      }

      const primaryKeys = tableContext.primaryKeyColumns.map((column) => ({
        columnName: column.columnName as string,
        value: row.values[column.name],
      }));
      const hasAllPrimaryKeys = primaryKeys.every(({ value }) => {
        return value !== null && value !== undefined;
      });

      if (!hasAllPrimaryKeys) {
        return null;
      }

      return {
        tableLabel: tableContext.tableLabel,
        payload: {
          connectionId,
          tableOid: tableContext.tableOid,
          primaryKeys,
        },
      };
    },
    [connectionId, getRow, tableContext],
  );

  const buildTableChangePayload = useCallback(
    (selectedRowIds: string[]) => {
      if (!tableContext) {
        throw new Error("This result cannot be edited safely");
      }

      const selectedIdSet = new Set(selectedRowIds);
      const updates: Array<{
        primaryKeys: Array<{ columnName: string; value: unknown }>;
        values: Record<string, unknown>;
      }> = [];
      const inserts: Array<{ values: Record<string, unknown> }> = [];
      const deletes: Array<{
        primaryKeys: Array<{ columnName: string; value: unknown }>;
      }> = [];

      draftRows.forEach((row, rowIndex) => {
        const rowDirtyCells = dirtyCells[row.id] ?? {};

        if (row.isNew) {
          if (Object.keys(rowDirtyCells).length > 0) {
            inserts.push({
              values: getPersistableValues(rowDirtyCells, columnMetadataByName),
            });
          }
          return;
        }

        if (Object.keys(rowDirtyCells).length > 0) {
          const target = getRowDeleteTarget(row.id);

          if (!target) {
            throw new Error(
              `Row ${rowIndex + 1} is missing a complete primary key`,
            );
          }

          updates.push({
            primaryKeys: target.payload.primaryKeys,
            values: getPersistableValues(rowDirtyCells, columnMetadataByName),
          });
        }

        if (selectedIdSet.has(row.id)) {
          const target = getRowDeleteTarget(row.id);

          if (!target) {
            throw new Error(
              `Row ${rowIndex + 1} is missing a complete primary key`,
            );
          }

          deletes.push({ primaryKeys: target.payload.primaryKeys });
        }
      });

      return {
        connectionId,
        tableOid: tableContext.tableOid,
        updates,
        inserts,
        deletes,
      };
    },
    [
      columnMetadataByName,
      connectionId,
      dirtyCells,
      draftRows,
      getRowDeleteTarget,
      tableContext,
    ],
  );

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!hasPendingChanges || isSaving) {
      return false;
    }

    setIsSaving(true);
    setSaveMessage("Saving changes...");

    try {
      const payload = buildTableChangePayload([]);
      const result = await window.pgdesk.query.applyTableChanges(payload);

      if (!result.ok) {
        throw new Error(result.message);
      }

      setDirtyCells({});

      if (refreshResult) {
        await refreshResult();
      } else {
        setDraftRows((currentRows) => currentRows.filter((row) => !row.isNew));
      }

      setSaveMessage(result.message);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(`Error: ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [buildTableChangePayload, hasPendingChanges, isSaving, refreshResult]);

  const deleteSelectedRows = useCallback(
    async (selectedRowIds: string[]): Promise<boolean> => {
      if (selectedRowIds.length === 0 || isSaving) {
        return false;
      }

      setIsSaving(true);
      setSaveMessage("Deleting rows...");

      try {
        const payload = buildTableChangePayload(selectedRowIds);
        const selectedIdSet = new Set(selectedRowIds);
        const persistedDeletes = payload.deletes.length;
        let deleteMessage: string;

        if (persistedDeletes > 0) {
          const result = await window.pgdesk.query.applyTableChanges({
            ...payload,
            updates: [],
            inserts: [],
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          deleteMessage = result.message;
        } else {
          deleteMessage = `Removed ${selectedRowIds.length} draft row${selectedRowIds.length === 1 ? "" : "s"}`;
        }

        setDraftRows((currentRows) => {
          return currentRows.filter((row) => !selectedIdSet.has(row.id));
        });
        setDirtyCells((currentDirtyCells) => {
          return Object.fromEntries(
            Object.entries(currentDirtyCells).filter(
              ([rowId]) => !selectedIdSet.has(rowId),
            ),
          );
        });

        if (refreshResult && persistedDeletes > 0) {
          await refreshResult();
        }

        setSaveMessage(deleteMessage);

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSaveMessage(`Error: ${message}`);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [buildTableChangePayload, isSaving, refreshResult],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s" ||
        !hasPendingChanges
      ) {
        return;
      }

      event.preventDefault();
      void saveChanges();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasPendingChanges, saveChanges]);

  return {
    draftRows,
    columnMetadataByName,
    dirtyCellCount,
    hasDirtyCells: hasPendingChanges,
    hasPendingChanges,
    canInsertRows,
    isSaving,
    saveMessage,
    isCellDirty,
    getRowDeleteTarget,
    addRow,
    updateDraftCell,
    deleteSelectedRows,
    saveChanges,
  };
};
