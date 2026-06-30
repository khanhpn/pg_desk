import { app, BrowserWindow, Menu, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { registerAppIpc } from "@ipc/app-ipc";
import { registerConnectionIpc } from "@ipc/connection-ipc";
import { registerQueryIpc } from "@ipc/query-ipc";
import { registerMetadataIpc } from "@electron/ipc/metadata-ipc";
import { registerDatabaseIpc } from "@electron/ipc/database-ipc";
import {
  checkForAppUpdates,
  registerAppUpdater,
} from "@electron/services/app-update-service";
import { registerUpdateIpc } from "@electron/ipc/update-ipc";
import packageJson from "../package.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = "PGDesk";
const APP_DESCRIPTION = "A focused PostgreSQL desktop client for developers.";
const APP_WEBSITE_URL = "https://khanhpn.github.io/pg_desk/";
const APP_REPOSITORY_URL = "https://github.com/khanhpn/pg_desk";
const COPYRIGHT = "Copyright © 2026 Khanh Pham";

registerAppIpc();
registerConnectionIpc();
registerQueryIpc();
registerMetadataIpc();
registerDatabaseIpc();
registerUpdateIpc();

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let splashWindow: BrowserWindow | null;
let splashShownAt = 0;
const SPLASH_MIN_VISIBLE_MS = 1600;
const iconPath = path.join(process.env.VITE_PUBLIC, "pgdesk.png");
const splashPath = path.join(process.env.VITE_PUBLIC, "splash.html");

app.setName(APP_NAME);
app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: packageJson.version,
  version: packageJson.version,
  copyright: COPYRIGHT,
  credits: `${APP_DESCRIPTION}\n\nAuthor: ${packageJson.author}\nRepository: ${APP_REPOSITORY_URL}`,
  authors: [packageJson.author],
  website: APP_WEBSITE_URL,
  iconPath,
});

const openExternalUrl = (url: string): void => {
  void shell.openExternal(url);
};

const handleCheckForUpdates = (): void => {
  void checkForAppUpdates(true);
};

const buildApplicationMenu = (): Menu => {
  const appMenu =
    process.platform === "darwin"
      ? [
          {
            label: APP_NAME,
            submenu: [
              {
                label: `About ${APP_NAME}`,
                role: "about" as const,
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              {
                label: `Quit ${APP_NAME}`,
                accelerator: "Command+Q",
                role: "quit" as const,
              },
            ],
          },
        ]
      : [];

  return Menu.buildFromTemplate([
    ...appMenu,
    {
      label: "File",
      submenu: [
        process.platform === "darwin"
          ? { role: "close" as const }
          : { role: "quit" as const },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(process.platform === "darwin"
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates...",
          click: handleCheckForUpdates,
        },
        { type: "separator" as const },
        {
          label: "PGDesk Documentation",
          click: () => {
            openExternalUrl(APP_WEBSITE_URL);
          },
        },
        {
          label: "GitHub Repository",
          click: () => {
            openExternalUrl(APP_REPOSITORY_URL);
          },
        },
        ...(process.platform === "darwin"
          ? []
          : [
              { type: "separator" as const },
              {
                label: `About ${APP_NAME}`,
                click: () => {
                  app.showAboutPanel();
                },
              },
            ]),
      ],
    },
  ]);
};

const closeSplashWindow = (afterClose?: () => void): void => {
  const targetSplashWindow = splashWindow;

  if (!targetSplashWindow || targetSplashWindow.isDestroyed()) {
    splashWindow = null;
    afterClose?.();
    return;
  }

  const remainingVisibleMs = Math.max(
    0,
    SPLASH_MIN_VISIBLE_MS - (Date.now() - splashShownAt),
  );

  const closeWindow = (): void => {
    if (targetSplashWindow.isDestroyed()) {
      afterClose?.();
      return;
    }

    if (afterClose) {
      targetSplashWindow.once("closed", afterClose);
    }

    targetSplashWindow.close();

    if (splashWindow === targetSplashWindow) {
      splashWindow = null;
    }
  };

  if (remainingVisibleMs > 0) {
    setTimeout(closeWindow, remainingVisibleMs);
    return;
  }

  closeWindow();
};

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 350,
    title: `${APP_NAME} Loading`,
    icon: iconPath,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      sandbox: true,
    },
  });

  splashWindow.once("ready-to-show", () => {
    splashShownAt = Date.now();
    splashWindow?.show();
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  void splashWindow.loadFile(splashPath);
}

function createWindow() {
  win = new BrowserWindow({
    title: APP_NAME,
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  registerAppUpdater(win);

  win.once("ready-to-show", () => {
    closeSplashWindow(() => {
      win?.maximize();
      win?.show();
    });
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    setTimeout(() => {
      void checkForAppUpdates();
    }, 2500);
  }
});

if (process.platform === "darwin") {
  app.dock.setIcon(iconPath);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu());
  createSplashWindow();
  createWindow();
});
