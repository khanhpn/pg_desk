import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import type { QueryRunResult } from "@electron/types/query";

const updateCell = vi.fn();

const installPgDeskMock = (): void => {
  Object.defineProperty(window, "pgdesk", {
    configurable: true,
    value: {
      query: {
        updateCell,
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
  rows: [{ id: 1, name: "Jane", active: true }],
  rowCount: 1,
  durationMs: 2,
  command: "SELECT",
  editMessage: "Editable cells can be saved to the database.",
};

describe("ResultPanel", () => {
  beforeEach(() => {
    installPgDeskMock();
    updateCell.mockReset();
    updateCell.mockResolvedValue({
      ok: true,
      message: "saved",
      rowCount: 1,
    });
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
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("edits text and boolean cells and saves changed values to the database", async () => {
    render(
      <ResultPanel
        connectionId="connection-1"
        queryResult={queryResult}
        queryMessage="SELECT · 1 rows · 2ms"
        panelHeight={240}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Jane"), {
      target: { value: "Janet" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save (2)" }));

    await waitFor(() => {
      expect(updateCell).toHaveBeenCalledTimes(2);
    });

    expect(updateCell).toHaveBeenCalledWith({
      connectionId: "connection-1",
      tableOid: 10,
      columnName: "name",
      primaryKeys: [{ columnName: "id", value: 1 }],
      value: "Janet",
    });
    expect(updateCell).toHaveBeenCalledWith({
      connectionId: "connection-1",
      tableOid: 10,
      columnName: "active",
      primaryKeys: [{ columnName: "id", value: 1 }],
      value: false,
    });
    expect(screen.getByText("Saved 2 changes")).toBeInTheDocument();
  });
});
