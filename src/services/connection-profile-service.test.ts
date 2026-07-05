// @vitest-environment node

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  userDataPath: "",
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, "utf-8")),
    decryptString: vi.fn((value: Buffer) => value.toString("utf-8")),
  },
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name !== "userData") {
        throw new Error(`Unexpected app path: ${name}`);
      }

      return electronMock.userDataPath;
    }),
  },
  safeStorage: electronMock.safeStorage,
}));

describe("connection profile service", () => {
  beforeEach(async () => {
    electronMock.userDataPath = await fsp.mkdtemp(
      path.join(os.tmpdir(), "pgdesk-profiles-"),
    );
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(false);
    vi.resetModules();
  });

  afterEach(async () => {
    await fsp.rm(electronMock.userDataPath, { recursive: true, force: true });
  });

  it("stores connection profiles with user-only file permissions", async () => {
    const { saveConnectionProfile } =
      await import("@electron/services/connection-profile-service");

    await saveConnectionProfile({
      host: "localhost",
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: "secret",
      ssl: false,
    });

    const profilePath = path.join(
      electronMock.userDataPath,
      "connection-profiles.json",
    );
    const profileStat = await fsp.stat(profilePath);

    expect(profileStat.mode & 0o777).toBe(0o600);
  });
});
