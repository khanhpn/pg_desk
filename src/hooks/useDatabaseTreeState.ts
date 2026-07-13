import { useCallback, useState } from "react";

type RelationGroup = "tables" | "views";

const buildGroupKey = (schemaName: string, group: RelationGroup): string => {
  return `${schemaName}.${group}`;
};

/**
 * Owns expanded and collapsed state for schemas and relation groups.
 *
 * @returns Collapse predicates and toggle commands keyed by schema and group.
 */
export const useDatabaseTreeState = () => {
  const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleSchema = useCallback((schemaName: string): void => {
    setCollapsedSchemas((current) => {
      const next = new Set(current);

      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }

      return next;
    });
  }, []);

  const toggleGroup = useCallback(
    (schemaName: string, group: RelationGroup): void => {
      const groupKey = buildGroupKey(schemaName, group);

      setCollapsedGroups((current) => {
        const next = new Set(current);

        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }

        return next;
      });
    },
    [],
  );

  const isSchemaExpanded = useCallback(
    (schemaName: string): boolean => {
      return !collapsedSchemas.has(schemaName);
    },
    [collapsedSchemas],
  );

  const isGroupExpanded = useCallback(
    (schemaName: string, group: RelationGroup): boolean => {
      return !collapsedGroups.has(buildGroupKey(schemaName, group));
    },
    [collapsedGroups],
  );

  return {
    isSchemaExpanded,
    isGroupExpanded,
    toggleSchema,
    toggleGroup,
  };
};
