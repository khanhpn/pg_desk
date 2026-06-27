import type { QueryRunResult } from "@electron/types/query";

type ResultPanelProps = {
  queryResult: QueryRunResult | null;
  queryMessage: string;
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

export const ResultPanel = ({
  queryResult,
  queryMessage,
}: ResultPanelProps): JSX.Element => {
  const hasRows = Boolean(queryResult?.rows.length);
  const hasColumns = Boolean(queryResult?.columns.length);

  return (
    <section className="result-panel">
      <div className="result-tabs">
        <div className="result-tab active">Result</div>
        <div className="result-tab">Messages</div>
        <div className="result-tab">History</div>
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
              {queryResult.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>{rowIndex + 1}</td>

                  {queryResult.columns.map((column) => {
                    const value = row[column];
                    const isNull = value === null || value === undefined;

                    return (
                      <td key={column}>
                        <span className={isNull ? "null-value" : undefined}>
                          {formatCellValue(value)}
                        </span>
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
