import { useCallback, useEffect, useState } from "react";
import type {
  PgConnectionField,
  PgConnectionForm,
  PgConnectionProfile,
} from "@/types/connection";

type UseConnectionTestOptions = {
  onActiveConnectionChanged?: () => void | Promise<void>;
};

const defaultConnectionForm: PgConnectionForm = {
  id: null,
  name: "",
  host: "localhost",
  port: "5432",
  database: "postgres",
  user: "postgres",
  password: "",
  ssl: false,
};

const toConnectionForm = (profile: PgConnectionProfile): PgConnectionForm => ({
  id: profile.id,
  name: profile.name,
  host: profile.host,
  port: String(profile.port),
  database: profile.database,
  user: profile.user,
  password: profile.password,
  ssl: profile.ssl,
});

export const useConnectionTest = ({
  onActiveConnectionChanged,
}: UseConnectionTestOptions = {}) => {
  const [connectionForm, setConnectionForm] = useState<PgConnectionForm>(
    defaultConnectionForm,
  );
  const [connectionProfiles, setConnectionProfiles] = useState<
    PgConnectionProfile[]
  >([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null,
  );
  const [connectedConnectionIds, setConnectedConnectionIds] = useState<
    string[]
  >([]);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  const isConnected = Boolean(
    activeConnectionId && connectedConnectionIds.includes(activeConnectionId),
  );

  const refreshConnections = useCallback(async (): Promise<void> => {
    const result = await window.pgdesk.connection.list();

    setConnectionProfiles(result.profiles);
    setActiveConnectionId(result.activeConnectionId);
    setConnectedConnectionIds(result.connectedConnectionIds);
  }, []);

  const updateConnectionField = useCallback(
    (field: PgConnectionField, value: string | boolean): void => {
      setConnectionForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  const openNewConnectionModal = useCallback((): void => {
    setConnectionForm(defaultConnectionForm);
    setConnectionMessage("");
    setIsConnectionModalOpen(true);
  }, []);

  const editConnectionProfile = useCallback(
    (profile: PgConnectionProfile): void => {
      setConnectionForm(toConnectionForm(profile));
      setConnectionMessage("");
      setIsConnectionModalOpen(true);
    },
    [],
  );

  const closeConnectionModal = useCallback((): void => {
    if (isTestingConnection) {
      return;
    }

    setIsConnectionModalOpen(false);
  }, [isTestingConnection]);

  const selectConnectionProfile = useCallback(
    async (connectionId: string): Promise<void> => {
      await window.pgdesk.connection.setActive(connectionId);
      await refreshConnections();
      await onActiveConnectionChanged?.();
    },
    [onActiveConnectionChanged, refreshConnections],
  );

  const handleConnect = useCallback(async (): Promise<void> => {
    setIsTestingConnection(true);
    setConnectionMessage("Connecting...");

    try {
      const result = await window.pgdesk.connection.connect({
        id: connectionForm.id ?? undefined,
        name: connectionForm.name,
        host: connectionForm.host,
        port: Number(connectionForm.port),
        database: connectionForm.database,
        user: connectionForm.user,
        password: connectionForm.password,
        ssl: connectionForm.ssl,
      });

      if (result.ok) {
        setConnectionMessage("");
        setIsConnectionModalOpen(false);
        await refreshConnections();
        await onActiveConnectionChanged?.();
        return;
      }

      setConnectionMessage(
        `Error: ${result.message || "Unknown connection error"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setConnectionMessage(`Error: ${message}`);
    } finally {
      setIsTestingConnection(false);
    }
  }, [connectionForm, onActiveConnectionChanged, refreshConnections]);

  const connectConnectionProfile = useCallback(
    async (profile: PgConnectionProfile): Promise<void> => {
      setIsTestingConnection(true);
      setConnectionMessage(`Connecting to ${profile.name}...`);

      try {
        const result = await window.pgdesk.connection.connect(profile);

        if (result.ok) {
          setConnectionMessage("");
          await refreshConnections();
          await onActiveConnectionChanged?.();
          return;
        }

        setConnectionMessage(
          `Error: ${result.message || "Unknown connection error"}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        setConnectionMessage(`Error: ${message}`);
      } finally {
        setIsTestingConnection(false);
      }
    },
    [onActiveConnectionChanged, refreshConnections],
  );

  const handleDisconnect = useCallback(
    async (connectionId?: string | null): Promise<void> => {
      try {
        await window.pgdesk.connection.disconnect(
          connectionId ?? activeConnectionId,
        );
        await refreshConnections();
        setConnectionMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        setConnectionMessage(`Error disconnecting: ${message}`);
      }
    },
    [activeConnectionId, refreshConnections],
  );

  const deleteConnectionProfile = useCallback(
    async (connectionId: string): Promise<void> => {
      await window.pgdesk.connection.deleteProfile(connectionId);
      await refreshConnections();
      await onActiveConnectionChanged?.();
    },
    [onActiveConnectionChanged, refreshConnections],
  );

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  return {
    connectionForm,
    connectionProfiles,
    activeConnectionId,
    connectedConnectionIds,
    connectionMessage,
    isTestingConnection,
    isConnected,
    isConnectionModalOpen,
    updateConnectionField,
    openNewConnectionModal,
    editConnectionProfile,
    closeConnectionModal,
    handleConnect,
    connectConnectionProfile,
    handleDisconnect,
    selectConnectionProfile,
    deleteConnectionProfile,
  };
};
