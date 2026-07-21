import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResultEditing } from "@/hooks/useResultEditing";
import type { QueryRunResult } from "@electron/types/query";

const queryResult: QueryRunResult = {
  ok: true,
  message: "ok",
  columns: ["id", "name"],
  columnMetadata: [
    {
      name: "id",
      dataTypeId: 23,
      dataType: "integer",
      hasDefault: true,
      tableOid: 10,
      columnId: 1,
      columnName: "id",
      tableSchema: "public",
      tableName: "users",
      isPrimaryKey: true,
      isEditable: false,
    },
    {
      name: "name",
      dataTypeId: 25,
      dataType: "text",
      hasDefault: false,
      tableOid: 10,
      columnId: 2,
      columnName: "name",
      tableSchema: "public",
      tableName: "users",
      isPrimaryKey: false,
      isEditable: true,
    },
  ],
  rows: [{ id: 1, name: "Jane" }],
  rowCount: 1,
  durationMs: 1,
};

describe("useResultEditing", () => {
  beforeEach(() => {
    Object.defineProperty(window, "pgdesk", {
      configurable: true,
      value: {
        query: {
          applyTableChanges: vi.fn(),
        },
      },
    });
  });

  it("adds a stable draft row with editable cells", () => {
    const { result } = renderHook(() =>
      useResultEditing(queryResult, "connection-1"),
    );

    expect(result.current.canInsertRows).toBe(true);

    act(() => {
      result.current.addRow();
    });

    expect(result.current.draftRows).toHaveLength(2);
    expect(result.current.draftRows[1]).toMatchObject({
      isNew: true,
      values: { id: null, name: null },
    });
    expect(result.current.draftRows[1].id).toMatch(/^new-/);
  });

  it("keeps an updated row in place after saving", async () => {
    const refreshResult = vi.fn().mockResolvedValue(undefined);
    const resultWithMultipleRows: QueryRunResult = {
      ...queryResult,
      rows: [
        { id: 1, name: "Jane" },
        { id: 2, name: "John" },
        { id: 3, name: "Jill" },
      ],
      rowCount: 3,
    };
    vi.mocked(window.pgdesk.query.applyTableChanges).mockResolvedValue({
      ok: true,
      message: "Saved 1 row",
      rowCount: 1,
    });
    const { result } = renderHook(() =>
      useResultEditing(resultWithMultipleRows, "connection-1", refreshResult),
    );
    const middleRowId = result.current.draftRows[1].id;

    act(() => {
      result.current.updateDraftCell(middleRowId, "name", "Johnny");
    });

    await act(async () => {
      await result.current.saveChanges();
    });

    expect(refreshResult).not.toHaveBeenCalled();
    expect(result.current.draftRows.map((row) => row.values)).toEqual([
      { id: 1, name: "Jane" },
      { id: 2, name: "Johnny" },
      { id: 3, name: "Jill" },
    ]);
    expect(result.current.hasPendingChanges).toBe(false);
  });
});
