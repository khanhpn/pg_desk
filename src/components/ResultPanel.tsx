import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueryRunResult } from "@electron/types/query";
import type { CSSProperties } from "react";

const BOOLEAN_DATA_TYPE_ID = 16;

type ResultPanelProps = {
  queryResult: QueryRunResult | null;
  queryMessage: string;
  panelHeight: number;
};

type DirtyCells = Record<string, unknown>;

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

export const ResultPanel = ({
  queryResult,
  queryMessage,
  panelHeight,
}: ResultPanelProps): JSX.Element => {
  const hasRows = Boolean(queryResult?.rows.length);
  const hasColumns = Boolean(queryResult?.columns.length);
  const [draftRows, setDraftRows] = useState<Record<string, unknown>[]>([]);
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const resultPanelStyle = {
    "--result-panel-height": `${panelHeight}px`,
  } as CSSProperties;
  const dirtyCellCount = Object.keys(dirtyCells).length;
  const hasDirtyCells = dirtyCellCount > 0;

  const columnMetadataByName = useMemo(() => {
    const metadata = new Map(
      queryResult?.columnMetadata.map((column) => [column.name, column]) ?? [],
    );

    return metadata;
  }, [queryResult]);

  useEffect(() => {
    setDraftRows(queryResult?.rows.map((row) => ({ ...row })) ?? []);
    setDirtyCells({});
    setSaveMessage("");
  }, [queryResult]);

  const updateDraftCell = (
    rowIndex: number,
    column: string,
    value: unknown,
  ): void => {
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
  };

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

  return (
    <section className="result-panel" style={resultPanelStyle}>
      <div className="result-tabs">
        <div className="result-tab active">Result</div>
        <div className="result-tab">Messages</div>
        <div className="result-tab">History</div>

        <div className="result-actions">
          <span
            className={
              saveMessage.startsWith("Error")
                ? "save-message error"
                : "save-message"
            }
          >
            {saveMessage || queryResult?.editMessage}
          </span>

          <button
            className="save-results-button"
            type="button"
            disabled={!hasDirtyCells || isSaving}
            onClick={() => {
              void saveChanges();
            }}
          >
            {isSaving
              ? "Saving..."
              : `Save${hasDirtyCells ? ` (${dirtyCellCount})` : ""}`}
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
                    const cellKey = buildCellKey(rowIndex, column);
                    const isDirty = cellKey in dirtyCells;

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
