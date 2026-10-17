import { describe, it, expect } from 'vitest';
import type { IQueueStats } from '../model/types/callCenterSchema';
import { DEFAULT_KPI_THRESHOLDS } from './kpiThresholds';
import { queueTileMetrics, waitTone } from './queueTiles';

const T = { ...DEFAULT_KPI_THRESHOLDS }; // sla 70, wait 60, abandon 10

function queue(partial: Partial<IQueueStats> = {}): IQueueStats {
  return {
    name: 'sales',
    displayName: 'Sales',
    strategy: 'rrmemory',
    waiting: 0,
    talking: 0,
    agents: { total: 5, available: 3, paused: 1, busy: 1 },
    sla: 92,
    calls: { answered: 18, abandoned: 2, total: 21, shortAbandoned: 1 },
    avgWait: 12.4,
    avgTalk: 98.6,
    userUid: 1,
    ...partial,
  };
}

describe('waitTone', () => {
  it('is default without waiters, calm below 70%, warning from 70%, destructive past the limit', () => {
    expect(waitTone(0, T)).toBe('default');
    expect(waitTone(20, T)).toBe('success');
    expect(waitTone(42, T)).toBe('warning');
    expect(waitTone(60, T)).toBe('warning');
    expect(waitTone(61, T)).toBe('destructive');
  });

  it('a zero limit disables the escalation', () => {
    expect(waitTone(999, { ...T, maxWaitSec: 0 })).toBe('success');
  });
});

describe('queueTileMetrics', () => {
  it('computes abandon rate over effective offered calls and rounds ASA/AHT', () => {
    const m = queueTileMetrics(queue(), 0, T);
    expect(m.hasTraffic).toBe(true);
    expect(m.abandonPct).toBe(10); // 2 / (21 - 1)
    expect(m.abandonTone).toBe('destructive'); // 10 >= abandon threshold 10
    expect(m.asaSec).toBe(12);
    expect(m.ahtSec).toBe(99);
    expect(m.slaTone).toBe('success');
  });

  it('queue without effective traffic is "no data" rather than red', () => {
    const idle = queueTileMetrics(queue({ sla: 0, calls: { answered: 0, abandoned: 0, total: 3, shortAbandoned: 3 } }), 0, T);
    expect(idle.hasTraffic).toBe(false);
    expect(idle.slaTone).toBe('default');
    expect(idle.abandonTone).toBe('default');
    expect(idle.abandonPct).toBe(0);
  });

  it('low SLA is destructive and carries the live longest wait', () => {
    const m = queueTileMetrics(queue({ sla: 55 }), 75, T);
    expect(m.slaTone).toBe('destructive');
    expect(m.longestWaitSec).toBe(75);
    expect(m.waitTone).toBe('destructive');
  });
});
