import { createRequire } from "node:module";
import type { Pool as PgPool, PoolClient } from "pg";
import type {
  PgConnectionConfig,
  PgConnectionTestResult,
} from "@electron/types/connection";
import type { QueryRunPayload, QueryRunResult } from "@electron/types/query";
import { getErrorMessage } from "@electron/utils/error";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as typeof import("pg");

let activePool: PgPool | null = null;

const createPool = (config: PgConnectionConfig): PgPool => {
  return new Pool({
    host: config.host.trim(),
    port: config.port,
    database: config.database.trim(),
    user: config.user.trim(),
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000,
    max: 5,
  });
};

const validateConnectionConfig = (
  config: PgConnectionConfig,
): PgConnectionTestResult | null => {
  if (!config.host.trim()) {
    return {
      ok: false,
      message: "Host is required",
    };
  }

  if (!config.database.trim()) {
    return {
      ok: false,
      message: "Database is required",
    };
  }

  if (!config.user.trim()) {
    return {
      ok: false,
      message: "User is required",
    };
  }

  if (!Number.isFinite(config.port) || config.port <= 0) {
    return {
      ok: false,
      message: "Port is invalid",
    };
  }

  return null;
};

const getConnectionInfo = async (
  client: PoolClient,
): Promise<PgConnectionTestResult> => {
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
};

export const testPostgresConnection = async (
  config: PgConnectionConfig,
): Promise<PgConnectionTestResult> => {
  const validationError = validateConnectionConfig(config);

  if (validationError) {
    return validationError;
  }

  const pool = createPool(config);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    return await getConnectionInfo(client);
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  } finally {
    client?.release();
    await pool.end();
  }
};

export const connectPostgres = async (
  config: PgConnectionConfig,
): Promise<PgConnectionTestResult> => {
  const validationError = validateConnectionConfig(config);

  if (validationError) {
    return validationError;
  }

  const nextPool = createPool(config);
  let client: PoolClient | null = null;

  try {
    client = await nextPool.connect();
    const connectionInfo = await getConnectionInfo(client);

    if (activePool) {
      await activePool.end();
    }

    activePool = nextPool;

    return connectionInfo;
  } catch (error) {
    await nextPool.end();

    return {
      ok: false,
      message: getErrorMessage(error),
    };
  } finally {
    client?.release();
  }
};

export const disconnectPostgres = async (): Promise<void> => {
  if (!activePool) {
    return;
  }

  await activePool.end();
  activePool = null;
};

export const runPostgresQuery = async ({
  sql,
}: QueryRunPayload): Promise<QueryRunResult> => {
  if (!activePool) {
    return {
      ok: false,
      message: "No active PostgreSQL connection",
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  if (!sql.trim()) {
    return {
      ok: false,
      message: "SQL is empty",
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
    };
  }

  const startedAt = Date.now();

  try {
    const result = await activePool.query(sql);
    const durationMs = Date.now() - startedAt;

    return {
      ok: true,
      message: "Query executed successfully",
      columns: result.fields.map((field) => field.name),
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      durationMs,
      command: result.command,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: Date.now() - startedAt,
    };
  }
};
