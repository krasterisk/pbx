import {
  CallCenterOperatorsService,
  findOperatorDeviations,
  median,
  MAX_OUTLIERS,
} from './callcenter-operators.service';
import type { OperatorStatsRow } from '../reports/callcenter-reports.types';

const op = (n: number, partial: Partial<OperatorStatsRow> = {}): OperatorStatsRow => ({
  agentInterface: `PJSIP/e${n}`,
  agentUserUid: n,
  callsHandled: 20,
  totalTalkSec: 0,
  totalHoldSec: 0,
  totalWrapupSec: 0,
  avgHandleSec: 200,
  ahtSec: 200,
  loggedInSec: 8 * 3600,
  totalPauseSec: 0.1 * 8 * 3600,
  totalIdleSec: 0,
  ...partial,
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('findOperatorDeviations', () => {
  const team = () => [op(1), op(2), op(3), op(4)];

  it('flags an operator whose AHT is far above the median, and only that one', () => {
    const res = findOperatorDeviations([...team(), op(5, { ahtSec: 420 })]);
    expect(res.medianAhtSec).toBe(200);
    expect(res.outliers).toEqual([
      expect.objectContaining({ agentInterface: 'PJSIP/e5', ahtSec: 420, flags: ['highAht'] }),
    ]);
  });

  it('does not flag 1.5x exactly or a small gap', () => {
    expect(findOperatorDeviations([...team(), op(5, { ahtSec: 300 })]).outliers).toEqual([]);
    expect(findOperatorDeviations([...team(), op(5, { ahtSec: 250 })]).outliers).toEqual([]);
  });

  it('flags long pauses only above the floor and above 1.5x the median share', () => {
    const long = op(5, { totalPauseSec: 0.4 * 8 * 3600 });
    const res = findOperatorDeviations([...team(), long]);
    expect(res.medianPauseSharePct).toBe(10);
    expect(res.outliers[0]).toMatchObject({ agentInterface: 'PJSIP/e5', pauseSharePct: 40, flags: ['highPause'] });

    // 18 % is 1.8x the median of 10 %, but below the 20 % floor: ordinary breaks, not a deviation.
    const mild = op(6, { totalPauseSec: 0.18 * 8 * 3600 });
    expect(findOperatorDeviations([...team(), mild]).outliers).toEqual([]);
  });

  it('puts the operator with both flags first', () => {
    const res = findOperatorDeviations([
      ...team(),
      op(5, { ahtSec: 600 }),
      op(6, { ahtSec: 400, totalPauseSec: 0.5 * 8 * 3600 }),
    ]);
    expect(res.outliers.map((o) => [o.agentInterface, o.flags])).toEqual([
      ['PJSIP/e6', ['highAht', 'highPause']],
      ['PJSIP/e5', ['highAht']],
    ]);
  });

  it('judges nobody without enough colleagues for a median', () => {
    const res = findOperatorDeviations([op(1), op(2, { ahtSec: 900 })]);
    expect(res).toMatchObject({ medianAhtSec: null, medianPauseSharePct: null, outliers: [] });
  });

  it('ignores operators with too few calls or too little logged-in time', () => {
    const res = findOperatorDeviations([
      ...team(),
      op(5, { callsHandled: 2, ahtSec: 900 }),
      op(6, { loggedInSec: 600, totalPauseSec: 600 }),
    ]);
    expect(res.outliers).toEqual([]);
    // e5 is compared on pauses only, e6 on AHT only; both still count as evaluated.
    expect(res.evaluated).toBe(6);
  });

  it('is bounded', () => {
    const many = Array.from({ length: 30 }, (_, i) => op(100 + i, { ahtSec: 500 + i }));
    expect(findOperatorDeviations([...team(), ...many]).outliers.length).toBeLessThanOrEqual(MAX_OUTLIERS);
  });

  it('is empty without operators', () => {
    expect(findOperatorDeviations([])).toEqual({ evaluated: 0, medianAhtSec: null, medianPauseSharePct: null, outliers: [] });
  });
});

describe('CallCenterOperatorsService', () => {
  it('reads the operator report for the window with an inclusive end bound', async () => {
    const reports = { getOperatorStats: jest.fn().mockResolvedValue({ rows: [] }) };
    const service = new CallCenterOperatorsService(reports as any);
    await service.getDeviations(7, { from: new Date('2026-07-14T17:00:00.000Z'), to: new Date('2026-07-15T12:00:00.000Z') });
    expect(reports.getOperatorStats).toHaveBeenCalledWith(7, {
      dateFrom: '2026-07-14T17:00:00.000Z',
      dateTo: '2026-07-15T11:59:59.999Z',
    });
  });
});
