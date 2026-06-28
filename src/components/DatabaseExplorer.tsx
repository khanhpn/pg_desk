import { useState } from "react";
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

const buildGroupKey = (schemaName: string, group: "tables" | "views") => {
  return `${schemaName}.${group}`;
};

export const DatabaseExplorer = ({
  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
  selectedRelationKey,
  handleOpenRelation,
}: DatabaseExplorerProps) => {
  const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleSchema = (schemaName: string) => {
    setCollapsedSchemas((current) => {
      const next = new Set(current);

      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }

      return next;
    });
  };

  const toggleGroup = (schemaName: string, group: "tables" | "views") => {
    const groupKey = buildGroupKey(schemaName, group);

    setCollapsedGroups((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  };

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

      {schemas.map((schema) => {
        const isSchemaExpanded = !collapsedSchemas.has(schema.name);
        const areTablesExpanded = !collapsedGroups.has(
          buildGroupKey(schema.name, "tables"),
        );
        const areViewsExpanded = !collapsedGroups.has(
          buildGroupKey(schema.name, "views"),
        );

        return (
          <div className="tree-schema" key={schema.name}>
            <button
              className="tree-item schema tree-button tree-toggle"
              type="button"
              aria-expanded={isSchemaExpanded}
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

            {isSchemaExpanded && (
              <div className="tree-indent">
                <button
                  className="tree-label tree-label-button"
                  type="button"
                  aria-expanded={areTablesExpanded}
                  onClick={() => {
                    toggleGroup(schema.name, "tables");
                  }}
                >
                  <span className="tree-caret" />
                  <span className="tree-folder-icon" />
                  <span>tables</span>
                  <span className="tree-count">{schema.tables.length}</span>
                </button>

                {areTablesExpanded && (
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
                  aria-expanded={areViewsExpanded}
                  onClick={() => {
                    toggleGroup(schema.name, "views");
                  }}
                >
                  <span className="tree-caret" />
                  <span className="tree-folder-icon" />
                  <span>views</span>
                  <span className="tree-count">{schema.views.length}</span>
                </button>

                {areViewsExpanded && (
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
