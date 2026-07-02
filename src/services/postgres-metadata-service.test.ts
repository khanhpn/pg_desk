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
});
