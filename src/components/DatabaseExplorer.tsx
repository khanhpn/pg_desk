import type { PgRelationInfo, PgSchemaInfo } from "@/types/metadata";

type DatabaseExplorerProps = {
  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
  selectedRelationKey: string | null;
  handleOpenRelation: (relation: PgRelationInfo) => Promise<void>;
};

const buildRelationKey = (relation: PgRelationInfo): string => {
  return `${relation.schema}.${relation.name}`;
};

export const DatabaseExplorer = ({
  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
  selectedRelationKey,
  handleOpenRelation,
}: DatabaseExplorerProps) => {
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

            {schema.tables.map((table) => {
              const relationKey = buildRelationKey(table);
              const isSelected = selectedRelationKey === relationKey;

              return (
                <button
                  className={
                    isSelected
                      ? "tree-item table tree-button selected"
                      : "tree-item table tree-button"
                  }
                  type="button"
                  key={relationKey}
                  onClick={() => {
                    void handleOpenRelation(table);
                  }}
                >
                  <span className="tree-dot" />
                  <span>{table.name}</span>
                </button>
              );
            })}

            <div className="tree-label">views</div>

            {schema.views.length === 0 && (
              <div className="tree-empty">No views</div>
            )}

            {schema.views.map((view) => {
              const relationKey = buildRelationKey(view);
              const isSelected = selectedRelationKey === relationKey;

              return (
                <button
                  className={
                    isSelected
                      ? "tree-item table tree-button selected"
                      : "tree-item table tree-button"
                  }
                  type="button"
                  key={relationKey}
                  onClick={() => {
                    void handleOpenRelation(view);
                  }}
                >
                  <span className="tree-dot view" />
                  <span>{view.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
