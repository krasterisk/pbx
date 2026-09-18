import { autodialContactVariables } from './autodial-contact-variables.util';

describe('autodialContactVariables', () => {
  const fields = [
    { uid: 1, type: 'phone' as const, is_phone: true, var_name: 'AC_PHONE' },
    { uid: 2, type: 'string' as const, is_phone: false, var_name: 'AC_NAME' },
    { uid: 3, type: 'boolean' as const, is_phone: false, var_name: 'AC_ACTIVE' },
    { uid: 4, type: 'number' as const, is_phone: false, var_name: 'AC_COUNT' },
  ];
  it('exports normalized phone fields without duplicating phones in stored values', () => {
    expect(autodialContactVariables(fields, { '2': 'Alice', '3': false, '4': 0 }, '79001234567')).toEqual({
      __AC_PHONE: '79001234567', __AC_NAME: 'Alice', __AC_ACTIVE: 'false', __AC_COUNT: '0',
    });
  });
  it('preserves legacy phone values and sanitizes field text as before', () => {
    expect(autodialContactVariables(fields, { '1': 'legacy', '2': 'A,\r\nB' }, '79001234567')).toEqual({
      __AC_PHONE: 'legacy', __AC_NAME: 'A   B',
    });
  });
  it('does not invent missing non-phone values and keeps the length limit', () => {
    const result = autodialContactVariables(fields, { '2': 'a'.repeat(300) }, '79001234567');
    expect(result.__AC_NAME).toHaveLength(255);
    expect(result).not.toHaveProperty('__AC_ACTIVE');
  });
});
