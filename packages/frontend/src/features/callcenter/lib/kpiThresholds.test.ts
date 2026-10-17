import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KPI_THRESHOLDS,
  abandonTone,
  availableTone,
  resolveKpiThresholds,
  slaTone,
} from './kpiThresholds';

describe('resolveKpiThresholds', () => {
  it('uses the backend defaults when nothing is configured', () => {
    expect(resolveKpiThresholds(null)).toEqual(DEFAULT_KPI_THRESHOLDS);
    expect(resolveKpiThresholds(undefined)).toEqual({
      slaCriticalPct: 70,
      maxWaitSec: 60,
      abandonRatePct: 10,
      agentsAvailableMin: 1,
    });
  });

  it('maps stored snake_case thresholds', () => {
    expect(
      resolveKpiThresholds({
        sla_critical_pct: 85,
        max_wait_sec: 45,
        abandon_rate_pct: 8,
        agents_available_min: 3,
      }),
    ).toEqual({ slaCriticalPct: 85, maxWaitSec: 45, abandonRatePct: 8, agentsAvailableMin: 3 });
  });

  it('keeps 0 as a real setting instead of falling back to the default', () => {
    expect(resolveKpiThresholds({ agents_available_min: 0 }).agentsAvailableMin).toBe(0);
  });

  it('ignores non-numeric and negative values', () => {
    const t = resolveKpiThresholds({ sla_critical_pct: '90', max_wait_sec: -5, abandon_rate_pct: NaN });
    expect(t.slaCriticalPct).toBe(70);
    expect(t.maxWaitSec).toBe(60);
    expect(t.abandonRatePct).toBe(10);
  });
});

describe('KPI tones', () => {
  const t = resolveKpiThresholds({ sla_critical_pct: 80, abandon_rate_pct: 10, agents_available_min: 2 });

  it('slaTone: destructive below critical, warning within 10 points, else success', () => {
    expect(slaTone(79, t)).toBe('destructive');
    expect(slaTone(80, t)).toBe('warning');
    expect(slaTone(89.9, t)).toBe('warning');
    expect(slaTone(90, t)).toBe('success');
  });

  it('availableTone: destructive below the minimum, warning at it', () => {
    expect(availableTone(1, t)).toBe('destructive');
    expect(availableTone(2, t)).toBe('warning');
    expect(availableTone(3, t)).toBe('success');
  });

  it('abandonTone uses the effective offered denominator and is neutral without traffic', () => {
    expect(abandonTone(0, 0, t)).toBe('default');
    expect(abandonTone(1, 10, t)).toBe('destructive'); // 10 %
    expect(abandonTone(7, 100, t)).toBe('warning'); // 7 % = 70 % of the limit
    expect(abandonTone(2, 100, t)).toBe('success');
  });
});
