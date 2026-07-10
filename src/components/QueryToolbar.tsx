import { isQueryLimit, type QueryLimit } from "@/utils/queryLimit";

type QueryToolbarProps = {
  isRunningQuery: boolean;
  isActiveTabDirty: boolean;
  hasSqlSelection?: boolean;
  selectLimit: QueryLimit;
  queryMessage: string;
  handleRunQuery: () => Promise<void>;
  handleStopQuery: () => Promise<void>;
  handleExplainQuery: () => Promise<void>;
  formatActiveTabSql: () => void;
  saveActiveTab: () => void;
  setSelectLimit: (limit: QueryLimit) => void;
};

export const QueryToolbar = ({
  isRunningQuery,
  isActiveTabDirty,
  hasSqlSelection = false,
  selectLimit,
  queryMessage,
  handleRunQuery,
  handleStopQuery,
  handleExplainQuery,
  formatActiveTabSql,
  saveActiveTab,
  setSelectLimit,
}: QueryToolbarProps): JSX.Element => {
  return (
    <section className="query-toolbar">
      <button
        className="run-button"
        type="button"
        disabled={isRunningQuery}
        title={hasSqlSelection ? "Run selected SQL" : "Run all SQL"}
        onClick={handleRunQuery}
      >
        {isRunningQuery
          ? "Running..."
          : hasSqlSelection
            ? "Run Selection"
            : "▶ Run"}
      </button>

      <button
        className="toolbar-button stop-button"
        disabled={!isRunningQuery}
        onClick={handleStopQuery}
        type="button"
      >
        ■ Stop
      </button>

      <button
        className="toolbar-button"
        onClick={formatActiveTabSql}
        type="button"
      >
        Format
      </button>

      <button
        className="toolbar-button toolbar-button-with-icon"
        disabled={isRunningQuery}
        onClick={handleExplainQuery}
        title="Explain query plan and estimated cost"
        type="button"
      >
        <span aria-hidden="true" className="toolbar-button-icon">
          ◇
        </span>
        Explain
      </button>

      <button
        className="toolbar-button"
        disabled={!isActiveTabDirty}
        onClick={saveActiveTab}
        type="button"
      >
        Save Tab
      </button>

      <div className="toolbar-separator" />

      <label className="limit-label">
        <span>Limit</span>

        <select
          value={selectLimit}
          onChange={(event) => {
            const nextLimit = Number(event.target.value);

            if (isQueryLimit(nextLimit)) {
              setSelectLimit(nextLimit);
            }
          }}
        >
          <option value="100">100</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
      </label>

      <div className="query-meta">{queryMessage}</div>
    </section>
  );
};
