import type { PgConnectionField, PgConnectionForm } from "@/types/connection";

type ConnectionModalProps = {
  isOpen: boolean;
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isTestingConnection: boolean;
  updateConnectionField: (
    field: PgConnectionField,
    value: string | boolean,
  ) => void;
  closeConnectionModal: () => void;
  handleConnect: () => Promise<void>;
};

export const ConnectionModal = ({
  isOpen,
  connectionForm,
  connectionMessage,
  isTestingConnection,
  updateConnectionField,
  closeConnectionModal,
  handleConnect,
}: ConnectionModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="connection-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Connection Settings</div>
            <div className="modal-subtitle">PostgreSQL connection profile</div>
          </div>

          <button
            className="modal-close-button"
            type="button"
            disabled={isTestingConnection}
            onClick={closeConnectionModal}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span>Name</span>
            <input
              value={connectionForm.name}
              placeholder="Local, Staging, Production"
              onChange={(event) =>
                updateConnectionField("name", event.target.value)
              }
            />
          </label>

          <div className="modal-grid">
            <label className="modal-field">
              <span>Host</span>
              <input
                value={connectionForm.host}
                onChange={(event) =>
                  updateConnectionField("host", event.target.value)
                }
              />
            </label>

            <label className="modal-field">
              <span>Port</span>
              <input
                value={connectionForm.port}
                onChange={(event) =>
                  updateConnectionField("port", event.target.value)
                }
              />
            </label>
          </div>

          <label className="modal-field">
            <span>Database</span>
            <input
              value={connectionForm.database}
              onChange={(event) =>
                updateConnectionField("database", event.target.value)
              }
            />
          </label>

          <label className="modal-field">
            <span>User</span>
            <input
              value={connectionForm.user}
              onChange={(event) =>
                updateConnectionField("user", event.target.value)
              }
            />
          </label>

          <label className="modal-field">
            <span>Password</span>
            <input
              type="password"
              value={connectionForm.password}
              onChange={(event) =>
                updateConnectionField("password", event.target.value)
              }
            />
          </label>

          <label className="modal-checkbox-row">
            <input
              type="checkbox"
              checked={connectionForm.ssl}
              onChange={(event) =>
                updateConnectionField("ssl", event.target.checked)
              }
            />
            <span>Use SSL</span>
          </label>

          <div
            className={
              connectionMessage.startsWith("Error")
                ? "modal-message error"
                : "modal-message"
            }
          >
            {connectionMessage}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="modal-secondary-button"
            type="button"
            disabled={isTestingConnection}
            onClick={closeConnectionModal}
          >
            Cancel
          </button>

          <button
            className="modal-primary-button"
            type="button"
            disabled={isTestingConnection}
            onClick={() => {
              void handleConnect();
            }}
          >
            {isTestingConnection ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
};
