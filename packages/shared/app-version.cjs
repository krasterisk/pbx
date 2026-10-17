'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Application version is 4.<line>.<change>.<build>.
 * Generation stays 4 for this product line. npm package versions use the first
 * three numbers because a fourth numeric component is not valid semver.
 *
 *   4.7.1.0 → 4.7.1.1   next build
 *   4.7.1.3 → 4.7.2.0   next change, build resets
 *   4.7.2.4 → 4.8.0.0   next line, change and build reset
 */
const APP_GENERATION = 4;
const VERSION_PATTERN = new RegExp(
  `^${APP_GENERATION}\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$`,
);
const CONSTANT_PATTERN = /export const APP_VERSION = '([^']*)';/;
const CONSTANT_REL = path.join('packages', 'shared', 'src', 'app-version.ts');

function parseAppVersion(value) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new Error(
      `Application version must be ${APP_GENERATION}.<line>.<change>.<build>, received ${JSON.stringify(value)}`,
    );
  }
  const [generation, line, change, build] = value.split('.').map(Number);
  return {
    generation,
    line,
    change,
    build,
    version: value,
    npmVersion: `${generation}.${line}.${change}`,
  };
}

function findRepoRoot(start) {
  let dir = path.resolve(start || __dirname);
  for (let hop = 0; hop < 12; hop += 1) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg && pkg.name === 'krasterisk-v4') return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Krasterisk repository root was not found');
}

function readRootPackage(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function workspaceManifests(pkg) {
  const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];
  return ['package.json', ...workspaces.map((workspace) => path.join(workspace, 'package.json'))];
}

function readDeclaredVersion(pkg) {
  const raw = pkg && pkg.krasterisk && pkg.krasterisk.version;
  if (typeof raw !== 'string') {
    throw new Error('Root package.json krasterisk.version is missing');
  }
  return parseAppVersion(raw);
}

function readConstant(root) {
  const file = path.join(root, CONSTANT_REL);
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(CONSTANT_PATTERN);
  if (!match) throw new Error(`${CONSTANT_REL} is missing export const APP_VERSION`);
  return { file, source, version: match[1] };
}

function newlineOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function replaceNpmVersion(text, npmVersion) {
  if (!/"version"\s*:/.test(text)) throw new Error('package version field was not found');
  return text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${npmVersion}$2`);
}

function replaceRootVersion(text, app) {
  const nl = newlineOf(text);
  let next = replaceNpmVersion(text, app.npmVersion);
  const block = `"krasterisk": {${nl}    "version": "${app.version}"${nl}  }`;
  if (/"krasterisk"\s*:/.test(next)) {
    next = next.replace(/"krasterisk"\s*:\s*\{[^}]*\}/, block);
  } else {
    next = next.replace(/("version"\s*:\s*"[^"]*",)/, `$1${nl}  ${block},`);
  }
  return next;
}

function replaceConstant(text, version) {
  if (!CONSTANT_PATTERN.test(text)) throw new Error('APP_VERSION constant was not found');
  return text.replace(CONSTANT_PATTERN, `export const APP_VERSION = '${version}';`);
}

function replaceNamedVersion(text, name, npmVersion) {
  const pattern = new RegExp(`("name"\\s*:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}",\\s*"version"\\s*:\\s*")[^"]*(")`, 'g');
  let count = 0;
  const next = text.replace(pattern, (_match, prefix, suffix) => {
    count += 1;
    return `${prefix}${npmVersion}${suffix}`;
  });
  if (!count) throw new Error(`lock entry ${name} was not found`);
  return next;
}

function commitJson(file, next) {
  JSON.parse(next);
  if (fs.readFileSync(file, 'utf8') !== next) fs.writeFileSync(file, next);
}

function assertLockstep(root = findRepoRoot(__dirname)) {
  const pkg = readRootPackage(root);
  const app = readDeclaredVersion(pkg);
  const mismatches = [];
  for (const rel of workspaceManifests(pkg)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    if (manifest.version !== app.npmVersion) {
      mismatches.push(`${rel} version ${manifest.version} != ${app.npmVersion}`);
    }
  }
  const constant = readConstant(root);
  if (constant.version !== app.version) {
    mismatches.push(`${CONSTANT_REL} ${constant.version} != ${app.version}`);
  }
  const lockPath = path.join(root, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.version !== app.npmVersion) mismatches.push(`package-lock.json version ${lock.version}`);
  const packages = lock.packages || {};
  const lockKeys = ['', ...(Array.isArray(pkg.workspaces) ? pkg.workspaces : [])];
  for (const key of lockKeys) {
    const entry = packages[key];
    if (!entry || entry.version !== app.npmVersion) {
      mismatches.push(`package-lock.json packages[${JSON.stringify(key)}] version ${entry && entry.version}`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Application versions are out of lockstep with ${app.version}:\n${mismatches.join('\n')}`);
  }
  return app;
}

function applyAppVersion(version, root = findRepoRoot(__dirname)) {
  const app = parseAppVersion(version);
  const rootFile = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
  if (pkg.name !== 'krasterisk-v4') {
    throw new Error('refusing to version a tree that is not krasterisk-v4');
  }
  commitJson(rootFile, replaceRootVersion(fs.readFileSync(rootFile, 'utf8'), app));
  for (const rel of workspaceManifests(pkg).slice(1)) {
    const file = path.join(root, rel);
    commitJson(file, replaceNpmVersion(fs.readFileSync(file, 'utf8'), app.npmVersion));
  }
  const constant = readConstant(root);
  const nextConstant = replaceConstant(constant.source, app.version);
  if (nextConstant !== constant.source) fs.writeFileSync(constant.file, nextConstant);
  const lockFile = path.join(root, 'package-lock.json');
  let lock = fs.readFileSync(lockFile, 'utf8');
  lock = replaceNamedVersion(lock, 'krasterisk-v4', app.npmVersion);
  for (const rel of workspaceManifests(pkg).slice(1)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    lock = replaceNamedVersion(lock, manifest.name, app.npmVersion);
  }
  commitJson(lockFile, lock);
  return assertLockstep(root);
}

module.exports = {
  APP_GENERATION,
  parseAppVersion,
  findRepoRoot,
  assertLockstep,
  applyAppVersion,
};
