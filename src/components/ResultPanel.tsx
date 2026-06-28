import { useCallback, useMemo } from "react";
import { useResultEditing } from "@/hooks/useResultEditing";
import type { QueryRunResult } from "@electron/types/query";
import type { CSSProperties } from "react";

const BOOLEAN_DATA_TYPE_ID = 16;

type ResultPanelProps = {
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
  queryResult,
  queryMessage,
  panelHeight,
}: ResultPanelProps): JSX.Element => {
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
  } = useResultEditing(queryResult);
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
        <div className="result-tab active">Result</div>
        <div className="result-tab">Messages</div>
        <div className="result-tab">History</div>

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
          <table className="result-grid">
            <thead>
              <tr>
                <th>#</th>

                {queryResult.columns.map((column) => (
                  <th key={column}>{column}</th>
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
