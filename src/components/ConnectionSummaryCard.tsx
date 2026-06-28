import { useCallback, useMemo } from "react";
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
  const title = useMemo(() => {
    if (isConnected) {
      return "Connected";
    }

    if (hasSavedProfile) {
      return `${connectionForm.user}@${connectionForm.host}`;
    }

    return "Not connected";
  }, [connectionForm.host, connectionForm.user, hasSavedProfile, isConnected]);
  const actionText = useMemo(() => {
    return isConnected ? "Edit" : "Connect";
  }, [isConnected]);
  const connectionMessageClassName = useMemo(() => {
    return connectionMessage.startsWith("Error")
      ? "connection-message error"
      : "connection-message";
  }, [connectionMessage]);
  const handleDisconnectClick = useCallback((): void => {
    void handleDisconnect();
  }, [handleDisconnect]);

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
          <div className={connectionMessageClassName}>{connectionMessage}</div>
        )}

        {isConnected && (
          <button
            className="disconnect-button"
            type="button"
            onClick={handleDisconnectClick}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};
