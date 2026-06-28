import { useCallback, useState } from "react";
import { buildSelectRelationSql } from "@/utils/sql";
import type { QueryRunResult } from "@electron/types/query";

export const useSqlQuery = () => {
  const [sql, setSql] = useState(`select
  current_database() as database,
  current_user as user,
  now() as current_time;`);

  const [queryResult, setQueryResult] = useState<QueryRunResult | null>(null);
  const [queryMessage, setQueryMessage] = useState("Ready");
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const runSqlText = useCallback(async (nextSql: string): Promise<void> => {
    setIsRunningQuery(true);
    setQueryMessage("Running query...");

    try {
      const result = await window.pgdesk.query.run(nextSql);

      setQueryResult(result);

      if (result.ok) {
        setQueryMessage(
          `${result.command ?? "QUERY"} · ${result.rowCount} rows · ${result.durationMs}ms`,
        );
        return;
      }

      setQueryMessage(`Error: ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setQueryMessage(`Error: ${message}`);
    } finally {
      setIsRunningQuery(false);
    }
  }, []);

  const handleRunQuery = useCallback(async (): Promise<void> => {
    await runSqlText(sql);
  }, [runSqlText, sql]);

  const handleOpenRelation = useCallback(
    async (schema: string, relation: string): Promise<void> => {
      const nextSql = buildSelectRelationSql(schema, relation, 100);

      setSql(nextSql);
      await runSqlText(nextSql);
    },
    [runSqlText],
  );

  return {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    handleRunQuery,
    handleOpenRelation,
  };
};
