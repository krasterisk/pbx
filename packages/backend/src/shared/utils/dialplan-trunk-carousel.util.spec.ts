import { readFileSync } from 'fs';
import { join } from 'path';
import type { ITrunkCarouselItem } from '@krasterisk/shared';
import { buildTrunkCarousel, type BuildTrunkCarouselCtx } from './dialplan-trunk-carousel.util';

/** 12-01 characterization: wrap-around attempt order for random_then_failover. */
const BASELINE_N5_WRAP: string[][] = [
  ['t1', 't2', 't3', 't4', 't5'],
  ['t2', 't3', 't4', 't5', 't1'],
  ['t3', 't4', 't5', 't1', 't2'],
  ['t4', 't5', 't1', 't2', 't3'],
  ['t5', 't1', 't2', 't3', 't4'],
];

const DIR_CTX: BuildTrunkCarouselCtx = {
  mode: 'sequential',
  timeout: 60,
  options: 'tT',
  dest: '${EXTEN}',
  vpbxUserUid: 42,
  backendBaseUrl: 'http://backend.test/api',
  dialplanApiKey: 'tc-key',
};

function staticItem(trunkId: string, timeout?: number, value?: string): ITrunkCarouselItem {
  return { trunkId, timeout, callerId: { mode: 'static', value } };
}

function directoryItem(
  trunkId: string,
  directoryUid: number,
  valueFieldUid: number,
  timeout?: number,
): ITrunkCarouselItem {
  return {
    trunkId,
    timeout,
    callerId: {
      mode: 'directory',
      directoryUid,
      valueFieldUid,
      keySource: { source: 'original_caller' },
      onMissing: 'keep_original',
    },
  };
}

function extractTrunkList(dp: string): string[] {
  const match = dp.match(/Set\(TC_LIST=([^)]*)\)/);
  if (!match) {
    return [...dp.matchAll(/Dial\(PJSIP\/([^,/]+)\//g)].map((m) => m[1]);
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
  const trunks = Array.from({ length: n }, (_, i) => staticItem(`t${i + 1}`));
  return buildTrunkCarousel(trunks, { mode: 'random_then_failover' }).split('\n').length;
}

function extractTrunkTimeoutPairs(dp: string): Array<[string, string]> {
  const trunks = extractTrunkList(dp);
  const toMatch = dp.match(/Set\(TC_TIMEOUTS=([^)]*)\)/);
  if (toMatch) {
    const timeouts = toMatch[1].split('|');
    return trunks.map((trunk, i) => [trunk, timeouts[i] ?? '']);
  }
  const dials = [...dp.matchAll(/Dial\(PJSIP\/([^,/]+)\/[^,]*,(\d+)/g)];
  return dials.map((m) => [m[1], m[2]]);
}

function extractLogicalSequence(dp: string): string[] {
  const names = extractTrunkList(dp);
  if (/RAND\(/.test(dp)) return [`RAND:${names.join('|')}`];
  return names;
}

function directoryLookupCount(dp: string): number {
  return (dp.match(/internal\/dialplan\/directory-lookup\?/g) ?? []).length;
}

describe('buildTrunkCarousel (D-36)', () => {
  it('emits one start line for three trunks, not three', () => {
    const dp = buildTrunkCarousel(
      [staticItem('t1'), staticItem('t2'), staticItem('t3')],
      { mode: 'random_then_failover' },
    );
    expect(countStartLines(dp)).toBe(1);
  });

  it('grows linearly: (lines(5)-lines(3)) === (lines(4)-lines(2))', () => {
    expect(lineCount(5) - lineCount(3)).toBe(lineCount(4) - lineCount(2));
  });

  it('keeps the 12-01 wrap-around attempt order for random_then_failover', () => {
    const trunks = ['t1', 't2', 't3', 't4', 't5'].map((id) => staticItem(id));
    const dp = buildTrunkCarousel(trunks, { mode: 'random_then_failover' });
    expect(wrapOrders(extractTrunkList(dp))).toEqual(BASELINE_N5_WRAP);
  });

  it('one trunk emits its name and no unreachable cycle branch', () => {
    const dp = buildTrunkCarousel([staticItem('solo')], { mode: 'random_then_failover' });
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
      [staticItem('a', 20), staticItem('b', 40)],
      { timeout: 60 },
    );
    const pairs = extractTrunkTimeoutPairs(dp);
    expect(pairs).toEqual([
      ['a', '20'],
      ['b', '40'],
    ]);
  });

  it('two modes produce different attempt sequences and do not force random_then_failover', () => {
    const trunks = [staticItem('t1'), staticItem('t2'), staticItem('t3')];
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

  it('dials PJSIP/${TC_TRUNK_ID} without storing a PJSIP/ prefix', () => {
    const dp = buildTrunkCarousel(
      [staticItem('t_alpha_100'), staticItem('t_beta_100')],
      { options: 'tT', dest: '${EXTEN}' },
    );
    expect(dp).toContain('Set(TC_LIST=t_alpha_100|t_beta_100)');
    expect(dp).toContain('Dial(PJSIP/${TC_TRUNK_ID}/${EXTEN},${TC_TIMEOUT},tT)');
    expect(dp).not.toContain('PJSIP/t_alpha_100');
  });
});

describe('buildTrunkCarousel directory CallerID', () => {
  const trunks: ITrunkCarouselItem[] = [
    directoryItem('t_alpha_100', 7, 17, 20),
    directoryItem('t_beta_100', 7, 18, 30),
  ];

  it('uses ${KRSK_ORIG_CALLER_NUM} as the lookup key and never ${CALLERID(num)}', () => {
    const dp = buildTrunkCarousel(trunks, DIR_CTX);
    expect(directoryLookupCount(dp)).toBeGreaterThan(0);
    expect(dp).toContain('key=${URIENCODE(${KRSK_ORIG_CALLER_NUM})}');
    expect(dp).not.toContain('key=${URIENCODE(${CALLERID(num)})}');
    expect(dp).not.toContain('phonebook-lookup');
    expect(dp).not.toContain('/phonebook-lookup');
  });

  it('emits one directory-lookup CURL for directory 7 with fields 17,18', () => {
    const dp = buildTrunkCarousel(trunks, DIR_CTX);
    expect((dp.match(/directory-lookup/g) ?? []).length).toBe(1);
    expect((dp.match(/directory_uid=7/g) ?? []).length).toBe(1);
    expect(dp).toContain('field_uids=17,18');
    expect((dp.match(/\$\{CURL\(/g) ?? []).length).toBe(1);
  });

  it('adds a second CURL when a row from directory 8 is present', () => {
    const dp = buildTrunkCarousel(
      [...trunks, directoryItem('t_gamma_100', 8, 21, 40)],
      DIR_CTX,
    );
    expect((dp.match(/directory-lookup/g) ?? []).length).toBe(2);
    expect((dp.match(/\$\{CURL\(/g) ?? []).length).toBe(2);
    expect(dp).toContain('directory_uid=7');
    expect(dp).toContain('directory_uid=8');
    expect(dp).toContain('field_uids=17,18');
    expect(dp).toContain('field_uids=21');
  });

  it('sorts unique request fields and maps scrambled rows to the right value vars', () => {
    const scrambled: ITrunkCarouselItem[] = [
      directoryItem('t_c', 7, 18, 10),
      directoryItem('t_a', 7, 17, 10),
      directoryItem('t_b', 7, 18, 10),
    ];
    const dp = buildTrunkCarousel(scrambled, DIR_CTX);
    expect(dp).toContain('field_uids=17,18');
    expect(dp).not.toContain('field_uids=18,17');
    expect(dp).not.toContain('field_uids=18,17,18');
    expect(dp).toContain('Set(TC_LIST=t_c|t_a|t_b)');
    expect(dp).toContain('Set(TC_CIDVAR=KRSK_DL_TC7_F18|KRSK_DL_TC7_F17|KRSK_DL_TC7_F18)');
    expect((dp.match(/directory-lookup/g) ?? []).length).toBe(1);
  });

  it('restores original CallerID on every attempt before applying the resolved value', () => {
    const dp = buildTrunkCarousel(trunks, DIR_CTX);
    const restoreIdx = dp.indexOf('Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})');
    const applyIdx = dp.indexOf('Set(CALLERID(num)=${${TC_VV}})');
    const dialIdx = dp.indexOf('Dial(PJSIP/${TC_TRUNK_ID}/');
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(dp.indexOf('n(tc_try)')).toBeGreaterThan(-1);
    expect(restoreIdx).toBeGreaterThan(dp.indexOf('n(tc_try)'));
    expect(applyIdx).toBeGreaterThan(restoreIdx);
    expect(dialIdx).toBeGreaterThan(applyIdx);
    expect(dp).toContain(
      'ExecIf($["${${TC_ST}}" = "FOUND" & "${${TC_VV}}" != ""]?Set(CALLERID(num)=${${TC_VV}}))',
    );
  });

  it('leaves original CallerID when status is NOT_FOUND or malformed', () => {
    const dp = buildTrunkCarousel(trunks, DIR_CTX);
    expect(dp).toContain('Set(KRSK_DL_TC7_STATUS=ERROR)');
    expect(dp).toContain('"${CUT(KRSK_DL_TC7_RAW,|,2)}" = "NOT_FOUND"');
    expect(dp).toContain('Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})');
    expect(dp).not.toMatch(/ExecIf\(\$\["\$\{CUT\([^)]+\|,1\)}" = "1"\]\?Set\(CALLERID/);
    expect(dp).toContain(
      'ExecIf($["${${TC_ST}}" = "FOUND" & "${${TC_VV}}" != ""]?Set(CALLERID(num)=${${TC_VV}}))',
    );
  });
});
