import { useCallback, useState } from "react";
import "@/App.css";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PgRelationInfo } from "@/types/metadata";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 280;
const RESULT_PANEL_MIN_HEIGHT = 180;
const RESULT_PANEL_MAX_HEIGHT = 560;
const RESULT_PANEL_DEFAULT_HEIGHT = 260;

// imports components
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { SqlEditor } from "@/components/SqlEditor";
import { Topbar } from "@/components/Topbar";
import { AppUpdateToast } from "@/components/AppUpdateToast";
import { useAppUpdate } from "@/hooks/useAppUpdate";

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

  const {
    updateStatus,
    isUpdateToastVisible,
    handleDownloadUpdate,
    closeUpdateToast,
  } = useAppUpdate();

  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [resultPanelHeight, setResultPanelHeight] = useState(
    RESULT_PANEL_DEFAULT_HEIGHT,
  );
  const [resizeMode, setResizeMode] = useState<"sidebar" | "result" | null>(
    null,
  );

  const handleSidebarResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setResizeMode("sidebar");

      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setSidebarWidth(
          clamp(
            startWidth + moveEvent.clientX - startX,
            SIDEBAR_MIN_WIDTH,
            SIDEBAR_MAX_WIDTH,
          ),
        );
      };

      const handlePointerUp = () => {
        setResizeMode(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [sidebarWidth],
  );

  const handleResultPanelResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setResizeMode("result");

      const startY = event.clientY;
      const startHeight = resultPanelHeight;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setResultPanelHeight(
          clamp(
            startHeight + startY - moveEvent.clientY,
            RESULT_PANEL_MIN_HEIGHT,
            RESULT_PANEL_MAX_HEIGHT,
          ),
        );
      };

      const handlePointerUp = () => {
        setResizeMode(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [resultPanelHeight],
  );

  const handleSelectRelation = async (
    relation: PgRelationInfo,
  ): Promise<void> => {
    setSelectedRelationKey(`${relation.schema}.${relation.name}`);
    await handleOpenRelation(relation.schema, relation.name);
  };

  return (
    <div
      className={
        resizeMode ? `app-shell is-resizing-${resizeMode}` : "app-shell"
      }
    >
      <Sidebar
        sidebarWidth={sidebarWidth}
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

      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        onPointerDown={handleSidebarResizeStart}
      />

      <main className="workspace">
        <Topbar ipcMessage={ipcMessage} handlePing={handlePing} />

        <QueryToolbar
          isRunningQuery={isRunningQuery}
          queryMessage={queryMessage}
          handleRunQuery={handleRunQuery}
        />

        <SqlEditor sql={sql} setSql={setSql} handleRunQuery={handleRunQuery} />

        <div
          className="result-resize-handle"
          role="separator"
          aria-label="Resize query result panel"
          aria-orientation="horizontal"
          onPointerDown={handleResultPanelResizeStart}
        />

        <ResultPanel
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
    </div>
  );
};

export default App;
