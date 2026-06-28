import { ConnectionModal } from "@/components/ConnectionModal";
import { ConnectionSummaryCard } from "@/components/ConnectionSummaryCard";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import type { CSSProperties } from "react";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";
import type { PgRelationInfo, PgSchemaInfo } from "@/types/metadata";

type SidebarProps = {
  sidebarWidth: number;
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isTestingConnection: boolean;
  isConnected: boolean;
  isConnectionModalOpen: boolean;
  hasSavedProfile: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  openConnectionModal: () => void;
  closeConnectionModal: () => void;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;

  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
  selectedRelationKey: string | null;
  handleOpenRelation: (relation: PgRelationInfo) => Promise<void>;
};

export const Sidebar = ({
  sidebarWidth,
  connectionForm,
  connectionMessage,
  isTestingConnection,
  isConnected,
  isConnectionModalOpen,
  hasSavedProfile,
  updateConnectionField,
  openConnectionModal,
  closeConnectionModal,
  handleConnect,
  handleDisconnect,

  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
  selectedRelationKey,
  handleOpenRelation,
}: SidebarProps) => {
  const sidebarStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <aside className="sidebar" style={sidebarStyle}>
      <div className="sidebar-header">
        <div>
          <div className="app-title">pgdesk</div>
          <div className="app-subtitle">PostgreSQL Client</div>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={openConnectionModal}
        >
          +
        </button>
      </div>

      <ConnectionSummaryCard
        connectionForm={connectionForm}
        connectionMessage={connectionMessage}
        isConnected={isConnected}
        hasSavedProfile={hasSavedProfile}
        openConnectionModal={openConnectionModal}
        handleDisconnect={handleDisconnect}
      />

      <DatabaseExplorer
        schemas={schemas}
        explorerMessage={explorerMessage}
        isLoadingExplorer={isLoadingExplorer}
        refreshExplorer={refreshExplorer}
        selectedRelationKey={selectedRelationKey}
        handleOpenRelation={handleOpenRelation}
      />

      <ConnectionModal
        isOpen={isConnectionModalOpen}
        connectionForm={connectionForm}
        connectionMessage={connectionMessage}
        isTestingConnection={isTestingConnection}
        updateConnectionField={updateConnectionField}
        closeConnectionModal={closeConnectionModal}
        handleConnect={handleConnect}
      />
    </aside>
  );
};
