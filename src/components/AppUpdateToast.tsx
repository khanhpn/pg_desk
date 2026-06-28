import { UpdateStatusPayload } from "@/vite-env";

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
  if (!isVisible || !updateStatus) {
    return null;
  }

  const isAvailable = updateStatus.status === "available";
  const isDownloading = updateStatus.status === "downloading";
  const isDownloaded = updateStatus.status === "downloaded";
  const isError = updateStatus.status === "error";

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
              width: `${Math.round(updateStatus.percent ?? 0)}%`,
            }}
          />
        </div>
      )}

      <div className="update-toast-actions">
        {isAvailable && (
          <button
            className="update-primary-button"
            type="button"
            onClick={() => {
              void handleDownloadUpdate();
            }}
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
