import { evaluateDialTargetRewrite } from '@krasterisk/shared';
import { applyNumberManipulation, compileDialTargetRewrite } from './dialplan-number.util';

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

describe('compileDialTargetRewrite', () => {
  it('emits first-match gates and charset check', () => {
    const compiled = compileDialTargetRewrite('${EXTEN}', {
      noMatch: 'passthrough',
      rules: [{
        id: 'r1',
        conditions: [{ kind: 'startsWith', value: '7' }],
        transform: { stripStartCount: 1, prefix: '8' },
      }],
    });
    expect(compiled.usedRewrite).toBe(true);
    expect(compiled.destExpr).toBe('${KRSK_DIAL_NUM}');
    expect(compiled.lines.join('\n')).toContain('Set(KRSK_DIAL_SRC=${EXTEN})');
    expect(compiled.lines.join('\n')).toContain('"${KRSK_DIAL_SRC:0:1}" = "7"');
    expect(compiled.lines.join('\n')).toContain('FILTER(0-9+*#');
  });
});

describe('evaluateDialTargetRewrite (shared)', () => {
  it('keeps first match and blocks empty result', () => {
    expect(evaluateDialTargetRewrite('7900', {
      rules: [
        { id: 'a', conditions: [{ kind: 'startsWith', value: '7' }], transform: { prefix: '8' } },
        { id: 'b', transform: { prefix: '9' } },
      ],
    }).matchedRuleId).toBe('a');
    expect(evaluateDialTargetRewrite('12', {
      rules: [{ id: 'z', transform: { stripStartCount: 2 } }],
    }).error).toBe('empty');
  });
});
