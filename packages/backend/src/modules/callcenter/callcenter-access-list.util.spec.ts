import {
  isRawOperatorDisplayName,
  operatorDisplayName,
  preferHumanOperatorName,
} from './callcenter-access-list.util';

describe('callcenter-access-list display names', () => {
  it('treats PJSIP / tenant ids as raw', () => {
    expect(isRawOperatorDisplayName('PJSIP/e201_0', '201')).toBe(true);
    expect(isRawOperatorDisplayName('e201_0', '201')).toBe(true);
    expect(isRawOperatorDisplayName('201', '201')).toBe(true);
    expect(isRawOperatorDisplayName('Alice', '201')).toBe(false);
  });

  it('operatorDisplayName falls back to extension', () => {
    expect(operatorDisplayName('PJSIP/e201_0', '201')).toBe('201');
    expect(operatorDisplayName('Alice', '201')).toBe('Alice');
  });

  it('preferHumanOperatorName keeps Alice over PJSIP', () => {
    expect(preferHumanOperatorName('Alice', 'PJSIP/e201_0', '201')).toBe('Alice');
    expect(preferHumanOperatorName('201', 'PJSIP/e201_0', '201')).toBe('201');
    expect(preferHumanOperatorName('201', 'Bob', '201')).toBe('Bob');
  });
});
