export const ResultPanel = () => {
  return (
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
  );
};
