#!/usr/bin/env node
/**
 * Harness scenario runner — sequential by default (D-19).
 * Usage:
 *   node runner/index.ts [--scenario <id>] [--tag <tag>] [--kind api|ui|realtime] [--parallel]
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForAppReady } from '../environment/readiness.js';
import { runCleanupQueue } from '../environment/teardown.js';
import { filterScenarios, type ScenarioKind } from './registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessRoot = join(__dirname, '..');

interface CliOptions {
  scenarioId?: string;
  tag?: string;
  kind?: ScenarioKind;
  parallel: boolean;
  listOnly: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { parallel: false, listOnly: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--scenario':
        opts.scenarioId = argv[++i];
        break;
      case '--tag':
        opts.tag = argv[++i];
        break;
      case '--kind':
        opts.kind = argv[++i] as ScenarioKind;
        break;
      case '--parallel':
        opts.parallel = true;
        break;
      case '--list':
        opts.listOnly = true;
        break;
      default:
        break;
    }
  }

  return opts;
}

function runVitest(paths: string[], parallel: boolean): number {
  const args = ['vitest', 'run', ...paths];
  if (!parallel) {
    args.push('--pool=forks', '--maxWorkers=1', '--fileParallelism=false');
  }

  const result = spawnSync('npx', args, {
    cwd: harnessRoot,
    stdio: 'inherit',
    shell: true,
  });

  return result.status ?? 1;
}

async function mainAsync(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  const selected = filterScenarios({
    scenarioId: opts.scenarioId,
    tag: opts.tag,
    kind: opts.kind,
  });

  if (selected.length === 0) {
    console.error('No scenarios matched the given filters.');
    return 1;
  }

  for (const scenario of selected) {
    console.log(`→ ${scenario.id} [${scenario.tags.join(', ')}] (${scenario.kind})`);
  }

  if (opts.listOnly) {
    return 0;
  }

  const apiPaths = selected.filter((s) => s.kind === 'api').map((s) => s.command);
  const uiPaths = selected.filter((s) => s.kind === 'ui');
  const realtimePaths = selected.filter((s) => s.kind === 'realtime');

  if (uiPaths.length > 0 || realtimePaths.length > 0) {
    console.error('UI and realtime scenarios require Playwright (plan 02+). Skipping non-api entries.');
  }

  if (apiPaths.length === 0) {
    console.error('No runnable API scenarios in selection.');
    return 1;
  }

  let exitCode = 1;

  try {
    if (process.env.SKIP_READINESS !== '1') {
      const needsFrontend = uiPaths.length > 0 || opts.kind === 'ui';
      await waitForAppReady({ waitForFrontend: needsFrontend });
    }

    exitCode = runVitest(apiPaths, opts.parallel);
  } finally {
    await runCleanupQueue();
  }

  return exitCode;
}

mainAsync()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    void runCleanupQueue().finally(() => process.exit(1));
  });
