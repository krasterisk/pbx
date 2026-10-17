import { describe, expect, it } from 'vitest';
import { buildSlaTrends } from './queueTrend';

describe('buildSlaTrends', () => {
  it('compares the last half hour with the one before, in points', () => {
    const t = buildSlaTrends([
      { queueName: 'sales', offered: 20, sla: 50, previousSla: 100 },
      { queueName: 'support', offered: 8, sla: 92.5, previousSla: 80 },
      { queueName: 'vip', offered: 3, sla: 100, previousSla: 100 },
    ]);
    expect(t.sales).toEqual({ sla: 50, delta: -50, direction: 'down' });
    expect(t.support).toEqual({ sla: 92.5, delta: 12.5, direction: 'up' });
    expect(t.vip).toEqual({ sla: 100, delta: 0, direction: 'flat' });
  });

  it('has a level but no change when the half hour before had no traffic', () => {
    expect(buildSlaTrends([{ queueName: 'new', offered: 4, sla: 75, previousSla: null }]).new).toEqual({ sla: 75, delta: null, direction: 'flat' });
  });

  it('has no entry at all for a queue without a verdict now', () => {
    expect(buildSlaTrends([{ queueName: 'ghost', offered: 3, sla: null, previousSla: 90 }])).toEqual({});
  });

  it('is empty without data', () => {
    expect(buildSlaTrends(undefined)).toEqual({});
  });
});
