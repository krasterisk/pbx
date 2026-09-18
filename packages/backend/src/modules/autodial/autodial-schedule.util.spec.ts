import type { IAutodialSchedule } from '@krasterisk/shared';
import {
  campaignWindowOpen,
  scheduleAllows,
  subscriberHoursAllow,
  zonedNow,
} from './autodial-schedule.util';

function schedule(over: Partial<IAutodialSchedule> = {}): IAutodialSchedule {
  return {
    uid: 1,
    campaign_uid: 1,
    kind: 'weekly',
    weekday: null,
    time_from: '09:00',
    time_to: '18:00',
    timezone: 'UTC',
    date_from: null,
    date_to: null,
    enabled: true,
    ...over,
  };
}

describe('zonedNow', () => {
  it('renders wall-clock time in the named zone', () => {
    // 2026-09-17 10:30 UTC is 13:30 in Moscow, a Thursday.
    const local = zonedNow(new Date('2026-09-17T10:30:00Z'), 'Europe/Moscow');
    expect(local.minutes).toBe(13 * 60 + 30);
    expect(local.weekday).toBe(4);
    expect(local.date).toBe('2026-09-17');
  });

  it('rolls the local date forward across the zone boundary', () => {
    const local = zonedNow(new Date('2026-09-17T22:30:00Z'), 'Asia/Vladivostok');
    expect(local.date).toBe('2026-09-18');
  });

  it('reports midnight as minute zero, not 1440', () => {
    const local = zonedNow(new Date('2026-09-17T00:15:00Z'), 'UTC');
    expect(local.minutes).toBe(15);
  });

  it('falls back to UTC for an unknown zone instead of throwing', () => {
    const local = zonedNow(new Date('2026-09-17T10:30:00Z'), 'Mars/Olympus');
    expect(local.minutes).toBe(10 * 60 + 30);
  });
});

describe('scheduleAllows', () => {
  it('admits a time inside the window', () => {
    expect(scheduleAllows(schedule(), new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });

  it('rejects the closing minute so the window is half-open', () => {
    expect(scheduleAllows(schedule(), new Date('2026-09-17T18:00:00Z'))).toBe(false);
  });

  it('rejects a disabled row', () => {
    expect(scheduleAllows(schedule({ enabled: false }), new Date('2026-09-17T12:00:00Z'))).toBe(
      false,
    );
  });

  it('rejects a different weekday for weekly rows', () => {
    // 2026-09-17 is a Thursday (weekday 4).
    expect(scheduleAllows(schedule({ weekday: 1 }), new Date('2026-09-17T12:00:00Z'))).toBe(false);
    expect(scheduleAllows(schedule({ weekday: 4 }), new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });

  it('honours the date range', () => {
    const row = schedule({ kind: 'date_range', date_from: '2026-09-18', date_to: '2026-09-20' });
    expect(scheduleAllows(row, new Date('2026-09-17T12:00:00Z'))).toBe(false);
    expect(scheduleAllows(row, new Date('2026-09-19T12:00:00Z'))).toBe(true);
  });

  it('rejects an inverted window rather than dialing all day', () => {
    expect(
      scheduleAllows(schedule({ time_from: '18:00', time_to: '09:00' }), new Date('2026-09-17T20:00:00Z')),
    ).toBe(false);
  });

  it('evaluates the window in the row timezone, not the server one', () => {
    // 23:30 UTC is 09:30 next day in Vladivostok (UTC+10) — inside 09:00-18:00 there.
    const row = schedule({ timezone: 'Asia/Vladivostok' });
    expect(scheduleAllows(row, new Date('2026-09-17T23:30:00Z'))).toBe(true);
    expect(scheduleAllows(schedule(), new Date('2026-09-17T23:30:00Z'))).toBe(false);
  });
});

describe('campaignWindowOpen', () => {
  it('dials around the clock when no schedule is configured', () => {
    expect(campaignWindowOpen([], new Date('2026-09-17T03:00:00Z'))).toBe(true);
  });

  it('opens when any enabled row matches', () => {
    const rows = [schedule({ weekday: 1 }), schedule({ uid: 2, weekday: 4 })];
    expect(campaignWindowOpen(rows, new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });

  it('stays closed when every row misses', () => {
    const rows = [schedule({ weekday: 1 }), schedule({ uid: 2, weekday: 2 })];
    expect(campaignWindowOpen(rows, new Date('2026-09-17T12:00:00Z'))).toBe(false);
  });

  it('stays closed when every configured window is disabled', () => {
    expect(
      campaignWindowOpen([schedule({ enabled: false })], new Date('2026-09-17T03:00:00Z')),
    ).toBe(false);
  });
});

describe('subscriberHoursAllow', () => {
  it('uses the subscriber offset, not the server clock', () => {
    // 04:00 UTC is 11:00 for a +7 subscriber — inside 09:00-20:00.
    expect(subscriberHoursAllow(420, new Date('2026-09-17T04:00:00Z'), '09:00', '20:00')).toBe(true);
    // Same instant is 04:00 for a UTC subscriber — outside.
    expect(subscriberHoursAllow(0, new Date('2026-09-17T04:00:00Z'), '09:00', '20:00')).toBe(false);
  });

  it('wraps negative offsets back into the previous day', () => {
    // 02:00 UTC is 18:00 the day before for a -8 subscriber — still inside.
    expect(subscriberHoursAllow(-480, new Date('2026-09-17T02:00:00Z'), '09:00', '20:00')).toBe(
      true,
    );
    // 12:00 UTC is 04:00 for the same subscriber — outside.
    expect(subscriberHoursAllow(-480, new Date('2026-09-17T12:00:00Z'), '09:00', '20:00')).toBe(
      false,
    );
  });

  it('allows everything when the bounds are unusable', () => {
    expect(subscriberHoursAllow(0, new Date('2026-09-17T04:00:00Z'), 'nonsense', '20:00')).toBe(
      true,
    );
  });
});
