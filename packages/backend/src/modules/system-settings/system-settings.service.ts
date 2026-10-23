import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActionLog } from '../logger/action-log.model';
import type { OrganizationCalendar, OrganizationWeekStart, OrganizationRegionalSettings } from '@krasterisk/shared';
import { organizationWeekStartKey, readOrganizationWeekStart } from '../../shared/organization-calendar';
import { readOrganizationTimezone,organizationTimezoneKey,missingTimezoneTable } from '../../shared/organization-timezone';
import { QueryTypes } from 'sequelize';
import type { JwtPayloadUser } from '../auth/auth.service';
import { InjectModel } from '@nestjs/sequelize';
import { SystemSetting } from './system-setting.model';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Keys managed via UI — stored in system_settings table */
export const MANAGED_KEYS = ['records_base_path', 'records_base_url', 'webhook_secret'] as const;
export type ManagedKey = (typeof MANAGED_KEYS)[number];

export interface ServerConfig {
  records_base_path: string;
  records_base_url: string;
  webhook_secret: string;
}

export interface FfmpegStatus {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);
  private warnedMissingTable = false;

  constructor(
    @InjectModel(SystemSetting) private settingModel: typeof SystemSetting,
    private readonly config: ConfigService,
    @InjectModel(ActionLog) private readonly audit: typeof ActionLog,
  ) {}

  private timezoneTenant(user: JwtPayloadUser): number {
    if (![0,1].includes(user.level)) throw new ForbiddenException('Company administrator required');
    if (!Number.isSafeInteger(user.vpbx_user_uid) || user.vpbx_user_uid < 0) throw new ForbiddenException('Invalid organization');
    return user.vpbx_user_uid;
  }

  async organizationTimezone(user: JwtPayloadUser) {
    const tenant = this.timezoneTenant(user);
    const timezone = await readOrganizationTimezone(this.settingModel.sequelize!,tenant,this.config.get<string>('PBX_DEFAULT_TIMEZONE','UTC'));
    return {timezone,canEdit:true};
  }

  async organizationRegional(user: JwtPayloadUser): Promise<OrganizationRegionalSettings> {
    const timezone = await this.organizationTimezone(user);
    const calendar = await this.organizationCalendar(user);
    return { ...timezone, ...calendar };
  }

  async setOrganizationRegional(user: JwtPayloadUser, settings: Pick<OrganizationRegionalSettings, 'timezone' | 'weekStart'>): Promise<OrganizationRegionalSettings> {
    const tenant = this.timezoneTenant(user);
    const { timezone, weekStart } = settings;
    if (!['monday', 'sunday'].includes(weekStart)) throw new BadRequestException('Invalid week start');
    try {
      if (typeof timezone !== 'string' || !timezone || timezone.length > 64) throw new Error();
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch { throw new BadRequestException('Invalid IANA timezone'); }
    const db = this.settingModel.sequelize!;
    let cloudRow = false;
    try {
      cloudRow = (await db.query('SELECT timezone FROM tenants WHERE vpbx_user_uid=:tenant LIMIT 1', { replacements: { tenant }, type: QueryTypes.SELECT })).length > 0;
    } catch (error) { if (!missingTimezoneTable(error)) throw error; }
    await db.transaction(async transaction => {
      if (cloudRow) {
        await db.query('UPDATE tenants SET timezone=:timezone WHERE vpbx_user_uid=:tenant', { replacements: { tenant, timezone }, transaction });
      } else {
        await this.settingModel.upsert({ key: organizationTimezoneKey(tenant), value: timezone, category: 'organization', updated_at: new Date() }, { transaction });
      }
      await this.settingModel.upsert({ key: organizationWeekStartKey(tenant), value: weekStart, category: 'organization', updated_at: new Date() }, { transaction });
      await this.audit.create({ user_id: user.sub, user_uid: tenant, action: 'organization_regional_update', entity_type: 'tenant', entity_id: null, details: JSON.stringify({ timezone, weekStart }), status: 'success' }, { transaction });
    });
    return { timezone, weekStart, canEdit: true };
  }

  async organizationCalendar(user: JwtPayloadUser): Promise<OrganizationCalendar> {
    if (!Number.isSafeInteger(user.vpbx_user_uid) || user.vpbx_user_uid < 0) throw new ForbiddenException('Invalid organization');
    return { weekStart: await readOrganizationWeekStart(this.settingModel.sequelize!, user.vpbx_user_uid), canEdit: [0,1].includes(user.level) };
  }

  async setOrganizationWeekStart(user: JwtPayloadUser, weekStart: OrganizationWeekStart): Promise<OrganizationCalendar> {
    const tenant = this.timezoneTenant(user);
    if (!['monday', 'sunday'].includes(weekStart)) throw new BadRequestException('Invalid week start');
    await this.settingModel.sequelize!.transaction(async transaction => {
      await this.settingModel.upsert({ key: organizationWeekStartKey(tenant), value: weekStart, category: 'organization', updated_at: new Date() }, { transaction });
      await this.audit.create({ user_id: user.sub, user_uid: tenant, action: 'organization_week_start_update', entity_type: 'tenant', entity_id: null, details: JSON.stringify({ weekStart }), status: 'success' }, { transaction });
    });
    return { weekStart, canEdit: true };
  }

  async setOrganizationTimezone(user: JwtPayloadUser, timezone: string) {
    const tenant = this.timezoneTenant(user);
    try { if (!timezone || timezone.length > 64) throw new Error(); new Intl.DateTimeFormat('en',{timeZone:timezone}).format(); }
    catch { throw new BadRequestException('Invalid IANA timezone'); }
    const db = this.settingModel.sequelize!;
    let cloudRow = false;
    try { cloudRow = (await db.query('SELECT timezone FROM tenants WHERE vpbx_user_uid=:tenant LIMIT 1',{replacements:{tenant},type:QueryTypes.SELECT})).length > 0; }
    catch(error){if(!missingTimezoneTable(error))throw error;}
    await db.transaction(async transaction => {
      if(cloudRow)await db.query('UPDATE tenants SET timezone=:timezone WHERE vpbx_user_uid=:tenant',{replacements:{tenant,timezone},transaction});
      else await this.settingModel.upsert({key:organizationTimezoneKey(tenant),value:timezone,category:'organization',updated_at:new Date()},{transaction});
      await this.audit.create({user_id:user.sub,user_uid:tenant,action:'organization_timezone_update',entity_type:'tenant',entity_id:null,details:JSON.stringify({timezone}),status:'success'}, {transaction});
    });
    return {timezone,canEdit:true};
  }

  private isMissingTableError(err: unknown): boolean {
    const parent = (err as { parent?: { code?: string; errno?: number } })?.parent;
    return parent?.code === 'ER_NO_SUCH_TABLE' || parent?.errno === 1146;
  }

  /** DB overrides for managed keys; empty map if table is absent (falls back to .env). */
  private async loadManagedSettingsMap(): Promise<Record<string, string>> {
    try {
      const rows = await this.settingModel.findAll({
        where: { key: MANAGED_KEYS as any },
      });
      return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
    } catch (err) {
      if (!this.isMissingTableError(err)) throw err;
      if (!this.warnedMissingTable) {
        this.warnedMissingTable = true;
        this.logger.warn(
          'system_settings table not found — using .env defaults. Run: npx ts-node src/modules/system-settings/migrate-system-settings.ts',
        );
      }
      return {};
    }
  }

  async findAll(): Promise<SystemSetting[]> {
    try {
      return await this.settingModel.findAll();
    } catch (err) {
      if (this.isMissingTableError(err)) return [];
      throw err;
    }
  }

  /**
   * Get server config values.
   * Priority: system_settings table > .env > defaults
   * The table overrides allow UI-based config without server SSH access.
   */
  async getServerConfig(): Promise<ServerConfig> {
    const map = await this.loadManagedSettingsMap();

    return {
      records_base_path: map['records_base_path'] ?? this.config.get('RECORDS_BASE_PATH') ?? '/usr/records',
      records_base_url: map['records_base_url'] ?? this.config.get('RECORDS_BASE_URL') ?? '',
      // NEVER expose actual secret — return masked value if set
      webhook_secret: map['webhook_secret']
        ? '••••••••'
        : this.config.get('WEBHOOK_SECRET')
          ? '••••••••'
          : '',
    };
  }

  /**
   * Get raw (unmasked) config values for internal use.
   */
  async getServerConfigRaw(): Promise<ServerConfig> {
    const map = await this.loadManagedSettingsMap();

    return {
      records_base_path: map['records_base_path'] ?? this.config.get('RECORDS_BASE_PATH') ?? '/usr/records',
      records_base_url: map['records_base_url'] ?? this.config.get('RECORDS_BASE_URL') ?? '',
      webhook_secret: map['webhook_secret'] ?? this.config.get('WEBHOOK_SECRET') ?? '',
    };
  }

  /**
   * Update one or more server config keys.
   * Empty string clears the DB override (falls back to .env).
   */
  async updateServerConfig(updates: Partial<ServerConfig>): Promise<{ updated: string[] }> {
    const updated: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!MANAGED_KEYS.includes(key as ManagedKey)) continue;
      // Skip if caller sent masked placeholder back unchanged
      if (value === '••••••••') continue;

      if (value === '' || value === null || value === undefined) {
        // Clear DB override → fallback to .env
        await this.settingModel.destroy({ where: { key } });
      } else {
        await this.settingModel.upsert({
          key,
          value: String(value),
          category: 'dialplan',
          updated_at: new Date(),
        });
      }
      updated.push(key);
    }

    return { updated };
  }

  /**
   * Check if ffmpeg is installed and return version info.
   * Runs `ffmpeg -version` via child_process.
   */
  async checkFfmpeg(): Promise<FfmpegStatus> {
    try {
      const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
      const firstLine = stdout.split('\n')[0] || '';
      // Extract version from "ffmpeg version 6.1 Copyright..."
      const versionMatch = firstLine.match(/ffmpeg version (\S+)/);
      return {
        available: true,
        version: versionMatch?.[1] ?? firstLine.trim(),
        path: 'ffmpeg',
      };
    } catch (err: any) {
      return {
        available: false,
        error: err?.message?.includes('not found') || err?.code === 'ENOENT'
          ? 'ffmpeg not found in PATH. Install with: apt install ffmpeg'
          : err?.message || 'Unknown error',
      };
    }
  }
}
