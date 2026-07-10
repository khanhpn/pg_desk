import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueryRunResult } from "@electron/types/query";

type UseResultRowSelectionOptions = {
  rowIds: string[];
  queryResult: QueryRunResult | null;
};

export const useResultRowSelection = ({
  rowIds,
  queryResult,
}: UseResultRowSelectionOptions) => {
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const rowIdsKey = rowIds.join("\u001f");
  const validRowIds = useMemo(() => new Set(rowIds), [rowIds]);
  const selectedRowCount = selectedRowIds.length;
  const allRowsSelected =
    rowIds.length > 0 && selectedRowCount === rowIds.length;

  const toggleRow = useCallback(
    (rowId: string): void => {
      if (!validRowIds.has(rowId)) {
        return;
      }

      setSelectedRowIds((currentRowIds) => {
        return currentRowIds.includes(rowId)
          ? currentRowIds.filter((currentRowId) => currentRowId !== rowId)
          : [...currentRowIds, rowId];
      });
    },
    [validRowIds],
  );

  const toggleAllRows = useCallback((): void => {
    setSelectedRowIds(allRowsSelected ? [] : [...rowIds]);
  }, [allRowsSelected, rowIds]);

  const clearSelection = useCallback((): void => {
    setSelectedRowIds([]);
  }, []);

  useEffect(() => {
    setSelectedRowIds([]);
  }, [queryResult]);

  useEffect(() => {
    setSelectedRowIds((currentRowIds) => {
      const nextRowIds = currentRowIds.filter((rowId) =>
        validRowIds.has(rowId),
      );

      return nextRowIds.length === currentRowIds.length
        ? currentRowIds
        : nextRowIds;
    });
  }, [rowIdsKey, validRowIds]);

  return {
    selectedRowIds,
    selectedRowCount,
    allRowsSelected,
    toggleRow,
    toggleAllRows,
    clearSelection,
  };
};
