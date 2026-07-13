import { useCallback } from "react";
import type { QueryTab } from "@/hooks/useSqlQuery";

type UseQueryTabConnectionOptions = {
  tabs: QueryTab[];
  activeTabId: string;
  activeConnectionId: string | null;
  switchConnection: (connectionId: string) => Promise<void>;
  selectTab: (tabId: string) => void;
  setTabConnection: (tabId: string, connectionId: string | null) => void;
};

/**
 * Synchronizes query-tab activation with the connection remembered by each tab.
 *
 * @param options - Query tabs, active identifiers, the low-level connection
 * switch command, and tab state mutation callbacks.
 * @returns Commands for selecting a tab with its connection restored and for
 * recording a manually selected connection on the active tab.
 * @remarks A tab's connection is switched before that tab becomes active so a
 * query cannot run against the previously active database during the transition.
 */
export const useQueryTabConnection = ({
  tabs,
  activeTabId,
  activeConnectionId,
  switchConnection,
  selectTab,
  setTabConnection,
}: UseQueryTabConnectionOptions) => {
  const selectQueryTab = useCallback(
    async (tabId: string): Promise<void> => {
      const tab = tabs.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      if (tab.connectionId && tab.connectionId !== activeConnectionId) {
        await switchConnection(tab.connectionId);
      }

      selectTab(tabId);
    },
    [activeConnectionId, selectTab, switchConnection, tabs],
  );

  const selectConnectionForActiveTab = useCallback(
    async (connectionId: string): Promise<void> => {
      await switchConnection(connectionId);

      setTabConnection(activeTabId, connectionId);
    },
    [activeTabId, setTabConnection, switchConnection],
  );

  return {
    selectQueryTab,
    selectConnectionForActiveTab,
  };
};
