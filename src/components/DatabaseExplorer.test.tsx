import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import type { PgSchemaInfo } from "@/types/metadata";

const schemas: PgSchemaInfo[] = [
  {
    name: "public",
    tables: [
      { schema: "public", name: "users", type: "table" },
      { schema: "public", name: "orders", type: "table" },
    ],
    views: [{ schema: "public", name: "active_users", type: "view" }],
  },
  {
    name: "billing",
    tables: [{ schema: "billing", name: "invoices", type: "table" }],
    views: [],
  },
];

const renderExplorer = () => {
  return render(
    <DatabaseExplorer
      schemas={schemas}
      explorerMessage="Loaded 2 schemas"
      isLoadingExplorer={false}
      refreshExplorer={vi.fn()}
      selectedRelationKey={null}
      handleOpenRelation={vi.fn()}
      openTableContextMenu={vi.fn()}
    />,
  );
};

describe("DatabaseExplorer", () => {
  it("filters tables and views by relation or schema name", () => {
    renderExplorer();

    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "billing.inv" },
    });

    expect(
      screen.getByRole("button", { name: /billing/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /invoices/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /users/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1/4 matches")).toBeInTheDocument();
  });

  it("shows a focused empty state when the filter has no matches", () => {
    renderExplorer();

    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "audit_log" },
    });

    expect(
      screen.getByText("No tables or views match this filter."),
    ).toBeInTheDocument();
  });

  it("keeps relation selection working after filtering", () => {
    const handleOpenRelation = vi.fn();

    render(
      <DatabaseExplorer
        schemas={schemas}
        explorerMessage="Loaded 2 schemas"
        isLoadingExplorer={false}
        refreshExplorer={vi.fn()}
        selectedRelationKey={null}
        handleOpenRelation={handleOpenRelation}
        openTableContextMenu={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: /active_users/i }));

    expect(handleOpenRelation).toHaveBeenCalledWith({
      schema: "public",
      name: "active_users",
      type: "view",
    });
  });
});
