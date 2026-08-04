/**
 * MySQL provisioning for harness — Testcontainers (local) or external GHA-style env (CI interim).
 */
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';

const ROOT_PASSWORD = 'krasterisk';
const DATABASE = 'krasterisk';

export interface HarnessMysqlConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface HarnessMysqlEnv extends HarnessMysqlConnection {
  DB_HOST: string;
  DB_PORT: string;
  DB_USER: string;
  DB_PASS: string;
  DB_NAME: string;
}

export interface StartedHarnessMysql {
  connection: HarnessMysqlConnection;
  env: HarnessMysqlEnv;
  stop: () => Promise<void>;
}

function toEnv(conn: HarnessMysqlConnection): HarnessMysqlEnv {
  return {
    ...conn,
    DB_HOST: conn.host,
    DB_PORT: String(conn.port),
    DB_USER: conn.user,
    DB_PASS: conn.password,
    DB_NAME: conn.database,
  };
}

/** Read MySQL connection from env (GHA services block / docker-compose). */
export function useExternalMysql(): HarnessMysqlEnv {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? '3306');
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASS ?? ROOT_PASSWORD;
  const database = process.env.DB_NAME ?? DATABASE;

  return toEnv({ host, port, user, password, database });
}

/** Start ephemeral MySQL 8 via Testcontainers with GHA-compatible credentials. */
export async function startHarnessMysql(): Promise<StartedHarnessMysql> {
  let container: StartedMySqlContainer;

  try {
    container = await new MySqlContainer('mysql:8.0')
      .withRootPassword(ROOT_PASSWORD)
      .withDatabase(DATABASE)
      .start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to start Testcontainers MySQL (is Docker running?): ${message}`,
    );
  }

  const host = container.getHost();
  const port = container.getMappedPort(3306);
  const connection: HarnessMysqlConnection = {
    host,
    port,
    user: 'root',
    password: ROOT_PASSWORD,
    database: DATABASE,
  };

  return {
    connection,
    env: toEnv(connection),
    stop: () => container.stop(),
  };
}

/** Choose Testcontainers when USE_TESTCONTAINERS=1, else external env MySQL. */
export async function provisionHarnessMysql(): Promise<StartedHarnessMysql | { env: HarnessMysqlEnv; stop: () => Promise<void> }> {
  if (process.env.USE_TESTCONTAINERS === '1') {
    return startHarnessMysql();
  }

  const env = useExternalMysql();
  return {
    env,
    stop: async () => {
      /* external MySQL lifecycle managed by CI / docker-compose */
    },
  };
}
