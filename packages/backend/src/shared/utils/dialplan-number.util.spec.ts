import { applyNumberManipulation } from './dialplan-number.util';

describe('applyNumberManipulation (D-26)', () => {
  it('strips first, then prepends', () => {
    expect(applyNumberManipulation('79001234567', { strip: 1, prepend: '8' })).toBe('89001234567');
  });

  it('reverse order is a different result', () => {
    const stripThenPrepend = applyNumberManipulation('79001234567', { strip: 1, prepend: '8' });
    const prependThenStrip = `8${'79001234567'}`.slice(1);
    expect(stripThenPrepend).toBe('89001234567');
    expect(prependThenStrip).toBe('79001234567');
    expect(stripThenPrepend).not.toBe(prependThenStrip);
  });

  it('strip longer than the number throws', () => {
    expect(() => applyNumberManipulation('101', { strip: 5 })).toThrow();
  });

  it('undefined manipulation returns the raw number', () => {
    expect(applyNumberManipulation('101')).toBe('101');
  });
});
