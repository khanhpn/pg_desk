import { useState } from "react";
import "@/App.css";
import type { PgRelationInfo } from "@/types/metadata";

// imports components
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { SqlEditor } from "@/components/SqlEditor";
import { Topbar } from "@/components/Topbar";

// imports hooks
import { useConnectionTest } from "@/hooks/useConnectionTest";
import { useIpcPing } from "@/hooks/useIpcPing";
import { useSqlQuery } from "@/hooks/useSqlQuery";
import { useDatabaseExplorer } from "@/hooks/useDatabaseExplorer";

const App = () => {
  const { schemas, explorerMessage, isLoadingExplorer, refreshExplorer } =
    useDatabaseExplorer();

  const {
    connectionForm,
    connectionMessage,
    isTestingConnection,
    isConnected,
    isConnectionModalOpen,
    updateConnectionField,
    openConnectionModal,
    closeConnectionModal,
    handleConnect,
    handleDisconnect,
    hasSavedProfile,
  } = useConnectionTest({
    onConnected: refreshExplorer,
  });

  const { ipcMessage, handlePing } = useIpcPing();

  const {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    handleRunQuery,
    handleOpenRelation,
  } = useSqlQuery();

  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(
    null,
  );

  const handleSelectRelation = async (
    relation: PgRelationInfo,
  ): Promise<void> => {
    setSelectedRelationKey(`${relation.schema}.${relation.name}`);
    await handleOpenRelation(relation.schema, relation.name);
  };

  return (
    <div className="app-shell">
      <Sidebar
        connectionForm={connectionForm}
        connectionMessage={connectionMessage}
        isTestingConnection={isTestingConnection}
        isConnected={isConnected}
        isConnectionModalOpen={isConnectionModalOpen}
        hasSavedProfile={hasSavedProfile}
        updateConnectionField={updateConnectionField}
        openConnectionModal={openConnectionModal}
        closeConnectionModal={closeConnectionModal}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
        schemas={schemas}
        explorerMessage={explorerMessage}
        isLoadingExplorer={isLoadingExplorer}
        refreshExplorer={refreshExplorer}
        selectedRelationKey={selectedRelationKey}
        handleOpenRelation={handleSelectRelation}
      />

      <main className="workspace">
        <Topbar ipcMessage={ipcMessage} handlePing={handlePing} />

        <QueryToolbar
          isRunningQuery={isRunningQuery}
          queryMessage={queryMessage}
          handleRunQuery={handleRunQuery}
        />

        <SqlEditor sql={sql} setSql={setSql} handleRunQuery={handleRunQuery} />

        <ResultPanel queryResult={queryResult} queryMessage={queryMessage} />
      </main>
    </div>
  );
};

export default App;
