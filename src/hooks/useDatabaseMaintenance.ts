import { useCallback, useEffect, useState } from "react";

type UseDatabaseMaintenanceOptions = {
  refreshExplorer: () => Promise<void>;
};

export type DatabaseMaintenanceToast = {
  status: "progress" | "success" | "error" | "info";
  title: string;
  message: string;
};

const formatDatabaseTaskMessage = (ok: boolean, message: string): string => {
  if (ok || message.endsWith("cancelled")) {
    return message;
  }

  return `Error: ${message}`;
};

const getDatabaseTaskToastStatus = (
  ok: boolean,
  message: string,
): DatabaseMaintenanceToast["status"] => {
  if (message.endsWith("cancelled")) {
    return "info";
  }

  return ok ? "success" : "error";
};

const getDatabaseTaskToastTitle = (
  taskName: "Backup" | "Restore",
  status: DatabaseMaintenanceToast["status"],
): string => {
  if (status === "progress") {
    return `${taskName} running`;
  }

  if (status === "success") {
    return `${taskName} complete`;
  }

  if (status === "error") {
    return `${taskName} failed`;
  }

  return `${taskName} cancelled`;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const useDatabaseMaintenance = ({
  refreshExplorer,
}: UseDatabaseMaintenanceOptions) => {
  const [databaseMaintenanceMessage, setDatabaseMaintenanceMessage] =
    useState("");
  const [databaseMaintenanceToast, setDatabaseMaintenanceToast] =
    useState<DatabaseMaintenanceToast | null>(null);
  const [databaseTaskConnectionId, setDatabaseTaskConnectionId] = useState<
    string | null
  >(null);

  const closeDatabaseMaintenanceToast = useCallback((): void => {
    setDatabaseMaintenanceToast(null);
  }, []);

  useEffect(() => {
    if (
      !databaseMaintenanceToast ||
      (databaseMaintenanceToast.status !== "success" &&
        databaseMaintenanceToast.status !== "info")
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDatabaseMaintenanceToast(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [databaseMaintenanceToast]);

  const handleBackupDatabase = useCallback(
    async (connectionId: string): Promise<void> => {
      setDatabaseTaskConnectionId(connectionId);
      setDatabaseMaintenanceMessage("Backing up database...");
      setDatabaseMaintenanceToast({
        status: "progress",
        title: "Backup running",
        message: "Backing up database...",
      });

      try {
        const result = await window.pgdesk.database.backup(connectionId);
        const message = formatDatabaseTaskMessage(result.ok, result.message);
        const status = getDatabaseTaskToastStatus(result.ok, result.message);

        setDatabaseMaintenanceMessage(message);
        setDatabaseMaintenanceToast({
          status,
          title: getDatabaseTaskToastTitle("Backup", status),
          message,
        });
      } catch (error) {
        const message = `Error: ${getErrorMessage(error)}`;

        setDatabaseMaintenanceMessage(message);
        setDatabaseMaintenanceToast({
          status: "error",
          title: "Backup failed",
          message,
        });
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
      setDatabaseMaintenanceToast({
        status: "progress",
        title: "Restore running",
        message: "Restoring database...",
      });

      try {
        const result = await window.pgdesk.database.restore(connectionId);
        const message = formatDatabaseTaskMessage(result.ok, result.message);
        const status = getDatabaseTaskToastStatus(result.ok, result.message);

        setDatabaseMaintenanceMessage(message);
        setDatabaseMaintenanceToast({
          status,
          title: getDatabaseTaskToastTitle("Restore", status),
          message,
        });

        if (result.ok) {
          await refreshExplorer();
        }
      } catch (error) {
        const message = `Error: ${getErrorMessage(error)}`;

        setDatabaseMaintenanceMessage(message);
        setDatabaseMaintenanceToast({
          status: "error",
          title: "Restore failed",
          message,
        });
      } finally {
        setDatabaseTaskConnectionId(null);
      }
    },
    [refreshExplorer],
  );

  return {
    databaseMaintenanceMessage,
    databaseMaintenanceToast,
    databaseTaskConnectionId,
    closeDatabaseMaintenanceToast,
    handleBackupDatabase,
    handleRestoreDatabase,
  };
};
