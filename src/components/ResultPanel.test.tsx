import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import type { QueryRunResult } from "@electron/types/query";

const applyTableChanges = vi.fn();

const installPgDeskMock = (): void => {
  Object.defineProperty(window, "pgdesk", {
    configurable: true,
    value: {
      query: {
        applyTableChanges,
      },
    },
  });
};

const queryResult: QueryRunResult = {
  ok: true,
  message: "ok",
  columns: ["id", "name", "active"],
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
    {
      name: "active",
      dataTypeId: 16,
      tableOid: 10,
      columnId: 3,
      columnName: "active",
      tableSchema: "public",
      tableName: "users",
      isPrimaryKey: false,
      isEditable: true,
    },
  ],
  rows: [
    { id: 1, name: "Jane", active: true },
    { id: 2, name: "John", active: false },
  ],
  rowCount: 2,
  durationMs: 2,
  command: "SELECT",
  editMessage: "Editable cells can be saved to the database.",
};

describe("ResultPanel", () => {
  beforeEach(() => {
    installPgDeskMock();
    applyTableChanges.mockReset();
    applyTableChanges.mockResolvedValue({
      ok: true,
      message: "Saved 1 change",
      rowCount: 1,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders the empty result state before a query has run", () => {
    render(
      <ResultPanel
        connectionId="connection-1"
        queryResult={null}
        queryMessage="Ready"
        panelHeight={240}
      />,
    );

    expect(screen.getByText("No query executed yet.")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add row" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete selected rows" }),
    ).toBeDisabled();
  });

  it("renders icon actions and supports selecting multiple rows", () => {
    render(
      <ResultPanel
        connectionId="connection-1"
        queryResult={queryResult}
        queryMessage="SELECT · 2 rows · 2ms"
        panelHeight={240}
      />,
    );

    expect(screen.getByRole("button", { name: "Add row" })).toHaveAttribute(
      "title",
      "Add row",
    );
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete selected rows" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).toHaveProperty("indeterminate", true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));

    expect(screen.getByText("2 rows selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete selected rows" }),
    ).not.toBeDisabled();
  });

  it("adds a draft row and saves updates and inserts together", async () => {
    applyTableChanges.mockResolvedValue({
      ok: true,
      message: "Saved 3 changes",
      rowCount: 3,
    });

    render(
      <ResultPanel
        connectionId="connection-1"
        queryResult={queryResult}
        queryMessage="SELECT · 2 rows · 2ms"
        panelHeight={240}
      />,
    );

    fireEvent.change(screen.getByLabelText("name row 1"), {
      target: { value: "Janet" },
    });
    fireEvent.change(screen.getByLabelText("name row 2"), {
      target: { value: "Johnny" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getByLabelText("name row 3"), {
      target: { value: "Chris" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(applyTableChanges).toHaveBeenCalledTimes(1);
    });

    expect(applyTableChanges).toHaveBeenCalledWith({
      connectionId: "connection-1",
      tableOid: 10,
      updates: [
        {
          primaryKeys: [{ columnName: "id", value: 1 }],
          values: { name: "Janet" },
        },
        {
          primaryKeys: [{ columnName: "id", value: 2 }],
          values: { name: "Johnny" },
        },
      ],
      inserts: [{ values: { name: "Chris" } }],
      deletes: [],
    });
    expect(screen.getByText("Saved 3 changes")).toBeInTheDocument();
  });

  it("deletes all selected persisted rows with one confirmation", async () => {
    applyTableChanges.mockResolvedValue({
      ok: true,
      message: "Deleted 2 rows",
      rowCount: 2,
    });

    render(
      <ResultPanel
        connectionId="connection-1"
        queryResult={queryResult}
        queryMessage="SELECT · 2 rows · 2ms"
        panelHeight={240}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete selected rows" }),
    );

    await waitFor(() => {
      expect(applyTableChanges).toHaveBeenCalledTimes(1);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete 2 selected rows from public.users?\n\nThis cannot be undone.",
    );
    expect(applyTableChanges).toHaveBeenCalledWith({
      connectionId: "connection-1",
      tableOid: 10,
      updates: [],
      inserts: [],
      deletes: [
        { primaryKeys: [{ columnName: "id", value: 1 }] },
        { primaryKeys: [{ columnName: "id", value: 2 }] },
      ],
    });
    expect(screen.getByText("Deleted 2 rows")).toBeInTheDocument();
  });
});
