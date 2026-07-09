import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  QueryColumnMetadata,
  QueryRowDeletePayload,
  QueryRunResult,
} from "@electron/types/query";

type DirtyCells = Record<string, unknown>;

type RowDeleteTarget = {
  tableLabel: string;
  payload: QueryRowDeletePayload;
};

const buildCellKey = (rowIndex: number, column: string): string => {
  return `${rowIndex}:${column}`;
};

const parseCellKey = (
  cellKey: string,
): { rowIndex: number; column: string } => {
  const separatorIndex = cellKey.indexOf(":");

  return {
    rowIndex: Number(cellKey.slice(0, separatorIndex)),
    column: cellKey.slice(separatorIndex + 1),
  };
};

const hasDuplicateColumns = (columns: string[]): boolean => {
  return new Set(columns).size !== columns.length;
};

export const useResultEditing = (
  queryResult: QueryRunResult | null,
  connectionId: string | null,
) => {
  const [draftRows, setDraftRows] = useState<Record<string, unknown>[]>([]);
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const dirtyCellCount = useMemo(() => {
    return Object.keys(dirtyCells).length;
  }, [dirtyCells]);

  const hasDirtyCells = dirtyCellCount > 0;

  const columnMetadataByName = useMemo(() => {
    return new Map(
      queryResult?.columnMetadata.map((column) => [column.name, column]) ?? [],
    );
  }, [queryResult?.columnMetadata]);

  useEffect(() => {
    setDraftRows(queryResult?.rows.map((row) => ({ ...row })) ?? []);
    setDirtyCells({});
    setSaveMessage("");
  }, [queryResult]);

  const updateDraftCell = useCallback(
    (rowIndex: number, column: string, value: unknown): void => {
      setDraftRows((currentRows) => {
        return currentRows.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) {
            return row;
          }

          return {
            ...row,
            [column]: value,
          };
        });
      });

      setDirtyCells((currentDirtyCells) => ({
        ...currentDirtyCells,
        [buildCellKey(rowIndex, column)]: value,
      }));
      setSaveMessage("");
    },
    [],
  );

  const isCellDirty = useCallback(
    (rowIndex: number, column: string): boolean => {
      return buildCellKey(rowIndex, column) in dirtyCells;
    },
    [dirtyCells],
  );

  const buildPrimaryKeys = useCallback(
    (
      row: Record<string, unknown>,
      tableOid: number,
    ): Array<{ columnName: string; value: unknown }> => {
      return (
        queryResult?.columnMetadata
          .filter((column) => {
            return column.tableOid === tableOid && column.isPrimaryKey;
          })
          .map((column) => ({
            columnName: column.columnName ?? column.name,
            value: row[column.name],
          })) ?? []
      );
    },
    [queryResult?.columnMetadata],
  );

  const getRowDeleteTarget = useCallback(
    (rowIndex: number): RowDeleteTarget | null => {
      if (!queryResult || hasDuplicateColumns(queryResult.columns)) {
        return null;
      }

      const row = draftRows[rowIndex];

      if (!row) {
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
        return column.tableOid === tableOid;
      });
      const primaryKeyColumns = tableColumns.filter((column) => {
        return column.isPrimaryKey && Boolean(column.columnName);
      });
      const hasAllPrimaryKeys =
        primaryKeyColumns.length > 0 &&
        primaryKeyColumns.every((primaryKeyColumn) => {
          return primaryKeyColumn.name in row;
        });

      if (!hasAllPrimaryKeys) {
        return null;
      }

      const firstColumn = tableColumns.find((column) => {
        return Boolean(column.tableSchema && column.tableName);
      }) as QueryColumnMetadata | undefined;

      if (!firstColumn?.tableSchema || !firstColumn.tableName) {
        return null;
      }

      return {
        tableLabel: `${firstColumn.tableSchema}.${firstColumn.tableName}`,
        payload: {
          connectionId,
          tableOid,
          primaryKeys: primaryKeyColumns.map((column) => ({
            columnName: column.columnName ?? column.name,
            value: row[column.name],
          })),
        },
      };
    },
    [connectionId, draftRows, queryResult],
  );

  const deleteRow = useCallback(
    async (rowIndex: number): Promise<boolean> => {
      const target = getRowDeleteTarget(rowIndex);

      if (!target || isSaving) {
        setSaveMessage("Error: This row cannot be deleted safely");
        return false;
      }

      setIsSaving(true);
      setSaveMessage("Deleting row...");

      try {
        const result = await window.pgdesk.query.deleteRow(target.payload);

        if (!result.ok) {
          throw new Error(result.message);
        }

        setDraftRows((currentRows) => {
          return currentRows.filter((_, currentRowIndex) => {
            return currentRowIndex !== rowIndex;
          });
        });
        setDirtyCells({});
        setSaveMessage(result.message);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSaveMessage(`Error: ${message}`);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [getRowDeleteTarget, isSaving],
  );

  const saveChanges = useCallback(async (): Promise<void> => {
    if (!queryResult || !hasDirtyCells || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage("Saving changes...");

    try {
      for (const cellKey of Object.keys(dirtyCells)) {
        const { rowIndex, column } = parseCellKey(cellKey);
        const columnMetadata = columnMetadataByName.get(column);
        const row = draftRows[rowIndex];

        if (!row || !columnMetadata?.isEditable || !columnMetadata.columnName) {
          throw new Error("This cell cannot be saved");
        }

        const result = await window.pgdesk.query.updateCell({
          connectionId,
          tableOid: columnMetadata.tableOid,
          columnName: columnMetadata.columnName,
          primaryKeys: buildPrimaryKeys(row, columnMetadata.tableOid),
          value: row[column],
        });

        if (!result.ok) {
          throw new Error(result.message);
        }
      }

      setDirtyCells({});
      setSaveMessage(
        `Saved ${dirtyCellCount} change${dirtyCellCount === 1 ? "" : "s"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(`Error: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    buildPrimaryKeys,
    columnMetadataByName,
    dirtyCellCount,
    dirtyCells,
    draftRows,
    hasDirtyCells,
    isSaving,
    connectionId,
    queryResult,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }

      if (!hasDirtyCells) {
        return;
      }

      event.preventDefault();
      void saveChanges();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasDirtyCells, saveChanges]);

  return {
    draftRows,
    columnMetadataByName,
    dirtyCellCount,
    hasDirtyCells,
    isSaving,
    saveMessage,
    isCellDirty,
    getRowDeleteTarget,
    updateDraftCell,
    deleteRow,
    saveChanges,
  };
};
