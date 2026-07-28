import { describe, it, expect } from 'vitest';
import { dialFailureFromSipStatus, dialFailureFromOutboundEnd } from './dialFailure';

describe('dialFailureFromSipStatus', () => {
  it('maps common SIP codes', () => {
    expect(dialFailureFromSipStatus(486)).toBe('busy');
    expect(dialFailureFromSipStatus(600)).toBe('busy');
    expect(dialFailureFromSipStatus(404)).toBe('not_found');
    expect(dialFailureFromSipStatus(484)).toBe('not_found');
    expect(dialFailureFromSipStatus(480)).toBe('unavailable');
    expect(dialFailureFromSipStatus(603)).toBe('declined');
    expect(dialFailureFromSipStatus(488)).toBe('rejected');
  });

  it('falls back for missing codes', () => {
    expect(dialFailureFromSipStatus(undefined)).toBe('failed');
    expect(dialFailureFromSipStatus(200)).toBe('failed');
  });
});

describe('dialFailureFromOutboundEnd', () => {
  it('treats never-established as failed', () => {
    expect(dialFailureFromOutboundEnd({ establishedAt: null })).toBe('failed');
  });

  it('treats short answered calls as ended_early', () => {
    expect(dialFailureFromOutboundEnd({
      establishedAt: 1000,
      now: 2500,
      earlyMs: 3000,
    })).toBe('ended_early');
  });

  it('ignores normal-length calls', () => {
    expect(dialFailureFromOutboundEnd({
      establishedAt: 1000,
      now: 10_000,
      earlyMs: 3000,
    })).toBeNull();
  });
});
