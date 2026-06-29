import { useCallback, useState } from "react";
import type { PgSchemaInfo } from "@/types/metadata";

export const useDatabaseExplorer = (connectionId: string | null) => {
  const [schemas, setSchemas] = useState<PgSchemaInfo[]>([]);
  const [explorerMessage, setExplorerMessage] = useState("Not loaded");
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);

  const refreshExplorer = useCallback(async (): Promise<void> => {
    if (!connectionId) {
      setSchemas([]);
      setExplorerMessage("Select a connection");
      return;
    }

    setIsLoadingExplorer(true);
    setExplorerMessage("Loading explorer...");

    try {
      const result = await window.pgdesk.metadata.explorer(connectionId);

      if (result.ok) {
        setSchemas(result.schemas);
        setExplorerMessage(`Loaded ${result.schemas.length} schemas`);
        return;
      }

      setSchemas([]);
      setExplorerMessage(`Error: ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setSchemas([]);
      setExplorerMessage(`Error: ${message}`);
    } finally {
      setIsLoadingExplorer(false);
    }
  }, [connectionId]);

  return {
    schemas,
    explorerMessage,
    isLoadingExplorer,
    refreshExplorer,
  };
};
