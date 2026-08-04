import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface ParsedSuite {
  attrs: string;
  body: string;
}

function parseTestsuites(xml: string): { header: string; suites: ParsedSuite[] } | null {
  const match = xml.match(/<testsuites([^>]*)>([\s\S]*)<\/testsuites>/);
  if (!match) return null;

  const suites: ParsedSuite[] = [];
  const suiteRegex = /<testsuite([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let suiteMatch: RegExpExecArray | null;
  while ((suiteMatch = suiteRegex.exec(match[2])) !== null) {
    suites.push({ attrs: suiteMatch[1], body: suiteMatch[2] });
  }

  return { header: match[1], suites };
}

function sumAttr(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`${name}="([0-9]+)"`));
  return m ? Number(m[1]) : 0;
}

function setAttr(attrs: string, name: string, value: number | string): string {
  if (new RegExp(`${name}="`).test(attrs)) {
    return attrs.replace(new RegExp(`${name}="[^"]*"`), `${name}="${value}"`);
  }
  return `${attrs} ${name}="${value}"`;
}

/** Merge per-scenario partial JUnit files into reports/junit-api.xml. */
export function mergePartialJunitReports(reportsDir: string): string | null {
  const partials = readdirSync(reportsDir)
    .filter((f) => f.startsWith('junit-partial-') && f.endsWith('.xml'))
    .map((f) => join(reportsDir, f));

  if (partials.length === 0) return null;

  const parsed = partials
    .map((p) => parseTestsuites(readFileSync(p, 'utf8')))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (parsed.length === 0) return null;

  let tests = 0;
  let failures = 0;
  let errors = 0;
  let time = 0;
  const suiteBlocks: string[] = [];

  for (const doc of parsed) {
    for (const suite of doc.suites) {
      tests += sumAttr(suite.attrs, 'tests');
      failures += sumAttr(suite.attrs, 'failures');
      errors += sumAttr(suite.attrs, 'errors');
      time += Number(sumAttr(suite.attrs, 'time'));
      suiteBlocks.push(`    <testsuite${suite.attrs}>${suite.body}</testsuite>`);
    }
  }

  const mergedPath = join(reportsDir, 'junit-api.xml');
  const header = ` name="vitest tests" tests="${tests}" failures="${failures}" errors="${errors}" time="${time}"`;
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<testsuites${header}>\n${suiteBlocks.join('\n')}\n</testsuites>\n`;
  writeFileSync(mergedPath, xml, 'utf8');
  return mergedPath;
}

export function collectJunitPaths(reportsDir: string): string[] {
  const paths: string[] = [];
  const apiMerged = join(reportsDir, 'junit-api.xml');
  const ui = join(reportsDir, 'junit-ui.xml');
  if (existsSync(apiMerged)) paths.push(apiMerged);
  if (existsSync(ui)) paths.push(ui);
  return paths;
}
