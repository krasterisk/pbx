import { describe, expect, it } from 'vitest';
import {
  addDays,
  canShiftForward,
  detectPreset,
  presetRange,
  rangeDays,
  shiftRange,
} from './reportPeriod';

const TODAY = '2026-10-15';

describe('reportPeriod', () => {
  it('builds the dashboard presets', () => {
    expect(presetRange('today', TODAY)).toEqual({ from: '2026-10-15', to: '2026-10-15' });
    expect(presetRange('yesterday', TODAY)).toEqual({ from: '2026-10-14', to: '2026-10-14' });
    expect(presetRange('7d', TODAY)).toEqual({ from: '2026-10-09', to: '2026-10-15' });
    expect(presetRange('30d', TODAY)).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts range days inclusively', () => {
    expect(rangeDays({ from: '2026-10-15', to: '2026-10-15' })).toBe(1);
    expect(rangeDays({ from: '2026-10-09', to: '2026-10-15' })).toBe(7);
  });

  it('detects a preset and falls back to custom', () => {
    expect(detectPreset({ from: '2026-10-09', to: '2026-10-15' }, TODAY)).toBe('7d');
    expect(detectPreset({ from: '2026-10-14', to: '2026-10-14' }, TODAY)).toBe('yesterday');
    expect(detectPreset({ from: '2026-10-01', to: '2026-10-05' }, TODAY)).toBe('custom');
  });

  it('shifts by the length of the range', () => {
    expect(shiftRange({ from: '2026-10-09', to: '2026-10-15' }, -1)).toEqual({ from: '2026-10-02', to: '2026-10-08' });
    expect(shiftRange({ from: '2026-10-14', to: '2026-10-14' }, 1)).toEqual({ from: '2026-10-15', to: '2026-10-15' });
  });

  it('does not allow moving forward from a range that already ends today', () => {
    expect(canShiftForward({ from: '2026-10-09', to: '2026-10-15' }, TODAY)).toBe(false);
    expect(canShiftForward({ from: '2026-10-08', to: '2026-10-14' }, TODAY)).toBe(true);
  });
});
