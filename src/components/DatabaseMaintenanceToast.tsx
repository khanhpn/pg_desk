import type { DatabaseMaintenanceToast as DatabaseMaintenanceToastState } from "@/hooks/useDatabaseMaintenance";

type DatabaseMaintenanceToastProps = {
  toast: DatabaseMaintenanceToastState | null;
  closeToast: () => void;
};

/**
 * Displays progress and completion feedback for database maintenance tasks.
 *
 * @param props - Current maintenance notification and its dismiss callback.
 * @returns A status toast, or `null` when no maintenance task is visible.
 */
export const DatabaseMaintenanceToast = ({
  toast,
  closeToast,
}: DatabaseMaintenanceToastProps) => {
  if (!toast) {
    return null;
  }

  const isProgress = toast.status === "progress";

  return (
    <div className={`app-toast database-toast ${toast.status}`}>
      <div className="app-toast-status-mark" />

      <div className="app-toast-content">
        <div className="app-toast-title">{toast.title}</div>
        <div className="app-toast-message">{toast.message}</div>
      </div>

      {!isProgress && (
        <button
          className="app-toast-close"
          type="button"
          aria-label="Close database message"
          onClick={closeToast}
        >
          ×
        </button>
      )}
    </div>
  );
};
