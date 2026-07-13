const SELECT_QUERY_PATTERN = /^\s*(?:with\b[\s\S]+?\bselect\b|select\b)/i;
const TRAILING_SEMICOLON_PATTERN = /;\s*$/;

export const QUERY_LIMIT_OPTIONS = [100, 500, 1000] as const;

export type QueryLimit = (typeof QUERY_LIMIT_OPTIONS)[number];

/**
 * Determines whether a numeric value is one of the query limits supported by
 * the result toolbar.
 *
 * @param value - Numeric value to validate.
 * @returns `true` when the value is a supported {@link QueryLimit}.
 */
export const isQueryLimit = (value: number): value is QueryLimit => {
  return QUERY_LIMIT_OPTIONS.includes(value as QueryLimit);
};

/**
 * Wraps a read-only SELECT statement with the configured result limit.
 *
 * @param sql - SQL text entered by the user.
 * @param limit - Maximum number of rows that the query should return.
 * @returns Wrapped SQL for SELECT statements, or the original SQL for other
 * statement types.
 */
export const applySelectLimit = (sql: string, limit: QueryLimit): string => {
  const trimmedSql = sql.trim();

  if (!trimmedSql || !SELECT_QUERY_PATTERN.test(trimmedSql)) {
    return sql;
  }

  const sqlWithoutTrailingSemicolon = trimmedSql.replace(
    TRAILING_SEMICOLON_PATTERN,
    "",
  );

  return `select *
from (
${sqlWithoutTrailingSemicolon}
) as pgdesk_limited_query
limit ${limit};`;
};
