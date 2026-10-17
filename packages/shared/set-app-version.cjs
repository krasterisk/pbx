'use strict';

const { applyAppVersion } = require('./app-version.cjs');

const version = process.argv[2];
if (!version) {
  process.stderr.write('Usage: npm run version:set -- 4.7.1.1\n');
  process.stderr.write('Form: 4.<line>.<change>.<build>. Generation stays 4.\n');
  process.exit(1);
}

try {
  const app = applyAppVersion(version);
  process.stdout.write(`${app.version} npm ${app.npmVersion}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
