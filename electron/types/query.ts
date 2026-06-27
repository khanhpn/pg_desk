export type QueryRunPayload = {
  sql: string;
};

export type QueryRunResult = {
  ok: boolean;
  message: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  command?: string;
};
