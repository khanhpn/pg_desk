import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Topbar } from "@/components/Topbar";
import type { QueryTab } from "@/hooks/useSqlQuery";

const createTab = (overrides: Partial<QueryTab> = {}): QueryTab => ({
  id: "query-1",
  connectionId: "connection-1",
  title: "Query 1",
  sql: "select 1;",
  savedSql: "select 1;",
  isDirty: false,
  queryResult: null,
  queryMessage: "Ready",
  isRunningQuery: false,
  ...overrides,
});

describe("Topbar", () => {
  it("disables new tabs until a database is connected", () => {
    render(
      <Topbar
        tabs={[createTab()]}
        activeTabId="query-1"
        canCreateTab={false}
        createTab={vi.fn()}
        selectTab={vi.fn()}
        closeTab={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "New query tab" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Close/i }),
    ).not.toBeInTheDocument();
  });

  it("selects, closes, and creates tabs from the tab strip", () => {
    const createNewTab = vi.fn();
    const selectTab = vi.fn();
    const closeTab = vi.fn();

    render(
      <Topbar
        tabs={[
          createTab({ id: "query-1", title: "Query 1" }),
          createTab({
            id: "query-2",
            title: "users",
            isDirty: true,
            savedSql: null,
          }),
        ]}
        activeTabId="query-1"
        canCreateTab
        createTab={createNewTab}
        selectTab={selectTab}
        closeTab={closeTab}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /users/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close users" }));
    fireEvent.click(screen.getByRole("button", { name: "New query tab" }));

    expect(screen.getByText("*")).toBeInTheDocument();
    expect(selectTab).toHaveBeenCalledWith("query-2");
    expect(closeTab).toHaveBeenCalledWith("query-2");
    expect(createNewTab).toHaveBeenCalledOnce();
  });
});
