'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const product = process.argv[2] || 'analytics';
assert.ok(['analytics', 'robot'].includes(product));
const root = path.resolve(__dirname, `../../packages/backend/dist-${product}`);
function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(target) : [path.relative(root, target).replaceAll('\\', '/')];
  });
}
const files = collect(root);
for (const required of [
  `${product}.main.js`, `compositions/${product}-app.module.js`,
  'database/schema-readiness.cjs', 'database/database-config.cjs',
  'modules/ai-connectivity/ai-connectivity.module.js',
  'modules/integration-credentials/integration-credentials.module.js',
]) assert.ok(files.includes(required), `Missing analytics build artifact ${required}`);
const forbidden = /(?:^|\/)(?:ami|ari|autodial|voice-robots|routes|contexts|reports|queues|ai-agents|cloud-admin\/cloud-admin\.module)(?:\/|\.|$)/;
for (const file of files) assert.doesNotMatch(file, forbidden, `PBX runtime leaked into analytics build: ${file}`);
console.log(`${product} composition: ${files.length} artifacts, no PBX runtime modules`);
