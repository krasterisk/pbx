import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CloudSetting } from './cloud-setting.model';

/** Generic key/value cloud settings (seller moved to billing_sellers). */
@Injectable()
export class CloudSettingsService {
  constructor(
    @InjectModel(CloudSetting) private readonly settingModel: typeof CloudSetting,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.settingModel.findOne({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string, description?: string): Promise<void> {
    await this.settingModel.upsert({ key, value, description: description ?? null } as any);
  }
}
