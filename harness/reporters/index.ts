import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunSummary } from '../metrics/index.js';
import { buildJsonReport } from './json.js';
import { collectJunitPaths, mergePartialJunitReports } from './junit-merge.js';
import { buildMarkdownReport } from './markdown.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessRoot = join(__dirname, '..');
const reportsDir = join(harnessRoot, 'reports');

export interface AggregateReporterOptions {
  junitPaths?: string[];
  playwrightReportPath?: string;
  gitSha?: string;
}


export function aggregateReporters(
  metricsSummary: RunSummary,
  options: AggregateReporterOptions = {},
): { markdownPath: string; jsonPath: string } {
  mkdirSync(reportsDir, { recursive: true });

  mergePartialJunitReports(reportsDir);

  const junitPaths = options.junitPaths ?? collectJunitPaths(reportsDir);

  const reporterOptions = {
    junitPaths,
    playwrightReportPath: options.playwrightReportPath ?? 'playwright-report/index.html',
    gitSha: options.gitSha ?? process.env.GITHUB_SHA,
  };

  const markdownPath = join(reportsDir, 'summary.md');
  const jsonPath = join(reportsDir, 'summary.json');

  writeFileSync(markdownPath, buildMarkdownReport(metricsSummary, reporterOptions), 'utf8');
  writeFileSync(
    jsonPath,
    `${JSON.stringify(buildJsonReport(metricsSummary, reporterOptions), null, 2)}\n`,
    'utf8',
  );

  return { markdownPath, jsonPath };
}
