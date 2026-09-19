import {
  compareAndSwapVersion,
  completeStage,
  nextProviderOrdinal,
  recoverProviderDispatch,
  replayIdempotency,
  requestJobCancel,
  transitionJob,
  transitionProviderOperation,
  transitionStage,
} from './state-machines';

describe('D1 job/stage/provider state machines', () => {
  it('rejects illegal job transitions and terminal overwrites', () => {
    expect(transitionJob('queued', 'running')).toBe('running');
    expect(transitionJob('running', 'retry_wait')).toBe('retry_wait');
    expect(transitionJob('retry_wait', 'queued')).toBe('queued');
    expect(transitionJob('running', 'awaiting_reconciliation')).toBe('awaiting_reconciliation');
    expect(() => transitionJob('succeeded', 'running')).toThrow(/illegal job transition/);
    expect(() => transitionJob('queued', 'succeeded')).toThrow(/illegal job transition/);
  });

  it('records cancel as a flag while running and terminals queued work immediately', () => {
    const running = requestJobCancel(
      { state: 'running' as const, cancel_requested_at: null },
      new Date('2026-09-19T00:00:00.000Z'),
    );
    expect(running.state).toBe('running');
    expect(running.cancel_requested_at?.toISOString()).toBe('2026-09-19T00:00:00.000Z');
    expect(requestJobCancel(
      { state: 'queued' as const, cancel_requested_at: null },
      new Date('2026-09-19T00:00:00.000Z'),
    ).state).toBe('cancelled');
    expect(() => requestJobCancel(
      { state: 'succeeded' as const, cancel_requested_at: null },
      new Date(),
    )).toThrow(/illegal cancel/);
  });

  it('keeps succeeded stages immutable unless the output digest matches', () => {
    expect(transitionStage('pending', 'leased')).toBe('leased');
    expect(transitionStage('executing', 'unknown')).toBe('unknown');
    expect(completeStage('executing', 'succeeded', 'abc')).toBe('succeeded');
    expect(completeStage('succeeded', 'succeeded', 'abc', 'abc')).toBe('succeeded');
    expect(() => completeStage('succeeded', 'succeeded', 'abc', 'other')).toThrow(/immutable/);
    expect(() => completeStage('succeeded', 'failed')).toThrow(/immutable/);
  });

  it('treats a crash after dispatch as unknown instead of a second dispatch', () => {
    expect(transitionProviderOperation('prepared', 'dispatched')).toBe('dispatched');
    expect(recoverProviderDispatch('dispatched')).toBe('unknown');
    expect(() => transitionProviderOperation('dispatched', 'dispatched')).toThrow(/illegal/);
    expect(recoverProviderDispatch('prepared')).toBe('dispatched');
    expect(() => recoverProviderDispatch('reconciled_success')).toThrow(/illegal provider dispatch/);
  });

  it('increments provider ordinal only for a new external call', () => {
    expect(nextProviderOrdinal(null, 'new_external_call')).toBe(1);
    expect(nextProviderOrdinal(1, 'worker_restart')).toBe(1);
    expect(nextProviderOrdinal(1, 'new_external_call')).toBe(2);
    expect(() => nextProviderOrdinal(null, 'worker_restart')).toThrow(/existing ordinal/);
  });

  it('detects CAS collisions and idempotency hash conflicts', () => {
    expect(compareAndSwapVersion(3, 3)).toBe(4);
    expect(() => compareAndSwapVersion(3, 2)).toThrow(/cas collision/);
    expect(replayIdempotency({ state: 'completed', storedHash: 'a', requestHash: 'a' })).toBe('same');
    expect(replayIdempotency({ state: 'started', storedHash: 'a', requestHash: 'b' })).toBe('conflict');
  });
});
