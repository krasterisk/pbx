import type { IAutodialRetryConfig } from '@krasterisk/shared';
import {
  decideRetry,
  dispositionFromAnsweredCall,
  dispositionFromHangupCause,
  isTerminalDisposition,
} from './autodial-disposition.util';

const retry: IAutodialRetryConfig = {
  max_attempts: 3,
  default_interval_sec: 3600,
  intervals_sec: { busy: 600, no_answer: 1800 },
};

describe('dispositionFromHangupCause', () => {
  it.each([
    [17, 'busy'],
    [19, 'no_answer'],
    [16, 'no_answer'],
    [34, 'congestion'],
    [1, 'invalid_number'],
    [28, 'invalid_number'],
    [21, 'failed'],
  ])('maps cause %i to %s', (cause, expected) => {
    expect(dispositionFromHangupCause(cause)).toBe(expected);
  });

  it('falls back to failed for unknown causes', () => {
    expect(dispositionFromHangupCause(999)).toBe('failed');
  });
});

describe('dispositionFromAnsweredCall', () => {
  it('counts a call at or above the threshold as success', () => {
    expect(dispositionFromAnsweredCall({ billsec: 15, successMinSec: 15 })).toBe('success');
  });

  it('counts a shorter call as answered_short', () => {
    expect(dispositionFromAnsweredCall({ billsec: 14, successMinSec: 15 })).toBe('answered_short');
  });

  it('prefers the AMD verdict over talk time', () => {
    expect(
      dispositionFromAnsweredCall({ billsec: 60, successMinSec: 15, amdResult: 'MACHINE' }),
    ).toBe('amd_machine');
  });

  it('treats an uncertain AMD result as a human', () => {
    expect(
      dispositionFromAnsweredCall({ billsec: 60, successMinSec: 15, amdResult: 'NOTSURE' }),
    ).toBe('success');
  });
});

describe('decideRetry', () => {
  const now = new Date('2026-09-17T10:00:00Z');

  it('schedules the disposition-specific interval', () => {
    const decision = decideRetry({ disposition: 'busy', attemptCount: 1, retry, now });
    expect(decision.retry).toBe(true);
    expect(decision.nextAttemptAt?.toISOString()).toBe('2026-09-17T10:10:00.000Z');
  });

  it('falls back to the default interval for dispositions without their own', () => {
    const decision = decideRetry({ disposition: 'congestion', attemptCount: 1, retry, now });
    expect(decision.nextAttemptAt?.toISOString()).toBe('2026-09-17T11:00:00.000Z');
  });

  it('never retries a terminal disposition', () => {
    const decision = decideRetry({ disposition: 'success', attemptCount: 1, retry, now });
    expect(decision.retry).toBe(false);
    expect(decision.disposition).toBe('success');
  });

  it('records max_attempts instead of the last transient cause once attempts run out', () => {
    const decision = decideRetry({ disposition: 'busy', attemptCount: 3, retry, now });
    expect(decision.retry).toBe(false);
    expect(decision.disposition).toBe('max_attempts');
  });
});

describe('isTerminalDisposition', () => {
  it('treats give-up and opt-out outcomes as terminal', () => {
    expect(isTerminalDisposition('dnc')).toBe(true);
    expect(isTerminalDisposition('max_attempts')).toBe(true);
    expect(isTerminalDisposition('no_answer')).toBe(false);
  });
});
