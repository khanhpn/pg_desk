import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useResultRowSelection } from "@/hooks/useResultRowSelection";
import type { QueryRunResult } from "@electron/types/query";

const queryResult = (id: string): QueryRunResult => ({
  ok: true,
  message: "ok",
  columns: ["id"],
  columnMetadata: [],
  rows: [{ id }],
  rowCount: 1,
  durationMs: 1,
});

describe("useResultRowSelection", () => {
  it("supports selecting multiple rows and toggling all rows", () => {
    const currentResult = queryResult("first");
    const { result } = renderHook(() =>
      useResultRowSelection({
        queryResult: currentResult,
        rowIds: ["row-1", "row-2", "row-3"],
      }),
    );

    act(() => {
      result.current.toggleRow("row-1");
      result.current.toggleRow("row-3");
    });

    expect(result.current.selectedRowIds).toEqual(["row-1", "row-3"]);
    expect(result.current.selectedRowCount).toBe(2);
    expect(result.current.allRowsSelected).toBe(false);

    act(() => {
      result.current.toggleAllRows();
    });

    expect(result.current.selectedRowIds).toEqual(["row-1", "row-2", "row-3"]);
    expect(result.current.allRowsSelected).toBe(true);

    act(() => {
      result.current.toggleRow("row-2");
    });

    expect(result.current.selectedRowIds).toEqual(["row-1", "row-3"]);
  });

  it("clears selection when the query result changes", () => {
    const { result, rerender } = renderHook(
      ({ currentResult }: { currentResult: QueryRunResult }) =>
        useResultRowSelection({
          queryResult: currentResult,
          rowIds: ["row-1"],
        }),
      { initialProps: { currentResult: queryResult("first") } },
    );

    act(() => {
      result.current.toggleRow("row-1");
    });

    rerender({ currentResult: queryResult("second") });

    expect(result.current.selectedRowIds).toEqual([]);
    expect(result.current.selectedRowCount).toBe(0);
  });
});
