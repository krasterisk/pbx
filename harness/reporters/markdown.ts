import { readFileSync } from 'node:fs';
import type { RunSummary } from '../metrics/index.js';

const MAX_ERROR_CHARS = 500;

export interface JunitFailure {
  testcase: string;
  message: string;
}

export function redactSecrets(text: string): string {
  return text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
}

export function truncateError(text: string, max = MAX_ERROR_CHARS): string {
  const cleaned = redactSecrets(text.trim());
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

/** Extract failure snippets from JUnit XML files (API + UI). */
export function parseJunitFailures(junitPaths: string[]): JunitFailure[] {
  const failures: JunitFailure[] = [];

  for (const junitPath of junitPaths) {
    let xml: string;
    try {
      xml = readFileSync(junitPath, 'utf8');
    } catch {
      continue;
    }

    const testcaseRegex =
      /<testcase[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;
    let match: RegExpExecArray | null;

    while ((match = testcaseRegex.exec(xml)) !== null) {
      const [, name, body] = match;
      const failureMatch = body.match(/<failure[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/failure>/);
      if (!failureMatch) continue;

      const messageAttr = failureMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
      const bodyText = failureMatch[2]
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');

      failures.push({
        testcase: name,
        message: truncateError(`${messageAttr}\n${bodyText}`),
      });
    }
  }

  return failures;
}

export function buildMarkdownReport(
  summary: RunSummary,
  options: {
    junitPaths: string[];
    playwrightReportPath?: string;
    gitSha?: string;
  },
): string {
  const lines: string[] = [
    '# Harness Run Summary',
    '',
    `**Started:** ${summary.startedAt}`,
    `**Finished:** ${summary.finishedAt ?? '—'}`,
  ];

  if (options.gitSha) {
    lines.push(`**Git SHA:** ${options.gitSha}`);
  }

  lines.push(
    '',
    '## Totals',
    '',
    '| Passed | Failed | Skipped | Total duration |',
    '| ------ | ------ | ------- | -------------- |',
    `| ${summary.passed} | ${summary.failed} | ${summary.skipped} | ${summary.totalDurationMs} ms |`,
    '',
    '## Scenarios',
    '',
    '| Scenario | Status | Duration | Tags |',
    '| -------- | ------ | -------- | ---- |',
  );

  for (const s of summary.scenarios) {
    lines.push(`| ${s.id} | ${s.status} | ${s.durationMs} ms | ${s.tags.join(', ')} |`);
  }

  if (options.playwrightReportPath) {
    lines.push('', '## Playwright HTML report', '', `[Open report](${options.playwrightReportPath})`);
  }

  const junitFailures = parseJunitFailures(options.junitPaths);
  const scenarioFailures = summary.scenarios.filter((s) => s.status === 'failed' && s.error);

  if (junitFailures.length > 0 || scenarioFailures.length > 0) {
    lines.push('', '## Failed scenarios', '');

    for (const s of scenarioFailures) {
      lines.push(`### ${s.id}`, '', '```', truncateError(s.error ?? ''), '```', '');
    }

    for (const f of junitFailures) {
      lines.push(`### ${f.testcase}`, '', '```', f.message, '```', '');
    }
  }

  lines.push('', '## JUnit artifacts', '');
  for (const p of options.junitPaths) {
    lines.push(`- \`${p}\``);
  }

  return lines.join('\n');
}
