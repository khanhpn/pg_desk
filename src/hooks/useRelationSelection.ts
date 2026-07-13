import { useCallback, useEffect, useState } from "react";
import type { PgRelationInfo } from "@/types/metadata";

type OpenRelationHandler = (
  schemaName: string,
  relationName: string,
) => Promise<void>;

/**
 * Tracks the selected explorer relation and opens it in the query workspace.
 *
 * @param activeConnectionId - Connection that owns the explorer selection.
 * @param handleOpenRelation - Async command used to generate and run relation SQL.
 * @returns The selected relation key and a relation-selection handler.
 */
export const useRelationSelection = (
  activeConnectionId: string | null,
  handleOpenRelation: OpenRelationHandler,
) => {
  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(
    null,
  );

  const clearSelectedRelation = useCallback((): void => {
    setSelectedRelationKey(null);
  }, []);

  const handleSelectRelation = useCallback(
    async (relation: PgRelationInfo): Promise<void> => {
      setSelectedRelationKey(`${relation.schema}.${relation.name}`);
      await handleOpenRelation(relation.schema, relation.name);
    },
    [handleOpenRelation],
  );

  useEffect(() => {
    clearSelectedRelation();
  }, [activeConnectionId, clearSelectedRelation]);

  return {
    selectedRelationKey,
    handleSelectRelation,
  };
};
