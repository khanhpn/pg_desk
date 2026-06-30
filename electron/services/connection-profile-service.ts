import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  PgConnectionConfig,
  PgConnectionProfile,
} from "@electron/types/connection";

type StoredConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  encryptedPassword?: string;
};

type StoredConnectionProfileList = {
  activeConnectionId: string | null;
  profiles: StoredConnectionProfile[];
};

type LegacyStoredConnectionProfile = {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  encryptedPassword?: string;
};

const getLegacyProfilePath = (): string => {
  return path.join(app.getPath("userData"), "connection-profile.json");
};

const getProfileListPath = (): string => {
  return path.join(app.getPath("userData"), "connection-profiles.json");
};

const createConnectionId = (): string => {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getDefaultConnectionName = (config: PgConnectionConfig): string => {
  return (
    config.name?.trim() ||
    `${config.user.trim() || "user"}@${config.host.trim() || "host"}/${config.database.trim() || "database"}`
  );
};

const encryptPassword = (password: string): string | undefined => {
  return safeStorage.isEncryptionAvailable() && password
    ? safeStorage.encryptString(password).toString("base64")
    : undefined;
};

const decryptPassword = (encryptedPassword?: string): string => {
  return encryptedPassword && safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(Buffer.from(encryptedPassword, "base64"))
    : "";
};

const toStoredProfile = (
  config: PgConnectionConfig,
  existingId?: string,
): StoredConnectionProfile => {
  const id = config.id || existingId || createConnectionId();

  return {
    id,
    name: getDefaultConnectionName(config),
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl,
    encryptedPassword: encryptPassword(config.password),
  };
};

const toConnectionProfile = (
  profile: StoredConnectionProfile,
): PgConnectionProfile => {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    user: profile.user,
    password: decryptPassword(profile.encryptedPassword),
    ssl: profile.ssl,
  };
};

const readRawProfileList = async (): Promise<StoredConnectionProfileList> => {
  const content = await fs.readFile(getProfileListPath(), "utf-8");
  const list = JSON.parse(content) as StoredConnectionProfileList;
  const profiles = Array.isArray(list.profiles) ? list.profiles : [];

  return {
    activeConnectionId: list.activeConnectionId ?? profiles[0]?.id ?? null,
    profiles,
  };
};

const readLegacyProfileList =
  async (): Promise<StoredConnectionProfileList | null> => {
    try {
      const content = await fs.readFile(getLegacyProfilePath(), "utf-8");
      const legacyProfile = JSON.parse(
        content,
      ) as LegacyStoredConnectionProfile;
      const id = createConnectionId();
      const profile: StoredConnectionProfile = {
        id,
        name: `${legacyProfile.user}@${legacyProfile.host}/${legacyProfile.database}`,
        host: legacyProfile.host,
        port: legacyProfile.port,
        database: legacyProfile.database,
        user: legacyProfile.user,
        ssl: legacyProfile.ssl,
        encryptedPassword: legacyProfile.encryptedPassword,
      };

      return {
        activeConnectionId: id,
        profiles: [profile],
      };
    } catch {
      return null;
    }
  };

const writeRawProfileList = async (
  list: StoredConnectionProfileList,
): Promise<void> => {
  await fs.writeFile(
    getProfileListPath(),
    JSON.stringify(list, null, 2),
    "utf-8",
  );
};

export const loadConnectionProfiles = async (): Promise<{
  activeConnectionId: string | null;
  profiles: PgConnectionProfile[];
}> => {
  try {
    const list = await readRawProfileList();

    return {
      activeConnectionId: list.activeConnectionId,
      profiles: list.profiles.map(toConnectionProfile),
    };
  } catch {
    const legacyList = await readLegacyProfileList();

    if (!legacyList) {
      return {
        activeConnectionId: null,
        profiles: [],
      };
    }

    await writeRawProfileList(legacyList);

    return {
      activeConnectionId: legacyList.activeConnectionId,
      profiles: legacyList.profiles.map(toConnectionProfile),
    };
  }
};

export const loadConnectionProfile =
  async (): Promise<PgConnectionConfig | null> => {
    const list = await loadConnectionProfiles();
    const profile =
      list.profiles.find((candidate) => {
        return candidate.id === list.activeConnectionId;
      }) ?? list.profiles[0];

    return profile ?? null;
  };

export const saveConnectionProfile = async (
  config: PgConnectionConfig,
): Promise<PgConnectionProfile> => {
  const list = await loadConnectionProfiles();
  const existingProfile = config.id
    ? list.profiles.find((profile) => profile.id === config.id)
    : undefined;
  const storedProfiles = list.profiles.map((profile) =>
    toStoredProfile(profile, profile.id),
  );
  const nextStoredProfile = toStoredProfile(config, existingProfile?.id);
  const nextProfiles = existingProfile
    ? storedProfiles.map((profile) =>
        profile.id === nextStoredProfile.id ? nextStoredProfile : profile,
      )
    : [...storedProfiles, nextStoredProfile];

  await writeRawProfileList({
    activeConnectionId: nextStoredProfile.id,
    profiles: nextProfiles,
  });

  return toConnectionProfile(nextStoredProfile);
};

export const deleteConnectionProfile = async (
  connectionId: string,
): Promise<void> => {
  const list = await loadConnectionProfiles();
  const nextProfiles = list.profiles.filter((profile) => {
    return profile.id !== connectionId;
  });
  const activeConnectionId =
    list.activeConnectionId === connectionId
      ? (nextProfiles[0]?.id ?? null)
      : list.activeConnectionId;

  await writeRawProfileList({
    activeConnectionId,
    profiles: nextProfiles.map((profile) =>
      toStoredProfile(profile, profile.id),
    ),
  });
};

export const setActiveConnectionProfile = async (
  connectionId: string,
): Promise<void> => {
  const list = await loadConnectionProfiles();
  const hasProfile = list.profiles.some((profile) => {
    return profile.id === connectionId;
  });

  if (!hasProfile) {
    throw new Error("Connection profile was not found");
  }

  await writeRawProfileList({
    activeConnectionId: connectionId,
    profiles: list.profiles.map((profile) =>
      toStoredProfile(profile, profile.id),
    ),
  });
};
