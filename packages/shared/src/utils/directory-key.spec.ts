import { normalizeDirectoryKey } from './directory-key';

describe('normalizeDirectoryKey', () => {
  it('trims only in none mode', () => {
    expect(normalizeDirectoryKey(' AbC ', 'none')).toBe('AbC');
    expect(normalizeDirectoryKey('+7 (900) 123-45-67', 'none')).toBe('+7 (900) 123-45-67');
  });

  it('strips every non-digit in digits mode', () => {
    expect(normalizeDirectoryKey('+7 (900) 123-45-67', 'digits')).toBe('79001234567');
    expect(normalizeDirectoryKey('8-900-123-45-67', 'digits')).toBe('89001234567');
  });

  it('rewrites an 11-digit national 8 prefix to 7', () => {
    expect(normalizeDirectoryKey('8 (900) 123-45-67', 'ru_8_to_7')).toBe('79001234567');
    expect(normalizeDirectoryKey('+7 (900) 123-45-67', 'ru_8_to_7')).toBe('79001234567');
    expect(normalizeDirectoryKey('79001234567', 'ru_8_to_7')).toBe('79001234567');
  });

  it('does not rewrite shorter numbers or keys that already start with 7', () => {
    expect(normalizeDirectoryKey('8900123456', 'ru_8_to_7')).toBe('8900123456');
    expect(normalizeDirectoryKey('79001234567', 'ru_8_to_7')).toBe('79001234567');
  });
});
