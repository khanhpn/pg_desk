import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRelationSelection } from "@/hooks/useRelationSelection";
import type { PgRelationInfo } from "@/types/metadata";

const usersTable: PgRelationInfo = {
  schema: "public",
  name: "users",
  type: "table",
};

describe("useRelationSelection", () => {
  it("selects a relation and opens it in the query editor", async () => {
    const handleOpenRelation = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRelationSelection("connection-1", handleOpenRelation),
    );

    await act(async () => {
      await result.current.handleSelectRelation(usersTable);
    });

    expect(result.current.selectedRelationKey).toBe("public.users");
    expect(handleOpenRelation).toHaveBeenCalledWith("public", "users");
  });

  it("clears the selected relation when the active connection changes", async () => {
    const handleOpenRelation = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ connectionId }) =>
        useRelationSelection(connectionId, handleOpenRelation),
      {
        initialProps: {
          connectionId: "connection-1",
        },
      },
    );

    await act(async () => {
      await result.current.handleSelectRelation(usersTable);
    });

    expect(result.current.selectedRelationKey).toBe("public.users");

    rerender({ connectionId: "connection-2" });

    expect(result.current.selectedRelationKey).toBeNull();
  });
});
