import { describe, it, expect } from 'vitest';
import {
  directoryRecordDedupeKey,
  findDuplicateRecordIndexes,
  recordHasAsteriskPattern,
} from './directoryRecordLookup';

describe('directoryRecordDedupeKey', () => {
  it('treats a leading underscore as a pattern and does not strip digits', () => {
    expect(directoryRecordDedupeKey('_7900XXXXXXX', 'digits')).toBe('asterisk_pattern\0_7900XXXXXXX');
    expect(directoryRecordDedupeKey('  _1XX  ', 'digits')).toBe('asterisk_pattern\0_1XX');
  });

  it('normalizes exact phone keys when the directory uses digits', () => {
    expect(directoryRecordDedupeKey('+7-900-123-45-67', 'digits')).toBe(`exact\0${'79001234567'}`);
    expect(directoryRecordDedupeKey('+7-900-123-45-67', 'none')).toBe('exact\0+7-900-123-45-67');
  });

  it('treats 8-900 and +7-900 as the same key in ru_8_to_7 mode', () => {
    expect(directoryRecordDedupeKey('8-900-123-45-67', 'ru_8_to_7')).toBe(`exact\0${'79001234567'}`);
    expect(directoryRecordDedupeKey('+7 (900) 123-45-67', 'ru_8_to_7')).toBe(`exact\0${'79001234567'}`);
  });

  it('ignores empty cells', () => {
    expect(directoryRecordDedupeKey('', 'digits')).toBeNull();
    expect(directoryRecordDedupeKey('   ', 'none')).toBeNull();
    expect(directoryRecordDedupeKey(undefined, 'digits')).toBeNull();
  });
});

describe('findDuplicateRecordIndexes', () => {
  it('flags identical Asterisk patterns', () => {
    const dupes = findDuplicateRecordIndexes(
      [
        { values: { number: '_7900XXXXXXX', name: 'A' } },
        { values: { number: '_7900123XXXX', name: 'B' } },
        { values: { number: '_7900XXXXXXX', name: 'C' } },
      ],
      'number',
      'digits',
    );
    expect([...dupes].sort()).toEqual([0, 2]);
  });

  it('flags exact numbers that collide after digit normalization', () => {
    const dupes = findDuplicateRecordIndexes(
      [
        { values: { number: '123' } },
        { values: { number: '+1-23' } },
      ],
      'number',
      'digits',
    );
    expect([...dupes].sort()).toEqual([0, 1]);
  });

  it('does not treat a narrower pattern as a duplicate of a broader one', () => {
    const dupes = findDuplicateRecordIndexes(
      [
        { values: { number: '_7900123XXXX' } },
        { values: { number: '_7900XXXXXXX' } },
      ],
      'number',
      'digits',
    );
    expect(dupes.size).toBe(0);
  });
});

describe('recordHasAsteriskPattern', () => {
  it('detects a leading underscore after trim', () => {
    expect(recordHasAsteriskPattern('_1XX')).toBe(true);
    expect(recordHasAsteriskPattern('  _X')).toBe(true);
    expect(recordHasAsteriskPattern('7900')).toBe(false);
  });
});
