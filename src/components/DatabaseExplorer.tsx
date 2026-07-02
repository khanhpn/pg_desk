import { useCallback, useMemo, useState } from "react";
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

const relationMatchesFilter = (
  schemaName: string,
  relation: PgRelationInfo,
  filter: string,
): boolean => {
  if (!filter) {
    return true;
  }

  const normalizedSchema = schemaName.toLowerCase();
  const normalizedName = relation.name.toLowerCase();
  const qualifiedName = `${normalizedSchema}.${normalizedName}`;

  return (
    normalizedSchema.includes(filter) ||
    normalizedName.includes(filter) ||
    qualifiedName.includes(filter)
  );
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
  const [filterText, setFilterText] = useState("");
  const { isSchemaExpanded, isGroupExpanded, toggleSchema, toggleGroup } =
    useDatabaseTreeState();
  const handleRefreshExplorer = useCallback((): void => {
    void refreshExplorer();
  }, [refreshExplorer]);
  const normalizedFilter = filterText.trim().toLowerCase();
  const totalRelationCount = useMemo(() => {
    return schemas.reduce((total, schema) => {
      return total + schema.tables.length + schema.views.length;
    }, 0);
  }, [schemas]);
  const filteredSchemas = useMemo(() => {
    if (!normalizedFilter) {
      return schemas;
    }

    return schemas
      .map((schema) => {
        const tables = schema.tables.filter((table) => {
          return relationMatchesFilter(schema.name, table, normalizedFilter);
        });
        const views = schema.views.filter((view) => {
          return relationMatchesFilter(schema.name, view, normalizedFilter);
        });

        return {
          ...schema,
          tables,
          views,
        };
      })
      .filter((schema) => {
        return schema.tables.length > 0 || schema.views.length > 0;
      });
  }, [normalizedFilter, schemas]);
  const filteredRelationCount = useMemo(() => {
    return filteredSchemas.reduce((total, schema) => {
      return total + schema.tables.length + schema.views.length;
    }, 0);
  }, [filteredSchemas]);
  const isFiltering = normalizedFilter.length > 0;

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

      <div className="tree-filter">
        <span className="tree-filter-icon">⌕</span>
        <input
          className="tree-filter-input"
          type="search"
          aria-label="Filter tables and views"
          placeholder="Filter tables or views"
          value={filterText}
          onChange={(event) => {
            setFilterText(event.target.value);
          }}
        />
      </div>

      <div className="tree-filter-meta">
        {isFiltering
          ? `${filteredRelationCount}/${totalRelationCount} matches`
          : `${totalRelationCount} relations`}
      </div>

      {isFiltering && filteredSchemas.length === 0 && (
        <div className="tree-filter-empty">
          No tables or views match this filter.
        </div>
      )}

      {filteredSchemas.map((schema) => {
        const schemaExpanded = isFiltering || isSchemaExpanded(schema.name);
        const tablesExpanded =
          isFiltering || isGroupExpanded(schema.name, "tables");
        const viewsExpanded =
          isFiltering || isGroupExpanded(schema.name, "views");

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
