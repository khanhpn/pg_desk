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

const findSplashWindow = async (
  electronApp: ElectronApplication,
): Promise<Page> => {
  await expect
    .poll(async () => {
      const windows = electronApp.windows();

      for (const appWindow of windows) {
        if (appWindow.isClosed()) {
          continue;
        }

        const hasSplashStatus = await appWindow
          .getByText("Loading application")
          .count();

        if (hasSplashStatus > 0) {
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
      (await appWindow.getByText("Loading application").count()) > 0
    ) {
      return appWindow;
    }
  }

  throw new Error("PGDesk splash window was not found");
};

test("opens the built app and renders the main query workspace", async () => {
  const electronApp = await electron.launch({
    args: [path.resolve(".")],
  });

  try {
    const splashWindow = await findSplashWindow(electronApp);

    await expect(splashWindow.getByText("Loading application")).toBeVisible();
    await expect(
      await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().some((appWindow) => {
          return (
            !appWindow.getTitle().includes("Loading") && appWindow.isVisible()
          );
        });
      }),
    ).toBe(false);

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
    await expect(window.getByText("No query executed yet.")).toBeVisible();
    await expect.poll(() => splashWindow.isClosed()).toBe(true);
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

    await window.getByRole("button", { name: /not tested|pong/i }).click();
    await expect(
      window.getByRole("button", { name: /pong from Electron main process/i }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
