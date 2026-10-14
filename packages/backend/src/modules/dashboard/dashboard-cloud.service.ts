import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { DashboardCloud, DashboardLive } from '@krasterisk/shared';

interface CloudRow {
  id: number; plan_name: string | null; plan_expires_at: Date | string | null;
  max_extensions: number; max_trunks: number; max_queues: number;
  max_concurrent_calls: number | null; timezone: string | null; status: string;
  balance_id: number | null; balance_kopecks: number | string | null;
  credit_limit_kopecks: number | string | null; is_blocked: boolean | number | null;
}
const nullableInteger = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
};
const validTimezone = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; }
  catch { return false; }
};

@Injectable()
export class DashboardCloudService {
  constructor(private readonly sequelize: Sequelize, private readonly config: ConfigService) {}

  async timezone(tenantUid: number): Promise<string> {
    const rows = await this.sequelize.query<{ timezone: string | null }>(
      'SELECT timezone FROM tenants WHERE vpbx_user_uid = :tenantUid LIMIT 1',
      { replacements: { tenantUid }, type: QueryTypes.SELECT },
    );
    if (validTimezone(rows[0]?.timezone)) return rows[0].timezone;
    const fallback = this.config.get<string>('PBX_DEFAULT_TIMEZONE', 'UTC');
    return validTimezone(fallback) ? fallback : 'UTC';
  }

  async overview(tenantUid: number, live?: DashboardLive): Promise<DashboardCloud> {
    const empty: DashboardCloud = {
      source: { state: 'unavailable', updatedAt: null }, planName: null, expiresAt: null,
      balanceKopecks: null, creditLimitKopecks: null, blocked: false,
      limits: { extensions: null, trunks: null, queues: null, concurrentCalls: null },
      usage: { extensions: live?.endpoints.total ?? 0, trunks: live?.trunks.total ?? 0,
        queues: 0, concurrentCalls: live?.activeCalls ?? 0 },
    };
    try {
      // Explicit tenant binding. Reads never auto-create a zero balance.
      const rows = await this.sequelize.query<CloudRow>(
        `SELECT t.id, t.plan_name, t.plan_expires_at, t.timezone, t.status,
          t.max_extensions, t.max_trunks, t.max_queues, t.max_concurrent_calls,
          b.id AS balance_id, b.balance_kopecks, b.credit_limit_kopecks, b.is_blocked
         FROM tenants t LEFT JOIN billing_balances b ON b.tenant_id = t.id
         WHERE t.vpbx_user_uid = :tenantUid LIMIT 1`,
        { replacements: { tenantUid }, type: QueryTypes.SELECT },
      );
      const row = rows[0];
      if (!row) return { ...empty, source: { state: 'notConfigured', updatedAt: null, message: 'tenantNotConfigured' } };
      const queues = await this.sequelize.query<{ count: string | number }>(
        'SELECT COUNT(*) AS count FROM queue_table WHERE vpbx_user_uid = :tenantUid',
        { replacements: { tenantUid }, type: QueryTypes.SELECT },
      );
      return {
        source: { state: 'ok', updatedAt: new Date().toISOString() },
        billingSource: { state: row.balance_id === null ? 'notConfigured' : 'ok', updatedAt: new Date().toISOString(),
          ...(row.balance_id === null ? { message: 'billingBalanceNotConfigured' } : {}) },
        planName: row.plan_name, expiresAt: row.plan_expires_at ? new Date(row.plan_expires_at).toISOString() : null,
        balanceKopecks: nullableInteger(row.balance_kopecks), creditLimitKopecks: nullableInteger(row.credit_limit_kopecks),
        blocked: row.is_blocked === true || row.is_blocked === 1 || row.status === 'suspended' || row.status === 'cancelled',
        limits: { extensions: nullableInteger(row.max_extensions), trunks: nullableInteger(row.max_trunks),
          queues: nullableInteger(row.max_queues), concurrentCalls: nullableInteger(row.max_concurrent_calls) },
        usage: { ...empty.usage, queues: nullableInteger(queues[0]?.count) ?? 0 },
      };
    } catch {
      return { ...empty, source: { state: 'unavailable', updatedAt: null, message: 'cloudDataUnavailable' } };
    }
  }
}
