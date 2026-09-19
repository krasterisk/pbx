'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const product = process.argv[2] || 'analytics';
assert.ok(['analytics', 'robot', 'community'].includes(product));
const root = path.resolve(__dirname, `../../packages/backend/dist-${product}`);
function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(target) : [path.relative(root, target).replaceAll('\\', '/')];
  });
}
const files = collect(root);
const required = product === 'community'
  ? [
    'community.main.js', 'compositions/community-pbx.module.js',
    'compositions/pbx-core.composition.js', 'database/schema-readiness.cjs',
    'database/database-config.cjs', 'modules/ai-connectivity/ai-connectivity.module.js',
  ]
  : [
    `${product}.main.js`, `compositions/${product}-app.module.js`,
    'database/schema-readiness.cjs', 'database/database-config.cjs',
    'modules/ai-connectivity/ai-connectivity.module.js',
    'modules/integration-credentials/integration-credentials.module.js',
    ...(product === 'analytics'
      ? [
        'modules/speech-analytics/speech-analytics.module.js',
        'modules/integration-delivery/integration-delivery.module.js',
      ]
      : ['modules/recording-capture/recording-capture.module.js']),
  ];
for (const file of required) assert.ok(files.includes(file), `Missing ${product} build artifact ${file}`);
if (product === 'analytics') {
  assert.ok(!files.includes('modules/recording-capture/recording-capture.module.js'),
    'analytics must not ship recording-capture HTTP');
}
if (product === 'robot') {
  assert.ok(!files.includes('modules/speech-analytics/speech-analytics.module.js'),
    'robot must not ship speech-analytics HTTP');
}
const forbidden = product === 'community'
  ? /(?:^|\/)(?:ai-agents|commercial-ai\.composition|app\.module)(?:\/|\.|$)/
  : /(?:^|\/)(?:ami|ari|autodial|voice-robots|routes|contexts|reports|queues|ai-agents|cloud-admin\/cloud-admin\.module)(?:\/|\.|$)/;
for (const file of files) assert.doesNotMatch(file, forbidden, `Forbidden runtime leaked into ${product} build: ${file}`);
console.log(`${product} composition: ${files.length} artifacts, boundary held`);
