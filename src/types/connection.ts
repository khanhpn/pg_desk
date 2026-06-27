export type PgConnectionForm = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type PgConnectionField = keyof PgConnectionForm;
