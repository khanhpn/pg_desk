import { useState } from "react";
import type { PgConnectionField, PgConnectionForm } from "@/types/connection";

type UseConnectionTestOptions = {
  onConnected?: () => void | Promise<void>;
};

export const useConnectionTest = ({
  onConnected,
}: UseConnectionTestOptions = {}) => {
  const [connectionForm, setConnectionForm] = useState<PgConnectionForm>(
    () => ({
      host: "localhost",
      port: "5432",
      database: "",
      user: "",
      password: "",
      ssl: false,
    }),
  );

  const [connectionMessage, setConnectionMessage] = useState("Not connected");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const updateConnectionField = (
    field: PgConnectionField,
    value: string | boolean,
  ): void => {
    setConnectionForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTestConnection = async (): Promise<void> => {
    setIsTestingConnection(true);
    setConnectionMessage("Testing connection...");

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
        setConnectionMessage(`Connected: ${result.database} / ${result.user}`);
        await onConnected?.();
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
  };

  return {
    connectionForm,
    connectionMessage,
    isTestingConnection,
    updateConnectionField,
    handleTestConnection,
  };
};
