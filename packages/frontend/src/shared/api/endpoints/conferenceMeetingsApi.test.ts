import { describe, it, expect } from 'vitest';
import { conferenceMeetingPlayUrl } from './conferenceMeetingsApi';

describe('conferenceMeetingPlayUrl (16.2-03 D-33)', () => {
  it('builds the JWT meeting play path for a room and meeting uid', () => {
    expect(conferenceMeetingPlayUrl(77, 15)).toBe('/conferences/77/meetings/15/play');
  });

  it('appends download=1 when requested', () => {
    expect(conferenceMeetingPlayUrl(77, 15, { download: true })).toBe(
      '/conferences/77/meetings/15/play?download=1',
    );
  });
});
