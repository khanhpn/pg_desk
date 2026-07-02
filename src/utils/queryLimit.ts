const SELECT_QUERY_PATTERN = /^\s*(?:with\b[\s\S]+?\bselect\b|select\b)/i;
const TRAILING_SEMICOLON_PATTERN = /;\s*$/;

export const QUERY_LIMIT_OPTIONS = [100, 500, 1000] as const;

export type QueryLimit = (typeof QUERY_LIMIT_OPTIONS)[number];

export const isQueryLimit = (value: number): value is QueryLimit => {
  return QUERY_LIMIT_OPTIONS.includes(value as QueryLimit);
};

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
