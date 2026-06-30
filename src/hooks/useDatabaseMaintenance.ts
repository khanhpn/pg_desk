import { useCallback, useState } from "react";

type UseDatabaseMaintenanceOptions = {
  refreshExplorer: () => Promise<void>;
};

const formatDatabaseTaskMessage = (ok: boolean, message: string): string => {
  if (ok || message.endsWith("cancelled")) {
    return message;
  }

  return `Error: ${message}`;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const useDatabaseMaintenance = ({
  refreshExplorer,
}: UseDatabaseMaintenanceOptions) => {
  const [databaseMaintenanceMessage, setDatabaseMaintenanceMessage] =
    useState("");
  const [databaseTaskConnectionId, setDatabaseTaskConnectionId] = useState<
    string | null
  >(null);

  const handleBackupDatabase = useCallback(
    async (connectionId: string): Promise<void> => {
      setDatabaseTaskConnectionId(connectionId);
      setDatabaseMaintenanceMessage("Backing up database...");

      try {
        const result = await window.pgdesk.database.backup(connectionId);

        setDatabaseMaintenanceMessage(
          formatDatabaseTaskMessage(result.ok, result.message),
        );
      } catch (error) {
        setDatabaseMaintenanceMessage(`Error: ${getErrorMessage(error)}`);
      } finally {
        setDatabaseTaskConnectionId(null);
      }
    },
    [],
  );

  const handleRestoreDatabase = useCallback(
    async (connectionId: string): Promise<void> => {
      const confirmed = window.confirm(
        "Restore this database from a backup file? Existing objects may be dropped and replaced by the backup.",
      );

      if (!confirmed) {
        return;
      }

      setDatabaseTaskConnectionId(connectionId);
      setDatabaseMaintenanceMessage("Restoring database...");

      try {
        const result = await window.pgdesk.database.restore(connectionId);

        setDatabaseMaintenanceMessage(
          formatDatabaseTaskMessage(result.ok, result.message),
        );

        if (result.ok) {
          await refreshExplorer();
        }
      } catch (error) {
        setDatabaseMaintenanceMessage(`Error: ${getErrorMessage(error)}`);
      } finally {
        setDatabaseTaskConnectionId(null);
      }
    },
    [refreshExplorer],
  );

  return {
    databaseMaintenanceMessage,
    databaseTaskConnectionId,
    handleBackupDatabase,
    handleRestoreDatabase,
  };
};
