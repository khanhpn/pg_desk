export type PgConnectionConfig = {
  id?: string;
  name?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type PgConnectionTestResult = {
  ok: boolean;
  message: string;
  database?: string;
  user?: string;
  serverVersion?: string;
};

export type PgConnectionProfile = PgConnectionConfig & {
  id: string;
  name: string;
};

export type PgConnectionListResult = {
  profiles: PgConnectionProfile[];
  activeConnectionId: string | null;
  connectedConnectionIds: string[];
};
