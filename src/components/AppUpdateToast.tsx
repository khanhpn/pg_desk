import { useCallback, useMemo } from "react";
import type { UpdateStatusPayload } from "@/vite-env";

type AppUpdateToastProps = {
  updateStatus: UpdateStatusPayload | null;
  isVisible: boolean;
  handleDownloadUpdate: () => Promise<void>;
  handleInstallUpdate: () => Promise<void>;
  closeUpdateToast: () => void;
};

/**
 * Displays application update status and the actions valid for that status.
 *
 * @param props - Update payload, visibility, and download/install/dismiss actions.
 * @returns The update notification, or `null` while it is hidden.
 */
export const AppUpdateToast = ({
  updateStatus,
  isVisible,
  handleDownloadUpdate,
  handleInstallUpdate,
  closeUpdateToast,
}: AppUpdateToastProps) => {
  const {
    isAvailable,
    isChecking,
    isDownloading,
    isDownloaded,
    isInstalling,
    isError,
  } = useMemo(
    () => ({
      isAvailable: updateStatus?.status === "available",
      isChecking: updateStatus?.status === "checking",
      isDownloading: updateStatus?.status === "downloading",
      isDownloaded: updateStatus?.status === "downloaded",
      isInstalling: updateStatus?.status === "installing",
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
  const handleInstallClick = useCallback((): void => {
    void handleInstallUpdate();
  }, [handleInstallUpdate]);

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

        {!isChecking && !isDownloading && !isInstalling && (
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
        {isChecking && (
          <button className="update-primary-button" type="button" disabled>
            Checking...
          </button>
        )}

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
          <button
            className="update-primary-button"
            type="button"
            onClick={handleInstallClick}
          >
            Restart & install
          </button>
        )}

        {isInstalling && (
          <button className="update-primary-button" type="button" disabled>
            Restarting...
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
