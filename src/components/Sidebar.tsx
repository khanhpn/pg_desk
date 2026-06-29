import { ConnectionModal } from "@/components/ConnectionModal";
import { ConnectionSummaryCard } from "@/components/ConnectionSummaryCard";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";
import type { PgConnectionProfile } from "@/types/connection";
import type { PgRelationInfo, PgSchemaInfo } from "@/types/metadata";

type SidebarProps = {
  sidebarWidth: number;
  connectionForm: PgConnectionForm;
  connectionProfiles: PgConnectionProfile[];
  activeConnectionId: string | null;
  connectedConnectionIds: string[];
  connectionMessage: string;
  isTestingConnection: boolean;
  isConnectionModalOpen: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  openNewConnectionModal: () => void;
  editConnectionProfile: (profile: PgConnectionProfile) => void;
  connectConnectionProfile: (profile: PgConnectionProfile) => Promise<void>;
  closeConnectionModal: () => void;
  handleConnect: () => Promise<void>;
  handleDisconnect: (connectionId?: string | null) => Promise<void>;
  selectConnectionProfile: (connectionId: string) => Promise<void>;
  deleteConnectionProfile: (connectionId: string) => Promise<void>;

  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
  selectedRelationKey: string | null;
  handleOpenRelation: (relation: PgRelationInfo) => Promise<void>;
  openTableContextMenu: (
    relation: PgRelationInfo,
    x: number,
    y: number,
  ) => void;
};

export const Sidebar = ({
  sidebarWidth,
  connectionForm,
  connectionProfiles,
  activeConnectionId,
  connectedConnectionIds,
  connectionMessage,
  isTestingConnection,
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

  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
  selectedRelationKey,
  handleOpenRelation,
  openTableContextMenu,
}: SidebarProps) => {
  const sidebarStyle = useMemo(
    () =>
      ({
        "--sidebar-width": `${sidebarWidth}px`,
      }) as CSSProperties,
    [sidebarWidth],
  );

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
          onClick={openNewConnectionModal}
        >
          +
        </button>
      </div>

      <ConnectionSummaryCard
        connectionProfiles={connectionProfiles}
        activeConnectionId={activeConnectionId}
        connectedConnectionIds={connectedConnectionIds}
        connectionMessage={connectionMessage}
        openNewConnectionModal={openNewConnectionModal}
        editConnectionProfile={editConnectionProfile}
        connectConnectionProfile={connectConnectionProfile}
        selectConnectionProfile={selectConnectionProfile}
        deleteConnectionProfile={deleteConnectionProfile}
        handleDisconnect={handleDisconnect}
      />

      <DatabaseExplorer
        schemas={schemas}
        explorerMessage={explorerMessage}
        isLoadingExplorer={isLoadingExplorer}
        refreshExplorer={refreshExplorer}
        selectedRelationKey={selectedRelationKey}
        handleOpenRelation={handleOpenRelation}
        openTableContextMenu={openTableContextMenu}
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
