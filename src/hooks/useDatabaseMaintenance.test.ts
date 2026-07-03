import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDatabaseMaintenance } from "@/hooks/useDatabaseMaintenance";

const backup = vi.fn();
const restore = vi.fn();
const listDatabases = vi.fn();
const chooseBackupFolder = vi.fn();
const chooseRestoreFiles = vi.fn();
const backupMany = vi.fn();
const restoreMany = vi.fn();
const onOpenBackupModal = vi.fn(() => {
  return vi.fn();
});
const onOpenRestoreModal = vi.fn(() => {
  return vi.fn();
});

const createHookOptions = (refreshExplorer: () => Promise<void>) => {
  return {
    refreshExplorer,
    activeConnectionId: "connection-1",
    connectedConnectionIds: ["connection-1"],
  };
};

const installPgDeskMock = (): void => {
  Object.defineProperty(window, "pgdesk", {
    configurable: true,
    value: {
      database: {
        backup,
        restore,
        listDatabases,
        chooseBackupFolder,
        chooseRestoreFiles,
        backupMany,
        restoreMany,
        onOpenBackupModal,
        onOpenRestoreModal,
      },
    },
  });
};

describe("useDatabaseMaintenance", () => {
  beforeEach(() => {
    installPgDeskMock();
    backup.mockReset();
    restore.mockReset();
    listDatabases.mockReset();
    chooseBackupFolder.mockReset();
    chooseRestoreFiles.mockReset();
    backupMany.mockReset();
    restoreMany.mockReset();
    onOpenBackupModal.mockClear();
    onOpenRestoreModal.mockClear();
    vi.useRealTimers();
  });

  it("backs up the requested connection and exposes the result message", async () => {
    backup.mockResolvedValue({
      ok: true,
      message: "Backup saved to users_v1_2026_06_30.sql",
    });
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance(createHookOptions(refreshExplorer)),
    );

    await act(async () => {
      await result.current.handleBackupDatabase("connection-1");
    });

    expect(backup).toHaveBeenCalledWith("connection-1");
    expect(refreshExplorer).not.toHaveBeenCalled();
    expect(result.current.databaseTaskConnectionId).toBeNull();
    expect(result.current.databaseMaintenanceMessage).toBe(
      "Backup saved to users_v1_2026_06_30.sql",
    );
  });

  it("shows a success toast after backup and closes it automatically", async () => {
    vi.useFakeTimers();
    backup.mockResolvedValue({
      ok: true,
      message: "Backup saved to auth_v1_2026_07_02.sql",
    });
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance(createHookOptions(refreshExplorer)),
    );

    await act(async () => {
      await result.current.handleBackupDatabase("connection-1");
    });

    expect(result.current.databaseMaintenanceToast).toEqual({
      status: "success",
      title: "Backup complete",
      message: "Backup saved to auth_v1_2026_07_02.sql",
    });

    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(result.current.databaseMaintenanceToast).toBeNull();
  });

  it("keeps backup errors visible until the toast is closed", async () => {
    backup.mockResolvedValue({
      ok: false,
      message: "pg_dump failed",
    });
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance(createHookOptions(refreshExplorer)),
    );

    await act(async () => {
      await result.current.handleBackupDatabase("connection-1");
    });

    expect(result.current.databaseMaintenanceToast).toEqual({
      status: "error",
      title: "Backup failed",
      message: "Error: pg_dump failed",
    });

    act(() => {
      result.current.closeDatabaseMaintenanceToast();
    });

    expect(result.current.databaseMaintenanceToast).toBeNull();
  });

  it("does not restore the database when the confirmation is rejected", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance(createHookOptions(refreshExplorer)),
    );

    await act(async () => {
      await result.current.handleRestoreDatabase("connection-1");
    });

    expect(confirm).toHaveBeenCalledOnce();
    expect(restore).not.toHaveBeenCalled();
    expect(refreshExplorer).not.toHaveBeenCalled();
    expect(result.current.databaseMaintenanceMessage).toBe("");
  });

  it("restores the requested connection and refreshes the explorer after success", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    restore.mockResolvedValue({
      ok: true,
      message: "Restored postgres from backup.sql",
    });
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance(createHookOptions(refreshExplorer)),
    );

    await act(async () => {
      await result.current.handleRestoreDatabase("connection-1");
    });

    expect(restore).toHaveBeenCalledWith("connection-1");
    expect(refreshExplorer).toHaveBeenCalledOnce();
    expect(result.current.databaseTaskConnectionId).toBeNull();
    expect(result.current.databaseMaintenanceMessage).toBe(
      "Restored postgres from backup.sql",
    );
  });
});
