import { getActivePostgresPool } from "@electron/services/postgres-connection-service";
import type {
  PgDatabaseExplorerResult,
  PgRelationInfo,
  PgSchemaInfo,
  PgTableChangePayload,
  PgTableChangeResult,
  PgTableColumnInfo,
  PgTableDetailResult,
  PgTableForeignKeyInfo,
  PgTableIndexInfo,
} from "@electron/types/metadata";
import { getErrorMessage } from "@electron/utils/error";

type SchemaRow = {
  schema_name: string;
};

type TableRow = {
  table_schema: string;
  table_name: string;
  table_type: string;
};

type ColumnRow = {
  column_name: string;
  ordinal_position: number;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
};

type ForeignKeyRow = {
  constraint_name: string;
  columns: string[];
  referenced_schema: string;
  referenced_table: string;
  referenced_columns: string[];
  update_rule: string;
  delete_rule: string;
};

type IndexRow = {
  index_name: string;
  index_definition: string;
  is_unique: boolean;
  is_primary: boolean;
};

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SUPPORTED_DATA_TYPES = new Set([
  "bigint",
  "boolean",
  "date",
  "integer",
  "jsonb",
  "numeric",
  "text",
  "timestamp with time zone",
  "timestamp without time zone",
  "uuid",
  "varchar(255)",
]);

const mapRelationType = (tableType: string): "table" | "view" => {
  return tableType === "VIEW" ? "view" : "table";
};

const quoteIdentifier = (identifier: string): string => {
  if (!SAFE_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(
      "Use letters, numbers, and underscores only. Names must start with a letter or underscore.",
    );
  }

  return `"${identifier}"`;
};

const getQualifiedTableName = (schema: string, table: string): string => {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

const getSupportedDataType = (dataType: string): string => {
  if (!SUPPORTED_DATA_TYPES.has(dataType)) {
    throw new Error(`Unsupported data type: ${dataType}`);
  }

  return dataType;
};

const buildTableChangeSql = (payload: PgTableChangePayload): string => {
  const qualifiedTableName = getQualifiedTableName(
    payload.schema,
    payload.table,
  );

  if (payload.action === "add-column") {
    const nullableClause = payload.isNullable ? "" : " not null";

    return `alter table ${qualifiedTableName} add column ${quoteIdentifier(
      payload.columnName,
    )} ${getSupportedDataType(payload.dataType)}${nullableClause};`;
  }

  if (payload.action === "rename-column") {
    return `alter table ${qualifiedTableName} rename column ${quoteIdentifier(
      payload.columnName,
    )} to ${quoteIdentifier(payload.newColumnName)};`;
  }

  return `alter table ${qualifiedTableName} alter column ${quoteIdentifier(
    payload.columnName,
  )} type ${getSupportedDataType(payload.dataType)};`;
};

export const getPostgresExplorer = async (
  connectionId?: string | null,
): Promise<PgDatabaseExplorerResult> => {
  const pool = getActivePostgresPool(connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      schemas: [],
    };
  }

  try {
    const schemasResult = await pool.query<SchemaRow>(`
      select schema_name
      from information_schema.schemata
      where schema_name not in ('pg_catalog', 'information_schema')
        and schema_name not like 'pg\\_%' escape '\\'
      order by schema_name
    `);

    const relationsResult = await pool.query<TableRow>(`
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')
        and table_schema not like 'pg\\_%' escape '\\'
        and table_type in ('BASE TABLE', 'VIEW')
      order by table_schema, table_type, table_name
    `);

    const schemaMap = new Map<string, PgSchemaInfo>();

    schemasResult.rows.forEach((row) => {
      schemaMap.set(row.schema_name, {
        name: row.schema_name,
        tables: [],
        views: [],
      });
    });

    relationsResult.rows.forEach((row) => {
      const schema =
        schemaMap.get(row.table_schema) ??
        ({
          name: row.table_schema,
          tables: [],
          views: [],
        } satisfies PgSchemaInfo);

      const relation: PgRelationInfo = {
        schema: row.table_schema,
        name: row.table_name,
        type: mapRelationType(row.table_type),
      };

      if (relation.type === "view") {
        schema.views.push(relation);
      } else {
        schema.tables.push(relation);
      }

      schemaMap.set(row.table_schema, schema);
    });

    return {
      ok: true,
      message: "Explorer loaded",
      schemas: Array.from(schemaMap.values()),
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      schemas: [],
    };
  }
};

export const getPostgresTableDetail = async (
  schema: string,
  table: string,
  connectionId?: string | null,
): Promise<PgTableDetailResult> => {
  const pool = getActivePostgresPool(connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      table: null,
    };
  }

  try {
    const columnsResult = await pool.query<ColumnRow>(
      `
        select
          c.column_name,
          c.ordinal_position,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          exists (
            select 1
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_schema = tc.constraint_schema
             and kcu.constraint_name = tc.constraint_name
             and kcu.table_schema = tc.table_schema
             and kcu.table_name = tc.table_name
            where tc.constraint_type = 'PRIMARY KEY'
              and tc.table_schema = c.table_schema
              and tc.table_name = c.table_name
              and kcu.column_name = c.column_name
          ) as is_primary_key,
          exists (
            select 1
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_schema = tc.constraint_schema
             and kcu.constraint_name = tc.constraint_name
             and kcu.table_schema = tc.table_schema
             and kcu.table_name = tc.table_name
            where tc.constraint_type = 'FOREIGN KEY'
              and tc.table_schema = c.table_schema
              and tc.table_name = c.table_name
              and kcu.column_name = c.column_name
          ) as is_foreign_key
        from information_schema.columns c
        where c.table_schema = $1
          and c.table_name = $2
        order by c.ordinal_position
      `,
      [schema, table],
    );

    const foreignKeysResult = await pool.query<ForeignKeyRow>(
      `
        select
          tc.constraint_name,
          array_agg(kcu.column_name order by kcu.ordinal_position) as columns,
          kcu_ref.table_schema as referenced_schema,
          kcu_ref.table_name as referenced_table,
          array_agg(kcu_ref.column_name order by kcu.ordinal_position) as referenced_columns,
          rc.update_rule,
          rc.delete_rule
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
         and kcu.table_name = tc.table_name
        join information_schema.referential_constraints rc
          on rc.constraint_schema = tc.constraint_schema
         and rc.constraint_name = tc.constraint_name
        join information_schema.key_column_usage kcu_ref
          on kcu_ref.constraint_schema = rc.unique_constraint_schema
         and kcu_ref.constraint_name = rc.unique_constraint_name
         and kcu_ref.ordinal_position = kcu.position_in_unique_constraint
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = $1
          and tc.table_name = $2
        group by
          tc.constraint_name,
          kcu_ref.table_schema,
          kcu_ref.table_name,
          rc.update_rule,
          rc.delete_rule
        order by tc.constraint_name
      `,
      [schema, table],
    );

    const indexesResult = await pool.query<IndexRow>(
      `
        select
          i.relname as index_name,
          pg_get_indexdef(i.oid) as index_definition,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary
        from pg_class t
        join pg_namespace n on n.oid = t.relnamespace
        join pg_index ix on ix.indrelid = t.oid
        join pg_class i on i.oid = ix.indexrelid
        where n.nspname = $1
          and t.relname = $2
        order by ix.indisprimary desc, i.relname
      `,
      [schema, table],
    );

    if (columnsResult.rows.length === 0) {
      return {
        ok: false,
        message: `Table ${schema}.${table} was not found`,
        table: null,
      };
    }

    const columns: PgTableColumnInfo[] = columnsResult.rows.map((row) => ({
      name: row.column_name,
      ordinalPosition: row.ordinal_position,
      dataType: row.data_type,
      isNullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      characterMaximumLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      numericScale: row.numeric_scale,
    }));
    const foreignKeys: PgTableForeignKeyInfo[] = foreignKeysResult.rows.map(
      (row) => ({
        name: row.constraint_name,
        columns: row.columns,
        referencedSchema: row.referenced_schema,
        referencedTable: row.referenced_table,
        referencedColumns: row.referenced_columns,
        updateRule: row.update_rule,
        deleteRule: row.delete_rule,
      }),
    );
    const indexes: PgTableIndexInfo[] = indexesResult.rows.map((row) => ({
      name: row.index_name,
      definition: row.index_definition,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
    }));

    return {
      ok: true,
      message: "Table detail loaded",
      table: {
        schema,
        name: table,
        columns,
        foreignKeys,
        indexes,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      table: null,
    };
  }
};

export const applyPostgresTableChange = async (
  payload: PgTableChangePayload,
  connectionId?: string | null,
): Promise<PgTableChangeResult> => {
  const pool = getActivePostgresPool(connectionId);

  if (!pool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      sql: "",
    };
  }

  try {
    const sql = buildTableChangeSql(payload);

    await pool.query(sql);

    return {
      ok: true,
      message: "Table schema updated",
      sql,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      sql: "",
    };
  }
};
