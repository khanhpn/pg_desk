import { useCallback, useRef, useState } from "react";
import { buildSelectRelationSql } from "@/utils/sql";
import { formatSql } from "@/utils/sqlFormatter";
import type { QueryRunResult } from "@electron/types/query";

export type QueryTab = {
  id: string;
  title: string;
  sql: string;
  savedSql: string | null;
  isDirty: boolean;
  queryResult: QueryRunResult | null;
  queryMessage: string;
  isRunningQuery: boolean;
};

type PersistedQueryTab = {
  id: string;
  title: string;
  sql: string;
};

type PersistedQueryWorkspace = {
  tabs: PersistedQueryTab[];
  activeTabId: string;
  nextTabIndex: number;
};

const queryWorkspaceStorageKey = "pgdesk.queryWorkspace";

const defaultSql = `select
  current_database() as database,
  current_user as user,
  now() as current_time;`;

const createQueryTab = (index: number, sql = defaultSql): QueryTab => ({
  id: `query-${index}`,
  title: `Query ${index}`,
  sql,
  savedSql: sql,
  isDirty: false,
  queryResult: null,
  queryMessage: "Ready",
  isRunningQuery: false,
});

const createUnsavedQueryTab = (index: number): QueryTab => ({
  id: `query-${index}`,
  title: `Query ${index}`,
  sql: "",
  savedSql: null,
  isDirty: true,
  queryResult: null,
  queryMessage: "Ready",
  isRunningQuery: false,
});

const getNextTabIndex = (tabs: Array<{ id: string }>): number => {
  const maxIndex = tabs.reduce((max, tab) => {
    const [, indexValue] = tab.id.split("-");
    const index = Number(indexValue);

    return Number.isFinite(index) ? Math.max(max, index) : max;
  }, 0);

  return maxIndex + 1;
};

const readPersistedWorkspace = (): PersistedQueryWorkspace | null => {
  try {
    const rawWorkspace = window.localStorage.getItem(queryWorkspaceStorageKey);

    if (!rawWorkspace) {
      return null;
    }

    const workspace = JSON.parse(rawWorkspace) as PersistedQueryWorkspace;

    if (!Array.isArray(workspace.tabs) || workspace.tabs.length === 0) {
      return null;
    }

    return workspace;
  } catch {
    return null;
  }
};

const writePersistedWorkspace = (
  tabs: QueryTab[],
  activeTabId: string,
  nextTabIndex: number,
): void => {
  const workspace: PersistedQueryWorkspace = {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      sql: tab.savedSql ?? "",
    })),
    activeTabId,
    nextTabIndex,
  };

  window.localStorage.setItem(
    queryWorkspaceStorageKey,
    JSON.stringify(workspace),
  );
};

const createInitialQueryWorkspaceState = (): {
  tabs: QueryTab[];
  activeTabId: string;
  nextTabIndex: number;
} => {
  const persistedWorkspace = readPersistedWorkspace();
  const tabs = persistedWorkspace?.tabs.map((tab) => ({
    ...createQueryTab(Number(tab.id.split("-")[1]) || 1, tab.sql),
    id: tab.id,
    title: tab.title,
  })) ?? [createQueryTab(1)];
  const activeTabId = tabs.some(
    (tab) => tab.id === persistedWorkspace?.activeTabId,
  )
    ? (persistedWorkspace?.activeTabId ?? tabs[0].id)
    : tabs[0].id;
  const nextTabIndex = Math.max(
    persistedWorkspace?.nextTabIndex ?? 2,
    getNextTabIndex(tabs),
  );

  return {
    tabs,
    activeTabId,
    nextTabIndex,
  };
};

export const useSqlQuery = (connectionId: string | null) => {
  const [initialWorkspace] = useState(createInitialQueryWorkspaceState);
  const nextTabIndexRef = useRef(initialWorkspace.nextTabIndex);
  const [tabs, setTabs] = useState<QueryTab[]>(initialWorkspace.tabs);
  const [activeTabId, setActiveTabId] = useState(initialWorkspace.activeTabId);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback(
    (tabId: string, updater: (tab: QueryTab) => QueryTab): void => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
      );
    },
    [],
  );

  const setSql = useCallback(
    (nextSql: string): void => {
      updateTab(activeTab.id, (tab) => ({
        ...tab,
        sql: nextSql,
        isDirty: tab.savedSql === null || nextSql !== tab.savedSql,
      }));
    },
    [activeTab.id, updateTab],
  );

  const createTab = useCallback((): void => {
    const nextIndex = nextTabIndexRef.current;
    nextTabIndexRef.current += 1;

    const nextTab = createUnsavedQueryTab(nextIndex);

    setTabs((currentTabs) => [...currentTabs, nextTab]);
    setActiveTabId(nextTab.id);
  }, []);

  const selectTab = useCallback((tabId: string): void => {
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback(
    (tabId: string): void => {
      if (tabs.length <= 1) {
        return;
      }

      const closingTabIndex = tabs.findIndex((tab) => tab.id === tabId);

      if (closingTabIndex === -1) {
        return;
      }

      const nextTabs = tabs.filter((tab) => tab.id !== tabId);
      const nextActiveTabId =
        activeTabId === tabId
          ? nextTabs[Math.min(closingTabIndex, nextTabs.length - 1)].id
          : activeTabId;

      setTabs(nextTabs);
      setActiveTabId(nextActiveTabId);
      writePersistedWorkspace(
        nextTabs,
        nextActiveTabId,
        nextTabIndexRef.current,
      );
    },
    [activeTabId, tabs],
  );

  const runSqlText = useCallback(
    async (tabId: string, nextSql: string): Promise<void> => {
      updateTab(tabId, (tab) => ({
        ...tab,
        isRunningQuery: true,
        queryMessage: "Running query...",
      }));

      try {
        const result = await window.pgdesk.query.run(nextSql, connectionId);

        updateTab(tabId, (tab) => ({
          ...tab,
          queryResult: result,
          queryMessage: result.ok
            ? `${result.command ?? "QUERY"} · ${result.rowCount} rows · ${result.durationMs}ms`
            : `Error: ${result.message}`,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        updateTab(tabId, (tab) => ({
          ...tab,
          queryMessage: `Error: ${message}`,
        }));
      } finally {
        updateTab(tabId, (tab) => ({
          ...tab,
          isRunningQuery: false,
        }));
      }
    },
    [connectionId, updateTab],
  );

  const handleRunQuery = useCallback(async (): Promise<void> => {
    await runSqlText(activeTab.id, activeTab.sql);
  }, [activeTab.id, activeTab.sql, runSqlText]);

  const handleExplainQuery = useCallback(async (): Promise<void> => {
    updateTab(activeTab.id, (tab) => ({
      ...tab,
      isRunningQuery: true,
      queryMessage: "Generating query plan...",
    }));

    try {
      const result = await window.pgdesk.query.explain(
        activeTab.sql,
        connectionId,
      );

      updateTab(activeTab.id, (tab) => ({
        ...tab,
        queryResult: result,
        queryMessage: result.ok
          ? `EXPLAIN · ${result.rowCount} plan nodes · ${result.durationMs}ms`
          : `Error: ${result.message}`,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      updateTab(activeTab.id, (tab) => ({
        ...tab,
        queryMessage: `Error: ${message}`,
      }));
    } finally {
      updateTab(activeTab.id, (tab) => ({
        ...tab,
        isRunningQuery: false,
      }));
    }
  }, [activeTab.id, activeTab.sql, connectionId, updateTab]);

  const formatActiveTabSql = useCallback((): void => {
    const formattedSql = formatSql(activeTab.sql);

    updateTab(activeTab.id, (tab) => ({
      ...tab,
      sql: formattedSql,
      isDirty: tab.savedSql === null || formattedSql !== tab.savedSql,
      queryMessage:
        formattedSql === activeTab.sql
          ? "SQL already formatted"
          : "SQL formatted",
    }));
  }, [activeTab.id, activeTab.sql, updateTab]);

  const handleOpenRelation = useCallback(
    async (schema: string, relation: string): Promise<void> => {
      const nextSql = buildSelectRelationSql(schema, relation, 100);
      const tabId = activeTab.id;

      updateTab(tabId, (tab) => ({
        ...tab,
        title: relation,
        sql: nextSql,
        isDirty: tab.savedSql === null || nextSql !== tab.savedSql,
      }));

      await runSqlText(tabId, nextSql);
    },
    [activeTab.id, runSqlText, updateTab],
  );

  const saveActiveTab = useCallback((): void => {
    const nextTabs = tabs.map((tab) => {
      if (tab.id !== activeTab.id) {
        return tab;
      }

      return {
        ...tab,
        savedSql: tab.sql,
        isDirty: false,
        queryMessage: "Tab saved",
      };
    });

    setTabs(nextTabs);
    writePersistedWorkspace(nextTabs, activeTab.id, nextTabIndexRef.current);
  }, [activeTab.id, tabs]);

  return {
    tabs,
    activeTabId,
    sql: activeTab.sql,
    setSql,
    queryResult: activeTab.queryResult,
    queryMessage: activeTab.queryMessage,
    isRunningQuery: activeTab.isRunningQuery,
    isActiveTabDirty: activeTab.isDirty,
    createTab,
    selectTab,
    closeTab,
    saveActiveTab,
    formatActiveTabSql,
    handleExplainQuery,
    handleRunQuery,
    handleOpenRelation,
  };
};
