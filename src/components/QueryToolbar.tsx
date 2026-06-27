type QueryToolbarProps = {
  isRunningQuery: boolean;
  queryMessage: string;
  handleRunQuery: () => Promise<void>;
};

export const QueryToolbar = ({
  isRunningQuery,
  queryMessage,
  handleRunQuery,
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

      <button className="toolbar-button" type="button">
        Format
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
