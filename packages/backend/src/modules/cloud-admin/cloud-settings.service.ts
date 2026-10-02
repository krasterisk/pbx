import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { CloudSetting } from './cloud-setting.model';

/** Platform flag: public organization signup on /register. */
export const REGISTRATION_ENABLED_KEY = 'auth.registration_enabled';

/** Generic key/value cloud settings (seller moved to billing_sellers). */
@Injectable()
export class CloudSettingsService {
  constructor(
    @InjectModel(CloudSetting) private readonly settingModel: typeof CloudSetting,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private isMissingTableError(err: unknown): boolean {
    const parent = (err as { parent?: { code?: string; errno?: number } })?.parent;
    return parent?.code === 'ER_NO_SUCH_TABLE' || parent?.errno === 1146;
  }

  getDeploymentMode(): 'box' | 'cloud' | 'opensource' {
    const mode = (this.config?.get<string>('DEPLOYMENT_MODE') ?? 'BOX').trim().toLowerCase();
    return mode === 'cloud' || mode === 'opensource' ? mode : 'box';
  }

  /** Public signup is available only to explicitly enabled cloud installs or opensource. */
  private registrationDefault(): boolean {
    return this.getDeploymentMode() === 'opensource';
  }

  async isRegistrationEnabled(): Promise<boolean> {
    if (this.getDeploymentMode() === 'box') return false;
    let raw: string | null;
    try {
      raw = await this.get(REGISTRATION_ENABLED_KEY);
    } catch (err) {
      if (this.isMissingTableError(err)) return this.registrationDefault();
      throw err;
    }
    if (raw == null || raw.trim() === '') return this.registrationDefault();
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  async setRegistrationEnabled(enabled: boolean): Promise<void> {
    await this.set(
      REGISTRATION_ENABLED_KEY,
      enabled ? '1' : '0',
      'Public self-registration and organization creation',
    );
  }

  async get(key: string): Promise<string | null> {
    const row = await this.settingModel.findOne({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string, description?: string): Promise<void> {
    await this.settingModel.upsert({ key, value, description: description ?? null } as any);
  }
}
