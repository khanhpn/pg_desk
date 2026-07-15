import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTableInspector } from "@/hooks/useTableInspector";
import type {
  PgRelationInfo,
  PgTableDetail,
  PgTableDetailResult,
} from "@/types/metadata";

const tableDetail = vi.fn();

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

const relation = (name: string): PgRelationInfo => ({
  schema: "public",
  name,
  type: "table",
});

const detail = (name: string): PgTableDetail => ({
  schema: "public",
  name,
  columns: [],
  foreignKeys: [],
  indexes: [],
});

describe("useTableInspector", () => {
  beforeEach(() => {
    tableDetail.mockReset();
    Object.defineProperty(window, "pgdesk", {
      configurable: true,
      value: { metadata: { tableDetail } },
    });
  });

  it("keeps details from the latest selected table", async () => {
    const first = deferred<PgTableDetailResult>();
    const second = deferred<PgTableDetailResult>();
    tableDetail
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTableInspector("connection-1"));

    act(() => {
      void result.current.openTableInspector(relation("first"));
      void result.current.openTableInspector(relation("second"));
    });

    await act(async () => {
      second.resolve({ ok: true, message: "second", table: detail("second") });
    });
    await act(async () => {
      first.resolve({ ok: true, message: "first", table: detail("first") });
    });

    expect(result.current.selectedTable?.name).toBe("second");
    expect(result.current.tableDetail?.name).toBe("second");
    expect(result.current.tableDetailMessage).toBe("second");
  });

  it("ignores a pending detail response after the inspector closes", async () => {
    const pending = deferred<PgTableDetailResult>();
    tableDetail.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useTableInspector("connection-1"));

    act(() => {
      void result.current.openTableInspector(relation("users"));
    });
    act(() => {
      result.current.closeTableInspector();
    });
    await act(async () => {
      pending.resolve({ ok: true, message: "users", table: detail("users") });
    });

    expect(result.current.selectedTable).toBeNull();
    expect(result.current.tableDetail).toBeNull();
    expect(result.current.tableDetailMessage).toBe("");
  });
});
