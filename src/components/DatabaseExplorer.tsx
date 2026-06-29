import { useCallback } from "react";
import { useDatabaseTreeState } from "@/hooks/useDatabaseTreeState";
import type { PgRelationInfo, PgSchemaInfo } from "@/types/metadata";

type DatabaseExplorerProps = {
  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
  selectedRelationKey: string | null;
  handleOpenRelation: (relation: PgRelationInfo) => Promise<void>;
  openTableContextMenu: (
    relation: PgRelationInfo,
    x: number,
    y: number,
  ) => void;
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
  openTableContextMenu,
}: DatabaseExplorerProps) => {
  const { isSchemaExpanded, isGroupExpanded, toggleSchema, toggleGroup } =
    useDatabaseTreeState();
  const handleRefreshExplorer = useCallback((): void => {
    void refreshExplorer();
  }, [refreshExplorer]);

  return (
    <div className="tree">
      <div className="tree-section-row">
        <div className="tree-section">EXPLORER</div>

        <button
          className="tree-refresh-button"
          type="button"
          disabled={isLoadingExplorer}
          onClick={handleRefreshExplorer}
        >
          {isLoadingExplorer ? "…" : "↻"}
        </button>
      </div>

      <div className="tree-message">{explorerMessage}</div>

      {schemas.map((schema) => {
        const schemaExpanded = isSchemaExpanded(schema.name);
        const tablesExpanded = isGroupExpanded(schema.name, "tables");
        const viewsExpanded = isGroupExpanded(schema.name, "views");

        return (
          <div className="tree-schema" key={schema.name}>
            <button
              className="tree-item schema tree-button tree-toggle"
              type="button"
              aria-expanded={schemaExpanded}
              onClick={() => {
                toggleSchema(schema.name);
              }}
            >
              <span className="tree-caret" />
              <span className="tree-folder-icon" />
              <span className="tree-node-name">{schema.name}</span>
              <span className="tree-count">
                {schema.tables.length + schema.views.length}
              </span>
            </button>

            {schemaExpanded && (
              <div className="tree-indent">
                <button
                  className="tree-label tree-label-button"
                  type="button"
                  aria-expanded={tablesExpanded}
                  onClick={() => {
                    toggleGroup(schema.name, "tables");
                  }}
                >
                  <span className="tree-caret" />
                  <span className="tree-folder-icon" />
                  <span>tables</span>
                  <span className="tree-count">{schema.tables.length}</span>
                </button>

                {tablesExpanded && (
                  <div className="tree-group">
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
                          onContextMenu={(event) => {
                            event.preventDefault();
                            openTableContextMenu(
                              table,
                              event.clientX,
                              event.clientY,
                            );
                          }}
                        >
                          <span className="tree-dot" />
                          <span className="tree-node-name">{table.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  className="tree-label tree-label-button"
                  type="button"
                  aria-expanded={viewsExpanded}
                  onClick={() => {
                    toggleGroup(schema.name, "views");
                  }}
                >
                  <span className="tree-caret" />
                  <span className="tree-folder-icon" />
                  <span>views</span>
                  <span className="tree-count">{schema.views.length}</span>
                </button>

                {viewsExpanded && (
                  <div className="tree-group">
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
                          <span className="tree-node-name">{view.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
