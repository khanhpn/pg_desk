import { useCallback, useEffect, useRef, useState } from "react";
import type { PgSchemaInfo } from "@/types/metadata";

/**
 * Loads the schema and relation tree for a PostgreSQL connection.
 *
 * @param connectionId - Active connection whose metadata should be loaded, or
 * `null` when no profile is active.
 * @returns Explorer data, loading and status state, and a refresh command.
 */
export const useDatabaseExplorer = (connectionId: string | null) => {
  const [schemas, setSchemas] = useState<PgSchemaInfo[]>([]);
  const [explorerMessage, setExplorerMessage] = useState("Not loaded");
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    requestGenerationRef.current += 1;
    setSchemas([]);
    setExplorerMessage(connectionId ? "Not loaded" : "Select a connection");
    setIsLoadingExplorer(false);
  }, [connectionId]);

  const refreshExplorer = useCallback(async (): Promise<void> => {
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;

    if (!connectionId) {
      setSchemas([]);
      setExplorerMessage("Select a connection");
      setIsLoadingExplorer(false);
      return;
    }

    setIsLoadingExplorer(true);
    setExplorerMessage("Loading explorer...");

    try {
      const result = await window.pgdesk.metadata.explorer(connectionId);

      if (requestGenerationRef.current !== requestGeneration) {
        return;
      }

      if (result.ok) {
        setSchemas(result.schemas);
        setExplorerMessage(`Loaded ${result.schemas.length} schemas`);
        return;
      }

      setSchemas([]);
      setExplorerMessage(`Error: ${result.message}`);
    } catch (error) {
      if (requestGenerationRef.current !== requestGeneration) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      setSchemas([]);
      setExplorerMessage(`Error: ${message}`);
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        setIsLoadingExplorer(false);
      }
    }
  }, [connectionId]);

  return {
    schemas,
    explorerMessage,
    isLoadingExplorer,
    refreshExplorer,
  };
};
