import { ConnectionPanel } from "@/components/ConnectionPanel";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";

type SidebarProps = {
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isTestingConnection: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  handleTestConnection: () => Promise<void>;
};

export const Sidebar = ({
  connectionForm,
  connectionMessage,
  isTestingConnection,
  updateConnectionField,
  handleTestConnection,
}: SidebarProps): JSX.Element => {
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

      <DatabaseExplorer />
    </aside>
  );
};
