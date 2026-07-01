import { useCallback, useMemo, useState } from "react";
import { useResultEditing } from "@/hooks/useResultEditing";
import type { QueryRunResult } from "@electron/types/query";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

const BOOLEAN_DATA_TYPE_ID = 16;
const ROW_NUMBER_COLUMN_WIDTH = 42;
const COLUMN_MIN_WIDTH = 72;
const COLUMN_MAX_WIDTH = 720;
const COLUMN_DEFAULT_WIDTH = 150;

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

const clampColumnWidth = (width: number): number => {
  return Math.min(Math.max(width, COLUMN_MIN_WIDTH), COLUMN_MAX_WIDTH);
};

const getDefaultColumnWidth = (column: string): number => {
  return clampColumnWidth(
    Math.max(COLUMN_DEFAULT_WIDTH, column.length * 9 + 32),
  );
};

export const ResultPanel = ({
  connectionId,
  queryResult,
  queryMessage,
  panelHeight,
}: ResultPanelProps): JSX.Element => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const hasRows = Boolean(queryResult?.rows.length);
  const hasColumns = Boolean(queryResult?.columns.length);
  const {
    draftRows,
    columnMetadataByName,
    dirtyCellCount,
    hasDirtyCells,
    isSaving,
    saveMessage,
    isCellDirty,
    updateDraftCell,
    saveChanges,
  } = useResultEditing(queryResult, connectionId);
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
  const getColumnWidth = useCallback(
    (column: string): number => {
      return columnWidths[column] ?? getDefaultColumnWidth(column);
    },
    [columnWidths],
  );
  const resultGridStyle = useMemo(() => {
    const gridWidth =
      ROW_NUMBER_COLUMN_WIDTH +
      (queryResult?.columns ?? []).reduce((totalWidth, column) => {
        return totalWidth + getColumnWidth(column);
      }, 0);

    return {
      width: `${gridWidth}px`,
    } as CSSProperties;
  }, [getColumnWidth, queryResult?.columns]);
  const handleColumnResizeStart = useCallback(
    (column: string, event: ReactPointerEvent<HTMLSpanElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = getColumnWidth(column);

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const nextWidth = clampColumnWidth(
          startWidth + moveEvent.clientX - startX,
        );

        setColumnWidths((currentWidths) => ({
          ...currentWidths,
          [column]: nextWidth,
        }));
      };

      const handlePointerUp = (): void => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [getColumnWidth],
  );

  return (
    <section className="result-panel" style={resultPanelStyle}>
      <div className="result-tabs">
        <div className="result-tab active">Result</div>

        <div className="result-actions">
          <span className={saveMessageClassName}>
            {saveMessage || queryResult?.editMessage}
          </span>

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
              <col style={{ width: ROW_NUMBER_COLUMN_WIDTH }} />

              {queryResult.columns.map((column) => (
                <col key={column} style={{ width: getColumnWidth(column) }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th>#</th>

                {queryResult.columns.map((column) => (
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
                <tr key={rowIndex}>
                  <td>{rowIndex + 1}</td>

                  {queryResult.columns.map((column) => {
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
