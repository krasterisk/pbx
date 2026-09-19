import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { IntegrationAuthLimit } from './integration-credential.models';
import type { TenantContext } from './tenant-context';

/** Shared SQL limits apply across every API instance. Keys never expose the source address. */
@Injectable()
export class IntegrationKeyRateLimiter {
  private readonly windowMs = 60_000;
  private failuresSinceCleanup = 0;

  constructor(
    @InjectModel(IntegrationAuthLimit) private readonly limits: typeof IntegrationAuthLimit,
    private readonly sequelize: Sequelize,
  ) {}

  private key(prefix: string, value: string): string {
    return createHash('sha256').update(prefix).update('\0').update(value).digest('hex');
  }

  private keys(remoteAddress: string, selector: string): [string, string] {
    return [this.key('ip', remoteAddress), this.key('pair', `${remoteAddress}\0${selector}`)];
  }

  async check(remoteAddress: string, selector: string, now = Date.now()): Promise<void> {
    const [ip, pair] = this.keys(remoteAddress, selector);
    let ipLimit: IntegrationAuthLimit | null;
    let pairLimit: IntegrationAuthLimit | null;
    try {
      [ipLimit, pairLimit] = await Promise.all([
        this.limits.findByPk(ip), this.limits.findByPk(pair),
      ]);
    } catch {
      throw new ServiceUnavailableException({ code: 'credential_auth_unavailable' });
    }
    if ((ipLimit && ipLimit.expires_at.getTime() > now && ipLimit.attempts >= 20)
      || (pairLimit && pairLimit.expires_at.getTime() > now && pairLimit.attempts >= 5)) {
      this.reject();
    }
  }

  async failure(remoteAddress: string, selector: string, now = Date.now()): Promise<void> {
    const expires = new Date(now + this.windowMs);
    const current = new Date(now);
    try {
      for (const key of this.keys(remoteAddress, selector)) {
        await this.bump(key, expires, current);
      }
      await this.cleanup(current);
    } catch {
      throw new ServiceUnavailableException({ code: 'credential_auth_unavailable' });
    }
  }

  /** Every management mutation consumes a shared tenant/actor bucket, successful or not. */
  async consumeManagement(context: TenantContext, now = Date.now()): Promise<void> {
    const key = this.key('management', `${context.tenantUid}\0${context.principalId}`);
    const current = new Date(now);
    try {
      await this.bump(key, new Date(now + this.windowMs), current);
      const row = await this.limits.findByPk(key);
      if (!row) throw new Error('Missing management rate-limit row');
      await this.cleanup(current);
      if (row.attempts > 10) this.reject();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ code: 'credential_auth_unavailable' });
    }
  }

  private async cleanup(current: Date): Promise<void> {
    if (++this.failuresSinceCleanup >= 256) {
      this.failuresSinceCleanup = 0;
      await this.limits.destroy({ where: { expires_at: { [Op.lte]: current } } });
    }
  }

  private async bump(key: string, expires: Date, now: Date): Promise<void> {
    // Each upsert is atomic, including concurrent first attempts on separate API nodes.
    if (this.sequelize.getDialect() === 'postgres') {
      await this.sequelize.query(`
          INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
          VALUES (:key, 1, :expires)
          ON CONFLICT (key_hash) DO UPDATE SET
            attempts = CASE WHEN ai_integration_auth_limits.expires_at <= :now
              THEN 1 ELSE ai_integration_auth_limits.attempts + 1 END,
            expires_at = CASE WHEN ai_integration_auth_limits.expires_at <= :now
              THEN :expires ELSE ai_integration_auth_limits.expires_at END
        `, { replacements: { key, expires, now } });
    } else if (this.sequelize.getDialect() === 'mysql' || this.sequelize.getDialect() === 'mariadb') {
      await this.sequelize.query(`
          INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
          VALUES (:key, 1, :expires)
          ON DUPLICATE KEY UPDATE
            attempts = IF(expires_at <= :now, 1, attempts + 1),
            expires_at = IF(expires_at <= :now, :expires, expires_at)
        `, { replacements: { key, expires, now } });
    } else {
      throw new Error('Unsupported integration auth limiter dialect');
    }
  }

  private reject(): never {
    throw new HttpException({ code: 'credential_rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
