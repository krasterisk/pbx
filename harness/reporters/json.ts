import type { RunSummary } from '../metrics/index.js';
import { parseJunitFailures, type JunitFailure } from './markdown.js';

export interface SummaryJsonPayload {
  timestamp: string;
  gitSha?: string;
  summary: RunSummary;
  junitPaths: string[];
  playwrightReportPath?: string;
  failures: JunitFailure[];
}

export function buildJsonReport(
  summary: RunSummary,
  options: {
    junitPaths: string[];
    playwrightReportPath?: string;
    gitSha?: string;
  },
): SummaryJsonPayload {
  return {
    timestamp: summary.finishedAt ?? new Date().toISOString(),
    gitSha: options.gitSha,
    summary,
    junitPaths: options.junitPaths,
    playwrightReportPath: options.playwrightReportPath,
    failures: parseJunitFailures(options.junitPaths),
  };
}
