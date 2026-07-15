import { createRequire } from "node:module";
import type { Pool as PgPool, PoolClient } from "pg";

// import types
import type {
  PgConnectionConfig,
  PgConnectionListResult,
  PgConnectionTestResult,
} from "@electron/types/connection";
import type {
  QueryCancelPayload,
  QueryCancelResult,
  QueryCellUpdatePayload,
  QueryCellUpdateResult,
  QueryColumnMetadata,
  QueryExplainPayload,
  QueryRunPayload,
  QueryRunResult,
  QueryRowDeletePayload,
  QueryRowDeleteResult,
  QueryTableChangePayload,
  QueryTableChangeResult,
} from "@electron/types/query";

// import utils
import { getErrorMessage } from "@electron/utils/error";

// import services
import {
  deleteConnectionProfile,
  loadConnectionProfiles,
  saveConnectionProfile,
  setActiveConnectionProfile,
} from "@electron/services/connection-profile-service";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as typeof import("pg");

const poolsByConnectionId = new Map<string, PgPool>();
let activeConnectionId: string | null = null;

type ActiveQuery = {
  connectionId: string;
  pool: PgPool;
  processId: number | null;
};

const activeQueriesByRequestId = new Map<string, ActiveQuery>();

type QueryFieldMetadata = {
  name: string;
  dataTypeID: number;
  tableID: number;
  columnID: number;
};

/**
 * Converts positional PostgreSQL rows into renderer records without losing
 * values when multiple fields share the same output name.
 *
 * @param fields - Ordered field names returned by PostgreSQL.
 * @param rows - Positional rows produced with `rowMode: "array"`.
 * @returns Unique display column names and records keyed by those names.
 */
export const normalizeQueryResultRows = (
  fields: Array<{ name: string }>,
  rows: unknown[][],
): { columns: string[]; rows: Record<string, unknown>[] } => {
  const occurrences = new Map<string, number>();
  const usedNames = new Set<string>();
  const columns = fields.map((field) => {
    let occurrence = (occurrences.get(field.name) ?? 0) + 1;
    let displayName =
      occurrence === 1 ? field.name : `${field.name} (${occurrence})`;

    while (usedNames.has(displayName)) {
      occurrence += 1;
      displayName = `${field.name} (${occurrence})`;
    }

    occurrences.set(field.name, occurrence);
    usedNames.add(displayName);
    return displayName;
  });

  return {
    columns,
    rows: rows.map((row) => {
      return Object.fromEntries(
        columns.map((column, index) => [column, row[index]]),
      );
    }),
  };
};

type PrimaryKeyColumnRow = {
  table_oid: number;
  schema_name: string;
  table_name: string;
  column_name: string;
  column_id: number;
};

type EditableTableMetadata = {
  schemaName: string;
  tableName: string;
  primaryKeys: Array<{
    columnName: string;
    columnId: number;
  }>;
};

type TableColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  is_primary_key: boolean;
};

type SourceColumnRow = {
  table_oid: number;
  schema_name: string;
  table_name: string;
  column_name: string;
  column_id: number;
};

type ExplainPlanNode = {
  "Node Type"?: string;
  Schema?: string;
  "Relation Name"?: string;
  Alias?: string;
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Plan Width"?: number;
  "Join Type"?: string;
  "Index Name"?: string;
  Filter?: string;
  "Index Cond"?: string;
  "Hash Cond"?: string;
  "Merge Cond"?: string;
  "Recheck Cond"?: string;
  Plans?: ExplainPlanNode[];
};

type ExplainResultRow = {
  "QUERY PLAN": Array<{
    Plan?: ExplainPlanNode;
  }>;
};

/** @returns The identifier of the connection currently selected by the main process. */
export const getActiveConnectionId = (): string | null => {
  return activeConnectionId;
};

/**
 * Resolves a connected pool by identifier, falling back to the active connection.
 *
 * @param connectionId - Optional explicit connection identifier.
 * @returns The connected pool, or `null` when the requested connection is unavailable.
 */
export const getActivePostgresPool = (
  connectionId?: string | null,
): PgPool | null => {
  const targetConnectionId = connectionId ?? activeConnectionId;

  return targetConnectionId
    ? (poolsByConnectionId.get(targetConnectionId) ?? null)
    : null;
};

const createPool = (config: PgConnectionConfig): PgPool => {
  return new Pool({
    host: config.host.trim(),
    port: config.port,
    database: config.database.trim(),
    user: config.user.trim(),
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000,
    max: 5,
  });
};

const quoteIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

const stripTrailingSemicolons = (sql: string): string => {
  return sql.trim().replace(/;+\s*$/g, "");
};

const buildExplainSql = (sql: string): string => {
  return `EXPLAIN (FORMAT JSON, VERBOSE, COSTS) ${stripTrailingSemicolons(sql)}`;
};

const formatExplainRelation = (plan: ExplainPlanNode): string => {
  return [plan.Schema, plan["Relation Name"]].filter(Boolean).join(".");
};

const formatExplainDetails = (plan: ExplainPlanNode): string => {
  return [
    plan["Join Type"] ? `Join: ${plan["Join Type"]}` : null,
    plan["Index Name"] ? `Index: ${plan["Index Name"]}` : null,
    plan.Filter ? `Filter: ${plan.Filter}` : null,
    plan["Index Cond"] ? `Index Cond: ${plan["Index Cond"]}` : null,
    plan["Hash Cond"] ? `Hash Cond: ${plan["Hash Cond"]}` : null,
    plan["Merge Cond"] ? `Merge Cond: ${plan["Merge Cond"]}` : null,
    plan["Recheck Cond"] ? `Recheck Cond: ${plan["Recheck Cond"]}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

const flattenExplainPlan = (
  plan: ExplainPlanNode,
  level = 0,
): Record<string, unknown>[] => {
  const currentRow = {
    level,
    node_type: plan["Node Type"] ?? "Plan",
    relation: formatExplainRelation(plan),
    startup_cost: plan["Startup Cost"] ?? null,
    total_cost: plan["Total Cost"] ?? null,
    plan_rows: plan["Plan Rows"] ?? null,
    plan_width: plan["Plan Width"] ?? null,
    details: formatExplainDetails(plan),
  };

  return [
    currentRow,
    ...(plan.Plans ?? []).flatMap((childPlan) => {
      return flattenExplainPlan(childPlan, level + 1);
    }),
  ];
};

const getPrimaryKeyMetadata = async (
  pool: PgPool,
  tableOids: number[],
): Promise<Map<number, EditableTableMetadata>> => {
  const metadata = new Map<number, EditableTableMetadata>();

  if (tableOids.length === 0) {
    return metadata;
  }

  const result = await pool.query<PrimaryKeyColumnRow>(
    `
      select
        c.oid::int as table_oid,
        n.nspname as schema_name,
        c.relname as table_name,
        a.attname as column_name,
        a.attnum::int as column_id
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_index i on i.indrelid = c.oid and i.indisprimary
      join unnest(i.indkey) with ordinality pk(attnum, ordinal) on true
      join pg_attribute a on a.attrelid = c.oid and a.attnum = pk.attnum
      where c.oid = any($1::oid[])
        and c.relkind in ('r', 'p')
      order by c.oid, pk.ordinal
    `,
    [tableOids],
  );

  result.rows.forEach((row) => {
    const table =
      metadata.get(row.table_oid) ??
      ({
        schemaName: row.schema_name,
        tableName: row.table_name,
        primaryKeys: [],
      } satisfies EditableTableMetadata);

    table.primaryKeys.push({
      columnName: row.column_name,
      columnId: row.column_id,
    });

    metadata.set(row.table_oid, table);
  });

  return metadata;
};

const getSourceColumnMetadata = async (
  pool: PgPool,
  tableOids: number[],
): Promise<Map<string, SourceColumnRow>> => {
  const metadata = new Map<string, SourceColumnRow>();

  if (tableOids.length === 0) {
    return metadata;
  }

  const result = await pool.query<SourceColumnRow>(
    `
      select
        c.oid::int as table_oid,
        n.nspname as schema_name,
        c.relname as table_name,
        a.attname as column_name,
        a.attnum::int as column_id
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      where c.oid = any($1::oid[])
        and c.relkind in ('r', 'p')
        and a.attnum > 0
        and not a.attisdropped
    `,
    [tableOids],
  );

  result.rows.forEach((row) => {
    metadata.set(`${row.table_oid}.${row.column_id}`, row);
  });

  return metadata;
};

const buildColumnMetadata = async (
  pool: PgPool,
  fields: QueryFieldMetadata[],
  displayColumnNames: string[],
): Promise<{ columns: QueryColumnMetadata[]; editMessage: string }> => {
  const tableOids = Array.from(
    new Set(fields.map((field) => field.tableID).filter((tableId) => tableId)),
  );
  const primaryKeyMetadata = await getPrimaryKeyMetadata(pool, tableOids);
  const sourceColumnMetadata = await getSourceColumnMetadata(pool, tableOids);
  const duplicateColumnNames = new Set<string>();
  const seenColumnNames = new Set<string>();

  fields.forEach((field) => {
    if (seenColumnNames.has(field.name)) {
      duplicateColumnNames.add(field.name);
      return;
    }

    seenColumnNames.add(field.name);
  });

  const hasDuplicateColumnNames = duplicateColumnNames.size > 0;

  const columns = fields.map<QueryColumnMetadata>((field, fieldIndex) => {
    const table = primaryKeyMetadata.get(field.tableID);
    const sourceColumn = sourceColumnMetadata.get(
      `${field.tableID}.${field.columnID}`,
    );
    const primaryKey = table?.primaryKeys.find(
      (key) => key.columnId === field.columnID,
    );
    const hasPrimaryKeysInResult = Boolean(
      table?.primaryKeys.every((key) =>
        fields.some(
          (candidate) =>
            candidate.tableID === field.tableID &&
            candidate.columnID === key.columnId,
        ),
      ),
    );
    const isTableColumn = field.tableID > 0 && field.columnID > 0;

    return {
      name: displayColumnNames[fieldIndex] ?? field.name,
      dataTypeId: field.dataTypeID,
      tableOid: field.tableID,
      columnId: field.columnID,
      columnName: sourceColumn?.column_name ?? null,
      tableSchema: sourceColumn?.schema_name ?? table?.schemaName ?? null,
      tableName: sourceColumn?.table_name ?? table?.tableName ?? null,
      isPrimaryKey: Boolean(primaryKey),
      isEditable:
        isTableColumn &&
        Boolean(sourceColumn) &&
        Boolean(table) &&
        hasPrimaryKeysInResult &&
        !primaryKey &&
        !hasDuplicateColumnNames,
    };
  });

  let editMessage = "Editable cells can be saved to the database.";

  if (hasDuplicateColumnNames) {
    editMessage = "Read-only: duplicate column names in result.";
  } else if (
    columns.length > 0 &&
    columns.every((column) => !column.isEditable)
  ) {
    editMessage =
      "Read-only: include the table primary key columns in the result to edit.";
  }

  return { columns, editMessage };
};

const validateConnectionConfig = (
  config: PgConnectionConfig,
): PgConnectionTestResult | null => {
  if (!config.host.trim()) {
    return {
      ok: false,
      message: "Host is required",
    };
  }

  if (!config.database.trim()) {
    return {
      ok: false,
      message: "Database is required",
    };
  }

  if (!config.user.trim()) {
    return {
      ok: false,
      message: "User is required",
    };
  }

  if (!Number.isFinite(config.port) || config.port <= 0) {
    return {
      ok: false,
      message: "Port is invalid",
    };
  }

  return null;
};

const getConnectionInfo = async (
  client: PoolClient,
): Promise<PgConnectionTestResult> => {
  const result = await client.query(`
    select
      current_database() as database,
      current_user as user,
      version() as server_version
  `);

  const row = result.rows[0];

  return {
    ok: true,
    message: "Connected successfully",
    database: row.database,
    user: row.user,
    serverVersion: row.server_version,
  };
};

/**
 * Validates settings by opening and closing a temporary PostgreSQL pool.
 *
 * @param config - Unpersisted connection settings to test.
 * @returns A success result with server information or a normalized error message.
 */
export const testPostgresConnection = async (
  config: PgConnectionConfig,
): Promise<PgConnectionTestResult> => {
  const validationError = validateConnectionConfig(config);

  if (validationError) {
    return validationError;
  }

  const pool = createPool(config);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    return await getConnectionInfo(client);
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  } finally {
    client?.release();
    await pool.end();
  }
};

/**
 * Connects a profile, persists it, and makes it the active connection.
 *
 * @param config - Connection profile settings supplied by the renderer.
 * @returns Connection status and the stable saved profile identifier.
 */
export const connectPostgres = async (
  config: PgConnectionConfig,
): Promise<PgConnectionTestResult> => {
  const validationError = validateConnectionConfig(config);

  if (validationError) {
    return validationError;
  }

  const nextPool = createPool(config);
  let client: PoolClient | null = null;

  try {
    client = await nextPool.connect();
    const connectionInfo = await getConnectionInfo(client);
    const savedProfile = await saveConnectionProfile(config);
    const existingPool = poolsByConnectionId.get(savedProfile.id);

    if (existingPool) {
      await existingPool.end();
    }

    poolsByConnectionId.set(savedProfile.id, nextPool);
    activeConnectionId = savedProfile.id;

    return connectionInfo;
  } catch (error) {
    await nextPool.end();

    return {
      ok: false,
      message: getErrorMessage(error),
    };
  } finally {
    client?.release();
  }
};

/** @returns Saved profiles, active profile, and identifiers of connected pools. */
export const listPostgresConnections =
  async (): Promise<PgConnectionListResult> => {
    const profileList = await loadConnectionProfiles();
    const profileIds = new Set(
      profileList.profiles.map((profile) => profile.id),
    );

    if (!activeConnectionId || !profileIds.has(activeConnectionId)) {
      activeConnectionId = profileList.activeConnectionId;
    }

    return {
      profiles: profileList.profiles,
      activeConnectionId,
      connectedConnectionIds: Array.from(poolsByConnectionId.keys()),
    };
  };

/**
 * Makes an existing saved profile the active query context.
 *
 * @param connectionId - Saved profile identifier to activate.
 * @returns A promise that resolves after active state is persisted.
 */
export const setActivePostgresConnection = async (
  connectionId: string,
): Promise<void> => {
  await setActiveConnectionProfile(connectionId);
  activeConnectionId = connectionId;
};

/**
 * Disconnects and removes a saved PostgreSQL profile.
 *
 * @param connectionId - Profile identifier to delete.
 * @returns A promise that resolves after memory and disk state are updated.
 */
export const deletePostgresConnectionProfile = async (
  connectionId: string,
): Promise<void> => {
  await disconnectPostgres(connectionId);
  await deleteConnectionProfile(connectionId);

  if (activeConnectionId === connectionId) {
    const nextList = await loadConnectionProfiles();
    activeConnectionId = nextList.activeConnectionId;
  }
};

/**
 * Closes a connected pool without deleting its saved profile.
 *
 * @param connectionId - Explicit pool identifier, or the active pool when omitted.
 * @returns A promise that resolves after the pool is closed.
 */
export const disconnectPostgres = async (
  connectionId?: string | null,
): Promise<void> => {
  const targetConnectionId = connectionId ?? activeConnectionId;

  if (!targetConnectionId) {
    return;
  }

  const pool = poolsByConnectionId.get(targetConnectionId);

  if (!pool) {
    return;
  }

  await pool.end();
  poolsByConnectionId.delete(targetConnectionId);
};

/**
 * Executes SQL on a connected pool and normalizes rows and column metadata.
 *
 * @param payload - SQL text, optional connection identifier, and cancellation ID.
 * @returns Query rows, metadata, timing, command, and success status.
 */
export const runPostgresQuery = async ({
  connectionId,
  requestId,
  sql,
}: QueryRunPayload): Promise<QueryRunResult> => {
  const pool = getActivePostgresPool(connectionId);
  const targetConnectionId = connectionId ?? activeConnectionId;

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  if (!sql.trim()) {
    return {
      ok: false,
      message: "SQL is empty",
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  const startedAt = Date.now();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    if (requestId && targetConnectionId) {
      activeQueriesByRequestId.set(requestId, {
        connectionId: targetConnectionId,
        pool,
        processId:
          (client as unknown as { processID?: number }).processID ?? null,
      });
    }

    const result = await client.query({
      text: sql,
      rowMode: "array",
    });
    const durationMs = Date.now() - startedAt;
    const fields = result.fields as QueryFieldMetadata[];
    const normalizedResult = normalizeQueryResultRows(
      fields,
      result.rows as unknown[][],
    );
    const { columns: columnMetadata, editMessage } = await buildColumnMetadata(
      pool,
      fields,
      normalizedResult.columns,
    );

    return {
      ok: true,
      message: "Query executed successfully",
      columns: normalizedResult.columns,
      columnMetadata,
      rows: normalizedResult.rows,
      rowCount: result.rowCount ?? result.rows.length,
      durationMs,
      command: result.command,
      editMessage,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (requestId) {
      activeQueriesByRequestId.delete(requestId);
    }

    client?.release();
  }
};

/**
 * Cancels a tracked query using a dedicated PostgreSQL control connection.
 *
 * @param payload - Connection and request identifiers for the running query.
 * @returns Cancellation status and a user-presentable message.
 */
export const cancelPostgresQuery = async ({
  connectionId,
  requestId,
}: QueryCancelPayload): Promise<QueryCancelResult> => {
  const activeQuery = activeQueriesByRequestId.get(requestId);

  if (!activeQuery) {
    return {
      ok: false,
      message: "No running query found",
    };
  }

  const targetConnectionId = connectionId ?? activeConnectionId;

  if (targetConnectionId && activeQuery.connectionId !== targetConnectionId) {
    return {
      ok: false,
      message: "Running query belongs to another connection",
    };
  }

  if (!activeQuery.processId) {
    return {
      ok: false,
      message: "Running query backend id is not available",
    };
  }

  try {
    const result = await activeQuery.pool.query<{ cancelled: boolean }>(
      "select pg_cancel_backend($1) as cancelled",
      [activeQuery.processId],
    );
    const cancelled = Boolean(result.rows[0]?.cancelled);

    return {
      ok: cancelled,
      message: cancelled ? "Cancelling query" : "PostgreSQL refused cancel",
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  }
};

/**
 * Executes JSON EXPLAIN for SQL and flattens the plan for tabular rendering.
 *
 * @param payload - SQL text and optional connection identifier.
 * @returns Flattened plan rows and query timing metadata.
 */
export const explainPostgresQuery = async ({
  connectionId,
  sql,
}: QueryExplainPayload): Promise<QueryRunResult> => {
  const pool = getActivePostgresPool(connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  if (!sql.trim()) {
    return {
      ok: false,
      message: "SQL is empty",
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  const startedAt = Date.now();

  try {
    const result = await pool.query<ExplainResultRow>(buildExplainSql(sql));
    const durationMs = Date.now() - startedAt;
    const rootPlan = result.rows[0]?.["QUERY PLAN"]?.[0]?.Plan;
    const rows = rootPlan ? flattenExplainPlan(rootPlan) : [];

    return {
      ok: true,
      message: "Query plan generated successfully",
      columns: [
        "level",
        "node_type",
        "relation",
        "startup_cost",
        "total_cost",
        "plan_rows",
        "plan_width",
        "details",
      ],
      columnMetadata: [],
      rows,
      rowCount: rows.length,
      durationMs,
      command: "EXPLAIN",
      editMessage: "Query plans are read-only.",
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: Date.now() - startedAt,
    };
  }
};

/**
 * Updates one table cell using primary-key values as the row identity guard.
 *
 * @param payload - Table identity, target column/value, and primary-key values.
 * @returns Mutation status and affected-row count.
 */
export const updatePostgresCell = async ({
  connectionId,
  tableOid,
  columnName,
  primaryKeys,
  value,
}: QueryCellUpdatePayload): Promise<QueryCellUpdateResult> => {
  const pool = getActivePostgresPool(connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      rowCount: 0,
    };
  }

  if (!Number.isFinite(tableOid) || tableOid <= 0) {
    return {
      ok: false,
      message: "Editable table metadata is invalid",
      rowCount: 0,
    };
  }

  if (!columnName.trim() || primaryKeys.length === 0) {
    return {
      ok: false,
      message: "Editable row metadata is incomplete",
      rowCount: 0,
    };
  }

  try {
    const metadataResult = await pool.query<TableColumnRow>(
      `
        select
          n.nspname as schema_name,
          c.relname as table_name,
          a.attname as column_name,
          exists (
            select 1
            from pg_index i
            where i.indrelid = c.oid
              and i.indisprimary
              and a.attnum = any(i.indkey)
          ) as is_primary_key
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
        where c.oid = $1::oid
          and c.relkind in ('r', 'p')
          and a.attnum > 0
          and not a.attisdropped
      `,
      [tableOid],
    );

    const tableColumn = metadataResult.rows.find((row) => {
      return row.column_name === columnName;
    });

    if (!tableColumn || tableColumn.is_primary_key) {
      return {
        ok: false,
        message: "This column cannot be edited",
        rowCount: 0,
      };
    }

    const primaryKeyColumns = metadataResult.rows
      .filter((row) => row.is_primary_key)
      .map((row) => row.column_name);

    const hasExpectedPrimaryKeys =
      primaryKeyColumns.length > 0 &&
      primaryKeyColumns.every((primaryKeyColumn) => {
        return primaryKeys.some((key) => key.columnName === primaryKeyColumn);
      });

    if (!hasExpectedPrimaryKeys) {
      return {
        ok: false,
        message: "Primary key values are required to save this row",
        rowCount: 0,
      };
    }

    const updateValues = [value, ...primaryKeys.map((key) => key.value)];
    const whereClause = primaryKeys
      .map((key, index) => {
        return `${quoteIdentifier(key.columnName)} = $${index + 2}`;
      })
      .join(" and ");

    const result = await pool.query(
      `
        update ${quoteIdentifier(tableColumn.schema_name)}.${quoteIdentifier(
          tableColumn.table_name,
        )}
        set ${quoteIdentifier(columnName)} = $1
        where ${whereClause}
      `,
      updateValues,
    );

    const rowCount = result.rowCount ?? 0;

    if (rowCount === 0) {
      return {
        ok: false,
        message: "No row was updated. The row may have changed.",
        rowCount,
      };
    }

    return {
      ok: true,
      message: `Saved ${rowCount} row${rowCount === 1 ? "" : "s"}`,
      rowCount,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      rowCount: 0,
    };
  }
};

/**
 * Deletes one row from a supplied pool using all provided identity values.
 *
 * @param pool - Connected pool used for the delete statement.
 * @param payload - Table identity and primary-key values selecting the row.
 * @returns Mutation status and affected-row count.
 */
export const deletePostgresRowFromPool = async (
  pool: PgPool,
  { tableOid, primaryKeys }: QueryRowDeletePayload,
): Promise<QueryRowDeleteResult> => {
  if (!Number.isFinite(tableOid) || tableOid <= 0) {
    return {
      ok: false,
      message: "Editable table metadata is invalid",
      rowCount: 0,
    };
  }

  try {
    const metadataResult = await pool.query<TableColumnRow>(
      `
        select
          n.nspname as schema_name,
          c.relname as table_name,
          a.attname as column_name,
          exists (
            select 1
            from pg_index i
            where i.indrelid = c.oid
              and i.indisprimary
              and a.attnum = any(i.indkey)
          ) as is_primary_key
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
        where c.oid = $1::oid
          and c.relkind in ('r', 'p')
          and a.attnum > 0
          and not a.attisdropped
      `,
      [tableOid],
    );

    const firstColumn = metadataResult.rows[0];

    if (!firstColumn) {
      return {
        ok: false,
        message: "Editable table metadata is invalid",
        rowCount: 0,
      };
    }

    const primaryKeyColumns = metadataResult.rows
      .filter((row) => row.is_primary_key)
      .map((row) => row.column_name);
    const primaryKeysByName = new Map(
      primaryKeys.map((key) => [key.columnName, key.value]),
    );

    const hasExpectedPrimaryKeys =
      primaryKeyColumns.length > 0 &&
      primaryKeys.length === primaryKeyColumns.length &&
      primaryKeyColumns.every((primaryKeyColumn) => {
        return primaryKeysByName.has(primaryKeyColumn);
      });

    if (!hasExpectedPrimaryKeys) {
      return {
        ok: false,
        message: "Primary key values are required to delete this row",
        rowCount: 0,
      };
    }

    const deleteValues = primaryKeyColumns.map((columnName) => {
      return primaryKeysByName.get(columnName);
    });
    const whereClause = primaryKeyColumns
      .map((columnName, index) => {
        return `${quoteIdentifier(columnName)} = $${index + 1}`;
      })
      .join(" and ");
    const result = await pool.query(
      `
        delete from ${quoteIdentifier(firstColumn.schema_name)}.${quoteIdentifier(
          firstColumn.table_name,
        )}
        where ${whereClause}
      `,
      deleteValues,
    );
    const rowCount = result.rowCount ?? 0;

    if (rowCount === 0) {
      return {
        ok: false,
        message: "No row was deleted. The row may have changed.",
        rowCount,
      };
    }

    return {
      ok: true,
      message: `Deleted ${rowCount} row${rowCount === 1 ? "" : "s"}`,
      rowCount,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      rowCount: 0,
    };
  }
};

const buildTableMetadataQuery = (): string => {
  return `
    select
      n.nspname as schema_name,
      c.relname as table_name,
      a.attname as column_name,
      exists (
        select 1
        from pg_index i
        where i.indrelid = c.oid
          and i.indisprimary
          and a.attnum = any(i.indkey)
      ) as is_primary_key
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where c.oid = $1::oid
      and c.relkind in ('r', 'p')
      and a.attnum > 0
      and not a.attisdropped
  `;
};

const validateTableChangePrimaryKeys = (
  primaryKeys: Array<{ columnName: string; value: unknown }>,
  primaryKeyColumns: string[],
  action: "save" | "delete",
): void => {
  const primaryKeysByName = new Map(
    primaryKeys.map((key) => [key.columnName, key.value]),
  );
  const hasExpectedPrimaryKeys =
    primaryKeys.length === primaryKeyColumns.length &&
    primaryKeyColumns.every((columnName) => primaryKeysByName.has(columnName));

  if (!hasExpectedPrimaryKeys) {
    throw new Error(`Primary key values are required to ${action} this row`);
  }
};

const validateTableChangeColumns = (
  values: Record<string, unknown>,
  tableColumns: Map<string, TableColumnRow>,
): Array<[string, unknown]> => {
  const entries = Object.entries(values);

  if (entries.length === 0) {
    throw new Error("At least one editable value is required");
  }

  entries.forEach(([columnName]) => {
    const column = tableColumns.get(columnName);

    if (!column || column.is_primary_key) {
      throw new Error(`This column cannot be changed: ${columnName}`);
    }
  });

  return entries;
};

/**
 * Applies inserts, updates, and deletes atomically to one PostgreSQL table.
 *
 * @param pool - Connected pool used to acquire the transaction client.
 * @param payload - Table identity, column metadata, and requested row changes.
 * @returns Counts of inserted, updated, and deleted rows after commit.
 * @throws When validation fails, a target row is stale, or the transaction fails.
 */
export const applyPostgresTableChangesFromPool = async (
  pool: PgPool,
  { tableOid, updates, inserts, deletes }: QueryTableChangePayload,
): Promise<QueryTableChangeResult> => {
  if (!Number.isFinite(tableOid) || tableOid <= 0) {
    return {
      ok: false,
      message: "Editable table metadata is invalid",
      rowCount: 0,
    };
  }

  if (updates.length === 0 && inserts.length === 0 && deletes.length === 0) {
    return {
      ok: true,
      message: "No changes to apply",
      rowCount: 0,
    };
  }

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const metadataResult = await client.query<TableColumnRow>(
      buildTableMetadataQuery(),
      [tableOid],
    );
    const firstColumn = metadataResult.rows[0];

    if (!firstColumn) {
      return {
        ok: false,
        message: "Editable table metadata is invalid",
        rowCount: 0,
      };
    }

    const tableColumns = new Map(
      metadataResult.rows.map((column) => [column.column_name, column]),
    );
    const primaryKeyColumns = metadataResult.rows
      .filter((column) => column.is_primary_key)
      .map((column) => column.column_name);

    if (
      primaryKeyColumns.length === 0 &&
      (updates.length > 0 || deletes.length > 0)
    ) {
      return {
        ok: false,
        message: "Primary key metadata is required to change this table",
        rowCount: 0,
      };
    }

    const tableName = `${quoteIdentifier(firstColumn.schema_name)}.${quoteIdentifier(
      firstColumn.table_name,
    )}`;

    const updateOperations = updates.map((update) => {
      validateTableChangePrimaryKeys(
        update.primaryKeys,
        primaryKeyColumns,
        "save",
      );
      return {
        values: validateTableChangeColumns(update.values, tableColumns),
        primaryKeys: update.primaryKeys,
      };
    });
    const insertOperations = inserts.map((insert) => {
      return validateTableChangeColumns(insert.values, tableColumns);
    });
    const deleteOperations = deletes.map((del) => {
      validateTableChangePrimaryKeys(
        del.primaryKeys,
        primaryKeyColumns,
        "delete",
      );
      return del.primaryKeys;
    });

    await client.query("begin");
    let rowCount = 0;

    for (const update of updateOperations) {
      const values = [
        ...update.values.map(([, value]) => value),
        ...update.primaryKeys.map((key) => key.value),
      ];
      const setClause = update.values
        .map(([columnName], index) => {
          return `${quoteIdentifier(columnName)} = $${index + 1}`;
        })
        .join(", ");
      const whereClause = update.primaryKeys
        .map((key, index) => {
          return `${quoteIdentifier(key.columnName)} = $${
            update.values.length + index + 1
          }`;
        })
        .join(" and ");
      const result = await client.query(
        `update ${tableName} set ${setClause} where ${whereClause}`,
        values,
      );

      if ((result.rowCount ?? 0) !== 1) {
        throw new Error("No row was updated. The row may have changed.");
      }

      rowCount += 1;
    }

    for (const insert of insertOperations) {
      const values = insert.map(([, value]) => value);
      const columns = insert
        .map(([columnName]) => quoteIdentifier(columnName))
        .join(", ");
      const placeholders = insert.map((_, index) => `$${index + 1}`).join(", ");
      const result = await client.query(
        `insert into ${tableName} (${columns}) values (${placeholders})`,
        values,
      );
      rowCount += result.rowCount ?? 0;
    }

    for (const primaryKeys of deleteOperations) {
      const values = primaryKeyColumns.map((columnName) => {
        return primaryKeys.find((key) => key.columnName === columnName)?.value;
      });
      const whereClause = primaryKeyColumns
        .map((columnName, index) => {
          return `${quoteIdentifier(columnName)} = $${index + 1}`;
        })
        .join(" and ");
      const result = await client.query(
        `delete from ${tableName} where ${whereClause}`,
        values,
      );

      if ((result.rowCount ?? 0) !== 1) {
        throw new Error("No row was deleted. The row may have changed.");
      }

      rowCount += 1;
    }

    await client.query("commit");
    const isDeleteOnly =
      updates.length === 0 && inserts.length === 0 && deletes.length > 0;
    const noun = isDeleteOnly ? "row" : "change";
    const verb = isDeleteOnly ? "Deleted" : "Saved";

    return {
      ok: true,
      message: `${verb} ${rowCount} ${noun}${rowCount === 1 ? "" : "s"}`,
      rowCount,
    };
  } catch (error) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original database error when rollback itself fails.
      }
    }

    return {
      ok: false,
      message: getErrorMessage(error),
      rowCount: 0,
    };
  } finally {
    client?.release();
  }
};

/**
 * Resolves a connection and applies a batch of editable-result row changes.
 *
 * @param payload - Connection context and table changes from the renderer.
 * @returns Transaction result or a normalized failure response.
 */
export const applyPostgresTableChanges = async (
  payload: QueryTableChangePayload,
): Promise<QueryTableChangeResult> => {
  const pool = getActivePostgresPool(payload.connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      rowCount: 0,
    };
  }

  return applyPostgresTableChangesFromPool(pool, payload);
};

/**
 * Resolves a connection and deletes one identified PostgreSQL row.
 *
 * @param payload - Connection, table, and primary-key identity values.
 * @returns Delete status or a normalized failure response.
 */
export const deletePostgresRow = async (
  payload: QueryRowDeletePayload,
): Promise<QueryRowDeleteResult> => {
  const pool = getActivePostgresPool(payload.connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      rowCount: 0,
    };
  }

  return deletePostgresRowFromPool(pool, payload);
};
