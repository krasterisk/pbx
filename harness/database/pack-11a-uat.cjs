'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'krasterisk-11a-'));
const files = [];

function addFile(rel) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) throw new Error(`missing ${rel}`);
  const to = path.join(stage, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files.push(rel.replaceAll('\\', '/'));
}

function addDir(rel, filter) {
  const dir = path.join(root, rel);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) addDir(child, filter);
    else if (!filter || filter(entry.name, child.replaceAll('\\', '/'))) addFile(child);
  }
}

addDir('harness/database', (name) => /\.(cjs|json|sh)$/.test(name)
  && !name.includes('odbc') && !name.includes('run-i2') && !name.includes('run-i3')
  && !name.includes('run-i4') && !name.includes('backup-restore') && !name.includes('upgrade.cjs'));
addDir('packages/backend/database', (name) => /\.(cjs|sql|json)$/.test(name) && name !== 'live-proposal-check.cjs');
addDir('packages/backend/src/database', (name) => name.endsWith('.cjs'));
addDir('packages/backend/dist-analytics', (name) => name.endsWith('.js') || name.endsWith('.cjs'));
addFile('packages/shared/package.json');
addDir('packages/shared/dist', (name) => name.endsWith('.js') || name.endsWith('.d.ts'));
addFile('.planning/initiatives/ai-products/AI-11-11A-UAT.md');

fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify({
  name: 'krasterisk-11a-uat',
  private: true,
  dependencies: {
    '@krasterisk/shared': 'file:packages/shared',
    '@nestjs/common': '^11.0.10',
    '@nestjs/config': '^4.0.0',
    '@nestjs/core': '^11.0.10',
    '@nestjs/jwt': '^11.0.0',
    '@nestjs/platform-express': '^11.0.10',
    '@nestjs/sequelize': '^11.0.0',
    '@nestjs/swagger': '^11.0.3',
    '@nestjs/throttler': '^6.5.0',
    bcrypt: '^6.0.0',
    'class-transformer': '^0.5.1',
    'class-validator': '^0.14.1',
    helmet: '^8.1.0',
    mysql2: '^3.12.0',
    pg: '^8.23.0',
    'pg-hstore': '^2.3.4',
    'reflect-metadata': '^0.2.2',
    rxjs: '^7.8.1',
    sequelize: '6.37.8',
    'sequelize-typescript': '^2.1.6',
    'swagger-ui-express': '^5.0.1',
    jsonwebtoken: '^9.0.2',
    testcontainers: '^10.28.0',
  },
}, null, 2)}\n`);
files.push('package.json');

const archive = path.join(require('os').tmpdir(), 'krasterisk-11a-uat.tgz');
execFileSync('tar', ['-czf', archive, '-C', stage, '.'], { stdio: 'inherit' });
const bytes = fs.statSync(archive).size;
if (bytes > 3_000_000) throw new Error(`bundle too large: ${bytes}`);
process.stdout.write(`${JSON.stringify({
  stage, archive, bytes, files: files.length,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
})}\n`);

