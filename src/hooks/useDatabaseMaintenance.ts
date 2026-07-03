import { useCallback, useEffect, useState } from "react";
import type {
  PgDatabaseMaintenanceItemResult,
  PgDatabaseSummary,
  PgRestoreFileEntry,
} from "@/types/database";

type UseDatabaseMaintenanceOptions = {
  refreshExplorer: () => Promise<void>;
  activeConnectionId: string | null;
  connectedConnectionIds: string[];
};

export type DatabaseMaintenanceToast = {
  status: "progress" | "success" | "error" | "info";
  title: string;
  message: string;
};

export type ServerDatabaseMaintenanceMode = "backup" | "restore";

export type ServerDatabaseMaintenanceModalState = {
  isOpen: boolean;
  mode: ServerDatabaseMaintenanceMode;
  isLoading: boolean;
  isRunning: boolean;
  message: string;
  status: "idle" | "success" | "error";
  databases: PgDatabaseSummary[];
  selectedDatabaseNames: string[];
  backupFolderPath: string;
  restoreFiles: PgRestoreFileEntry[];
  selectedRestoreFilePaths: string[];
  itemResults: PgDatabaseMaintenanceItemResult[];
};

const createInitialServerModalState =
  (): ServerDatabaseMaintenanceModalState => ({
    isOpen: false,
    mode: "backup",
    isLoading: false,
    isRunning: false,
    message: "",
    status: "idle",
    databases: [],
    selectedDatabaseNames: [],
    backupFolderPath: "",
    restoreFiles: [],
    selectedRestoreFilePaths: [],
    itemResults: [],
  });

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
  activeConnectionId,
  connectedConnectionIds,
}: UseDatabaseMaintenanceOptions) => {
  const [databaseMaintenanceMessage, setDatabaseMaintenanceMessage] =
    useState("");
  const [databaseMaintenanceToast, setDatabaseMaintenanceToast] =
    useState<DatabaseMaintenanceToast | null>(null);
  const [databaseTaskConnectionId, setDatabaseTaskConnectionId] = useState<
    string | null
  >(null);
  const [serverMaintenanceModal, setServerMaintenanceModal] =
    useState<ServerDatabaseMaintenanceModalState>(
      createInitialServerModalState,
    );
  const isActiveConnectionConnected = Boolean(
    activeConnectionId && connectedConnectionIds.includes(activeConnectionId),
  );

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

  const openServerBackupModal = useCallback(async (): Promise<void> => {
    setServerMaintenanceModal({
      ...createInitialServerModalState(),
      isOpen: true,
      mode: "backup",
      isLoading: true,
      message: "Loading databases...",
    });

    if (!activeConnectionId || !isActiveConnectionConnected) {
      setServerMaintenanceModal((current) => ({
        ...current,
        isLoading: false,
        status: "error",
        message:
          "Connect to a PostgreSQL database before backing up databases.",
      }));
      return;
    }

    const result =
      await window.pgdesk.database.listDatabases(activeConnectionId);

    setServerMaintenanceModal((current) => ({
      ...current,
      isLoading: false,
      status: result.ok ? "idle" : "error",
      message: result.message,
      databases: result.databases,
      selectedDatabaseNames: result.databases.map((database) => database.name),
    }));
  }, [activeConnectionId, isActiveConnectionConnected]);

  const openServerRestoreModal = useCallback((): void => {
    setServerMaintenanceModal({
      ...createInitialServerModalState(),
      isOpen: true,
      mode: "restore",
      status:
        activeConnectionId && isActiveConnectionConnected ? "idle" : "error",
      message:
        activeConnectionId && isActiveConnectionConnected
          ? "Choose SQL files or a folder to restore."
          : "Connect to a PostgreSQL database before restoring databases.",
    });
  }, [activeConnectionId, isActiveConnectionConnected]);

  useEffect(() => {
    const removeBackupListener = window.pgdesk.database.onOpenBackupModal(
      () => {
        void openServerBackupModal();
      },
    );
    const removeRestoreListener = window.pgdesk.database.onOpenRestoreModal(
      openServerRestoreModal,
    );

    return () => {
      removeBackupListener();
      removeRestoreListener();
    };
  }, [openServerBackupModal, openServerRestoreModal]);

  const closeServerMaintenanceModal = useCallback((): void => {
    setServerMaintenanceModal(createInitialServerModalState());
  }, []);

  const selectAllServerDatabases = useCallback((): void => {
    setServerMaintenanceModal((current) => ({
      ...current,
      selectedDatabaseNames: current.databases.map((database) => database.name),
    }));
  }, []);

  const clearServerDatabaseSelection = useCallback((): void => {
    setServerMaintenanceModal((current) => ({
      ...current,
      selectedDatabaseNames: [],
    }));
  }, []);

  const toggleServerDatabase = useCallback((databaseName: string): void => {
    setServerMaintenanceModal((current) => {
      const selectedNames = new Set(current.selectedDatabaseNames);

      if (selectedNames.has(databaseName)) {
        selectedNames.delete(databaseName);
      } else {
        selectedNames.add(databaseName);
      }

      return {
        ...current,
        selectedDatabaseNames: Array.from(selectedNames),
      };
    });
  }, []);

  const chooseServerBackupFolder = useCallback(async (): Promise<void> => {
    const result = await window.pgdesk.database.chooseBackupFolder();

    setServerMaintenanceModal((current) => ({
      ...current,
      status: result.ok ? current.status : "idle",
      message: result.ok ? result.message : current.message,
      backupFolderPath: result.folderPath ?? current.backupFolderPath,
    }));
  }, []);

  const chooseServerRestoreFiles = useCallback(async (): Promise<void> => {
    const result = await window.pgdesk.database.chooseRestoreFiles();

    setServerMaintenanceModal((current) => ({
      ...current,
      status: result.ok ? "idle" : "error",
      message: result.message,
      restoreFiles: result.files,
      selectedRestoreFilePaths: result.files.map((file) => file.filePath),
      itemResults: [],
    }));
  }, []);

  const toggleRestoreFile = useCallback((filePath: string): void => {
    setServerMaintenanceModal((current) => {
      const selectedFilePaths = new Set(current.selectedRestoreFilePaths);

      if (selectedFilePaths.has(filePath)) {
        selectedFilePaths.delete(filePath);
      } else {
        selectedFilePaths.add(filePath);
      }

      return {
        ...current,
        selectedRestoreFilePaths: Array.from(selectedFilePaths),
      };
    });
  }, []);

  const updateRestoreTargetDatabase = useCallback(
    (filePath: string, targetDatabase: string): void => {
      setServerMaintenanceModal((current) => ({
        ...current,
        restoreFiles: current.restoreFiles.map((file) => {
          return file.filePath === filePath
            ? { ...file, targetDatabase }
            : file;
        }),
      }));
    },
    [],
  );

  const handleBackupServerDatabases = useCallback(async (): Promise<void> => {
    if (!activeConnectionId || !isActiveConnectionConnected) {
      setServerMaintenanceModal((current) => ({
        ...current,
        status: "error",
        message:
          "Connect to a PostgreSQL database before backing up databases.",
      }));
      return;
    }

    if (
      serverMaintenanceModal.selectedDatabaseNames.length === 0 ||
      !serverMaintenanceModal.backupFolderPath
    ) {
      setServerMaintenanceModal((current) => ({
        ...current,
        status: "error",
        message: "Select at least one database and a backup folder.",
      }));
      return;
    }

    setServerMaintenanceModal((current) => ({
      ...current,
      isRunning: true,
      status: "idle",
      message: "Backing up selected databases...",
      itemResults: [],
    }));

    const result = await window.pgdesk.database.backupMany({
      connectionId: activeConnectionId,
      databases: serverMaintenanceModal.selectedDatabaseNames,
      folderPath: serverMaintenanceModal.backupFolderPath,
    });

    if (result.ok) {
      setDatabaseMaintenanceToast({
        status: "success",
        title: "Backup complete",
        message: result.message,
      });
      closeServerMaintenanceModal();
      return;
    }

    setServerMaintenanceModal((current) => ({
      ...current,
      isRunning: false,
      status: "error",
      message: result.message,
      itemResults: result.items,
    }));
  }, [
    activeConnectionId,
    closeServerMaintenanceModal,
    isActiveConnectionConnected,
    serverMaintenanceModal.backupFolderPath,
    serverMaintenanceModal.selectedDatabaseNames,
  ]);

  const handleRestoreServerDatabases = useCallback(async (): Promise<void> => {
    if (!activeConnectionId || !isActiveConnectionConnected) {
      setServerMaintenanceModal((current) => ({
        ...current,
        status: "error",
        message: "Connect to a PostgreSQL database before restoring databases.",
      }));
      return;
    }

    const selectedFilePaths = new Set(
      serverMaintenanceModal.selectedRestoreFilePaths,
    );
    const entries = serverMaintenanceModal.restoreFiles.filter((file) => {
      return selectedFilePaths.has(file.filePath) && file.targetDatabase.trim();
    });

    if (entries.length === 0) {
      setServerMaintenanceModal((current) => ({
        ...current,
        status: "error",
        message: "Select at least one SQL file with a target database.",
      }));
      return;
    }

    const confirmed = window.confirm(
      "Restore selected SQL files? PgDesk will create missing target databases before restore.",
    );

    if (!confirmed) {
      return;
    }

    setServerMaintenanceModal((current) => ({
      ...current,
      isRunning: true,
      status: "idle",
      message: "Restoring selected databases...",
      itemResults: [],
    }));

    const result = await window.pgdesk.database.restoreMany({
      connectionId: activeConnectionId,
      entries,
    });

    if (result.ok) {
      setDatabaseMaintenanceToast({
        status: "success",
        title: "Restore complete",
        message: result.message,
      });
      closeServerMaintenanceModal();
      await refreshExplorer();
      return;
    }

    setServerMaintenanceModal((current) => ({
      ...current,
      isRunning: false,
      status: "error",
      message: result.message,
      itemResults: result.items,
    }));
  }, [
    activeConnectionId,
    closeServerMaintenanceModal,
    isActiveConnectionConnected,
    refreshExplorer,
    serverMaintenanceModal.restoreFiles,
    serverMaintenanceModal.selectedRestoreFilePaths,
  ]);

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
    serverMaintenanceModal,
    closeDatabaseMaintenanceToast,
    closeServerMaintenanceModal,
    selectAllServerDatabases,
    clearServerDatabaseSelection,
    toggleServerDatabase,
    chooseServerBackupFolder,
    handleBackupServerDatabases,
    chooseServerRestoreFiles,
    toggleRestoreFile,
    updateRestoreTargetDatabase,
    handleRestoreServerDatabases,
    handleBackupDatabase,
    handleRestoreDatabase,
  };
};
