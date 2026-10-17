'use strict';

const { assertLockstep } = require('./app-version.cjs');

try {
  const app = assertLockstep();
  process.stdout.write(`${app.version} npm ${app.npmVersion}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
