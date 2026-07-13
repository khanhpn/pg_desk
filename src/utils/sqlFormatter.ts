type SqlTokenType =
  | "word"
  | "number"
  | "string"
  | "comment"
  | "symbol"
  | "operator";

type SqlToken = {
  type: SqlTokenType;
  value: string;
};

const sqlKeywords = new Set([
  "all",
  "alter",
  "and",
  "as",
  "asc",
  "begin",
  "between",
  "by",
  "case",
  "cast",
  "create",
  "cross",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "end",
  "except",
  "exists",
  "false",
  "from",
  "full",
  "group",
  "having",
  "in",
  "inner",
  "insert",
  "intersect",
  "into",
  "is",
  "join",
  "left",
  "like",
  "limit",
  "not",
  "null",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "returning",
  "right",
  "select",
  "set",
  "then",
  "true",
  "union",
  "update",
  "using",
  "values",
  "when",
  "where",
  "with",
]);

const clauseKeywords = new Set([
  "DELETE",
  "FROM",
  "GROUP",
  "HAVING",
  "INSERT",
  "LIMIT",
  "OFFSET",
  "ORDER",
  "RETURNING",
  "SELECT",
  "SET",
  "UNION",
  "UPDATE",
  "VALUES",
  "WHERE",
  "WITH",
]);

const joinPrefixKeywords = new Set(["CROSS", "FULL", "INNER", "LEFT", "RIGHT"]);
const newlineClauseKeywords = new Set(["RETURNING", "SELECT", "SET", "WHERE"]);
const logicalKeywords = new Set(["AND", "OR"]);

const isWordStart = (char: string): boolean => /[A-Za-z_]/.test(char);
const isWordPart = (char: string): boolean => /[A-Za-z0-9_$]/.test(char);
const isNumberPart = (char: string): boolean => /[0-9.]/.test(char);
const isWhitespace = (char: string): boolean => /\s/.test(char);

/**
 * Finds the end of a quoted SQL token while respecting doubled quote escapes.
 *
 * @param sql - Complete SQL source text.
 * @param start - Index of the opening quote.
 * @param quote - Quote character that terminates the token.
 * @returns The index immediately after the quoted token.
 */
const readQuotedValue = (sql: string, start: number, quote: string): number => {
  let index = start + 1;

  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }

      return index + 1;
    }

    index += 1;
  }

  return sql.length;
};

/**
 * Splits SQL into formatting tokens without changing quoted values or comments.
 *
 * @param sql - SQL source text to tokenize.
 * @returns Ordered tokens consumed by the lightweight formatter.
 */
const tokenizeSql = (sql: string): SqlToken[] => {
  const tokens: SqlToken[] = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === "-" && nextChar === "-") {
      const endIndex = sql.indexOf("\n", index + 2);
      const commentEndIndex = endIndex === -1 ? sql.length : endIndex;

      tokens.push({
        type: "comment",
        value: sql.slice(index, commentEndIndex),
      });
      index = commentEndIndex;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      const endIndex = sql.indexOf("*/", index + 2);
      const commentEndIndex = endIndex === -1 ? sql.length : endIndex + 2;

      tokens.push({
        type: "comment",
        value: sql.slice(index, commentEndIndex),
      });
      index = commentEndIndex;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      const endIndex = readQuotedValue(sql, index, char);

      tokens.push({
        type: "string",
        value: sql.slice(index, endIndex),
      });
      index = endIndex;
      continue;
    }

    if (isWordStart(char)) {
      let endIndex = index + 1;

      while (endIndex < sql.length && isWordPart(sql[endIndex])) {
        endIndex += 1;
      }

      const value = sql.slice(index, endIndex);

      tokens.push({
        type: "word",
        value: sqlKeywords.has(value.toLowerCase())
          ? value.toUpperCase()
          : value,
      });
      index = endIndex;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let endIndex = index + 1;

      while (endIndex < sql.length && isNumberPart(sql[endIndex])) {
        endIndex += 1;
      }

      tokens.push({
        type: "number",
        value: sql.slice(index, endIndex),
      });
      index = endIndex;
      continue;
    }

    if ("(),;".includes(char)) {
      tokens.push({
        type: "symbol",
        value: char,
      });
      index += 1;
      continue;
    }

    tokens.push({
      type: "operator",
      value: char,
    });
    index += 1;
  }

  return tokens;
};

/**
 * Formats SQL for readability while preserving literals, identifiers, and
 * comments exactly as entered.
 *
 * @param sql - SQL source text to format.
 * @returns Normalized SQL with keyword casing, indentation, and line breaks.
 */
export const formatSql = (sql: string): string => {
  const tokens = tokenizeSql(sql);

  if (tokens.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let currentLine = "";
  let indentLevel = 0;
  let parenDepth = 0;
  let activeClause = "";

  const append = (value: string): void => {
    if (!currentLine) {
      currentLine = `${"  ".repeat(indentLevel)}${value}`;
      return;
    }

    if (/[,(.]/.test(currentLine.at(-1) ?? "") || /^[,;.)]$/.test(value)) {
      currentLine += value;
      return;
    }

    currentLine += ` ${value}`;
  };

  const newline = (nextIndentLevel = indentLevel): void => {
    const trimmedLine = currentLine.trimEnd();

    if (trimmedLine) {
      lines.push(trimmedLine);
    }

    currentLine = "";
    indentLevel = nextIndentLevel;
  };

  const nextWord = (index: number): string | null => {
    const token = tokens[index + 1];

    return token?.type === "word" ? token.value.toUpperCase() : null;
  };

  tokens.forEach((token, index) => {
    if (token.type === "comment") {
      newline(indentLevel);
      append(token.value);
      newline(indentLevel);
      return;
    }

    if (token.value === "(") {
      append(token.value);
      parenDepth += 1;
      return;
    }

    if (token.value === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      append(token.value);
      return;
    }

    if (token.value === ";") {
      append(token.value);
      newline(0);
      activeClause = "";
      return;
    }

    if (token.value === ",") {
      append(token.value);

      if (
        parenDepth === 0 &&
        ["RETURNING", "SELECT", "SET"].includes(activeClause)
      ) {
        newline(1);
      }

      return;
    }

    if (token.type === "word") {
      const keyword = token.value.toUpperCase();

      if (parenDepth === 0 && joinPrefixKeywords.has(keyword)) {
        newline(0);
        append(keyword);
        activeClause = "JOIN";
        return;
      }

      if (parenDepth === 0 && keyword === "JOIN") {
        if (
          !/^\s*(CROSS|FULL|INNER|LEFT|RIGHT)(\s+OUTER)?$/i.test(currentLine)
        ) {
          newline(0);
        }

        append(keyword);
        activeClause = "JOIN";
        return;
      }

      if (parenDepth === 0 && logicalKeywords.has(keyword)) {
        newline(1);
        append(keyword);
        return;
      }

      if (parenDepth === 0 && clauseKeywords.has(keyword)) {
        const upcomingWord = nextWord(index);

        if (keyword === "BY" || keyword === "INTO") {
          append(keyword);
          return;
        }

        if (keyword === "GROUP" && upcomingWord === "BY") {
          newline(0);
          append(keyword);
          activeClause = "GROUP";
          return;
        }

        if (keyword === "ORDER" && upcomingWord === "BY") {
          newline(0);
          append(keyword);
          activeClause = "ORDER";
          return;
        }

        newline(0);
        append(keyword);
        activeClause = keyword;

        if (newlineClauseKeywords.has(keyword)) {
          newline(1);
        }

        return;
      }
    }

    append(token.value);
  });

  newline(0);

  return lines.join("\n").trim();
};
