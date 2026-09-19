import { IntegrationKeyRateLimiter } from './integration-key-rate-limiter';

describe('IntegrationKeyRateLimiter', () => {
  function fixture(dialect: 'mysql' | 'postgres') {
    const rows = new Map<string, { attempts: number; expires_at: Date }>();
    const model = { findByPk: jest.fn(async (key: string) => rows.get(key) ?? null) };
    const sequelize = {
      getDialect: () => dialect,
      query: jest.fn(async (_sql: string, options: { replacements: { key: string; expires: Date; now: Date } }) => {
        const { key, expires, now } = options.replacements;
        const prior = rows.get(key);
        rows.set(key, !prior || prior.expires_at <= now
          ? { attempts: 1, expires_at: expires }
          : { attempts: prior.attempts + 1, expires_at: prior.expires_at });
      }),
    };
    return { limiter: new IntegrationKeyRateLimiter(model as any, sequelize as any), rows, sequelize };
  }

  it.each(['mysql', 'postgres'] as const)('limits failures shared in %s and resets expired windows', async (dialect) => {
    const { limiter, rows, sequelize } = fixture(dialect);
    for (let i = 0; i < 5; i++) {
      await limiter.check('127.0.0.1', 'A'.repeat(22), 1000);
      await limiter.failure('127.0.0.1', 'A'.repeat(22), 1000);
    }
    await expect(limiter.check('127.0.0.1', 'A'.repeat(22), 1000)).rejects.toMatchObject({ status: 429 });
    await expect(limiter.check('127.0.0.1', 'B'.repeat(22), 1000)).resolves.toBeUndefined();
    for (let i = 0; i < 15; i++) await limiter.failure('127.0.0.1', String(i), 1000);
    await expect(limiter.check('127.0.0.1', 'C'.repeat(22), 1000)).rejects.toMatchObject({ status: 429 });
    await expect(limiter.check('127.0.0.1', 'A'.repeat(22), 61_001)).resolves.toBeUndefined();
    await limiter.failure('127.0.0.1', 'A'.repeat(22), 61_001);
    expect([...rows.values()].some((row) => row.attempts === 1 && row.expires_at.getTime() === 121_001)).toBe(true);
    expect([...rows.keys()].every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_integration_auth_limits'), expect.any(Object));
  });

  it('fails closed when the shared store is unavailable', async () => {
    const { limiter, sequelize } = fixture('postgres');
    sequelize.query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(limiter.failure('127.0.0.1', 'selector')).rejects.toMatchObject({ status: 503 });
  });

  it.each(['mysql', 'postgres'] as const)('bounds management requests across instances on %s', async (dialect) => {
    const { limiter, rows, sequelize } = fixture(dialect);
    const another = new IntegrationKeyRateLimiter({
      findByPk: async (key: string) => rows.get(key) ?? null,
    } as any, sequelize as any);
    const actor = { tenantUid: 7, principalId: 'user:42' } as any;
    for (let i = 0; i < 5; i++) await limiter.consumeManagement(actor, 1000);
    for (let i = 0; i < 5; i++) await another.consumeManagement(actor, 1000);
    await expect(limiter.consumeManagement(actor, 1000)).rejects.toMatchObject({ status: 429 });
    await expect(another.consumeManagement(actor, 61_001)).resolves.toBeUndefined();
  });
});
