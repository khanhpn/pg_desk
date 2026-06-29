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
  isManual?: boolean;
};

const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let isManualUpdateCheck = false;

const getAutoUpdater = (): AppUpdater => {
  return autoUpdater;
};

const sendUpdateStatus = (payload: UpdateStatusPayload): void => {
  mainWindow?.webContents.send("update:status", payload);
};

const formatUpdateErrorMessage = (error: Error): string => {
  if (
    error.message.includes("latest-mac.yml") ||
    error.message.includes("latest.yml")
  ) {
    return "Update metadata is missing from the latest GitHub release. Please download the latest installer manually.";
  }

  return error.message || "Update failed";
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
      isManual: isManualUpdateCheck,
    });
  });

  updater.on("update-available", (info) => {
    sendUpdateStatus({
      status: "available",
      message: `PGDesk ${info.version} is available.`,
      version: info.version,
      isManual: isManualUpdateCheck,
    });

    isManualUpdateCheck = false;
  });

  updater.on("update-not-available", () => {
    sendUpdateStatus({
      status: "not-available",
      message: "PGDesk is up to date.",
      isManual: isManualUpdateCheck,
    });

    isManualUpdateCheck = false;
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
      message: formatUpdateErrorMessage(error),
      isManual: isManualUpdateCheck,
    });

    isManualUpdateCheck = false;
  });
};

export const checkForAppUpdates = async (isManual = false): Promise<void> => {
  isManualUpdateCheck = isManual;

  if (!app.isPackaged) {
    if (isManual) {
      sendUpdateStatus({
        status: "not-available",
        message: "Updates can only be checked in the packaged app.",
        isManual: true,
      });
    }

    isManualUpdateCheck = false;
    return;
  }

  await getAutoUpdater().checkForUpdates();
};

export const downloadAppUpdate = async (): Promise<void> => {
  await getAutoUpdater().downloadUpdate();
};
