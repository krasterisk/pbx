import { describe, expect, it } from 'vitest';
import type { CcDashboardService, CcServiceKpis } from '@krasterisk/shared';
import { DEFAULT_KPI_THRESHOLDS } from '@/features/callcenter/lib/kpiThresholds';
import { buildKpiCards, formatDelta, hasVerdict } from './kpiCards';

const kpis = (partial: Partial<CcServiceKpis> = {}): CcServiceKpis => ({
  offered: 0,
  handled: 0,
  abandoned: 0,
  shortAbandoned: 0,
  transferred: 0,
  sla: 0,
  asr: 0,
  asa: 0,
  aht: 0,
  abandonRate: 0,
  maxWait: 0,
  ...partial,
});

const byId = (service: CcDashboardService) =>
  Object.fromEntries(buildKpiCards(service, DEFAULT_KPI_THRESHOLDS).map((c) => [c.id, c]));

describe('hasVerdict', () => {
  it('needs countable traffic - short abandons alone do not give one', () => {
    expect(hasVerdict(kpis({ offered: 3, shortAbandoned: 3 }))).toBe(false);
    expect(hasVerdict(kpis({ offered: 3, shortAbandoned: 1 }))).toBe(true);
    expect(hasVerdict(kpis())).toBe(false);
  });
});

describe('buildKpiCards', () => {
  const current = kpis({ offered: 120, handled: 100, abandoned: 12, shortAbandoned: 8, sla: 62.5, abandonRate: 10.7, asa: 14, aht: 245 });
  const previous = kpis({ offered: 100, handled: 90, abandoned: 5, shortAbandoned: 5, sla: 80, abandonRate: 5.3, asa: 10, aht: 240 });

  it('colours SLA and abandon by the tenant thresholds and formats times as clock', () => {
    const c = byId({ current, previous });
    expect(c.sla).toMatchObject({ value: '62.5%', tone: 'destructive' }); // below 70
    expect(c.abandon).toMatchObject({ value: '10.7%', tone: 'destructive', shortAbandoned: 8 }); // >= 10 %
    expect(c.asa.value).toBe('0:14');
    expect(c.aht.value).toBe('4:05');
    expect(c.offered).toMatchObject({ value: '120', tone: 'default' });
  });

  it('judges the change by direction: SLA down is bad, a longer ASA/AHT is bad, volume is neutral (U4.1)', () => {
    const c = byId({ current, previous });
    expect(c.sla.delta).toMatchObject({ abs: -17.5, tone: 'destructive' });
    expect(c.abandon.delta).toMatchObject({ trend: 'up', tone: 'destructive' });
    expect(c.asa.delta).toMatchObject({ trend: 'up', tone: 'destructive' });
    expect(c.offered.delta).toMatchObject({ pct: 20, tone: 'default' });
    expect(c.aht.delta).toMatchObject({ trend: 'up', tone: 'destructive' });
    expect(c.sla.deltaKind).toBe('points');
    expect(c.offered.deltaKind).toBe('relative');
    expect(c.sla.targetValue).toBe('70%');
    expect(c.abandon.targetValue).toBe('10%');
    expect(c.asa.targetValue).toBe('1:00');
    expect(c.abandon.reportId).toBe('missed-callback');
    expect(c.aht.reportId).toBe('operator-stats');
    expect(c.sla.reportId).toBe('queue-summary');
  });

  it('has no deltas when previous period had 0 offered calls (U4.1)', () => {
    const c = byId({ current, previous: kpis({ offered: 0, handled: 0 }) });
    expect(Object.values(c).every((card) => card.delta === null)).toBe(true);
  });

  it('has no deltas without a previous period', () => {
    const c = byId({ current, previous: null });
    expect(Object.values(c).every((card) => card.delta === null)).toBe(true);
  });

  it('shows a dash, not 0%, when there is no countable traffic, and does not compare it', () => {
    const quiet = kpis({ offered: 2, shortAbandoned: 2 });
    const c = byId({ current: quiet, previous });
    expect(c.sla).toMatchObject({ value: '—', tone: 'default', delta: null });
    expect(c.abandon).toMatchObject({ value: '—', delta: null, shortAbandoned: 2 });
    expect(c.asa).toMatchObject({ value: '—', delta: null });
    expect(c.offered.value).toBe('2');
  });

  it('does not compare against a previous period that had no verdict', () => {
    const c = byId({ current, previous: kpis({ offered: 4, shortAbandoned: 4 }) });
    expect(c.sla.delta).toBeNull();
    expect(c.abandon.delta).toBeNull();
    expect(c.asa.delta).toBeNull();
    expect(c.offered.delta).not.toBeNull(); // volume is always comparable
  });
});

describe('formatDelta', () => {
  it('formats points with the unit and relative changes in percent', () => {
    expect(formatDelta({ abs: 5, pct: 6.3, trend: 'up', tone: 'success' }, 'points', 'pp')).toBe('+5 pp');
    expect(formatDelta({ abs: -12, pct: -12.5, trend: 'down', tone: 'destructive' }, 'relative', 'pp')).toBe('-12.5%');
  });

  it('falls back to the absolute change when the base was zero', () => {
    expect(formatDelta({ abs: 7, pct: null, trend: 'up', tone: 'default' }, 'relative', 'pp')).toBe('+7');
  });
});
