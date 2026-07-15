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
      connectionId: "connection-1",
    });
  });

  it("stores a separate connection context for each query tab", () => {
    const { result, rerender } = renderHook(
      ({ connectionId }) => useSqlQuery(connectionId),
      { initialProps: { connectionId: "connection-1" } },
    );

    expect(result.current.tabs[0].connectionId).toBe("connection-1");

    act(() => {
      result.current.createTab();
    });

    rerender({ connectionId: "connection-2" });
    act(() => {
      result.current.setTabConnection("query-2", "connection-2");
    });

    expect(result.current.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "query-1",
          connectionId: "connection-1",
        }),
        expect.objectContaining({
          id: "query-2",
          connectionId: "connection-2",
        }),
      ]),
    );
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

  it("runs a saved tab against its remembered connection", async () => {
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
    const firstRender = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      firstRender.result.current.setSql("select id, * from users;");
    });
    act(() => {
      firstRender.result.current.saveActiveTab();
    });
    firstRender.unmount();

    const secondRender = renderHook(() => useSqlQuery("connection-2"));

    expect(secondRender.result.current.tabs[0].connectionId).toBe(
      "connection-1",
    );
    expect(secondRender.result.current.queryConnectionId).toBe("connection-1");

    await act(async () => {
      await secondRender.result.current.handleRunQuery();
    });

    expect(run).toHaveBeenCalledWith(
      `select *
from (
select id, * from users
) as pgdesk_limited_query
limit 100;`,
      "connection-1",
      expect.any(String),
    );
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

  it("runs only the selected SQL when the editor has a selection", async () => {
    run.mockResolvedValue({
      ok: true,
      message: "ok",
      columns: ["id"],
      columnMetadata: [],
      rows: [{ id: 2 }],
      rowCount: 1,
      durationMs: 5,
      command: "SELECT",
    });
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      result.current.setSql("select 1 as first;\n\nselect 2 as second;");
      result.current.setSqlSelection("select 2 as second;");
    });

    await act(async () => {
      await result.current.handleRunQuery();
    });

    expect(run).toHaveBeenCalledWith(
      `select *
from (
select 2 as second
) as pgdesk_limited_query
limit 100;`,
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

  it("cancels the request owned by the active tab", async () => {
    const pendingRuns: Array<(value: unknown) => void> = [];
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingRuns.push(resolve);
        }),
    );
    cancel.mockResolvedValue({ ok: true, message: "cancelled" });
    const { result, rerender } = renderHook(
      ({ connectionId }) => useSqlQuery(connectionId),
      { initialProps: { connectionId: "connection-1" } },
    );

    act(() => {
      void result.current.handleRunQuery();
    });

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
    const firstRequestId = run.mock.calls[0][2] as string;

    act(() => {
      result.current.createTab();
    });
    rerender({ connectionId: "connection-2" });
    act(() => {
      result.current.setTabConnection("query-2", "connection-2");
      void result.current.handleRunQuery();
    });

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
    });

    act(() => {
      result.current.selectTab("query-1");
    });
    rerender({ connectionId: "connection-1" });

    await act(async () => {
      await result.current.handleStopQuery();
    });

    expect(cancel).toHaveBeenCalledWith("connection-1", firstRequestId);

    await act(async () => {
      pendingRuns.forEach((resolve) => {
        resolve({
          ok: false,
          message: "cancelled",
          columns: [],
          columnMetadata: [],
          rows: [],
          rowCount: 0,
          durationMs: 1,
        });
      });
    });
  });

  it("ignores a duplicate run while the active tab is already running", async () => {
    const pendingRuns: Array<(value: unknown) => void> = [];
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingRuns.push(resolve);
        }),
    );
    const { result } = renderHook(() => useSqlQuery("connection-1"));

    act(() => {
      void result.current.handleRunQuery();
    });
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });

    act(() => {
      void result.current.handleRunQuery();
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.isRunningQuery).toBe(true);

    await act(async () => {
      pendingRuns[0]({
        ok: true,
        message: "done",
        columns: ["value"],
        columnMetadata: [],
        rows: [{ value: "done" }],
        rowCount: 1,
        durationMs: 1,
        command: "SELECT",
      });
    });

    expect(result.current.isRunningQuery).toBe(false);
    expect(result.current.queryResult?.rows).toEqual([{ value: "done" }]);
  });

  it("falls back to a default workspace when persisted tabs are malformed", () => {
    window.localStorage.setItem(
      "pgdesk.queryWorkspace",
      JSON.stringify({
        tabs: [{ id: null, title: "Broken", sql: "select 1" }],
        activeTabId: "query-1",
        nextTabIndex: 2,
      }),
    );

    const { result } = renderHook(() => useSqlQuery("connection-1"));

    expect(result.current.activeTabId).toBe("query-1");
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.sql).toContain("current_database()");
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

  it("explains a saved tab against its remembered connection", async () => {
    window.localStorage.setItem(
      "pgdesk.queryWorkspace",
      JSON.stringify({
        tabs: [
          {
            id: "query-1",
            connectionId: "connection-1",
            title: "Users",
            sql: "select id, * from users;",
          },
        ],
        activeTabId: "query-1",
        nextTabIndex: 2,
      }),
    );
    explain.mockResolvedValue({
      ok: true,
      message: "ok",
      columns: [],
      columnMetadata: [],
      rows: [],
      rowCount: 0,
      durationMs: 1,
      command: "EXPLAIN",
    });
    const { result } = renderHook(() => useSqlQuery("connection-2"));

    await act(async () => {
      await result.current.handleExplainQuery();
    });

    expect(explain).toHaveBeenCalledWith(
      "select id, * from users;",
      "connection-1",
    );
  });
});
