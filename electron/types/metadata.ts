export type PgRelationType = "table" | "view";

export type PgRelationInfo = {
  schema: string;
  name: string;
  type: PgRelationType;
};

export type PgSchemaInfo = {
  name: string;
  tables: PgRelationInfo[];
  views: PgRelationInfo[];
};

export type PgDatabaseExplorerResult = {
  ok: boolean;
  message: string;
  schemas: PgSchemaInfo[];
};

export type PgTableColumnInfo = {
  name: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
};

export type PgTableForeignKeyInfo = {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  updateRule: string;
  deleteRule: string;
};

export type PgTableIndexInfo = {
  name: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
};

export type PgTableDetail = {
  schema: string;
  name: string;
  columns: PgTableColumnInfo[];
  foreignKeys: PgTableForeignKeyInfo[];
  indexes: PgTableIndexInfo[];
};

export type PgTableDetailResult = {
  ok: boolean;
  message: string;
  table: PgTableDetail | null;
};

export type PgTableChangePayload =
  | {
      action: "add-column";
      schema: string;
      table: string;
      columnName: string;
      dataType: string;
      isNullable: boolean;
    }
  | {
      action: "rename-column";
      schema: string;
      table: string;
      columnName: string;
      newColumnName: string;
    }
  | {
      action: "change-data-type";
      schema: string;
      table: string;
      columnName: string;
      dataType: string;
    };

export type PgTableChangeResult = {
  ok: boolean;
  message: string;
  sql: string;
};
