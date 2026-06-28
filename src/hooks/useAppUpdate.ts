import { useEffect, useState } from "react";
import type { UpdateStatusPayload } from "@/vite-env";

export const useAppUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusPayload | null>(
    null,
  );

  const [isUpdateToastVisible, setIsUpdateToastVisible] = useState(false);

  const handleDownloadUpdate = async (): Promise<void> => {
    setUpdateStatus((current: UpdateStatusPayload | null) => ({
      status: "downloading",
      message: current?.version
        ? `Downloading PGDesk ${current.version}...`
        : "Downloading update...",
      version: current?.version,
      percent: current?.percent,
    }));

    await window.pgdesk.update.download();
  };

  const closeUpdateToast = (): void => {
    setIsUpdateToastVisible(false);
  };

  useEffect(() => {
    const visibleStatuses = new Set<UpdateStatusPayload["status"]>([
      "available",
      "downloading",
      "downloaded",
      "error",
    ]);

    const unsubscribe = window.pgdesk.update.onStatus((payload) => {
      setUpdateStatus(payload);

      if (visibleStatuses.has(payload.status)) {
        setIsUpdateToastVisible(true);
        return;
      }

      setIsUpdateToastVisible(false);
    });

    void window.pgdesk.update.check();

    return unsubscribe;
  }, []);

  return {
    updateStatus,
    isUpdateToastVisible,
    handleDownloadUpdate,
    closeUpdateToast,
  };
};
