export const QueryToolbar = () => {
  return (
    <section className="query-toolbar">
      <button className="run-button" type="button">
        ▶ Run
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

      <div className="query-meta">42ms · 128 rows</div>
    </section>
  );
};
