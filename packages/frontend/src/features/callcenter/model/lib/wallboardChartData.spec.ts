import { describe, it, expect } from 'vitest';
import { pushSample, bucketHourlyDeltas, type CallSample } from './wallboardChartData';

/** Fixed timestamps: hour H on 2026-07-16 local - use UTC constructors for stability. */
function tsAtHour(hour: number, minute = 0): number {
  return Date.UTC(2026, 6, 16, hour, minute, 0);
}

describe('wallboardChartData', () => {
  describe('bucketHourlyDeltas', () => {
    it('returns 24 zero buckets for empty input', () => {
      const result = bucketHourlyDeltas([]);
      expect(result).toHaveLength(24);
      expect(result.every((b) => b.calls === 0)).toBe(true);
      expect(result.map((b) => b.hour)).toEqual([...Array(24).keys()]);
    });

    it('buckets delta within the same hour', () => {
      const samples: CallSample[] = [
        { t: tsAtHour(10, 0), total: 10 },
        { t: tsAtHour(10, 30), total: 15 },
      ];
      const result = bucketHourlyDeltas(samples);
      // Date.UTC hour maps to local getHours - assert relative: only one non-zero
      const nonZero = result.filter((b) => b.calls > 0);
      expect(nonZero).toHaveLength(1);
      expect(nonZero[0].calls).toBe(5);
      expect(nonZero[0].hour).toBe(new Date(tsAtHour(10, 30)).getHours());
    });

    it('distributes samples across different hours', () => {
      const samples: CallSample[] = [
        { t: tsAtHour(9, 0), total: 0 },
        { t: tsAtHour(9, 50), total: 4 },
        { t: tsAtHour(11, 10), total: 10 },
      ];
      const result = bucketHourlyDeltas(samples);
      const h9 = new Date(tsAtHour(9, 50)).getHours();
      const h11 = new Date(tsAtHour(11, 10)).getHours();
      expect(result[h9].calls).toBe(4);
      expect(result[h11].calls).toBe(6);
    });

    it('treats negative delta (counter reset) as 0', () => {
      const samples: CallSample[] = [
        { t: tsAtHour(14, 0), total: 20 },
        { t: tsAtHour(14, 5), total: 3 },
      ];
      const result = bucketHourlyDeltas(samples);
      expect(result.every((b) => b.calls === 0)).toBe(true);
      expect(result.every((b) => b.calls >= 0)).toBe(true);
    });
  });

  describe('pushSample', () => {
    it('trims array to maxSamples', () => {
      const samples: CallSample[] = [
        { t: 1, total: 1 },
        { t: 2, total: 2 },
        { t: 3, total: 3 },
      ];
      const next = pushSample(samples, { t: 4, total: 4 }, 3);
      expect(next).toHaveLength(3);
      expect(next[0]).toEqual({ t: 2, total: 2 });
      expect(next[2]).toEqual({ t: 4, total: 4 });
    });
  });
});
