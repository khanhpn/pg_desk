// @vitest-environment node

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webContentsSend = vi.fn();
const quitAndInstall = vi.fn();
const checkForUpdates = vi.fn();
const downloadUpdate = vi.fn();

const autoUpdater = Object.assign(new EventEmitter(), {
  logger: null,
  autoDownload: true,
  autoInstallOnAppQuit: false,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
});

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
  },
  BrowserWindow: vi.fn(),
}));

vi.mock("electron-log", () => ({
  default: {
    transports: {
      file: {
        level: "info",
      },
    },
  },
}));

vi.mock("electron-updater", () => ({
  default: {
    autoUpdater,
  },
}));

describe("app update service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    autoUpdater.removeAllListeners();
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
  });

  it("waits for an explicit install action after the update is downloaded", async () => {
    const { installAppUpdate, registerAppUpdater } =
      await import("@electron/services/app-update-service");

    registerAppUpdater({
      webContents: {
        send: webContentsSend,
      },
    } as never);

    autoUpdater.emit("update-downloaded", { version: "0.1.23" });

    expect(webContentsSend).toHaveBeenCalledWith("update:status", {
      status: "downloaded",
      message: "PGDesk 0.1.23 is ready to install.",
      version: "0.1.23",
    });
    expect(quitAndInstall).not.toHaveBeenCalled();

    await installAppUpdate();

    expect(webContentsSend).toHaveBeenLastCalledWith("update:status", {
      status: "installing",
      message: "PGDesk is restarting to install the update...",
    });
    expect(quitAndInstall).toHaveBeenCalledWith(false, true);
  });
});
