import { ConnectionPanel } from "@/components/ConnectionPanel";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";
import type { PgSchemaInfo, PgRelationInfo } from "@/types/metadata";

type SidebarProps = {
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isTestingConnection: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  handleTestConnection: () => Promise<void>;

  schemas: PgSchemaInfo[];
  explorerMessage: string;
  isLoadingExplorer: boolean;
  refreshExplorer: () => Promise<void>;
  selectedRelationKey: string | null;
  handleOpenRelation: (relation: PgRelationInfo) => Promise<void>;
};

export const Sidebar = ({
  connectionForm,
  connectionMessage,
  isTestingConnection,
  updateConnectionField,
  handleTestConnection,
  schemas,
  explorerMessage,
  isLoadingExplorer,
  refreshExplorer,
  selectedRelationKey,
  handleOpenRelation,
}: SidebarProps) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="app-title">pgdesk</div>
          <div className="app-subtitle">PostgreSQL Client</div>
        </div>

        <button className="icon-button" type="button">
          +
        </button>
      </div>

      <div className="connection-card">
        <div className="connection-status" />

        <div>
          <div className="connection-name">local / postgres</div>
          <div className="connection-meta">
            {connectionForm.host}:{connectionForm.port}
          </div>
        </div>
      </div>

      <ConnectionPanel
        connectionForm={connectionForm}
        connectionMessage={connectionMessage}
        isTestingConnection={isTestingConnection}
        updateConnectionField={updateConnectionField}
        handleTestConnection={handleTestConnection}
      />

      <DatabaseExplorer
        schemas={schemas}
        explorerMessage={explorerMessage}
        isLoadingExplorer={isLoadingExplorer}
        refreshExplorer={refreshExplorer}
        selectedRelationKey={selectedRelationKey}
        handleOpenRelation={handleOpenRelation}
      />
    </aside>
  );
};
