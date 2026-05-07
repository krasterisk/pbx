import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectModel(SystemSetting) private settingModel: typeof SystemSetting,
    private readonly config: ConfigService,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.settingModel.findAll();
  }

  /**
   * Get server config values.
   * Priority: system_settings table > .env > defaults
   * The table overrides allow UI-based config without server SSH access.
   */
  async getServerConfig(): Promise<ServerConfig> {
    const rows = await this.settingModel.findAll({
      where: { key: MANAGED_KEYS as any },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));

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
    const rows = await this.settingModel.findAll({
      where: { key: MANAGED_KEYS as any },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));

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
