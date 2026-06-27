import "./App.css";

const App = (): JSX.Element => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="app-title">pgmini</div>
            <div className="app-subtitle">PostgreSQL Client</div>
          </div>

          <button className="icon-button" type="button">
            +
          </button>
        </div>

        <div className="connection-card">
          <div className="connection-status" />

          <div>
            <div className="connection-name">local / postgres</div>
            <div className="connection-meta">localhost:5432</div>
          </div>
        </div>

        <div className="tree">
          <div className="tree-section">EXPLORER</div>

          <div className="tree-item active database-node">
            <span className="tree-caret">▾</span>
            <span>app_development</span>
          </div>

          <div className="tree-indent">
            <div className="tree-item schema">
              <span className="tree-caret">▾</span>
              <span>public</span>
            </div>

            <div className="tree-indent">
              <div className="tree-label">tables</div>

              <div className="tree-item table">
                <span className="tree-dot" />
                <span>users</span>
              </div>

              <div className="tree-item table">
                <span className="tree-dot" />
                <span>posts</span>
              </div>

              <div className="tree-item table">
                <span className="tree-dot" />
                <span>orders</span>
              </div>

              <div className="tree-label">views</div>

              <div className="tree-item table">
                <span className="tree-dot view" />
                <span>active_users</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="tabs">
            <div className="tab active">Query 1</div>
            <div className="tab">users</div>

            <button className="new-tab" type="button">
              +
            </button>
          </div>

          <div className="connection-info">
            <span className="dot" />
            connected
          </div>
        </header>

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

        <section className="editor-panel">
          <div className="line-numbers">
            <div>1</div>
            <div>2</div>
            <div>3</div>
            <div>4</div>
            <div>5</div>
          </div>

          <pre className="fake-editor">
            <code>{`select *
from users
where created_at >= now() - interval '7 days'
order by created_at desc
limit 100;`}</code>
          </pre>
        </section>

        <section className="result-panel">
          <div className="result-tabs">
            <div className="result-tab active">Result</div>
            <div className="result-tab">Messages</div>
            <div className="result-tab">History</div>
          </div>

          <div className="grid-wrap">
            <table className="result-grid">
              <thead>
                <tr>
                  <th>#</th>
                  <th>id</th>
                  <th>name</th>
                  <th>email</th>
                  <th>created_at</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>1</td>
                  <td>1</td>
                  <td>Khanh</td>
                  <td>khanh@example.com</td>
                  <td>2026-06-27 09:30:12</td>
                </tr>

                <tr>
                  <td>2</td>
                  <td>2</td>
                  <td>Minh</td>
                  <td>
                    <span className="null-value">NULL</span>
                  </td>
                  <td>2026-06-27 10:12:01</td>
                </tr>

                <tr>
                  <td>3</td>
                  <td>3</td>
                  <td>Dev User</td>
                  <td>dev@example.com</td>
                  <td>2026-06-27 11:41:52</td>
                </tr>

                <tr>
                  <td>4</td>
                  <td>4</td>
                  <td>Test User</td>
                  <td>test@example.com</td>
                  <td>2026-06-27 12:06:44</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
