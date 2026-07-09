// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const getActivePostgresPoolMock = vi.fn();

vi.mock("@electron/services/postgres-connection-service", () => ({
  getActivePostgresPool: getActivePostgresPoolMock,
}));

describe("postgres metadata service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getActivePostgresPoolMock.mockReturnValue({
      query: queryMock,
    });
    queryMock
      .mockResolvedValueOnce({
        rows: [{ schema_name: "public" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            table_schema: "public",
            table_name: "users",
            table_type: "BASE TABLE",
          },
        ],
      });
  });

  it("filters PostgreSQL internal schemas from explorer queries", async () => {
    const { getPostgresExplorer } =
      await import("@electron/services/postgres-metadata-service");

    await getPostgresExplorer("auth");

    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("schema_name not like 'pg\\_%' escape '\\'"),
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("table_schema not like 'pg\\_%' escape '\\'"),
    );
  });

  it("builds SQL for table schema edits", async () => {
    const { buildTableChangeSql } =
      await import("@electron/services/postgres-metadata-service");

    expect(
      buildTableChangeSql({
        action: "change-data-type",
        schema: "public",
        table: "users",
        columnName: "age",
        dataType: "integer",
      }),
    ).toBe('alter table "public"."users" alter column "age" type integer;');

    expect(
      buildTableChangeSql({
        action: "change-default",
        schema: "public",
        table: "users",
        columnName: "created_at",
        defaultExpression: "now()",
      }),
    ).toBe(
      'alter table "public"."users" alter column "created_at" set default now();',
    );

    expect(
      buildTableChangeSql({
        action: "change-default",
        schema: "public",
        table: "users",
        columnName: "nickname",
        defaultExpression: null,
      }),
    ).toBe(
      'alter table "public"."users" alter column "nickname" drop default;',
    );

    expect(
      buildTableChangeSql({
        action: "delete-column",
        schema: "public",
        table: "users",
        columnName: "legacy_code",
      }),
    ).toBe('alter table "public"."users" drop column "legacy_code";');
  });

  it("rejects unsafe default expressions", async () => {
    const { buildTableChangeSql } =
      await import("@electron/services/postgres-metadata-service");

    expect(() => {
      buildTableChangeSql({
        action: "change-default",
        schema: "public",
        table: "users",
        columnName: "role",
        defaultExpression: "'user'; drop table users",
      });
    }).toThrow("Default expression must be a single SQL expression");
  });
});
