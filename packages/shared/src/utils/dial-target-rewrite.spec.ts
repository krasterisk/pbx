import {
  coerceDestValueSource,
  coerceDialTargetRewrite,
  evaluateDialTargetRewrite,
  isAllowedRewriteRegex,
  liftDialTargetRewrite,
} from './dial-target-rewrite';

describe('coerceDestValueSource', () => {
  it('maps ${EXTEN} and empty string to route_pattern', () => {
    expect(coerceDestValueSource('${EXTEN}')).toEqual({ source: 'route_pattern' });
    expect(coerceDestValueSource('')).toEqual({ source: 'route_pattern' });
    expect(coerceDestValueSource('__USE_EXTEN__')).toEqual({ source: 'route_pattern' });
  });

  it('keeps a fixed number', () => {
    expect(coerceDestValueSource('7900')).toEqual({ source: 'fixed', value: '7900' });
  });
});

describe('coerceDialTargetRewrite', () => {
  it('lifts nested numberManipulation', () => {
    expect(coerceDialTargetRewrite({ numberManipulation: { strip: 1, prepend: '8' } })).toEqual({
      noMatch: 'passthrough',
      rules: [{
        id: 'legacy',
        enabled: true,
        conditions: [],
        transform: { stripStartCount: 1, prefix: '8' },
      }],
    });
  });

  it('lifts top-level strip/prepend', () => {
    const rewrite = coerceDialTargetRewrite({ strip: 1, prepend: '8' });
    expect(rewrite?.rules?.[0].transform).toEqual({ stripStartCount: 1, prefix: '8' });
  });
});

describe('evaluateDialTargetRewrite', () => {
  it('applies strip then prefix then postfix', () => {
    const result = evaluateDialTargetRewrite('79001234567', {
      rules: [{
        id: 'r1',
        transform: { stripStartCount: 1, prefix: '8', postfix: '#' },
      }],
    });
    expect(result).toEqual({ output: '89001234567#', matchedRuleId: 'r1' });
  });

  it('uses the first matching rule', () => {
    const result = evaluateDialTargetRewrite('+74951234567', {
      rules: [
        { id: 'plus7', conditions: [{ kind: 'startsWith', value: '+7' }], transform: { stripStartText: '+7', prefix: '8' } },
        { id: 'seven', conditions: [{ kind: 'startsWith', value: '7' }], transform: { stripStartText: '7', prefix: '8' } },
      ],
    });
    expect(result.matchedRuleId).toBe('plus7');
    expect(result.output).toBe('84951234567');
  });

  it('ANDs conditions', () => {
    const rewrite = {
      rules: [{
        id: 'and',
        conditions: [
          { kind: 'startsWith' as const, value: '7' },
          { kind: 'length' as const, min: 11, max: 11 },
        ],
        transform: { stripStartCount: 1, prefix: '8' },
      }],
    };
    expect(evaluateDialTargetRewrite('79001234567', rewrite).output).toBe('89001234567');
    expect(evaluateDialTargetRewrite('7900', rewrite).matchedRuleId).toBeNull();
  });

  it('passthrough when nothing matches', () => {
    const result = evaluateDialTargetRewrite('112', {
      noMatch: 'passthrough',
      rules: [{ id: 'long', conditions: [{ kind: 'length', min: 10 }], transform: { prefix: '8' } }],
    });
    expect(result).toEqual({ output: '112', matchedRuleId: null });
  });

  it('rejects when noMatch is reject', () => {
    const result = evaluateDialTargetRewrite('112', {
      noMatch: 'reject',
      rules: [{ id: 'long', conditions: [{ kind: 'length', min: 10 }], transform: { prefix: '8' } }],
    });
    expect(result.error).toBe('rejected');
  });

  it('blocks an empty result', () => {
    const result = evaluateDialTargetRewrite('88', {
      rules: [{ id: 'all', transform: { stripStartCount: 2 } }],
    });
    expect(result.error).toBe('empty');
    expect(result.matchedRuleId).toBe('all');
  });

  it('rejects a disallowed regex', () => {
    expect(isAllowedRewriteRegex('(?=7)\\d+')).toBe(false);
    expect(isAllowedRewriteRegex('^[0-9]{11}$')).toBe(true);
  });

  it('matches a digit mask', () => {
    const result = evaluateDialTargetRewrite('74951234567', {
      rules: [{ id: 'mask', conditions: [{ kind: 'digitMask', value: '7XXXXXXXXXX' }], transform: { prefix: '8' } }],
    });
    expect(result.output).toBe('874951234567');
  });
});

describe('liftDialTargetRewrite', () => {
  it('converts dest ${EXTEN} and strip/prepend together', () => {
    const { params, changed } = liftDialTargetRewrite({
      dest: '${EXTEN}',
      strip: 1,
      prepend: '8',
    });
    expect(changed).toBe(true);
    expect(params.dest).toEqual({ source: 'route_pattern' });
    expect(params.rewrite).toBeDefined();
    expect(params.strip).toBeUndefined();
  });
});
