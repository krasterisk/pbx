import { ConfigService } from '@nestjs/config';
import { requireJwtSecret } from './jwt-secret';
import { JwtStrategy } from './jwt.strategy';

describe('JWT configuration', () => {
  it.each([undefined, '', ' '.repeat(32), 'krasterisk-v4-secret', 'short'])('rejects unsafe secret %p', (secret) => {
    const config = new ConfigService({ JWT_SECRET: secret });
    expect(() => requireJwtSecret(config)).toThrow('JWT_SECRET');
    expect(() => new JwtStrategy(config, {} as any)).toThrow('JWT_SECRET');
  });

  it('uses the explicitly configured secret without modifying it', () => {
    const secret = 'explicit-test-secret-with-at-least-32-characters';
    expect(requireJwtSecret(new ConfigService({ JWT_SECRET: secret }))).toBe(secret);
  });
});
