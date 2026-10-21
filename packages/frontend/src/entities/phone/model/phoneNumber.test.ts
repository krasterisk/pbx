import { describe, expect, it } from 'vitest';
import { dialableNumber, formatPhoneNumber, phoneHistoryHref } from './phoneNumber';

describe('structured phone numbers', () => {
  it('accepts human formatting and PBX service codes without exposing channel identities', () => {
    expect(dialableNumber('+7 (913) 555-11-22')).toBe('+79135551122');
    expect(dialableNumber('101')).toBe('101');
    expect(dialableNumber('*97')).toBe('*97');
    for (const value of ['PJSIP/e101_0', 'javascript:alert(1)', '101;hangup', '101\nCallerID:2', '', '+', '+7+913', '7'.repeat(65)]) {
      expect(dialableNumber(value)).toBeNull();
    }
  });
  it('keeps report navigation local and encodes the complete exact number', () => {
    const url = new URL(phoneHistoryHref('+7 (913) 555-11-22'), 'https://pbx.invalid');
    expect(url.pathname).toBe('/reports/calls');
    expect(url.searchParams.get('search')).toBe('+79135551122');
    expect(url.searchParams.get('dateFrom')).toBe('');
    expect(url.searchParams.get('dateTo')).toBe('');
    expect(() => phoneHistoryHref('PJSIP/101')).toThrow('Invalid phone number');
    expect(formatPhoneNumber('+79135551122')).toBe('+7 913 555-11-22');
  });
});
