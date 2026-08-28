import { normalizeDirectoryKey } from './directory-normalization.util';

describe('normalizeDirectoryKey', () => {
  it('strips every non-ASCII-digit character in digits mode', () => {
    expect(normalizeDirectoryKey('+7 (900) 123-45-67', 'digits')).toBe('79001234567');
  });

  it('trims only in none mode', () => {
    expect(normalizeDirectoryKey(' AbC ', 'none')).toBe('AbC');
  });
});
