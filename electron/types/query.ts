export type QueryRunPayload = {
  connectionId?: string | null;
  requestId?: string;
  sql: string;
};

export type QueryExplainPayload = QueryRunPayload;

export type QueryCancelPayload = {
  connectionId?: string | null;
  requestId: string;
};

export type QueryCancelResult = {
  ok: boolean;
  message: string;
};

export type QueryColumnMetadata = {
  name: string;
  dataTypeId: number;
  dataType: string;
  hasDefault: boolean;
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
  connectionId?: string | null;
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

export type QueryRowDeletePayload = {
  connectionId?: string | null;
  tableOid: number;
  primaryKeys: Array<{
    columnName: string;
    value: unknown;
  }>;
};

export type QueryRowDeleteResult = {
  ok: boolean;
  message: string;
  rowCount: number;
};

export type QueryPrimaryKeyValue = {
  columnName: string;
  value: unknown;
};

export type QueryTableChangePayload = {
  connectionId?: string | null;
  tableOid: number;
  updates: Array<{
    primaryKeys: QueryPrimaryKeyValue[];
    values: Record<string, unknown>;
  }>;
  inserts: Array<{
    values: Record<string, unknown>;
  }>;
  deletes: Array<{
    primaryKeys: QueryPrimaryKeyValue[];
  }>;
};

export type QueryTableChangeResult = {
  ok: boolean;
  message: string;
  rowCount: number;
};
