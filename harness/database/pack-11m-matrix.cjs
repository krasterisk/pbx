'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'krasterisk-11m-'));
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
  && (name.startsWith('run-11m') || name.startsWith('pack-11m') || name.startsWith('release-matrix')
    || name.startsWith('clean-install') || name.startsWith('images') || name.startsWith('commercial')
    || name === 'run-11m-ipbx.sh'));
addDir('packages/backend/database', (name) => /\.(cjs|sql|json)$/.test(name) && name !== 'live-proposal-check.cjs');
addDir('packages/backend/src/database', (name) => name.endsWith('.cjs'));
addFile('packages/shared/package.json');
addDir('packages/shared/dist', (name) => name.endsWith('.js') || name.endsWith('.d.ts'));
addFile('.planning/initiatives/ai-products/AI-11-11M-MATRIX.md');
// Bundle prior evidence REMOTE-MATRIX files so remote aggregate can verify presence.
for (const slice of ['11l', '11f', '11o', '11a', '11r']) {
  addFile(`.planning/initiatives/ai-products/evidence/${slice}/REMOTE-MATRIX.md`);
}

fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify({
  name: 'krasterisk-11m-matrix',
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

const archive = path.join(require('os').tmpdir(), 'krasterisk-11m-matrix.tgz');
execFileSync('tar', ['-czf', archive, '-C', stage, '.'], { stdio: 'inherit' });
const bytes = fs.statSync(archive).size;
if (bytes > 3_500_000) throw new Error(`bundle too large: ${bytes}`);
process.stdout.write(`${JSON.stringify({
  stage, archive, bytes, files: files.length,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
})}\n`);
