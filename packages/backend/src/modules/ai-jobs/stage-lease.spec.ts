import { claimStage, commitStage, startStageExecution, type StageLease } from './stage-lease';

const now = new Date('2026-09-19T00:00:00.000Z');

function pending(): StageLease {
  return {
    id: 'stage-1', tenantUid: 2, state: 'pending', version: 1, fence: 0,
    leaseOwner: null, leaseUntil: null,
  };
}

describe('D2 stage leases', () => {
  it('claims with a fence and rejects a stale completion', () => {
    const leased = claimStage(pending(), {
      owner: 'worker-alpha', expectedVersion: 1, now, leaseMs: 30000,
    });
    expect(leased.state).toBe('leased');
    expect(leased.fence).toBe(1);
    const executing = startStageExecution(leased, { owner: 'worker-alpha', fence: 1 });
    expect(executing.state).toBe('executing');
    expect(() => commitStage(executing, { owner: 'worker-beta', fence: 1, to: 'succeeded' }))
      .toThrow(/stale fence/);
    expect(commitStage(executing, { owner: 'worker-alpha', fence: 1, to: 'succeeded' }).state).toBe('succeeded');
  });

  it('refuses OS PID owners', () => {
    expect(() => claimStage(pending(), { owner: '1234', expectedVersion: 1, now, leaseMs: 30000 }))
      .toThrow(/OS PID/);
  });
});
