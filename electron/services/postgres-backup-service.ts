import { app, dialog } from "electron";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  BrowserWindow,
  OpenDialogOptions,
  SaveDialogOptions,
} from "electron";
import type { PgConnectionConfig } from "@electron/types/connection";
import type {
  PgDatabaseBackupResult,
  PgDatabaseRestoreResult,
} from "@electron/types/database";
import { loadConnectionProfiles } from "@electron/services/connection-profile-service";
import { getActiveConnectionId } from "@electron/services/postgres-connection-service";
import { getErrorMessage } from "@electron/utils/error";

const postgresVersionedBinDirs = ["17", "16", "15", "14", "13", "12"].flatMap(
  (version) => [
    `/opt/homebrew/opt/postgresql@${version}/bin`,
    `/usr/local/opt/postgresql@${version}/bin`,
    `/Applications/Postgres.app/Contents/Versions/${version}/bin`,
  ],
);

const getWindowsPostgresToolDirs = (): string[] => {
  if (process.platform !== "win32") {
    return [];
  }

  const programFiles = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
  ].filter(Boolean) as string[];

  return programFiles.flatMap((basePath) =>
    ["17", "16", "15", "14", "13", "12"].map((version) =>
      path.join(basePath, "PostgreSQL", version, "bin"),
    ),
  );
};

const getPostgresToolDirs = (): string[] =>
  [
    process.env.PGDESK_POSTGRES_BIN,
    "/Applications/Postgres.app/Contents/Versions/latest/bin",
    "/opt/homebrew/opt/libpq/bin",
    "/usr/local/opt/libpq/bin",
    ...postgresVersionedBinDirs,
    ...getWindowsPostgresToolDirs(),
    ...["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"],
  ].filter(Boolean) as string[];

const postgresToolPath = [
  ...(process.env.PATH ? [process.env.PATH] : []),
  ...getPostgresToolDirs(),
].join(path.delimiter);

const getToolCandidates = (command: string): string[] => {
  if (process.platform !== "win32") {
    return [command];
  }

  return command.endsWith(".exe") ? [command] : [`${command}.exe`, command];
};

const resolvePostgresTool = async (command: string): Promise<string> => {
  if (path.isAbsolute(command)) {
    return command;
  }

  for (const dir of getPostgresToolDirs()) {
    for (const candidateName of getToolCandidates(command)) {
      const candidatePath = path.join(dir, candidateName);

      try {
        await fs.access(candidatePath, fsConstants.X_OK);
        return candidatePath;
      } catch {
        // Keep looking through the remaining PostgreSQL install locations.
      }
    }
  }

  return command;
};

const getMissingToolMessage = (command: string): string => {
  const searchedDirs = getPostgresToolDirs().join(", ");

  return `${command} was not found. Install PostgreSQL client tools, or set PGDESK_POSTGRES_BIN to the folder containing ${command}. Searched PATH plus: ${searchedDirs}.`;
};

const getToolEnv = (config: PgConnectionConfig): NodeJS.ProcessEnv => ({
  ...process.env,
  PATH: postgresToolPath,
  PGPASSWORD: config.password,
  ...(config.ssl ? { PGSSLMODE: "require" } : {}),
});

const getActiveConnectionConfig = async (
  connectionId?: string | null,
): Promise<PgConnectionConfig | null> => {
  const list = await loadConnectionProfiles();
  const targetConnectionId = connectionId ?? getActiveConnectionId();

  return (
    list.profiles.find((profile) => profile.id === targetConnectionId) ?? null
  );
};

const getDateStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}_${month}_${day}`;
};

const sanitizeFilePart = (value: string): string => {
  return value.trim().replace(/[^\w.-]+/g, "_") || "database";
};

const getNextBackupPath = async (database: string): Promise<string> => {
  const backupDir = path.join(app.getPath("documents"), "PGDesk Backups");

  await fs.mkdir(backupDir, { recursive: true });

  const safeDatabase = sanitizeFilePart(database);
  const dateStamp = getDateStamp();
  const backupFiles = await fs.readdir(backupDir).catch(() => []);
  const versionPattern = new RegExp(
    `^${safeDatabase}_v(\\d+)_${dateStamp}\\.sql$`,
  );
  const maxVersion = backupFiles.reduce((max, fileName) => {
    const match = fileName.match(versionPattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextVersion = maxVersion + 1;

  return path.join(
    backupDir,
    `${safeDatabase}_v${nextVersion}_${dateStamp}.sql`,
  );
};

const runPostgresTool = async (
  command: string,
  args: string[],
  config: PgConnectionConfig,
): Promise<void> => {
  const resolvedCommand = await resolvePostgresTool(command);

  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      env: getToolEnv(config),
      windowsHide: true,
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          error.message.includes("ENOENT")
            ? getMissingToolMessage(command)
            : error.message,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() || `${command} exited with status ${code ?? "unknown"}`,
        ),
      );
    });
  });
};

export const backupPostgresDatabase = async (
  browserWindow: BrowserWindow | null,
  connectionId?: string | null,
): Promise<PgDatabaseBackupResult> => {
  const config = await getActiveConnectionConfig(connectionId);

  if (!config) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
    };
  }

  const defaultPath = await getNextBackupPath(config.database);
  const saveOptions: SaveDialogOptions = {
    title: "Backup PostgreSQL database",
    defaultPath,
    buttonLabel: "Backup",
    filters: [{ name: "SQL backup", extensions: ["sql"] }],
  };
  const saveResult = browserWindow
    ? await dialog.showSaveDialog(browserWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);

  if (saveResult.canceled || !saveResult.filePath) {
    return {
      ok: false,
      message: "Backup cancelled",
    };
  }

  try {
    await runPostgresTool(
      "pg_dump",
      [
        "--host",
        config.host,
        "--port",
        String(config.port),
        "--username",
        config.user,
        "--dbname",
        config.database,
        "--file",
        saveResult.filePath,
        "--format",
        "plain",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
      ],
      config,
    );

    return {
      ok: true,
      message: `Backup saved to ${saveResult.filePath}`,
      filePath: saveResult.filePath,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      filePath: saveResult.filePath,
    };
  }
};

export const restorePostgresDatabase = async (
  browserWindow: BrowserWindow | null,
  connectionId?: string | null,
): Promise<PgDatabaseRestoreResult> => {
  const config = await getActiveConnectionConfig(connectionId);

  if (!config) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
    };
  }

  const openOptions: OpenDialogOptions = {
    title: "Restore PostgreSQL database",
    buttonLabel: "Restore",
    properties: ["openFile"],
    filters: [{ name: "SQL backup", extensions: ["sql"] }],
  };
  const openResult = browserWindow
    ? await dialog.showOpenDialog(browserWindow, openOptions)
    : await dialog.showOpenDialog(openOptions);
  const filePath = openResult.filePaths[0];

  if (openResult.canceled || !filePath) {
    return {
      ok: false,
      message: "Restore cancelled",
    };
  }

  try {
    await runPostgresTool(
      "psql",
      [
        "--host",
        config.host,
        "--port",
        String(config.port),
        "--username",
        config.user,
        "--dbname",
        config.database,
        "--set",
        "ON_ERROR_STOP=on",
        "--file",
        filePath,
      ],
      config,
    );

    return {
      ok: true,
      message: `Restored ${config.database} from ${filePath}`,
      filePath,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      filePath,
    };
  }
};
