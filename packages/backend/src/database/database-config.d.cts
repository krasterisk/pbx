export interface DatabaseConfig {
  dialect: 'mysql' | 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  timezone: string;
  pool: { max: number; min: number; acquire: number; idle: number };
  dialectOptions: Record<string, unknown>;
}
export function resolveDatabaseConfig(
  input: Record<string, unknown>,
  options?: { requireExplicitConnection?: boolean },
): DatabaseConfig;
export function toDriverConfig(config: DatabaseConfig): Record<string, unknown>;
