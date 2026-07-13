import type { QueryTab } from "@/hooks/useSqlQuery";

type TopbarProps = {
  tabs: QueryTab[];
  activeTabId: string;
  canCreateTab: boolean;
  createTab: () => void;
  selectTab: (tabId: string) => void | Promise<void>;
  closeTab: (tabId: string) => void;
};

/**
 * Renders query tabs and exposes tab creation, activation, and close actions.
 *
 * @param props - Query-tab state and callbacks supplied by the query workspace.
 * @returns The query workspace tab strip.
 */
export const Topbar = ({
  tabs,
  activeTabId,
  canCreateTab,
  createTab,
  selectTab,
  closeTab,
}: TopbarProps): JSX.Element => {
  const canCloseTabs = tabs.length > 1;

  return (
    <header className="topbar">
      <div className="tabs" role="tablist" aria-label="Query tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div className={isActive ? "tab active" : "tab"} key={tab.id}>
              <button
                aria-selected={isActive}
                className="tab-main"
                onClick={() => {
                  void selectTab(tab.id);
                }}
                role="tab"
                type="button"
              >
                <span
                  className={
                    tab.isRunningQuery ? "tab-status running" : "tab-status"
                  }
                />
                {tab.isDirty && <span className="tab-dirty">*</span>}
                <span className="tab-title">{tab.title}</span>
              </button>

              {canCloseTabs && (
                <button
                  aria-label={`Close ${tab.title}`}
                  className="tab-close"
                  onClick={() => {
                    closeTab(tab.id);
                  }}
                  type="button"
                >
                  x
                </button>
              )}
            </div>
          );
        })}

        <button
          aria-label="New query tab"
          className="new-tab"
          disabled={!canCreateTab}
          onClick={createTab}
          title={
            canCreateTab
              ? "New query tab"
              : "Connect to a database before creating a new tab"
          }
          type="button"
        >
          +
        </button>
      </div>
    </header>
  );
};
