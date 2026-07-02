import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSqlQuery } from "@/hooks/useSqlQuery";

const run = vi.fn();
const explain = vi.fn();
const cancel = vi.fn();

const installPgDeskMock = (): void => {
  Object.defineProperty(window, "pgdesk", {
    configurable: true,
    value: {
      query: {
        run,
        explain,
        cancel,
      },
    },
  });
};

describe("useSqlQuery", () => {
  beforeEach(() => {
    installPgDeskMock();
    run.mockReset();
    explain.mockReset();
    cancel.mockReset();
    window.localStorage.clear();
  });

  it("creates an empty dirty tab and persists it after saving", () => {
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.createTab();
    });

    expect(result.current.activeTabId).toBe("query-2");
    expect(result.current.sql).toBe("");
    expect(result.current.isActiveTabDirty).toBe(true);

    act(() => {
      result.current.setSql("select 1;");
    });

    expect(result.current.sql).toBe("select 1;");
    expect(result.current.isActiveTabDirty).toBe(true);

    act(() => {
      result.current.saveActiveTab();
    });

    const persistedWorkspace = JSON.parse(
      window.localStorage.getItem("pgdesk.queryWorkspace") ?? "{}",
    ) as {
      activeTabId?: string;
      tabs?: Array<{ id: string; sql: string }>;
    };

    expect(result.current.isActiveTabDirty).toBe(false);
    expect(result.current.queryMessage).toBe("Tab saved");
    expect(persistedWorkspace.activeTabId).toBe("query-2");
    expect(persistedWorkspace.tabs).toContainEqual({
      id: "query-2",
      title: "Query 2",
      sql: "select 1;",
    });
  });

  it("runs the active SQL against the active connection", async () => {
    run.mockResolvedValue({
      ok: true,
      message: "ok",
      columns: ["id"],
      columnMetadata: [],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 5,
      command: "SELECT",
    });
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.setSql("select 1 as id;");
    });

    await act(async () => {
      await result.current.handleRunQuery();
    });

    expect(run).toHaveBeenCalledWith(
      `select *
from (
select 1 as id
) as pgdesk_limited_query
limit 100;`,
      "connection-1",
      expect.any(String),
    );
    expect(result.current.queryMessage).toBe("SELECT · 1 rows · 5ms");
    expect(result.current.queryResult?.rows).toEqual([{ id: 1 }]);
    expect(result.current.isRunningQuery).toBe(false);
  });

  it("applies the selected limit when running SELECT SQL", async () => {
    run.mockResolvedValue({
      ok: true,
      message: "ok",
      columns: ["id"],
      columnMetadata: [],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 5,
      command: "SELECT",
    });
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.setSql("select id from users;");
      result.current.setSelectLimit(500);
    });

    await act(async () => {
      await result.current.handleRunQuery();
    });

    expect(run).toHaveBeenCalledWith(
      `select *
from (
select id from users
) as pgdesk_limited_query
limit 500;`,
      "connection-1",
      expect.any(String),
    );
  });

  it("cancels the active query run", async () => {
    let resolveRun: ((value: unknown) => void) | null = null;
    run.mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    cancel.mockResolvedValue({ ok: true, message: "cancelled" });
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.setSql("select pg_sleep(30);");
    });

    act(() => {
      void result.current.handleRunQuery();
    });

    await waitFor(() => {
      expect(result.current.isRunningQuery).toBe(true);
    });

    await act(async () => {
      await result.current.handleStopQuery();
    });

    expect(cancel).toHaveBeenCalledWith("connection-1", expect.any(String));
    expect(result.current.queryMessage).toBe("Cancelling query...");

    await act(async () => {
      resolveRun?.({
        ok: false,
        message: "canceling statement due to user request",
        columns: [],
        columnMetadata: [],
        rows: [],
        rowCount: 0,
        durationMs: 10,
      });
    });
  });

  it("explains the active SQL against the active connection", async () => {
    explain.mockResolvedValue({
      ok: true,
      message: "Query plan generated successfully",
      columns: ["node_type", "total_cost"],
      columnMetadata: [],
      rows: [{ node_type: "Seq Scan", total_cost: 12.5 }],
      rowCount: 1,
      durationMs: 3,
      command: "EXPLAIN",
    });
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.setSql("select * from users;");
    });

    await act(async () => {
      await result.current.handleExplainQuery();
    });

    expect(explain).toHaveBeenCalledWith(
      "select * from users;",
      "connection-1",
    );
    expect(result.current.queryMessage).toBe("EXPLAIN · 1 plan nodes · 3ms");
    expect(result.current.queryResult?.rows).toEqual([
      { node_type: "Seq Scan", total_cost: 12.5 },
    ]);
    expect(result.current.isRunningQuery).toBe(false);
  });
});
