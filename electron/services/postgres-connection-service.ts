import { createRequire } from "node:module";
import type { Pool as PgPool, PoolClient } from "pg";

// import types
import type {
  PgConnectionConfig,
  PgConnectionListResult,
  PgConnectionTestResult,
} from "@electron/types/connection";
import type {
  QueryCellUpdatePayload,
  QueryCellUpdateResult,
  QueryColumnMetadata,
  QueryExplainPayload,
  QueryRunPayload,
  QueryRunResult,
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

type QueryFieldMetadata = {
  name: string;
  dataTypeID: number;
  tableID: number;
  columnID: number;
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

export const getActiveConnectionId = (): string | null => {
  return activeConnectionId;
};

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

  const columns = fields.map<QueryColumnMetadata>((field) => {
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
      name: field.name,
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

export const setActivePostgresConnection = async (
  connectionId: string,
): Promise<void> => {
  await setActiveConnectionProfile(connectionId);
  activeConnectionId = connectionId;
};

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

export const runPostgresQuery = async ({
  connectionId,
  sql,
}: QueryRunPayload): Promise<QueryRunResult> => {
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
    const result = await pool.query(sql);
    const durationMs = Date.now() - startedAt;
    const { columns: columnMetadata, editMessage } = await buildColumnMetadata(
      pool,
      result.fields as QueryFieldMetadata[],
    );

    return {
      ok: true,
      message: "Query executed successfully",
      columns: result.fields.map((field) => field.name),
      columnMetadata,
      rows: result.rows,
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
  }
};

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
