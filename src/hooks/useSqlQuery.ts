import type { QueryRunResult } from "@electron/types/query";
import { useState } from "react";

export const useSqlQuery = () => {
  const [sql, setSql] = useState(`select
  current_database() as database,
  current_user as user,
  now() as current_time;`);

  const [queryResult, setQueryResult] = useState<QueryRunResult | null>(null);
  const [queryMessage, setQueryMessage] = useState("Ready");
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const handleRunQuery = async (): Promise<void> => {
    setIsRunningQuery(true);
    setQueryMessage("Running query...");

    try {
      const result = await window.pgdesk.query.run(sql);

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
  };

  return {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    handleRunQuery,
  };
};
