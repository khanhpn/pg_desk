import { useCallback, useMemo } from "react";
import type { UpdateStatusPayload } from "@/vite-env";

type AppUpdateToastProps = {
  updateStatus: UpdateStatusPayload | null;
  isVisible: boolean;
  handleDownloadUpdate: () => Promise<void>;
  closeUpdateToast: () => void;
};

export const AppUpdateToast = ({
  updateStatus,
  isVisible,
  handleDownloadUpdate,
  closeUpdateToast,
}: AppUpdateToastProps) => {
  const { isAvailable, isDownloading, isDownloaded, isError } = useMemo(
    () => ({
      isAvailable: updateStatus?.status === "available",
      isDownloading: updateStatus?.status === "downloading",
      isDownloaded: updateStatus?.status === "downloaded",
      isError: updateStatus?.status === "error",
    }),
    [updateStatus?.status],
  );
  const progressWidth = useMemo(() => {
    return `${Math.round(updateStatus?.percent ?? 0)}%`;
  }, [updateStatus?.percent]);
  const handleDownloadClick = useCallback((): void => {
    void handleDownloadUpdate();
  }, [handleDownloadUpdate]);

  if (!isVisible || !updateStatus) {
    return null;
  }

  return (
    <div className="update-toast">
      <div className="update-toast-header">
        <div>
          <div className="update-toast-title">
            {isError ? "Update failed" : "PGDesk update"}
          </div>

          <div className="update-toast-message">{updateStatus.message}</div>
        </div>

        {!isDownloading && !isDownloaded && (
          <button
            className="update-toast-close"
            type="button"
            onClick={closeUpdateToast}
          >
            ×
          </button>
        )}
      </div>

      {isDownloading && (
        <div className="update-progress">
          <div
            className="update-progress-bar"
            style={{
              width: progressWidth,
            }}
          />
        </div>
      )}

      <div className="update-toast-actions">
        {isAvailable && (
          <button
            className="update-primary-button"
            type="button"
            onClick={handleDownloadClick}
          >
            Update now
          </button>
        )}

        {isDownloading && (
          <button className="update-primary-button" type="button" disabled>
            Downloading...
          </button>
        )}

        {isDownloaded && (
          <button className="update-primary-button" type="button" disabled>
            Installing...
          </button>
        )}

        {isError && (
          <button
            className="update-secondary-button"
            type="button"
            onClick={closeUpdateToast}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
