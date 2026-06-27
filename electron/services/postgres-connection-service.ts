import { createRequire } from "node:module";
import type {
  PgConnectionConfig,
  PgConnectionTestResult,
} from "@electron/types/connection";
import { getErrorMessage } from "@electron/utils/error";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as typeof import("pg");

export const testPostgresConnection = async (
  config: PgConnectionConfig,
): Promise<PgConnectionTestResult> => {
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

  const pool = new Pool({
    host: config.host.trim(),
    port: config.port,
    database: config.database.trim(),
    user: config.user.trim(),
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
};
