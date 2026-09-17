import { describe, it, expect } from 'vitest';
import {
  resolveSupervisorKpiPeriodMeta,
  rollupSupervisorKpis,
  rollupSupervisorPeriodKpis,
} from './supervisorKpiRollup';
import type { IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';

function queue(partial: Partial<IQueueStats> & Pick<IQueueStats, 'name' | 'calls' | 'sla' | 'avgWait'>): IQueueStats {
  return {
    displayName: partial.name,
    strategy: 'ringall',
    waiting: 0,
    talking: 0,
    agents: { total: 0, available: 0, paused: 0, busy: 0 },
    avgTalk: 0,
    userUid: 0,
    ...partial,
  };
}

describe('supervisorKpiRollup', () => {
  it('weights SLA by offered and ignores empty queues', () => {
    const period = rollupSupervisorPeriodKpis([
      queue({ name: 'a', sla: 50, avgWait: 10, calls: { answered: 5, abandoned: 5, total: 10 } }),
      queue({ name: 'b', sla: 100, avgWait: 0, calls: { answered: 0, abandoned: 0, total: 0 } }),
      queue({ name: 'c', sla: 100, avgWait: 20, calls: { answered: 10, abandoned: 0, total: 10 } }),
    ]);
    // (50*10 + 100*10) / 20 = 75
    expect(period.sla).toBe(75);
    expect(period.answered).toBe(15);
    expect(period.abandoned).toBe(5);
    // ASA: (10*5 + 20*10) / 15 = 250/15 ≈ 17
    expect(period.avgWait).toBe(17);
  });

  it('returns SLA 0 when nothing was offered (not 100)', () => {
    expect(rollupSupervisorPeriodKpis([
      queue({ name: 'empty', sla: 100, avgWait: 0, calls: { answered: 0, abandoned: 0, total: 0 } }),
    ])).toEqual({
      answered: 0,
      abandoned: 0,
      offered: 0,
      sla: 0,
      avgWait: 0,
    });
  });

  it('rolls live counters from agents + queues', () => {
    const rollup = rollupSupervisorKpis(
      [
        { status: 'READY' },
        { status: 'PAUSED' },
        { status: 'IN_CALL' },
        { status: 'READY' },
      ],
      [
        queue({ name: 'q1', waiting: 2, talking: 1, sla: 80, avgWait: 5, calls: { answered: 1, abandoned: 0, total: 1 } }),
        queue({ name: 'q2', waiting: 1, talking: 0, sla: 90, avgWait: 3, calls: { answered: 2, abandoned: 1, total: 3 } }),
      ] as IQueueStats[],
    );
    expect(rollup.live).toEqual({
      waiting: 3,
      talking: 1,
      freeAgents: 2,
      totalAgents: 4,
    });
    expect(rollup.period.abandoned).toBe(1);
    expect(rollup.period.answered).toBe(3);
  });

  it('resolves period meta from shift_policy', () => {
    expect(resolveSupervisorKpiPeriodMeta(null)).toEqual({
      mode: 'calendar_day',
      boundaryTime: '00:00',
    });
    expect(resolveSupervisorKpiPeriodMeta({
      close_at_eod: true,
      eod_time: '08:00',
    })).toEqual({
      mode: 'business_day',
      boundaryTime: '08:00',
    });
    expect(resolveSupervisorKpiPeriodMeta({
      close_at_eod: true,
      eod_time: '00:00',
    }).mode).toBe('calendar_day');
  });
});
