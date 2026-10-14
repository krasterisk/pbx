'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const release = path.join(root, 'artifacts/mpbx-release');
fs.mkdirSync(release, { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'start.cjs', 'ecosystem.config.cjs', 'install.py', 'schema.sql', 'README.md']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(release, file));
}
fs.cpSync(path.join(__dirname, 'shared'), path.join(release, 'shared'), { recursive: true });
fs.cpSync(path.join(root, 'packages/backend/dist-voice-robots'), path.join(release, 'dist'), {
  recursive: true, filter: source => !source.split(path.sep).includes('.git'),
});
fs.mkdirSync(path.join(release, 'models'), { recursive: true });
fs.copyFileSync(path.join(root, 'packages/backend/models/silero_vad.onnx'), path.join(release, 'models/silero_vad.onnx'));
fs.cpSync(path.join(root, 'packages/frontend/dist-mpbx-standalone'), path.join(release, 'frontend'), { recursive: true });
fs.renameSync(path.join(release, 'frontend/mpbx-standalone.html'), path.join(release, 'frontend/standalone.html'));
fs.copyFileSync(path.join(__dirname, 'api.php'), path.join(release, 'frontend/api.php'));
fs.copyFileSync(path.join(__dirname, 'module.php'), path.join(release, 'frontend/module.php'));
fs.copyFileSync(path.join(__dirname, 'mcp.php'), path.join(release, 'frontend/mcp.php'));
fs.cpSync(path.join(__dirname, 'public'), path.join(release, 'frontend'), { recursive: true });
console.log('Prepared release at ' + release);
