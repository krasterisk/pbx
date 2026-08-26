import { describe, it, expect } from 'vitest';
import { expandAsteriskPattern, resolveDialPreviewOptions } from './dialPreviewSample';

describe('expandAsteriskPattern', () => {
  it('passes exact extensions through', () => {
    expect(expandAsteriskPattern('100')).toBe('100');
    expect(expandAsteriskPattern('79001234567')).toBe('79001234567');
  });

  it('expands X / Z / N tokens', () => {
    expect(expandAsteriskPattern('_7XXXXXXXXXX')).toBe('70000000000');
    expect(expandAsteriskPattern('_NXX')).toBe('200');
    expect(expandAsteriskPattern('_ZXX')).toBe('100');
  });

  it('expands character classes and trailing dots', () => {
    expect(expandAsteriskPattern('_[2-9]NXXXXXXX')).toBe('220000000');
    expect(expandAsteriskPattern('_8.')).toBe('800');
  });
});

describe('resolveDialPreviewOptions', () => {
  it('uses the fixed destination as an exact sample', () => {
    expect(resolveDialPreviewOptions({ source: 'fixed', value: '4951234567' })).toEqual([
      { value: '4951234567', label: '4951234567', exact: true },
    ]);
  });

  it('expands route patterns for route_pattern destination', () => {
    const opts = resolveDialPreviewOptions(
      { source: 'route_pattern' },
      { routePatterns: ['_7XXXXXXXXXX', '100'] },
    );
    expect(opts[0]).toEqual({
      value: '70000000000',
      label: '_7XXXXXXXXXX → 70000000000',
      exact: false,
    });
    expect(opts[1]).toEqual({ value: '100', label: '100', exact: true });
  });

  it('lengthens short route samples for trunk (phone) previews', () => {
    const opts = resolveDialPreviewOptions(
      { source: 'route_pattern' },
      { routePatterns: ['201', '_NXX'], minLength: 7, fallback: '79001234567' },
    );
    expect(opts).toEqual([
      { value: '79001234567', label: '201 → 79001234567', exact: false },
    ]);
  });

  it('pulls real phonebook var values', () => {
    const opts = resolveDialPreviewOptions(
      { source: 'phonebook', phonebookUid: 1, varKey: 'trunk_num' },
      {
        phonebooks: [
          {
            uid: 1,
            name: 'VIP',
            user_uid: 1,
            entries: [
              { uid: 10, phonebook_uid: 1, number: '79001112233', vars: { trunk_num: '84951234567' } },
            ],
          },
        ],
      },
    );
    expect(opts[0]).toMatchObject({ value: '84951234567', exact: true });
  });

  it('labels variables without pretending the runtime value is known', () => {
    const opts = resolveDialPreviewOptions(
      { source: 'variable', name: 'OUTNUM' },
      { fallback: '79001234567' },
    );
    expect(opts[0].label).toBe('${OUTNUM}');
    expect(opts[0].value).toBe('79001234567');
  });
});
