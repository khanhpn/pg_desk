import { spawn } from "node:child_process";
import { app, BrowserWindow, dialog } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { PgConnectionProfile } from "@electron/types/connection";
import type {
  PgBackupFolderSelectionResult,
  PgDatabaseBackupResult,
  PgDatabaseListResult,
  PgDatabaseMaintenanceItemResult,
  PgDatabaseSummary,
  PgMultiDatabaseBackupPayload,
  PgMultiDatabaseBackupResult,
  PgMultiDatabaseRestorePayload,
  PgMultiDatabaseRestoreResult,
  PgRestoreFileEntry,
  PgRestoreFileSelectionResult,
  PgDatabaseRestoreResult,
} from "@electron/types/database";
import { loadConnectionProfiles } from "@electron/services/connection-profile-service";
import { getActivePostgresPool } from "@electron/services/postgres-connection-service";
import { getErrorMessage } from "@electron/utils/error";

type PostgresToolName = "pg_dump" | "pg_restore" | "psql";

type LocalToolRunner = {
  type: "local";
  toolPath: string;
};

type DockerToolRunner = {
  type: "docker";
  dockerPath: string;
  containerName: string;
};

type PostgresToolRunner = LocalToolRunner | DockerToolRunner;

type CommandResult = {
  code: number | null;
  stderr: string;
};

type QueryableDatabaseClient = {
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<{
    rowCount: number | null;
    rows?: unknown[];
  }>;
};

type PgDatabaseRow = {
  datname: string;
  datallowconn: boolean;
};

const POSTGRES_VERSIONS = ["17", "16", "15", "14", "13", "12"];
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const formatDateLabel = (): string => {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "_");
};

const sanitizeFileName = (value: string): string => {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const buildSqlBackupFileName = (
  databaseName: string,
  version: number,
  dateLabel: string,
): string => {
  const safeDatabaseName = sanitizeFileName(databaseName) || "database";

  return `${safeDatabaseName}_v${version}_${dateLabel}.sql`;
};

const getNextBackupVersion = async (
  folderPath: string,
  databaseName: string,
  dateLabel: string,
): Promise<number> => {
  try {
    const files = await fsp.readdir(folderPath);
    const safeDatabaseName = sanitizeFileName(databaseName) || "database";
    const backupPattern = new RegExp(
      `^${escapeRegExp(safeDatabaseName)}_v(\\d+)_${escapeRegExp(
        dateLabel,
      )}\\.sql$`,
    );
    const versions = files
      .map((fileName) => {
        return backupPattern.exec(fileName)?.[1];
      })
      .filter((version): version is string => {
        return Boolean(version);
      })
      .map(Number);

    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  } catch {
    return 1;
  }
};

const getDefaultBackupPath = async (
  profile: PgConnectionProfile,
): Promise<string> => {
  const documentsPath = app.getPath("documents");
  const databaseName = profile.database || profile.name || "database";
  const dateLabel = formatDateLabel();
  const version = await getNextBackupVersion(
    documentsPath,
    databaseName,
    dateLabel,
  );
  const fileName = buildSqlBackupFileName(databaseName, version, dateLabel);

  return path.join(documentsPath, fileName);
};

export const buildMultiDatabaseBackupFilePath = async (
  folderPath: string,
  databaseName: string,
): Promise<string> => {
  const dateLabel = formatDateLabel();
  const version = await getNextBackupVersion(
    folderPath,
    databaseName,
    dateLabel,
  );
  const fileName = buildSqlBackupFileName(databaseName, version, dateLabel);

  return path.join(folderPath, fileName);
};

export const filterConnectableDatabases = (
  rows: PgDatabaseRow[],
): PgDatabaseSummary[] => {
  return rows
    .filter((row) => {
      return (
        row.datallowconn &&
        row.datname !== "template0" &&
        row.datname !== "template1"
      );
    })
    .map((row) => {
      return { name: row.datname };
    });
};

export const databaseExists = async (
  client: QueryableDatabaseClient,
  databaseName: string,
): Promise<boolean> => {
  const result = await client.query(
    "select 1 from pg_database where datname = $1",
    [databaseName],
  );

  return (result.rowCount ?? 0) > 0;
};

export const buildProfileForDatabase = (
  profile: PgConnectionProfile,
  databaseName: string,
): PgConnectionProfile => {
  return {
    ...profile,
    database: databaseName,
  };
};

const quoteIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

export const getCreateDatabaseSql = (databaseName: string): string => {
  return `create database ${quoteIdentifier(databaseName)}`;
};

export const createDatabaseIfMissing = async (
  client: QueryableDatabaseClient,
  databaseName: string,
): Promise<void> => {
  const exists = await databaseExists(client, databaseName);

  if (exists) {
    return;
  }

  await client.query(getCreateDatabaseSql(databaseName));
};

export const getPgDumpSqlBackupArgs = (): string[] => {
  return ["--format=plain", "--no-owner", "--no-privileges"];
};

const inferDatabaseNameFromBackupFile = (filePath: string): string => {
  const baseName = path.basename(filePath).replace(/\.[^.]+$/g, "");
  const versionedName = baseName.replace(/_v\d+_\d{4}_\d{2}_\d{2}$/g, "");

  return versionedName || baseName || "database";
};

const showSaveDialog = (
  parentWindow: BrowserWindow | null,
  options: SaveDialogOptions,
) => {
  return parentWindow
    ? dialog.showSaveDialog(parentWindow, options)
    : dialog.showSaveDialog(options);
};

const showOpenDialog = (
  parentWindow: BrowserWindow | null,
  options: OpenDialogOptions,
) => {
  return parentWindow
    ? dialog.showOpenDialog(parentWindow, options)
    : dialog.showOpenDialog(options);
};

const getExecutableName = (toolName: PostgresToolName): string => {
  return process.platform === "win32" ? `${toolName}.exe` : toolName;
};

const splitPathList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value.split(path.delimiter).filter(Boolean);
};

const getConfiguredPostgresBinPath = (): string[] => {
  return splitPathList(process.env.PGDESK_POSTGRES_BIN);
};

const getConfiguredDockerContainer = (): string | null => {
  return process.env.PGDESK_DOCKER_CONTAINER?.trim() || null;
};

const getPlatformToolPaths = (): string[] => {
  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      "C:\\Program Files",
      "C:\\Program Files (x86)",
    ].filter(Boolean) as string[];

    return [
      ...POSTGRES_VERSIONS.flatMap((version) =>
        roots.map((root) => path.join(root, "PostgreSQL", version, "bin")),
      ),
      "C:\\Program Files\\Docker\\Docker\\resources\\bin",
    ];
  }

  if (process.platform === "darwin") {
    return [
      "/Applications/Postgres.app/Contents/Versions/latest/bin",
      "/opt/homebrew/opt/libpq/bin",
      "/usr/local/opt/libpq/bin",
      ...POSTGRES_VERSIONS.flatMap((version) => [
        `/opt/homebrew/opt/postgresql@${version}/bin`,
        `/usr/local/opt/postgresql@${version}/bin`,
        `/Applications/Postgres.app/Contents/Versions/${version}/bin`,
      ]),
      "/Applications/Docker.app/Contents/Resources/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ];
  }

  return [
    ...POSTGRES_VERSIONS.flatMap((version) => [
      `/usr/lib/postgresql/${version}/bin`,
      `/usr/pgsql-${version}/bin`,
      `/opt/postgresql/${version}/bin`,
    ]),
    "/usr/local/pgsql/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/snap/bin",
  ];
};

const getSearchPaths = (): string[] => {
  return Array.from(
    new Set([
      ...getConfiguredPostgresBinPath(),
      ...splitPathList(process.env.PATH),
      ...getPlatformToolPaths(),
    ]),
  );
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fsp.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const findLocalTool = async (
  toolName: PostgresToolName,
): Promise<string | null> => {
  const executableName = getExecutableName(toolName);

  for (const folderPath of getSearchPaths()) {
    const toolPath = path.join(folderPath, executableName);

    if (await fileExists(toolPath)) {
      return toolPath;
    }
  }

  return null;
};

const runCommand = async (
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    stdinPath?: string;
    stdoutPath?: string;
  } = {},
): Promise<CommandResult> => {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      ...options.env,
    },
    windowsHide: true,
  });
  let stderr = "";

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const streams: Array<Promise<unknown>> = [];

  if (options.stdinPath) {
    streams.push(pipeline(fs.createReadStream(options.stdinPath), child.stdin));
  } else {
    child.stdin.end();
  }

  if (options.stdoutPath) {
    streams.push(
      pipeline(child.stdout, fs.createWriteStream(options.stdoutPath)),
    );
  } else {
    child.stdout.resume();
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  await Promise.all(streams);

  return {
    code: exitCode,
    stderr: stderr.trim(),
  };
};

const assertCommandSucceeded = (
  result: CommandResult,
  fallbackMessage: string,
): void => {
  if (result.code === 0) {
    return;
  }

  throw new Error(result.stderr || fallbackMessage);
};

const getConnectionProfile = async (
  connectionId?: string | null,
): Promise<PgConnectionProfile> => {
  const profileList = await loadConnectionProfiles();
  const targetConnectionId = connectionId ?? profileList.activeConnectionId;
  const profile =
    profileList.profiles.find((candidate) => {
      return candidate.id === targetConnectionId;
    }) ?? profileList.profiles[0];

  if (!profile) {
    throw new Error("No PostgreSQL connection profile was found.");
  }

  return profile;
};

const isLocalhostConnection = (profile: PgConnectionProfile): boolean => {
  return LOCALHOST_NAMES.has(profile.host.trim().toLowerCase());
};

const parseDockerContainerLine = (
  line: string,
): { id: string; image: string; name: string; ports: string } | null => {
  const [id, image, name, ports] = line.split("\t");

  if (!id || !image || !name) {
    return null;
  }

  return {
    id,
    image,
    name,
    ports: ports ?? "",
  };
};

type DockerContainerInfo = NonNullable<
  ReturnType<typeof parseDockerContainerLine>
>;

const isContainerPublishedOnPort = (
  container: DockerContainerInfo,
  port: number,
): boolean => {
  return container.ports.includes(`:${port}->`);
};

export const selectDockerContainerFromPsOutput = (
  output: string,
  profile: PgConnectionProfile,
): string | null => {
  const containers = output
    .split(/\r?\n/)
    .map(parseDockerContainerLine)
    .filter((container): container is DockerContainerInfo => {
      return Boolean(container);
    });
  const portMatches = containers.filter((container) => {
    return isContainerPublishedOnPort(container, profile.port);
  });

  if (portMatches.length === 1) {
    return portMatches[0].name;
  }

  return null;
};

const readCommandOutput = async (
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> => {
  const child = spawn(command, args, {
    env: process.env,
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  return {
    code,
    stdout,
    stderr,
  };
};

const findDockerContainerFromPsOutput = async (
  dockerPath: string,
  profile: PgConnectionProfile,
): Promise<string | null> => {
  const configuredContainer = getConfiguredDockerContainer();

  if (configuredContainer) {
    return configuredContainer;
  }

  const result = await readCommandOutput(dockerPath, [
    "ps",
    "--format",
    "{{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Ports}}",
  ]);

  if (result.code !== 0) {
    return null;
  }

  return selectDockerContainerFromPsOutput(result.stdout, profile);
};

const resolveToolRunner = async (
  toolName: PostgresToolName,
  profile: PgConnectionProfile,
): Promise<PostgresToolRunner> => {
  const localToolPath = await findLocalTool(toolName);

  if (localToolPath) {
    return {
      type: "local",
      toolPath: localToolPath,
    };
  }

  const dockerPath = await findDockerExecutable();

  if (
    dockerPath &&
    (isLocalhostConnection(profile) || getConfiguredDockerContainer())
  ) {
    const containerName = await findDockerContainerFromPsOutput(
      dockerPath,
      profile,
    );

    if (containerName) {
      return {
        type: "docker",
        dockerPath,
        containerName,
      };
    }
  }

  throw new Error(buildMissingToolMessage(toolName));
};

const findDockerExecutable = async (): Promise<string | null> => {
  const executableName = process.platform === "win32" ? "docker.exe" : "docker";

  for (const folderPath of getSearchPaths()) {
    const dockerPath = path.join(folderPath, executableName);

    if (await fileExists(dockerPath)) {
      return dockerPath;
    }
  }

  return null;
};

const buildMissingToolMessage = (toolName: PostgresToolName): string => {
  return `${toolName} was not found locally and no PostgreSQL Docker container could be detected. Install PostgreSQL client tools, set PGDESK_POSTGRES_BIN to the folder containing ${toolName}, or set PGDESK_DOCKER_CONTAINER to your PostgreSQL container name.`;
};

const getLocalConnectionArgs = (profile: PgConnectionProfile): string[] => {
  return [
    "--host",
    profile.host.trim(),
    "--port",
    String(profile.port),
    "--username",
    profile.user.trim(),
    "--dbname",
    profile.database.trim(),
  ];
};

const getDockerConnectionArgs = (profile: PgConnectionProfile): string[] => {
  return [
    "--username",
    profile.user.trim(),
    "--dbname",
    profile.database.trim(),
  ];
};

const runPostgresTool = async (
  runner: PostgresToolRunner,
  toolName: PostgresToolName,
  profile: PgConnectionProfile,
  toolArgs: string[],
  options: {
    stdinPath?: string;
    stdoutPath?: string;
  } = {},
): Promise<void> => {
  const env = {
    PGPASSWORD: profile.password,
  };
  const command = runner.type === "local" ? runner.toolPath : runner.dockerPath;
  const args =
    runner.type === "local"
      ? [...getLocalConnectionArgs(profile), ...toolArgs]
      : [
          "exec",
          ...(options.stdinPath ? ["-i"] : []),
          "-e",
          `PGPASSWORD=${profile.password}`,
          runner.containerName,
          toolName,
          ...getDockerConnectionArgs(profile),
          ...toolArgs,
        ];
  const result = await runCommand(command, args, {
    env: runner.type === "local" ? env : undefined,
    stdinPath: options.stdinPath,
    stdoutPath: options.stdoutPath,
  });

  assertCommandSucceeded(result, `${toolName} failed.`);
};

export const backupPostgresDatabase = async (
  parentWindow: BrowserWindow | null,
  connectionId?: string | null,
): Promise<PgDatabaseBackupResult> => {
  try {
    const profile = await getConnectionProfile(connectionId);
    const saveResult = await showSaveDialog(parentWindow, {
      title: "Save database backup",
      defaultPath: await getDefaultBackupPath(profile),
      filters: [
        { name: "PostgreSQL plain SQL backup", extensions: ["sql"] },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return {
        ok: false,
        message: "Backup cancelled",
      };
    }

    const runner = await resolveToolRunner("pg_dump", profile);

    await runPostgresTool(
      runner,
      "pg_dump",
      profile,
      getPgDumpSqlBackupArgs(),
      {
        stdoutPath: saveResult.filePath,
      },
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
    };
  }
};

export const restorePostgresDatabase = async (
  parentWindow: BrowserWindow | null,
  connectionId?: string | null,
): Promise<PgDatabaseRestoreResult> => {
  try {
    const profile = await getConnectionProfile(connectionId);
    const openResult = await showOpenDialog(parentWindow, {
      title: "Choose database backup",
      properties: ["openFile"],
      filters: [
        {
          name: "PostgreSQL SQL backup",
          extensions: ["sql"],
        },
        {
          name: "PostgreSQL legacy custom backup",
          extensions: ["dump", "backup"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (openResult.canceled || !openResult.filePaths[0]) {
      return {
        ok: false,
        message: "Restore cancelled",
      };
    }

    const inputPath = openResult.filePaths[0];
    const isSqlFile = inputPath.toLowerCase().endsWith(".sql");
    const runner = await resolveToolRunner(
      isSqlFile ? "psql" : "pg_restore",
      profile,
    );

    await runPostgresTool(
      runner,
      isSqlFile ? "psql" : "pg_restore",
      profile,
      isSqlFile
        ? []
        : ["--clean", "--if-exists", "--no-owner", "--no-privileges"],
      {
        stdinPath: inputPath,
      },
    );

    return {
      ok: true,
      message: `Restore completed from ${inputPath}`,
      filePath: inputPath,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  }
};

export const listPostgresDatabases = async (
  connectionId?: string | null,
): Promise<PgDatabaseListResult> => {
  try {
    const pool = getActivePostgresPool(connectionId);

    if (!pool) {
      throw new Error(
        "Connect to a PostgreSQL database before listing databases.",
      );
    }

    const result = await pool.query<PgDatabaseRow>(
      `
        select datname, datallowconn
        from pg_database
        order by datname
      `,
    );
    const databases = filterConnectableDatabases(result.rows);

    return {
      ok: true,
      message:
        databases.length === 1
          ? "Found 1 database."
          : `Found ${databases.length} databases.`,
      databases,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      databases: [],
    };
  }
};

export const choosePostgresBackupFolder = async (
  parentWindow: BrowserWindow | null,
): Promise<PgBackupFolderSelectionResult> => {
  const openResult = await showOpenDialog(parentWindow, {
    title: "Choose backup folder",
    properties: ["openDirectory", "createDirectory"],
  });

  if (openResult.canceled || !openResult.filePaths[0]) {
    return {
      ok: false,
      message: "Folder selection cancelled",
    };
  }

  return {
    ok: true,
    message: `Backup folder selected: ${openResult.filePaths[0]}`,
    folderPath: openResult.filePaths[0],
  };
};

export const choosePostgresRestoreFiles = async (
  parentWindow: BrowserWindow | null,
): Promise<PgRestoreFileSelectionResult> => {
  try {
    const openResult = await showOpenDialog(parentWindow, {
      title: "Choose restore files or folder",
      properties: ["openFile", "openDirectory", "multiSelections"],
      filters: [
        { name: "PostgreSQL SQL backup", extensions: ["sql"] },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (openResult.canceled || openResult.filePaths.length === 0) {
      return {
        ok: false,
        message: "Restore file selection cancelled",
        files: [],
      };
    }

    const filePaths: string[] = [];

    for (const selectedPath of openResult.filePaths) {
      const stat = await fsp.stat(selectedPath);

      if (stat.isDirectory()) {
        const fileNames = await fsp.readdir(selectedPath);
        filePaths.push(
          ...fileNames
            .filter((fileName) => fileName.toLowerCase().endsWith(".sql"))
            .map((fileName) => path.join(selectedPath, fileName)),
        );
      } else if (selectedPath.toLowerCase().endsWith(".sql")) {
        filePaths.push(selectedPath);
      }
    }

    const files = Array.from(new Set(filePaths))
      .sort((left, right) => left.localeCompare(right))
      .map((filePath): PgRestoreFileEntry => {
        return {
          filePath,
          targetDatabase: inferDatabaseNameFromBackupFile(filePath),
        };
      });

    return {
      ok: files.length > 0,
      message:
        files.length > 0
          ? `Selected ${files.length} restore file${
              files.length === 1 ? "" : "s"
            }.`
          : "No .sql restore files were found.",
      files,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      files: [],
    };
  }
};

export const backupPostgresDatabases = async (
  payload: PgMultiDatabaseBackupPayload,
): Promise<PgMultiDatabaseBackupResult> => {
  try {
    const profile = await getConnectionProfile(payload.connectionId);
    const runner = await resolveToolRunner("pg_dump", profile);
    const items: PgDatabaseMaintenanceItemResult[] = [];

    for (const databaseName of payload.databases) {
      const databaseProfile = buildProfileForDatabase(profile, databaseName);
      const filePath = await buildMultiDatabaseBackupFilePath(
        payload.folderPath,
        databaseName,
      );

      try {
        await runPostgresTool(
          runner,
          "pg_dump",
          databaseProfile,
          getPgDumpSqlBackupArgs(),
          {
            stdoutPath: filePath,
          },
        );
        items.push({
          name: databaseName,
          ok: true,
          message: `Backup saved to ${filePath}`,
          filePath,
        });
      } catch (error) {
        items.push({
          name: databaseName,
          ok: false,
          message: getErrorMessage(error),
          filePath,
        });
      }
    }

    const failedItems = items.filter((item) => !item.ok);

    return {
      ok: failedItems.length === 0,
      message:
        failedItems.length === 0
          ? `Backed up ${items.length} database${items.length === 1 ? "" : "s"}.`
          : `${failedItems.length} database backup${
              failedItems.length === 1 ? "" : "s"
            } failed.`,
      items,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      items: [],
    };
  }
};

export const restorePostgresDatabases = async (
  payload: PgMultiDatabaseRestorePayload,
): Promise<PgMultiDatabaseRestoreResult> => {
  try {
    const profile = await getConnectionProfile(payload.connectionId);
    const pool = getActivePostgresPool(payload.connectionId);

    if (!pool) {
      throw new Error(
        "Connect to a PostgreSQL database before restoring databases.",
      );
    }

    const runner = await resolveToolRunner("psql", profile);
    const items: PgDatabaseMaintenanceItemResult[] = [];

    for (const entry of payload.entries) {
      const databaseProfile = buildProfileForDatabase(
        profile,
        entry.targetDatabase,
      );

      try {
        await createDatabaseIfMissing(pool, entry.targetDatabase);
        await runPostgresTool(runner, "psql", databaseProfile, [], {
          stdinPath: entry.filePath,
        });
        items.push({
          name: entry.targetDatabase,
          ok: true,
          message: `Restore completed from ${entry.filePath}`,
          filePath: entry.filePath,
        });
      } catch (error) {
        items.push({
          name: entry.targetDatabase,
          ok: false,
          message: getErrorMessage(error),
          filePath: entry.filePath,
        });
      }
    }

    const failedItems = items.filter((item) => !item.ok);

    return {
      ok: failedItems.length === 0,
      message:
        failedItems.length === 0
          ? `Restored ${items.length} database${items.length === 1 ? "" : "s"}.`
          : `${failedItems.length} database restore${
              failedItems.length === 1 ? "" : "s"
            } failed.`,
      items,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      items: [],
    };
  }
};
