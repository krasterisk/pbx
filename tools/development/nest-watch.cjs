'use strict';
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');

const exited = child => child.exitCode != null || child.signalCode != null;

function waitForExit(child, terminate, timeoutMs = 10000) {
  if (exited(child) || !child.pid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      error ? reject(error) : resolve();
    };
    const onExit = () => finish();
    const onError = error => finish(error);
    const timer = setTimeout(() => finish(new Error('Backend child did not exit; restart cancelled')), timeoutMs);
    child.once('exit', onExit);
    child.once('error', onError);
    try { terminate(child); } catch (error) { finish(error); }
  });
}

/** Keep one child, wait for its exit, and use the newest completed build. */
function createRestartController({ spawn, terminate, onError = console.error }) {
  let child;
  let requested = 0;
  let applied = 0;
  let draining;
  let closed = false;
  let runningFingerprint;
  let requestedFingerprint;
  const drain = () => {
    if (closed || draining || requested <= applied) return;
    draining = Promise.resolve().then(async () => {
      while (!closed && requested > applied) {
        if (child) {
          const previous = child;
          await waitForExit(previous, terminate);
          if (child === previous) child = undefined;
        }
        if (closed) return;
        applied = requested;
        const fingerprint = requestedFingerprint;
        const next = spawn();
        child = next;
        runningFingerprint = fingerprint;
        next.once('exit', () => { if (child === next) { child = undefined; runningFingerprint = undefined; } });
        next.once('error', error => { if (child === next) { child = undefined; runningFingerprint = undefined; } onError(error); });
      }
    }).catch(error => {
      // Leave a live child alone on genuine termination failures. A later save
      // may retry; neither the watcher nor another process should be killed.
      applied = requested;
      onError(error);
    }).finally(() => { draining = undefined; drain(); });
  };
  const request = fingerprint => {
    if (closed) return false;
    if (fingerprint !== undefined) {
      if (!draining && child && !exited(child) && runningFingerprint === fingerprint) return false;
      if (draining && requestedFingerprint === fingerprint) return false;
    }
    requestedFingerprint = fingerprint;
    requested++; drain(); return true;
  };
  return {
    request,
    idle: async () => { await draining; },
    stop: async () => {
      closed = true;
      await draining;
      if (child) { await waitForExit(child, terminate); child = undefined; }
    },
    stopSync: () => { closed = true; if (child && !exited(child)) terminate(child); },
  };
}

/** Watch notifications can fire without changing emitted code (notably on Windows). */
function buildFingerprint(directory, metadataFiles = [], includeSourceMaps = false, assetSourceDirectory) {
  const hash = createHash('sha256');
  const files = [];
  const visit = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.isFile() && (/\.(js|mjs)$/.test(item.name) || (includeSourceMaps && /\.(js|mjs)\.map$/.test(item.name)))) files.push(file);
    }
  };
  visit(directory);
  for (const file of files.sort()) hash.update(path.relative(directory, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  // Nest copies assets asynchronously. Hash their sources so late copies cannot
  // turn the first unchanged compilation into a spurious application restart.
  if (assetSourceDirectory) {
    const assets = [];
    const visitAssets = dir => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) visitAssets(file);
        else if (item.isFile() && /\.(cjs|json|proto|md)$/.test(item.name)) assets.push(file);
      }
    };
    visitAssets(assetSourceDirectory);
    for (const file of assets.sort()) hash.update(path.relative(assetSourceDirectory, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  for (const file of metadataFiles) hash.update(file).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex');
}

/** taskkill can report 128/255 after killing the child successfully. */
function terminateOwnedChild(child, killTree, isAlive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}) {
  if (exited(child) || !child.pid) return;
  try { killTree(child.pid); } catch (error) {
    if (isAlive(child.pid)) throw error;
  }
}

function run() {
  const fromBackend = createRequire(path.resolve(__dirname, '../../packages/backend/package.json'));
  const version = fromBackend('@nestjs/cli/package.json').version;
  if (!version.startsWith('11.')) throw new Error(`Review Nest watcher compatibility for CLI ${version}`);
  const { StartAction } = fromBackend('@nestjs/cli/actions/start.action');
  const { treeKillSync } = fromBackend('@nestjs/cli/lib/utils/tree-kill');
  if (typeof StartAction.prototype.createOnSuccessHook !== 'function' || typeof StartAction.prototype.spawnChildProcess !== 'function') {
    throw new Error('Nest CLI restart contract changed; review the development runner');
  }
  // Compatibility boundary for Nest CLI 11. The compiler, configuration,
  // assets, path transforms and debug flags remain owned by the installed CLI.
  StartAction.prototype.createOnSuccessHook = function (...args) {
    const options = args.pop();
    const controller = createRestartController({
      spawn: () => this.spawnChildProcess(...args, { ...options, shell: false }),
      terminate: child => terminateOwnedChild(child, treeKillSync),
      onError: error => console.error('[Backend watch] Restart failed:', error),
    });
    process.once('exit', () => {
      try { controller.stopSync(); } catch (error) { console.error('[Backend watch] Cleanup failed:', error); }
    });
    let stopping = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      void controller.stop().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
    });
    return () => {
      try {
        const fingerprint = buildFingerprint(path.resolve(args[3] || 'dist'), [
          path.resolve(__dirname, '../../package-lock.json'),
          path.resolve(__dirname, '../../packages/backend/package.json'),
        ], !!args[2], path.resolve(args[1] || 'src'));
        if (!controller.request(fingerprint)) console.log('[Backend watch] Output unchanged; keeping the current process');
      } catch (error) {
        // A new compilation may already be replacing dist. Keep the healthy
        // child until a complete, readable build is available.
        console.error('[Backend watch] Build fingerprint failed:', error);
      }
    };
  };
  const bin = fromBackend.resolve('@nestjs/cli/bin/nest.js');
  process.argv = [process.execPath, bin, ...process.argv.slice(2)];
  require(bin);
}

module.exports = { createRestartController, terminateOwnedChild, buildFingerprint };
if (require.main === module) run();
