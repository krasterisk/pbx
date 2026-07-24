import { describe, it, expect } from 'vitest';
import { isEndpointUnreachable } from './TransferDirectory';

describe('isEndpointUnreachable', () => {
  it('treats missing / offline / invalid as unreachable', () => {
    expect(isEndpointUnreachable(undefined)).toBe(true);
    expect(isEndpointUnreachable('')).toBe(true);
    expect(isEndpointUnreachable('OFFLINE')).toBe(true);
    expect(isEndpointUnreachable('Unavailable')).toBe(true);
    expect(isEndpointUnreachable('Invalid')).toBe(true);
    expect(isEndpointUnreachable('UNKNOWN')).toBe(true);
  });

  it('keeps idle and busy endpoints reachable for transfer list', () => {
    expect(isEndpointUnreachable('NOT_INUSE')).toBe(false);
    expect(isEndpointUnreachable('READY')).toBe(false);
    expect(isEndpointUnreachable('INUSE')).toBe(false);
    expect(isEndpointUnreachable('BUSY')).toBe(false);
    expect(isEndpointUnreachable('IN_CALL')).toBe(false);
  });
});
