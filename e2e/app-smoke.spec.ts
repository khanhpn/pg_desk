import { expect, test, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import path from "node:path";

const findMainWindow = async (
  electronApp: ElectronApplication,
): Promise<Page> => {
  await expect
    .poll(async () => {
      const windows = electronApp.windows();

      for (const appWindow of windows) {
        if (appWindow.isClosed()) {
          continue;
        }

        const hasQueryTabs = await appWindow
          .getByRole("tablist", { name: "Query tabs" })
          .count();

        if (hasQueryTabs > 0) {
          return true;
        }
      }

      return false;
    })
    .toBe(true);

  const windows = electronApp.windows();

  for (const appWindow of windows) {
    if (
      !appWindow.isClosed() &&
      (await appWindow.getByRole("tablist", { name: "Query tabs" }).count()) > 0
    ) {
      return appWindow;
    }
  }

  throw new Error("Main PGDesk window was not found");
};

test("opens the built app and renders the main query workspace", async () => {
  const electronApp = await electron.launch({
    args: [path.resolve(".")],
  });

  try {
    const window = await findMainWindow(electronApp);

    await expect(window).toHaveTitle(/pgdesk/i);
    await expect
      .poll(async () => {
        return electronApp.evaluate(({ BrowserWindow }) => {
          return BrowserWindow.getAllWindows().some((appWindow) =>
            appWindow.isMaximized(),
          );
        });
      })
      .toBe(true);
    await expect(
      window.getByRole("tablist", { name: "Query tabs" }),
    ).toBeVisible();
    await expect(window.getByRole("tab", { name: "Query 1" })).toBeVisible();
    await expect(
      window.getByRole("button", { name: "New query tab" }),
    ).toBeDisabled();
    await expect(
      window.getByRole("button", { name: /Explain/i }),
    ).toBeVisible();
    await expect(window.getByText("No query executed yet.")).toBeVisible();
    await expect(window.getByText("Messages")).not.toBeVisible();
    await expect(window.getByText("History")).not.toBeVisible();
    await expect
      .poll(async () => {
        return electronApp.evaluate(({ BrowserWindow }) => {
          return BrowserWindow.getAllWindows().some((appWindow) => {
            return (
              !appWindow.getTitle().includes("Loading") && appWindow.isVisible()
            );
          });
        });
      })
      .toBe(true);
  } finally {
    await electronApp.close();
  }
});
