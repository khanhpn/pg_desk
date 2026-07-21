// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  applyPostgresTableChangesFromPool,
  buildQueryColumnMetadata,
  deletePostgresRowFromPool,
  normalizeQueryResultRows,
} from "@electron/services/postgres-connection-service";

describe("normalizeQueryResultRows", () => {
  it("preserves values when SELECT returns duplicate column names", () => {
    const result = normalizeQueryResultRows(
      [{ name: "id" }, { name: "id" }, { name: "name" }],
      [[99, 1, "Alice"]],
    );

    expect(result).toEqual({
      columns: ["id", "id (2)", "name"],
      rows: [{ id: 99, "id (2)": 1, name: "Alice" }],
    });
  });
});

describe("buildQueryColumnMetadata", () => {
  it("includes formatted data types and source-column default status", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            table_oid: 10,
            schema_name: "public",
            table_name: "users",
            column_name: "id",
            column_id: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            table_oid: 10,
            schema_name: "public",
            table_name: "users",
            column_name: "id",
            column_id: 1,
            formatted_data_type: "character varying(120)",
            has_default: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { type_oid: 23, formatted_data_type: "integer" },
          { type_oid: 25, formatted_data_type: "text" },
        ],
      });

    const result = await buildQueryColumnMetadata(
      { query } as never,
      [
        { name: "id", dataTypeID: 23, tableID: 10, columnID: 1 },
        { name: "label", dataTypeID: 25, tableID: 0, columnID: 0 },
      ],
      ["id", "label"],
    );

    expect(result.columns[0]).toMatchObject({
      dataType: "character varying(120)",
      hasDefault: true,
    });
    expect(result.columns[1]).toMatchObject({
      dataType: "text",
      hasDefault: false,
    });
  });
});

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

describe("applyPostgresTableChangesFromPool", () => {
  it("applies updates, inserts, and deletes in one parameterized transaction", async () => {
    const clientQuery = vi
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
            column_name: "display name",
            is_primary_key: false,
          },
          {
            schema_name: "public",
            table_name: "users",
            column_name: "active",
            is_primary_key: false,
          },
        ],
      })
      .mockResolvedValue({ rowCount: 1 });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await applyPostgresTableChangesFromPool(pool as never, {
      connectionId: "connection-1",
      tableOid: 10,
      updates: [
        {
          primaryKeys: [{ columnName: "id", value: 1 }],
          values: { "display name": "Janet", active: false },
        },
      ],
      inserts: [{ values: { "display name": "Chris", active: true } }],
      deletes: [
        {
          primaryKeys: [{ columnName: "id", value: 2 }],
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      message: "Saved 3 changes",
      rowCount: 3,
    });
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(clientQuery).toHaveBeenNthCalledWith(2, "begin");
    expect(clientQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('update "public"."users"'),
      ["Janet", false, 1],
    );
    expect(clientQuery.mock.calls[2][0]).toContain('"display name" = $1');
    expect(clientQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('insert into "public"."users"'),
      ["Chris", true],
    );
    expect(clientQuery).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('delete from "public"."users"'),
      [2],
    );
    expect(clientQuery).toHaveBeenNthCalledWith(6, "commit");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back when a requested row is no longer available", async () => {
    const clientQuery = vi
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
      .mockResolvedValueOnce({ rowCount: null })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: null });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await applyPostgresTableChangesFromPool(pool as never, {
      connectionId: "connection-1",
      tableOid: 10,
      updates: [
        {
          primaryKeys: [{ columnName: "id", value: 99 }],
          values: { name: "Missing" },
        },
      ],
      inserts: [],
      deletes: [],
    });

    expect(result).toEqual({
      ok: false,
      message: "No row was updated. The row may have changed.",
      rowCount: 0,
    });
    expect(clientQuery).toHaveBeenNthCalledWith(4, "rollback");
    expect(clientQuery.mock.calls.some(([sql]) => sql === "commit")).toBe(
      false,
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
