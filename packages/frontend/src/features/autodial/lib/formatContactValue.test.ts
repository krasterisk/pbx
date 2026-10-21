import { describe, expect, it } from 'vitest';
import { formatContactValue } from './formatContactValue';

const labels = { locale: 'ru-RU', yes: 'Да', no: 'Нет', empty: '—' };
describe('customer field examples and table values', () => {
  it('keeps false and zero distinct from missing values', () => {
    expect(formatContactValue({ type: 'boolean' }, false, labels)).toBe('Нет');
    expect(formatContactValue({ type: 'number' }, 0, labels)).toBe('0');
    expect(formatContactValue({ type: 'string' }, undefined, labels)).toBe('—');
    expect(formatContactValue({ type: 'boolean' }, 'legacy unknown', labels)).toBe('legacy unknown');
  });
  it('uses the actual currency and configured calendar presentation', () => {
    const amount = formatContactValue({ type: 'money', format: { currency: 'USD' } }, 123.45, labels);
    expect(amount).toContain('123,45'); expect(amount).toContain('$');
    expect(formatContactValue({ type: 'date', format: { date_input: 'ru' } }, '2026-10-20', labels)).toBe('20.10.2026');
    expect(formatContactValue({ type: 'date', format: { date_input: 'iso' } }, '2026-10-20', labels)).toBe('2026-10-20');
  });
});
