import type { PgConnectionField, PgConnectionForm } from "@/types/connection";

type ConnectionPanelProps = {
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isTestingConnection: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  handleTestConnection: () => Promise<void>;
};

export const ConnectionPanel = ({
  connectionForm,
  connectionMessage,
  isTestingConnection,
  updateConnectionField,
  handleTestConnection,
}: ConnectionPanelProps): JSX.Element => {
  const connectionMessageClassName = connectionMessage.startsWith("Error")
    ? "connection-message error"
    : "connection-message";

  return (
    <div className="connection-form">
      <label>
        <span>Host</span>
        <input
          value={connectionForm.host}
          onChange={(event) =>
            updateConnectionField("host", event.target.value)
          }
        />
      </label>

      <label>
        <span>Port</span>
        <input
          value={connectionForm.port}
          onChange={(event) =>
            updateConnectionField("port", event.target.value)
          }
        />
      </label>

      <label>
        <span>Database</span>
        <input
          value={connectionForm.database}
          onChange={(event) =>
            updateConnectionField("database", event.target.value)
          }
        />
      </label>

      <label>
        <span>User</span>
        <input
          value={connectionForm.user}
          onChange={(event) =>
            updateConnectionField("user", event.target.value)
          }
        />
      </label>

      <label>
        <span>Password</span>
        <input
          type="password"
          value={connectionForm.password}
          onChange={(event) =>
            updateConnectionField("password", event.target.value)
          }
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={connectionForm.ssl}
          onChange={(event) =>
            updateConnectionField("ssl", event.target.checked)
          }
        />
        <span>SSL</span>
      </label>

      <button
        className="test-connection-button"
        type="button"
        disabled={isTestingConnection}
        onClick={handleTestConnection}
      >
        {isTestingConnection ? "Connecting..." : "Connect"}
      </button>

      <div className={connectionMessageClassName}>{connectionMessage}</div>
    </div>
  );
};
