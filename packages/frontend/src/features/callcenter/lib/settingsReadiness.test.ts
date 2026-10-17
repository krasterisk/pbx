import { describe, expect, it } from 'vitest';
import { buildReadinessItems, thresholdsAreDefault } from './settingsReadiness';

const base = {
  pauseReasonsCount: 3,
  alertThresholds: { max_wait_sec: 45 },
  screensCount: 1,
  schedulesCount: 2,
  templatesCount: 1,
  hotkeysCustom: false,
};

describe('settings readiness (U5.2)', () => {
  it('an empty pause-reason dictionary is "not configured" and links to its section', () => {
    const item = buildReadinessItems({ ...base, pauseReasonsCount: 0 }).find((i) => i.id === 'pauses');
    expect(item).toMatchObject({ ok: false, count: 0, tab: 'pauseReasons' });
  });

  it('default thresholds are active without custom configuration', () => {
    expect(thresholdsAreDefault(null)).toBe(true);
    expect(thresholdsAreDefault({ max_wait_sec: 60, abandon_rate_pct: 10, sla_critical_pct: 70, agents_available_min: 1 })).toBe(true);
    expect(thresholdsAreDefault({ max_wait_sec: 45 })).toBe(false);
    const item = buildReadinessItems({ ...base, alertThresholds: null }).find((i) => i.id === 'thresholds');
    expect(item?.ok).toBe(true);
  });

  it('zero TV screens / schedules / templates are flagged, positive counts are ok', () => {
    const items = buildReadinessItems({ ...base, screensCount: 0, schedulesCount: 0, templatesCount: 0 });
    for (const id of ['screens', 'schedules', 'templates'] as const) {
      expect(items.find((i) => i.id === id)?.ok).toBe(false);
    }
    const ok = buildReadinessItems(base);
    for (const id of ['pauses', 'thresholds', 'screens', 'schedules', 'templates'] as const) {
      expect(ok.find((i) => i.id === id)?.ok).toBe(true);
    }
  });

  it('skips items that are still loading instead of flashing "not configured"', () => {
    const items = buildReadinessItems({ ...base, pauseReasonsCount: null, screensCount: null });
    expect(items.some((i) => i.id === 'pauses')).toBe(false);
    expect(items.some((i) => i.id === 'screens')).toBe(false);
  });
});
