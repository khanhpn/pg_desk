import { useEffect, useMemo } from "react";
import "@/App.css";

// imports components
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { SqlEditor } from "@/components/SqlEditor";
import { Topbar } from "@/components/Topbar";
import { AppUpdateToast } from "@/components/AppUpdateToast";
import { DatabaseMaintenanceToast } from "@/components/DatabaseMaintenanceToast";
import { TableContextMenu } from "@/components/TableContextMenu";
import { TableInspectorDrawer } from "@/components/TableInspectorDrawer";
import { ServerDatabaseMaintenanceModal } from "@/components/ServerDatabaseMaintenanceModal";
import { useAppUpdate } from "@/hooks/useAppUpdate";

// imports hooks
import { useConnectionTest } from "@/hooks/useConnectionTest";
import { useSqlQuery } from "@/hooks/useSqlQuery";
import { useDatabaseExplorer } from "@/hooks/useDatabaseExplorer";
import { useResizablePanels } from "@/hooks/useResizablePanels";
import { useTableInspector } from "@/hooks/useTableInspector";
import { useDatabaseMaintenance } from "@/hooks/useDatabaseMaintenance";
import { useRelationSelection } from "@/hooks/useRelationSelection";

const App = () => {
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
  } = useConnectionTest();
  const { schemas, explorerMessage, isLoadingExplorer, refreshExplorer } =
    useDatabaseExplorer(activeConnectionId);

  const {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    selectLimit,
    tabs,
    activeTabId,
    isActiveTabDirty,
    setSelectLimit,
    createTab,
    selectTab,
    closeTab,
    saveActiveTab,
    formatActiveTabSql,
    handleExplainQuery,
    handleRunQuery,
    handleStopQuery,
    handleOpenRelation,
  } = useSqlQuery(activeConnectionId);
  const { selectedRelationKey, handleSelectRelation } = useRelationSelection(
    activeConnectionId,
    handleOpenRelation,
  );
  const {
    databaseMaintenanceToast,
    databaseTaskConnectionId,
    serverMaintenanceModal,
    closeDatabaseMaintenanceToast,
    closeServerMaintenanceModal,
    selectAllServerDatabases,
    clearServerDatabaseSelection,
    toggleServerDatabase,
    chooseServerBackupFolder,
    handleBackupServerDatabases,
    chooseServerRestoreFiles,
    toggleRestoreFile,
    updateRestoreTargetDatabase,
    handleRestoreServerDatabases,
    handleBackupDatabase,
    handleRestoreDatabase,
  } = useDatabaseMaintenance({
    refreshExplorer,
    activeConnectionId,
    connectedConnectionIds,
  });

  const {
    updateStatus,
    isUpdateToastVisible,
    handleDownloadUpdate,
    handleInstallUpdate,
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

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    void refreshExplorer();
  }, [isConnected, refreshExplorer]);

  const activeConnectionLabel = useMemo(() => {
    const activeProfile = connectionProfiles.find((profile) => {
      return profile.id === activeConnectionId;
    });

    if (!activeProfile) {
      return "No active connection";
    }

    return `${activeProfile.name} · ${activeProfile.user}@${activeProfile.host}/${activeProfile.database}`;
  }, [activeConnectionId, connectionProfiles]);

  return (
    <div className={appShellClassName}>
      <Sidebar
        sidebarWidth={sidebarWidth}
        connectionForm={connectionForm}
        connectionProfiles={connectionProfiles}
        activeConnectionId={activeConnectionId}
        connectedConnectionIds={connectedConnectionIds}
        connectionMessage={connectionMessage}
        databaseTaskConnectionId={databaseTaskConnectionId}
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
        handleBackupDatabase={handleBackupDatabase}
        handleRestoreDatabase={handleRestoreDatabase}
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
          selectLimit={selectLimit}
          queryMessage={queryMessage}
          handleRunQuery={handleRunQuery}
          handleStopQuery={handleStopQuery}
          handleExplainQuery={handleExplainQuery}
          formatActiveTabSql={formatActiveTabSql}
          saveActiveTab={saveActiveTab}
          setSelectLimit={setSelectLimit}
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
          refreshResult={handleRunQuery}
        />
      </main>

      <AppUpdateToast
        updateStatus={updateStatus}
        isVisible={isUpdateToastVisible}
        handleDownloadUpdate={handleDownloadUpdate}
        handleInstallUpdate={handleInstallUpdate}
        closeUpdateToast={closeUpdateToast}
      />

      <DatabaseMaintenanceToast
        toast={databaseMaintenanceToast}
        closeToast={closeDatabaseMaintenanceToast}
      />

      <ServerDatabaseMaintenanceModal
        modal={serverMaintenanceModal}
        connectionLabel={activeConnectionLabel}
        closeModal={closeServerMaintenanceModal}
        selectAllDatabases={selectAllServerDatabases}
        clearDatabaseSelection={clearServerDatabaseSelection}
        toggleDatabase={toggleServerDatabase}
        chooseBackupFolder={chooseServerBackupFolder}
        runBackup={handleBackupServerDatabases}
        chooseRestoreFiles={chooseServerRestoreFiles}
        toggleRestoreFile={toggleRestoreFile}
        updateRestoreTargetDatabase={updateRestoreTargetDatabase}
        runRestore={handleRestoreServerDatabases}
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
