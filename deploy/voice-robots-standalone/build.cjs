'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'packages/backend/dist-voice-robots');
fs.mkdirSync(path.join(dist, 'database'), { recursive: true });
for (const skill of ['voice-robots', 'voice-robot-scenarios', 'voice-robot-testing']) {
  fs.mkdirSync(path.join(dist, 'skills', skill), { recursive: true });
  fs.copyFileSync(path.join(root, 'packages/backend/src/skills', skill, 'SKILL.md'), path.join(dist, 'skills', skill, 'SKILL.md'));
}
fs.copyFileSync(path.join(__dirname, 'public/AGENTS.md'), path.join(dist, 'standalone-voice-robots/AGENTS.md'));
const { scenarioFileSchema } = require(path.join(dist, 'modules/voice-robots/voice-robot-scenario.js'));
const { z } = require('zod');
fs.writeFileSync(path.join(__dirname, 'public/scenario.schema.json'), JSON.stringify(z.toJSONSchema(scenarioFileSchema, { target: 'draft-7' }), null, 2) + '\n');
fs.copyFileSync(path.join(root, 'packages/backend/src/database/database-config.cjs'), path.join(dist, 'database/database-config.cjs'));
fs.cpSync(path.join(root, 'packages/backend/src/modules/voice-robots/proto'), path.join(dist, 'modules/voice-robots/proto'), {
  recursive: true, filter: source => !source.split(path.sep).includes('.git'),
});
const packages = new Set(['@nestjs/platform-express', 'mysql2', 'onnxruntime-node']);
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.js')) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:require|import)\(["']([^"']+)["']/g)) {
        const name = match[1];
        if (name.startsWith('.') || name.startsWith('node:') || require('node:module').builtinModules.includes(name)) continue;
        packages.add(name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]);
      }
    }
  }
}
scan(dist);
for (const name of ['@ricky0123/vad-node', '@huggingface/transformers', '@krasterisk/shared']) packages.delete(name);
const dependencies = { '@krasterisk/shared': 'file:./shared' };
for (const name of [...packages].sort()) {
  let resolved = path.dirname(require.resolve(name, { paths: [path.join(root, 'packages/backend')] }));
  while (resolved !== path.dirname(resolved)) {
    const manifest = path.join(resolved, 'package.json');
    if (fs.existsSync(manifest)) {
      const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (data.name === name) { dependencies[name] = data.version; break; }
    }
    resolved = path.dirname(resolved);
  }
  if (!dependencies[name]) throw new Error('Unresolved dependency: ' + name);
}
fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify({ name: 'krasterisk-v3-voice-robots-isolated', version: '1.0.0', private: true, engines: { node: '>=22' }, dependencies }, null, 2) + '\n');
fs.mkdirSync(path.join(__dirname, 'shared'), { recursive: true });
fs.cpSync(path.join(root, 'packages/shared/dist'), path.join(__dirname, 'shared/dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'shared/package.json'), JSON.stringify({ name: '@krasterisk/shared', version: '1.0.0', main: 'dist/index.js' }) + '\n');
console.log('Standalone assets and pinned runtime manifest prepared');
