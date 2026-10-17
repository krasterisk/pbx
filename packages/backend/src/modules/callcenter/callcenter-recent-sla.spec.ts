import { emptyQueueTotals, type QueueTotals } from '@krasterisk/shared';
import { CallCenterIntervalService, INTERVAL_MS } from './callcenter-interval.service';

// 2026-07-15 12:07Z: the quarter in progress starts 12:00Z, "last 30 min" = 11:45Z and later.
const NOW = Date.parse('2026-07-15T12:07:00.000Z');
const at = (iso: string) => Date.parse(iso);

const totals = (handled: number, inSl: number, abandoned = 0, shortAbandoned = 0): QueueTotals => ({
  ...emptyQueueTotals(),
  offered: handled + abandoned + shortAbandoned,
  handled,
  handledInSl: inSl,
  abandoned,
  shortAbandoned,
});

describe('CallCenterIntervalService.getRecentQueueSla', () => {
  let service: CallCenterIntervalService;
  let buckets: Array<{ startMs: number; queueName: string; totals: QueueTotals }>;
  let loadBuckets: jest.SpyInstance;

  beforeEach(() => {
    buckets = [];
    service = new CallCenterIntervalService({} as any, {} as any, {} as any);
    loadBuckets = jest.spyOn(service, 'loadBuckets').mockImplementation(async (_uid, from, to) =>
      buckets.filter((b) => b.startMs >= +from && b.startMs < +to),
    );
  });

  it('reads the two quarters in progress and the two before them', async () => {
    await service.getRecentQueueSla(7, NOW);
    const [uid, from, to] = loadBuckets.mock.calls[0];
    expect(uid).toBe(7);
    expect(new Date(from).toISOString()).toBe('2026-07-15T11:15:00.000Z');
    expect(+to).toBe(NOW + INTERVAL_MS);
  });

  it('gives each queue the SLA of the last half hour against the half hour before', async () => {
    buckets = [
      { startMs: at('2026-07-15T11:15:00Z'), queueName: 'sales', totals: totals(10, 10) },
      { startMs: at('2026-07-15T11:30:00Z'), queueName: 'sales', totals: totals(10, 10) },
      { startMs: at('2026-07-15T11:45:00Z'), queueName: 'sales', totals: totals(10, 5) },
      { startMs: at('2026-07-15T12:00:00Z'), queueName: 'sales', totals: totals(10, 5) },
      { startMs: at('2026-07-15T11:45:00Z'), queueName: 'support', totals: totals(4, 4) },
    ];
    const res = await service.getRecentQueueSla(7, NOW);
    expect(res).toEqual([
      { queueName: 'sales', offered: 20, sla: 50, previousSla: 100 },
      { queueName: 'support', offered: 4, sla: 100, previousSla: null },
    ]);
  });

  it('a window with only short abandons has no verdict, not 0 %', async () => {
    buckets = [{ startMs: at('2026-07-15T11:45:00Z'), queueName: 'ghost', totals: totals(0, 0, 0, 3) }];
    expect(await service.getRecentQueueSla(7, NOW)).toEqual([
      { queueName: 'ghost', offered: 3, sla: null, previousSla: null },
    ]);
  });

  it('is empty when nothing happened', async () => {
    expect(await service.getRecentQueueSla(7, NOW)).toEqual([]);
  });
});
