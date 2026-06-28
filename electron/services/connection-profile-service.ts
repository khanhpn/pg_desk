import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { PgConnectionConfig } from "@electron/types/connection";

type StoredConnectionProfile = {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  encryptedPassword?: string;
};

const getProfilePath = (): string => {
  return path.join(app.getPath("userData"), "connection-profile.json");
};

export const saveConnectionProfile = async (
  config: PgConnectionConfig,
): Promise<void> => {
  const profilePath = getProfilePath();

  const encryptedPassword =
    safeStorage.isEncryptionAvailable() && config.password
      ? safeStorage.encryptString(config.password).toString("base64")
      : undefined;

  const profile: StoredConnectionProfile = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl,
    encryptedPassword,
  };

  await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");
};

export const loadConnectionProfile =
  async (): Promise<PgConnectionConfig | null> => {
    try {
      const profilePath = getProfilePath();
      const content = await fs.readFile(profilePath, "utf-8");
      const profile = JSON.parse(content) as StoredConnectionProfile;

      const password =
        profile.encryptedPassword && safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(
              Buffer.from(profile.encryptedPassword, "base64"),
            )
          : "";

      return {
        host: profile.host,
        port: profile.port,
        database: profile.database,
        user: profile.user,
        password,
        ssl: profile.ssl,
      };
    } catch {
      return null;
    }
  };
