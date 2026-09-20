'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXAMPLES = path.resolve(__dirname, '../../packages/backend/src/modules/asterisk-odbc/examples');
const LIVE_PATHS = Object.freeze([
  '/etc/asterisk',
  '/etc/odbc.ini',
  '/etc/odbcinst.ini',
  '/usr/records',
]);
const ANALYTICS_ONLY_INDEPENDENT = true;

function fail(message) {
  throw new Error(message);
}

function assertNotLivePath(target) {
  const resolved = path.resolve(target).replaceAll('\\', '/').toLowerCase();
  const raw = String(target).replaceAll('\\', '/').toLowerCase();
  for (const live of LIVE_PATHS) {
    if (raw === live || raw.startsWith(`${live}/`)
      || resolved === live || resolved.startsWith(`${live}/`)
      || resolved.endsWith(live) || resolved.includes(`${live}/`)) {
      fail(`refusing to write or read live Asterisk/ODBC path ${live}`);
    }
  }
}

function loadCredentials(file) {
  if (!file) fail('operator credentials file is required');
  assertNotLivePath(file);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dialect = parsed.dialect;
  if (!['mysql', 'postgres'].includes(dialect)) fail('DB_DIALECT must be mysql or postgres');
  for (const key of ['host', 'database', 'appUser', 'asteriskUser', 'asteriskPassword']) {
    if (!parsed[key] || typeof parsed[key] !== 'string') fail(`credentials missing ${key}`);
  }
  if (parsed.asteriskUser === parsed.appUser) fail('Asterisk ODBC user must differ from the application DB user');
  if (parsed.asteriskPassword === parsed.appUser || parsed.asteriskPassword === parsed.appPassword) {
    fail('Asterisk ODBC password must not reuse the application secret');
  }
  const port = Number(parsed.port) || (dialect === 'postgres' ? 5432 : 3306);
  return {
    dialect,
    host: parsed.host,
    port,
    database: parsed.database,
    appUser: parsed.appUser,
    appPassword: parsed.appPassword || '',
    asteriskUser: parsed.asteriskUser,
    asteriskPassword: parsed.asteriskPassword,
    tls: parsed.tls !== false,
    cel: parsed.cel !== false,
  };
}

function renderOdbcIni(credentials) {
  if (credentials.dialect === 'postgres') {
    return `[krasterisk]
Driver = PostgreSQL Unicode
Servername = ${credentials.host}
Port = ${credentials.port}
Database = ${credentials.database}
Username = ${credentials.asteriskUser}
Password = ${credentials.asteriskPassword}
SSLMode = ${credentials.tls ? 'require' : 'disable'}
`;
  }
  return `[krasterisk]
Driver = MySQL ODBC 8.4 Unicode Driver
Server = ${credentials.host}
Port = ${credentials.port}
Database = ${credentials.database}
User = ${credentials.asteriskUser}
Password = ${credentials.asteriskPassword}
Charset = utf8mb4
`;
}

function renderResOdbc(credentials) {
  return fs.readFileSync(path.join(EXAMPLES, 'res_odbc.conf.example'), 'utf8')
    .replaceAll('ASTERISK_ODBC_USER', credentials.asteriskUser)
    .replaceAll('ASTERISK_ODBC_PASSWORD', credentials.asteriskPassword);
}

function generateOdbcInstall(outputDir, credentials, { sourceExamples = EXAMPLES } = {}) {
  assertNotLivePath(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {
    'odbc.ini': renderOdbcIni(credentials),
    'res_odbc.conf': renderResOdbc(credentials),
    'cdr_adaptive_odbc.conf': fs.readFileSync(path.join(sourceExamples, 'cdr_adaptive_odbc.conf.example'), 'utf8'),
    'extconfig.conf': fs.readFileSync(path.join(sourceExamples, 'extconfig.conf.example'), 'utf8'),
  };
  if (credentials.cel) {
    files['cel_odbc.conf'] = fs.readFileSync(path.join(sourceExamples, 'cel_odbc.conf.example'), 'utf8');
  }
  for (const [name, body] of Object.entries(files)) {
    if (name !== 'odbc.ini' && name !== 'res_odbc.conf' && body.includes(credentials.asteriskPassword)) {
      fail(`template ${name} must not embed the operator password`);
    }
    fs.writeFileSync(path.join(outputDir, name), body.endsWith('\n') ? body : `${body}\n`);
  }
  const manifest = {
    version: 1,
    dialect: credentials.dialect,
    dsn: 'krasterisk',
    connection: 'asterisk',
    asteriskUser: credentials.asteriskUser,
    appUser: credentials.appUser,
    cel: Boolean(credentials.cel),
    analyticsOnlyIndependent: ANALYTICS_ONLY_INDEPENDENT,
    liveAdaptiveOdbcUntouched: true,
    notes: 'Analytics-only and robots-only standalone installs do not wait for this ODBC installer. Do not copy live DSN secrets. Do not overwrite the host Adaptive ODBC DSN.',
  };
  fs.writeFileSync(path.join(outputDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputDir, files: Object.keys(files).concat('MANIFEST.json'), manifest };
}

function assertCdrMapping(conf) {
  for (const line of [
    'connection=asterisk',
    'table=cdr',
    'alias uniqueid => uniqueid',
    'alias linkedid => linkedid',
    'alias recordingfile => record',
    'alias accountcode => transid',
  ]) {
    if (!conf.includes(line)) fail(`cdr_adaptive_odbc mapping missing ${line}`);
  }
}

async function main(args = process.argv.slice(2)) {
  if (args.includes('--apply-live') || args.includes('--from-live')) {
    fail('refusing to dump or overwrite live Adaptive ODBC');
  }
  const generateAt = args.includes('--generate') ? args[args.indexOf('--generate') + 1] : null;
  const credentialsAt = args.includes('--credentials') ? args[args.indexOf('--credentials') + 1] : null;
  if (!generateAt) fail('Usage: odbc-installer.cjs --generate DIR --credentials FILE');
  const credentials = loadCredentials(credentialsAt);
  const result = generateOdbcInstall(generateAt, credentials);
  assertCdrMapping(fs.readFileSync(path.join(generateAt, 'cdr_adaptive_odbc.conf'), 'utf8'));
  return result;
}

if (require.main === module) {
  Promise.resolve()
    .then(() => main())
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  ANALYTICS_ONLY_INDEPENDENT,
  LIVE_PATHS,
  loadCredentials,
  generateOdbcInstall,
  assertCdrMapping,
  assertNotLivePath,
  main,
};
