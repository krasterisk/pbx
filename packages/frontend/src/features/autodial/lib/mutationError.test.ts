import { describe, expect, it } from 'vitest';
import { autodialErrorKey } from './mutationError';

describe('autodialErrorKey', () => {
  it('shows localized tenant-reference and active-call errors', () => {
    for (const code of [
      'AC_TRUNK_NOT_FOUND',
      'AC_QUEUE_NOT_FOUND',
      'AC_EXTENSION_NOT_FOUND',
      'AC_CAMPAIGN_ACTIVE_CALLS',
    ]) {
      expect(autodialErrorKey({ data: { code } }, 'fallback')).toBe(`autodial.errors.${code}`);
    }
  });

  it('does not display an unrecognized backend message', () => {
    expect(autodialErrorKey({ data: { code: 'SQL_INTERNAL_ERROR' } }, 'fallback')).toBe('fallback');
  });
});
