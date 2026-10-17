import { describe, expect, it } from 'vitest';
import {
  callStatusLabel,
  formatCcDateRange,
  formatCcDuration,
  formatCcPercent,
  formatPhone,
} from './ccFormat';
import type { CallStatus } from '../model/types/callCenterSchema';

describe('formatCcDuration', () => {
  it('formats under one hour as m:ss and from one hour as h:mm:ss', () => {
    expect(formatCcDuration(0)).toBe('0:00');
    expect(formatCcDuration(59)).toBe('0:59');
    expect(formatCcDuration(65)).toBe('1:05');
    expect(formatCcDuration(3599)).toBe('59:59');
    expect(formatCcDuration(3600)).toBe('1:00:00');
    expect(formatCcDuration(3661)).toBe('1:01:01');
  });

  it('clamps null, undefined, NaN and negative numbers to 0:00', () => {
    expect(formatCcDuration(null)).toBe('0:00');
    expect(formatCcDuration(undefined)).toBe('0:00');
    expect(formatCcDuration(Number.NaN)).toBe('0:00');
    expect(formatCcDuration(-15)).toBe('0:00');
  });
});

describe('formatCcPercent', () => {
  it('uses comma and non-breaking space in Russian and dot in English', () => {
    expect(formatCcPercent(78.44, 'ru')).toBe('78,4 %');
    expect(formatCcPercent(78.44, 'en')).toBe('78.4%');
    expect(formatCcPercent(80, 'ru')).toBe('80 %');
    expect(formatCcPercent(80, 'en')).toBe('80%');
    expect(formatCcPercent(null, 'ru')).toBe('—');
    expect(formatCcPercent(undefined, 'en')).toBe('—');
  });
});

describe('formatCcDateRange', () => {
  it('formats single-day, same-year and cross-year ranges in ru and en', () => {
    expect(formatCcDateRange('2026-07-20', '2026-08-19', 'ru')).toBe('20 июл — 19 авг 2026');
    expect(formatCcDateRange('2026-07-20', '2026-08-19', 'en')).toBe('Jul 20 — Aug 19, 2026');
    expect(formatCcDateRange('2026-07-20', '2026-07-20', 'ru')).toBe('20 июл 2026');
    expect(formatCcDateRange('2026-07-20', '2026-07-20', 'en')).toBe('Jul 20, 2026');
    expect(formatCcDateRange('2025-12-28', '2026-01-05', 'ru')).toBe('28 дек 2025 — 5 янв 2026');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit Russian numbers and preserves extensions', () => {
    expect(formatPhone('79123456789')).toBe('+7 912 345-67-89');
    expect(formatPhone('+79123456789')).toBe('+7 912 345-67-89');
    expect(formatPhone('89123456789')).toBe('+7 912 345-67-89');
    expect(formatPhone('101')).toBe('101');
    expect(formatPhone('')).toBe('-');
    expect(formatPhone(null)).toBe('-');
  });
});

describe('callStatusLabel', () => {
  const t = (key: string, fallback?: string) => `${key}:${fallback ?? ''}`;

  it('has a translated label for every CallStatus member', () => {
    const all: CallStatus[] = ['WAITING', 'RINGING', 'TALKING', 'HOLD', 'TRANSFERRED'];
    for (const status of all) {
      const label = callStatusLabel(status, t);
      expect(label).toMatch(/^callcenter\.callStatus\./);
      expect(label).not.toContain(status);
    }
  });
});
