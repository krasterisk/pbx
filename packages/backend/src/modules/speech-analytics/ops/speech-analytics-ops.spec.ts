import { defaultSaProjectConfig } from '@krasterisk/shared';
import { analysisAllowed, detectCsatDrop, isDigestDue, stuckBefore } from './speech-analytics-ops';

describe('speech analytics ops', () => {
  it('sends a weekly digest only in the configured hour and day', () => {
    const digest = { ...defaultSaProjectConfig().digest, enabled: true, schedule: 'weekly' as const, weeklyDay: 1, sendHour: 9 };
    const mondayNine = new Date('2026-09-21T09:10:00');
    const mondayTen = new Date('2026-09-21T10:10:00');
    expect(mondayNine.getDay()).toBe(1);
    expect(isDigestDue(digest, mondayNine)).toBe(true);
    expect(isDigestDue(digest, mondayTen)).toBe(false);
  });

  it('flags a CSAT drop past the threshold', () => {
    const alerts = defaultSaProjectConfig().alerts;
    expect(detectCsatDrop({ ...alerts, enabled: true }, 3, 5, 6)).toBe(true);
    expect(detectCsatDrop({ ...alerts, enabled: true }, 4.5, 5, 6)).toBe(false);
    expect(detectCsatDrop({ ...alerts, enabled: true }, 3, 5, 2)).toBe(false);
  });

  it('blocks a run when the cabinet balance is empty', () => {
    expect(analysisAllowed(0)).toBe(false);
    expect(analysisAllowed(12)).toBe(true);
    expect(stuckBefore(new Date('2026-09-24T12:00:00Z'), 10).toISOString()).toBe('2026-09-24T11:50:00.000Z');
  });
});