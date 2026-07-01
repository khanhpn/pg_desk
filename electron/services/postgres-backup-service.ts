import { spawn } from "node:child_process";
import { app, BrowserWindow, dialog } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { PgConnectionProfile } from "@electron/types/connection";
import type {
  PgDatabaseBackupResult,
  PgDatabaseRestoreResult,
} from "@electron/types/database";
import { loadConnectionProfiles } from "@electron/services/connection-profile-service";
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

export const getPgDumpSqlBackupArgs = (): string[] => {
  return ["--format=plain", "--no-owner", "--no-privileges"];
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
