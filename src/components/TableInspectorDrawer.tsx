import { useMemo, useState } from "react";
import type {
  PgRelationInfo,
  PgTableChangePayload,
  PgTableDetail,
} from "@/types/metadata";

type TableInspectorDrawerProps = {
  connectionId: string | null;
  relation: PgRelationInfo | null;
  tableDetail: PgTableDetail | null;
  isLoading: boolean;
  message: string;
  closeDrawer: () => void;
  refreshTableInspector: () => Promise<void>;
};

type InspectorTab = "columns" | "foreignKeys" | "indexes" | "edit";

const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "columns", label: "Columns" },
  { id: "foreignKeys", label: "Foreign keys" },
  { id: "indexes", label: "Indexes" },
  { id: "edit", label: "Edit schema" },
];
const supportedDataTypes = [
  "text",
  "varchar(255)",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "date",
  "timestamp without time zone",
  "timestamp with time zone",
  "uuid",
  "jsonb",
];
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const formatDataType = (
  dataType: string,
  characterMaximumLength: number | null,
  numericPrecision: number | null,
  numericScale: number | null,
): string => {
  if (characterMaximumLength) {
    return `${dataType}(${characterMaximumLength})`;
  }

  if (numericPrecision && numericScale !== null) {
    return `${dataType}(${numericPrecision}, ${numericScale})`;
  }

  return dataType;
};

const quoteIdentifier = (identifier: string): string => `"${identifier}"`;

const buildPreviewSql = (payload: PgTableChangePayload | null): string => {
  if (!payload) {
    return "";
  }

  const tableName = `${quoteIdentifier(payload.schema)}.${quoteIdentifier(
    payload.table,
  )}`;

  if (payload.action === "add-column") {
    return `alter table ${tableName} add column ${quoteIdentifier(
      payload.columnName,
    )} ${payload.dataType}${payload.isNullable ? "" : " not null"};`;
  }

  if (payload.action === "rename-column") {
    return `alter table ${tableName} rename column ${quoteIdentifier(
      payload.columnName,
    )} to ${quoteIdentifier(payload.newColumnName)};`;
  }

  if (payload.action === "change-data-type") {
    return `alter table ${tableName} alter column ${quoteIdentifier(
      payload.columnName,
    )} type ${payload.dataType};`;
  }

  if (payload.action === "change-default") {
    if (payload.defaultExpression === null) {
      return `alter table ${tableName} alter column ${quoteIdentifier(
        payload.columnName,
      )} drop default;`;
    }

    return `alter table ${tableName} alter column ${quoteIdentifier(
      payload.columnName,
    )} set default ${payload.defaultExpression};`;
  }

  return `alter table ${tableName} drop column ${quoteIdentifier(
    payload.columnName,
  )};`;
};

/**
 * Renders table metadata and schema-edit controls in a side drawer.
 *
 * @param props - Selected relation metadata, loading state, and schema mutation actions.
 * @returns The table inspector drawer, or `null` when no table is selected.
 */
export const TableInspectorDrawer = ({
  relation,
  connectionId,
  tableDetail,
  isLoading,
  message,
  closeDrawer,
  refreshTableInspector,
}: TableInspectorDrawerProps): JSX.Element | null => {
  const [activeTab, setActiveTab] = useState<InspectorTab>("columns");
  const [editAction, setEditAction] =
    useState<PgTableChangePayload["action"]>("add-column");
  const [selectedColumnName, setSelectedColumnName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [dataType, setDataType] = useState("text");
  const [defaultExpression, setDefaultExpression] = useState("");
  const [shouldDropDefault, setShouldDropDefault] = useState(false);
  const [isNullable, setIsNullable] = useState(true);
  const [isApplyingChange, setIsApplyingChange] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const relationLabel = useMemo(() => {
    if (!relation) {
      return "";
    }

    return `${relation.schema}.${relation.name}`;
  }, [relation]);
  const existingColumnNames = useMemo(() => {
    return tableDetail?.columns.map((column) => column.name) ?? [];
  }, [tableDetail?.columns]);
  const editPayload = useMemo((): PgTableChangePayload | null => {
    if (!relation) {
      return null;
    }

    if (editAction === "add-column") {
      if (!newColumnName || !identifierPattern.test(newColumnName)) {
        return null;
      }

      return {
        action: "add-column",
        schema: relation.schema,
        table: relation.name,
        columnName: newColumnName,
        dataType,
        isNullable,
      };
    }

    if (!selectedColumnName) {
      return null;
    }

    if (editAction === "rename-column") {
      if (!newColumnName || !identifierPattern.test(newColumnName)) {
        return null;
      }

      return {
        action: "rename-column",
        schema: relation.schema,
        table: relation.name,
        columnName: selectedColumnName,
        newColumnName,
      };
    }

    if (editAction === "change-data-type") {
      return {
        action: "change-data-type",
        schema: relation.schema,
        table: relation.name,
        columnName: selectedColumnName,
        dataType,
      };
    }

    if (editAction === "change-default") {
      if (!shouldDropDefault && !defaultExpression.trim()) {
        return null;
      }

      return {
        action: "change-default",
        schema: relation.schema,
        table: relation.name,
        columnName: selectedColumnName,
        defaultExpression: shouldDropDefault ? null : defaultExpression.trim(),
      };
    }

    return {
      action: "delete-column",
      schema: relation.schema,
      table: relation.name,
      columnName: selectedColumnName,
    };
  }, [
    dataType,
    defaultExpression,
    editAction,
    isNullable,
    newColumnName,
    relation,
    selectedColumnName,
    shouldDropDefault,
  ]);
  const previewSql = useMemo(() => {
    return buildPreviewSql(editPayload);
  }, [editPayload]);
  const applySchemaChange = async (): Promise<void> => {
    if (!connectionId) {
      setEditMessage("Select and connect a database before applying changes.");
      return;
    }

    if (!editPayload || !previewSql) {
      setEditMessage("Complete the form before applying changes.");
      return;
    }

    const confirmed = window.confirm(
      `Apply this schema change?\n\n${previewSql}`,
    );

    if (!confirmed) {
      return;
    }

    setIsApplyingChange(true);
    setEditMessage("Applying schema change...");

    try {
      const result = await window.pgdesk.metadata.applyTableChange(
        editPayload,
        connectionId,
      );

      if (result.ok) {
        setEditMessage(result.message);
        setNewColumnName("");
        setDefaultExpression("");
        setShouldDropDefault(false);
        await refreshTableInspector();
        return;
      }

      setEditMessage(`Error: ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setEditMessage(`Error: ${message}`);
    } finally {
      setIsApplyingChange(false);
    }
  };

  if (!relation) {
    return null;
  }

  return (
    <div className="table-inspector-backdrop">
      <aside className="table-inspector-drawer">
        <header className="table-inspector-header">
          <div>
            <div className="table-inspector-eyebrow">Table inspector</div>
            <div className="table-inspector-title">{relation.name}</div>
            <div className="table-inspector-subtitle">{relationLabel}</div>
          </div>

          <div className="table-inspector-actions">
            <button
              className="inspector-secondary-button"
              type="button"
              disabled={isLoading}
              onClick={() => {
                void refreshTableInspector();
              }}
            >
              Refresh
            </button>
            <button
              className="inspector-close-button"
              type="button"
              onClick={closeDrawer}
            >
              ×
            </button>
          </div>
        </header>

        <div className="table-inspector-summary">
          <div>
            <span>Columns</span>
            <strong>{tableDetail?.columns.length ?? "…"}</strong>
          </div>
          <div>
            <span>Foreign keys</span>
            <strong>{tableDetail?.foreignKeys.length ?? "…"}</strong>
          </div>
          <div>
            <span>Indexes</span>
            <strong>{tableDetail?.indexes.length ?? "…"}</strong>
          </div>
        </div>

        <div className="table-inspector-tabs">
          {inspectorTabs.map((tab) => (
            <button
              className={
                activeTab === tab.id
                  ? "table-inspector-tab active"
                  : "table-inspector-tab"
              }
              type="button"
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="table-inspector-body">
          {isLoading && (
            <div className="inspector-empty-state">Loading metadata...</div>
          )}

          {!isLoading && !tableDetail && (
            <div className="inspector-empty-state">{message}</div>
          )}

          {!isLoading && tableDetail && activeTab === "columns" && (
            <div className="inspector-table-wrap">
              <table className="inspector-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Nullable</th>
                    <th>Default</th>
                    <th>Keys</th>
                  </tr>
                </thead>
                <tbody>
                  {tableDetail.columns.map((column) => (
                    <tr key={column.name}>
                      <td>{column.name}</td>
                      <td>
                        {formatDataType(
                          column.dataType,
                          column.characterMaximumLength,
                          column.numericPrecision,
                          column.numericScale,
                        )}
                      </td>
                      <td>{column.isNullable ? "Yes" : "No"}</td>
                      <td>{column.defaultValue ?? "—"}</td>
                      <td>
                        <div className="inspector-badges">
                          {column.isPrimaryKey && (
                            <span className="inspector-badge primary">PK</span>
                          )}
                          {column.isForeignKey && (
                            <span className="inspector-badge">FK</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && tableDetail && activeTab === "foreignKeys" && (
            <div className="inspector-list">
              {tableDetail.foreignKeys.length === 0 && (
                <div className="inspector-empty-state">No foreign keys.</div>
              )}

              {tableDetail.foreignKeys.map((foreignKey) => (
                <div className="inspector-list-item" key={foreignKey.name}>
                  <div className="inspector-list-title">{foreignKey.name}</div>
                  <div className="inspector-list-body">
                    {foreignKey.columns.join(", ")} →{" "}
                    {foreignKey.referencedSchema}.{foreignKey.referencedTable}(
                    {foreignKey.referencedColumns.join(", ")})
                  </div>
                  <div className="inspector-list-meta">
                    on update {foreignKey.updateRule.toLowerCase()} · on delete{" "}
                    {foreignKey.deleteRule.toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && tableDetail && activeTab === "indexes" && (
            <div className="inspector-list">
              {tableDetail.indexes.length === 0 && (
                <div className="inspector-empty-state">No indexes.</div>
              )}

              {tableDetail.indexes.map((index) => (
                <div className="inspector-list-item" key={index.name}>
                  <div className="inspector-list-title">
                    {index.name}
                    {index.isPrimary && (
                      <span className="inspector-badge primary">primary</span>
                    )}
                    {index.isUnique && (
                      <span className="inspector-badge">unique</span>
                    )}
                  </div>
                  <code className="inspector-code">{index.definition}</code>
                </div>
              ))}
            </div>
          )}

          {!isLoading && tableDetail && activeTab === "edit" && (
            <div className="inspector-edit-panel">
              <div className="inspector-edit-title">Schema editing</div>
              <p className="inspector-edit-copy">
                Changes are previewed as SQL before they are applied.
              </p>

              <div className="inspector-form-grid">
                <label className="inspector-field">
                  <span>Action</span>
                  <select
                    value={editAction}
                    onChange={(event) => {
                      setEditAction(
                        event.currentTarget
                          .value as PgTableChangePayload["action"],
                      );
                      setEditMessage("");
                    }}
                  >
                    <option value="add-column">Add column</option>
                    <option value="rename-column">Rename column</option>
                    <option value="change-data-type">Change datatype</option>
                    <option value="change-default">Set / drop default</option>
                    <option value="delete-column">Delete column</option>
                  </select>
                </label>

                {editAction !== "add-column" && (
                  <label className="inspector-field">
                    <span>Column</span>
                    <select
                      value={selectedColumnName}
                      onChange={(event) => {
                        setSelectedColumnName(event.currentTarget.value);
                        setEditMessage("");
                      }}
                    >
                      <option value="">Select column</option>
                      {existingColumnNames.map((columnName) => (
                        <option value={columnName} key={columnName}>
                          {columnName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {(editAction === "add-column" ||
                  editAction === "rename-column") && (
                  <label className="inspector-field">
                    <span>
                      {editAction === "add-column" ? "Column name" : "New name"}
                    </span>
                    <input
                      value={newColumnName}
                      onChange={(event) => {
                        setNewColumnName(event.currentTarget.value);
                        setEditMessage("");
                      }}
                      placeholder="snake_case_name"
                    />
                  </label>
                )}

                {(editAction === "add-column" ||
                  editAction === "change-data-type") && (
                  <label className="inspector-field">
                    <span>Data type</span>
                    <select
                      value={dataType}
                      onChange={(event) => {
                        setDataType(event.currentTarget.value);
                        setEditMessage("");
                      }}
                    >
                      {supportedDataTypes.map((type) => (
                        <option value={type} key={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {editAction === "change-default" && (
                  <>
                    <label className="inspector-checkbox-field">
                      <input
                        type="checkbox"
                        checked={shouldDropDefault}
                        onChange={(event) => {
                          setShouldDropDefault(event.currentTarget.checked);
                          setEditMessage("");
                        }}
                      />
                      <span>Drop current default</span>
                    </label>

                    {!shouldDropDefault && (
                      <label className="inspector-field">
                        <span>Default expression</span>
                        <input
                          value={defaultExpression}
                          onChange={(event) => {
                            setDefaultExpression(event.currentTarget.value);
                            setEditMessage("");
                          }}
                          placeholder="'active', 0, now()"
                        />
                      </label>
                    )}
                  </>
                )}

                {editAction === "add-column" && (
                  <label className="inspector-checkbox-field">
                    <input
                      type="checkbox"
                      checked={isNullable}
                      onChange={(event) => {
                        setIsNullable(event.currentTarget.checked);
                        setEditMessage("");
                      }}
                    />
                    <span>Allow NULL values</span>
                  </label>
                )}
              </div>

              <div className="inspector-sql-preview">
                <span>SQL preview</span>
                <code>{previewSql || "Complete the form to preview SQL."}</code>
              </div>

              <div className="inspector-edit-footer">
                <span
                  className={
                    editMessage.startsWith("Error")
                      ? "inspector-edit-message error"
                      : "inspector-edit-message"
                  }
                >
                  {editMessage}
                </span>
                <button
                  className="inspector-primary-button"
                  type="button"
                  disabled={!editPayload || isApplyingChange}
                  onClick={() => {
                    void applySchemaChange();
                  }}
                >
                  {isApplyingChange ? "Applying..." : "Apply changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
