// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { deletePostgresRowFromPool } from "@electron/services/postgres-connection-service";

describe("deletePostgresRowFromPool", () => {
  it("deletes a row by primary key using bound values", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            schema_name: "public",
            table_name: "users",
            column_name: "id",
            is_primary_key: true,
          },
          {
            schema_name: "public",
            table_name: "users",
            column_name: "name",
            is_primary_key: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await deletePostgresRowFromPool({ query } as never, {
      connectionId: "connection-1",
      tableOid: 10,
      primaryKeys: [{ columnName: "id", value: 1 }],
    });

    expect(result).toEqual({
      ok: true,
      message: "Deleted 1 row",
      rowCount: 1,
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('delete from "public"."users"'),
      [1],
    );
    expect(query.mock.calls[1][0]).toContain('where "id" = $1');
  });

  it("refuses to delete when the table primary keys are incomplete", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          schema_name: "public",
          table_name: "users",
          column_name: "id",
          is_primary_key: true,
        },
      ],
    });

    const result = await deletePostgresRowFromPool({ query } as never, {
      connectionId: "connection-1",
      tableOid: 10,
      primaryKeys: [],
    });

    expect(result).toEqual({
      ok: false,
      message: "Primary key values are required to delete this row",
      rowCount: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete when the payload includes non-primary-key columns", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          schema_name: "public",
          table_name: "users",
          column_name: "id",
          is_primary_key: true,
        },
        {
          schema_name: "public",
          table_name: "users",
          column_name: "name",
          is_primary_key: false,
        },
      ],
    });

    const result = await deletePostgresRowFromPool({ query } as never, {
      connectionId: "connection-1",
      tableOid: 10,
      primaryKeys: [
        { columnName: "id", value: 1 },
        { columnName: "name", value: "Jane" },
      ],
    });

    expect(result).toEqual({
      ok: false,
      message: "Primary key values are required to delete this row",
      rowCount: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
