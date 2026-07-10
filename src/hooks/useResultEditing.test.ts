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
});
