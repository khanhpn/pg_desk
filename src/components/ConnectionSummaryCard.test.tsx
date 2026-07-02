import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionSummaryCard } from "@/components/ConnectionSummaryCard";
import type { PgConnectionProfile } from "@/types/connection";

const profiles: PgConnectionProfile[] = [
  {
    id: "auth",
    name: "auth",
    host: "localhost",
    port: 5432,
    database: "auth",
    user: "root",
    password: "secret",
    ssl: false,
  },
  {
    id: "billing",
    name: "billing",
    host: "localhost",
    port: 5433,
    database: "billing",
    user: "root",
    password: "secret",
    ssl: false,
  },
];

const renderCard = () => {
  return render(
    <ConnectionSummaryCard
      connectionProfiles={profiles}
      activeConnectionId="auth"
      connectedConnectionIds={["auth"]}
      connectionMessage="Connected to auth"
      databaseTaskConnectionId={null}
      openNewConnectionModal={vi.fn()}
      editConnectionProfile={vi.fn()}
      connectConnectionProfile={vi.fn()}
      selectConnectionProfile={vi.fn()}
      deleteConnectionProfile={vi.fn()}
      handleDisconnect={vi.fn()}
      handleBackupDatabase={vi.fn()}
      handleRestoreDatabase={vi.fn()}
    />,
  );
};

describe("ConnectionSummaryCard", () => {
  it("collapses the connection list to free sidebar space", () => {
    renderCard();

    expect(screen.getByRole("button", { name: /backup/i })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /collapse connections/i }),
    );

    expect(
      screen.queryByRole("button", { name: /backup/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("auth active")).toBeInTheDocument();
    expect(screen.getAllByText("2 saved profiles")).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", { name: /expand connections/i }),
    );

    expect(screen.getByRole("button", { name: /backup/i })).toBeInTheDocument();
  });
});
