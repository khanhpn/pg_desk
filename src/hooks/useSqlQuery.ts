import { useCallback, useRef, useState } from "react";
import { buildSelectRelationSql } from "@/utils/sql";
import { applySelectLimit, type QueryLimit } from "@/utils/queryLimit";
import { formatSql } from "@/utils/sqlFormatter";
import type { QueryRunResult } from "@electron/types/query";

export type QueryTab = {
  id: string;
  connectionId: string | null;
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
  connectionId?: string | null;
  title: string;
  sql: string;
};

type PersistedQueryWorkspace = {
  tabs: PersistedQueryTab[];
  activeTabId: string;
  nextTabIndex: number;
};

type ActiveQueryRun = {
  requestId: string;
  connectionId: string | null;
};

const queryWorkspaceStorageKey = "pgdesk.queryWorkspace";

const defaultSql = `select
  current_database() as database,
  current_user as user,
  now() as current_time;`;

const createQueryTab = (
  index: number,
  sql = defaultSql,
  connectionId: string | null = null,
): QueryTab => ({
  id: `query-${index}`,
  connectionId,
  title: `Query ${index}`,
  sql,
  savedSql: sql,
  isDirty: false,
  queryResult: null,
  queryMessage: "Ready",
  isRunningQuery: false,
});

const createUnsavedQueryTab = (
  index: number,
  connectionId: string | null,
): QueryTab => ({
  id: `query-${index}`,
  connectionId,
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

    const workspace: unknown = JSON.parse(rawWorkspace);

    if (!isPersistedQueryWorkspace(workspace)) {
      return null;
    }

    return workspace;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isPersistedQueryTab = (value: unknown): value is PersistedQueryTab => {
  if (!isRecord(value)) {
    return false;
  }

  const connectionId = value.connectionId;

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.sql === "string" &&
    (connectionId === undefined ||
      connectionId === null ||
      typeof connectionId === "string")
  );
};

const isPersistedQueryWorkspace = (
  value: unknown,
): value is PersistedQueryWorkspace => {
  if (!isRecord(value) || !Array.isArray(value.tabs)) {
    return false;
  }

  if (
    value.tabs.length === 0 ||
    !value.tabs.every(isPersistedQueryTab) ||
    typeof value.activeTabId !== "string" ||
    !Number.isInteger(value.nextTabIndex) ||
    (value.nextTabIndex as number) < 1
  ) {
    return false;
  }

  return value.tabs.some((tab) => tab.id === value.activeTabId);
};

const writePersistedWorkspace = (
  tabs: QueryTab[],
  activeTabId: string,
  nextTabIndex: number,
): void => {
  const workspace: PersistedQueryWorkspace = {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      connectionId: tab.connectionId,
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

const createInitialQueryWorkspaceState = (
  connectionId: string | null,
): {
  tabs: QueryTab[];
  activeTabId: string;
  nextTabIndex: number;
} => {
  const persistedWorkspace = readPersistedWorkspace();
  const tabs = persistedWorkspace?.tabs.map((tab) => ({
    ...createQueryTab(
      Number(tab.id.split("-")[1]) || 1,
      tab.sql,
      tab.connectionId ?? connectionId,
    ),
    id: tab.id,
    title: tab.title,
  })) ?? [createQueryTab(1, defaultSql, connectionId)];
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

/**
 * Owns the SQL query workspace, including tab persistence, editor state, query
 * execution, cancellation, formatting, and explain operations.
 *
 * @param connectionId - Active connection used by query operations and captured
 * as the initial context for newly created tabs.
 * @returns Query-tab state and commands consumed by the editor, toolbar, and
 * result panel.
 * @remarks Saved tab content and connection context are persisted to local
 * storage. Query requests are sent through the Electron preload bridge.
 */
export const useSqlQuery = (connectionId: string | null) => {
  const [initialWorkspace] = useState(() =>
    createInitialQueryWorkspaceState(connectionId),
  );
  const nextTabIndexRef = useRef(initialWorkspace.nextTabIndex);
  const activeRunsByTabIdRef = useRef<Map<string, ActiveQueryRun>>(new Map());
  const [tabs, setTabs] = useState<QueryTab[]>(initialWorkspace.tabs);
  const [activeTabId, setActiveTabId] = useState(initialWorkspace.activeTabId);
  const [selectLimit, setSelectLimit] = useState<QueryLimit>(100);
  const [selectedSqlByTabId, setSelectedSqlByTabId] = useState<
    Record<string, string>
  >({});

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const queryConnectionId = activeTab.connectionId ?? connectionId;

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

  const setSqlSelection = useCallback(
    (selection: string): void => {
      const normalizedSelection = selection.trim();

      setSelectedSqlByTabId((currentSelections) => {
        if (!normalizedSelection) {
          if (!(activeTab.id in currentSelections)) {
            return currentSelections;
          }

          const nextSelections = { ...currentSelections };
          delete nextSelections[activeTab.id];
          return nextSelections;
        }

        return {
          ...currentSelections,
          [activeTab.id]: selection,
        };
      });
    },
    [activeTab.id],
  );

  const createTab = useCallback((): void => {
    const nextIndex = nextTabIndexRef.current;
    nextTabIndexRef.current += 1;

    const nextTab = createUnsavedQueryTab(nextIndex, connectionId);

    setTabs((currentTabs) => [...currentTabs, nextTab]);
    setActiveTabId(nextTab.id);
  }, [connectionId]);

  const setTabConnection = useCallback(
    (tabId: string, nextConnectionId: string | null): void => {
      updateTab(tabId, (tab) => ({
        ...tab,
        connectionId: nextConnectionId,
      }));
    },
    [updateTab],
  );

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
    async (
      tabId: string,
      nextSql: string,
      runConnectionId: string | null,
      options: { applyLimit?: boolean } = {},
    ): Promise<void> => {
      if (activeRunsByTabIdRef.current.has(tabId)) {
        return;
      }

      const requestId = crypto.randomUUID();
      const sqlToRun =
        options.applyLimit === false
          ? nextSql
          : applySelectLimit(nextSql, selectLimit);

      const activeRun: ActiveQueryRun = {
        requestId,
        connectionId: runConnectionId,
      };

      activeRunsByTabIdRef.current.set(tabId, activeRun);

      updateTab(tabId, (tab) => ({
        ...tab,
        isRunningQuery: true,
        queryMessage: "Running query...",
      }));

      try {
        const result = await window.pgdesk.query.run(
          sqlToRun,
          runConnectionId,
          requestId,
        );

        if (activeRunsByTabIdRef.current.get(tabId)?.requestId === requestId) {
          updateTab(tabId, (tab) => ({
            ...tab,
            queryResult: result,
            queryMessage: result.ok
              ? `${result.command ?? "QUERY"} · ${result.rowCount} rows · ${result.durationMs}ms`
              : `Error: ${result.message}`,
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (activeRunsByTabIdRef.current.get(tabId)?.requestId === requestId) {
          updateTab(tabId, (tab) => ({
            ...tab,
            queryMessage: `Error: ${message}`,
          }));
        }
      } finally {
        if (activeRunsByTabIdRef.current.get(tabId)?.requestId === requestId) {
          activeRunsByTabIdRef.current.delete(tabId);
          updateTab(tabId, (tab) => ({
            ...tab,
            isRunningQuery: false,
          }));
        }
      }
    },
    [selectLimit, updateTab],
  );

  const handleRunQuery = useCallback(async (): Promise<void> => {
    const selectedSql = selectedSqlByTabId[activeTab.id];
    const sqlToRun = selectedSql?.trim() ? selectedSql : activeTab.sql;

    await runSqlText(activeTab.id, sqlToRun, queryConnectionId);
  }, [
    activeTab.id,
    activeTab.sql,
    queryConnectionId,
    runSqlText,
    selectedSqlByTabId,
  ]);

  const handleStopQuery = useCallback(async (): Promise<void> => {
    const activeRun = activeRunsByTabIdRef.current.get(activeTab.id);

    if (!activeRun?.connectionId) {
      updateTab(activeTab.id, (tab) => ({
        ...tab,
        queryMessage: "No running query to stop",
      }));
      return;
    }

    updateTab(activeTab.id, (tab) => ({
      ...tab,
      queryMessage: "Cancelling query...",
    }));

    try {
      const result = await window.pgdesk.query.cancel(
        activeRun.connectionId,
        activeRun.requestId,
      );

      if (!result.ok) {
        updateTab(activeTab.id, (tab) => ({
          ...tab,
          queryMessage: `Stop failed: ${result.message}`,
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      updateTab(activeTab.id, (tab) => ({
        ...tab,
        queryMessage: `Stop failed: ${message}`,
      }));
    }
  }, [activeTab.id, updateTab]);

  const handleExplainQuery = useCallback(async (): Promise<void> => {
    updateTab(activeTab.id, (tab) => ({
      ...tab,
      isRunningQuery: true,
      queryMessage: "Generating query plan...",
    }));

    try {
      const result = await window.pgdesk.query.explain(
        activeTab.sql,
        queryConnectionId,
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
  }, [activeTab.id, activeTab.sql, queryConnectionId, updateTab]);

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
      const nextSql = buildSelectRelationSql(schema, relation, selectLimit);
      const tabId = activeTab.id;

      updateTab(tabId, (tab) => ({
        ...tab,
        title: relation,
        sql: nextSql,
        isDirty: tab.savedSql === null || nextSql !== tab.savedSql,
      }));

      await runSqlText(tabId, nextSql, queryConnectionId, {
        applyLimit: false,
      });
    },
    [activeTab.id, queryConnectionId, runSqlText, selectLimit, updateTab],
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
    queryConnectionId,
    sql: activeTab.sql,
    setSql,
    setSqlSelection,
    hasSqlSelection: Boolean(selectedSqlByTabId[activeTab.id]?.trim()),
    queryResult: activeTab.queryResult,
    queryMessage: activeTab.queryMessage,
    isRunningQuery: activeTab.isRunningQuery,
    isActiveTabDirty: activeTab.isDirty,
    selectLimit,
    setSelectLimit,
    createTab,
    setTabConnection,
    selectTab,
    closeTab,
    saveActiveTab,
    formatActiveTabSql,
    handleExplainQuery,
    handleRunQuery,
    handleStopQuery,
    handleOpenRelation,
  };
};
