import { getActivePostgresPool } from "@electron/services/postgres-connection-service";
import type {
  PgDatabaseExplorerResult,
  PgRelationInfo,
  PgSchemaInfo,
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

const mapRelationType = (tableType: string): "table" | "view" => {
  return tableType === "VIEW" ? "view" : "table";
};

export const getPostgresExplorer =
  async (): Promise<PgDatabaseExplorerResult> => {
    const pool = getActivePostgresPool();

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
      order by schema_name
    `);

      const relationsResult = await pool.query<TableRow>(`
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')
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
