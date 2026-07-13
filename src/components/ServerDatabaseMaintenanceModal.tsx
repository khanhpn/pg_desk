import type { ServerDatabaseMaintenanceModalState } from "@/hooks/useDatabaseMaintenance";

type ServerDatabaseMaintenanceModalProps = {
  modal: ServerDatabaseMaintenanceModalState;
  connectionLabel: string;
  closeModal: () => void;
  selectAllDatabases: () => void;
  clearDatabaseSelection: () => void;
  toggleDatabase: (databaseName: string) => void;
  chooseBackupFolder: () => Promise<void>;
  runBackup: () => Promise<void>;
  chooseRestoreFiles: () => Promise<void>;
  toggleRestoreFile: (filePath: string) => void;
  updateRestoreTargetDatabase: (
    filePath: string,
    targetDatabase: string,
  ) => void;
  runRestore: () => Promise<void>;
};

const getFileName = (filePath: string): string => {
  return filePath.split(/[\\/]/).pop() || filePath;
};

/**
 * Renders multi-database backup and restore selection workflows for a server.
 *
 * @param props - Modal mode, database/file selections, form setters, and task actions.
 * @returns The server maintenance dialog, or `null` while it is closed.
 */
export const ServerDatabaseMaintenanceModal = ({
  modal,
  connectionLabel,
  closeModal,
  selectAllDatabases,
  clearDatabaseSelection,
  toggleDatabase,
  chooseBackupFolder,
  runBackup,
  chooseRestoreFiles,
  toggleRestoreFile,
  updateRestoreTargetDatabase,
  runRestore,
}: ServerDatabaseMaintenanceModalProps) => {
  if (!modal.isOpen) {
    return null;
  }

  const isBackup = modal.mode === "backup";
  const title = isBackup ? "Backup Databases" : "Restore Databases";
  const selectedRestoreCount = modal.selectedRestoreFilePaths.length;
  const canRunBackup =
    !modal.isRunning &&
    modal.selectedDatabaseNames.length > 0 &&
    Boolean(modal.backupFolderPath);
  const canRunRestore =
    !modal.isRunning &&
    modal.restoreFiles.length > 0 &&
    selectedRestoreCount > 0;

  return (
    <div className="server-maintenance-overlay" role="presentation">
      <div
        className="server-maintenance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-maintenance-title"
      >
        <div className="server-maintenance-header">
          <div>
            <div
              id="server-maintenance-title"
              className="server-maintenance-title"
            >
              {title}
            </div>
            <div className="server-maintenance-subtitle">{connectionLabel}</div>
          </div>

          <button
            className="server-maintenance-icon-button"
            type="button"
            aria-label="Close database maintenance"
            disabled={modal.isRunning}
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className={`server-maintenance-message ${modal.status}`}>
          {modal.message || "Ready."}
        </div>

        {isBackup ? (
          <div className="server-maintenance-body">
            <div className="server-maintenance-toolbar">
              <span>
                {modal.selectedDatabaseNames.length} of {modal.databases.length}{" "}
                selected
              </span>
              <div className="server-maintenance-actions">
                <button
                  type="button"
                  disabled={modal.isRunning || modal.databases.length === 0}
                  onClick={selectAllDatabases}
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={modal.isRunning}
                  onClick={clearDatabaseSelection}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="server-maintenance-list">
              {modal.isLoading && (
                <div className="server-maintenance-empty">
                  Loading databases...
                </div>
              )}

              {!modal.isLoading &&
                modal.databases.map((database) => {
                  const checked = modal.selectedDatabaseNames.includes(
                    database.name,
                  );

                  return (
                    <label
                      className="server-maintenance-check-row"
                      key={database.name}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={modal.isRunning}
                        onChange={() => {
                          toggleDatabase(database.name);
                        }}
                      />
                      <span>{database.name}</span>
                    </label>
                  );
                })}

              {!modal.isLoading && modal.databases.length === 0 && (
                <div className="server-maintenance-empty">
                  No connectable databases were found.
                </div>
              )}
            </div>

            <div className="server-maintenance-path-row">
              <button
                type="button"
                disabled={modal.isRunning}
                onClick={() => {
                  void chooseBackupFolder();
                }}
              >
                Choose folder
              </button>
              <span>{modal.backupFolderPath || "No folder selected"}</span>
            </div>
          </div>
        ) : (
          <div className="server-maintenance-body">
            <div className="server-maintenance-toolbar">
              <span>
                {selectedRestoreCount} of {modal.restoreFiles.length} selected
              </span>
              <button
                type="button"
                disabled={modal.isRunning}
                onClick={() => {
                  void chooseRestoreFiles();
                }}
              >
                Choose SQL files
              </button>
            </div>

            <div className="server-maintenance-restore-list">
              {modal.restoreFiles.map((file) => {
                const checked = modal.selectedRestoreFilePaths.includes(
                  file.filePath,
                );

                return (
                  <div
                    className="server-maintenance-restore-row"
                    key={file.filePath}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={modal.isRunning}
                        onChange={() => {
                          toggleRestoreFile(file.filePath);
                        }}
                      />
                      <span>{getFileName(file.filePath)}</span>
                    </label>
                    <input
                      type="text"
                      value={file.targetDatabase}
                      disabled={modal.isRunning}
                      aria-label={`Target database for ${getFileName(file.filePath)}`}
                      onChange={(event) => {
                        updateRestoreTargetDatabase(
                          file.filePath,
                          event.target.value,
                        );
                      }}
                    />
                  </div>
                );
              })}

              {modal.restoreFiles.length === 0 && (
                <div className="server-maintenance-empty">
                  Choose SQL files or a folder to prepare restore.
                </div>
              )}
            </div>
          </div>
        )}

        {modal.itemResults.length > 0 && (
          <div className="server-maintenance-results">
            {modal.itemResults.map((item) => (
              <div
                className={
                  item.ok
                    ? "server-maintenance-result-row success"
                    : "server-maintenance-result-row error"
                }
                key={`${item.name}-${item.filePath ?? item.message}`}
              >
                <span>{item.name}</span>
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="server-maintenance-footer">
          <button
            className="server-maintenance-secondary"
            type="button"
            disabled={modal.isRunning}
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            className="server-maintenance-primary"
            type="button"
            disabled={isBackup ? !canRunBackup : !canRunRestore}
            onClick={() => {
              void (isBackup ? runBackup() : runRestore());
            }}
          >
            {modal.isRunning
              ? isBackup
                ? "Backing up..."
                : "Restoring..."
              : isBackup
                ? "Back up selected"
                : "Restore selected"}
          </button>
        </div>
      </div>
    </div>
  );
};
