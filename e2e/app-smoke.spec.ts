import { expect, test, _electron as electron } from "@playwright/test";
import path from "node:path";

test("opens the built app and renders the main query workspace", async () => {
  const electronApp = await electron.launch({
    args: [path.resolve(".")],
  });

  try {
    const window = await electronApp.firstWindow();

    await expect(window).toHaveTitle(/pgdesk/i);
    await expect(
      window.getByRole("tablist", { name: "Query tabs" }),
    ).toBeVisible();
    await expect(window.getByRole("tab", { name: "Query 1" })).toBeVisible();
    await expect(
      window.getByRole("button", { name: "New query tab" }),
    ).toBeDisabled();
    await expect(window.getByText("No query executed yet.")).toBeVisible();

    await window.getByRole("button", { name: /not tested|pong/i }).click();
    await expect(
      window.getByRole("button", { name: /pong from Electron main process/i }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
