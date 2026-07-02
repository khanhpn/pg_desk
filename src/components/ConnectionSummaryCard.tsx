import { useCallback, useMemo, useState } from "react";
import type { PgConnectionProfile } from "@/types/connection";

type ConnectionSummaryCardProps = {
  connectionProfiles: PgConnectionProfile[];
  activeConnectionId: string | null;
  connectedConnectionIds: string[];
  connectionMessage: string;
  databaseTaskConnectionId: string | null;
  openNewConnectionModal: () => void;
  editConnectionProfile: (profile: PgConnectionProfile) => void;
  connectConnectionProfile: (profile: PgConnectionProfile) => Promise<void>;
  selectConnectionProfile: (connectionId: string) => Promise<void>;
  deleteConnectionProfile: (connectionId: string) => Promise<void>;
  handleDisconnect: (connectionId?: string | null) => Promise<void>;
  handleBackupDatabase: (connectionId: string) => Promise<void>;
  handleRestoreDatabase: (connectionId: string) => Promise<void>;
};

export const ConnectionSummaryCard = ({
  connectionProfiles,
  activeConnectionId,
  connectedConnectionIds,
  connectionMessage,
  databaseTaskConnectionId,
  openNewConnectionModal,
  editConnectionProfile,
  connectConnectionProfile,
  selectConnectionProfile,
  deleteConnectionProfile,
  handleDisconnect,
  handleBackupDatabase,
  handleRestoreDatabase,
}: ConnectionSummaryCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeProfile = useMemo(() => {
    return (
      connectionProfiles.find((profile) => {
        return profile.id === activeConnectionId;
      }) ?? null
    );
  }, [activeConnectionId, connectionProfiles]);
  const handleDelete = useCallback(
    (profile: PgConnectionProfile): void => {
      const confirmed = window.confirm(`Delete connection "${profile.name}"?`);

      if (confirmed) {
        void deleteConnectionProfile(profile.id);
      }
    },
    [deleteConnectionProfile],
  );
  const toggleCollapsed = useCallback((): void => {
    setIsCollapsed((current) => {
      return !current;
    });
  }, []);
  const savedProfileLabel = `${connectionProfiles.length} saved profile${
    connectionProfiles.length === 1 ? "" : "s"
  }`;

  return (
    <div
      className={
        isCollapsed
          ? "connection-card connection-list-card collapsed"
          : "connection-card connection-list-card"
      }
    >
      <div className="connection-list-header">
        <div>
          <div className="connection-list-title">Connections</div>
          <div className="connection-list-subtitle">{savedProfileLabel}</div>
        </div>

        <div className="connection-list-header-actions">
          <button
            className="connection-collapse-button"
            type="button"
            aria-label={
              isCollapsed ? "Expand connections" : "Collapse connections"
            }
            aria-expanded={!isCollapsed}
            onClick={toggleCollapsed}
          >
            {isCollapsed ? "▾" : "▴"}
          </button>

          <button
            className="connection-add-button"
            type="button"
            onClick={openNewConnectionModal}
          >
            +
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div className="connection-collapsed-summary">
          <span className="connection-collapsed-primary">
            {activeProfile
              ? `${activeProfile.name} active`
              : "No active profile"}
          </span>
          <span className="connection-collapsed-secondary">
            {savedProfileLabel}
          </span>
        </div>
      ) : (
        <div className="connection-profile-list">
          {connectionProfiles.length === 0 && (
            <div className="connection-empty-state">No connections yet.</div>
          )}

          {connectionProfiles.map((profile) => {
            const isActive = profile.id === activeConnectionId;
            const isConnected = connectedConnectionIds.includes(profile.id);
            const isDatabaseTaskRunning =
              databaseTaskConnectionId === profile.id;

            return (
              <div
                className={
                  isActive
                    ? "connection-profile-row active"
                    : "connection-profile-row"
                }
                key={profile.id}
              >
                <button
                  className="connection-profile-main"
                  type="button"
                  onClick={() => {
                    void selectConnectionProfile(profile.id);
                  }}
                >
                  <span
                    className={
                      isConnected
                        ? "connection-status"
                        : "connection-status off"
                    }
                  />
                  <span className="connection-profile-text">
                    <span className="connection-name">{profile.name}</span>
                    <span className="connection-meta">
                      {profile.user}@{profile.host}/{profile.database}
                    </span>
                  </span>
                </button>

                <div className="connection-profile-actions">
                  <button
                    className="connection-mini-button"
                    type="button"
                    onClick={() => {
                      editConnectionProfile(profile);
                    }}
                  >
                    Edit
                  </button>
                  {isConnected ? (
                    <>
                      <button
                        className="connection-mini-button primary"
                        disabled={isDatabaseTaskRunning}
                        type="button"
                        onClick={() => {
                          void handleBackupDatabase(profile.id);
                        }}
                      >
                        Backup
                      </button>
                      <button
                        className="connection-mini-button"
                        disabled={isDatabaseTaskRunning}
                        type="button"
                        onClick={() => {
                          void handleRestoreDatabase(profile.id);
                        }}
                      >
                        Restore
                      </button>
                      <button
                        className="connection-mini-button danger"
                        disabled={isDatabaseTaskRunning}
                        type="button"
                        onClick={() => {
                          void handleDisconnect(profile.id);
                        }}
                      >
                        Off
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="connection-mini-button primary"
                        type="button"
                        onClick={() => {
                          void connectConnectionProfile(profile);
                        }}
                      >
                        Connect
                      </button>
                      <button
                        className="connection-mini-button danger"
                        type="button"
                        onClick={() => {
                          handleDelete(profile);
                        }}
                      >
                        Del
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isCollapsed && connectionMessage && (
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
    </div>
  );
};
