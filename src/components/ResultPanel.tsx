import { useCallback, useEffect, useMemo, useRef } from "react";
import { useResultColumnSizing } from "@/hooks/useResultColumnSizing";
import {
  useResultEditing,
  type EditableResultRow,
} from "@/hooks/useResultEditing";
import { useResultRowSelection } from "@/hooks/useResultRowSelection";
import type { QueryRunResult } from "@electron/types/query";
import type { CSSProperties } from "react";

const BOOLEAN_DATA_TYPE_ID = 16;
const ROW_SELECTOR_COLUMN_WIDTH = 36;
const ROW_NUMBER_COLUMN_WIDTH = 42;
const RESULT_GRID_FIXED_WIDTH =
  ROW_SELECTOR_COLUMN_WIDTH + ROW_NUMBER_COLUMN_WIDTH;

type ResultPanelProps = {
  connectionId: string | null;
  queryResult: QueryRunResult | null;
  queryMessage: string;
  panelHeight: number;
  refreshResult?: () => Promise<void>;
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const formatEditableValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return formatCellValue(value);
};

const AddIcon = (): JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" fill="currentColor" />
  </svg>
);

const SaveIcon = (): JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <path
      d="M5 3h11.2L20 6.8V21H5V3Zm2 2v5h9V5H7Zm0 9v5h10v-5H7Zm2-7h5V6H9v1Z"
      fill="currentColor"
    />
  </svg>
);

const DeleteIcon = (): JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <path
      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"
      fill="currentColor"
    />
  </svg>
);

export const ResultPanel = ({
  connectionId,
  queryResult,
  queryMessage,
  panelHeight,
  refreshResult,
}: ResultPanelProps): JSX.Element => {
  const columns = useMemo(
    () => queryResult?.columns ?? [],
    [queryResult?.columns],
  );
  const {
    draftRows,
    columnMetadataByName,
    dirtyCellCount,
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
  } = useResultEditing(queryResult, connectionId, refreshResult);
  const rowIds = useMemo(() => draftRows.map((row) => row.id), [draftRows]);
  const {
    selectedRowIds,
    selectedRowCount,
    allRowsSelected,
    toggleRow,
    toggleAllRows,
    clearSelection,
  } = useResultRowSelection({
    rowIds,
    queryResult,
  });
  const { getColumnWidth, handleColumnResizeStart, resultGridStyle } =
    useResultColumnSizing(columns, RESULT_GRID_FIXED_WIDTH);
  const resultPanelStyle = useMemo(
    () =>
      ({
        "--result-panel-height": `${panelHeight}px`,
      }) as CSSProperties,
    [panelHeight],
  );
  const saveMessageClassName = useMemo(() => {
    return saveMessage.startsWith("Error")
      ? "save-message error"
      : "save-message";
  }, [saveMessage]);
  const saveButtonLabel = isSaving
    ? "Working..."
    : hasPendingChanges
      ? `Save changes (${dirtyCellCount})`
      : "Save changes";
  const selectedRows = useMemo(() => {
    const selectedIdSet = new Set(selectedRowIds);

    return draftRows.filter((row) => selectedIdSet.has(row.id));
  }, [draftRows, selectedRowIds]);
  const canDeleteSelectedRows = useMemo(() => {
    return (
      selectedRows.length > 0 &&
      selectedRows.every((row) => {
        return row.isNew || Boolean(getRowDeleteTarget(row.id));
      })
    );
  }, [getRowDeleteTarget, selectedRows]);
  const selectedTableLabel = useMemo(() => {
    return (
      selectedRows
        .map((row) => getRowDeleteTarget(row.id)?.tableLabel)
        .find(Boolean) ?? "this result"
    );
  }, [getRowDeleteTarget, selectedRows]);
  const selectedRowLabel = selectedRowCount
    ? `${selectedRowCount} row${selectedRowCount === 1 ? "" : "s"} selected`
    : "";
  const selectAllRef = useRef<HTMLInputElement>(null);
  const hasPartialSelection = selectedRowCount > 0 && !allRowsSelected;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartialSelection;
    }
  }, [hasPartialSelection]);
  const handleSaveClick = useCallback((): void => {
    void saveChanges();
  }, [saveChanges]);
  const handleAddClick = useCallback((): void => {
    addRow();
  }, [addRow]);
  const handleDeleteClick = useCallback((): void => {
    if (!canDeleteSelectedRows || isSaving) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedRowCount} selected row${selectedRowCount === 1 ? "" : "s"} from ${selectedTableLabel}?\n\nThis cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    void deleteSelectedRows(selectedRowIds).then((deleted) => {
      if (deleted) {
        clearSelection();
      }
    });
  }, [
    canDeleteSelectedRows,
    clearSelection,
    deleteSelectedRows,
    isSaving,
    selectedRowCount,
    selectedRowIds,
    selectedTableLabel,
  ]);
  const hasRows = Boolean(draftRows.length);
  const hasColumns = Boolean(columns.length);

  return (
    <section className="result-panel" style={resultPanelStyle}>
      <div className="result-tabs">
        <div className="result-tab-group">
          <div className="result-tab active">Result</div>

          {selectedRowLabel && (
            <span className="result-selection-badge">{selectedRowLabel}</span>
          )}
        </div>

        <div className="result-actions">
          <span className={saveMessageClassName}>
            {saveMessage || queryResult?.editMessage}
          </span>

          <div
            className="result-action-cluster"
            role="toolbar"
            aria-label="Result table actions"
          >
            <label className="select-all-control" title="Select all rows">
              <input
                aria-checked={hasPartialSelection ? "mixed" : allRowsSelected}
                aria-label="Select all rows"
                checked={allRowsSelected}
                disabled={!hasRows || isSaving}
                ref={selectAllRef}
                type="checkbox"
                onChange={toggleAllRows}
              />
            </label>

            <button
              aria-label="Add row"
              className="result-action-button add-row-button"
              disabled={!canInsertRows || isSaving}
              title="Add row"
              type="button"
              onClick={handleAddClick}
            >
              <AddIcon />
            </button>

            <button
              aria-label="Save changes"
              className="result-action-button save-results-button"
              disabled={!hasPendingChanges || isSaving}
              title={saveButtonLabel}
              type="button"
              onClick={handleSaveClick}
            >
              <SaveIcon />
            </button>

            <button
              aria-label="Delete selected rows"
              className="result-action-button delete-row-button"
              disabled={!canDeleteSelectedRows || isSaving}
              title={
                canDeleteSelectedRows
                  ? "Delete selected rows"
                  : "Select rows that can be safely deleted"
              }
              type="button"
              onClick={handleDeleteClick}
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="grid-wrap">
        {!queryResult && (
          <div className="empty-result">No query executed yet.</div>
        )}

        {queryResult && !queryResult.ok && (
          <div className="query-error-message">{queryResult.message}</div>
        )}

        {queryResult?.ok && !hasRows && !canInsertRows && (
          <div className="empty-result">{queryMessage}</div>
        )}

        {queryResult?.ok && hasColumns && (hasRows || canInsertRows) && (
          <table className="result-grid" style={resultGridStyle}>
            <colgroup>
              <col style={{ width: ROW_SELECTOR_COLUMN_WIDTH }} />
              <col style={{ width: ROW_NUMBER_COLUMN_WIDTH }} />

              {columns.map((column) => (
                <col key={column} style={{ width: getColumnWidth(column) }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th
                  aria-label="Row selection"
                  className="row-selector-header"
                />
                <th>#</th>

                {columns.map((column) => (
                  <th key={column}>
                    <span className="result-column-label">{column}</span>
                    <span
                      className="result-column-resize-handle"
                      role="separator"
                      aria-label={`Resize ${column} column`}
                      aria-orientation="vertical"
                      onPointerDown={(event) => {
                        handleColumnResizeStart(column, event);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {draftRows.map((row: EditableResultRow, rowIndex) => (
                <tr
                  aria-selected={selectedRowIds.includes(row.id)}
                  className={[
                    selectedRowIds.includes(row.id) ? "selected-row" : "",
                    row.isNew ? "new-row" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={row.id}
                >
                  <td className="row-selector-cell">
                    <input
                      aria-label={`Select row ${rowIndex + 1}`}
                      checked={selectedRowIds.includes(row.id)}
                      className="row-selector-checkbox"
                      type="checkbox"
                      onChange={() => {
                        toggleRow(row.id);
                      }}
                    />
                  </td>

                  <td>{rowIndex + 1}</td>

                  {columns.map((column) => {
                    const value = row.values[column];
                    const isNull = value === null || value === undefined;
                    const columnMetadata = columnMetadataByName.get(column);
                    const isBoolean =
                      columnMetadata?.dataTypeId === BOOLEAN_DATA_TYPE_ID ||
                      typeof value === "boolean";
                    const isEditable = Boolean(columnMetadata?.isEditable);
                    const isDirty = isCellDirty(row.id, column);

                    return (
                      <td
                        className={[
                          isEditable ? "editable-cell" : "readonly-cell",
                          isDirty ? "dirty-cell" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={column}
                      >
                        {isEditable && isBoolean ? (
                          <input
                            aria-label={`${column} row ${rowIndex + 1}`}
                            checked={Boolean(value)}
                            className="result-checkbox"
                            type="checkbox"
                            onChange={(event) => {
                              updateDraftCell(
                                row.id,
                                column,
                                event.currentTarget.checked,
                              );
                            }}
                          />
                        ) : isEditable ? (
                          <input
                            aria-label={`${column} row ${rowIndex + 1}`}
                            className="result-cell-input"
                            value={formatEditableValue(value)}
                            onChange={(event) => {
                              updateDraftCell(
                                row.id,
                                column,
                                event.currentTarget.value,
                              );
                            }}
                          />
                        ) : (
                          <span className={isNull ? "null-value" : undefined}>
                            {formatCellValue(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
