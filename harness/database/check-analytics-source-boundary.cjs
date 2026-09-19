'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'packages/backend');
const product = process.argv[2] || 'analytics';
assert.ok(['analytics', 'robot', 'community'].includes(product));
const configName = `tsconfig.${product}.build.json`;
const tsc = require.resolve('typescript/bin/tsc');
const listed = execFileSync(process.execPath, [tsc, '--listFilesOnly',
  '--project', path.join(backend, configName)],
{ cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const normalized = listed.map(file => path.normalize(file));
const source = normalized.filter(file => file.startsWith(path.join(backend, 'src') + path.sep));
const minFiles = product === 'community' ? 80 : 25;
assert.ok(source.length > minFiles, `${product} graph unexpectedly empty`);
assert.ok(source.every(file => file.endsWith('.ts') || file.endsWith('.cts')));
const forbidden = product === 'community'
  ? /[\\/]ai-agents[\\/]|[\\/]commercial-ai\.composition\.ts$|[\\/]app\.module\.ts$/
  : /[\\/](?:ari|ami|autodial|voice-robots|routes|contexts|reports|queues|ai-agents)[\\/]|[\\/]app\.module\.ts$/;
for (const file of source) {
  assert.doesNotMatch(file, forbidden, `${product} source dependency: ${file}`);
}

const stagePrefix = product === 'community' ? '.community-source-gate-' : '.analytics-source-gate-';
const stage = fs.mkdtempSync(path.join(root, stagePrefix));
function copy(relative) {
  const from = path.join(root, relative);
  const to = path.join(stage, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
try {
  for (const file of source) copy(path.relative(root, file));
  for (const file of [
    'tsconfig.base.json', 'packages/backend/tsconfig.json',
    'packages/backend/tsconfig.build.json',
    `packages/backend/${configName}`,
  ]) copy(file);
  assert.ok(!fs.existsSync(path.join(stage, 'packages/backend/src/app.module.ts')));
  assert.ok(!fs.existsSync(path.join(stage, 'packages/backend/src/modules/ai-agents/ai-agents.module.ts')));
  execFileSync(process.execPath, [tsc, '--project', configName], {
    cwd: path.join(stage, 'packages/backend'), stdio: 'pipe',
  });
  const emitted = path.join(stage, `packages/backend/dist-${product}/${product}.main.js`);
  assert.ok(fs.existsSync(emitted), `Isolated ${product} build did not emit its entrypoint`);
  const absent = product === 'community' ? 'commercial AI product source' : 'PBX source';
  console.log(`Isolated ${product} source build passed with ${source.length} backend files; ${absent} absent`);
} finally {
  const resolvedRoot = fs.realpathSync(root);
  const resolvedStage = fs.realpathSync(stage);
  if (!resolvedStage.startsWith(resolvedRoot + path.sep)
    || !path.basename(resolvedStage).startsWith(stagePrefix)) {
    throw new Error('Refusing to remove an unverified temporary build path');
  }
  fs.rmSync(resolvedStage, { recursive: true, force: true });
}
