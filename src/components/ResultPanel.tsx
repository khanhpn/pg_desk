import { useCallback, useMemo } from "react";
import { useResultColumnSizing } from "@/hooks/useResultColumnSizing";
import { useResultEditing } from "@/hooks/useResultEditing";
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

export const ResultPanel = ({
  connectionId,
  queryResult,
  queryMessage,
  panelHeight,
}: ResultPanelProps): JSX.Element => {
  const hasRows = Boolean(queryResult?.rows.length);
  const hasColumns = Boolean(queryResult?.columns.length);
  const columns = useMemo(
    () => queryResult?.columns ?? [],
    [queryResult?.columns],
  );
  const {
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
  } = useResultEditing(queryResult, connectionId);
  const { getColumnWidth, handleColumnResizeStart, resultGridStyle } =
    useResultColumnSizing(columns, RESULT_GRID_FIXED_WIDTH);
  const {
    handleDeleteClick,
    selectRow,
    selectedDeleteTarget,
    selectedRowIndex,
    selectedRowLabel,
  } = useResultRowSelection({
    deleteRow,
    formatCellValue,
    getRowDeleteTarget,
    isDeletingDisabled: isSaving,
    queryResult,
  });
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
  const saveButtonLabel = useMemo(() => {
    if (isSaving) {
      return "Saving...";
    }

    return `Save${hasDirtyCells ? ` (${dirtyCellCount})` : ""}`;
  }, [dirtyCellCount, hasDirtyCells, isSaving]);
  const handleSaveClick = useCallback((): void => {
    void saveChanges();
  }, [saveChanges]);

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

          <button
            aria-label="Delete selected row"
            className="delete-row-button"
            type="button"
            disabled={!selectedDeleteTarget || isSaving}
            title={
              selectedDeleteTarget
                ? "Delete selected row"
                : "Select a deletable row"
            }
            onClick={handleDeleteClick}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              width="14"
              height="14"
            >
              <path
                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <button
            className="save-results-button"
            type="button"
            disabled={!hasDirtyCells || isSaving}
            onClick={handleSaveClick}
          >
            {saveButtonLabel}
          </button>
        </div>
      </div>

      <div className="grid-wrap">
        {!queryResult && (
          <div className="empty-result">No query executed yet.</div>
        )}

        {queryResult && !queryResult.ok && (
          <div className="query-error-message">{queryResult.message}</div>
        )}

        {queryResult?.ok && !hasRows && (
          <div className="empty-result">{queryMessage}</div>
        )}

        {queryResult?.ok && hasRows && hasColumns && (
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
              {draftRows.map((row, rowIndex) => (
                <tr
                  aria-selected={selectedRowIndex === rowIndex}
                  className={
                    selectedRowIndex === rowIndex ? "selected-row" : undefined
                  }
                  key={rowIndex}
                  onClick={() => {
                    selectRow(rowIndex);
                  }}
                >
                  <td className="row-selector-cell">
                    <button
                      aria-label={`Select row ${rowIndex + 1}`}
                      aria-pressed={selectedRowIndex === rowIndex}
                      className="row-selector-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectRow(rowIndex);
                      }}
                    >
                      <span className="row-selector-dot" />
                    </button>
                  </td>

                  <td>{rowIndex + 1}</td>

                  {columns.map((column) => {
                    const value = row[column];
                    const isNull = value === null || value === undefined;
                    const columnMetadata = columnMetadataByName.get(column);
                    const isBoolean =
                      columnMetadata?.dataTypeId === BOOLEAN_DATA_TYPE_ID ||
                      typeof value === "boolean";
                    const isEditable = Boolean(columnMetadata?.isEditable);
                    const isDirty = isCellDirty(rowIndex, column);

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
                            className="result-checkbox"
                            type="checkbox"
                            checked={Boolean(value)}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={(event) => {
                              updateDraftCell(
                                rowIndex,
                                column,
                                event.currentTarget.checked,
                              );
                            }}
                          />
                        ) : isEditable ? (
                          <input
                            className="result-cell-input"
                            value={formatEditableValue(value)}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={(event) => {
                              updateDraftCell(
                                rowIndex,
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
