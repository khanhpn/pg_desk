import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableInspectorDrawer } from "@/components/TableInspectorDrawer";
import type { PgTableDetail } from "@/types/metadata";

const tableDetail: PgTableDetail = {
  schema: "public",
  name: "users",
  columns: [
    {
      name: "id",
      ordinalPosition: 1,
      dataType: "integer",
      isNullable: false,
      defaultValue: null,
      isPrimaryKey: true,
      isForeignKey: false,
      characterMaximumLength: null,
      numericPrecision: null,
      numericScale: null,
    },
    {
      name: "status",
      ordinalPosition: 2,
      dataType: "text",
      isNullable: true,
      defaultValue: null,
      isPrimaryKey: false,
      isForeignKey: false,
      characterMaximumLength: null,
      numericPrecision: null,
      numericScale: null,
    },
  ],
  foreignKeys: [],
  indexes: [],
};

const renderInspector = (): void => {
  render(
    <TableInspectorDrawer
      connectionId="connection-1"
      relation={{ schema: "public", name: "users", type: "table" }}
      tableDetail={tableDetail}
      isLoading={false}
      message=""
      closeDrawer={vi.fn()}
      refreshTableInspector={vi.fn()}
    />,
  );
};

describe("TableInspectorDrawer", () => {
  it("previews default value and delete column schema edits", () => {
    renderInspector();

    fireEvent.click(screen.getByRole("button", { name: "Edit schema" }));
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "change-default" },
    });
    fireEvent.change(screen.getByLabelText("Column"), {
      target: { value: "status" },
    });
    fireEvent.change(screen.getByLabelText("Default expression"), {
      target: { value: "'active'" },
    });

    expect(
      screen.getByText(
        'alter table "public"."users" alter column "status" set default \'active\';',
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "delete-column" },
    });

    expect(
      screen.getByText('alter table "public"."users" drop column "status";'),
    ).toBeInTheDocument();
  });
});
