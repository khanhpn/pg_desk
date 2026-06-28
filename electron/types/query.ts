export type QueryRunPayload = {
  sql: string;
};

export type QueryColumnMetadata = {
  name: string;
  dataTypeId: number;
  tableOid: number;
  columnId: number;
  columnName: string | null;
  tableSchema: string | null;
  tableName: string | null;
  isPrimaryKey: boolean;
  isEditable: boolean;
};

export type QueryRunResult = {
  ok: boolean;
  message: string;
  columns: string[];
  columnMetadata: QueryColumnMetadata[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  command?: string;
  editMessage?: string;
};

export type QueryCellUpdatePayload = {
  tableOid: number;
  columnName: string;
  primaryKeys: Array<{
    columnName: string;
    value: unknown;
  }>;
  value: unknown;
};

export type QueryCellUpdateResult = {
  ok: boolean;
  message: string;
  rowCount: number;
};
