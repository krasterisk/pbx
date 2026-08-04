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
import { endScenario, getRunSummary, resetMetrics, startScenario, type ScenarioStatus } from '../metrics/index.js';
import { initTracing, shutdownTracing, withScenarioSpan } from '../observability/tracing.js';
import { aggregateReporters } from '../reporters/index.js';
import { filterScenarios, type ScenarioEntry, type ScenarioKind } from './registry.js';

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

function runVitest(paths: string[], parallel: boolean, scenarioId?: string): number {
  const args = ['vitest', 'run', ...paths];
  if (!parallel) {
    args.push('--pool=forks', '--maxWorkers=1', '--fileParallelism=false');
  }
  if (scenarioId) {
    args.push('--reporter=default', '--reporter=junit', `--outputFile=reports/junit-partial-${scenarioId}.xml`);
  }

  const result = spawnSync('npx', args, {
    cwd: harnessRoot,
    stdio: 'inherit',
    shell: true,
  });

  return result.status ?? 1;
}

function runPlaywright(paths: string[]): number {
  const pwArgs = ['playwright', 'test', ...paths];
  const result = spawnSync('npx', pwArgs, {
    cwd: harnessRoot,
    stdio: 'inherit',
    shell: true,
  });
  return result.status ?? 1;
}

function exitCodeToStatus(code: number): ScenarioStatus {
  return code === 0 ? 'passed' : 'failed';
}

async function runScenario(scenario: ScenarioEntry, parallel: boolean): Promise<number> {
  return withScenarioSpan(scenario.id, scenario.tags, async () => {
    startScenario(scenario.id, scenario.tags);

    let code: number;
    if (scenario.kind === 'ui') {
      code = runPlaywright([scenario.command]);
    } else {
      code = runVitest([scenario.command], parallel, scenario.id);
    }

    const status = exitCodeToStatus(code);
    endScenario(scenario.id, status);
    return code;
  });
}

async function mainAsync(): Promise<number> {
  initTracing();
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

  if (selected.length === 0) {
    console.error('No runnable scenarios in selection.');
    return 1;
  }

  resetMetrics();
  let exitCode = 0;

  try {
    const needsFrontend = selected.some((s) => s.kind === 'ui') || opts.kind === 'ui';
    if (process.env.SKIP_READINESS !== '1') {
      await waitForAppReady({ waitForFrontend: needsFrontend });
    }

    for (const scenario of selected) {
      const code = await runScenario(scenario, opts.parallel);
      if (code !== 0) exitCode = code;
    }
  } finally {
    const summary = getRunSummary();
    summary.finishedAt = new Date().toISOString();
    const { markdownPath, jsonPath } = aggregateReporters(summary);
    console.log(`→ reports: ${markdownPath}, ${jsonPath}`);
    await runCleanupQueue();
    await shutdownTracing();
  }

  return exitCode;
}

mainAsync()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    void runCleanupQueue().finally(() => process.exit(1));
  });
