import { useEffect, useState } from "react";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";

type UseConnectionTestOptions = {
  onConnected?: () => void | Promise<void>;
};

const defaultConnectionForm: PgConnectionForm = {
  host: "localhost",
  port: "5432",
  database: "postgres",
  user: "postgres",
  password: "",
  ssl: false,
};

export const useConnectionTest = ({
  onConnected,
}: UseConnectionTestOptions = {}) => {
  const [connectionForm, setConnectionForm] = useState<PgConnectionForm>(
    defaultConnectionForm,
  );

  const [connectionMessage, setConnectionMessage] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  const updateConnectionField = (
    field: PgConnectionField,
    value: string | boolean,
  ): void => {
    setConnectionForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const loadSavedProfile = async (): Promise<void> => {
    try {
      const profile = await window.pgdesk.connection.getProfile();

      if (!profile) {
        setHasSavedProfile(false);
        setConnectionMessage("");
        return;
      }

      setConnectionForm({
        host: profile.host,
        port: String(profile.port),
        database: profile.database,
        user: profile.user,
        password: profile.password,
        ssl: profile.ssl,
      });

      setHasSavedProfile(true);
      setConnectionMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionMessage(`Error loading profile: ${message}`);
    }
  };

  const openConnectionModal = (): void => {
    setIsConnectionModalOpen(true);
  };

  const closeConnectionModal = (): void => {
    if (isTestingConnection) {
      return;
    }

    setIsConnectionModalOpen(false);
  };

  const handleConnect = async (): Promise<void> => {
    setIsTestingConnection(true);
    setConnectionMessage("Connecting...");

    try {
      const result = await window.pgdesk.connection.connect({
        host: connectionForm.host,
        port: Number(connectionForm.port),
        database: connectionForm.database,
        user: connectionForm.user,
        password: connectionForm.password,
        ssl: connectionForm.ssl,
      });

      if (result.ok) {
        setIsConnected(true);
        setHasSavedProfile(true);
        setConnectionMessage("");
        setIsConnectionModalOpen(false);

        await onConnected?.();
        return;
      }

      setIsConnected(false);
      setConnectionMessage(
        `Error: ${result.message || "Unknown connection error"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setIsConnected(false);
      setConnectionMessage(`Error: ${message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    try {
      await window.pgdesk.connection.disconnect();

      setIsConnected(false);
      setConnectionMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionMessage(`Error disconnecting: ${message}`);
    }
  };

  useEffect(() => {
    void loadSavedProfile();
  }, []);

  return {
    connectionForm,
    connectionMessage,
    isTestingConnection,
    isConnected,
    hasSavedProfile,
    isConnectionModalOpen,
    updateConnectionField,
    openConnectionModal,
    closeConnectionModal,
    handleConnect,
    handleDisconnect,
  };
};
