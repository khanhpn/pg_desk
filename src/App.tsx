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
          <button className="icon-button">+</button>
        </div>

        <div className="connection-card">
          <div className="connection-status"></div>
          <div>
            <div className="connection-name">Local PostgreSQL</div>
            <div className="connection-meta">localhost:5432</div>
          </div>
        </div>

        <div className="tree">
          <div className="tree-section">DATABASE</div>

          <div className="tree-item active">▾ app_development</div>

          <div className="tree-indent">
            <div className="tree-item">▾ public</div>

            <div className="tree-indent">
              <div className="tree-label">tables</div>
              <div className="tree-item table">users</div>
              <div className="tree-item table">posts</div>
              <div className="tree-item table">orders</div>

              <div className="tree-label">views</div>
              <div className="tree-item table">active_users</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="tabs">
            <div className="tab active">Query 1</div>
            <div className="tab">users</div>
            <button className="new-tab">+</button>
          </div>

          <div className="connection-info">
            <span className="dot"></span>
            connected
          </div>
        </header>

        <section className="query-toolbar">
          <button className="run-button">▶ Run</button>
          <button className="toolbar-button">■ Stop</button>
          <button className="toolbar-button">Format</button>

          <div className="toolbar-separator"></div>

          <label className="limit-label">
            Limit
            <select>
              <option>100</option>
              <option>500</option>
              <option>1000</option>
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
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
