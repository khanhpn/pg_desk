// @vitest-environment node

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertDatabaseScopedSqlRestore,
  buildDatabaseMaintenanceAuditEvent,
  buildSqlBackupFileName,
  databaseExists,
  getMissingSelectedDatabasesAfterBackup,
  filterConnectableDatabases,
  buildMultiDatabaseBackupFilePath,
  buildProfileForDatabase,
  createDatabaseIfMissing,
  getCreateDatabaseSql,
  getPlainRestorePreludeSql,
  getPgDumpSqlBackupArgs,
  getPsqlPlainRestoreArgs,
  runCommand,
  selectDockerContainerFromPsOutput,
  toDatabaseScopedSqlRestore,
} from "@electron/services/postgres-backup-service";
import type { PgConnectionProfile } from "@electron/types/connection";

const createProfile = (port: number): PgConnectionProfile => ({
  id: "auth",
  name: "auth",
  host: "localhost",
  port,
  user: "root",
  password: "secret",
  database: "auth",
  ssl: false,
});

describe("getPgDumpSqlBackupArgs", () => {
  it("includes cleanup statements so backups can be restored over existing objects", () => {
    expect(getPgDumpSqlBackupArgs()).toEqual([
      "--format=plain",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
    ]);
  });
});

describe("getPsqlPlainRestoreArgs", () => {
  it("stops on errors and restores plain SQL atomically", () => {
    expect(getPsqlPlainRestoreArgs()).toEqual([
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=on",
      "--single-transaction",
    ]);
  });
});

describe("getPlainRestorePreludeSql", () => {
  it("cleans the target database before restoring a plain SQL backup", () => {
    expect(getPlainRestorePreludeSql()).toContain(
      "drop schema if exists %I cascade",
    );
    expect(getPlainRestorePreludeSql()).toContain("nspname not like 'pg_%'");
    expect(getPlainRestorePreludeSql()).toContain("create schema public;");
  });
});

describe("runCommand", () => {
  it("keeps the process stderr when stdin closes early", async () => {
    const tempFilePath = path.join(os.tmpdir(), "pgdesk-stdin-epipe.sql");

    await fsp.writeFile(tempFilePath, "select 1;\n".repeat(100_000), "utf-8");

    try {
      await expect(
        runCommand(
          process.execPath,
          ["-e", "process.stderr.write('psql real error'); process.exit(1);"],
          {
            stdinPath: tempFilePath,
          },
        ),
      ).resolves.toEqual({
        code: 1,
        stderr: "psql real error",
      });
    } finally {
      await fsp.rm(tempFilePath, { force: true });
    }
  });
});

describe("assertDatabaseScopedSqlRestore", () => {
  it("allows single-database dump wrappers when restoring into a chosen target database", () => {
    expect(() =>
      assertDatabaseScopedSqlRestore(
        `
          DROP DATABASE dvdrental;
          CREATE DATABASE dvdrental WITH TEMPLATE = template0 ENCODING = 'UTF8';
          ALTER DATABASE dvdrental OWNER TO postgres;
          \\connect dvdrental
          create table users (id integer);
        `,
        "restore",
      ),
    ).not.toThrow();
  });

  it("allows pg_dump create wrappers when they target the selected database", () => {
    expect(() =>
      assertDatabaseScopedSqlRestore(
        `
          CREATE DATABASE restore;
          \\connect restore
          create table users (id integer);
        `,
        "restore",
      ),
    ).not.toThrow();
  });

  it("rejects role-level SQL that could disable the login used by applications", () => {
    expect(() =>
      assertDatabaseScopedSqlRestore(`
        create table users (id integer);
        alter role postgres with nologin;
      `),
    ).toThrow(/server-level statements/i);
  });

  it("rejects psql connect commands that can leave the selected target database", () => {
    expect(() =>
      assertDatabaseScopedSqlRestore(
        `
          \\connect postgres
          create table users (id integer);
        `,
        "restore",
      ),
    ).toThrow(/server-level statements/i);
  });
});

describe("toDatabaseScopedSqlRestore", () => {
  it("rewrites pg_restore data file placeholders to client-side copy commands", () => {
    expect(
      toDatabaseScopedSqlRestore(
        "COPY public.actor (actor_id, first_name) FROM '$$PATH$$/3057.dat';",
        "restore",
        "/Users/khanh/Downloads/dvdrental",
      ),
    ).toBe(
      "\\copy public.actor (actor_id, first_name) FROM '/Users/khanh/Downloads/dvdrental/3057.dat'",
    );
  });

  it("removes single-database dump wrappers before restoring into a chosen target database", () => {
    const scopedSql = toDatabaseScopedSqlRestore(
      `
        DROP DATABASE dvdrental;
        CREATE DATABASE dvdrental WITH TEMPLATE = template0 ENCODING = 'UTF8';
        ALTER DATABASE dvdrental OWNER TO postgres;
        \\connect dvdrental
        create table users (id integer);
      `,
      "restore",
    );

    expect(scopedSql).toContain("create table users");
    expect(scopedSql).not.toMatch(
      /DROP DATABASE|CREATE DATABASE|ALTER DATABASE|\\connect/i,
    );
  });

  it("removes pg_dump create wrappers before restoring into the selected database", () => {
    expect(
      toDatabaseScopedSqlRestore(
        `
          CREATE DATABASE restore;
          \\connect restore
          create table users (id integer);
        `,
        "restore",
      ),
    ).toContain("create table users");
    expect(
      toDatabaseScopedSqlRestore(
        `
          CREATE DATABASE restore;
          \\connect restore
          create table users (id integer);
        `,
        "restore",
      ),
    ).not.toMatch(/CREATE DATABASE|\\connect/i);
  });
});

describe("buildSqlBackupFileName", () => {
  it("uses database name, version, date label, and .sql extension", () => {
    expect(buildSqlBackupFileName("sales db", 3, "2026_07_01")).toBe(
      "sales-db_v3_2026_07_01.sql",
    );
  });
});

describe("filterConnectableDatabases", () => {
  it("excludes templates and non-connectable databases", () => {
    expect(
      filterConnectableDatabases([
        { datname: "template0", datallowconn: false },
        { datname: "template1", datallowconn: true },
        { datname: "postgres", datallowconn: true },
        { datname: "auth", datallowconn: true },
        { datname: "analytics", datallowconn: false },
        { datname: "billing", datallowconn: true },
      ]),
    ).toEqual([{ name: "auth" }, { name: "billing" }]);
  });
});

describe("buildDatabaseMaintenanceAuditEvent", () => {
  it("records maintenance context without leaking passwords", () => {
    const event = buildDatabaseMaintenanceAuditEvent({
      action: "backup-many",
      status: "started",
      profile: createProfile(5432),
      targets: ["auth"],
      details: {
        folderPath: "/tmp/backups",
      },
    });

    expect(event).toMatchObject({
      action: "backup-many",
      status: "started",
      connection: {
        id: "auth",
        name: "auth",
        host: "localhost",
        port: 5432,
        database: "auth",
        user: "root",
        ssl: false,
      },
      targets: ["auth"],
      details: {
        folderPath: "/tmp/backups",
      },
    });
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});

describe("getMissingSelectedDatabasesAfterBackup", () => {
  it("detects selected databases that existed before backup but disappeared after backup", () => {
    expect(
      getMissingSelectedDatabasesAfterBackup(
        [
          { datname: "auth", datallowconn: true },
          { datname: "billing", datallowconn: true },
        ],
        [{ datname: "billing", datallowconn: true }],
        ["auth", "billing"],
      ),
    ).toEqual(["auth"]);
  });

  it("ignores selected databases that were already missing before backup", () => {
    expect(
      getMissingSelectedDatabasesAfterBackup(
        [{ datname: "billing", datallowconn: true }],
        [{ datname: "billing", datallowconn: true }],
        ["auth", "billing"],
      ),
    ).toEqual([]);
  });
});

describe("buildMultiDatabaseBackupFilePath", () => {
  it("builds versioned SQL paths in the selected folder", async () => {
    await expect(
      buildMultiDatabaseBackupFilePath("/tmp/pgdesk-backups", "sales db"),
    ).resolves.toMatch(
      /\/tmp\/pgdesk-backups\/sales-db_v\d+_\d{4}_\d{2}_\d{2}\.sql$/,
    );
  });
});

describe("databaseExists", () => {
  it("returns true when pg_database contains the target database", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    };

    await expect(databaseExists(pool, "auth")).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      "select 1 from pg_database where datname = $1",
      ["auth"],
    );
  });

  it("returns false when the target database is missing", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rowCount: 0 }),
    };

    await expect(databaseExists(pool, "missing")).resolves.toBe(false);
  });
});

describe("buildProfileForDatabase", () => {
  it("keeps connection settings and changes only the database", () => {
    expect(buildProfileForDatabase(createProfile(5432), "billing")).toEqual({
      ...createProfile(5432),
      database: "billing",
    });
  });
});

describe("getCreateDatabaseSql", () => {
  it("quotes database names safely", () => {
    expect(getCreateDatabaseSql('sales "north"')).toBe(
      'create database "sales ""north"""',
    );
  });
});

describe("createDatabaseIfMissing", () => {
  it("creates the database when pg_database does not contain it", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: null }),
    };

    await createDatabaseIfMissing(client, "billing");

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      "select 1 from pg_database where datname = $1",
      ["billing"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'create database "billing"',
    );
  });

  it("does not create the database when it already exists", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    };

    await createDatabaseIfMissing(client, "auth");

    expect(client.query).toHaveBeenCalledTimes(1);
  });
});

describe("selectDockerContainerFromPsOutput", () => {
  it("chooses the PostgreSQL container published on the connection port when multiple PostgreSQL containers are running", () => {
    const dockerPsOutput = [
      "a1\tpostgres:17\tother-db\t0.0.0.0:5432->5432/tcp",
      "b2\tpostgres:17\tauth-db\t0.0.0.0:5433->5432/tcp",
    ].join("\n");

    expect(
      selectDockerContainerFromPsOutput(dockerPsOutput, createProfile(5433)),
    ).toBe("auth-db");
  });

  it("matches Windows Docker Desktop published port output", () => {
    const dockerPsOutput = [
      "a1\tpostgis/postgis:16\tgeo-db\t0.0.0.0:15432->5432/tcp, [::]:15432->5432/tcp",
      "b2\tpostgres:17\tauth-db\t0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp",
    ].join("\r\n");

    expect(
      selectDockerContainerFromPsOutput(dockerPsOutput, createProfile(5433)),
    ).toBe("auth-db");
  });

  it("does not choose an unrelated PostgreSQL container published on a different port", () => {
    const dockerPsOutput = "a1\tpostgres:17\tother-db\t0.0.0.0:5432->5432/tcp";

    expect(
      selectDockerContainerFromPsOutput(dockerPsOutput, createProfile(5433)),
    ).toBeNull();
  });
});
