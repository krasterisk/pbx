import { ThrottlerStorageService } from '@nestjs/throttler';

/** A busy endpoint must not cancel expiration of another endpoint's hits. */
describe('Rate-limit storage key isolation', () => {
  it('expires parking hits normally after a different key leaves its blocked window', async () => {
    jest.useFakeTimers();
    const storage = new ThrottlerStorageService();
    try {
      await storage.increment('parking', 60000, 60, 60000, 'global');
      await storage.increment('busy-endpoint', 1000, 1, 1000, 'global');
      expect(
        (await storage.increment('busy-endpoint', 1000, 1, 1000, 'global'))
          .isBlocked,
      ).toBe(true);
      jest.advanceTimersByTime(1001);
      await storage.increment('busy-endpoint', 1000, 1, 1000, 'global');
      jest.advanceTimersByTime(60000);
      const parking = await storage.increment(
        'parking',
        60000,
        60,
        60000,
        'global',
      );
      expect(parking.totalHits).toBe(1);
      expect(parking.isBlocked).toBe(false);
    } finally {
      storage.onApplicationShutdown();
      jest.useRealTimers();
    }
  });
});
