import { useCallback, useEffect, useState } from "react";
import type { PgRelationInfo } from "@/types/metadata";

type OpenRelationHandler = (
  schemaName: string,
  relationName: string,
) => Promise<void>;

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
