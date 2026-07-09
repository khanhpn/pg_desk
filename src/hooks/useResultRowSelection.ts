import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueryRunResult } from "@electron/types/query";

type RowDeleteTarget = {
  tableLabel: string;
  payload: {
    primaryKeys: Array<{
      columnName: string;
      value: unknown;
    }>;
  };
};

type UseResultRowSelectionOptions = {
  deleteRow: (rowIndex: number) => Promise<boolean>;
  formatCellValue: (value: unknown) => string;
  getRowDeleteTarget: (rowIndex: number) => RowDeleteTarget | null;
  isDeletingDisabled: boolean;
  queryResult: QueryRunResult | null;
};

export const useResultRowSelection = ({
  deleteRow,
  formatCellValue,
  getRowDeleteTarget,
  isDeletingDisabled,
  queryResult,
}: UseResultRowSelectionOptions) => {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const selectedDeleteTarget = useMemo(() => {
    if (selectedRowIndex === null) {
      return null;
    }

    return getRowDeleteTarget(selectedRowIndex);
  }, [getRowDeleteTarget, selectedRowIndex]);

  const selectedRowLabel = selectedRowIndex === null ? "" : "1 row selected";

  const selectRow = useCallback((rowIndex: number): void => {
    setSelectedRowIndex(rowIndex);
  }, []);

  const handleDeleteClick = useCallback((): void => {
    if (
      selectedRowIndex === null ||
      !selectedDeleteTarget ||
      isDeletingDisabled
    ) {
      return;
    }

    const primaryKeySummary = selectedDeleteTarget.payload.primaryKeys
      .map((key) => {
        return `${key.columnName} = ${formatCellValue(key.value)}`;
      })
      .join("\n");
    const confirmed = window.confirm(
      `Delete this row from ${selectedDeleteTarget.tableLabel}?\n\n${primaryKeySummary}\n\nThis cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    void deleteRow(selectedRowIndex).then((deleted) => {
      if (deleted) {
        setSelectedRowIndex(null);
      }
    });
  }, [
    deleteRow,
    formatCellValue,
    isDeletingDisabled,
    selectedDeleteTarget,
    selectedRowIndex,
  ]);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [queryResult]);

  return {
    handleDeleteClick,
    selectRow,
    selectedDeleteTarget,
    selectedRowIndex,
    selectedRowLabel,
  };
};
