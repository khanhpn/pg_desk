import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryToolbar } from "@/components/QueryToolbar";

describe("QueryToolbar", () => {
  it("runs, formats, and saves the active query tab from toolbar buttons", () => {
    const handleRunQuery = vi.fn().mockResolvedValue(undefined);
    const handleExplainQuery = vi.fn().mockResolvedValue(undefined);
    const formatActiveTabSql = vi.fn();
    const saveActiveTab = vi.fn();

    render(
      <QueryToolbar
        isRunningQuery={false}
        isActiveTabDirty
        queryMessage="SELECT · 2 rows · 1ms"
        handleRunQuery={handleRunQuery}
        handleExplainQuery={handleExplainQuery}
        formatActiveTabSql={formatActiveTabSql}
        saveActiveTab={saveActiveTab}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Run/i }));
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    fireEvent.click(screen.getByRole("button", { name: /Explain/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save Tab" }));

    expect(handleRunQuery).toHaveBeenCalledOnce();
    expect(handleExplainQuery).toHaveBeenCalledOnce();
    expect(formatActiveTabSql).toHaveBeenCalledOnce();
    expect(saveActiveTab).toHaveBeenCalledOnce();
    expect(screen.getByText("SELECT · 2 rows · 1ms")).toBeInTheDocument();
  });

  it("disables run and save when the query is running or the tab is clean", () => {
    render(
      <QueryToolbar
        isRunningQuery
        isActiveTabDirty={false}
        queryMessage="Running query..."
        handleRunQuery={vi.fn()}
        handleExplainQuery={vi.fn()}
        formatActiveTabSql={vi.fn()}
        saveActiveTab={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Running..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Explain/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Tab" })).toBeDisabled();
  });
});
