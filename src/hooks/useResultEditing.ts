import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueryRunResult } from "@electron/types/query";

type DirtyCells = Record<string, unknown>;

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

export const useResultEditing = (queryResult: QueryRunResult | null) => {
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
    updateDraftCell,
    saveChanges,
  };
};
