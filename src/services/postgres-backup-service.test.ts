// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  buildSqlBackupFileName,
  databaseExists,
  filterConnectableDatabases,
  buildMultiDatabaseBackupFilePath,
  buildProfileForDatabase,
  createDatabaseIfMissing,
  getCreateDatabaseSql,
  getPgDumpSqlBackupArgs,
  selectDockerContainerFromPsOutput,
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
  it("uses plain SQL output so backups are saved as readable .sql files", () => {
    expect(getPgDumpSqlBackupArgs()).toEqual([
      "--format=plain",
      "--no-owner",
      "--no-privileges",
    ]);
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
        { datname: "auth", datallowconn: true },
        { datname: "analytics", datallowconn: false },
        { datname: "billing", datallowconn: true },
      ]),
    ).toEqual([{ name: "auth" }, { name: "billing" }]);
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
