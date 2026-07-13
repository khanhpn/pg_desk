import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQueryTabConnection } from "@/hooks/useQueryTabConnection";
import type { QueryTab } from "@/hooks/useSqlQuery";

const createTab = (id: string, connectionId: string): QueryTab => ({
  id,
  connectionId,
  title: id,
  sql: "",
  savedSql: null,
  isDirty: false,
  queryResult: null,
  queryMessage: "Ready",
  isRunningQuery: false,
});

describe("useQueryTabConnection", () => {
  it("restores the tab connection before activating the tab", async () => {
    const switchConnection = vi.fn().mockResolvedValue(undefined);
    const selectTab = vi.fn();
    const setTabConnection = vi.fn();
    const { result } = renderHook(() =>
      useQueryTabConnection({
        tabs: [
          createTab("query-1", "connection-1"),
          createTab("query-2", "connection-2"),
        ],
        activeTabId: "query-1",
        activeConnectionId: "connection-1",
        switchConnection,
        selectTab,
        setTabConnection,
      }),
    );

    await act(async () => {
      await result.current.selectQueryTab("query-2");
    });

    expect(switchConnection).toHaveBeenCalledWith("connection-2");
    expect(selectTab).toHaveBeenCalledWith("query-2");
    expect(switchConnection.mock.invocationCallOrder[0]).toBeLessThan(
      selectTab.mock.invocationCallOrder[0],
    );
  });

  it("remembers a manually selected connection on the active tab", async () => {
    const switchConnection = vi.fn().mockResolvedValue(undefined);
    const setTabConnection = vi.fn();
    const { result } = renderHook(() =>
      useQueryTabConnection({
        tabs: [createTab("query-1", "connection-1")],
        activeTabId: "query-1",
        activeConnectionId: "connection-1",
        switchConnection,
        selectTab: vi.fn(),
        setTabConnection,
      }),
    );

    await act(async () => {
      await result.current.selectConnectionForActiveTab("connection-2");
    });

    expect(switchConnection).toHaveBeenCalledWith("connection-2");
    expect(setTabConnection).toHaveBeenCalledWith("query-1", "connection-2");
  });
});
