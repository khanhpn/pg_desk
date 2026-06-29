import { useCallback, useEffect, useState } from "react";
import "@/App.css";
import type { PgRelationInfo } from "@/types/metadata";

// imports components
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { SqlEditor } from "@/components/SqlEditor";
import { Topbar } from "@/components/Topbar";
import { AppUpdateToast } from "@/components/AppUpdateToast";
import { TableContextMenu } from "@/components/TableContextMenu";
import { TableInspectorDrawer } from "@/components/TableInspectorDrawer";
import { useAppUpdate } from "@/hooks/useAppUpdate";

// imports hooks
import { useConnectionTest } from "@/hooks/useConnectionTest";
import { useIpcPing } from "@/hooks/useIpcPing";
import { useSqlQuery } from "@/hooks/useSqlQuery";
import { useDatabaseExplorer } from "@/hooks/useDatabaseExplorer";
import { useResizablePanels } from "@/hooks/useResizablePanels";
import { useTableInspector } from "@/hooks/useTableInspector";

const App = () => {
  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(
    null,
  );
  const {
    connectionForm,
    connectionProfiles,
    activeConnectionId,
    connectedConnectionIds,
    connectionMessage,
    isTestingConnection,
    isConnected,
    isConnectionModalOpen,
    updateConnectionField,
    openNewConnectionModal,
    editConnectionProfile,
    connectConnectionProfile,
    closeConnectionModal,
    handleConnect,
    handleDisconnect,
    selectConnectionProfile,
    deleteConnectionProfile,
  } = useConnectionTest({
    onActiveConnectionChanged: () => {
      setSelectedRelationKey(null);
    },
  });
  const { schemas, explorerMessage, isLoadingExplorer, refreshExplorer } =
    useDatabaseExplorer(activeConnectionId);

  const { ipcMessage, handlePing } = useIpcPing();

  const {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    tabs,
    activeTabId,
    isActiveTabDirty,
    createTab,
    selectTab,
    closeTab,
    saveActiveTab,
    formatActiveTabSql,
    handleRunQuery,
    handleOpenRelation,
  } = useSqlQuery(activeConnectionId);

  const {
    updateStatus,
    isUpdateToastVisible,
    handleDownloadUpdate,
    closeUpdateToast,
  } = useAppUpdate();

  const {
    appShellClassName,
    sidebarWidth,
    resultPanelHeight,
    handleSidebarResizeStart,
    handleResultPanelResizeStart,
  } = useResizablePanels();
  const {
    contextMenu,
    selectedTable,
    tableDetail,
    isLoadingTableDetail,
    tableDetailMessage,
    openTableContextMenu,
    closeTableContextMenu,
    openTableInspector,
    closeTableInspector,
    refreshTableInspector,
  } = useTableInspector(activeConnectionId);

  const handleSelectRelation = useCallback(
    async (relation: PgRelationInfo): Promise<void> => {
      setSelectedRelationKey(`${relation.schema}.${relation.name}`);
      await handleOpenRelation(relation.schema, relation.name);
    },
    [handleOpenRelation],
  );

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    void refreshExplorer();
  }, [isConnected, refreshExplorer]);

  return (
    <div className={appShellClassName}>
      <Sidebar
        sidebarWidth={sidebarWidth}
        connectionForm={connectionForm}
        connectionProfiles={connectionProfiles}
        activeConnectionId={activeConnectionId}
        connectedConnectionIds={connectedConnectionIds}
        connectionMessage={connectionMessage}
        isTestingConnection={isTestingConnection}
        isConnectionModalOpen={isConnectionModalOpen}
        updateConnectionField={updateConnectionField}
        openNewConnectionModal={openNewConnectionModal}
        editConnectionProfile={editConnectionProfile}
        connectConnectionProfile={connectConnectionProfile}
        closeConnectionModal={closeConnectionModal}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
        selectConnectionProfile={selectConnectionProfile}
        deleteConnectionProfile={deleteConnectionProfile}
        schemas={schemas}
        explorerMessage={explorerMessage}
        isLoadingExplorer={isLoadingExplorer}
        refreshExplorer={refreshExplorer}
        selectedRelationKey={selectedRelationKey}
        handleOpenRelation={handleSelectRelation}
        openTableContextMenu={openTableContextMenu}
      />

      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        onPointerDown={handleSidebarResizeStart}
      />

      <main className="workspace">
        <Topbar
          ipcMessage={ipcMessage}
          handlePing={handlePing}
          tabs={tabs}
          activeTabId={activeTabId}
          canCreateTab={isConnected}
          createTab={createTab}
          selectTab={selectTab}
          closeTab={closeTab}
        />

        <QueryToolbar
          isRunningQuery={isRunningQuery}
          isActiveTabDirty={isActiveTabDirty}
          queryMessage={queryMessage}
          handleRunQuery={handleRunQuery}
          formatActiveTabSql={formatActiveTabSql}
          saveActiveTab={saveActiveTab}
        />

        <SqlEditor
          sql={sql}
          setSql={setSql}
          handleRunQuery={handleRunQuery}
          saveActiveTab={saveActiveTab}
        />

        <div
          className="result-resize-handle"
          role="separator"
          aria-label="Resize query result panel"
          aria-orientation="horizontal"
          onPointerDown={handleResultPanelResizeStart}
        />

        <ResultPanel
          connectionId={activeConnectionId}
          queryResult={queryResult}
          queryMessage={queryMessage}
          panelHeight={resultPanelHeight}
        />
      </main>

      <AppUpdateToast
        updateStatus={updateStatus}
        isVisible={isUpdateToastVisible}
        handleDownloadUpdate={handleDownloadUpdate}
        closeUpdateToast={closeUpdateToast}
      />

      {contextMenu && (
        <TableContextMenu
          relation={contextMenu.relation}
          x={contextMenu.x}
          y={contextMenu.y}
          closeMenu={closeTableContextMenu}
          openTableInspector={openTableInspector}
        />
      )}

      <TableInspectorDrawer
        connectionId={activeConnectionId}
        relation={selectedTable}
        tableDetail={tableDetail}
        isLoading={isLoadingTableDetail}
        message={tableDetailMessage}
        closeDrawer={closeTableInspector}
        refreshTableInspector={refreshTableInspector}
      />
    </div>
  );
};

export default App;
