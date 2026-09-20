'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'krasterisk-11o-'));
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
  && !name.includes('odbc')
  && !name.includes('run-10a-smoke') && !name.includes('run-10r-smoke')
  && !name.includes('run-11l-load') && !name.includes('load-profile')
  && !name.includes('run-11f-fault') && !name.includes('fault-matrix')
  && !name.includes('run-d2') && !name.includes('run-d3') && !name.includes('run-d4')
  && !name.includes('run-d6') && !name.includes('run-cap') && !name.includes('run-vr')
  && !name.includes('run-rep') && !name.includes('run-db03') && !name.includes('pack-d')
  && !name.includes('pack-10') && !name.includes('pack-11l') && !name.includes('pack-11f'));
addDir('packages/backend/database', (name) => /\.(cjs|sql|json)$/.test(name) && name !== 'live-proposal-check.cjs');
addDir('packages/backend/src/database', (name) => name.endsWith('.cjs'));
addFile('packages/shared/package.json');
addDir('packages/shared/dist', (name) => name.endsWith('.js') || name.endsWith('.d.ts'));
addFile('.planning/initiatives/ai-products/AI-11-11O-OPS.md');

fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify({
  name: 'krasterisk-11o-ops',
  private: true,
  dependencies: {
    '@krasterisk/shared': 'file:packages/shared',
    bcrypt: '^6.0.0',
    mysql2: '^3.12.0',
    pg: '^8.23.0',
    'pg-hstore': '^2.3.4',
    sequelize: '6.37.8',
    testcontainers: '^10.28.0',
  },
}, null, 2)}\n`);
files.push('package.json');

const archive = path.join(require('os').tmpdir(), 'krasterisk-11o-ops.tgz');
execFileSync('tar', ['-czf', archive, '-C', stage, '.'], { stdio: 'inherit' });
const bytes = fs.statSync(archive).size;
if (bytes > 3_500_000) throw new Error(`bundle too large: ${bytes}`);
process.stdout.write(`${JSON.stringify({
  stage, archive, bytes, files: files.length,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
})}\n`);
