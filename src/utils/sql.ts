export const quoteIdent = (value: string): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

export const quoteRelation = (schema: string, relation: string): string => {
  return `${quoteIdent(schema)}.${quoteIdent(relation)}`;
};

export const buildSelectRelationSql = (
  schema: string,
  relation: string,
  limit = 100,
): string => {
  return `select *
from ${quoteRelation(schema, relation)}
limit ${limit};`;
};
