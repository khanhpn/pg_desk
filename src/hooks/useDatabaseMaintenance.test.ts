import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDatabaseMaintenance } from "@/hooks/useDatabaseMaintenance";

const backup = vi.fn();
const restore = vi.fn();

const installPgDeskMock = (): void => {
  Object.defineProperty(window, "pgdesk", {
    configurable: true,
    value: {
      database: {
        backup,
        restore,
      },
    },
  });
};

describe("useDatabaseMaintenance", () => {
  beforeEach(() => {
    installPgDeskMock();
    backup.mockReset();
    restore.mockReset();
  });

  it("backs up the requested connection and exposes the result message", async () => {
    backup.mockResolvedValue({
      ok: true,
      message: "Backup saved to users_v1_2026_06_30.sql",
    });
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance({ refreshExplorer }),
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

  it("does not restore the database when the confirmation is rejected", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const refreshExplorer = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDatabaseMaintenance({ refreshExplorer }),
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
      useDatabaseMaintenance({ refreshExplorer }),
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
