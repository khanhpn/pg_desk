import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDatabaseExplorer } from "@/hooks/useDatabaseExplorer";
import type { PgDatabaseExplorerResult } from "@/types/metadata";

const explorer = vi.fn();

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

describe("useDatabaseExplorer", () => {
  beforeEach(() => {
    explorer.mockReset();
    Object.defineProperty(window, "pgdesk", {
      configurable: true,
      value: { metadata: { explorer } },
    });
  });

  it("keeps metadata from the latest connection request", async () => {
    const first = deferred<PgDatabaseExplorerResult>();
    const second = deferred<PgDatabaseExplorerResult>();
    explorer
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ connectionId }) => useDatabaseExplorer(connectionId),
      { initialProps: { connectionId: "connection-1" } },
    );

    act(() => {
      void result.current.refreshExplorer();
    });
    rerender({ connectionId: "connection-2" });
    act(() => {
      void result.current.refreshExplorer();
    });

    await act(async () => {
      second.resolve({
        ok: true,
        message: "loaded second",
        schemas: [{ name: "second", tables: [], views: [] }],
      });
    });
    await act(async () => {
      first.resolve({
        ok: true,
        message: "loaded first",
        schemas: [{ name: "first", tables: [], views: [] }],
      });
    });

    expect(result.current.schemas.map((schema) => schema.name)).toEqual([
      "second",
    ]);
    expect(result.current.explorerMessage).toBe("Loaded 1 schemas");
    expect(result.current.isLoadingExplorer).toBe(false);
  });

  it("clears metadata that belongs to the previous connection", async () => {
    explorer.mockResolvedValue({
      ok: true,
      message: "loaded",
      schemas: [{ name: "first", tables: [], views: [] }],
    });
    const { result, rerender } = renderHook(
      ({ connectionId }) => useDatabaseExplorer(connectionId),
      { initialProps: { connectionId: "connection-1" } },
    );

    await act(async () => {
      await result.current.refreshExplorer();
    });
    expect(result.current.schemas).toHaveLength(1);

    rerender({ connectionId: "connection-2" });

    expect(result.current.schemas).toEqual([]);
    expect(result.current.explorerMessage).toBe("Not loaded");
  });
});
