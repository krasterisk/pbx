import { CallCenterPausesService, foldPauseRows } from './callcenter-pauses.service';
import type { PauseReportRow } from '../reports/callcenter-reports.types';

const row = (partial: Partial<PauseReportRow>): PauseReportRow => ({
  agentInterface: 'PJSIP/e1',
  userId: 1,
  pauseReason: 'Lunch',
  pauseCount: 1,
  totalPauseSec: 600,
  avgPauseSec: 600,
  isPaid: false,
  ...partial,
});

describe('foldPauseRows', () => {
  it('folds operators into one row per reason, largest first', () => {
    const res = foldPauseRows([
      row({ pauseReason: 'Lunch', pauseCount: 2, totalPauseSec: 1200 }),
      row({ agentInterface: 'PJSIP/e2', userId: 2, pauseReason: 'Lunch', pauseCount: 1, totalPauseSec: 600 }),
      row({ pauseReason: 'Training', pauseCount: 1, totalPauseSec: 2400, isPaid: true }),
    ]);
    expect(res.reasons).toEqual([
      { reason: 'Training', count: 1, totalSec: 2400, isPaid: true },
      { reason: 'Lunch', count: 3, totalSec: 1800, isPaid: false },
    ]);
    expect(res).toMatchObject({ count: 4, totalSec: 4200 });
  });

  it('splits time into paid, unpaid and unknown (reason missing from the catalog)', () => {
    const res = foldPauseRows([
      row({ totalPauseSec: 600, isPaid: false }),
      row({ pauseReason: 'Training', totalPauseSec: 300, isPaid: true }),
      row({ pauseReason: '(none)', totalPauseSec: 120, isPaid: null }),
      row({ pauseReason: 'Old', totalPauseSec: 60, isPaid: undefined }),
    ]);
    expect(res).toMatchObject({ paidSec: 300, unpaidSec: 600, unknownSec: 180, totalSec: 1080 });
  });

  it('is empty without pauses', () => {
    expect(foldPauseRows([])).toEqual({ count: 0, totalSec: 0, paidSec: 0, unpaidSec: 0, unknownSec: 0, reasons: [] });
  });
});

describe('CallCenterPausesService', () => {
  it('reads the pause report for the window (inclusive end bound) and for the comparison window', async () => {
    const reports = {
      getPauseReport: jest
        .fn()
        .mockResolvedValueOnce({ rows: [row({ totalPauseSec: 600 })] })
        .mockResolvedValueOnce({ rows: [row({ totalPauseSec: 300 })] }),
    };
    const service = new CallCenterPausesService(reports as any);
    const res = await service.getPauses(
      7,
      { from: new Date('2026-07-14T17:00:00.000Z'), to: new Date('2026-07-15T12:00:00.000Z') },
      { from: new Date('2026-07-07T17:00:00.000Z'), to: new Date('2026-07-08T12:00:00.000Z') },
    );
    expect(reports.getPauseReport).toHaveBeenCalledWith(7, {
      dateFrom: '2026-07-14T17:00:00.000Z',
      dateTo: '2026-07-15T11:59:59.999Z',
    });
    expect(res).toMatchObject({ totalSec: 600, previousTotalSec: 300 });
  });

  it('has no previous total without a comparison window', async () => {
    const reports = { getPauseReport: jest.fn().mockResolvedValue({ rows: [] }) };
    const service = new CallCenterPausesService(reports as any);
    const res = await service.getPauses(7, { from: new Date('2026-07-14T17:00:00Z'), to: new Date('2026-07-15T12:00:00Z') }, null);
    expect(res.previousTotalSec).toBeNull();
    expect(reports.getPauseReport).toHaveBeenCalledTimes(1);
  });
});
