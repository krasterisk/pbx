import { ConfigService } from '@nestjs/config';

export function requireJwtSecret(config: Pick<ConfigService, 'get'>): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.trim().length < 32 || secret === 'krasterisk-v4-secret') {
    throw new Error('JWT_SECRET must be explicitly configured with at least 32 characters');
  }
  return secret;
}
