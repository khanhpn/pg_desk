// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildSqlBackupFileName,
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
