import {
  addQueueCall,
  buildQueueMetricsView,
  classifyQueueCall,
  computeAbandonRate,
  computeAht,
  computeAsa,
  computeOccupancy,
  computeSla,
  effectiveOffered,
  emptyQueueTotals,
  isDirectQueueName,
  isQueueCallRow,
  mergeQueueTotals,
  normalizeShortAbandonSec,
  normalizeSlaThresholdSec,
  shiftDateKey,
  zonedDateKey,
  zonedDayWindow,
  zonedMidnight,
  type QueueCallLike,
} from './index';

const cfg = { slaThresholdSec: 20, shortAbandonSec: 5 };

const answered = (wait: number, talk = 60, wrapup = 10): QueueCallLike => ({
  queue_name: 'q100_1', direction: 'inbound', disposition: 'answered', wait_time: wait, talk_time: talk, wrapup_time: wrapup, hold_time: 5,
});
const abandoned = (wait: number): QueueCallLike => ({
  queue_name: 'q100_1', direction: 'inbound', disposition: 'abandoned', wait_time: wait,
});

describe('queue call filtering', () => {
  it('accepts only inbound real-queue rows', () => {
    expect(isQueueCallRow({ queue_name: 'q100_1', direction: 'inbound' })).toBe(true);
    expect(isQueueCallRow({ queue_name: 'q100_1', direction: null })).toBe(true);
    expect(isQueueCallRow({ queue_name: 'q100_1', direction: 'outbound' })).toBe(false);
    expect(isQueueCallRow({ queue_name: 'q100_1', direction: 'internal' })).toBe(false);
    expect(isQueueCallRow({ queue_name: 'direct:PJSIP/101', direction: 'inbound' })).toBe(false);
    expect(isQueueCallRow({ queue_name: '', direction: 'inbound' })).toBe(false);
    expect(isDirectQueueName('direct:x')).toBe(true);
    expect(isDirectQueueName('q1_1')).toBe(false);
  });
});

describe('classifyQueueCall', () => {
  it('splits handled / abandoned / short abandoned / other', () => {
    expect(classifyQueueCall({ disposition: 'answered', wait_time: 3 }, cfg)).toBe('handled');
    expect(classifyQueueCall({ disposition: 'transferred', wait_time: 3 }, cfg)).toBe('handled');
    expect(classifyQueueCall({ disposition: 'abandoned', wait_time: 5 }, cfg)).toBe('shortAbandoned');
    expect(classifyQueueCall({ disposition: 'abandoned', wait_time: 6 }, cfg)).toBe('abandoned');
    expect(classifyQueueCall({ disposition: 'timeout', wait_time: 40 }, cfg)).toBe('abandoned');
    expect(classifyQueueCall({ disposition: 'other', wait_time: 1 }, cfg)).toBe('other');
  });

  it('shortAbandonSec = 0 disables short-abandon exclusion', () => {
    expect(classifyQueueCall({ disposition: 'abandoned', wait_time: 0 }, { shortAbandonSec: 0 })).toBe('abandoned');
  });
});

describe('settings normalization', () => {
  it('clamps and defaults', () => {
    expect(normalizeShortAbandonSec(undefined)).toBe(5);
    expect(normalizeShortAbandonSec('7')).toBe(7);
    expect(normalizeShortAbandonSec(-3)).toBe(0);
    expect(normalizeShortAbandonSec(999)).toBe(60);
    expect(normalizeSlaThresholdSec(0)).toBe(20);
    expect(normalizeSlaThresholdSec(30)).toBe(30);
  });
});

describe('golden day: live = rollup = report totals', () => {
  // 10 offered: 6 handled (4 in SL, 1 transferred), 1 short abandon, 2 abandoned (one timeout), 1 other.
  const rows: QueueCallLike[] = [
    answered(5), answered(10), answered(20), answered(20),
    answered(30, 120, 20), { ...answered(40, 30, 0), disposition: 'transferred' },
    abandoned(3),
    abandoned(25), { queue_name: 'q100_1', direction: 'inbound', disposition: 'timeout', wait_time: 60 },
    { queue_name: 'q100_1', direction: 'inbound', disposition: 'other', wait_time: 0 },
  ];

  const total = (list: QueueCallLike[]) => {
    const t = emptyQueueTotals();
    for (const r of list) addQueueCall(t, r, cfg);
    return t;
  };

  it('computes the dictionary formulas', () => {
    const t = total(rows);
    expect(t.offered).toBe(10);
    expect(t.handled).toBe(6);
    expect(t.shortAbandoned).toBe(1);
    expect(t.abandoned).toBe(2);
    expect(effectiveOffered(t)).toBe(9);
    expect(computeSla(t)).toBe(44.4); // 4 / 9
    expect(computeAbandonRate(t)).toBe(22.2); // 2 / 9
    expect(computeAsa(t)).toBe(20.8); // (5+10+20+20+30+40) / 6 = 20.83
    // talk 60*4 + 120 + 30 = 390, wrapup 10*4 + 20 + 0 = 60 → 450 / 6, hold is NOT added
    expect(computeAht(t)).toBe(75);
    expect(t.maxWait).toBe(60);
  });

  it('merging partial totals equals totalling all rows (rollup invariance)', () => {
    const merged = mergeQueueTotals(total(rows.slice(0, 4)), total(rows.slice(4)));
    expect(merged).toEqual(total(rows));
  });

  it('view uses wire names and effective denominators', () => {
    const view = buildQueueMetricsView(total(rows));
    expect(view).toMatchObject({ sla: 44.4, abandonRate: 22.2, offered: 10, answered: 6, abandoned: 2, shortAbandoned: 1, transferred: 1 });
  });

  it('zero denominators return 0, not NaN', () => {
    const t = emptyQueueTotals();
    expect(computeSla(t)).toBe(0);
    expect(computeAht(t)).toBe(0);
    expect(computeAsa(t)).toBe(0);
    expect(computeAbandonRate(t)).toBe(0);
    expect(computeOccupancy({ talkSec: 0, wrapupSec: 0, idleSec: 0 })).toBe(0);
  });

  it('only short abandons: denominator is 0 and SLA is 0', () => {
    const t = total([abandoned(1), abandoned(2)]);
    expect(effectiveOffered(t)).toBe(0);
    expect(computeSla(t)).toBe(0);
  });
});

describe('occupancy', () => {
  it('uses talk + wrapup over talk + wrapup + ready', () => {
    expect(computeOccupancy({ talkSec: 600, wrapupSec: 100, idleSec: 300 })).toBe(70);
  });
});

describe('tenant timezone windows', () => {
  it('assigns a 23:30 UTC call to the next local day in UTC+7', () => {
    const at = new Date('2026-10-14T23:30:00Z');
    expect(zonedDateKey(at, 'UTC')).toBe('2026-10-14');
    expect(zonedDateKey(at, 'Asia/Novosibirsk')).toBe('2026-10-15');
  });

  it('local midnight and 24h day window in a fixed-offset zone', () => {
    expect(zonedMidnight(2026, 10, 15, 'Asia/Novosibirsk').toISOString()).toBe('2026-10-14T17:00:00.000Z');
    const w = zonedDayWindow('2026-10-15', 'Asia/Novosibirsk');
    expect(w.to.getTime() - w.from.getTime()).toBe(86_400_000);
  });

  it('DST day is 23h or 25h, not a fixed 24h', () => {
    const spring = zonedDayWindow('2026-03-08', 'America/New_York');
    expect(spring.to.getTime() - spring.from.getTime()).toBe(23 * 3_600_000);
    const fall = zonedDayWindow('2026-11-01', 'America/New_York');
    expect(fall.to.getTime() - fall.from.getTime()).toBe(25 * 3_600_000);
  });

  it('shifts date keys across month and year boundaries', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});
