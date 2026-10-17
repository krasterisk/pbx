/**
 * Tenant-level inputs of the metrics dictionary (cc-analytics A4/A5):
 * timezone, short-abandon window, default SLA threshold and per-queue SLA threshold.
 *
 * One reader for the live engine, raw reports, rollup and alerts so they cannot disagree.
 * Reads are cached briefly; settings writers call `invalidate()` for immediate effect.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  DEFAULT_SHORT_ABANDON_SEC,
  DEFAULT_SLA_THRESHOLD_SEC,
  isValidTimezone,
  normalizeShortAbandonSec,
  normalizeSlaThresholdSec,
  type MetricsConfig,
} from '@krasterisk/shared';
import { CcSettings } from './models/cc-settings.model';
import { Queue } from '../queues/queue.model';

export interface TenantMetricsConfig {
  timezone: string;
  shortAbandonSec: number;
  defaultSlaSec: number;
}

export interface TenantConfigEntry {
  config: TenantMetricsConfig;
  /** Raw JSON; callers sanitize with `sanitizeShiftPolicy`. */
  rawShiftPolicy: Record<string, unknown> | null;
  /** False when the tenant is known only from `tenants` (no cc_settings row yet) → calendar-day policy. */
  hasSettings: boolean;
}

const TENANT_TTL_MS = 60_000;

interface CachedTenant {
  config: TenantMetricsConfig;
  at: number;
}

@Injectable()
export class CallCenterMetricsConfigService {
  private readonly logger = new Logger(CallCenterMetricsConfigService.name);
  private readonly tenantCache = new Map<number, CachedTenant>();
  private readonly slaCache = new Map<string, number>();

  constructor(
    @InjectModel(CcSettings) private readonly settingsModel: typeof CcSettings,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
    @Optional() private readonly sequelize?: Sequelize,
    @Optional() private readonly env?: ConfigService,
  ) {}

  /** Fallback when the tenant has no valid `tenants.timezone`. */
  defaultTimezone(): string {
    const configured = this.env?.get<string>('PBX_DEFAULT_TIMEZONE', 'UTC');
    return isValidTimezone(configured) ? configured : 'UTC';
  }

  defaults(timezone = this.defaultTimezone()): TenantMetricsConfig {
    return {
      timezone,
      shortAbandonSec: DEFAULT_SHORT_ABANDON_SEC,
      defaultSlaSec: DEFAULT_SLA_THRESHOLD_SEC,
    };
  }

  /** Sync read — cached value or defaults (hot path in AMI handlers). */
  peekTenantConfig(userUid: number): TenantMetricsConfig {
    return this.tenantCache.get(userUid)?.config ?? this.defaults();
  }

  async getTenantConfig(userUid: number): Promise<TenantMetricsConfig> {
    const cached = this.tenantCache.get(userUid);
    if (cached && Date.now() - cached.at < TENANT_TTL_MS) return cached.config;
    const rows = await this.loadAll([userUid], userUid);
    return rows.get(userUid)?.config ?? this.peekTenantConfig(userUid);
  }

  /**
   * Load settings + timezone for every tenant that has a settings row or a `tenants` row
   * (plus `extraUids`). Refreshes the cache. Never throws: a failing read keeps defaults.
   */
  async loadAll(extraUids: number[] = [], onlyUid?: number): Promise<Map<number, TenantConfigEntry>> {
    const result = new Map<number, TenantConfigEntry>();
    const timezones = await this.loadTimezones(onlyUid);
    const fallbackZone = this.defaultTimezone();
    const now = Date.now();

    const put = (
      uid: number,
      partial: Partial<TenantMetricsConfig>,
      raw: Record<string, unknown> | null,
      hasSettings: boolean,
    ) => {
      const config: TenantMetricsConfig = {
        timezone: partial.timezone ?? timezones.get(uid) ?? fallbackZone,
        shortAbandonSec: partial.shortAbandonSec ?? DEFAULT_SHORT_ABANDON_SEC,
        defaultSlaSec: partial.defaultSlaSec ?? DEFAULT_SLA_THRESHOLD_SEC,
      };
      result.set(uid, { config, rawShiftPolicy: raw, hasSettings });
      this.tenantCache.set(uid, { config, at: now });
    };

    try {
      const rows = await this.settingsModel.findAll({
        attributes: ['user_uid', 'shift_policy', 'default_sla_threshold', 'short_abandon_sec'],
        ...(onlyUid !== undefined ? { where: { user_uid: onlyUid } } : {}),
      });
      for (const row of rows) {
        const uid = Number(row.user_uid);
        if (!Number.isFinite(uid)) continue;
        put(
          uid,
          {
            shortAbandonSec: normalizeShortAbandonSec(row.short_abandon_sec),
            defaultSlaSec: normalizeSlaThresholdSec(row.default_sla_threshold),
          },
          (row.shift_policy as unknown as Record<string, unknown> | null) ?? null,
          true,
        );
      }
    } catch (err: any) {
      this.logger.warn(`loadAll settings failed: ${err.message}`);
    }

    for (const uid of timezones.keys()) {
      if (!result.has(uid)) put(uid, {}, null, false);
    }
    for (const uid of extraUids) {
      if (!result.has(uid)) put(uid, {}, null, false);
    }
    return result;
  }

  /** Effective metrics config for one queue: tenant short-abandon + queue (or tenant default) SLA. */
  async getMetricsConfig(userUid: number, queueName: string): Promise<MetricsConfig & { timezone: string }> {
    const tenant = await this.getTenantConfig(userUid);
    const slaThresholdSec = await this.getSlaThreshold(userUid, queueName, tenant.defaultSlaSec);
    return { slaThresholdSec, shortAbandonSec: tenant.shortAbandonSec, timezone: tenant.timezone };
  }

  // ─── per-queue SLA ────────────────────────────────────────────────────────

  private slaKey(userUid: number, queueName: string): string {
    return `${userUid}:${queueName}`;
  }

  /** Sync read for hot paths; falls back to the tenant default. */
  peekSlaThreshold(userUid: number, queueName: string): number {
    return this.slaCache.get(this.slaKey(userUid, queueName)) ?? this.peekTenantConfig(userUid).defaultSlaSec;
  }

  /** Queue `servicelevel` when > 0, else the tenant default threshold, else 20 s. */
  async getSlaThreshold(userUid: number, queueName: string, tenantDefault?: number): Promise<number> {
    const key = this.slaKey(userUid, queueName);
    const cached = this.slaCache.get(key);
    if (cached !== undefined) return cached;

    const row = await this.queueModel.findOne({
      where: { name: queueName, user_uid: userUid },
      attributes: ['servicelevel'],
    });
    const level = row?.servicelevel;
    const fallback = tenantDefault ?? (await this.getTenantConfig(userUid)).defaultSlaSec;
    const threshold = level && level > 0 ? level : fallback;
    this.slaCache.set(key, threshold);
    return threshold;
  }

  /** Test/bootstrap helper and settings-change hook. */
  primeSlaThreshold(userUid: number, queueName: string, thresholdSec: number): void {
    this.slaCache.set(this.slaKey(userUid, queueName), thresholdSec);
  }

  /** Drop cached values after a settings or queue (servicelevel) change. */
  invalidate(userUid?: number): void {
    if (userUid === undefined) {
      this.tenantCache.clear();
      this.slaCache.clear();
      return;
    }
    this.tenantCache.delete(userUid);
    const prefix = `${userUid}:`;
    for (const key of [...this.slaCache.keys()]) {
      if (key.startsWith(prefix)) this.slaCache.delete(key);
    }
  }

  private async loadTimezones(onlyUid?: number): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!this.sequelize) return map;
    try {
      const rows = await this.sequelize.query<{ vpbx_user_uid: number | string; timezone: string | null }>(
        onlyUid === undefined
          ? 'SELECT vpbx_user_uid, timezone FROM tenants'
          : 'SELECT vpbx_user_uid, timezone FROM tenants WHERE vpbx_user_uid = :onlyUid',
        { type: QueryTypes.SELECT, replacements: { onlyUid } },
      );
      for (const row of rows) {
        const uid = Number(row.vpbx_user_uid);
        if (Number.isFinite(uid) && isValidTimezone(row.timezone)) map.set(uid, row.timezone);
      }
    } catch (err: any) {
      // Box installs without the tenants table fall back to PBX_DEFAULT_TIMEZONE / UTC.
      this.logger.debug(`tenant timezones unavailable: ${err.message}`);
    }
    return map;
  }
}
