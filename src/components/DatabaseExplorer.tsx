export const DatabaseExplorer = () => {
  return (
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
  );
};
