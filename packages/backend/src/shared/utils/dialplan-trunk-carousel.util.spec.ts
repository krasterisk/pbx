import { readFileSync } from 'fs';
import { join } from 'path';
import { buildTrunkCarousel } from './dialplan-trunk-carousel.util';

/** 12-01 characterization: wrap-around attempt order for random_then_failover. */
const BASELINE_N5_WRAP: string[][] = [
  ['PJSIP/t1', 'PJSIP/t2', 'PJSIP/t3', 'PJSIP/t4', 'PJSIP/t5'],
  ['PJSIP/t2', 'PJSIP/t3', 'PJSIP/t4', 'PJSIP/t5', 'PJSIP/t1'],
  ['PJSIP/t3', 'PJSIP/t4', 'PJSIP/t5', 'PJSIP/t1', 'PJSIP/t2'],
  ['PJSIP/t4', 'PJSIP/t5', 'PJSIP/t1', 'PJSIP/t2', 'PJSIP/t3'],
  ['PJSIP/t5', 'PJSIP/t1', 'PJSIP/t2', 'PJSIP/t3', 'PJSIP/t4'],
];

function extractTrunkList(dp: string): string[] {
  const match = dp.match(/Set\(TC_LIST=([^)]*)\)/);
  if (!match) {
    return [...dp.matchAll(/Dial\(([^,/]+)\//g)].map((m) => m[1]);
  }
  return match[1].split('|').filter(Boolean);
}

function wrapOrders(list: string[]): string[][] {
  return list.map((_, start) => list.map((__, j) => list[(start + j) % list.length]));
}

function countStartLines(dp: string): number {
  const labels = [...dp.matchAll(/\bn\((t\d+|tc_try)\)/g)].map((m) => m[1]);
  const unique = new Set(labels.filter((l) => l === 'tc_try' || /^t\d+$/.test(l)));
  if (unique.size > 0) return unique.size;
  return dp.includes('Set(TC_I=') ? 1 : 0;
}

function lineCount(n: number): number {
  const trunks = Array.from({ length: n }, (_, i) => `t${i + 1}`);
  return buildTrunkCarousel(trunks, { mode: 'random_then_failover' }).split('\n').length;
}

function extractTrunkTimeoutPairs(dp: string): Array<[string, string]> {
  const trunks = extractTrunkList(dp);
  const toMatch = dp.match(/Set\(TC_TIMEOUTS=([^)]*)\)/);
  if (toMatch) {
    const timeouts = toMatch[1].split('|');
    return trunks.map((trunk, i) => [trunk, timeouts[i] ?? '']);
  }
  const dials = [...dp.matchAll(/Dial\(([^,/]+)\/[^,]*,(\d+)/g)];
  return dials.map((m) => [m[1], m[2]]);
}

function extractLogicalSequence(dp: string): string[] {
  const names = extractTrunkList(dp);
  if (/RAND\(/.test(dp)) return [`RAND:${names.join('|')}`];
  return names;
}

describe('buildTrunkCarousel (D-36)', () => {
  it('emits one start line for three trunks, not three', () => {
    const dp = buildTrunkCarousel(['t1', 't2', 't3'], { mode: 'random_then_failover' });
    expect(countStartLines(dp)).toBe(1);
  });

  it('grows linearly: (lines(5)-lines(3)) === (lines(4)-lines(2))', () => {
    expect(lineCount(5) - lineCount(3)).toBe(lineCount(4) - lineCount(2));
  });

  it('keeps the 12-01 wrap-around attempt order for random_then_failover', () => {
    const trunks = ['PJSIP/t1', 'PJSIP/t2', 'PJSIP/t3', 'PJSIP/t4', 'PJSIP/t5'];
    const dp = buildTrunkCarousel(trunks, { mode: 'random_then_failover' });
    expect(wrapOrders(extractTrunkList(dp))).toEqual(BASELINE_N5_WRAP);
  });

  it('one trunk emits its name and no unreachable cycle branch', () => {
    const dp = buildTrunkCarousel(['PJSIP/solo'], { mode: 'random_then_failover' });
    expect(dp).toContain('PJSIP/solo');
    expect(dp).toContain('Dial(');
    expect(dp).not.toMatch(/GotoIf\(\$\["\$\{TC_TRIED\}"/);
    expect(dp).not.toMatch(/\bn\(t2\)/);
  });

  it('empty list emits a diagnostic NoOp and is not empty', () => {
    const dp = buildTrunkCarousel([], { mode: 'random_then_failover' });
    expect(dp).toContain('NoOp(');
    expect(dp.trim().length).toBeGreaterThan(0);
    expect(dp).toMatch(/Empty trunk carousel/i);
  });

  it('binds per-trunk timeouts 20 and 40 to different trunks', () => {
    const dp = buildTrunkCarousel(
      [
        { trunk: 'PJSIP/a', timeout: 20 },
        { trunk: 'PJSIP/b', timeout: 40 },
      ],
      { timeout: 60 },
    );
    const pairs = extractTrunkTimeoutPairs(dp);
    expect(pairs).toEqual([
      ['PJSIP/a', '20'],
      ['PJSIP/b', '40'],
    ]);
  });

  it('two modes produce different attempt sequences and do not force random_then_failover', () => {
    const trunks = ['t1', 't2', 't3'];
    const random = extractLogicalSequence(
      buildTrunkCarousel(trunks, { mode: 'random_then_failover' }),
    );
    const sequential = extractLogicalSequence(
      buildTrunkCarousel(trunks, { mode: 'sequential' }),
    );
    expect(sequential).not.toEqual(random);

    const src = readFileSync(
      join(__dirname, 'dialplan-trunk-carousel.util.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/mode\s*=\s*['"]random_then_failover['"]/);
  });
});
