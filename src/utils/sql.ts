/**
 * Quotes a PostgreSQL identifier and escapes embedded quote characters.
 *
 * @param value - Untrusted schema, relation, or column identifier.
 * @returns A PostgreSQL-safe double-quoted identifier.
 */
export const quoteIdent = (value: string): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

/**
 * Builds a fully qualified PostgreSQL relation identifier.
 *
 * @param schema - Schema containing the relation.
 * @param relation - Table or view name.
 * @returns The quoted `schema.relation` identifier.
 */
export const quoteRelation = (schema: string, relation: string): string => {
  return `${quoteIdent(schema)}.${quoteIdent(relation)}`;
};

/**
 * Builds the SQL used when a relation is opened from the database explorer.
 *
 * @param schema - Schema containing the relation.
 * @param relation - Table or view to select from.
 * @param limit - Maximum number of rows to request.
 * @returns A formatted SELECT statement targeting the quoted relation.
 */
export const buildSelectRelationSql = (
  schema: string,
  relation: string,
  limit = 100,
): string => {
  return `select *
from ${quoteRelation(schema, relation)}
limit ${limit};`;
};
