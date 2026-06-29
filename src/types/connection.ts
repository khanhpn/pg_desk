export type PgConnectionForm = {
  id: string | null;
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type PgConnectionField = keyof PgConnectionForm;

export type PgConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};
