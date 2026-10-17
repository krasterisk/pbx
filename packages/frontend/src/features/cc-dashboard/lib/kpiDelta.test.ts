import { describe, expect, it } from 'vitest';
import { kpiDelta } from './kpiDelta';

describe('kpiDelta', () => {
  it('has nothing to compare without a previous value', () => {
    expect(kpiDelta(10, null, 'higherIsBetter')).toBeNull();
    expect(kpiDelta(10, undefined, 'higherIsBetter')).toBeNull();
    expect(kpiDelta(10, Number.NaN, 'higherIsBetter')).toBeNull();
  });

  it('SLA up is good, SLA down is bad', () => {
    expect(kpiDelta(85, 80, 'higherIsBetter')).toEqual({ abs: 5, pct: 6.3, trend: 'up', tone: 'success' });
    expect(kpiDelta(70, 80, 'higherIsBetter')).toEqual({ abs: -10, pct: -12.5, trend: 'down', tone: 'destructive' });
  });

  it('abandon rate and waits: lower is good', () => {
    expect(kpiDelta(4, 6, 'lowerIsBetter')).toMatchObject({ trend: 'down', tone: 'success' });
    expect(kpiDelta(9, 6, 'lowerIsBetter')).toMatchObject({ trend: 'up', tone: 'destructive' });
  });

  it('volume has no good direction', () => {
    expect(kpiDelta(120, 100, 'neutral')).toEqual({ abs: 20, pct: 20, trend: 'up', tone: 'default' });
  });

  it('returns null when the previous base is zero so UI shows no comparison instead of +N from zero (U4.1)', () => {
    expect(kpiDelta(5, 0, 'neutral')).toBeNull();
    expect(kpiDelta(0, 0, 'higherIsBetter')).toBeNull();
  });

  it('a change that rounds to zero is flat and never coloured', () => {
    expect(kpiDelta(80.04, 80, 'higherIsBetter')).toMatchObject({ abs: 0, trend: 'flat', tone: 'default' });
  });
});
