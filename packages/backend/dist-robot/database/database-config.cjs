// Shared by Nest/Sequelize and database CLIs. Importing this file performs no I/O.
'use strict';

function invalid(key) {
  // Never include the supplied value: even a misplaced port can contain a secret.
  throw new Error(`Invalid database configuration: ${key}`);
}

function resolveDatabaseConfig(input, { requireExplicitConnection = false } = {}) {
  const text = (key, fallback, allowEmpty = false) => {
    const value = input[key] === undefined ? fallback : input[key];
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(key);
    return value;
  };
  const integer = (key, fallback, min, max) => {
    const value = input[key] === undefined ? fallback : input[key];
    if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) invalid(key);
    return Number(value);
  };
  const dialect = text('DB_DIALECT', 'mysql');
  if (!['mysql', 'postgres'].includes(dialect)) invalid('DB_DIALECT');
  if (requireExplicitConnection) {
    for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
      if (input[key] === undefined) throw new Error(`${key} must be explicitly configured`);
    }
  }
  const timezone = text('DB_TIMEZONE', '+00:00');
  const password = text('DB_PASSWORD', '', true);
  // node-postgres replaces an empty password with ambient PGPASSWORD.
  if (dialect === 'postgres' && !password) invalid('DB_PASSWORD');
  if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(timezone) || (/^[+-]14:/.test(timezone) && !timezone.endsWith(':00'))) invalid('DB_TIMEZONE');
  const sslEnabled = input.DB_SSL === undefined ? 'false' : input.DB_SSL;
  if (!['true', 'false'].includes(sslEnabled)) invalid('DB_SSL');
  if (input.DB_SSL_CA !== undefined && sslEnabled !== 'true') invalid('DB_SSL_CA requires DB_SSL=true');
  const ssl = sslEnabled === 'true'
    ? { rejectUnauthorized: true, ...(input.DB_SSL_CA === undefined ? {} : { ca: text('DB_SSL_CA') }) }
    : undefined;
  const timeout = integer('DB_CONNECT_TIMEOUT_MS', 10000, 1, 2147483647);
  const pool = {
    max: integer('DB_POOL_MAX', 5, 1, 1000),
    min: integer('DB_POOL_MIN', 0, 0, 1000),
    acquire: integer('DB_POOL_ACQUIRE_MS', 30000, 1, 2147483647),
    idle: integer('DB_POOL_IDLE_MS', 10000, 0, 2147483647),
  };
  if (pool.min > pool.max) invalid('DB_POOL_MIN exceeds DB_POOL_MAX');
  // mysql2 disables hostname validation unless verifyIdentity is explicitly set.
  const dialectOptions = ssl
    ? { ssl: dialect === 'mysql' ? { ...ssl, verifyIdentity: true } : ssl }
    : dialect === 'postgres' ? { ssl: false } : {};
  if (dialect === 'mysql') {
    dialectOptions.connectTimeout = timeout;
    if (input.DB_SOCKET !== undefined) dialectOptions.socketPath = text('DB_SOCKET');
    for (const key of ['DB_STATEMENT_TIMEOUT_MS', 'DB_IDLE_TRANSACTION_TIMEOUT_MS']) {
      if (input[key] !== undefined) invalid(`${key} requires postgres`);
    }
  } else {
    if (input.DB_SOCKET !== undefined) invalid('DB_SOCKET requires mysql; use DB_HOST for a PostgreSQL socket directory');
    dialectOptions.connectionTimeoutMillis = timeout;
    dialectOptions.statement_timeout = integer('DB_STATEMENT_TIMEOUT_MS', 0, 0, 2147483647);
    dialectOptions.idle_in_transaction_session_timeout = integer('DB_IDLE_TRANSACTION_TIMEOUT_MS', 0, 0, 2147483647);
  }
  return {
    dialect,
    host: text('DB_HOST', 'localhost'),
    port: integer('DB_PORT', dialect === 'mysql' ? 3306 : 5432, 1, 65535),
    username: text('DB_USER', 'krasterisk'),
    password,
    database: text('DB_NAME', 'krasterisk'),
    timezone,
    pool,
    dialectOptions,
  };
}

function toDriverConfig(config) {
  return {
    host: config.host, port: config.port, user: config.username,
    password: config.password, database: config.database,
    ...config.dialectOptions,
    ...(config.dialect === 'mysql' ? { timezone: config.timezone } : {}),
  };
}

module.exports = { resolveDatabaseConfig, toDriverConfig };
