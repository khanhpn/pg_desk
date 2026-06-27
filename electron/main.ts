import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

type PgConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Pool } = require("pg") as typeof import("pg");

ipcMain.handle("app:ping", async () => {
  return {
    ok: true,
    message: "pong from Electron main process",
    timestamp: new Date().toISOString(),
  };
});

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const iconPath = path.join(process.env.VITE_PUBLIC, "pgdesk.png");

// Helper function to get error message from an unknown error
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

ipcMain.handle(
  "connection:test",
  async (_event, config: PgConnectionConfig) => {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 3000,
      max: 1,
    });

    try {
      const client = await pool.connect();

      try {
        const result = await client.query(`
        select
          current_database() as database,
          current_user as user,
          version() as server_version
      `);

        const row = result.rows[0];

        return {
          ok: true,
          message: "Connected successfully",
          database: row.database,
          user: row.user,
          serverVersion: row.server_version,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    } finally {
      await pool.end();
    }
  },
);

function createWindow() {
  win = new BrowserWindow({
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
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
  }
});

if (process.platform === "darwin") {
  app.dock.setIcon(iconPath);
}

app.whenReady().then(createWindow);
