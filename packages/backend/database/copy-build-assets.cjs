'use strict';

// tsc does not emit Nest assets. Copy the same set nest-cli.json declares.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Build asset missing: ${path.relative(root, src)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).includes('.git'),
  });
  console.log(`Copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

for (const name of fs.readdirSync(path.join(root, 'src', 'database'))) {
  if (!name.endsWith('.cjs')) continue;
  copy(path.join(root, 'src', 'database', name), path.join(root, 'dist', 'database', name));
}

copy(path.join(root, 'src', 'skills'), path.join(root, 'dist', 'skills'));

try {
  copy(
    path.join(root, 'src', 'modules', 'voice-robots', 'proto'),
    path.join(root, 'dist', 'modules', 'voice-robots', 'proto'),
  );
} catch (error) {
  console.warn(`Proto copy skipped: ${error.message}`);
}
