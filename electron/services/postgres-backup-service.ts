import { spawn } from "node:child_process";
import { app, BrowserWindow, dialog } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { finished, pipeline } from "node:stream/promises";
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

type StreamResult =
  | {
      ok: true;
      name: "stdin" | "stdout";
    }
  | {
      ok: false;
      name: "stdin" | "stdout";
      error: unknown;
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

type DatabaseMaintenanceAuditAction =
  | "backup-one"
  | "restore-one"
  | "backup-many"
  | "restore-many";

type DatabaseMaintenanceAuditStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "safety-warning"
  | "safety-failed";

type DatabaseMaintenanceAuditConnection = Omit<PgConnectionProfile, "password">;

type DatabaseMaintenanceAuditEvent = {
  timestamp: string;
  action: DatabaseMaintenanceAuditAction;
  status: DatabaseMaintenanceAuditStatus;
  connection: DatabaseMaintenanceAuditConnection;
  targets?: string[];
  message?: string;
  details?: Record<string, unknown>;
};

type DatabaseMaintenanceAuditEventInput = {
  action: DatabaseMaintenanceAuditAction;
  status: DatabaseMaintenanceAuditStatus;
  profile: PgConnectionProfile;
  targets?: string[];
  message?: string;
  details?: Record<string, unknown>;
};

type SqlRestoreScopeScanner = {
  copyData: boolean;
  inBlockComment: boolean;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  dollarQuoteTag: string | null;
  tail: string;
  wrapperDatabase: string | null;
  targetDatabase?: string;
};

type ServerLevelSqlPattern = {
  label: string;
  pattern: RegExp;
};

const POSTGRES_VERSIONS = ["17", "16", "15", "14", "13", "12"];
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const SYSTEM_DATABASE_NAMES = new Set(["postgres", "template0", "template1"]);

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
      return row.datallowconn && !SYSTEM_DATABASE_NAMES.has(row.datname);
    })
    .map((row) => {
      return { name: row.datname };
    });
};

const toAuditConnection = (
  profile: PgConnectionProfile,
): DatabaseMaintenanceAuditConnection => {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    user: profile.user,
    ssl: profile.ssl,
  };
};

export const buildDatabaseMaintenanceAuditEvent = ({
  action,
  status,
  profile,
  targets,
  message,
  details,
}: DatabaseMaintenanceAuditEventInput): DatabaseMaintenanceAuditEvent => {
  return {
    timestamp: new Date().toISOString(),
    action,
    status,
    connection: toAuditConnection(profile),
    targets,
    message,
    details,
  };
};

const getDatabaseMaintenanceAuditLogPath = (): string => {
  return path.join(app.getPath("userData"), "database-maintenance-audit.jsonl");
};

const getTempPath = (): string => {
  return app?.getPath?.("temp") ?? os.tmpdir();
};

const writeDatabaseMaintenanceAuditEvent = async (
  event: DatabaseMaintenanceAuditEvent,
): Promise<void> => {
  const auditLogPath = getDatabaseMaintenanceAuditLogPath();

  await fsp.mkdir(path.dirname(auditLogPath), { recursive: true });
  await fsp.appendFile(auditLogPath, `${JSON.stringify(event)}\n`, "utf-8");
};

const recordDatabaseMaintenanceAuditEvent = async (
  input: DatabaseMaintenanceAuditEventInput,
): Promise<void> => {
  try {
    await writeDatabaseMaintenanceAuditEvent(
      buildDatabaseMaintenanceAuditEvent(input),
    );
  } catch (error) {
    console.error("Failed to write database maintenance audit event:", error);
  }
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

const listDatabaseRows = async (
  client: QueryableDatabaseClient,
): Promise<PgDatabaseRow[]> => {
  const result = await client.query(
    `
      select datname, datallowconn
      from pg_database
      order by datname
    `,
  );

  return (result.rows ?? []) as PgDatabaseRow[];
};

export const getMissingSelectedDatabasesAfterBackup = (
  beforeRows: PgDatabaseRow[],
  afterRows: PgDatabaseRow[],
  selectedDatabaseNames: string[],
): string[] => {
  const beforeNames = new Set(beforeRows.map((row) => row.datname));
  const afterNames = new Set(afterRows.map((row) => row.datname));

  return selectedDatabaseNames.filter((databaseName) => {
    return beforeNames.has(databaseName) && !afterNames.has(databaseName);
  });
};

const getDatabaseNames = (rows: PgDatabaseRow[]): string[] => {
  return rows.map((row) => row.datname);
};

const getRemovedDatabaseNames = (
  beforeRows: PgDatabaseRow[],
  afterRows: PgDatabaseRow[],
): string[] => {
  const afterNames = new Set(afterRows.map((row) => row.datname));

  return beforeRows
    .map((row) => row.datname)
    .filter((databaseName) => !afterNames.has(databaseName));
};

const getAddedDatabaseNames = (
  beforeRows: PgDatabaseRow[],
  afterRows: PgDatabaseRow[],
): string[] => {
  const beforeNames = new Set(beforeRows.map((row) => row.datname));

  return afterRows
    .map((row) => row.datname)
    .filter((databaseName) => !beforeNames.has(databaseName));
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
  return [
    "--format=plain",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
  ];
};

export const getPsqlPlainRestoreArgs = (): string[] => {
  return ["--no-psqlrc", "--set", "ON_ERROR_STOP=on", "--single-transaction"];
};

export const getPlainRestorePreludeSql = (): string => {
  return [
    "do $$",
    "declare",
    "  schema_name text;",
    "begin",
    "  for schema_name in",
    "    select namespace.nspname",
    "    from pg_catalog.pg_namespace namespace",
    "    where namespace.nspname <> 'information_schema'",
    "      and namespace.nspname not like 'pg_%'",
    "      and not exists (",
    "        select 1",
    "        from pg_catalog.pg_extension extension",
    "        where extension.extnamespace = namespace.oid",
    "      )",
    "  loop",
    "    execute format('drop schema if exists %I cascade', schema_name);",
    "  end loop;",
    "end",
    "$$;",
    "create schema public;",
    "grant all on schema public to public;",
    "",
  ].join("\n");
};

const SERVER_LEVEL_SQL_PATTERNS: ServerLevelSqlPattern[] = [
  {
    label: "role/user changes",
    pattern: /\b(?:create|alter|drop)\s+(?:role|user)\b/i,
  },
  {
    label: "database changes",
    pattern: /\b(?:create|alter|drop)\s+database\b/i,
  },
  {
    label: "tablespace changes",
    pattern: /\b(?:create|alter|drop)\s+tablespace\b/i,
  },
];

const createSqlRestoreScopeScanner = (
  targetDatabase?: string,
): SqlRestoreScopeScanner => {
  const scanner: SqlRestoreScopeScanner = {
    copyData: false,
    inBlockComment: false,
    inSingleQuote: false,
    inDoubleQuote: false,
    dollarQuoteTag: null,
    tail: "",
    wrapperDatabase: null,
  };

  if (targetDatabase) {
    scanner.targetDatabase = targetDatabase;
  }

  return scanner;
};

const findDollarQuoteTag = (value: string, index: number): string | null => {
  const match = /^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/.exec(value.slice(index));

  return match?.[0] ?? null;
};

const scrubSqlLine = (
  line: string,
  scanner: SqlRestoreScopeScanner,
): string => {
  let scrubbed = "";

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (scanner.inBlockComment) {
      if (char === "*" && nextChar === "/") {
        scanner.inBlockComment = false;
        index += 1;
      }
      scrubbed += " ";
      continue;
    }

    if (scanner.dollarQuoteTag) {
      if (line.startsWith(scanner.dollarQuoteTag, index)) {
        index += scanner.dollarQuoteTag.length - 1;
        scanner.dollarQuoteTag = null;
      }
      scrubbed += " ";
      continue;
    }

    if (scanner.inSingleQuote) {
      if (char === "'" && nextChar === "'") {
        index += 1;
      } else if (char === "'") {
        scanner.inSingleQuote = false;
      }
      scrubbed += " ";
      continue;
    }

    if (scanner.inDoubleQuote) {
      if (char === '"' && nextChar === '"') {
        index += 1;
      } else if (char === '"') {
        scanner.inDoubleQuote = false;
      }
      scrubbed += " ";
      continue;
    }

    if (char === "/" && nextChar === "*") {
      scanner.inBlockComment = true;
      scrubbed += " ";
      index += 1;
      continue;
    }

    if (char === "-" && nextChar === "-") {
      break;
    }

    if (char === "'") {
      scanner.inSingleQuote = true;
      scrubbed += " ";
      continue;
    }

    if (char === '"') {
      scanner.inDoubleQuote = true;
      scrubbed += " ";
      continue;
    }

    const dollarQuoteTag = findDollarQuoteTag(line, index);

    if (dollarQuoteTag) {
      scanner.dollarQuoteTag = dollarQuoteTag;
      scrubbed += " ";
      index += dollarQuoteTag.length - 1;
      continue;
    }

    scrubbed += char;
  }

  return scrubbed;
};

const getServerLevelSqlViolation = (
  scrubbedSql: string,
): string | undefined => {
  return SERVER_LEVEL_SQL_PATTERNS.find(({ pattern }) => {
    return pattern.test(scrubbedSql);
  })?.label;
};

const getUnquotedIdentifier = (value: string): string | null => {
  const trimmedValue = value.trim();
  const quotedMatch = /^"((?:""|[^"])*)"$/.exec(trimmedValue);

  if (quotedMatch) {
    return quotedMatch[1].replace(/""/g, '"');
  }

  const unquotedMatch = /^([A-Za-z_][A-Za-z_0-9]*)$/.exec(trimmedValue);

  return unquotedMatch?.[1] ?? null;
};

const getCreateDatabaseName = (line: string): string | null => {
  const match =
    /^\s*create\s+database\s+("[^"]*(?:""[^"]*)*"|[A-Za-z_][A-Za-z_0-9]*)(?:\s+[\s\S]*)?;\s*$/i.exec(
      line,
    );

  return match ? getUnquotedIdentifier(match[1]) : null;
};

const getDropDatabaseName = (line: string): string | null => {
  const match =
    /^\s*drop\s+database\s+(?:if\s+exists\s+)?("[^"]*(?:""[^"]*)*"|[A-Za-z_][A-Za-z_0-9]*)\s*;\s*$/i.exec(
      line,
    );

  return match ? getUnquotedIdentifier(match[1]) : null;
};

const getAlterDatabaseName = (line: string): string | null => {
  const match =
    /^\s*alter\s+database\s+("[^"]*(?:""[^"]*)*"|[A-Za-z_][A-Za-z_0-9]*)(?:\s+[\s\S]*)?;\s*$/i.exec(
      line,
    );

  return match ? getUnquotedIdentifier(match[1]) : null;
};

const getConnectDatabaseName = (line: string): string | null => {
  const match =
    /^\s*\\(?:connect|c)\s+("[^"]*(?:""[^"]*)*"|[^\s]+)(?:\s|$)/i.exec(line);

  return match ? getUnquotedIdentifier(match[1]) : null;
};

const getDatabaseWrapperName = (line: string): string | null => {
  return (
    getCreateDatabaseName(line) ??
    getDropDatabaseName(line) ??
    getAlterDatabaseName(line) ??
    getConnectDatabaseName(line)
  );
};

const getPgRestoreDataPathCopy = (
  line: string,
): { indent: string; copyTarget: string; relativeFilePath: string } | null => {
  const match =
    /^(\s*)COPY\s+([\s\S]+?)\s+FROM\s+'\$\$PATH\$\$\/([^']+)';\s*$/i.exec(line);

  if (!match) {
    return null;
  }

  const [, indent, copyTarget, relativeFilePath] = match;

  return { indent, copyTarget, relativeFilePath };
};

const writeRestoreChunk = async (
  output: fs.WriteStream,
  chunk: string | Buffer,
): Promise<void> => {
  if (!output.write(chunk)) {
    await once(output, "drain");
  }
};

const isConnectDatabaseWrapper = (line: string): boolean => {
  return getConnectDatabaseName(line) !== null;
};

const isAllowedDatabaseWrapper = (
  line: string,
  scanner: SqlRestoreScopeScanner,
): boolean => {
  const databaseName = getDatabaseWrapperName(line);

  if (!databaseName) {
    return false;
  }

  if (
    isConnectDatabaseWrapper(line) &&
    !scanner.wrapperDatabase &&
    databaseName !== scanner.targetDatabase
  ) {
    return false;
  }

  if (scanner.wrapperDatabase && scanner.wrapperDatabase !== databaseName) {
    return false;
  }

  scanner.wrapperDatabase = databaseName;
  return true;
};

const scanSqlRestoreLine = (
  line: string,
  scanner: SqlRestoreScopeScanner,
): void => {
  if (scanner.copyData) {
    if (line === "\\.") {
      scanner.copyData = false;
    }
    return;
  }

  if (isAllowedDatabaseWrapper(line, scanner)) {
    return;
  }

  if (/^\s*\\(?:connect|c)(?:\s|$)/i.test(line)) {
    throw new Error(
      "Restore file contains server-level statements and cannot be restored safely.",
    );
  }

  const scrubbedLine = scrubSqlLine(line, scanner);
  scanner.tail = `${scanner.tail}\n${scrubbedLine}`.slice(-1200);

  const violation = getServerLevelSqlViolation(scanner.tail);

  if (violation) {
    throw new Error(
      `Restore file contains server-level statements (${violation}) and cannot be restored safely.`,
    );
  }

  if (/\bcopy\b[\s\S]*\bfrom\s+stdin\s*;/i.test(scanner.tail)) {
    scanner.copyData = true;
    scanner.tail = "";
  }
};

export const assertDatabaseScopedSqlRestore = (
  sql: string,
  targetDatabase?: string,
): void => {
  const scanner = createSqlRestoreScopeScanner(targetDatabase);

  for (const line of sql.split(/\r?\n/)) {
    scanSqlRestoreLine(line, scanner);
  }
};

export const toDatabaseScopedSqlRestore = (
  sql: string,
  targetDatabase: string,
): string => {
  const scanner = createSqlRestoreScopeScanner(targetDatabase);
  const outputLines: string[] = [];

  for (const line of sql.split(/\r?\n/)) {
    scanSqlRestoreLine(line, scanner);

    if (!getDatabaseWrapperName(line)) {
      outputLines.push(line);
    }
  }

  return outputLines.join("\n");
};

const writePgRestoreInlineDataCopy = async (
  output: fs.WriteStream,
  line: string,
  dataDirectory: string,
): Promise<boolean> => {
  const dataPathCopy = getPgRestoreDataPathCopy(line);

  if (!dataPathCopy) {
    return false;
  }

  const dataFilePath = path.join(dataDirectory, dataPathCopy.relativeFilePath);
  let lastChunkEndsWithNewline = true;

  await writeRestoreChunk(
    output,
    `${dataPathCopy.indent}COPY ${dataPathCopy.copyTarget} FROM stdin;\n`,
  );

  for await (const chunk of fs.createReadStream(dataFilePath)) {
    if (Buffer.isBuffer(chunk) && chunk.length > 0) {
      lastChunkEndsWithNewline = chunk[chunk.length - 1] === 10;
    }

    await writeRestoreChunk(output, chunk);
  }

  if (!lastChunkEndsWithNewline) {
    await writeRestoreChunk(output, "\n");
  }

  await writeRestoreChunk(output, "\\.\n");
  return true;
};

export const createDatabaseScopedSqlRestoreFile = async (
  filePath: string,
  targetDatabase: string,
): Promise<string> => {
  const scopedFilePath = path.join(
    getTempPath(),
    `pgdesk-restore-${randomUUID()}-${path.basename(filePath)}`,
  );
  const scanner = createSqlRestoreScopeScanner(targetDatabase);
  const dataDirectory = path.dirname(filePath);
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  const output = fs.createWriteStream(scopedFilePath, {
    encoding: "utf-8",
    mode: 0o600,
  });

  try {
    await writeRestoreChunk(output, getPlainRestorePreludeSql());

    for await (const line of lines) {
      scanSqlRestoreLine(line, scanner);

      if (!getDatabaseWrapperName(line)) {
        const wroteInlineDataCopy = await writePgRestoreInlineDataCopy(
          output,
          line,
          dataDirectory,
        );

        if (!wroteInlineDataCopy) {
          await writeRestoreChunk(output, `${line}\n`);
        }
      }
    }

    output.end();
    await finished(output);
    return scopedFilePath;
  } catch (error) {
    output.end();
    await fsp.rm(scopedFilePath, { force: true });
    throw error;
  }
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

const isBrokenPipeError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EPIPE"
  );
};

const watchStream = (
  name: StreamResult["name"],
  stream: Promise<unknown>,
): Promise<StreamResult> => {
  return stream
    .then((): StreamResult => {
      return { ok: true, name };
    })
    .catch((error: unknown): StreamResult => {
      return { ok: false, name, error };
    });
};

export const runCommand = async (
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

  const streams: Array<Promise<StreamResult>> = [];

  if (options.stdinPath) {
    streams.push(
      watchStream(
        "stdin",
        pipeline(fs.createReadStream(options.stdinPath), child.stdin),
      ),
    );
  } else {
    child.stdin.end();
  }

  if (options.stdoutPath) {
    streams.push(
      watchStream(
        "stdout",
        pipeline(child.stdout, fs.createWriteStream(options.stdoutPath)),
      ),
    );
  } else {
    child.stdout.resume();
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  const streamResults = await Promise.all(streams);
  const streamError = streamResults.find((result) => {
    return (
      !result.ok &&
      !(
        result.name === "stdin" &&
        exitCode !== 0 &&
        isBrokenPipeError(result.error)
      )
    );
  });

  if (streamError && !streamError.ok) {
    throw streamError.error;
  }

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
  let auditProfile: PgConnectionProfile | null = null;

  try {
    const profile = await getConnectionProfile(connectionId);
    auditProfile = profile;
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

    await recordDatabaseMaintenanceAuditEvent({
      action: "backup-one",
      status: "started",
      profile,
      targets: [profile.database],
      details: {
        filePath: saveResult.filePath,
      },
    });

    await runPostgresTool(
      runner,
      "pg_dump",
      profile,
      getPgDumpSqlBackupArgs(),
      {
        stdoutPath: saveResult.filePath,
      },
    );

    await recordDatabaseMaintenanceAuditEvent({
      action: "backup-one",
      status: "succeeded",
      profile,
      targets: [profile.database],
      message: `Backup saved to ${saveResult.filePath}`,
      details: {
        filePath: saveResult.filePath,
      },
    });

    return {
      ok: true,
      message: `Backup saved to ${saveResult.filePath}`,
      filePath: saveResult.filePath,
    };
  } catch (error) {
    if (auditProfile) {
      await recordDatabaseMaintenanceAuditEvent({
        action: "backup-one",
        status: "failed",
        profile: auditProfile,
        targets: [auditProfile.database],
        message: getErrorMessage(error),
      });
    }

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
  let auditProfile: PgConnectionProfile | null = null;
  let scopedInputPath: string | null = null;

  try {
    const profile = await getConnectionProfile(connectionId);
    auditProfile = profile;
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
    if (isSqlFile) {
      scopedInputPath = await createDatabaseScopedSqlRestoreFile(
        inputPath,
        profile.database,
      );
    }

    await recordDatabaseMaintenanceAuditEvent({
      action: "restore-one",
      status: "started",
      profile,
      targets: [profile.database],
      details: {
        filePath: inputPath,
        format: isSqlFile ? "sql" : "custom",
      },
    });

    await runPostgresTool(
      runner,
      isSqlFile ? "psql" : "pg_restore",
      profile,
      isSqlFile
        ? getPsqlPlainRestoreArgs()
        : ["--clean", "--if-exists", "--no-owner", "--no-privileges"],
      {
        stdinPath: scopedInputPath ?? inputPath,
      },
    );

    await recordDatabaseMaintenanceAuditEvent({
      action: "restore-one",
      status: "succeeded",
      profile,
      targets: [profile.database],
      message: `Restore completed from ${inputPath}`,
      details: {
        filePath: inputPath,
        format: isSqlFile ? "sql" : "custom",
      },
    });

    return {
      ok: true,
      message: `Restore completed from ${inputPath}`,
      filePath: inputPath,
    };
  } catch (error) {
    if (auditProfile) {
      await recordDatabaseMaintenanceAuditEvent({
        action: "restore-one",
        status: "failed",
        profile: auditProfile,
        targets: [auditProfile.database],
        message: getErrorMessage(error),
      });
    }

    return {
      ok: false,
      message: getErrorMessage(error),
    };
  } finally {
    if (scopedInputPath) {
      await fsp.rm(scopedInputPath, { force: true });
    }
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

    const rows = await listDatabaseRows(pool);
    const databases = filterConnectableDatabases(rows);

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
  let auditProfile: PgConnectionProfile | null = null;

  try {
    const profile = await getConnectionProfile(payload.connectionId);
    auditProfile = profile;
    const pool = getActivePostgresPool(payload.connectionId);
    const runner = await resolveToolRunner("pg_dump", profile);
    const items: PgDatabaseMaintenanceItemResult[] = [];
    const databaseRowsBefore = pool ? await listDatabaseRows(pool) : [];

    await recordDatabaseMaintenanceAuditEvent({
      action: "backup-many",
      status: "started",
      profile,
      targets: payload.databases,
      details: {
        folderPath: payload.folderPath,
        databaseInventoryBefore: getDatabaseNames(databaseRowsBefore),
      },
    });

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
    const databaseRowsAfter = pool ? await listDatabaseRows(pool) : [];
    const missingSelectedDatabases = pool
      ? getMissingSelectedDatabasesAfterBackup(
          databaseRowsBefore,
          databaseRowsAfter,
          payload.databases,
        )
      : [];
    const removedDatabases = pool
      ? getRemovedDatabaseNames(databaseRowsBefore, databaseRowsAfter)
      : [];
    const addedDatabases = pool
      ? getAddedDatabaseNames(databaseRowsBefore, databaseRowsAfter)
      : [];

    if (addedDatabases.length > 0 || removedDatabases.length > 0) {
      await recordDatabaseMaintenanceAuditEvent({
        action: "backup-many",
        status:
          missingSelectedDatabases.length > 0
            ? "safety-failed"
            : "safety-warning",
        profile,
        targets: payload.databases,
        message:
          missingSelectedDatabases.length > 0
            ? `Selected database disappeared after backup: ${missingSelectedDatabases.join(
                ", ",
              )}`
            : "Database inventory changed while backup was running.",
        details: {
          databaseInventoryBefore: getDatabaseNames(databaseRowsBefore),
          databaseInventoryAfter: getDatabaseNames(databaseRowsAfter),
          addedDatabases,
          removedDatabases,
          missingSelectedDatabases,
          items,
        },
      });
    }

    if (missingSelectedDatabases.length > 0) {
      return {
        ok: false,
        message: `Critical: selected database disappeared after backup: ${missingSelectedDatabases.join(
          ", ",
        )}. Check the audit log before running restore.`,
        items,
      };
    }

    await recordDatabaseMaintenanceAuditEvent({
      action: "backup-many",
      status: failedItems.length === 0 ? "succeeded" : "failed",
      profile,
      targets: payload.databases,
      message:
        failedItems.length === 0
          ? `Backed up ${items.length} database${items.length === 1 ? "" : "s"}.`
          : `${failedItems.length} database backup${
              failedItems.length === 1 ? "" : "s"
            } failed.`,
      details: {
        folderPath: payload.folderPath,
        databaseInventoryBefore: getDatabaseNames(databaseRowsBefore),
        databaseInventoryAfter: getDatabaseNames(databaseRowsAfter),
        items,
      },
    });

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
    if (auditProfile) {
      await recordDatabaseMaintenanceAuditEvent({
        action: "backup-many",
        status: "failed",
        profile: auditProfile,
        targets: payload.databases,
        message: getErrorMessage(error),
        details: {
          folderPath: payload.folderPath,
        },
      });
    }

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
  let auditProfile: PgConnectionProfile | null = null;

  try {
    const profile = await getConnectionProfile(payload.connectionId);
    auditProfile = profile;
    const pool = getActivePostgresPool(payload.connectionId);

    if (!pool) {
      throw new Error(
        "Connect to a PostgreSQL database before restoring databases.",
      );
    }

    const runner = await resolveToolRunner("psql", profile);
    const items: PgDatabaseMaintenanceItemResult[] = [];
    const databaseRowsBefore = await listDatabaseRows(pool);

    await recordDatabaseMaintenanceAuditEvent({
      action: "restore-many",
      status: "started",
      profile,
      targets: payload.entries.map((entry) => entry.targetDatabase),
      details: {
        files: payload.entries.map((entry) => entry.filePath),
        databaseInventoryBefore: getDatabaseNames(databaseRowsBefore),
      },
    });

    for (const entry of payload.entries) {
      const databaseProfile = buildProfileForDatabase(
        profile,
        entry.targetDatabase,
      );
      let scopedFilePath: string | null = null;

      try {
        await createDatabaseIfMissing(pool, entry.targetDatabase);
        scopedFilePath = await createDatabaseScopedSqlRestoreFile(
          entry.filePath,
          entry.targetDatabase,
        );
        await runPostgresTool(
          runner,
          "psql",
          databaseProfile,
          getPsqlPlainRestoreArgs(),
          {
            stdinPath: scopedFilePath,
          },
        );
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
      } finally {
        if (scopedFilePath) {
          await fsp.rm(scopedFilePath, { force: true });
        }
      }
    }

    const failedItems = items.filter((item) => !item.ok);
    const databaseRowsAfter = await listDatabaseRows(pool);

    await recordDatabaseMaintenanceAuditEvent({
      action: "restore-many",
      status: failedItems.length === 0 ? "succeeded" : "failed",
      profile,
      targets: payload.entries.map((entry) => entry.targetDatabase),
      message:
        failedItems.length === 0
          ? `Restored ${items.length} database${items.length === 1 ? "" : "s"}.`
          : `${failedItems.length} database restore${
              failedItems.length === 1 ? "" : "s"
            } failed.`,
      details: {
        files: payload.entries.map((entry) => entry.filePath),
        databaseInventoryBefore: getDatabaseNames(databaseRowsBefore),
        databaseInventoryAfter: getDatabaseNames(databaseRowsAfter),
        addedDatabases: getAddedDatabaseNames(
          databaseRowsBefore,
          databaseRowsAfter,
        ),
        removedDatabases: getRemovedDatabaseNames(
          databaseRowsBefore,
          databaseRowsAfter,
        ),
        items,
      },
    });

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
    if (auditProfile) {
      await recordDatabaseMaintenanceAuditEvent({
        action: "restore-many",
        status: "failed",
        profile: auditProfile,
        targets: payload.entries.map((entry) => entry.targetDatabase),
        message: getErrorMessage(error),
        details: {
          files: payload.entries.map((entry) => entry.filePath),
        },
      });
    }

    return {
      ok: false,
      message: getErrorMessage(error),
      items: [],
    };
  }
};
