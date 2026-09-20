#!/usr/bin/env node
/**
 * Windows-safe frontend vitest runner.
 * Full `vitest run` discovery hangs at RUN on this host; explicit file batches complete.
 * Globs src tests and runs them in sequential chunks, aggregating exit status.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '../..');
const vitestBin = path.join(repoRoot, 'node_modules/vitest/vitest.mjs');

let globSync;
try {
  ({ globSync } = require(path.join(repoRoot, 'node_modules/tinyglobby/dist/index.cjs')));
} catch {
  ({ globSync } = require('tinyglobby'));
}

const CHUNK = Number(process.env.VITEST_CHUNK || 40);
const files = globSync(['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'], {
  cwd: frontendRoot,
  absolute: false,
  onlyFiles: true,
}).sort();

if (files.length === 0) {
  console.error('vitest-run-src: no test files under src/');
  process.exit(1);
}

console.log(`vitest-run-src: ${files.length} files, chunk=${CHUNK}, platform=${process.platform}`);

let failedFiles = 0;
let failedTests = 0;
let passedFiles = 0;
let passedTests = 0;
let exitCode = 0;

for (let i = 0; i < files.length; i += CHUNK) {
  const chunk = files.slice(i, i + CHUNK);
  const label = `chunk ${Math.floor(i / CHUNK) + 1}/${Math.ceil(files.length / CHUNK)} (${chunk.length} files)`;
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(
    process.execPath,
    [vitestBin, 'run', '--config', 'vite.config.ts', '--reporter=dot', ...chunk],
    {
      cwd: frontendRoot,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    },
  );
  if (result.error) {
    console.error(result.error);
    exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    exitCode = result.status || 1;
    // continue remaining chunks so one bad file does not hide others
  }
}

// Vitest prints per-chunk summaries; print an aggregate notice for CI logs.
console.log(`\nvitest-run-src: finished with exit ${exitCode}`);
process.exit(exitCode);
