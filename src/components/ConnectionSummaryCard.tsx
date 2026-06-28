import type { PgConnectionForm } from "@/types/connection";

type ConnectionSummaryCardProps = {
  connectionForm: PgConnectionForm;
  connectionMessage: string;
  isConnected: boolean;
  hasSavedProfile: boolean;
  openConnectionModal: () => void;
  handleDisconnect: () => Promise<void>;
};

export const ConnectionSummaryCard = ({
  connectionForm,
  connectionMessage,
  isConnected,
  hasSavedProfile,
  openConnectionModal,
  handleDisconnect,
}: ConnectionSummaryCardProps) => {
  const title = isConnected
    ? "Connected"
    : hasSavedProfile
      ? `${connectionForm.user}@${connectionForm.host}`
      : "Not connected";

  const actionText = isConnected ? "Edit" : "Connect";

  return (
    <div className="connection-card connection-summary-card">
      <div
        className={isConnected ? "connection-status" : "connection-status off"}
      />

      <div className="connection-summary-content">
        <div className="connection-summary-main-row">
          <div className="connection-summary-text">
            <div className="connection-name">{title}</div>

            {hasSavedProfile && (
              <div className="connection-meta">
                database: {connectionForm.database}
              </div>
            )}
          </div>

          <button
            className="connection-edit-button"
            type="button"
            onClick={openConnectionModal}
          >
            {actionText}
          </button>
        </div>

        {connectionMessage && (
          <div
            className={
              connectionMessage.startsWith("Error")
                ? "connection-message error"
                : "connection-message"
            }
          >
            {connectionMessage}
          </div>
        )}

        {isConnected && (
          <button
            className="disconnect-button"
            type="button"
            onClick={() => {
              void handleDisconnect();
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};
