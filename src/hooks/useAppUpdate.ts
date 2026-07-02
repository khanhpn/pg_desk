import { useCallback, useEffect, useState } from "react";
import type { UpdateStatusPayload } from "@/vite-env";

const visibleStatuses = new Set<UpdateStatusPayload["status"]>([
  "available",
  "downloading",
  "downloaded",
  "installing",
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

  const handleInstallUpdate = useCallback(async (): Promise<void> => {
    setUpdateStatus({
      status: "installing",
      message: "PGDesk is restarting to install the update...",
    });
    setIsUpdateToastVisible(true);

    await window.pgdesk.update.install();

    window.setTimeout(() => {
      setUpdateStatus((current) => {
        if (current?.status !== "installing") {
          return current;
        }

        return {
          status: "error",
          message:
            "The installer did not restart PGDesk. Close PGDesk and open it again to finish installing the update.",
        };
      });
    }, 10000);
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
    handleInstallUpdate,
    closeUpdateToast,
  };
};
