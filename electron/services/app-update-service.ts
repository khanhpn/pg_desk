import { BrowserWindow, app } from "electron";
import log from "electron-log";
import electronUpdater, { type AppUpdater } from "electron-updater";

type UpdateStatusPayload = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  message: string;
  version?: string;
  percent?: number;
};

const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;

const getAutoUpdater = (): AppUpdater => {
  return autoUpdater;
};

const sendUpdateStatus = (payload: UpdateStatusPayload): void => {
  mainWindow?.webContents.send("update:status", payload);
};

export const registerAppUpdater = (window: BrowserWindow): void => {
  mainWindow = window;

  const updater = getAutoUpdater();

  updater.logger = log;
  log.transports.file.level = "info";

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => {
    sendUpdateStatus({
      status: "checking",
      message: "Checking for updates...",
    });
  });

  updater.on("update-available", (info) => {
    sendUpdateStatus({
      status: "available",
      message: `PGDesk ${info.version} is available.`,
      version: info.version,
    });
  });

  updater.on("update-not-available", () => {
    sendUpdateStatus({
      status: "not-available",
      message: "PGDesk is up to date.",
    });
  });

  updater.on("download-progress", (progress) => {
    sendUpdateStatus({
      status: "downloading",
      message: `Downloading update ${Math.round(progress.percent)}%...`,
      percent: progress.percent,
    });
  });

  updater.on("update-downloaded", (info) => {
    sendUpdateStatus({
      status: "downloaded",
      message: `PGDesk ${info.version} downloaded. Installing...`,
      version: info.version,
    });

    setTimeout(() => {
      updater.quitAndInstall(false, true);
    }, 900);
  });

  updater.on("error", (error) => {
    sendUpdateStatus({
      status: "error",
      message: error.message || "Update failed",
    });
  });
};

export const checkForAppUpdates = async (): Promise<void> => {
  if (!app.isPackaged) {
    return;
  }

  await getAutoUpdater().checkForUpdates();
};

export const downloadAppUpdate = async (): Promise<void> => {
  await getAutoUpdater().downloadUpdate();
};
