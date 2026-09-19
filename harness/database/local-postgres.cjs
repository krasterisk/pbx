'use strict';
// Optional local smoke profile. Starts its own cluster, never an installed service.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

async function startLocalPostgres(bin, password) {
  if (!path.isAbsolute(bin)) throw new Error('--postgres-bin must be an absolute path to an installed PostgreSQL bin directory');
  const executable = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'krasterisk-db01-pg-'));
  const data = path.join(root, 'data');
  const passwordFile = path.join(root, 'password');
  const serverLog = path.join(root, 'server.log');
  const options = { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 };
  let initialized = false;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    if (initialized) {
      // Only our newly initialized cluster can be stopped; never targets a service.
      await exec(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop'], options);
    }
    stopped = true;
    // Resolve before recursive cleanup; never follow a supplied data directory.
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('krasterisk-db01-pg-')) throw new Error('Unsafe fixture cleanup target');
    await fs.rm(resolved, { recursive: true, force: true });
  };
  try {
    await fs.writeFile(passwordFile, password, { mode: 0o600 });
    await exec(executable('initdb'), ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile', passwordFile, '--encoding=UTF8', '--locale=C'], options);
    await fs.rm(passwordFile);
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(error => error ? reject(error) : resolve(value)); });
    });
    await exec(executable('pg_ctl'), ['-D', data, '-l', serverLog, '-o', `-h 127.0.0.1 -p ${port}`, '-w', '-t', '30', 'start'], options);
    initialized = true;
    const { Client } = require('pg');
    const db = new Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', connectionTimeoutMillis: 10000 });
    try {
      await db.connect();
      await db.query('CREATE DATABASE krasterisk_db01_admin');
    } finally { await db.end(); }
    return { getHost: () => '127.0.0.1', getMappedPort: () => port, stop };
  } catch {
    // pg_ctl can time out after starting the process; detect only this cluster.
    if (!initialized) initialized = await fs.stat(path.join(data, 'postmaster.pid')).then(() => true, () => false);
    await stop();
    throw new Error('Isolated local PostgreSQL startup failed; no installed service was used');
  }
}

module.exports = { startLocalPostgres };
