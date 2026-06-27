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
