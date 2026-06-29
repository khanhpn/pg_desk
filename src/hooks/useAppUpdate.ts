import { useCallback, useEffect, useState } from "react";
import type { UpdateStatusPayload } from "@/vite-env";

const visibleStatuses = new Set<UpdateStatusPayload["status"]>([
  "available",
  "downloading",
  "downloaded",
  "error",
]);

const manualVisibleStatuses = new Set<UpdateStatusPayload["status"]>([
  "checking",
  "not-available",
]);

export const useAppUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusPayload | null>(
    null,
  );

  const [isUpdateToastVisible, setIsUpdateToastVisible] = useState(false);

  const handleDownloadUpdate = useCallback(async (): Promise<void> => {
    setUpdateStatus((current: UpdateStatusPayload | null) => ({
      status: "downloading",
      message: current?.version
        ? `Downloading PGDesk ${current.version}...`
        : "Downloading update...",
      version: current?.version,
      percent: current?.percent,
    }));

    await window.pgdesk.update.download();
  }, []);

  const closeUpdateToast = useCallback((): void => {
    setIsUpdateToastVisible(false);
  }, []);

  useEffect(() => {
    const unsubscribe = window.pgdesk.update.onStatus((payload) => {
      setUpdateStatus(payload);

      if (
        visibleStatuses.has(payload.status) ||
        (payload.isManual && manualVisibleStatuses.has(payload.status))
      ) {
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
