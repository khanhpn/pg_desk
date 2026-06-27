import type { PgSchemaInfo } from "@/types/metadata";

type DatabaseExplorerProps = {
  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
};

export const DatabaseExplorer = ({
  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
}: DatabaseExplorerProps): JSX.Element => {
  return (
    <div className="tree">
      <div className="tree-section-row">
        <div className="tree-section">EXPLORER</div>

        <button
          className="tree-refresh-button"
          type="button"
          disabled={isLoadingExplorer}
          onClick={() => {
            void refreshExplorer();
          }}
        >
          {isLoadingExplorer ? "…" : "↻"}
        </button>
      </div>

      <div className="tree-message">{explorerMessage}</div>

      {schemas.map((schema) => (
        <div key={schema.name}>
          <div className="tree-item schema">
            <span className="tree-caret">▾</span>
            <span>{schema.name}</span>
          </div>

          <div className="tree-indent">
            <div className="tree-label">tables</div>

            {schema.tables.length === 0 && (
              <div className="tree-empty">No tables</div>
            )}

            {schema.tables.map((table) => (
              <div
                className="tree-item table"
                key={`${table.schema}.${table.name}`}
              >
                <span className="tree-dot" />
                <span>{table.name}</span>
              </div>
            ))}

            <div className="tree-label">views</div>

            {schema.views.length === 0 && (
              <div className="tree-empty">No views</div>
            )}

            {schema.views.map((view) => (
              <div
                className="tree-item table"
                key={`${view.schema}.${view.name}`}
              >
                <span className="tree-dot view" />
                <span>{view.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
