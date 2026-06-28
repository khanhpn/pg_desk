import { useCallback, useState } from "react";

export const useIpcPing = () => {
  const [ipcMessage, setIpcMessage] = useState("not tested");

  const handlePing = useCallback(async (): Promise<void> => {
    const result = await window.pgdesk.app.ping();
    setIpcMessage(`${result.message} · ${result.timestamp}`);
  }, []);

  return {
    ipcMessage,
    handlePing,
  };
};
