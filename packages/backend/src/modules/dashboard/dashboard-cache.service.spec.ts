import { DashboardCacheService } from './dashboard-cache.service';
describe('Dashboard bounded single-flight cache', () => {
  it('shares one expensive query among 100 viewers', async () => {
    const cache = new DashboardCacheService(); const loader = jest.fn(async () => ({ total: 10000 }));
    const results = await Promise.all(Array.from({ length: 100 }, () => cache.get('tenant:42:scope:one:v1', 30000, loader)));
    expect(loader).toHaveBeenCalledTimes(1); expect(results).toHaveLength(100);
  });
  it('isolates scope keys and retries failed loads', async () => {
    const cache = new DashboardCacheService(); const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(7);
    await expect(cache.get('a', 10000, load)).rejects.toThrow('offline');
    expect(await cache.get('a', 10000, load)).toBe(7);
    expect(await cache.get('b', 10000, load)).toBe(7); expect(load).toHaveBeenCalledTimes(3);
  });
  it('limits memory entries rather than retaining arbitrary searches forever', async () => {
    const cache = new DashboardCacheService();
    for (let i = 0; i < 500; i++) await cache.get(String(i), 30000, async () => i);
    expect((cache as any).entries.size).toBeLessThanOrEqual(256);
  });
});
