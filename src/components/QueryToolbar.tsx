type QueryToolbarProps = {
  isRunningQuery: boolean;
  isActiveTabDirty: boolean;
  queryMessage: string;
  handleRunQuery: () => Promise<void>;
  handleExplainQuery: () => Promise<void>;
  formatActiveTabSql: () => void;
  saveActiveTab: () => void;
};

export const QueryToolbar = ({
  isRunningQuery,
  isActiveTabDirty,
  queryMessage,
  handleRunQuery,
  handleExplainQuery,
  formatActiveTabSql,
  saveActiveTab,
}: QueryToolbarProps): JSX.Element => {
  return (
    <section className="query-toolbar">
      <button
        className="run-button"
        type="button"
        disabled={isRunningQuery}
        onClick={handleRunQuery}
      >
        {isRunningQuery ? "Running..." : "▶ Run"}
      </button>

      <button className="toolbar-button" type="button">
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

        <select defaultValue="100">
          <option value="100">100</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
      </label>

      <div className="query-meta">{queryMessage}</div>
    </section>
  );
};
